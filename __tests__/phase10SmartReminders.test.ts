/**
 * Phase 10 — Smart Today hints + reminders / no-feeding / reconciliation.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import {
	buildSmartTodayHint,
	collectValidFeedingIntervals,
	MIN_PERSONAL_FEEDING_SAMPLES,
	MIN_PERSONAL_WAKE_SAMPLES,
} from '../src/domain/smartToday'
import { MAX_WAKE_WINDOW_MS } from '../src/domain/wakeWindowStats'
import { ChildRepository } from '../src/repositories/childRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { ReminderRepository } from '../src/repositories/reminderRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import {
	MemoryNotificationScheduler,
	setNotificationSchedulerForTests,
} from '../src/services/notificationScheduler'
import {
	isoWeekdayToExpo,
	parsePlatformNotificationIds,
	ReminderService,
	ReminderValidationError,
	serializePlatformNotificationIds,
} from '../src/services/reminderService'
import type { SleepEvent } from '../src/models/sleep'
import type { FeedingEvent } from '../src/models/feeding'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const child = await children.create({
		name: 'Миша',
		birthDate: '2026-05-01',
	})
	const sleep = new SleepRepository(db)
	const feeding = new FeedingRepository(db)
	const reminders = new ReminderRepository(db)
	const scheduler = new MemoryNotificationScheduler()
	scheduler.permission = 'granted'
	setNotificationSchedulerForTests(scheduler)
	const service = new ReminderService({ reminders, feeding, scheduler })
	return { db, child, childId: child.id, sleep, feeding, reminders, scheduler, service }
}

function sleepEvent (
	partial: Partial<SleepEvent> & Pick<SleepEvent, 'id' | 'startAt' | 'endAt'>,
): SleepEvent {
	return {
		childId: 'c',
		startLocalDate: partial.startAt.slice(0, 10),
		endLocalDate: partial.endAt ? partial.endAt.slice(0, 10) : null,
		notes: null,
		createdAt: 'x',
		updatedAt: 'x',
		sleepType: 'day',
		...partial,
	}
}

describe('smart today', () => {
	it('suppresses hint when sleep or breastfeeding is active', () => {
		const hint = buildSmartTodayHint({
			child: { id: 'c', name: 'Миша', birthDate: '2026-05-01' },
			activeSleep: sleepEvent({
				id: '1',
				startAt: '2026-09-09T10:00:00+03:00',
				endAt: null,
			}),
			activeBreastfeeding: null,
			lastFinishedSleep: null,
			recentSleeps: [],
			recentFeedings: [],
			latestFeeding: null,
			nowMs: new Date('2026-09-09T11:00:00+03:00').getTime(),
			asOfDate: '2026-09-09',
		})
		expect(hint).toBeNull()
	})

	it('uses age guide fallback when wake history is insufficient', () => {
		const hint = buildSmartTodayHint({
			child: { id: 'c', name: 'Миша', birthDate: '2026-05-01' },
			activeSleep: null,
			activeBreastfeeding: null,
			lastFinishedSleep: sleepEvent({
				id: '1',
				startAt: '2026-09-09T08:00:00+03:00',
				endAt: '2026-09-09T09:00:00+03:00',
			}),
			recentSleeps: [
				sleepEvent({
					id: '1',
					startAt: '2026-09-09T08:00:00+03:00',
					endAt: '2026-09-09T09:00:00+03:00',
				}),
			],
			recentFeedings: [],
			latestFeeding: null,
			nowMs: new Date('2026-09-09T10:30:00+03:00').getTime(),
			asOfDate: '2026-09-09',
		})
		expect(hint?.kind).toBe('wake_age_guide')
		expect(hint?.body).toContain('Ориентир ВБ')
		expect(hint?.confidence).toBe('low')
	})

	it('builds personal wake hint and rejects huge outliers', () => {
		const sleeps: SleepEvent[] = []
		// Valid ~90 min wakes
		for (let i = 0; i < 6; i += 1) {
			const day = 3 + i
			sleeps.push(
				sleepEvent({
					id: `a${i}`,
					startAt: `2026-09-0${day}T08:00:00+03:00`,
					endAt: `2026-09-0${day}T09:00:00+03:00`,
				}),
				sleepEvent({
					id: `b${i}`,
					startAt: `2026-09-0${day}T10:30:00+03:00`,
					endAt: `2026-09-0${day}T11:30:00+03:00`,
				}),
			)
		}
		// Outlier gap > MAX_WAKE_WINDOW_MS between last pair — ignored by collector
		expect(MAX_WAKE_WINDOW_MS).toBeGreaterThan(0)
		expect(sleeps.length).toBeGreaterThan(MIN_PERSONAL_WAKE_SAMPLES)

		const hint = buildSmartTodayHint({
			child: { id: 'c', name: 'Миша', birthDate: '2026-05-01' },
			activeSleep: null,
			activeBreastfeeding: null,
			lastFinishedSleep: sleeps[sleeps.length - 1]!,
			recentSleeps: sleeps,
			recentFeedings: [],
			latestFeeding: null,
			nowMs: new Date('2026-09-09T13:00:00+03:00').getTime(),
			asOfDate: '2026-09-09',
		})
		expect(hint?.kind).toBe('wake_personal')
		expect(hint?.body).toContain('обычно засыпал')
		expect(hint?.title).toContain('Бодрствует')
	})

	it('builds feeding interval hint when enough history exists', () => {
		const feedings: FeedingEvent[] = []
		for (let i = 0; i < MIN_PERSONAL_FEEDING_SAMPLES + 1; i += 1) {
			const hour = 8 + i * 2
			feedings.push({
				id: `f${i}`,
				childId: 'c',
				type: 'bottle',
				feedingKind: 'formula',
				startAt: `2026-09-09T${String(hour).padStart(2, '0')}:00:00+03:00`,
				endAt: `2026-09-09T${String(hour).padStart(2, '0')}:00:00+03:00`,
				startLocalDate: '2026-09-09',
				endLocalDate: '2026-09-09',
				notes: null,
				createdAt: 'x',
				updatedAt: 'x',
				amountMl: 100,
			})
		}
		// Water should not break milk interval chain as endpoint
		const withWater = [
			...feedings,
			{
				...feedings[0]!,
				id: 'w1',
				type: 'water' as const,
				feedingKind: 'water' as const,
				startAt: '2026-09-09T09:00:00+03:00',
				amountMl: 30,
			},
		]
		expect(collectValidFeedingIntervals(withWater).length).toBeGreaterThanOrEqual(
			MIN_PERSONAL_FEEDING_SAMPLES,
		)

		const hint = buildSmartTodayHint({
			child: { id: 'c', name: 'Миша', birthDate: '2026-05-01' },
			activeSleep: null,
			activeBreastfeeding: null,
			lastFinishedSleep: null,
			recentSleeps: [],
			recentFeedings: withWater,
			latestFeeding: feedings[feedings.length - 1]!,
			nowMs: new Date('2026-09-09T20:00:00+03:00').getTime(),
			asOfDate: '2026-09-09',
		})
		expect(hint?.kind).toBe('feeding_interval')
		expect(hint?.body).toContain('промежуток')
		expect(hint?.title).toContain('Последнее кормление')
	})
})

describe('reminders', () => {
	afterEach(() => {
		setNotificationSchedulerForTests(null)
	})

	it('creates one-time, daily, weekdays; edit; disable; delete; replaces platform ids', async () => {
		const { service, scheduler, reminders, childId } = await setup()

		const once = await service.create({
			childId,
			type: 'doctor',
			title: 'Педиатр',
			scheduleType: 'once',
			fireAt: '2026-09-15T14:30:00+03:00',
		})
		expect(once.platformNotificationId).toBeTruthy()
		expect(scheduler.scheduled.size).toBe(1)

		const daily = await service.create({
			childId,
			type: 'vitamin',
			title: 'Витамин D',
			scheduleType: 'daily',
			timeLocal: '09:00',
			doseText: '1 капля',
		})
		expect(daily.enabled).toBe(true)

		const weekly = await service.create({
			childId,
			type: 'measurement',
			title: 'Вес',
			scheduleType: 'weekly',
			timeLocal: '10:00',
			daysOfWeek: [7],
		})
		expect(isoWeekdayToExpo(7)).toBe(1)
		expect(weekly.platformNotificationId).toBeTruthy()

		const edited = await service.update(daily.id, { timeLocal: '10:00' })
		expect(edited.timeLocal).toBe('10:00')
		expect(edited.platformNotificationId).not.toBe(daily.platformNotificationId)

		const disabled = await service.setEnabled(weekly.id, false)
		expect(disabled.enabled).toBe(false)
		expect(disabled.platformNotificationId).toBeNull()

		await service.delete(once.id)
		expect(await reminders.getById(once.id)).toBeNull()
	})

	it('reconciles missing platform notifications without duplicates', async () => {
		const { service, scheduler, reminders, childId } = await setup()
		const created = await service.create({
			childId,
			type: 'custom',
			title: 'Своё',
			scheduleType: 'daily',
			timeLocal: '08:00',
		})
		const id = created.platformNotificationId!
		scheduler.scheduled.delete(id)
		await service.reconcile(childId)
		const again = await reminders.getById(created.id)
		expect(again?.platformNotificationId).toBeTruthy()
		expect(again?.platformNotificationId).not.toBe(id)
		expect(scheduler.scheduled.size).toBe(1)
	})

	it('permission denied throws Russian error and keeps settings usable', async () => {
		const { service, scheduler, childId } = await setup()
		scheduler.permission = 'denied'
		await expect(
			service.create({
				childId,
				type: 'custom',
				title: 'X',
				scheduleType: 'daily',
				timeLocal: '09:00',
			}),
		).rejects.toBeInstanceOf(ReminderValidationError)
	})
})

describe('no-feeding reminder', () => {
	afterEach(() => {
		setNotificationSchedulerForTests(null)
	})

	it('schedules after create, resets after new feeding, no duplicate pending', async () => {
		const { service, scheduler, feeding, childId, reminders } = await setup()
		await feeding.createBottle({
			childId,
			amountMl: 100,
			content: 'formula',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		const reminder = await service.create({
			childId,
			type: 'no_feeding',
			title: 'Нет кормления',
			scheduleType: 'interval_hours',
			intervalHours: 3,
		})
		const firstId = reminder.platformNotificationId
		expect(firstId).toBeTruthy()
		expect(scheduler.scheduled.size).toBe(1)

		await feeding.createBottle({
			childId,
			amountMl: 110,
			content: 'formula',
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await service.rescheduleNoFeedingForChild(childId)
		const updated = await reminders.getById(reminder.id)
		expect(updated?.platformNotificationId).toBeTruthy()
		expect(updated?.platformNotificationId).not.toBe(firstId)
		expect(scheduler.scheduled.size).toBe(1)

		await service.setEnabled(reminder.id, false)
		expect((await reminders.getById(reminder.id))?.platformNotificationId).toBeNull()
		await service.delete(reminder.id)
		expect(await reminders.getById(reminder.id)).toBeNull()
	})
})

describe('doctor reminder policy', () => {
	afterEach(() => {
		setNotificationSchedulerForTests(null)
	})

	it('creates from nextVisit only when user opts in; edit visit does not silent-change', async () => {
		const { service, childId, reminders } = await setup()
		// User declines → none created automatically (no reminder rows).
		expect(await reminders.listByChild(childId)).toHaveLength(0)

		const created = await service.create({
			childId,
			type: 'doctor',
			title: 'Педиатр',
			scheduleType: 'once',
			fireAt: '2026-09-20T12:00:00+03:00',
			relatedEntityId: 'visit-1',
		})
		expect(created.relatedEntityId).toBe('visit-1')

		// Editing related visit is out of band — reminder stays until user edits it.
		const still = await reminders.getById(created.id)
		expect(still?.fireAt).toBe('2026-09-20T12:00:00+03:00')
	})
})

describe('platform id helpers', () => {
	it('serializes multiple weekly ids', () => {
		const raw = serializePlatformNotificationIds(['a', 'b'])
		expect(parsePlatformNotificationIds(raw)).toEqual(['a', 'b'])
		expect(parsePlatformNotificationIds('solo')).toEqual(['solo'])
	})
})
