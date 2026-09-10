/**
 * Smart Today — one local, non-diagnostic hint from the child's own history.
 * No ML/AI, no medical advice, no exact predictions.
 */

import {
	formatWakeWindowGuideLabel,
	selectWakeWindowGuide,
} from './wakeWindowGuide'
import {
	collectValidWakeIntervals,
	MAX_WAKE_WINDOW_MS,
	percentileMs,
} from './wakeWindowStats'
import type { FeedingEvent } from '../models/feeding'
import type { SleepEvent } from '../models/sleep'
import type { Child } from '../models/types'
import { formatDurationMs } from '../utils/durationFormat'
import { parseOffsetDateTime, toLocalDateOnly } from '../utils/datetime'

/** Minimum valid wake gaps for a personal ВБ hint. */
export const MIN_PERSONAL_WAKE_SAMPLES = 5

/** Or at least this many distinct local days contributing finished sleeps. */
export const MIN_PERSONAL_WAKE_DAYS = 3

/** Minimum valid feeding gaps for a personal interval hint. */
export const MIN_PERSONAL_FEEDING_SAMPLES = 5

export type SmartTodayHintKind =
	| 'wake_personal'
	| 'wake_age_guide'
	| 'feeding_interval'
	| 'day_pattern'

export type SmartTodayConfidence = 'high' | 'medium' | 'low'

export interface SmartTodayHint {
	kind: SmartTodayHintKind
	title: string
	body: string
	confidence: SmartTodayConfidence
}

export interface SmartTodayInput {
	child: Pick<Child, 'id' | 'name' | 'birthDate'>
	activeSleep: SleepEvent | null
	activeBreastfeeding: FeedingEvent | null
	/** Last finished sleep (wake anchor). */
	lastFinishedSleep: SleepEvent | null
	/** Sleeps overlapping the recent lookback (e.g. 7 days). */
	recentSleeps: readonly SleepEvent[]
	/** Recent feedings for interval history (exclude water-only gaps). */
	recentFeedings: readonly FeedingEvent[]
	latestFeeding: FeedingEvent | null
	nowMs?: number
	asOfDate?: string
}

/**
 * Build at most one Smart Today hint.
 * Priority: suppress if active sleep/BF → wake → feeding → optional pattern.
 */
export function buildSmartTodayHint (
	input: SmartTodayInput,
): SmartTodayHint | null {
	const nowMs = input.nowMs ?? Date.now()
	const asOfDate = input.asOfDate ?? toLocalDateOnly(new Date(nowMs))

	// Active sessions: no Smart hint (timers already dominate Today).
	if (input.activeSleep != null || input.activeBreastfeeding != null) {
		return null
	}

	const wakeHint = buildWakeHint(input, nowMs, asOfDate)
	if (wakeHint) {
		return wakeHint
	}

	const feedingHint = buildFeedingHint(input, nowMs)
	if (feedingHint) {
		return feedingHint
	}

	return null
}

function buildWakeHint (
	input: SmartTodayInput,
	nowMs: number,
	asOfDate: string,
): SmartTodayHint | null {
	if (!input.lastFinishedSleep?.endAt) {
		return null
	}
	const wakeMs = Math.max(
		0,
		nowMs - parseOffsetDateTime(input.lastFinishedSleep.endAt).getTime(),
	)
	if (wakeMs <= 0) {
		return null
	}

	const intervals = collectValidWakeIntervals(
		input.recentSleeps,
		MAX_WAKE_WINDOW_MS,
	)
	const daysWithFinished = countFinishedSleepDays(input.recentSleeps)
	const hasPersonal =
		intervals.length >= MIN_PERSONAL_WAKE_SAMPLES ||
		(intervals.length >= 3 && daysWithFinished >= MIN_PERSONAL_WAKE_DAYS)

	if (hasPersonal) {
		const low = percentileMs(intervals, 0.25)
		const high = percentileMs(intervals, 0.75)
		if (low != null && high != null) {
			const range =
				low === high
					? formatDurationMs(low)
					: `${formatDurationMs(low)}–${formatDurationMs(high)}`
			return {
				kind: 'wake_personal',
				title: `Бодрствует ${formatDurationMs(wakeMs)}`,
				body: `В последние дни малыш обычно засыпал после ${range} бодрствования.`,
				confidence:
					intervals.length >= MIN_PERSONAL_WAKE_SAMPLES
						? 'high'
						: 'medium',
			}
		}
	}

	const guide = selectWakeWindowGuide(input.child.birthDate, asOfDate)
	if (guide) {
		return {
			kind: 'wake_age_guide',
			title: `Бодрствует ${formatDurationMs(wakeMs)}`,
			body: formatWakeWindowGuideLabel(guide),
			confidence: 'low',
		}
	}
	return null
}

function buildFeedingHint (
	input: SmartTodayInput,
	nowMs: number,
): SmartTodayHint | null {
	if (!input.latestFeeding) {
		return null
	}
	const sinceMs = Math.max(
		0,
		nowMs - parseOffsetDateTime(input.latestFeeding.startAt).getTime(),
	)
	const intervals = collectValidFeedingIntervals(
		input.recentFeedings,
		MAX_WAKE_WINDOW_MS,
	)
	if (intervals.length < MIN_PERSONAL_FEEDING_SAMPLES) {
		// Neutral elapsed time only when we have something useful to say historically.
		return null
	}
	const low = percentileMs(intervals, 0.25)
	const high = percentileMs(intervals, 0.75)
	if (low == null || high == null) {
		return null
	}
	const range =
		low === high
			? formatDurationMs(low)
			: `${formatDurationMs(low)}–${formatDurationMs(high)}`
	return {
		kind: 'feeding_interval',
		title: `Последнее кормление ${formatDurationMs(sinceMs)} назад`,
		body: `За последние 7 дней промежуток между кормлениями обычно был ${range}.`,
		confidence: 'medium',
	}
}

/**
 * Gaps between milk/solid feedings (water excluded from chain endpoints).
 * Reuses the same max-gap outlier guard as wake windows.
 */
export function collectValidFeedingIntervals (
	feedings: readonly FeedingEvent[],
	maxGapMs: number = MAX_WAKE_WINDOW_MS,
): number[] {
	const ordered = feedings
		.filter((f) => f.type !== 'water' && f.type !== 'pumping')
		.map((f) => parseOffsetDateTime(f.startAt).getTime())
		.sort((a, b) => a - b)

	const intervals: number[] = []
	for (let i = 0; i < ordered.length - 1; i += 1) {
		const gap = ordered[i + 1]! - ordered[i]!
		if (gap <= 0 || gap > maxGapMs) {
			continue
		}
		intervals.push(gap)
	}
	return intervals
}

function countFinishedSleepDays (sleeps: readonly SleepEvent[]): number {
	const days = new Set<string>()
	for (const s of sleeps) {
		if (s.endAt != null) {
			days.add(s.startLocalDate)
		}
	}
	return days.size
}
