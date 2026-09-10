/**
 * Phase 12 — backup / restore manifest, ZIP, media paths, roundtrip.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import {
	BACKUP_FORMAT_VERSION,
	parseManifestJson,
	validateBackupManifest,
} from '../src/domain/backupManifest'
import {
	isSafeRelativeMediaPath,
	toAbsoluteManagedPath,
	toRelativeManagedPath,
} from '../src/domain/backupMediaPaths'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { GrowthRepository } from '../src/repositories/growthRepository'
import { MilestoneRepository } from '../src/repositories/milestoneRepository'
import { MomentRepository } from '../src/repositories/momentRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { ReminderRepository } from '../src/repositories/reminderRepository'
import { SettingsRepository } from '../src/repositories/settingsRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import { SymptomRepository } from '../src/repositories/symptomRepository'
import { DoctorVisitRepository } from '../src/repositories/doctorVisitRepository'
import {
	createBackupZip,
	resetBackupInFlightForTests,
} from '../src/services/backupCreate'
import {
	restoreBackupZip,
	RestoreError,
	validateBackupZipBytes,
} from '../src/services/backupRestore'
import {
	absolutizeDumpUris,
	collectReferencedRelativeMedia,
	exportBackupTableDump,
	relativizeDumpUris,
} from '../src/services/backupTableIo'
import { createZipFromFiles, zipTextEntry } from '../src/services/backupZip'
import { createMemoryPhotoStorage } from '../src/services/photoStorage'
import {
	MemoryNotificationScheduler,
	setNotificationSchedulerForTests,
} from '../src/services/notificationScheduler'
import { ReminderService } from '../src/services/reminderService'

const DOC = 'memory://'

async function setupFixture () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const sleep = new SleepRepository(db)
	const feeding = new FeedingRepository(db)
	const diaper = new DiaperRepository(db)
	const growth = new GrowthRepository(db)
	const milestones = new MilestoneRepository(db)
	const photos = createMemoryPhotoStorage()
	const health = createMemoryPhotoStorage('health-documents/')
	const moments = new MomentRepository(db, photos)
	const quickEvents = new QuickEventRepository(db)
	const symptoms = new SymptomRepository(db, health)
	const doctorVisits = new DoctorVisitRepository(db)
	const reminders = new ReminderRepository(db)
	const settings = new SettingsRepository(db)
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
	await settings.setThemePreference('dark')
	await settings.setOnboardingCompleted(true)

	await sleep.createManual({
		childId: misha.id,
		startAt: '2026-09-09T01:00:00+03:00',
		endAt: '2026-09-09T07:00:00+03:00',
		sleepType: 'night',
	})
	const activeSleep = await sleep.start({
		childId: misha.id,
		sleepType: 'day',
		startedAt: '2026-09-09T10:00:00+03:00',
	})
	const activeBf = await feeding.startBreastfeeding({
		childId: misha.id,
		side: 'left',
		startedAt: '2026-09-09T11:00:00+03:00',
	})
	await feeding.createBottle({
		childId: anya.id,
		content: 'formula',
		amountMl: 110,
		occurredAt: '2026-09-09T11:30:00+03:00',
	})
	await diaper.create({
		childId: misha.id,
		kind: 'wet',
		occurredAt: '2026-09-09T12:00:00+03:00',
	})
	const def = await quickEvents.createCustomDefinition({
		childId: misha.id,
		name: 'Бассейн',
	})
	await quickEvents.createCustomEvent({
		childId: misha.id,
		definitionId: def.id,
		occurredAt: '2026-09-09T13:00:00+03:00',
	})
	await growth.create({
		childId: misha.id,
		weightKgRaw: '7,2',
		measuredAt: '2026-09-09T14:00:00+03:00',
	})
	await milestones.create({
		childId: misha.id,
		milestoneType: 'other',
		title: 'Переворот',
		occurredAt: '2026-09-09T15:00:00+03:00',
	})
	const photo = await photos.importFromUri('file://smile.jpg')
	const shared = await photos.importFromUri('file://shared.jpg')
	await moments.create({
		childId: misha.id,
		photoUri: photo,
		title: 'Улыбка',
		takenAt: '2026-09-09T16:00:00+03:00',
	})
	await moments.create({
		childId: anya.id,
		photoUri: shared,
		takenAt: '2026-09-09T16:05:00+03:00',
	})
	await moments.create({
		childId: misha.id,
		photoUri: shared,
		takenAt: '2026-09-09T16:10:00+03:00',
	})
	await symptoms.create({
		childId: misha.id,
		symptomType: 'rash',
		startedAt: '2026-09-09T17:00:00+03:00',
	})
	await quickEvents.createMedicine({
		childId: misha.id,
		name: 'Нурофен',
		kind: 'medicine',
		occurredAt: '2026-09-09T17:30:00+03:00',
	})
	await doctorVisits.create({
		childId: misha.id,
		specialistKey: 'pediatrician',
		visitedAt: '2026-09-08T10:00:00+03:00',
	})
	const reminder = await reminderService.create({
		childId: misha.id,
		type: 'vitamin',
		title: 'Витамин D',
		scheduleType: 'daily',
		timeLocal: '09:00',
		enabled: true,
	})
	const disabled = await reminderService.create({
		childId: anya.id,
		type: 'medicine',
		title: 'Сироп',
		scheduleType: 'daily',
		timeLocal: '12:00',
		enabled: false,
	})

	const mediaBytes = new Map<string, Uint8Array>()
	mediaBytes.set(photo, new TextEncoder().encode('photo-bytes'))
	mediaBytes.set(shared, new TextEncoder().encode('shared-bytes'))

	return {
		db,
		children,
		sleep,
		feeding,
		diaper,
		growth,
		milestones,
		moments,
		quickEvents,
		symptoms,
		doctorVisits,
		reminders,
		settings,
		reminderService,
		scheduler,
		photos,
		misha,
		anya,
		activeSleep,
		activeBf,
		reminder,
		disabled,
		photo,
		shared,
		mediaBytes,
	}
}

beforeEach(() => {
	resetBackupInFlightForTests()
})

describe('backup manifest', () => {
	it('accepts a valid manifest', () => {
		const result = validateBackupManifest({
			backupFormatVersion: BACKUP_FORMAT_VERSION,
			appVersion: '1.0.0',
			createdAt: '2026-09-10T10:00:00.000Z',
			includesMedia: false,
			kind: 'compact',
			childrenCount: 2,
			databaseSchemaVersion: 9,
			platform: 'android',
			databaseEncoding: 'json-tables',
		})
		expect(result.ok).toBe(true)
	})

	it('rejects missing manifest JSON', () => {
		const result = parseManifestJson('{')
		expect(result.ok).toBe(false)
	})

	it('rejects unsupported future format', () => {
		const result = validateBackupManifest({
			backupFormatVersion: 99,
			appVersion: '9.0.0',
			createdAt: '2026-09-10T10:00:00.000Z',
			includesMedia: true,
			childrenCount: 1,
			databaseSchemaVersion: 20,
			platform: 'android',
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('unsupported_future_format')
		}
	})
})

describe('backup media paths', () => {
	it('roundtrips relative managed paths', () => {
		const absolute = 'memory://moments/file-1.jpg'
		const relative = toRelativeManagedPath(absolute, DOC)
		expect(relative).toBe('moments/file-1.jpg')
		expect(toAbsoluteManagedPath(relative!, DOC)).toBe(
			'memory://moments/file-1.jpg',
		)
		expect(
			toAbsoluteManagedPath(relative!, 'memory://device-b/'),
		).toBe('memory://device-b/moments/file-1.jpg')
	})

	it('rejects path traversal', () => {
		expect(isSafeRelativeMediaPath('../etc/passwd')).toBe(false)
		expect(isSafeRelativeMediaPath('moments/../../x')).toBe(false)
		expect(isSafeRelativeMediaPath('moments/ok.jpg')).toBe(true)
	})
})

describe('backup create + restore', () => {
	it('creates compact backup without media entries', async () => {
		const ctx = await setupFixture()
		const result = await createBackupZip({
			db: ctx.db,
			kind: 'compact',
			documentDirectory: DOC,
			mediaBytesByAbsoluteUri: ctx.mediaBytes,
			nowIso: '2026-09-10T12:00:00.000Z',
		})
		expect(result.manifest.includesMedia).toBe(false)
		expect(result.fileName).toContain('baby-diary-backup-2026-09-10')
		const validated = validateBackupZipBytes(result.zipBytes)
		expect([...validated.media.keys()]).toHaveLength(0)
		expect(validated.dump.tables.children).toHaveLength(2)
	})

	it('creates full backup with referenced media only', async () => {
		const ctx = await setupFixture()
		const orphan = await ctx.photos.importFromUri('file://orphan.jpg')
		ctx.mediaBytes.set(orphan, new TextEncoder().encode('orphan'))
		const result = await createBackupZip({
			db: ctx.db,
			kind: 'full',
			documentDirectory: DOC,
			mediaBytesByAbsoluteUri: ctx.mediaBytes,
		})
		expect(result.manifest.includesMedia).toBe(true)
		const validated = validateBackupZipBytes(result.zipBytes)
		const keys = [...validated.media.keys()]
		expect(keys.some((k) => k.includes('file-'))).toBe(true)
		expect(keys.join(',')).not.toContain('orphan')
	})

	it('preserves active sleep and breastfeeding across restore', async () => {
		const ctx = await setupFixture()
		const zip = await createBackupZip({
			db: ctx.db,
			kind: 'compact',
			documentDirectory: DOC,
		})
		const fresh = new MemorySqlExecutor()
		fresh.markMigrated(LATEST_SCHEMA_VERSION)
		await restoreBackupZip(zip.zipBytes, {
			db: fresh,
			documentDirectory: DOC,
			inPlace: true,
		})
		const sleep = new SleepRepository(fresh)
		const feeding = new FeedingRepository(fresh)
		const children = new ChildRepository(fresh)
		const list = await children.listAll()
		const misha = list.find((c) => c.name === 'Миша')!
		expect((await sleep.findActive(misha.id))?.startAt).toBe(
			ctx.activeSleep.startAt,
		)
		expect((await feeding.findActiveBreastfeeding(misha.id))?.startAt).toBe(
			ctx.activeBf.startAt,
		)
	})

	it('restores multi-child data and remaps media paths', async () => {
		const ctx = await setupFixture()
		const zip = await createBackupZip({
			db: ctx.db,
			kind: 'full',
			documentDirectory: DOC,
			mediaBytesByAbsoluteUri: ctx.mediaBytes,
		})
		const newDoc = 'memory://device-b/'
		const written = new Map<string, Uint8Array>()
		const fresh = new MemorySqlExecutor()
		fresh.markMigrated(LATEST_SCHEMA_VERSION)
		await restoreBackupZip(zip.zipBytes, {
			db: fresh,
			documentDirectory: newDoc,
			inPlace: true,
			writeMediaFile: async (_rel, abs, bytes) => {
				written.set(abs, bytes)
			},
		})
		const moments = new MomentRepository(
			fresh,
			createMemoryPhotoStorage(),
		)
		const children = new ChildRepository(fresh)
		const misha = (await children.listAll()).find((c) => c.name === 'Миша')!
		const rows = await moments.listByChild(misha.id)
		expect(rows.length).toBeGreaterThan(0)
		expect(rows[0]?.photoUri?.startsWith('memory://device-b/')).toBe(true)
		expect(written.size).toBeGreaterThan(0)
	})

	it('rejects corrupted zip and path traversal', () => {
		expect(() => validateBackupZipBytes(new Uint8Array([1, 2, 3]))).toThrow(
			RestoreError,
		)
		const evil = createZipFromFiles({
			'baby-diary-backup/../evil.txt': zipTextEntry('x'),
			'baby-diary-backup/manifest.json': zipTextEntry(
				JSON.stringify({
					backupFormatVersion: 1,
					appVersion: '1.0.0',
					createdAt: '2026-09-10T00:00:00.000Z',
					includesMedia: false,
					childrenCount: 0,
					databaseSchemaVersion: 9,
					platform: 'test',
					databaseEncoding: 'json-tables',
				}),
			),
		})
		expect(() => validateBackupZipBytes(evil)).toThrow(/небезопасный/i)
	})

	it('rejects missing database and future schema', () => {
		const missingDb = createZipFromFiles({
			'baby-diary-backup/manifest.json': zipTextEntry(
				JSON.stringify({
					backupFormatVersion: 1,
					appVersion: '1.0.0',
					createdAt: '2026-09-10T00:00:00.000Z',
					includesMedia: false,
					childrenCount: 0,
					databaseSchemaVersion: 9,
					platform: 'test',
					databaseEncoding: 'json-tables',
				}),
			),
		})
		expect(() => validateBackupZipBytes(missingDb)).toThrow(/database/i)

		const future = createZipFromFiles({
			'baby-diary-backup/manifest.json': zipTextEntry(
				JSON.stringify({
					backupFormatVersion: 1,
					appVersion: '9.0.0',
					createdAt: '2026-09-10T00:00:00.000Z',
					includesMedia: false,
					childrenCount: 0,
					databaseSchemaVersion: LATEST_SCHEMA_VERSION + 5,
					platform: 'test',
					databaseEncoding: 'json-tables',
				}),
			),
			'baby-diary-backup/database.json': zipTextEntry(
				JSON.stringify({ schemaVersion: LATEST_SCHEMA_VERSION + 5, tables: {} }),
			),
		})
		expect(() => validateBackupZipBytes(future)).toThrow(/Обновите приложение/i)
	})

	it('rolls back when restore apply fails after import hook error', async () => {
		const ctx = await setupFixture()
		const zip = await createBackupZip({
			db: ctx.db,
			kind: 'full',
			documentDirectory: DOC,
			mediaBytesByAbsoluteUri: ctx.mediaBytes,
		})
		// Mutate live DB so restore content differs, then fail during media write.
		await ctx.children.create({
			name: 'Лишний',
			birthDate: '2026-02-02',
		})
		await expect(
			restoreBackupZip(zip.zipBytes, {
				db: ctx.db,
				documentDirectory: DOC,
				inPlace: true,
				writeMediaFile: async () => {
					throw new Error('disk full')
				},
			}),
		).rejects.toBeInstanceOf(RestoreError)

		const after = await exportBackupTableDump(ctx.db)
		expect(after.tables.children?.length).toBe(3)
		expect(
			(after.tables.children ?? []).some((c) => c.name === 'Лишний'),
		).toBe(true)
		expect(
			(after.tables.children ?? []).some((c) => c.name === 'Миша'),
		).toBe(true)
	})

	it('clears platform notification ids and reschedules enabled reminders', async () => {
		const ctx = await setupFixture()
		expect(ctx.reminder.platformNotificationId).toBeTruthy()
		const zip = await createBackupZip({
			db: ctx.db,
			kind: 'compact',
			documentDirectory: DOC,
		})
		const fresh = new MemorySqlExecutor()
		fresh.markMigrated(LATEST_SCHEMA_VERSION)
		const reminders = new ReminderRepository(fresh)
		const feeding = new FeedingRepository(fresh)
		const children = new ChildRepository(fresh)
		const scheduler = new MemoryNotificationScheduler()
		scheduler.permission = 'granted'
		setNotificationSchedulerForTests(scheduler)
		const service = new ReminderService({
			reminders,
			feeding,
			children,
			scheduler,
		})
		await restoreBackupZip(zip.zipBytes, {
			db: fresh,
			documentDirectory: DOC,
			inPlace: true,
			reconcileReminders: () => service.reconcile(),
		})
		const enabled = await reminders.listEnabledByChild(ctx.misha.id)
		const disabled = await reminders.listByChild(ctx.anya.id)
		expect(enabled[0]?.platformNotificationId).toBeTruthy()
		expect(disabled.find((r) => r.title === 'Сироп')?.enabled).toBe(false)
		expect(scheduler.scheduled.size).toBeGreaterThan(0)
	})
})

describe('backup full roundtrip fixture', () => {
	it('backup → fresh DB → restore keeps key records', async () => {
		const ctx = await setupFixture()
		const zip = await createBackupZip({
			db: ctx.db,
			kind: 'full',
			documentDirectory: DOC,
			mediaBytesByAbsoluteUri: ctx.mediaBytes,
			appVersion: '1.0.0',
		})

		const fresh = new MemorySqlExecutor()
		fresh.markMigrated(LATEST_SCHEMA_VERSION)
		await restoreBackupZip(zip.zipBytes, {
			db: fresh,
			documentDirectory: DOC,
			inPlace: true,
			writeMediaFile: async () => undefined,
		})

		const children = new ChildRepository(fresh)
		const sleep = new SleepRepository(fresh)
		const feeding = new FeedingRepository(fresh)
		const diaper = new DiaperRepository(fresh)
		const growth = new GrowthRepository(fresh)
		const milestones = new MilestoneRepository(fresh)
		const moments = new MomentRepository(fresh, createMemoryPhotoStorage())
		const settings = new SettingsRepository(fresh)
		const reminders = new ReminderRepository(fresh)

		const list = await children.listAll()
		expect(list).toHaveLength(2)
		const misha = list.find((c) => c.name === 'Миша')!
		const anya = list.find((c) => c.name === 'Аня')!
		expect((await settings.get()).activeChildId).toBe(misha.id)
		expect((await settings.get()).themePreference).toBe('dark')
		expect(await sleep.findActive(misha.id)).not.toBeNull()
		expect(await feeding.findActiveBreastfeeding(misha.id)).not.toBeNull()
		expect(
			(await feeding.listByChildAndLocalDate(anya.id, '2026-09-09')).length,
		).toBe(1)
		expect(
			(await diaper.listByChildAndLocalDate(misha.id, '2026-09-09')).length,
		).toBe(1)
		expect((await growth.listByChild(misha.id)).length).toBe(1)
		expect((await milestones.listByChild(misha.id)).length).toBe(1)
		expect((await moments.listByChild(misha.id)).length).toBe(2)
		expect((await reminders.listByChild(misha.id)).length).toBe(1)
	})
})

describe('backup uri relativize helpers', () => {
	it('collects referenced media and keeps missing compact photos as metadata', async () => {
		const ctx = await setupFixture()
		const dump = await exportBackupTableDump(ctx.db)
		const refs = collectReferencedRelativeMedia(dump, DOC)
		expect(refs.length).toBeGreaterThan(0)
		const relative = relativizeDumpUris(dump, DOC)
		const abs = absolutizeDumpUris(relative, 'memory://other/')
		const momentRows = abs.tables.moments ?? []
		expect(
			momentRows.every(
				(r) =>
					r.photo_uri == null ||
					String(r.photo_uri).startsWith('memory://other/'),
			),
		).toBe(true)
	})
})
