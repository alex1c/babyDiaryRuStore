/**
 * Feeding repository + aggregation coverage for Phase 3.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { aggregateFeedingsForLocalDay } from '../src/domain/feedingAggregation'
import { breastfeedingLiveTotals } from '../src/domain/breastfeedingDuration'
import { FeedingValidationError } from '../src/domain/feedingLabels'
import { ChildRepository } from '../src/repositories/childRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { formatDurationMs } from '../src/utils/durationFormat'
import {
	formatLatestFeedingSummary,
	formatMl,
} from '../src/presentation/feedingFormat'
import { buildTodayFeedingModel } from '../src/presentation/todayFeedingModel'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const feeding = new FeedingRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-06-01',
	})
	return { db, feeding, childId: child.id }
}

describe('FeedingRepository breastfeeding', () => {
	it('starts breastfeeding and recovers active session', async () => {
		const { feeding, childId } = await setup()
		const started = await feeding.startBreastfeeding({
			childId,
			side: 'left',
			startedAt: '2026-09-09T08:42:00+03:00',
		})
		expect(started.endAt).toBeNull()
		expect(started.initialSide).toBe('left')
		expect(started.lastSide).toBe('left')

		const active = await feeding.findActiveBreastfeeding(childId)
		expect(active?.id).toBe(started.id)

		const now = new Date('2026-09-09T08:50:00+03:00').getTime()
		const totals = breastfeedingLiveTotals(active!, now)
		expect(totals.leftSeconds).toBe(8 * 60)
		expect(totals.rightSeconds).toBe(0)
		expect(formatDurationMs(totals.totalSeconds * 1000)).toBe('8 мин')
	})

	it('prevents a second active breastfeeding by returning the existing one', async () => {
		const { feeding, childId } = await setup()
		const first = await feeding.startBreastfeeding({
			childId,
			side: 'left',
			startedAt: '2026-09-09T08:00:00+03:00',
		})
		const second = await feeding.startBreastfeeding({
			childId,
			side: 'right',
			startedAt: '2026-09-09T08:05:00+03:00',
		})
		expect(second.id).toBe(first.id)
		expect(second.lastSide).toBe('left')
	})

	it('switches sides and keeps separate durations', async () => {
		const { feeding, childId } = await setup()
		const started = await feeding.startBreastfeeding({
			childId,
			side: 'left',
			startedAt: '2026-09-09T10:00:00+03:00',
		})
		const switched = await feeding.switchBreastSide(
			started.id,
			'right',
			'2026-09-09T10:10:00+03:00',
		)
		expect(switched.leftDurationSeconds).toBe(600)
		expect(switched.rightDurationSeconds).toBe(0)
		expect(switched.lastSide).toBe('right')
		expect(switched.sideStartedAt).toBe('2026-09-09T10:10:00+03:00')

		const finished = await feeding.finishBreastfeeding(
			started.id,
			'2026-09-09T10:18:00+03:00',
		)
		expect(finished.endAt).toBe('2026-09-09T10:18:00+03:00')
		expect(finished.leftDurationSeconds).toBe(600)
		expect(finished.rightDurationSeconds).toBe(480)
		expect(finished.sideStartedAt).toBeNull()
		expect(await feeding.findActiveBreastfeeding(childId)).toBeNull()
	})

	it('creates manual breastfeeding and supports edit/delete', async () => {
		const { feeding, childId } = await setup()
		const created = await feeding.createManualBreastfeeding({
			childId,
			startAt: '2026-09-09T12:00:00+03:00',
			endAt: '2026-09-09T12:20:00+03:00',
			leftDurationSeconds: 600,
			rightDurationSeconds: 600,
			notes: 'вручную',
		})
		expect(created.endAt).toBe('2026-09-09T12:20:00+03:00')

		const updated = await feeding.updateBreastfeeding(created.id, {
			leftDurationSeconds: 700,
			rightDurationSeconds: 500,
			notes: 'правка',
		})
		expect(updated.leftDurationSeconds).toBe(700)
		expect(updated.notes).toBe('правка')

		await feeding.delete(created.id)
		expect(await feeding.getById(created.id)).toBeNull()
	})
})

describe('FeedingRepository bottle / water / pumping / solid', () => {
	it('creates expressed milk and formula bottles with volume validation', async () => {
		const { feeding, childId } = await setup()
		const milk = await feeding.createBottle({
			childId,
			content: 'expressed_milk',
			amountMl: 90,
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		expect(milk.feedingKind).toBe('expressed_milk')
		expect(milk.amountMl).toBe(90)

		const formula = await feeding.createBottle({
			childId,
			content: 'formula',
			amountMl: 120,
			occurredAt: '2026-09-09T13:00:00+03:00',
		})
		expect(formula.feedingKind).toBe('formula')

		await expect(
			feeding.createBottle({
				childId,
				content: 'formula',
				amountMl: -5,
			}),
		).rejects.toBeInstanceOf(FeedingValidationError)

		await expect(
			feeding.createBottle({
				childId,
				content: 'formula',
				amountMl: 12.5,
			}),
		).rejects.toBeInstanceOf(FeedingValidationError)
	})

	it('creates pumping with duration and volume', async () => {
		const { feeding, childId } = await setup()
		const pump = await feeding.createPumping({
			childId,
			side: 'both',
			amountMl: 80,
			durationSeconds: 900,
			occurredAt: '2026-09-09T09:00:00+03:00',
		})
		expect(pump.amountMl).toBe(80)
		expect(pump.durationSeconds).toBe(900)
		expect(pump.side).toBe('both')
	})

	it('keeps water out of milk aggregates', async () => {
		const { feeding, childId } = await setup()
		await feeding.createBottle({
			childId,
			content: 'formula',
			amountMl: 120,
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await feeding.createWater({
			childId,
			amountMl: 40,
			occurredAt: '2026-09-09T10:30:00+03:00',
		})
		const day = await feeding.listByChildAndLocalDate(childId, '2026-09-09')
		const agg = aggregateFeedingsForLocalDay(day)
		expect(agg.formulaMl).toBe(120)
		expect(agg.waterMl).toBe(40)
		expect(agg.expressedMilkMl).toBe(0)
	})

	it('creates and edits solid food with recent products', async () => {
		const { feeding, childId } = await setup()
		const solid = await feeding.createSolid({
			childId,
			foodName: 'кабачок',
			amountText: '2 ложки',
			reaction: 'liked',
			occurredAt: '2026-09-09T17:00:00+03:00',
		})
		expect(solid.foodName).toBe('кабачок')
		expect(solid.reaction).toBe('liked')

		const recent = await feeding.listRecentFoods(childId)
		expect(recent).toContain('кабачок')

		const updated = await feeding.updateSolid(solid.id, {
			foodName: 'брокколи',
			reaction: 'neutral',
		})
		expect(updated.foodName).toBe('брокколи')
		expect(updated.reaction).toBe('neutral')

		const recent2 = await feeding.listRecentFoods(childId)
		expect(recent2[0]).toBe('брокколи')
	})
})

describe('Today feeding model', () => {
	it('shows empty state and mixed daily totals', async () => {
		const empty = buildTodayFeedingModel(null, null, [])
		expect(empty.latestSummary).toBe('Пока нет кормлений')
		expect(empty.hasData).toBe(false)

		const { feeding, childId } = await setup()
		await feeding.createManualBreastfeeding({
			childId,
			startAt: '2026-09-09T08:00:00+03:00',
			endAt: '2026-09-09T08:14:00+03:00',
			leftDurationSeconds: 840,
			rightDurationSeconds: 0,
		})
		await feeding.createBottle({
			childId,
			content: 'formula',
			amountMl: 120,
			occurredAt: '2026-09-09T12:30:00+03:00',
		})
		await feeding.createWater({
			childId,
			amountMl: 40,
			occurredAt: '2026-09-09T15:10:00+03:00',
		})
		await feeding.createSolid({
			childId,
			foodName: 'кабачок',
			occurredAt: '2026-09-09T17:00:00+03:00',
		})

		const day = await feeding.listByChildAndLocalDate(childId, '2026-09-09')
		const latest = await feeding.findLatest(childId)
		const model = buildTodayFeedingModel(null, latest, day)
		expect(model.hasData).toBe(true)
		expect(model.aggregate.totalCount).toBe(4)
		expect(model.aggregate.breastfeedingCount).toBe(1)
		expect(model.aggregate.breastfeedingDurationSeconds).toBe(840)
		expect(model.aggregate.formulaMl).toBe(120)
		expect(model.aggregate.waterMl).toBe(40)
		expect(model.aggregate.solidsCount).toBe(1)
		expect(formatMl(120)).toBe('120 мл')
		expect(
			formatLatestFeedingSummary(
				latest!,
				new Date('2026-09-09T18:00:00+03:00').getTime(),
			),
		).toContain('Прикорм')
	})
})
