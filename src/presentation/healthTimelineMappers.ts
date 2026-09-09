/**
 * Thin aliases so Health screens and Diary share one presentation path.
 */

import {
	doctorVisitToTimeline,
	medicineToTimeline,
	symptomToTimeline,
	temperatureToTimeline,
} from './diaryTimeline'

export const healthTemperatureRow = temperatureToTimeline
export const healthMedicineRow = medicineToTimeline
export { symptomToTimeline, doctorVisitToTimeline }
