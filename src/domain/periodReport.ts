/**
 * Period report foundation for Statistics UI and future PDF (Phase 9).
 */

import type { DailyStats } from './dailyStats'
import type { StatsPeriod } from './statsPeriod'
import type { Child } from '../models/types'
import type { GrowthMeasurement } from '../models/growth'

export interface SleepPeriodStats {
	averageTotalMs: number
	averageDayMs: number
	averageNightMs: number
	averageSleepsPerDay: number
	averageWakeWindowMs: number | null
	longestSleepMs: number
	totalSleepMs: number
	daysWithData: number
	hasAnyData: boolean
}

export interface FeedingPeriodStats {
	averageFeedingsPerDay: number
	breastfeedingCount: number
	breastfeedingTotalSeconds: number
	breastfeedingAverageSeconds: number | null
	formulaMl: number
	expressedMilkMl: number
	waterMl: number
	solidsCount: number
	hasAnyData: boolean
}

export interface DiaperPeriodStats {
	total: number
	averagePerDay: number
	wet: number
	dirty: number
	both: number
	dry: number
	hasAnyData: boolean
}

export interface GrowthPeriodStats {
	latestWeightGrams: number | null
	latestHeightMm: number | null
	latestHeadMm: number | null
	weightDeltaGrams: number | null
	heightDeltaMm: number | null
	headDeltaMm: number | null
	measurementsInPeriod: GrowthMeasurement[]
	hasAnyData: boolean
}

export interface HealthPeriodSummary {
	temperatureCount: number
	temperatureMin: number | null
	temperatureMax: number | null
	symptomsCount: number
	medicineIntakes: number
	doctorVisits: number
	hasAnyData: boolean
}

export interface PeriodReportData {
	child: Pick<Child, 'id' | 'name' | 'birthDate'>
	period: StatsPeriod
	sleep: SleepPeriodStats
	feeding: FeedingPeriodStats
	diapers: DiaperPeriodStats
	growth: GrowthPeriodStats
	health: HealthPeriodSummary
	dailySeries: DailyStats[]
}
