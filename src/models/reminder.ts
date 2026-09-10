/**
 * Reminder domain model (local notifications, user-managed).
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

export const REMINDER_TYPES = [
	'feeding',
	'medicine',
	'vitamin',
	'measurement',
	'doctor',
	'custom',
	'no_feeding',
] as const

export type ReminderType = (typeof REMINDER_TYPES)[number]

export const REMINDER_SCHEDULE_TYPES = [
	'once',
	'daily',
	'weekly',
	'interval_hours',
] as const

export type ReminderScheduleType = (typeof REMINDER_SCHEDULE_TYPES)[number]

/** ISO weekday: 1 = Monday … 7 = Sunday (matches expo-notifications weekly). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Reminder {
	id: string
	childId: string
	type: ReminderType
	title: string
	enabled: boolean
	scheduleType: ReminderScheduleType
	/** Local wall-clock HH:MM for daily/weekly. */
	timeLocal: string | null
	daysOfWeek: Weekday[] | null
	/** Absolute fire time for once / next interval fire. */
	fireAt: OffsetDateTime | null
	/** For no_feeding: hours since last feeding. */
	intervalHours: number | null
	relatedEntityId: string | null
	platformNotificationId: string | null
	notes: string | null
	/** Optional dose text shown as user-saved detail (not a medical order). */
	doseText: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CreateReminderInput {
	childId: string
	type: ReminderType
	title: string
	enabled?: boolean
	scheduleType: ReminderScheduleType
	timeLocal?: string | null
	daysOfWeek?: Weekday[] | null
	fireAt?: OffsetDateTime | null
	intervalHours?: number | null
	relatedEntityId?: string | null
	notes?: string | null
	doseText?: string | null
}

export interface UpdateReminderInput {
	title?: string
	enabled?: boolean
	scheduleType?: ReminderScheduleType
	timeLocal?: string | null
	daysOfWeek?: Weekday[] | null
	fireAt?: OffsetDateTime | null
	intervalHours?: number | null
	relatedEntityId?: string | null
	notes?: string | null
	doseText?: string | null
	platformNotificationId?: string | null
}

export function isReminderType (value: string): value is ReminderType {
	return (REMINDER_TYPES as readonly string[]).includes(value)
}

export function isReminderScheduleType (
	value: string,
): value is ReminderScheduleType {
	return (REMINDER_SCHEDULE_TYPES as readonly string[]).includes(value)
}

export function parseDaysOfWeekJson (raw: string | null): Weekday[] | null {
	if (!raw) {
		return null
	}
	try {
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) {
			return null
		}
		const days = parsed.filter(
			(d): d is Weekday =>
				typeof d === 'number' && d >= 1 && d <= 7 && Number.isInteger(d),
		)
		return days.length > 0 ? days : null
	} catch {
		return null
	}
}

export function serializeDaysOfWeek (days: Weekday[] | null): string | null {
	if (!days || days.length === 0) {
		return null
	}
	return JSON.stringify([...new Set(days)].sort((a, b) => a - b))
}

/** Validate HH:MM 24h local time. */
export function isValidTimeLocal (value: string): boolean {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export type DateOnlyAlias = DateOnly
