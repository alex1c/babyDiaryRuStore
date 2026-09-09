/**
 * Day/night sleep classification.
 * Conservative heuristic — never presented as medical truth.
 */

import type { OffsetDateTime } from '../models/types'
import type { ResolvedSleepType, SleepType } from '../models/sleep'
import { parseOffsetDateTime } from '../utils/datetime'

/**
 * Night window for auto classification: local 19:00–07:00.
 * Based on start time (explainable, editable by user).
 */
export function classifySleepTypeAuto (startAt: OffsetDateTime): ResolvedSleepType {
	const date = parseOffsetDateTime(startAt)
	const hour = date.getHours()
	if (hour >= 19 || hour < 7) {
		return 'night'
	}
	return 'day'
}

/** Resolve stored type to day/night for aggregation. */
export function resolveSleepType (
	sleepType: SleepType,
	startAt: OffsetDateTime,
): ResolvedSleepType {
	if (sleepType === 'day' || sleepType === 'night') {
		return sleepType
	}
	return classifySleepTypeAuto(startAt)
}

export function sleepTypeLabel (sleepType: SleepType): string {
	switch (sleepType) {
		case 'day':
			return 'Дневной'
		case 'night':
			return 'Ночной'
		case 'auto':
			return 'Авто'
	}
}
