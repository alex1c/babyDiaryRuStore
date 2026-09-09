/**
 * Health history filters + re-exports of shared timeline mappers.
 */

import type { TimelineRow } from './diaryTimeline'

export {
	doctorVisitToTimeline,
	healthMedicineRow,
	healthTemperatureRow,
	symptomToTimeline,
} from './healthTimelineMappers'

export type HealthHistoryFilter =
	| 'all'
	| 'temperature'
	| 'symptom'
	| 'medicine'
	| 'doctor'

export function matchesHealthHistoryFilter (
	row: TimelineRow,
	filter: HealthHistoryFilter,
): boolean {
	if (filter === 'all') {
		return true
	}
	if (filter === 'temperature') {
		return row.kind === 'temperature'
	}
	if (filter === 'symptom') {
		return row.kind === 'symptom'
	}
	if (filter === 'medicine') {
		return row.kind === 'medicine'
	}
	if (filter === 'doctor') {
		return row.kind === 'doctor'
	}
	return true
}
