/**
 * Growth / milestones / moments / teeth repository tests (Phase 6).
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import {
	buildGrowthChartPoints,
	normalizeChartValues,
} from '../src/domain/growthCharts'
import { GrowthValidationError } from '../src/domain/growthLabels'
import {
	ageAtDateLabel,
	buildFirstYearFoundation,
	civilMonthKey,
} from '../src/domain/firstYearFoundation'
import { ChildRepository } from '../src/repositories/childRepository'
import { GrowthRepository } from '../src/repositories/growthRepository'
import { MilestoneRepository } from '../src/repositories/milestoneRepository'
import { MomentRepository } from '../src/repositories/momentRepository'
import { ToothRepository } from '../src/repositories/toothRepository'
import { createMemoryPhotoStorage } from '../src/services/photoStorage'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-01-15',
	})
	const photos = createMemoryPhotoStorage()
	return {
		db,
		childId: child.id,
		birthDate: child.birthDate,
		growth: new GrowthRepository(db),
		milestones: new MilestoneRepository(db),
		teeth: new ToothRepository(db),
		moments: new MomentRepository(db, photos),
		photos,
	}
}

describe('GrowthRepository', () => {
	it('creates measurement with decimal comma', async () => {
		const { growth, childId } = await setup()
		const created = await growth.create({
			childId,
			weightKgRaw: '6,4',
			heightCmRaw: '63,5',
			headCmRaw: '41,5',
			measuredAt: '2026-09-09T12:00:00+03:00',
		})
		expect(created.weightGrams).toBe(6400)
		expect(created.heightMm).toBe(635)
		expect(created.headCircumferenceMm).toBe(415)
	})

	it('edits and deletes measurement', async () => {
		const { growth, childId } = await setup()
		const created = await growth.create({
			childId,
			weightKgRaw: '6',
			measuredAt: '2026-09-01T12:00:00+03:00',
		})
		const updated = await growth.update(created.id, {
			weightKgRaw: '6,2',
			heightCmRaw: '62',
		})
		expect(updated.weightGrams).toBe(6200)
		expect(updated.heightMm).toBe(620)
		await growth.delete(created.id)
		expect(await growth.getById(created.id)).toBeNull()
	})

	it('returns latest metrics and history sort', async () => {
		const { growth, childId } = await setup()
		await growth.create({
			childId,
			weightKgRaw: '5,9',
			heightCmRaw: '60,5',
			measuredAt: '2026-08-15T10:00:00+03:00',
		})
		await growth.create({
			childId,
			weightKgRaw: '6,4',
			heightCmRaw: '63',
			measuredAt: '2026-09-09T10:00:00+03:00',
		})
		const history = await growth.listByChild(childId)
		expect(history[0]?.weightGrams).toBe(6400)
		expect(history[1]?.weightGrams).toBe(5900)
		const latest = await growth.findLatestMetrics(childId)
		expect(latest.weight?.weightGrams).toBe(6400)
		expect(latest.height?.heightMm).toBe(630)
	})

	it('rejects absurd values softly', async () => {
		const { growth, childId } = await setup()
		await expect(
			growth.create({ childId, weightKgRaw: '500' }),
		).rejects.toBeInstanceOf(GrowthValidationError)
	})

	it('maps graph data for 0/1/many and flat series', () => {
		expect(buildGrowthChartPoints([], 'weight')).toEqual([])
		const one = buildGrowthChartPoints(
			[
				{
					id: '1',
					childId: 'c',
					measuredAt: '2026-09-01T10:00:00+03:00',
					measuredLocalDate: '2026-09-01',
					weightGrams: 6000,
					heightMm: null,
					headCircumferenceMm: null,
					notes: null,
					createdAt: 'x',
					updatedAt: 'x',
				},
			],
			'weight',
		)
		expect(one).toHaveLength(1)
		expect(normalizeChartValues([6, 6, 6])).toEqual([0.5, 0.5, 0.5])
		expect(normalizeChartValues([5, 6, 7])[0]).toBe(0)
		expect(normalizeChartValues([5, 6, 7])[2]).toBe(1)
	})
})

describe('MilestoneRepository', () => {
	it('creates standard and custom milestones with age-at-date', async () => {
		const { milestones, childId, birthDate } = await setup()
		const smile = await milestones.create({
			childId,
			milestoneType: 'first_smile',
			occurredAt: '2026-03-20T12:00:00+03:00',
		})
		expect(smile.title).toBe('Первая улыбка')
		expect(ageAtDateLabel(birthDate, smile.startLocalDate)).toMatch(/месяц/)

		const custom = await milestones.create({
			childId,
			milestoneType: 'other',
			title: 'Первый пляж',
			occurredAt: '2026-07-01T12:00:00+03:00',
		})
		expect(custom.title).toBe('Первый пляж')
	})

	it('edits, deletes, and associates photo', async () => {
		const { milestones, moments, photos, childId } = await setup()
		const uri = await photos.importFromUri('file://src.jpg')
		const created = await milestones.create({
			childId,
			milestoneType: 'first_step',
			photoUri: uri,
		})
		expect(created.photoUri).toBe(uri)
		const moment = await moments.create({
			childId,
			photoUri: uri,
			title: 'Шаг',
			milestoneEventId: created.id,
		})
		await milestones.update(created.id, { linkedMomentId: moment.id })
		const updated = await milestones.update(created.id, {
			title: 'Первый шаг!',
		})
		expect(updated.title).toBe('Первый шаг!')
		await milestones.delete(created.id)
		expect(await milestones.getById(created.id)).toBeNull()
	})
})

describe('ToothRepository', () => {
	it('adds, edits date, deletes, and upserts duplicate key', async () => {
		const { teeth, childId } = await setup()
		const first = await teeth.upsert({
			childId,
			toothKey: 'lower_central_left',
			eruptedAt: '2026-06-01',
		})
		const again = await teeth.upsert({
			childId,
			toothKey: 'lower_central_left',
			eruptedAt: '2026-06-10',
			notes: 'уточнили',
		})
		expect(again.id).toBe(first.id)
		expect(again.eruptedAt).toBe('2026-06-10')
		const edited = await teeth.update(first.id, { eruptedAt: '2026-06-12' })
		expect(edited.eruptedAt).toBe('2026-06-12')
		await teeth.delete(first.id)
		expect(await teeth.getById(first.id)).toBeNull()
	})
})

describe('MomentRepository', () => {
	it('creates metadata, persists URI, edits, month photo, deletes file', async () => {
		const { moments, photos, childId, milestones } = await setup()
		const uri = await photos.importFromUri('file://gallery.jpg')
		const created = await moments.create({
			childId,
			photoUri: uri,
			title: 'Улыбка',
			takenAt: '2026-09-01T12:00:00+03:00',
		})
		expect(created.photoUri).toBe(uri)
		expect(photos.files.has(uri)).toBe(true)

		const edited = await moments.update(created.id, {
			title: 'Широкая улыбка',
		})
		expect(edited.title).toBe('Широкая улыбка')

		const selection = await moments.setMonthPhoto(childId, created.id)
		expect(selection.monthKey).toBe(civilMonthKey('2026-09-01'))
		expect(selection.momentId).toBe(created.id)

		const ms = await milestones.create({
			childId,
			milestoneType: 'first_smile',
			photoUri: uri,
		})
		await moments.update(created.id, { milestoneEventId: ms.id })
		expect((await moments.getById(created.id))?.milestoneEventId).toBe(
			ms.id,
		)

		const newUri = await photos.importFromUri('file://new.jpg')
		await moments.update(created.id, { photoUri: newUri })
		// Old URI still referenced by milestone — keep file.
		expect(photos.files.has(uri)).toBe(true)

		await milestones.update(ms.id, { photoUri: newUri })
		await moments.delete(created.id)
		// newUri may still be on milestone; delete moment should not remove shared file.
		expect(photos.files.has(newUri)).toBe(true)

		await milestones.update(ms.id, { photoUri: null })
		await moments.create({
			childId,
			photoUri: newUri,
			title: 'tmp',
		}).then((m) => moments.delete(m.id))
		expect(photos.files.has(newUri)).toBe(false)
	})
})

describe('firstYearFoundation', () => {
	it('assembles 12 months with measurements and milestones', async () => {
		const { growth, milestones, moments, photos, childId, birthDate } =
			await setup()
		await growth.create({
			childId,
			weightKgRaw: '4',
			measuredAt: '2026-02-01T12:00:00+03:00',
		})
		await milestones.create({
			childId,
			milestoneType: 'first_smile',
			occurredAt: '2026-03-01T12:00:00+03:00',
		})
		const uri = await photos.importFromUri('file://m.jpg')
		const moment = await moments.create({
			childId,
			photoUri: uri,
			takenAt: '2026-02-20T12:00:00+03:00',
		})
		const monthPhotos = [
			await moments.setMonthPhoto(childId, moment.id, 'fy:2026-01-15:m1'),
		]
		const bundles = buildFirstYearFoundation({
			birthDate,
			measurements: await growth.listByChild(childId),
			milestones: await milestones.listByChild(childId),
			teeth: [],
			moments: await moments.listByChild(childId),
			monthPhotos,
		})
		expect(bundles).toHaveLength(12)
		expect(bundles[0]?.monthPhoto?.id).toBe(moment.id)
		expect(bundles[0]?.measurements.length).toBeGreaterThan(0)
	})
})
