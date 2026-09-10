/**
 * ReminderRepository — domain reminder rows (platform IDs stored separately).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import {
	isReminderScheduleType,
	isReminderType,
	parseDaysOfWeekJson,
	serializeDaysOfWeek,
	type CreateReminderInput,
	type Reminder,
	type UpdateReminderInput,
} from '../models/reminder'
import { nowUtcInstant } from '../utils/datetime'

interface ReminderRow {
	id: string
	child_id: string
	type: string
	title: string
	enabled: number
	schedule_type: string
	time_local: string | null
	days_of_week: string | null
	fire_at: string | null
	interval_hours: number | null
	related_entity_id: string | null
	platform_notification_id: string | null
	notes: string | null
	dose_text: string | null
	created_at: string
	updated_at: string
}

const REMINDER_SELECT = `SELECT id, child_id, type, title, enabled, schedule_type,
	time_local, days_of_week, fire_at, interval_hours, related_entity_id,
	platform_notification_id, notes, dose_text, created_at, updated_at
	FROM reminders`

function mapReminder (row: ReminderRow): Reminder {
	if (!isReminderType(row.type)) {
		throw new Error(`Unknown reminder type: ${row.type}`)
	}
	if (!isReminderScheduleType(row.schedule_type)) {
		throw new Error(`Unknown schedule type: ${row.schedule_type}`)
	}
	return {
		id: row.id,
		childId: row.child_id,
		type: row.type,
		title: row.title,
		enabled: row.enabled === 1,
		scheduleType: row.schedule_type,
		timeLocal: row.time_local,
		daysOfWeek: parseDaysOfWeekJson(row.days_of_week),
		fireAt: row.fire_at,
		intervalHours: row.interval_hours,
		relatedEntityId: row.related_entity_id,
		platformNotificationId: row.platform_notification_id,
		notes: row.notes,
		doseText: row.dose_text,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class ReminderRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<Reminder | null> {
		const row = await this.db.getFirstAsync<ReminderRow>(
			`${REMINDER_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapReminder(row) : null
	}

	async listByChild (childId: string): Promise<Reminder[]> {
		const rows = await this.db.getAllAsync<ReminderRow>(
			`${REMINDER_SELECT} WHERE child_id = ?
			 ORDER BY enabled DESC, title ASC`,
			childId,
		)
		return rows.map(mapReminder)
	}

	async listEnabledByChild (childId: string): Promise<Reminder[]> {
		const rows = await this.db.getAllAsync<ReminderRow>(
			`${REMINDER_SELECT} WHERE child_id = ? AND enabled = 1
			 ORDER BY title ASC`,
			childId,
		)
		return rows.map(mapReminder)
	}

	async listEnabledNoFeeding (childId: string): Promise<Reminder[]> {
		const rows = await this.db.getAllAsync<ReminderRow>(
			`${REMINDER_SELECT} WHERE child_id = ? AND enabled = 1
			 AND type = 'no_feeding'`,
			childId,
		)
		return rows.map(mapReminder)
	}

	async listAllEnabled (): Promise<Reminder[]> {
		const rows = await this.db.getAllAsync<ReminderRow>(
			`${REMINDER_SELECT} WHERE enabled = 1`,
		)
		return rows.map(mapReminder)
	}

	async create (input: CreateReminderInput): Promise<Reminder> {
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO reminders (
				id, child_id, type, title, enabled, schedule_type,
				time_local, days_of_week, fire_at, interval_hours,
				related_entity_id, platform_notification_id, notes, dose_text,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
			id,
			input.childId,
			input.type,
			input.title.trim(),
			input.enabled === false ? 0 : 1,
			input.scheduleType,
			input.timeLocal ?? null,
			serializeDaysOfWeek(input.daysOfWeek ?? null),
			input.fireAt ?? null,
			input.intervalHours ?? null,
			input.relatedEntityId ?? null,
			input.notes?.trim() || null,
			input.doseText?.trim() || null,
			audit,
			audit,
		)
		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create reminder')
		}
		return created
	}

	async update (id: string, input: UpdateReminderInput): Promise<Reminder> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Напоминание не найдено')
		}
		const audit = nowUtcInstant()
		const title = input.title?.trim() ?? existing.title
		const enabled =
			input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled ? 1 : 0
		const scheduleType = input.scheduleType ?? existing.scheduleType
		const timeLocal =
			input.timeLocal !== undefined ? input.timeLocal : existing.timeLocal
		const daysOfWeek =
			input.daysOfWeek !== undefined
				? input.daysOfWeek
				: existing.daysOfWeek
		const fireAt = input.fireAt !== undefined ? input.fireAt : existing.fireAt
		const intervalHours =
			input.intervalHours !== undefined
				? input.intervalHours
				: existing.intervalHours
		const relatedEntityId =
			input.relatedEntityId !== undefined
				? input.relatedEntityId
				: existing.relatedEntityId
		const platformNotificationId =
			input.platformNotificationId !== undefined
				? input.platformNotificationId
				: existing.platformNotificationId
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const doseText =
			input.doseText !== undefined
				? input.doseText?.trim() || null
				: existing.doseText

		await this.db.runAsync(
			`UPDATE reminders SET
				title = ?, enabled = ?, schedule_type = ?, time_local = ?,
				days_of_week = ?, fire_at = ?, interval_hours = ?,
				related_entity_id = ?, platform_notification_id = ?,
				notes = ?, dose_text = ?, updated_at = ?
			 WHERE id = ?`,
			title,
			enabled,
			scheduleType,
			timeLocal,
			serializeDaysOfWeek(daysOfWeek),
			fireAt,
			intervalHours,
			relatedEntityId,
			platformNotificationId,
			notes,
			doseText,
			audit,
			id,
		)
		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update reminder')
		}
		return updated
	}

	async setPlatformNotificationId (
		id: string,
		platformNotificationId: string | null,
	): Promise<void> {
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE reminders SET platform_notification_id = ?, updated_at = ?
			 WHERE id = ?`,
			platformNotificationId,
			audit,
			id,
		)
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync(`DELETE FROM reminders WHERE id = ?`, id)
	}
}
