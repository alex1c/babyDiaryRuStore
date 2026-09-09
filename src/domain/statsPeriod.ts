/**
 * Statistics period boundaries (local civil dates).
 */

import type { DateOnly } from '../models/types'
import { toLocalDateOnly } from '../utils/datetime'

/** Statistics chips use 7/30/90/all; reports may also use today/custom. */
export type StatsPeriodKind = '7' | '30' | '90' | 'all' | 'today' | 'custom'

export interface StatsPeriod {
	kind: StatsPeriodKind
	startDate: DateOnly
	endDate: DateOnly
	/** Inclusive calendar day count. */
	dayCount: number
}

/**
 * Resolve inclusive [startDate, endDate] relative to today (local).
 * For `all`, pass earliest known activity date (or today if none).
 */
export function resolveStatsPeriod (
	kind: StatsPeriodKind,
	today: DateOnly = toLocalDateOnly(),
	earliestDate: DateOnly | null = null,
): StatsPeriod {
	if (kind === 'today') {
		return {
			kind,
			startDate: today,
			endDate: today,
			dayCount: 1,
		}
	}
	if (kind === 'custom') {
		throw new Error('Use resolveReportPeriod for custom ranges')
	}
	if (kind === 'all') {
		const startDate = earliestDate && earliestDate < today ? earliestDate : today
		return {
			kind,
			startDate,
			endDate: today,
			dayCount: inclusiveDayCount(startDate, today),
		}
	}
	const days = kind === '7' ? 7 : kind === '30' ? 30 : 90
	const startDate = addLocalDays(today, -(days - 1))
	return {
		kind,
		startDate,
		endDate: today,
		dayCount: days,
	}
}

/** Inclusive list of YYYY-MM-DD from start through end. */
export function enumerateLocalDates (
	startDate: DateOnly,
	endDate: DateOnly,
): DateOnly[] {
	const out: DateOnly[] = []
	let cursor = startDate
	while (cursor <= endDate) {
		out.push(cursor)
		cursor = addLocalDays(cursor, 1)
	}
	return out
}

export function inclusiveDayCount (
	startDate: DateOnly,
	endDate: DateOnly,
): number {
	return enumerateLocalDates(startDate, endDate).length
}

export function addLocalDays (dateOnly: DateOnly, delta: number): DateOnly {
	const [ys, ms, ds] = dateOnly.split('-').map(Number)
	const dt = new Date(ys ?? 0, (ms ?? 1) - 1, (ds ?? 1) + delta, 12, 0, 0, 0)
	const y = dt.getFullYear()
	const m = String(dt.getMonth() + 1).padStart(2, '0')
	const d = String(dt.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

export function statsPeriodLabel (kind: StatsPeriodKind): string {
	switch (kind) {
		case '7':
			return '7 дней'
		case '30':
			return '30 дней'
		case '90':
			return '90 дней'
		case 'all':
			return 'Всё'
		case 'today':
			return 'Сегодня'
		case 'custom':
			return 'Свой период'
	}
}
