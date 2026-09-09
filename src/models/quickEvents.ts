/**
 * Quick everyday events: activities, temperature, medicine/vitamin, note, custom.
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

import type { TemperatureMethod } from './health'

export type ActivityEventType = 'walk' | 'bath' | 'tummy_time' | 'massage' | 'doctor'

export type MedicineKind = 'medicine' | 'vitamin'

export interface ActivityEvent {
	id: string
	childId: string
	type: ActivityEventType
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	place: string | null
	durationSeconds: number | null
}

export interface TemperatureEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	celsius: number
	method: TemperatureMethod
}

export interface MedicineEvent {
	id: string
	childId: string
	type: 'medicine' | 'vitamin'
	kind: MedicineKind
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	name: string
	doseText: string | null
	unit: string | null
	catalogId: string | null
}

export interface NoteEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	title: string | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CustomEventDefinition {
	id: string
	childId: string | null
	name: string
	iconKey: string | null
	colorToken: string | null
	isActive: boolean
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CustomEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	endAt: OffsetDateTime | null
	startLocalDate: DateOnly
	endLocalDate: DateOnly | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	definitionId: string | null
	definitionName: string | null
	definitionIconKey: string | null
	durationSeconds: number | null
}

export const ACTIVITY_TYPES: ActivityEventType[] = [
	'walk',
	'bath',
	'tummy_time',
	'massage',
	'doctor',
]

export function isActivityEventType (value: string): value is ActivityEventType {
	return (ACTIVITY_TYPES as readonly string[]).includes(value)
}

/** Small built-in icon keys for custom event definitions. */
export const CUSTOM_ICON_KEYS = [
	'star',
	'sun',
	'moon',
	'home',
	'car',
	'book',
	'music',
	'heart',
	'pool',
	'gym',
] as const

export type CustomIconKey = (typeof CUSTOM_ICON_KEYS)[number]
