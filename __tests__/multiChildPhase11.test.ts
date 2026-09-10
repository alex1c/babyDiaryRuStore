/**
 * Phase 11 — multi-child switch, isolation, active timers, delete, notifications.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { resolveActiveChildId } from '../src/domain/onboarding'
import {
	buildReminderNotificationBody,
	buildReminderNotificationTitle,
} from '../src/domain/reminderLabels'
import { buildPeriodReportData } from '../src/domain/buildPeriodReport'
import { resolveStatsPeriod } from '../src/domain/statsPeriod'
import { matchesDiarySearch } from '../src/presentation/diaryTimeline'
import { loadDiaryDay } from '../src/presentation/diaryLoad'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { DoctorVisitRepository } from '../src/repositories/doctorVisitRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { GrowthRepository } from '../src/repositories/growthRepository'
import { MilestoneRepository } from '../src/repositories/milestoneRepository'
import { MomentRepository } from '../src/repositories/momentRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { ReminderRepository } from '../src/repositories/reminderRepository'
import { SettingsRepository } from '../src/repositories/settingsRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import { SymptomRepository } from '../src/repositories/symptomRepository'
import { deleteChildWithCleanup } from '../src/services/childLifecycle'
import {
	MemoryNotificationScheduler,
	setNotificationSchedulerForTests,
} from '../src/services/notificationScheduler'
import {
	createMemoryPhotoStorage,
	PROFILE_PHOTOS_SUBDIR,
} from '../src/services/photoStorage'
import { ReminderService } from '../src/services/reminderService'
import type { Reminder } from '../src/models/reminder'

async function setupTwoChildren () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const settings = new SettingsRepository(db)
	const sleep = new SleepRepository(db)
	const feeding = new FeedingRepository(db)
	const diaper = new DiaperRepository(db)
	const quickEvents = new QuickEventRepository(db)
	const growth = new GrowthRepository(db)
	const milestones = new MilestoneRepository(db)
	const momentPhotos = createMemoryPhotoStorage()
	const healthPhotos = createMemoryPhotoStorage('health-documents/')
	const profilePhotos = createMemoryPhotoStorage(PROFILE_PHOTOS_SUBDIR)
	const moments = new MomentRepository(db, momentPhotos)
	const symptoms = new SymptomRepository(db, healthPhotos)
	const doctorVisits = new DoctorVisitRepository(db)
	const reminders = new ReminderRepository(db)
	const scheduler = new MemoryNotificationScheduler()
	scheduler.permission = 'granted'
	setNotificationSchedulerForTests(scheduler)
	const reminderService = new ReminderService({
		reminders,
		feeding,
		children,
		scheduler,
	})

	const misha = await children.create({
		name: 'Миша',
		birthDate: '2026-01-01',
	})
	const anya = await children.create({
		name: 'Аня',
		birthDate: '2026-01-01',
	})
	await settings.setActiveChildId(misha.id)

	return {
		db,
		children,
		settings,
		sleep,
		feeding,
		diaper,
		quickEvents,
		growth,
		milestones,
		moments,
		momentPhotos,
		healthPhotos,
		profilePhotos,
		symptoms,
		doctorVisits,
		reminders,
		reminderService,
		scheduler,
		misha,
		anya,
	}
}

function stubReminder (partial: Partial<Reminder> & Pick<Reminder, 'type' | 'title'>): Reminder {
	return {
		id: 'r',
		childId: 'c',
		enabled: true,
		scheduleType: 'daily',
		timeLocal: '10:00',
		daysOfWeek: null,
		intervalHours: null,
		fireAt: null,
		doseText: null,
		notes: null,
		relatedEntityId: null,
		platformNotificationId: null,
		createdAt: 'x',
		updatedAt: 'x',
		...partial,
	}
}

describe('multi-child switcher + persistence', () => {
	it('creates a second child and persists activeChildId after restart', async () => {
		const ctx = await setupTwoChildren()
		expect(await ctx.children.listAll()).toHaveLength(2)

		await ctx.settings.setActiveChildId(ctx.anya.id)
		const reloaded = await ctx.settings.get()
		const list = await ctx.children.listAll()
		expect(resolveActiveChildId(list, reloaded.activeChildId)).toBe(
			ctx.anya.id,
		)
	})
})

describe('multi-child data isolation', () => {
	it('keeps sleep/feeding/diaper/growth/milestone/moment/health/reminders/report/search per child', async () => {
		const ctx = await setupTwoChildren()
		const day = '2026-09-09'

		await ctx.sleep.start({
			childId: ctx.misha.id,
			sleepType: 'day',
			startedAt: `${day}T08:00:00+03:00`,
		})
		await ctx.sleep.start({
			childId: ctx.anya.id,
			sleepType: 'day',
			startedAt: `${day}T09:00:00+03:00`,
		})

		await ctx.feeding.createBottle({
			childId: ctx.misha.id,
			amountMl: 120,
			content: 'formula',
			occurredAt: `${day}T10:00:00+03:00`,
		})
		await ctx.feeding.createBottle({
			childId: ctx.anya.id,
			amountMl: 90,
			content: 'expressed_milk',
			occurredAt: `${day}T10:30:00+03:00`,
		})

		await ctx.diaper.create({
			childId: ctx.misha.id,
			kind: 'wet',
			occurredAt: `${day}T11:00:00+03:00`,
		})
		await ctx.diaper.create({
			childId: ctx.anya.id,
			kind: 'dirty',
			occurredAt: `${day}T11:15:00+03:00`,
		})

		await ctx.growth.create({
			childId: ctx.misha.id,
			weightKgRaw: '7',
			measuredAt: `${day}T12:00:00+03:00`,
		})
		await ctx.growth.create({
			childId: ctx.anya.id,
			weightKgRaw: '6,5',
			measuredAt: `${day}T12:05:00+03:00`,
		})

		await ctx.milestones.create({
			childId: ctx.misha.id,
			milestoneType: 'other',
			title: 'Переворот Миши',
			occurredAt: `${day}T13:00:00+03:00`,
		})
		await ctx.milestones.create({
			childId: ctx.anya.id,
			milestoneType: 'other',
			title: 'Улыбка Ани',
			occurredAt: `${day}T13:05:00+03:00`,
		})

		const mishaPhoto = await ctx.momentPhotos.importFromUri('file://misha.jpg')
		const anyaPhoto = await ctx.momentPhotos.importFromUri('file://anya.jpg')
		await ctx.moments.create({
			childId: ctx.misha.id,
			photoUri: mishaPhoto,
			title: 'Миша момент',
			takenAt: `${day}T14:00:00+03:00`,
		})
		await ctx.moments.create({
			childId: ctx.anya.id,
			photoUri: anyaPhoto,
			title: 'Аня момент',
			takenAt: `${day}T14:05:00+03:00`,
		})

		await ctx.symptoms.create({
			childId: ctx.misha.id,
			symptomType: 'other',
			customLabel: 'Кашель Миши',
			startedAt: `${day}T15:00:00+03:00`,
		})
		await ctx.symptoms.create({
			childId: ctx.anya.id,
			symptomType: 'rash',
			startedAt: `${day}T15:05:00+03:00`,
		})

		await ctx.reminders.create({
			childId: ctx.misha.id,
			type: 'vitamin',
			title: 'Витамин D',
			scheduleType: 'daily',
			timeLocal: '10:00',
			enabled: true,
		})
		await ctx.reminders.create({
			childId: ctx.anya.id,
			type: 'medicine',
			title: 'Сироп',
			scheduleType: 'daily',
			timeLocal: '11:00',
			enabled: true,
		})

		await ctx.quickEvents.createCustomDefinition({
			childId: ctx.misha.id,
			name: 'Бассейн Миши',
		})
		await ctx.quickEvents.createCustomDefinition({
			childId: ctx.anya.id,
			name: 'Бассейн Ани',
		})

		expect(
			(await ctx.sleep.listOverlappingLocalDay(ctx.misha.id, day)).length,
		).toBe(1)
		expect(
			(await ctx.sleep.listOverlappingLocalDay(ctx.anya.id, day)).length,
		).toBe(1)
		expect(
			(await ctx.feeding.listByChildAndLocalDate(ctx.misha.id, day)).length,
		).toBe(1)
		expect(
			(await ctx.feeding.listByChildAndLocalDate(ctx.anya.id, day)).length,
		).toBe(1)
		expect(
			(await ctx.diaper.listByChildAndLocalDate(ctx.misha.id, day)).length,
		).toBe(1)
		expect((await ctx.growth.listByChild(ctx.misha.id)).length).toBe(1)
		expect((await ctx.growth.listByChild(ctx.anya.id)).length).toBe(1)
		expect((await ctx.milestones.listByChild(ctx.misha.id)).length).toBe(1)
		expect((await ctx.moments.listByChild(ctx.misha.id)).length).toBe(1)
		expect((await ctx.symptoms.listByChild(ctx.misha.id)).length).toBe(1)
		expect((await ctx.reminders.listByChild(ctx.misha.id)).length).toBe(1)
		expect((await ctx.reminders.listByChild(ctx.anya.id)).length).toBe(1)

		const mishaDefs = await ctx.quickEvents.listAllCustomDefinitions(
			ctx.misha.id,
		)
		expect(mishaDefs.some((d) => d.name === 'Бассейн Миши')).toBe(true)
		expect(mishaDefs.some((d) => d.name === 'Бассейн Ани')).toBe(false)

		const diaryMisha = await loadDiaryDay(
			{
				sleep: ctx.sleep,
				feeding: ctx.feeding,
				diaper: ctx.diaper,
				quickEvents: ctx.quickEvents,
				milestones: ctx.milestones,
				symptoms: ctx.symptoms,
				doctorVisits: ctx.doctorVisits,
			},
			ctx.misha.id,
			day,
		)
		expect(
			diaryMisha.rows.filter((r) => matchesDiarySearch(r, 'Переворот')),
		).toHaveLength(1)
		expect(
			diaryMisha.rows.filter((r) => matchesDiarySearch(r, 'Улыбка')),
		).toHaveLength(0)

		const period = resolveStatsPeriod('today', day)
		const report = buildPeriodReportData({
			child: ctx.misha,
			period,
			sleeps: await ctx.sleep.listOverlappingLocalDay(ctx.misha.id, day),
			feedings: await ctx.feeding.listByChildAndLocalDate(ctx.misha.id, day),
			diapers: await ctx.diaper.listByChildAndLocalDate(ctx.misha.id, day),
			measurements: await ctx.growth.listByChild(ctx.misha.id),
			temperatures: [],
			symptoms: await ctx.symptoms.listByChild(ctx.misha.id),
			medicines: [],
			doctorVisits: [],
		})
		expect(report.child.name).toBe('Миша')
		expect(report.feeding.formulaMl).toBe(120)
		expect(report.feeding.hasAnyData).toBe(true)
	})
})

describe('multi-child active timers', () => {
	it('keeps independent active sleep across switch', async () => {
		const ctx = await setupTwoChildren()
		const mishaSleep = await ctx.sleep.start({
			childId: ctx.misha.id,
			sleepType: 'day',
			startedAt: '2026-09-09T08:00:00+03:00',
		})
		await ctx.settings.setActiveChildId(ctx.anya.id)

		expect(await ctx.sleep.findActive(ctx.anya.id)).toBeNull()
		expect((await ctx.sleep.findActive(ctx.misha.id))?.id).toBe(mishaSleep.id)

		await ctx.sleep.start({
			childId: ctx.anya.id,
			sleepType: 'day',
			startedAt: '2026-09-09T09:00:00+03:00',
		})
		expect((await ctx.sleep.findActive(ctx.anya.id))?.endAt).toBeNull()
		expect((await ctx.sleep.findActive(ctx.misha.id))?.id).toBe(mishaSleep.id)

		await ctx.settings.setActiveChildId(ctx.misha.id)
		const recovered = await ctx.sleep.findActive(ctx.misha.id)
		expect(recovered?.id).toBe(mishaSleep.id)
		expect(recovered?.startAt).toBe('2026-09-09T08:00:00+03:00')
	})

	it('keeps independent active breastfeeding across switch', async () => {
		const ctx = await setupTwoChildren()
		const mishaBf = await ctx.feeding.startBreastfeeding({
			childId: ctx.misha.id,
			side: 'left',
			startedAt: '2026-09-09T08:00:00+03:00',
		})
		await ctx.settings.setActiveChildId(ctx.anya.id)
		expect(await ctx.feeding.findActiveBreastfeeding(ctx.anya.id)).toBeNull()
		expect(
			(await ctx.feeding.findActiveBreastfeeding(ctx.misha.id))?.id,
		).toBe(mishaBf.id)

		await ctx.feeding.startBreastfeeding({
			childId: ctx.anya.id,
			side: 'right',
			startedAt: '2026-09-09T08:10:00+03:00',
		})
		expect(
			(await ctx.feeding.findActiveBreastfeeding(ctx.anya.id))?.initialSide,
		).toBe('right')
		expect(
			(await ctx.feeding.findActiveBreastfeeding(ctx.misha.id))?.id,
		).toBe(mishaBf.id)

		await ctx.settings.setActiveChildId(ctx.misha.id)
		expect(
			(await ctx.feeding.findActiveBreastfeeding(ctx.misha.id))?.id,
		).toBe(mishaBf.id)
	})
})

describe('multi-child deletion', () => {
	it('deletes one child, preserves the other, reassigns active', async () => {
		const ctx = await setupTwoChildren()
		await ctx.sleep.start({
			childId: ctx.misha.id,
			sleepType: 'day',
			startedAt: '2026-09-09T08:00:00+03:00',
		})
		await ctx.feeding.createBottle({
			childId: ctx.anya.id,
			amountMl: 100,
			content: 'formula',
			occurredAt: '2026-09-09T09:00:00+03:00',
		})
		const rem = await ctx.reminderService.create({
			childId: ctx.misha.id,
			type: 'vitamin',
			title: 'Витамин D',
			scheduleType: 'daily',
			timeLocal: '09:00',
			enabled: true,
		})
		expect(ctx.scheduler.scheduled.size).toBeGreaterThan(0)

		const result = await deleteChildWithCleanup(
			{
				db: ctx.db,
				children: ctx.children,
				reminders: ctx.reminders,
				reminderService: ctx.reminderService,
				settings: ctx.settings,
				momentPhotos: ctx.momentPhotos,
				healthPhotos: ctx.healthPhotos,
				profilePhotos: ctx.profilePhotos,
			},
			ctx.misha.id,
		)

		expect(result.remainingCount).toBe(1)
		expect(result.nextActiveChildId).toBe(ctx.anya.id)
		expect(await ctx.children.getById(ctx.misha.id)).toBeNull()
		expect(await ctx.children.getById(ctx.anya.id)).not.toBeNull()
		expect(await ctx.sleep.findActive(ctx.misha.id)).toBeNull()
		expect(
			(
				await ctx.feeding.listByChildAndLocalDate(ctx.anya.id, '2026-09-09')
			).length,
		).toBe(1)
		expect(await ctx.reminders.getById(rem.id)).toBeNull()
		expect((await ctx.settings.get()).activeChildId).toBe(ctx.anya.id)
	})

	it('deletes last child and clears activeChildId for onboarding', async () => {
		const ctx = await setupTwoChildren()
		await deleteChildWithCleanup(
			{
				db: ctx.db,
				children: ctx.children,
				reminders: ctx.reminders,
				reminderService: ctx.reminderService,
				settings: ctx.settings,
				momentPhotos: ctx.momentPhotos,
				healthPhotos: ctx.healthPhotos,
				profilePhotos: ctx.profilePhotos,
			},
			ctx.misha.id,
		)
		const last = await deleteChildWithCleanup(
			{
				db: ctx.db,
				children: ctx.children,
				reminders: ctx.reminders,
				reminderService: ctx.reminderService,
				settings: ctx.settings,
				momentPhotos: ctx.momentPhotos,
				healthPhotos: ctx.healthPhotos,
				profilePhotos: ctx.profilePhotos,
			},
			ctx.anya.id,
		)
		expect(last.remainingCount).toBe(0)
		expect(last.nextActiveChildId).toBeNull()
		expect((await ctx.settings.get()).activeChildId).toBeNull()
		expect(await ctx.children.listAll()).toHaveLength(0)
	})

	it('cleans managed files safely and preserves shared moment URI', async () => {
		const ctx = await setupTwoChildren()
		const shared = await ctx.momentPhotos.importFromUri('file://shared.jpg')
		const onlyMisha = await ctx.momentPhotos.importFromUri(
			'file://misha-only.jpg',
		)
		await ctx.moments.create({
			childId: ctx.misha.id,
			photoUri: shared,
			takenAt: '2026-09-09T12:00:00+03:00',
		})
		await ctx.moments.create({
			childId: ctx.anya.id,
			photoUri: shared,
			takenAt: '2026-09-09T12:05:00+03:00',
		})
		await ctx.moments.create({
			childId: ctx.misha.id,
			photoUri: onlyMisha,
			takenAt: '2026-09-09T12:10:00+03:00',
		})

		const profileUri = await ctx.profilePhotos.importFromUri(
			'file://profile.jpg',
		)
		await ctx.children.update(ctx.misha.id, { photoUri: profileUri })

		await deleteChildWithCleanup(
			{
				db: ctx.db,
				children: ctx.children,
				reminders: ctx.reminders,
				reminderService: ctx.reminderService,
				settings: ctx.settings,
				momentPhotos: ctx.momentPhotos,
				healthPhotos: ctx.healthPhotos,
				profilePhotos: ctx.profilePhotos,
			},
			ctx.misha.id,
		)

		expect(ctx.momentPhotos.files.has(shared)).toBe(true)
		expect(ctx.momentPhotos.files.has(onlyMisha)).toBe(false)
		expect(ctx.profilePhotos.files.has(profileUri)).toBe(false)
		expect((await ctx.moments.listByChild(ctx.anya.id)).length).toBe(1)
	})
})

describe('multi-child notifications', () => {
	it('includes child name in notification title and no-feeding body', () => {
		const title = buildReminderNotificationTitle(
			stubReminder({ type: 'vitamin', title: 'Витамин D' }),
			'Миша',
		)
		expect(title).toBe('Миша · Витамин D')

		const body = buildReminderNotificationBody(
			stubReminder({
				type: 'no_feeding',
				title: 'Нет кормления',
				scheduleType: 'interval_hours',
				timeLocal: null,
				intervalHours: 3,
				fireAt: '2026-09-09T13:00:00+03:00',
			}),
			'Аня',
		)
		expect(body).toContain('Аня')
		expect(body).toContain('3 ч')
	})

	it('schedules no-feeding reminder with correct childId in payload', async () => {
		const ctx = await setupTwoChildren()
		const reminder = await ctx.reminderService.create({
			childId: ctx.anya.id,
			type: 'no_feeding',
			title: 'Нет кормления',
			scheduleType: 'interval_hours',
			intervalHours: 3,
			enabled: true,
		})
		expect(reminder.childId).toBe(ctx.anya.id)
		const scheduled = [...ctx.scheduler.scheduled.values()].find(
			(s) => s.content.data?.reminderId === reminder.id,
		)
		expect(scheduled?.content.title).toContain('Аня')
		expect(scheduled?.content.data?.childId).toBe(ctx.anya.id)
	})
})
