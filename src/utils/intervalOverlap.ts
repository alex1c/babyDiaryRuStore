/**
 * Interval overlap helpers for sleep × local-day aggregation.
 * Local day bounds are civil midnight→midnight in the runtime timezone.
 */

import type { DateOnly, OffsetDateTime } from '../models/types'
import {
	isValidDateOnly,
	parseOffsetDateTime,
	toOffsetDateTime,
} from './datetime'

export interface TimeInterval {
	startMs: number
	/** Exclusive end; use Infinity for open-ended (active) intervals. */
	endMs: number
}

/**
 * Local civil day [00:00:00, nextDay 00:00:00) as epoch ms.
 * Uses Date(y, m-1, d) so DST transitions stay wall-clock correct.
 */
export function localDayBoundsMs (localDate: DateOnly): TimeInterval {
	if (!isValidDateOnly(localDate)) {
		throw new Error(`Invalid local date: ${localDate}`)
	}
	const parts = localDate.split('-').map(Number)
	const y = parts[0]!
	const m = parts[1]!
	const d = parts[2]!
	const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
	const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime()
	return { startMs: start, endMs: end }
}

export function sleepIntervalMs (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null,
	nowMs: number = Date.now(),
): TimeInterval {
	const startMs = parseOffsetDateTime(startAt).getTime()
	const endMs = endAt == null ? nowMs : parseOffsetDateTime(endAt).getTime()
	if (endMs < startMs) {
		throw new Error('Sleep end is before start')
	}
	return { startMs, endMs }
}

/**
 * Milliseconds of overlap between two half-open intervals [start, end).
 * Returns 0 when they do not overlap.
 */
export function overlapMs (a: TimeInterval, b: TimeInterval): number {
	const start = Math.max(a.startMs, b.startMs)
	const end = Math.min(a.endMs, b.endMs)
	return Math.max(0, end - start)
}

/**
 * How much of a sleep interval falls inside a local civil day.
 * Active sleeps use `nowMs` as the provisional end.
 */
export function sleepOverlapWithLocalDayMs (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null,
	localDate: DateOnly,
	nowMs: number = Date.now(),
): number {
	return overlapMs(
		sleepIntervalMs(startAt, endAt, nowMs),
		localDayBoundsMs(localDate),
	)
}

/** True if sleep interval intersects the local day at all. */
export function sleepOverlapsLocalDay (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null,
	localDate: DateOnly,
	nowMs: number = Date.now(),
): boolean {
	return sleepOverlapWithLocalDayMs(startAt, endAt, localDate, nowMs) > 0
}

/**
 * Combine civil date + HH:MM into OffsetDateTime in the runtime timezone.
 */
export function combineLocalDateAndTime (
	localDate: DateOnly,
	timeHm: string,
): OffsetDateTime {
	if (!isValidDateOnly(localDate)) {
		throw new Error(`Invalid local date: ${localDate}`)
	}
	if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeHm)) {
		throw new Error(`Invalid time: ${timeHm}`)
	}
	const dateParts = localDate.split('-').map(Number)
	const timeParts = timeHm.split(':').map(Number)
	const y = dateParts[0]!
	const mo = dateParts[1]!
	const d = dateParts[2]!
	const h = timeParts[0]!
	const mi = timeParts[1]!
	return toOffsetDateTime(new Date(y, mo - 1, d, h, mi, 0, 0))
}

/**
 * Build end datetime for manual sleep: if end clock is before/equal start clock
 * on the same form date, roll end to the next civil day (overnight sleep).
 */
export function resolveManualSleepEnd (
	startLocalDate: DateOnly,
	startHm: string,
	endHm: string,
	endLocalDate?: DateOnly | null,
): { endAt: OffsetDateTime; endLocalDate: DateOnly } {
	const startAt = combineLocalDateAndTime(startLocalDate, startHm)
	if (endLocalDate) {
		const endAt = combineLocalDateAndTime(endLocalDate, endHm)
		return { endAt, endLocalDate }
	}
	let endDate = startLocalDate
	let endAt = combineLocalDateAndTime(endDate, endHm)
	if (parseOffsetDateTime(endAt).getTime() <= parseOffsetDateTime(startAt).getTime()) {
		const parts = startLocalDate.split('-').map(Number)
		const rolled = new Date(parts[0]!, parts[1]! - 1, parts[2]! + 1, 12, 0, 0, 0)
		const y = rolled.getFullYear()
		const m = String(rolled.getMonth() + 1).padStart(2, '0')
		const d = String(rolled.getDate()).padStart(2, '0')
		endDate = `${y}-${m}-${d}`
		endAt = combineLocalDateAndTime(endDate, endHm)
	}
	return { endAt, endLocalDate: endDate }
}
