/**
 * Reminder scheduling service — create/edit/delete + reconciliation + no-feeding.
 * Domain rows are source of truth; platform IDs are derived.
 */

import {
	buildReminderNotificationBody,
} from '../domain/reminderLabels'
import type {
	CreateReminderInput,
	Reminder,
	UpdateReminderInput,
	Weekday,
} from '../models/reminder'
import { isValidTimeLocal } from '../models/reminder'
import type { ReminderRepository } from '../repositories/reminderRepository'
import type { FeedingRepository } from '../repositories/feedingRepository'
import { parseOffsetDateTime, toOffsetDateTime } from '../utils/datetime'
import {
	getNotificationScheduler,
	type NotificationScheduler,
	type NotificationSchedule,
} from './notificationScheduler'
import { logger } from './logger'

export class ReminderValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'ReminderValidationError'
	}
}

export function parsePlatformNotificationIds (
	raw: string | null,
): string[] {
	if (!raw) {
		return []
	}
	if (raw.startsWith('[')) {
		try {
			const parsed = JSON.parse(raw) as unknown
			if (Array.isArray(parsed)) {
				return parsed.filter((x): x is string => typeof x === 'string')
			}
		} catch {
			return []
		}
	}
	return [raw]
}

export function serializePlatformNotificationIds (
	ids: string[],
): string | null {
	if (ids.length === 0) {
		return null
	}
	if (ids.length === 1) {
		return ids[0]!
	}
	return JSON.stringify(ids)
}

export interface ReminderServiceDeps {
	reminders: ReminderRepository
	feeding: FeedingRepository
	scheduler?: NotificationScheduler
}

export class ReminderService {
	private readonly reminders: ReminderRepository
	private readonly feeding: FeedingRepository
	private readonly scheduler: NotificationScheduler

	constructor (deps: ReminderServiceDeps) {
		this.reminders = deps.reminders
		this.feeding = deps.feeding
		this.scheduler = deps.scheduler ?? getNotificationScheduler()
	}

	/**
	 * Request permission only when user enables/creates a reminder.
	 * Returns false when denied (caller shows Russian message).
	 */
	async ensurePermission (): Promise<boolean> {
		const current = await this.scheduler.getPermissions()
		if (current === 'granted') {
			await this.scheduler.ensureAndroidChannel()
			return true
		}
		const next = await this.scheduler.requestPermissions()
		if (next === 'granted') {
			await this.scheduler.ensureAndroidChannel()
			return true
		}
		return false
	}

	async create (input: CreateReminderInput): Promise<Reminder> {
		validateReminderInput(input)
		const wantsEnabled = input.enabled !== false
		if (wantsEnabled) {
			const ok = await this.ensurePermission()
			if (!ok) {
				throw new ReminderValidationError(
					'Нет разрешения на уведомления. Включите их в настройках системы.',
				)
			}
		}

		let fireAt = input.fireAt ?? null
		if (input.type === 'no_feeding' && input.scheduleType === 'interval_hours') {
			fireAt = await this.computeNoFeedingFireAt(
				input.childId,
				input.intervalHours ?? 3,
			)
		}

		const created = await this.reminders.create({
			...input,
			fireAt,
			enabled: wantsEnabled,
		})
		if (created.enabled) {
			return this.reschedulePlatform(created)
		}
		return created
	}

	async update (id: string, input: UpdateReminderInput): Promise<Reminder> {
		const existing = await this.reminders.getById(id)
		if (!existing) {
			throw new ReminderValidationError('Напоминание не найдено')
		}
		const nextEnabled =
			input.enabled !== undefined ? input.enabled : existing.enabled
		if (nextEnabled) {
			const ok = await this.ensurePermission()
			if (!ok) {
				throw new ReminderValidationError(
					'Нет разрешения на уведомления. Включите их в настройках системы.',
				)
			}
		}

		await this.cancelPlatform(existing)

		let fireAt = input.fireAt
		const scheduleType = input.scheduleType ?? existing.scheduleType
		const type = existing.type
		const intervalHours =
			input.intervalHours !== undefined
				? input.intervalHours
				: existing.intervalHours
		if (
			type === 'no_feeding' &&
			scheduleType === 'interval_hours' &&
			nextEnabled
		) {
			fireAt = await this.computeNoFeedingFireAt(
				existing.childId,
				intervalHours ?? 3,
			)
		}

		const updated = await this.reminders.update(id, {
			...input,
			fireAt: fireAt !== undefined ? fireAt : input.fireAt,
			platformNotificationId: null,
		})
		if (updated.enabled) {
			return this.reschedulePlatform(updated)
		}
		return updated
	}

	async setEnabled (id: string, enabled: boolean): Promise<Reminder> {
		return this.update(id, { enabled })
	}

	async delete (id: string): Promise<void> {
		const existing = await this.reminders.getById(id)
		if (!existing) {
			return
		}
		await this.cancelPlatform(existing)
		await this.reminders.delete(id)
	}

	/**
	 * After a feeding event: cancel previous no_feeding pending and schedule next.
	 * Does not create infinite chains — one pending per reminder row.
	 */
	async rescheduleNoFeedingForChild (childId: string): Promise<void> {
		const list = await this.reminders.listEnabledNoFeeding(childId)
		for (const reminder of list) {
			await this.cancelPlatform(reminder)
			const fireAt = await this.computeNoFeedingFireAt(
				childId,
				reminder.intervalHours ?? 3,
			)
			const updated = await this.reminders.update(reminder.id, {
				fireAt,
				platformNotificationId: null,
			})
			await this.reschedulePlatform(updated)
		}
	}

