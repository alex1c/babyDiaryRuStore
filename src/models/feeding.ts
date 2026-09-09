/**
 * Feeding domain types (breastfeeding, bottle, pumping, water, solid_food).
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

export type BreastSide = 'left' | 'right'

export type BottleContent = 'expressed_milk' | 'formula'

export type SolidReaction =
	| 'liked'
	| 'neutral'
	| 'disliked'
	| 'possible_reaction'

/** Detail discriminant stored in event_feeding.feeding_kind. */
export type FeedingKind =
	| 'breastfeeding'
	| 'expressed_milk'
	| 'formula'
	| 'pumping'
	| 'water'
	| 'solid_food'

export const FEEDING_EVENT_TYPES = [
	'breastfeeding',
	'bottle',
	'pumping',
	'water',
	'solid_food',
] as const

export type FeedingEventType = (typeof FEEDING_EVENT_TYPES)[number]

export function isFeedingEventType (value: string): value is FeedingEventType {
	return (FEEDING_EVENT_TYPES as readonly string[]).includes(value)
}

export interface FeedingBase {
	id: string
	childId: string
	type: FeedingEventType
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	feedingKind: FeedingKind
}

export interface BreastfeedingEvent extends FeedingBase {
	type: 'breastfeeding'
	feedingKind: 'breastfeeding'
	leftDurationSeconds: number
	rightDurationSeconds: number
	initialSide: BreastSide
	lastSide: BreastSide
	/** When the current side segment started (active session only). */
	sideStartedAt: OffsetDateTime | null
}

export interface BottleEvent extends FeedingBase {
	type: 'bottle'
	feedingKind: 'expressed_milk' | 'formula'
	amountMl: number
}

export interface PumpingEvent extends FeedingBase {
	type: 'pumping'
	feedingKind: 'pumping'
	side: BreastSide | 'both' | null
	durationSeconds: number | null
	amountMl: number | null
}

export interface WaterEvent extends FeedingBase {
	type: 'water'
	feedingKind: 'water'
	amountMl: number
}

export interface SolidFoodEvent extends FeedingBase {
	type: 'solid_food'
	feedingKind: 'solid_food'
	foodName: string
	amountText: string | null
	reaction: SolidReaction | null
}

export type FeedingEvent =
	| BreastfeedingEvent
	| BottleEvent
	| PumpingEvent
	| WaterEvent
	| SolidFoodEvent

export interface StartBreastfeedingInput {
	childId: string
	side: BreastSide
	startedAt?: OffsetDateTime
	notes?: string | null
}

export interface ManualBreastfeedingInput {
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime
	leftDurationSeconds: number
	rightDurationSeconds: number
	initialSide?: BreastSide
	notes?: string | null
}

export interface CreateBottleInput {
	childId: string
	content: BottleContent
	amountMl: number
	occurredAt?: OffsetDateTime
	notes?: string | null
}

export interface CreatePumpingInput {
	childId: string
	occurredAt?: OffsetDateTime
	endAt?: OffsetDateTime | null
	side?: BreastSide | 'both' | null
	durationSeconds?: number | null
	amountMl?: number | null
	notes?: string | null
}

export interface CreateWaterInput {
	childId: string
	amountMl: number
	occurredAt?: OffsetDateTime
	notes?: string | null
}

export interface CreateSolidInput {
	childId: string
	foodName: string
	amountText?: string | null
	reaction?: SolidReaction | null
	occurredAt?: OffsetDateTime
	notes?: string | null
}
