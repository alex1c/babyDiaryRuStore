/**
 * Load PeriodReportData for Statistics — sequential SQLite, few period queries.
 */

import { buildPeriodReportData } from '../domain/buildPeriodReport'
import type { PeriodReportData } from '../domain/periodReport'
import {
	resolveStatsPeriod,
	type StatsPeriodKind,
} from '../domain/statsPeriod'
import type { Child } from '../models/types'
import type { DiaperRepository } from '../repositories/diaperRepository'
import type { DoctorVisitRepository } from '../repositories/doctorVisitRepository'
import type { FeedingRepository } from '../repositories/feedingRepository'
import type { GrowthRepository } from '../repositories/growthRepository'
import type { QuickEventRepository } from '../repositories/quickEventRepository'
import type { SleepRepository } from '../repositories/sleepRepository'
import type { SymptomRepository } from '../repositories/symptomRepository'
import { toLocalDateOnly } from '../utils/datetime'

export interface StatsLoadRepos {
	sleep: SleepRepository
	feeding: FeedingRepository
	diaper: DiaperRepository
	growth: GrowthRepository
	quickEvents: QuickEventRepository
	symptoms: SymptomRepository
	doctorVisits: DoctorVisitRepository
}

/**
 * Resolve earliest activity date for «Всё» (sequential lookups).
 */
export async function findEarliestActivityDate (
	repos: StatsLoadRepos,
	childId: string,
): Promise<string | null> {
	const candidates: string[] = []
	const sleepPage = await repos.sleep.listByChild(childId, 500)
	const feedPage = await repos.feeding.listByChild(childId, 500)
	const diaperPage = await repos.diaper.listByChild(childId, 500)
	const growthPage = await repos.growth.listByChild(childId, 200)
	for (const s of sleepPage) {
		candidates.push(s.startLocalDate)
	}
	for (const f of feedPage) {
		candidates.push(f.startLocalDate)
	}
	for (const d of diaperPage) {
		candidates.push(d.startLocalDate)
	}
	for (const g of growthPage) {
		candidates.push(g.measuredLocalDate)
	}
	if (candidates.length === 0) {
		return null
	}
	candidates.sort()
	return candidates[0] ?? null
}

export async function loadPeriodReport (
	repos: StatsLoadRepos,
	child: Pick<Child, 'id' | 'name' | 'birthDate'>,
	kind: StatsPeriodKind,
	today: string = toLocalDateOnly(),
	nowMs: number = Date.now(),
): Promise<PeriodReportData> {
	const earliest =
		kind === 'all'
			? await findEarliestActivityDate(repos, child.id)
			: null
	const period = resolveStatsPeriod(kind, today, earliest)

	// Sequential period queries — never Promise.all on one NativeDatabase.
	const sleeps = await repos.sleep.listOverlappingLocalDateRange(
		child.id,
		period.startDate,
		period.endDate,
	)
	const feedings = await repos.feeding.listByChildAndLocalDateRange(
		child.id,
		period.startDate,
		period.endDate,
	)
	const diapers = await repos.diaper.listByChildAndLocalDateRange(
		child.id,
		period.startDate,
		period.endDate,
	)
	// Growth: load recent history so "latest" outside period still shows;
	// deltas use in-period points inside buildPeriodReportData.
	const measurements = await repos.growth.listByChild(child.id, 200)
	const temperatures = await repos.quickEvents.listTemperaturesByChild(
		child.id,
		500,
	)
	const medicines = await repos.quickEvents.listMedicinesByChild(
		child.id,
		500,
	)
	const symptoms = await repos.symptoms.listByChild(child.id, 500)
	const doctorVisits = await repos.doctorVisits.listByChild(child.id, 200)

	return buildPeriodReportData({
		child,
		period,
		sleeps,
		feedings,
		diapers,
		measurements,
		temperatures,
		symptoms,
		medicines,
		doctorVisits,
		nowMs,
	})
}
