/**
 * Sleep validation — overlaps, timing, absurdly short entries.
 */

import type { SleepEvent } from '../models/sleep'
import type { OffsetDateTime } from '../models/types'
import { parseOffsetDateTime } from '../utils/datetime'
import { sleepIntervalMs } from '../utils/intervalOverlap'

const MIN_SLEEP_MS = 60_000 // 1 minute — warn/reject empty taps
const MAX_FUTURE_START_MS = 5 * 60_000 // allow tiny clock skew

export class SleepValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'SleepValidationError'
	}
}

export function assertSleepTiming (
	startAt: OffsetDateTime,
	endAt: OffsetDateTime | null,
	nowMs: number = Date.now(),
): void {
	const startMs = parseOffsetDateTime(startAt).getTime()
	if (startMs - nowMs > MAX_FUTURE_START_MS) {
		throw new SleepValidationError('Начало сна не может быть в будущем')
	}
	if (endAt != null) {
		const endMs = parseOffsetDateTime(endAt).getTime()
		if (endMs < startMs) {
			throw new SleepValidationError('Окончание сна раньше начала')
		}
		if (endMs - startMs < MIN_SLEEP_MS) {
			throw new SleepValidationError(
				'Сон слишком короткий — проверьте время начала и окончания',
			)
		}
		if (endMs - nowMs > MAX_FUTURE_START_MS) {
			throw new SleepValidationError('Окончание сна не может быть в будущем')
		}
	}
}

/**
 * True when two sleep intervals overlap in time (touching endpoints OK).
 */
export function sleepsOverlap (
	aStart: OffsetDateTime,
	aEnd: OffsetDateTime | null,
	bStart: OffsetDateTime,
	bEnd: OffsetDateTime | null,
	nowMs: number = Date.now(),
): boolean {
	const a = sleepIntervalMs(aStart, aEnd, nowMs)
	const b = sleepIntervalMs(bStart, bEnd, nowMs)
	// Half-open: touching at endpoint is NOT an overlap.
	return a.startMs < b.endMs && b.startMs < a.endMs
}

export function assertNoOverlapWithExisting (
	candidateStart: OffsetDateTime,
	candidateEnd: OffsetDateTime | null,
	existing: readonly SleepEvent[],
	excludeEventId?: string,
	nowMs: number = Date.now(),
): void {
	for (const sleep of existing) {
		if (excludeEventId && sleep.id === excludeEventId) {
			continue
		}
		if (
			sleepsOverlap(
				candidateStart,
				candidateEnd,
				sleep.startAt,
				sleep.endAt,
				nowMs,
			)
		) {
			throw new SleepValidationError(
				'Этот период пересекается с другой записью сна',
			)
		}
	}
}

export function assertSingleActive (
	existingActive: SleepEvent | null,
	excludeEventId?: string,
): void {
	if (
		existingActive &&
		existingActive.id !== excludeEventId &&
		existingActive.endAt == null
	) {
		throw new SleepValidationError(
			'Уже есть активный сон. Сначала завершите его.',
		)
	}
}
