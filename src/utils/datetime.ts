/**
 * Date/time helpers for the baby diary.
 *
 * Storage rules:
 * - Date-only fields (birthDate): YYYY-MM-DD
 * - Audit timestamps (createdAt): ISO-8601 UTC (...Z)
 * - User event times (startAt / endAt): ISO-8601 with numeric offset
 * - startLocalDate / endLocalDate: civil dates for day bucketing
 *
 * Business logic must never depend on bare "09:30" strings alone —
 * always pair wall-clock time with a civil date or full offset datetime.
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from '../models/types'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function nowUtcInstant (date: Date = new Date()): UtcInstant {
	return date.toISOString()
}

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

/** Format a Date as local YYYY-MM-DD using the runtime's local timezone. */
export function toLocalDateOnly (date: Date = new Date()): DateOnly {
	const y = date.getFullYear()
	const m = pad2(date.getMonth() + 1)
	const d = pad2(date.getDate())
	return `${y}-${m}-${d}`
}

/**
 * Format a Date as offset datetime in the runtime local timezone.
 * Example: 2024-05-30T21:15:00+03:00
 */
export function toOffsetDateTime (date: Date = new Date()): OffsetDateTime {
	const y = date.getFullYear()
	const mo = pad2(date.getMonth() + 1)
	const d = pad2(date.getDate())
	const h = pad2(date.getHours())
	const mi = pad2(date.getMinutes())
	const s = pad2(date.getSeconds())

	const offsetMinutes = -date.getTimezoneOffset()
	const sign = offsetMinutes >= 0 ? '+' : '-'
	const abs = Math.abs(offsetMinutes)
	const oh = pad2(Math.floor(abs / 60))
	const om = pad2(abs % 60)

	return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`
}

/**
 * Build event start fields from a local Date.
 * Guarantees startLocalDate matches the wall-clock civil date.
 */
export function buildEventStart (localDate: Date = new Date()): {
	startAt: OffsetDateTime
	startLocalDate: DateOnly
} {
	return {
		startAt: toOffsetDateTime(localDate),
		startLocalDate: toLocalDateOnly(localDate),
	}
}

/**
 * Build optional end fields for duration events (sleep crossing midnight, etc.).
 */
export function buildEventEnd (localDate: Date): {
	endAt: OffsetDateTime
	endLocalDate: DateOnly
} {
	return {
		endAt: toOffsetDateTime(localDate),
		endLocalDate: toLocalDateOnly(localDate),
	}
}

export function isValidDateOnly (value: string): boolean {
	if (!DATE_ONLY_RE.test(value)) {
		return false
	}
	const parts = value.split('-').map(Number)
	const y = parts[0]
	const m = parts[1]
	const d = parts[2]
	if (y == null || m == null || d == null) {
		return false
	}
	const dt = new Date(Date.UTC(y, m - 1, d))
	return (
		dt.getUTCFullYear() === y &&
		dt.getUTCMonth() === m - 1 &&
		dt.getUTCDate() === d
	)
}

/**
 * Extract civil date from an offset/local ISO-like string without converting
 * through UTC (avoids day shift near midnight).
 */
export function localDateFromOffsetDateTime (value: OffsetDateTime): DateOnly {
	const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
	if (!match?.[1]) {
		throw new Error(`Cannot extract local date from: ${value}`)
	}
	return match[1]
}

/**
 * Parse OffsetDateTime / ISO strings into a Date for duration math.
 * Accepts both "...Z" and "...±HH:MM" forms.
 */
export function parseOffsetDateTime (value: OffsetDateTime): Date {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Invalid offset datetime: ${value}`)
	}
	return parsed
}

/**
 * Duration in whole milliseconds between start and end.
 * Returns null when end is missing (ongoing event).
 * Negative spans throw — callers must swap or fix bad edits.
 */
export function durationMs (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null | undefined,
): number | null {
	if (endAt == null) {
		return null
	}
	const start = parseOffsetDateTime(startAt).getTime()
	const end = parseOffsetDateTime(endAt).getTime()
	if (end < start) {
		throw new Error('Event end is before start')
	}
	return end - start
}

/** Human-friendly duration label in Russian (minutes / hours). */
export function formatDurationMs (ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000)
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	if (hours <= 0) {
		return `${minutes} мин`
	}
	const mm = minutes.toString().padStart(2, '0')
	return `${hours} ч ${mm} мин`
}

/** Format offset datetime for local display HH:MM without UTC conversion. */
export function formatLocalTime (value: OffsetDateTime): string {
	const match = value.match(/T(\d{2}):(\d{2})/)
	if (!match?.[1] || !match[2]) {
		throw new Error(`Cannot extract time from: ${value}`)
	}
	return `${match[1]}:${match[2]}`
}

/** Compare two date-only strings chronologically. */
export function compareDateOnly (a: DateOnly, b: DateOnly): number {
	if (a === b) {
		return 0
	}
	return a < b ? -1 : 1
}
