/**
 * Daily sleep aggregates with local-day interval slicing.
 */

import { resolveSleepType } from './sleepType'
import type { SleepEvent } from '../models/sleep'
import type { DateOnly } from '../models/types'
import { formatDurationMs } from '../utils/durationFormat'
import { sleepOverlapWithLocalDayMs } from '../utils/intervalOverlap'

export interface DailySleepAggregate {
	localDate: DateOnly
	totalMs: number
	dayMs: number
	nightMs: number
	/** Finished sleeps that contributed >0 ms to this day (active counts if overlapping). */
	finishedCount: number
	includesActive: boolean
	totalLabel: string
	dayLabel: string
	nightLabel: string
}

export function aggregateSleepForLocalDay (
	sleeps: readonly SleepEvent[],
	localDate: DateOnly,
	nowMs: number = Date.now(),
): DailySleepAggregate {
	let totalMs = 0
	let dayMs = 0
	let nightMs = 0
	let finishedCount = 0
	let includesActive = false

	for (const sleep of sleeps) {
		const slice = sleepOverlapWithLocalDayMs(
			sleep.startAt,
			sleep.endAt,
			localDate,
			nowMs,
		)
		if (slice <= 0) {
			continue
		}
		totalMs += slice
		const resolved = resolveSleepType(sleep.sleepType, sleep.startAt)
		if (resolved === 'day') {
			dayMs += slice
		} else {
			nightMs += slice
		}
		if (sleep.endAt == null) {
			includesActive = true
		} else {
			finishedCount += 1
		}
	}

	return {
		localDate,
		totalMs,
		dayMs,
		nightMs,
		finishedCount,
		includesActive,
		totalLabel: formatDurationMs(totalMs),
		dayLabel: formatDurationMs(dayMs),
		nightLabel: formatDurationMs(nightMs),
	}
}
