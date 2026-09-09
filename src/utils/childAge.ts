/**
 * Infant-friendly age labels in Russian.
 * Uses civil calendar months (not ms / 30 days).
 */

import type { DateOnly } from '../models/types'
import { isValidDateOnly, toLocalDateOnly } from './datetime'
import { formatCountRu } from './pluralRu'

export interface AgeParts {
	years: number
	months: number
	days: number
	/** Whole days from birth civil date to asOf (0 = born today). */
	totalDays: number
}

interface CivilDate {
	y: number
	m: number
	d: number
}

function parseCivil (dateOnly: DateOnly): CivilDate {
	const parts = dateOnly.split('-').map(Number)
	const y = parts[0]
	const m = parts[1]
	const d = parts[2]
	if (y == null || m == null || d == null) {
		throw new Error(`Invalid date-only: ${dateOnly}`)
	}
	return { y, m, d }
}

function toDateOnly (civil: CivilDate): DateOnly {
	const m = civil.m.toString().padStart(2, '0')
	const d = civil.d.toString().padStart(2, '0')
	return `${civil.y}-${m}-${d}`
}

/** Days between two civil dates using local noon anchors (stable across DST). */
function civilDayDiff (from: DateOnly, to: DateOnly): number {
	const a = parseCivil(from)
	const b = parseCivil(to)
	const fromDate = new Date(a.y, a.m - 1, a.d, 12, 0, 0, 0)
	const toDate = new Date(b.y, b.m - 1, b.d, 12, 0, 0, 0)
	return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

/**
 * Add calendar months with day clamping (Jan 31 + 1 month → Feb 28/29).
 */
function addCalendarMonths (start: CivilDate, deltaMonths: number): CivilDate {
	const absolute = start.m - 1 + deltaMonths
	const y = start.y + Math.floor(absolute / 12)
	const monthIndex = ((absolute % 12) + 12) % 12
	const dim = new Date(y, monthIndex + 1, 0).getDate()
	return {
		y,
		m: monthIndex + 1,
		d: Math.min(start.d, dim),
	}
}

/**
 * Calendar-accurate age breakdown.
 * Throws if birthDate is invalid or in the future relative to asOf.
 */
export function calculateAgeParts (
	birthDate: DateOnly,
	asOf: DateOnly = toLocalDateOnly(),
): AgeParts {
	if (!isValidDateOnly(birthDate) || !isValidDateOnly(asOf)) {
		throw new Error('Invalid date for age calculation')
	}
	const totalDays = civilDayDiff(birthDate, asOf)
	if (totalDays < 0) {
		throw new Error('Birth date is in the future')
	}

	const birth = parseCivil(birthDate)
	const today = parseCivil(asOf)

	let years = today.y - birth.y
	let months = today.m - birth.m
	if (today.d < birth.d) {
		months -= 1
	}
	if (months < 0) {
		years -= 1
		months += 12
	}

	const anniversary = addCalendarMonths(birth, years * 12 + months)
	const days = civilDayDiff(toDateOnly(anniversary), asOf)

	return { years, months, days, totalDays }
}

/**
 * Human age string for the Today header.
 * Examples: «Сегодня родился», «3 дня», «2 недели 1 день», «1 месяц 5 дней»,
 * «1 год 2 месяца».
 */
export function formatChildAge (
	birthDate: DateOnly,
	asOf: DateOnly = toLocalDateOnly(),
): string {
	const age = calculateAgeParts(birthDate, asOf)

	if (age.totalDays === 0) {
		return 'Сегодня родился'
	}

	if (age.years >= 1) {
		const yearPart = formatCountRu(age.years, 'год', 'года', 'лет')
		if (age.months === 0) {
			return yearPart
		}
		return `${yearPart} ${formatCountRu(age.months, 'месяц', 'месяца', 'месяцев')}`
	}

	if (age.months >= 1) {
		const monthPart = formatCountRu(age.months, 'месяц', 'месяца', 'месяцев')
		if (age.days === 0) {
			return monthPart
		}
		return `${monthPart} ${formatCountRu(age.days, 'день', 'дня', 'дней')}`
	}

	// Under one calendar month: prefer weeks once we reach 7 days.
	if (age.totalDays < 7) {
		return formatCountRu(age.totalDays, 'день', 'дня', 'дней')
	}

	const weeks = Math.floor(age.totalDays / 7)
	const remDays = age.totalDays % 7
	const weekPart = formatCountRu(weeks, 'неделя', 'недели', 'недель')
	if (remDays === 0) {
		return weekPart
	}
	return `${weekPart} ${formatCountRu(remDays, 'день', 'дня', 'дней')}`
}
