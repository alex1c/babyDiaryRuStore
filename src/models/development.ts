/**
 * Milestone, tooth, and moment domain types.
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

export const MILESTONE_TYPES = [
	'first_smile',
	'rolled_over',
	'sat_up',
	'crawled',
	'stood_up',
	'first_step',
	'first_word',
	'first_tooth',
	'first_laugh',
	'other',
] as const

export type MilestoneType = (typeof MILESTONE_TYPES)[number]

export interface MilestoneEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	startLocalDate: DateOnly
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	milestoneType: MilestoneType
	title: string
	photoUri: string | null
	linkedMomentId: string | null
}

export const TOOTH_KEYS = [
	'lower_central_left',
	'lower_central_right',
	'upper_central_left',
	'upper_central_right',
	'lower_lateral_left',
	'lower_lateral_right',
	'upper_lateral_left',
	'upper_lateral_right',
	'lower_canine_left',
	'lower_canine_right',
	'upper_canine_left',
	'upper_canine_right',
	'lower_first_molar_left',
	'lower_first_molar_right',
	'upper_first_molar_left',
	'upper_first_molar_right',
	'lower_second_molar_left',
	'lower_second_molar_right',
	'upper_second_molar_left',
	'upper_second_molar_right',
] as const

export type ToothKey = (typeof TOOTH_KEYS)[number]

export interface ToothRecord {
	id: string
	childId: string
	toothKey: ToothKey
	eruptedAt: DateOnly
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface MomentRecord {
	id: string
	childId: string
	photoUri: string
	takenAt: OffsetDateTime
	takenLocalDate: DateOnly
	title: string | null
	notes: string | null
	milestoneEventId: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface MonthPhotoSelection {
	id: string
	childId: string
	monthKey: string
	momentId: string
	createdAt: UtcInstant
	updatedAt: UtcInstant
}
