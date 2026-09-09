/**
 * Health report foundation — assemble period snapshot (no PDF yet).
 */

import type {
	DoctorVisit,
	SymptomEvent,
} from '../models/health'
import type { MedicineEvent, TemperatureEvent } from '../models/quickEvents'
import type { DateOnly } from '../models/types'

export interface HealthReportData {
	periodStart: DateOnly
	periodEnd: DateOnly
	temperatures: TemperatureEvent[]
	temperatureMin: number | null
	temperatureMax: number | null
	symptoms: SymptomEvent[]
	medicines: MedicineEvent[]
	doctorVisits: DoctorVisit[]
	notes: string[]
}

export interface HealthReportInput {
	periodStart: DateOnly
	periodEnd: DateOnly
	temperatures: TemperatureEvent[]
	symptoms: SymptomEvent[]
	medicines: MedicineEvent[]
	doctorVisits: DoctorVisit[]
	/** Optional free-text notes already filtered by caller. */
	notes?: string[]
}

/**
 * Build a period health snapshot for a future doctor PDF / share report.
 * Filters by local civil date inclusive. Does not interpret medically.
 */
export function buildHealthReportData (
	input: HealthReportInput,
): HealthReportData {
	const temperatures = input.temperatures.filter((t) =>
		inPeriod(t.startLocalDate, input.periodStart, input.periodEnd),
	)
	const symptoms = input.symptoms.filter((s) =>
		inPeriod(s.startLocalDate, input.periodStart, input.periodEnd),
	)
	const medicines = input.medicines.filter((m) =>
		inPeriod(m.startLocalDate, input.periodStart, input.periodEnd),
	)
	const doctorVisits = input.doctorVisits.filter((v) =>
		inPeriod(v.visitedLocalDate, input.periodStart, input.periodEnd),
	)

	let temperatureMin: number | null = null
	let temperatureMax: number | null = null
	for (const t of temperatures) {
		if (temperatureMin == null || t.celsius < temperatureMin) {
			temperatureMin = t.celsius
		}
		if (temperatureMax == null || t.celsius > temperatureMax) {
			temperatureMax = t.celsius
		}
	}

	return {
		periodStart: input.periodStart,
		periodEnd: input.periodEnd,
		temperatures,
		temperatureMin,
		temperatureMax,
		symptoms,
		medicines,
		doctorVisits,
		notes: input.notes ?? [],
	}
}

function inPeriod (
	date: DateOnly,
	start: DateOnly,
	end: DateOnly,
): boolean {
	return date >= start && date <= end
}
