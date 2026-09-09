/**
 * Breastfeeding side duration math from SQLite timestamps.
 */

import type { BreastfeedingEvent, BreastSide } from '../models/feeding'
import { parseOffsetDateTime } from '../utils/datetime'

export interface BreastfeedingLiveTotals {
	leftSeconds: number
	rightSeconds: number
	totalSeconds: number
	activeSide: BreastSide | null
}

/**
 * Live totals: stored side seconds + active segment (now − sideStartedAt).
 */
export function breastfeedingLiveTotals (
	event: BreastfeedingEvent,
	nowMs: number = Date.now(),
): BreastfeedingLiveTotals {
	let left = event.leftDurationSeconds
	let right = event.rightDurationSeconds
	let activeSide: BreastSide | null = null

	if (event.endAt == null && event.sideStartedAt != null) {
		const segment = Math.max(
			0,
			Math.floor(
				(nowMs - parseOffsetDateTime(event.sideStartedAt).getTime()) / 1000,
			),
		)
		activeSide = event.lastSide
		if (event.lastSide === 'left') {
			left += segment
		} else {
			right += segment
		}
	}

	return {
		leftSeconds: left,
		rightSeconds: right,
		totalSeconds: left + right,
		activeSide,
	}
}

/** Apply a completed side segment into accumulated counters. */
export function addSideSegment (
	leftSeconds: number,
	rightSeconds: number,
	side: BreastSide,
	segmentSeconds: number,
): { leftDurationSeconds: number; rightDurationSeconds: number } {
	const safe = Math.max(0, Math.floor(segmentSeconds))
	if (side === 'left') {
		return {
			leftDurationSeconds: leftSeconds + safe,
			rightDurationSeconds: rightSeconds,
		}
	}
	return {
		leftDurationSeconds: leftSeconds,
		rightDurationSeconds: rightSeconds + safe,
	}
}
