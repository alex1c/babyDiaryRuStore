/**
 * Average wake-window (ВБ) between finished sleeps.
 * Only valid gaps: positive, under maxGapMs (missing-data guard).
 */

import type { SleepEvent } from '../models/sleep'
import { parseOffsetDateTime } from '../utils/datetime'

/** Discard gaps longer than this — likely missing sleep records. */
export const MAX_WAKE_WINDOW_MS = 8 * 60 * 60 * 1000

export interface WakeWindowStats {
	averageMs: number | null
	sampleCount: number
	intervalsMs: number[]
}

/**
 * Collect valid wake gaps (finished sleep end → next sleep start).
 * Shared by statistics and Smart Today outlier filtering.
 */
export function collectValidWakeIntervals (
	sleeps: readonly SleepEvent[],
	maxGapMs: number = MAX_WAKE_WINDOW_MS,
): number[] {
	const finished = sleeps
		.filter((s) => s.endAt != null)
		.map((s) => ({
			startMs: parseOffsetDateTime(s.startAt).getTime(),
			endMs: parseOffsetDateTime(s.endAt!).getTime(),
		}))
		.filter((s) => s.endMs >= s.startMs)
		.sort((a, b) => a.endMs - b.endMs)

	const intervalsMs: number[] = []
	for (let i = 0; i < finished.length - 1; i += 1) {
		const prev = finished[i]!
		const next = finished[i + 1]!
		const gap = next.startMs - prev.endMs
		if (gap <= 0) {
			continue
		}
		if (gap > maxGapMs) {
			continue
		}
		intervalsMs.push(gap)
	}
	return intervalsMs
}

/**
 * Average ВБ from end of finished sleep → start of next sleep.
 * Active (open-ended) sleeps are ignored as interval endpoints.
 * Does not invent wake time before the first sleep of the day.
 */
export function computeAverageWakeWindow (
	sleeps: readonly SleepEvent[],
	maxGapMs: number = MAX_WAKE_WINDOW_MS,
): WakeWindowStats {
	const intervalsMs = collectValidWakeIntervals(sleeps, maxGapMs)
	if (intervalsMs.length === 0) {
		return { averageMs: null, sampleCount: 0, intervalsMs: [] }
	}
	const sum = intervalsMs.reduce((a, b) => a + b, 0)
	return {
		averageMs: Math.round(sum / intervalsMs.length),
		sampleCount: intervalsMs.length,
		intervalsMs,
	}
}

/** Inclusive percentile from a sorted copy (p in 0..1). */
export function percentileMs (
	values: readonly number[],
	p: number,
): number | null {
	if (values.length === 0) {
		return null
	}
	const sorted = [...values].sort((a, b) => a - b)
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.round(p * (sorted.length - 1))),
	)
	return sorted[idx] ?? null
}
