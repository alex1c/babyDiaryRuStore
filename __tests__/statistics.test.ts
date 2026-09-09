/**
 * Phase 8 — statistics period report, wake windows, daily series.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { buildPeriodReportData } from '../src/domain/buildPeriodReport'
import {
	enumerateLocalDates,
	resolveStatsPeriod,
} from '../src/domain/statsPeriod'
import {
	computeAverageWakeWindow,
	MAX_WAKE_WINDOW_MS,
} from '../src/domain/wakeWindowStats'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { DoctorVisitRepository } from '../src/repositories/doctorVisitRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { GrowthRepository } from '../src/repositories/growthRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import { SymptomRepository } from '../src/repositories/symptomRepository'
import { createMemoryPhotoStorage } from '../src/services/photoStorage'
import { loadPeriodReport } from '../src/presentation/loadPeriodReport'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-06-01',
	})
	const healthDocs = createMemoryPhotoStorage('health-documents/')
	const repos = {
		sleep: new SleepRepository(db),
		feeding: new FeedingRepository(db),
		diaper: new DiaperRepository(db),
		growth: new GrowthRepository(db),
		quickEvents: new QuickEventRepository(db),
		symptoms: new SymptomRepository(db, healthDocs),
		doctorVisits: new DoctorVisitRepository(db),
	}
	return { db, child, repos, childId: child.id }
}

describe('stats periods', () => {
	it('resolves 7/30/90 relative to today and includes today', () => {
		const p7 = resolveStatsPeriod('7', '2026-09-09')
		expect(p7.startDate).toBe('2026-09-03')
		expect(p7.endDate).toBe('2026-09-09')
		expect(p7.dayCount).toBe(7)
		expect(enumerateLocalDates(p7.startDate, p7.endDate)).toHaveLength(7)

		expect(resolveStatsPeriod('30', '2026-09-09').dayCount).toBe(30)
		expect(resolveStatsPeriod('90', '2026-09-09').dayCount).toBe(90)
	})

	it('resolves all from earliest to today', () => {
		const all = resolveStatsPeriod('all', '2026-09-09', '2026-08-01')
		expect(all.startDate).toBe('2026-08-01')
		expect(all.endDate).toBe('2026-09-09')
		expect(all.dayCount).toBeGreaterThan(7)
	})
})

describe('wake-window stats', () => {
	it('averages valid gaps and skips huge / negative', () => {
		const result = computeAverageWakeWindow([
			{
				id: '1',
				childId: 'c',
				startAt: '2026-09-09T08:00:00+03:00',
				endAt: '2026-09-09T09:00:00+03:00',
				startLocalDate: '2026-09-09',
				endLocalDate: '2026-09-09',
				notes: null,
				createdAt: 'x',
				updatedAt: 'x',
				sleepType: 'day',
			},
			{
				id: '2',
				childId: 'c',
				startAt: '2026-09-09T10:30:00+03:00',
				endAt: '2026-09-09T11:30:00+03:00',
				startLocalDate: '2026-09-09',
				endLocalDate: '2026-09-09',
				notes: null,
				createdAt: 'x',
				updatedAt: 'x',
				sleepType: 'day',
			},
			{
				id: '3',
				childId: 'c',
				startAt: '2026-09-10T10:00:00+03:00',
				endAt: '2026-09-10T11:00:00+03:00',
				startLocalDate: '2026-09-10',
				endLocalDate: '2026-09-10',
				notes: null,
				createdAt: 'x',
				updatedAt: 'x',
				sleepType: 'day',
			},
		])
		// 1.5h then ~22.5h — second gap discarded as > MAX
		expect(result.sampleCount).toBe(1)
		expect(result.averageMs).toBe(90 * 60 * 1000)
		expect(MAX_WAKE_WINDOW_MS).toBeGreaterThan(0)
	})

	it('returns null when no valid intervals', () => {
		expect(computeAverageWakeWindow([]).averageMs).toBeNull()
	})
})

describe('sleep period stats', () => {
	it('aggregates 7-day totals with day/night, active and overnight', async () => {
		const { repos, child, childId } = await setup()
		await repos.sleep.createManual({
			childId,
			startAt: '2026-09-08T20:00:00+03:00',
			endAt: '2026-09-09T06:00:00+03:00',
			sleepType: 'night',
		})
		await repos.sleep.createManual({
			childId,
			startAt: '2026-09-09T10:00:00+03:00',
			endAt: '2026-09-09T11:30:00+03:00',
			sleepType: 'day',
		})
		await repos.sleep.start({
			childId,
			startedAt: '2026-09-09T14:00:00+03:00',
			sleepType: 'day',
		})

		const report = await loadPeriodReport(
			repos,
			child,
			'7',
			'2026-09-09',
			new Date('2026-09-09T15:00:00+03:00').getTime(),
		)
		expect(report.dailySeries).toHaveLength(7)
		expect(report.sleep.hasAnyData).toBe(true)
		expect(report.sleep.averageTotalMs).toBeGreaterThan(0)
		expect(report.sleep.longestSleepMs).toBeGreaterThan(0)
		const today = report.dailySeries.find((d) => d.date === '2026-09-09')
		expect(today?.sleepTotalMinutes).toBeGreaterThan(0)
		expect(today?.nightSleepMinutes).toBeGreaterThan(0)
	})

	it('handles empty period and missing days as zero averages', () => {
		const period = resolveStatsPeriod('7', '2026-09-09')
		const report = buildPeriodReportData({
			child: { id: 'c', name: 'T', birthDate: '2026-01-01' },
			period,
			sleeps: [],
			feedings: [],
			diapers: [],
			measurements: [],
			temperatures: [],
			symptoms: [],
			medicines: [],
			doctorVisits: [],
		})
		expect(report.sleep.hasAnyData).toBe(false)
		expect(report.sleep.averageTotalMs).toBe(0)
		expect(report.dailySeries.every((d) => d.sleepTotalMinutes === 0)).toBe(
			true,
		)
	})
})

describe('feeding period stats', () => {
	it('separates BF, formula, expressed, water, solids', async () => {
		const { repos, child, childId } = await setup()
		await repos.feeding.createManualBreastfeeding({
			childId,
			startAt: '2026-09-09T08:00:00+03:00',
			endAt: '2026-09-09T08:20:00+03:00',
			leftDurationSeconds: 600,
			rightDurationSeconds: 600,
			initialSide: 'left',
		})
		await repos.feeding.createBottle({
			childId,
			amountMl: 120,
			content: 'formula',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.feeding.createBottle({
			childId,
			amountMl: 80,
			content: 'expressed_milk',
			occurredAt: '2026-09-09T16:00:00+03:00',
		})
		await repos.feeding.createWater({
			childId,
			amountMl: 30,
			occurredAt: '2026-09-09T17:00:00+03:00',
		})
		await repos.feeding.createSolid({
			childId,
			foodName: 'каша',
			occurredAt: '2026-09-09T18:00:00+03:00',
		})

		const report = await loadPeriodReport(
			repos,
			child,
			'7',
			'2026-09-09',
		)
		expect(report.feeding.breastfeedingCount).toBe(1)
		expect(report.feeding.breastfeedingTotalSeconds).toBe(1200)
		expect(report.feeding.formulaMl).toBe(120)
		expect(report.feeding.expressedMilkMl).toBe(80)
		expect(report.feeding.waterMl).toBe(30)
		expect(report.feeding.solidsCount).toBe(1)
		expect(report.feeding.averageFeedingsPerDay).toBeGreaterThan(0)
	})
})

describe('diaper period stats', () => {
	it('counts wet/dirty/both/dry without double-counting both', async () => {
		const { repos, child, childId } = await setup()
		await repos.diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'dirty',
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'both',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'dry',
			occurredAt: '2026-09-09T13:00:00+03:00',
		})
		const report = await loadPeriodReport(repos, child, '7', '2026-09-09')
		expect(report.diapers.total).toBe(4)
		expect(report.diapers.wet).toBe(1)
		expect(report.diapers.dirty).toBe(1)
		expect(report.diapers.both).toBe(1)
		expect(report.diapers.dry).toBe(1)
		expect(report.diapers.averagePerDay).toBeGreaterThan(0)
	})
})

describe('growth period stats', () => {
	it('latest, delta, one point, no points', async () => {
		const { repos, child, childId } = await setup()
		const empty = await loadPeriodReport(repos, child, '7', '2026-09-09')
		expect(empty.growth.weightDeltaGrams).toBeNull()

		await repos.growth.create({
			childId,
			weightKgRaw: '6,0',
			measuredAt: '2026-09-01T12:00:00+03:00',
		})
		const one = await loadPeriodReport(repos, child, '30', '2026-09-09')
		expect(one.growth.latestWeightGrams).toBe(6000)
		expect(one.growth.weightDeltaGrams).toBeNull()

		await repos.growth.create({
			childId,
			weightKgRaw: '6,62',
			measuredAt: '2026-09-09T12:00:00+03:00',
		})
		const two = await loadPeriodReport(repos, child, '30', '2026-09-09')
		expect(two.growth.weightDeltaGrams).toBe(620)
	})
})

describe('health period summary', () => {
	it('counts temps min/max, symptoms, medicines, visits; empty period', async () => {
		const { repos, child, childId } = await setup()
		const empty = await loadPeriodReport(repos, child, '7', '2026-09-09')
		expect(empty.health.hasAnyData).toBe(false)

		await repos.quickEvents.createTemperature({
			childId,
			celsiusRaw: '36,6',
			occurredAt: '2026-09-08T10:00:00+03:00',
		})
		await repos.quickEvents.createTemperature({
			childId,
			celsiusRaw: '38,2',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await repos.symptoms.create({
			childId,
			symptomType: 'cough',
			startedAt: '2026-09-09T09:00:00+03:00',
		})
		await repos.quickEvents.createMedicine({
			childId,
			kind: 'medicine',
			name: 'Сироп',
			doseText: '5',
			unit: 'ml',
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await repos.doctorVisits.create({
			childId,
			specialistKey: 'pediatrician',
			visitedAt: '2026-09-09T14:00:00+03:00',
		})

		const report = await loadPeriodReport(repos, child, '7', '2026-09-09')
		expect(report.health.temperatureCount).toBe(2)
		expect(report.health.temperatureMin).toBe(36.6)
		expect(report.health.temperatureMax).toBe(38.2)
		expect(report.health.symptomsCount).toBe(1)
		expect(report.health.medicineIntakes).toBe(1)
		expect(report.health.doctorVisits).toBe(1)
	})
})