	/**
	 * Reconcile enabled reminders vs platform scheduled set (on app start).
	 * Removes orphans; recreates missing. Not for every render.
	 */
	async reconcile (childId?: string): Promise<void> {
		const enabled = childId
			? await this.reminders.listEnabledByChild(childId)
			: await this.reminders.listAllEnabled()
		const scheduledIds = new Set(await this.scheduler.getAllScheduledIds())

		for (const reminder of enabled) {
			const ids = parsePlatformNotificationIds(
				reminder.platformNotificationId,
			)
			const missing =
				ids.length === 0 || ids.some((id) => !scheduledIds.has(id))
			if (missing) {
				try {
					await this.reschedulePlatform(reminder)
				} catch (err) {
					logger.warn('reminder reschedule failed', {
						id: reminder.id,
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}
		}
	}

	async openSystemSettings (): Promise<void> {
		await this.scheduler.openSystemSettings()
	}

	private async computeNoFeedingFireAt (
		childId: string,
		intervalHours: number,
	): Promise<string> {
		const recent = await this.feeding.listByChild(childId, 30)
		const latest = recent.find(
			(f) => f.type !== 'water' && f.type !== 'pumping',
		)
		const baseMs = latest
			? parseOffsetDateTime(latest.startAt).getTime()
			: Date.now()
		const fireMs = baseMs + intervalHours * 3_600_000
		const when = new Date(Math.max(fireMs, Date.now() + 60_000))
		return toOffsetDateTime(when)
	}

	private async cancelPlatform (reminder: Reminder): Promise<void> {
		const ids = parsePlatformNotificationIds(
			reminder.platformNotificationId,
		)
		for (const id of ids) {
			try {
				await this.scheduler.cancel(id)
			} catch (err) {
				logger.warn('cancel notification failed', {
					id,
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}
	}

	private async reschedulePlatform (reminder: Reminder): Promise<Reminder> {
		await this.cancelPlatform(reminder)
		if (!reminder.enabled) {
			return this.reminders.update(reminder.id, {
				platformNotificationId: null,
			})
		}

		const content = {
			title: reminder.title,
			body: buildReminderNotificationBody(reminder),
			data: { reminderId: reminder.id, childId: reminder.childId },
		}

		const schedules = buildSchedules(reminder)
		const platformIds: string[] = []
		for (const schedule of schedules) {
			const id = await this.scheduler.schedule(content, schedule)
			platformIds.push(id)
		}

		return this.reminders.update(reminder.id, {
			platformNotificationId: serializePlatformNotificationIds(platformIds),
			fireAt: reminder.fireAt,
		})
	}
}

function buildSchedules (reminder: Reminder): NotificationSchedule[] {
	if (reminder.scheduleType === 'once' || reminder.scheduleType === 'interval_hours') {
		if (!reminder.fireAt) {
			throw new ReminderValidationError('Не указано время срабатывания')
		}
		const date = parseOffsetDateTime(reminder.fireAt)
		if (date.getTime() <= Date.now()) {
			// Push slightly into the future to avoid immediate discard.
			date.setTime(Date.now() + 60_000)
		}
		return [{ kind: 'once', date }]
	}

	if (!reminder.timeLocal || !isValidTimeLocal(reminder.timeLocal)) {
		throw new ReminderValidationError('Укажите время в формате ЧЧ:ММ')
	}
	const [hs, ms] = reminder.timeLocal.split(':').map(Number)
	const hour = hs ?? 0
	const minute = ms ?? 0

	if (reminder.scheduleType === 'daily') {
		return [{ kind: 'daily', hour, minute }]
	}

	const days = reminder.daysOfWeek ?? []
	if (days.length === 0) {
		throw new ReminderValidationError('Выберите хотя бы один день недели')
	}
	return days.map((weekday: Weekday) => ({
		kind: 'weekly' as const,
		// Expo weekly trigger: 1 = Sunday … 7 = Saturday.
		weekday: isoWeekdayToExpo(weekday),
		hour,
		minute,
	}))
}

/** ISO Mon=1…Sun=7 → Expo Sun=1…Sat=7. */
export function isoWeekdayToExpo (iso: Weekday): number {
	return iso === 7 ? 1 : iso + 1
}

export function validateReminderInput (
	input: CreateReminderInput | (UpdateReminderInput & { type?: string; scheduleType?: string }),
): void {
	const title =
		'title' in input && input.title != null ? input.title.trim() : 'x'
	if (!title) {
		throw new ReminderValidationError('Укажите название')
	}
	const scheduleType =
		'scheduleType' in input ? input.scheduleType : undefined
	if (scheduleType === 'daily' || scheduleType === 'weekly') {
		const time =
			'timeLocal' in input ? input.timeLocal : undefined
		if (time && !isValidTimeLocal(time)) {
			throw new ReminderValidationError('Время должно быть в формате ЧЧ:ММ')
		}
	}
	if (scheduleType === 'interval_hours') {
		const hours =
			'intervalHours' in input ? input.intervalHours : undefined
		if (hours != null && (hours <= 0 || hours > 24)) {
			throw new ReminderValidationError(
				'Интервал укажите от 0,5 до 24 часов',
			)
		}
	}
}
