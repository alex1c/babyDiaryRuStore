/**
 * Duration formatting for sleep / wake UI.
 */

import type { OffsetDateTime } from '../models/types'
import { parseOffsetDateTime } from './datetime'

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

/**
 * Aggregate-friendly duration: «42 мин», «1 ч 05 мин», «8 ч 12 мин».
 * No fractional seconds/minutes.
 */
export function formatDurationMs (ms: number): string {
	if (ms < 0) {
		throw new Error('Negative duration')
	}
	const totalMinutes = Math.floor(ms / 60_000)
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	if (hours <= 0) {
		return `${minutes} мин`
	}
	return `${hours} ч ${pad2(minutes)} мин`
}

/**
 * Live timer display HH:MM:SS from startedAt → now.
 * Always derived from timestamps — never from accumulated React ticks.
 */
export function formatElapsedHms (
	startAt: OffsetDateTime,
	nowMs: number = Date.now(),
): string {
	const startMs = parseOffsetDateTime(startAt).getTime()
	const elapsed = Math.max(0, nowMs - startMs)
	const totalSeconds = Math.floor(elapsed / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

export function durationBetweenMs (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null,
	nowMs: number = Date.now(),
): number {
	const startMs = parseOffsetDateTime(startAt).getTime()
	const endMs = endAt == null ? nowMs : parseOffsetDateTime(endAt).getTime()
	if (endMs < startMs) {
		throw new Error('End is before start')
	}
	return endMs - startMs
}
