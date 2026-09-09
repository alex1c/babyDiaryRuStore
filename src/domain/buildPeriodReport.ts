/**
 * Build period statistics from preloaded event lists (no DB inside).
 * Averages use calendar days in the period (including empty / partial today).
 */

import { aggregateDiapersForLocalDay } from './diaperLabels'
import { emptyDailyStats, type DailyStats } from './dailyStats'
import { aggregateFeedingsForLocalDay } from './feedingAggregation'
import type {
	DiaperPeriodStats,
	FeedingPeriodStats,
	GrowthPeriodStats,
	HealthPeriodSummary,
	PeriodReportData,
	SleepPeriodStats,
} from './periodReport'
import { aggregateSleepForLocalDay } from './sleepAggregation'
import { enumerateLocalDates, type StatsPeriod } from './statsPeriod'
import { computeAverageWakeWindow } from './wakeWindowStats'
import { buildHealthReportData } from './healthReport'
import type { DiaperEvent } from '../models/diaper'
import type { FeedingEvent } from '../models/feeding'
import type { GrowthMeasurement } from '../models/growth'
import type { DoctorVisit, SymptomEvent } from '../models/health'
import type { MedicineEvent, TemperatureEvent } from '../models/quickEvents'
import type { SleepEvent } from '../models/sleep'
import type { Child } from '../models/types'
import { parseOffsetDateTime } from '../utils/datetime'

export interface BuildPeriodReportInput {
	child: Pick<Child, 'id' | 'name' | 'birthDate'>
	period: StatsPeriod
	sleeps: SleepEvent[]
	feedings: FeedingEvent[]
	diapers: DiaperEvent[]
	measurements: GrowthMeasurement[]
	temperatures: TemperatureEvent[]
	symptoms: SymptomEvent[]
	medicines: MedicineEvent[]
	doctorVisits: DoctorVisit[]
	nowMs?: number
}

export function buildPeriodReportData (
	input: BuildPeriodReportInput,
): PeriodReportData {
	const nowMs = input.nowMs ?? Date.now()
	const dates = enumerateLocalDates(
		input.period.startDate,
		input.period.endDate,
	)
	const dayCount = Math.max(1, dates.length)

	const dailySeries: DailyStats[] = dates.map((date) => {
		const sleepAgg = aggregateSleepForLocalDay(input.sleeps, date, nowMs)
		const feedAgg = aggregateFeedingsForLocalDay(
			input.feedings.filter((f) => f.startLocalDate === date),
			nowMs,
		)
		const diaperAgg = aggregateDiapersForLocalDay(
			input.diapers.filter((d) => d.startLocalDate === date),
		)
		const row = emptyDailyStats(date)
		row.sleepTotalMinutes = Math.floor(sleepAgg.totalMs / 60_000)
		row.daySleepMinutes = Math.floor(sleepAgg.dayMs / 60_000)
		row.nightSleepMinutes = Math.floor(sleepAgg.nightMs / 60_000)
		row.sleepCount = sleepAgg.finishedCount + (sleepAgg.includesActive ? 1 : 0)
		row.feedingCount = feedAgg.totalCount
		row.breastfeedingMinutes = Math.floor(
			feedAgg.breastfeedingDurationSeconds / 60,
		)
		row.formulaMl = feedAgg.formulaMl
		row.expressedMilkMl = feedAgg.expressedMilkMl
		row.waterMl = feedAgg.waterMl
		row.solidsCount = feedAgg.solidsCount
		row.diaperTotal = diaperAgg.totalCount
		row.diaperWet = diaperAgg.wetCount
		row.diaperDirty = diaperAgg.dirtyCount
		row.diaperBoth = diaperAgg.bothCount
		row.diaperDry = diaperAgg.dryCount
		return row
	})

	const sleep = buildSleepStats(
		input.sleeps,
		dailySeries,
		dayCount,
		nowMs,
	)
	const feeding = buildFeedingStats(input.feedings, dayCount, nowMs)
	const diapers = buildDiaperStats(input.diapers, dayCount)
	const growth = buildGrowthStats(
		input.measurements,
		input.period.startDate,
		input.period.endDate,
	)
	const healthReport = buildHealthReportData({
		periodStart: input.period.startDate,
		periodEnd: input.period.endDate,
		temperatures: input.temperatures,
		symptoms: input.symptoms,
		medicines: input.medicines,
		doctorVisits: input.doctorVisits,
	})
	const health: HealthPeriodSummary = {
		temperatureCount: healthReport.temperatures.length,
		temperatureMin: healthReport.temperatureMin,
		temperatureMax: healthReport.temperatureMax,
		symptomsCount: healthReport.symptoms.length,
		medicineIntakes: healthReport.medicines.length,
		doctorVisits: healthReport.doctorVisits.length,
		hasAnyData:
			healthReport.temperatures.length > 0 ||
			healthReport.symptoms.length > 0 ||
			healthReport.medicines.length > 0 ||
			healthReport.doctorVisits.length > 0,
	}

	return {
		child: input.child,
		period: input.period,
		sleep,
		feeding,
		diapers,
		growth,
		health,
		dailySeries,
	}
}

