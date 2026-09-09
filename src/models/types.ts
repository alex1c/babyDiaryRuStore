/**
 * Core domain types for Baby Diary.
 * Keep models lean — Phase 0 only needs multi-child + event foundations.
 */

/** Civil date YYYY-MM-DD in the user's local calendar. */
export type DateOnly = string

/** Absolute instant stored as ISO-8601 UTC (...Z). */
export type UtcInstant = string

/**
 * Wall-clock datetime with numeric offset, e.g. 2026-03-15T21:30:00+03:00.
 * Used for user-facing event times so midnight boundaries stay stable.
 */
export type OffsetDateTime = string

export type ChildSex = 'female' | 'male' | 'unknown'

/**
 * Registry of supported event kinds.
 * UI for most types arrives in later phases; the type system must not block them.
 */
export const EVENT_TYPES = [
	'sleep',
	'breastfeeding',
	'bottle',
	'pumping',
	'water',
	'solid_food',
	'diaper',
	'temperature',
	'medicine',
	'vitamin',
	'walk',
	'bath',
	'tummy_time',
	'massage',
	'doctor',
	'note',
	'custom',
	'milestone',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export function isEventType (value: string): value is EventType {
	return (EVENT_TYPES as readonly string[]).includes(value)
}

/** Theme preference persisted in app_settings. */
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Child {
	id: string
	name: string
	sex: ChildSex | null
	birthDate: DateOnly
	birthTime: string | null
	birthWeightGrams: number | null
	birthHeightCm: number | null
	/** File URI / path — never store image blobs in SQLite. */
	photoUri: string | null
	isActive: boolean
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CreateChildInput {
	name: string
	sex?: ChildSex | null
	birthDate: DateOnly
	birthTime?: string | null
	birthWeightGrams?: number | null
	birthHeightCm?: number | null
	photoUri?: string | null
	isActive?: boolean
}

export interface UpdateChildInput {
	name?: string
	sex?: ChildSex | null
	birthDate?: DateOnly
	birthTime?: string | null
	birthWeightGrams?: number | null
	birthHeightCm?: number | null
	photoUri?: string | null
	isActive?: boolean
}

/**
 * Base diary event.
 * startAt is always set; endAt is used for duration events (sleep, walk, etc.).
 * Local civil dates support day bucketing without UTC day-shift bugs.
 */
export interface DiaryEvent {
	id: string
	childId: string
	type: EventType
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	title: string | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CreateEventInput {
	childId: string
	type: EventType
	startAt: OffsetDateTime
	endAt?: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate?: DateOnly | null
	title?: string | null
	notes?: string | null
}

export interface UpdateEventInput {
	startAt?: OffsetDateTime
	endAt?: OffsetDateTime | null
	startLocalDate?: DateOnly
	endLocalDate?: DateOnly | null
	title?: string | null
	notes?: string | null
}

export interface AppSettings {
	themePreference: ThemePreference
	activeChildId: string | null
	onboardingCompleted: boolean
}
