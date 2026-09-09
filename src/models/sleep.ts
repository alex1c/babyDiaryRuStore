/**
 * Sleep domain types (events.type = 'sleep' + event_sleep detail).
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

export const SLEEP_TYPES = ['auto', 'day', 'night'] as const
export type SleepType = (typeof SLEEP_TYPES)[number]

export function isSleepType (value: string): value is SleepType {
	return (SLEEP_TYPES as readonly string[]).includes(value)
}

/** Resolved display type after applying auto heuristic. */
export type ResolvedSleepType = 'day' | 'night'

export interface SleepEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	sleepType: SleepType
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface StartSleepInput {
	childId: string
	startedAt?: OffsetDateTime
	sleepType?: SleepType
	notes?: string | null
}

export interface FinishSleepInput {
	eventId: string
	endedAt?: OffsetDateTime
}

export interface ManualSleepInput {
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime
	sleepType: SleepType
	notes?: string | null
}

export interface UpdateSleepInput {
	startAt?: OffsetDateTime
	endAt?: OffsetDateTime | null
	sleepType?: SleepType
	notes?: string | null
}