function buildSleepStats (
	sleeps: SleepEvent[],
	daily: DailyStats[],
	dayCount: number,
	nowMs: number,
): SleepPeriodStats {
	let totalSleepMs = 0
	let totalDayMs = 0
	let totalNightMs = 0
	let sleepEventCount = 0
	let daysWithData = 0
	let longestSleepMs = 0

	for (const day of daily) {
		const totalMs = day.sleepTotalMinutes * 60_000
		totalSleepMs += totalMs
		totalDayMs += day.daySleepMinutes * 60_000
		totalNightMs += day.nightSleepMinutes * 60_000
		sleepEventCount += day.sleepCount
		if (day.sleepTotalMinutes > 0) {
			daysWithData += 1
		}
	}

	for (const sleep of sleeps) {
		const start = parseOffsetDateTime(sleep.startAt).getTime()
		const end =
			sleep.endAt == null
				? nowMs
				: parseOffsetDateTime(sleep.endAt).getTime()
		const dur = Math.max(0, end - start)
		if (dur > longestSleepMs) {
			longestSleepMs = dur
		}
	}

	const wake = computeAverageWakeWindow(sleeps)
	const hasAnyData = totalSleepMs > 0 || sleeps.length > 0

	return {
		averageTotalMs: Math.round(totalSleepMs / dayCount),
		averageDayMs: Math.round(totalDayMs / dayCount),
		averageNightMs: Math.round(totalNightMs / dayCount),
		averageSleepsPerDay:
			Math.round((sleepEventCount / dayCount) * 10) / 10,
		averageWakeWindowMs: wake.averageMs,
		longestSleepMs,
		totalSleepMs,
		daysWithData,
		hasAnyData,
	}
}

function buildFeedingStats (
	feedings: FeedingEvent[],
	dayCount: number,
	nowMs: number,
): FeedingPeriodStats {
	const agg = aggregateFeedingsForLocalDay(feedings, nowMs)
	return {
		averageFeedingsPerDay:
			Math.round((agg.totalCount / dayCount) * 10) / 10,
		breastfeedingCount: agg.breastfeedingCount,
		breastfeedingTotalSeconds: agg.breastfeedingDurationSeconds,
		breastfeedingAverageSeconds:
			agg.breastfeedingCount > 0
				? Math.round(
						agg.breastfeedingDurationSeconds / agg.breastfeedingCount,
					)
				: null,
		formulaMl: agg.formulaMl,
		expressedMilkMl: agg.expressedMilkMl,
		waterMl: agg.waterMl,
		solidsCount: agg.solidsCount,
		hasAnyData: agg.totalCount > 0,
	}
}

function buildDiaperStats (
	diapers: DiaperEvent[],
	dayCount: number,
): DiaperPeriodStats {
	const agg = aggregateDiapersForLocalDay(diapers)
	return {
		total: agg.totalCount,
		averagePerDay: Math.round((agg.totalCount / dayCount) * 10) / 10,
		wet: agg.wetCount,
		dirty: agg.dirtyCount,
		both: agg.bothCount,
		dry: agg.dryCount,
		hasAnyData: agg.totalCount > 0,
	}
}

function buildGrowthStats (
	measurements: GrowthMeasurement[],
	startDate: string,
	endDate: string,
): GrowthPeriodStats {
	const inPeriod = measurements
		.filter(
			(m) =>
				m.measuredLocalDate >= startDate &&
				m.measuredLocalDate <= endDate,
		)
		.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))

	const withWeight = inPeriod.filter((m) => m.weightGrams != null)
	const withHeight = inPeriod.filter((m) => m.heightMm != null)
	const withHead = inPeriod.filter((m) => m.headCircumferenceMm != null)

	const latestOverall = [...measurements].sort((a, b) =>
		b.measuredAt.localeCompare(a.measuredAt),
	)

	const latestWeight =
		latestOverall.find((m) => m.weightGrams != null)?.weightGrams ?? null
	const latestHeight =
		latestOverall.find((m) => m.heightMm != null)?.heightMm ?? null
	const latestHead =
		latestOverall.find((m) => m.headCircumferenceMm != null)
			?.headCircumferenceMm ?? null

	const weightValues = withWeight.map((m) => m.weightGrams as number)
	const heightValues = withHeight.map((m) => m.heightMm as number)
	const headValues = withHead.map(
		(m) => m.headCircumferenceMm as number,
	)

	return {
		latestWeightGrams: latestWeight,
		latestHeightMm: latestHeight,
		latestHeadMm: latestHead,
		weightDeltaGrams: seriesDelta(weightValues),
		heightDeltaMm: seriesDelta(heightValues),
		headDeltaMm: seriesDelta(headValues),
		measurementsInPeriod: inPeriod,
		hasAnyData: measurements.length > 0,
	}
}

function seriesDelta (values: number[]): number | null {
	if (values.length < 2) {
		return null
	}
	return values[values.length - 1]! - values[0]!
}
