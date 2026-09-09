/**
 * Load period report + health details + chronology for share/PDF.
 * Sequential SQLite access only.
 */

import { buildPeriodReportData } from '../domain/buildPeriodReport'
import { buildHealthReportData } from '../domain/healthReport'
import { buildReportChronology } from '../domain/reportChronology'
import type { ChronologyRow } from '../domain/reportChronology'
import type { HealthReportData } from '../domain/healthReport'
import type { PeriodReportData } from '../domain/periodReport'
import {
	reportPeriodToStatsPeriod,
	resolveReportPeriod,
	type CustomReportRange,
	type ReportPeriod,
	type ReportPeriodPreset,
} from '../domain/reportPeriod'
import type { Child } from '../models/types'
import type { MilestoneEvent } from '../models/development'
import type { MilestoneRepository } from '../repositories/milestoneRepository'
import { toLocalDateOnly } from '../utils/datetime'
import {
	findEarliestActivityDate,
	loadPeriodReport,
	type StatsLoadRepos,
} from './loadPeriodReport'

export interface ReportLoadRepos extends StatsLoadRepos {
	milestones: MilestoneRepository
}

export interface PeriodReportBundle {
	period: ReportPeriod
	report: PeriodReportData
	health: HealthReportData
	chronology: ChronologyRow[]
	milestones: MilestoneEvent[]
}

export async function loadPeriodReportBundle (
	repos: ReportLoadRepos,
	child: Pick<Child, 'id' | 'name' | 'birthDate'>,
	preset: ReportPeriodPreset,
	options: {
		today?: string
		nowMs?: number
		custom?: CustomReportRange | null
	} = {},
): Promise<PeriodReportBundle> {
	const today = options.today ?? toLocalDateOnly()
	const nowMs = options.nowMs ?? Date.now()
	const period = resolveReportPeriod(preset, today, options.custom ?? null)
	const statsPeriod = reportPeriodToStatsPeriod(period)

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
	const milestones = await repos.milestones.listByChild(child.id, 200)

	const report = buildPeriodReportData({
		child,
		period: statsPeriod,
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

	const health = buildHealthReportData({
		periodStart: period.startDate,
		periodEnd: period.endDate,
		temperatures,
		symptoms,
		medicines,
		doctorVisits,
	})

	const chronology = buildReportChronology({
		sleeps,
		feedings,
		diapers,
		temperatures: health.temperatures,
		medicines: health.medicines,
		symptoms: health.symptoms,
		doctorVisits: health.doctorVisits,
		milestones,
		measurements: measurements.filter(
			(m) =>
				m.measuredLocalDate >= period.startDate &&
				m.measuredLocalDate <= period.endDate,
		),
		periodStart: period.startDate,
		periodEnd: period.endDate,
		nowMs,
	})

	return {
		period,
		report,
		health,
		chronology,
		milestones,
	}
}

export {
	findEarliestActivityDate,
	loadPeriodReport,
}
