/**
 * Phase 4 — diaper + quick events + custom definitions.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { aggregateDiapersForLocalDay } from '../src/domain/diaperLabels'
import {
	formatTemperatureCelsius,
	parseTemperatureCelsius,
} from '../src/domain/quickEventLabels'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import {
	buildTodayDiaperModel,
} from '../src/presentation/todayDiaperModel'
import {
	activityToTimeline,
	customToTimeline,
	diaperToTimeline,
	temperatureToTimeline,
} from '../src/presentation/diaryTimeline'
import { formatRelativeAgo } from '../src/presentation/feedingFormat'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const diaper = new DiaperRepository(db)
	const quick = new QuickEventRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-06-01',
	})
	return { db, diaper, quick, childId: child.id }
}

describe('DiaperRepository', () => {
	it('creates wet/dirty/both/dry and counts both once', async () => {
		const { diaper, childId } = await setup()
		await diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await diaper.create({
			childId,
			kind: 'dirty',
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await diaper.create({
			childId,
			kind: 'both',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await diaper.create({
			childId,
			kind: 'dry',
			occurredAt: '2026-09-09T13:00:00+03:00',
		})

		const day = await diaper.listByChildAndLocalDate(childId, '2026-09-09')
		const agg = aggregateDiapersForLocalDay(day)
		expect(agg.totalCount).toBe(4)
		expect(agg.wetCount).toBe(1)
		expect(agg.dirtyCount).toBe(1)
		expect(agg.bothCount).toBe(1)
		expect(agg.dryCount).toBe(1)
	})

	it('supports backdated create, latest, edit and delete', async () => {
		const { diaper, childId } = await setup()
		const created = await diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-08T14:20:00+03:00',
		})
		expect(created.startLocalDate).toBe('2026-09-08')

		const latest = await diaper.findLatest(childId)
		expect(latest?.id).toBe(created.id)

		const updated = await diaper.update(created.id, {
			kind: 'both',
			color: 'yellow',
			consistency: 'soft',
			notes: 'после прогулки',
			occurredAt: '2026-09-08T15:00:00+03:00',
		})
		expect(updated.kind).toBe('both')
		expect(updated.color).toBe('yellow')
		expect(updated.notes).toBe('после прогулки')

		const model = buildTodayDiaperModel(
			updated,
			[updated],
			new Date('2026-09-08T15:35:00+03:00').getTime(),
		)
		expect(model.latestSummary).toContain('Оба')
		expect(model.latestSummary).toContain(
			formatRelativeAgo(
				updated.startAt,
				new Date('2026-09-08T15:35:00+03:00').getTime(),
			),
		)

		await diaper.delete(created.id)
		expect(await diaper.getById(created.id)).toBeNull()
	})

	it('formats diary diaper rows in Russian', async () => {
		const { diaper, childId } = await setup()
		const row = await diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T14:20:00+03:00',
		})
		const line = diaperToTimeline(row)
		expect(line.label).toContain('Подгузник')
		expect(line.label).toContain('мокрый')
		expect(line.filterGroup).toBe('diaper')
	})
})

describe('QuickEventRepository', () => {
	it('creates activity and presents duration', async () => {
		const { quick, childId } = await setup()
		const walk = await quick.createActivity({
			childId,
			type: 'walk',
			occurredAt: '2026-09-09T16:00:00+03:00',
			durationSeconds: 35 * 60,
		})
		expect(walk.durationSeconds).toBe(35 * 60)
		expect(activityToTimeline(walk).label).toContain('Прогулка')
		expect(activityToTimeline(walk).label).toContain('35 мин')
	})

	it('parses decimal comma temperature and supports edit/delete', async () => {
		expect(parseTemperatureCelsius('36,7')).toBe(36.7)
		expect(formatTemperatureCelsius(36.7)).toBe('36,7 °C')

		const { quick, childId } = await setup()
		const temp = await quick.createTemperature({
			childId,
			celsiusRaw: '36,7',
			occurredAt: '2026-09-09T09:00:00+03:00',
		})
		expect(temp.celsius).toBe(36.7)
		expect(temperatureToTimeline(temp).label).toContain('36,7 °C')

		const updated = await quick.updateTemperature(temp.id, {
			celsiusRaw: '37,1',
		})
		expect(updated.celsius).toBe(37.1)
		await quick.deleteEvent(temp.id)
		expect(await quick.getTemperatureById(temp.id)).toBeNull()
	})

	it('creates medicine/vitamin with recent names', async () => {
		const { quick, childId } = await setup()
		await quick.createMedicine({
			childId,
			kind: 'vitamin',
			name: 'Д3',
			occurredAt: '2026-09-09T08:00:00+03:00',
		})
		await quick.createMedicine({
			childId,
			kind: 'medicine',
			name: 'Нурофен',
			doseText: '2,5',
			unit: 'мл',
			occurredAt: '2026-09-09T20:00:00+03:00',
		})
		const recent = await quick.listRecentMedicineNames(childId, 'vitamin')
		expect(recent).toContain('Д3')
		const meds = await quick.listMedicinesByChild(childId)
		expect(meds).toHaveLength(2)
	})

	it('creates custom definition, event, rename, archive; history stays readable', async () => {
		const { quick, childId } = await setup()
		const def = await quick.createCustomDefinition({
			childId,
			name: 'Бассейн',
			iconKey: 'pool',
		})
		const event = await quick.createCustomEvent({
			childId,
			definitionId: def.id,
			occurredAt: '2026-09-09T17:30:00+03:00',
			durationSeconds: 45 * 60,
		})
		expect(event.definitionName).toBe('Бассейн')
		expect(customToTimeline(event).label).toContain('Бассейн')
		expect(customToTimeline(event).label).toContain('45 мин')

		await quick.updateCustomDefinition(def.id, { name: 'Бассейн+' })
		const renamed = await quick.getCustomEventById(event.id)
		expect(renamed?.definitionName).toBe('Бассейн+')

		await quick.archiveCustomDefinition(def.id)
		const archived = await quick.getCustomDefinitionById(def.id)
		expect(archived?.isActive).toBe(false)

		const stillReadable = await quick.getCustomEventById(event.id)
		expect(stillReadable?.definitionName).toBe('Бассейн+')
		expect(stillReadable?.id).toBe(event.id)
	})
})
