/**
 * First-year book foundation — assemble monthly data without PDF.
 */

import type {
	MilestoneEvent,
	MomentRecord,
	MonthPhotoSelection,
	ToothRecord,
} from '../models/development'
import type { GrowthMeasurement } from '../models/growth'
import type { DateOnly } from '../models/types'
import { calculateAgeParts, formatChildAge } from '../utils/childAge'
import { isValidDateOnly } from '../utils/datetime'

export interface FirstYearMonthBundle {
	/** 1–12 calendar months of life (month 1 = birth month anniversary window). */
	monthIndex: number
	/** Inclusive civil start of this life-month window. */
	windowStart: DateOnly
	/** Inclusive civil end of this life-month window. */
	windowEnd: DateOnly
	measurements: GrowthMeasurement[]
	milestones: MilestoneEvent[]
	teeth: ToothRecord[]
	moments: MomentRecord[]
	monthPhoto: MomentRecord | null
	monthKey: string
}

export interface FirstYearFoundationInput {
	birthDate: DateOnly
	measurements: GrowthMeasurement[]
	milestones: MilestoneEvent[]
	teeth: ToothRecord[]
	moments: MomentRecord[]
	monthPhotos: MonthPhotoSelection[]
}

/**
 * Build 12 month buckets for the first year of life.
 * Month N covers [birth + (N-1) months, birth + N months - 1 day].
 */
export function buildFirstYearFoundation (
	input: FirstYearFoundationInput,
): FirstYearMonthBundle[] {
	if (!isValidDateOnly(input.birthDate)) {
		throw new Error('Invalid birth date')
	}

	const momentById = new Map(input.moments.map((m) => [m.id, m]))
	const monthPhotoByKey = new Map(
		input.monthPhotos.map((m) => [m.monthKey, m]),
	)

	const bundles: FirstYearMonthBundle[] = []
	for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
		const windowStart = addMonthsClamped(input.birthDate, monthIndex - 1)
		const nextStart = addMonthsClamped(input.birthDate, monthIndex)
		const windowEnd = addDays(nextStart, -1)
		const monthKey = firstYearMonthKey(input.birthDate, monthIndex)

		const measurements = input.measurements.filter((m) =>
			inInclusiveRange(m.measuredLocalDate, windowStart, windowEnd),
		)
		const milestones = input.milestones.filter((m) =>
			inInclusiveRange(m.startLocalDate, windowStart, windowEnd),
		)
		const teeth = input.teeth.filter((t) =>
			inInclusiveRange(t.eruptedAt, windowStart, windowEnd),
		)
		const moments = input.moments.filter((m) =>
			inInclusiveRange(m.takenLocalDate, windowStart, windowEnd),
		)

		const selection = monthPhotoByKey.get(monthKey)
		const monthPhoto = selection
			? momentById.get(selection.momentId) ?? null
			: null

		bundles.push({
			monthIndex,
			windowStart,
			windowEnd,
			measurements,
			milestones,
			teeth,
			moments,
			monthPhoto,
			monthKey,
		})
	}
	return bundles
}

/** Stable key for month-photo selection within the first year. */
export function firstYearMonthKey (
	birthDate: DateOnly,
	monthIndex: number,
): string {
	return `fy:${birthDate}:m${monthIndex}`
}

/** Calendar month key YYYY-MM for optional “photo of the month” by civil month. */
export function civilMonthKey (dateOnly: DateOnly): string {
	return dateOnly.slice(0, 7)
}

function inInclusiveRange (
	date: DateOnly,
	start: DateOnly,
	end: DateOnly,
): boolean {
	return date >= start && date <= end
}

function addMonthsClamped (dateOnly: DateOnly, deltaMonths: number): DateOnly {
	const [ys, ms, ds] = dateOnly.split('-').map(Number)
	const y0 = ys ?? 0
	const m0 = ms ?? 1
	const d0 = ds ?? 1
	const absolute = m0 - 1 + deltaMonths
	const y = y0 + Math.floor(absolute / 12)
	const monthIndex = ((absolute % 12) + 12) % 12
	const dim = new Date(y, monthIndex + 1, 0).getDate()
	const d = Math.min(d0, dim)
	return `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays (dateOnly: DateOnly, delta: number): DateOnly {
	const [ys, ms, ds] = dateOnly.split('-').map(Number)
	const dt = new Date(ys ?? 0, (ms ?? 1) - 1, (ds ?? 1) + delta, 12, 0, 0, 0)
	const y = dt.getFullYear()
	const m = String(dt.getMonth() + 1).padStart(2, '0')
	const d = String(dt.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

/** Age label at event date for milestone cards. */
export function ageAtDateLabel (
	birthDate: DateOnly,
	eventDate: DateOnly,
): string {
	try {
		const parts = calculateAgeParts(birthDate, eventDate)
		if (parts.totalDays === 0) {
			return 'В день рождения'
		}
		return formatChildAge(birthDate, eventDate)
	} catch {
		return ''
	}
}
