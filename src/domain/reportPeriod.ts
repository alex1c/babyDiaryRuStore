/**
 * Report / share period presets (Today, 7/30/90, custom).
 * Reuses calendar-day math from statsPeriod.
 */

import type { DateOnly } from '../models/types'
import { toLocalDateOnly } from '../utils/datetime'
import { formatRuLongDate } from '../presentation/growthFormat'
import {
	addLocalDays,
	inclusiveDayCount,
	type StatsPeriod,
} from './statsPeriod'

export type ReportPeriodPreset = 'today' | '7' | '30' | '90' | 'custom'

export interface ReportPeriod {
	preset: ReportPeriodPreset
	startDate: DateOnly
	endDate: DateOnly
	dayCount: number
}

export interface CustomReportRange {
	startDate: DateOnly
	endDate: DateOnly
}

/**
 * Validate custom inclusive range: start <= end <= today.
 * Returns a Russian error message or null when valid.
 */
export function validateCustomReportRange (
	startDate: DateOnly,
	endDate: DateOnly,
	today: DateOnly = toLocalDateOnly(),
): string | null {
	if (startDate > endDate) {
		return 'Дата начала не может быть позже даты окончания'
	}
	if (endDate > today) {
		return 'Дата окончания не может быть позже сегодня'
	}
	return null
}

/**
 * Resolve inclusive report period relative to today (local).
 */
export function resolveReportPeriod (
	preset: ReportPeriodPreset,
	today: DateOnly = toLocalDateOnly(),
	custom: CustomReportRange | null = null,
): ReportPeriod {
	if (preset === 'today') {
		return {
			preset,
			startDate: today,
			endDate: today,
			dayCount: 1,
		}
	}
	if (preset === 'custom') {
		if (!custom) {
			throw new Error('Custom period requires start and end dates')
		}
		const err = validateCustomReportRange(
			custom.startDate,
			custom.endDate,
			today,
		)
		if (err) {
			throw new Error(err)
		}
		return {
			preset,
			startDate: custom.startDate,
			endDate: custom.endDate,
			dayCount: inclusiveDayCount(custom.startDate, custom.endDate),
		}
	}
	const days = preset === '7' ? 7 : preset === '30' ? 30 : 90
	const startDate = addLocalDays(today, -(days - 1))
	return {
		preset,
		startDate,
		endDate: today,
		dayCount: days,
	}
}

/** Map report period into StatsPeriod for buildPeriodReportData. */
export function reportPeriodToStatsPeriod (period: ReportPeriod): StatsPeriod {
	return {
		kind: period.preset,
		startDate: period.startDate,
		endDate: period.endDate,
		dayCount: period.dayCount,
	}
}

export function reportPeriodPresetLabel (preset: ReportPeriodPreset): string {
	switch (preset) {
		case 'today':
			return 'Сегодня'
		case '7':
			return '7 дней'
		case '30':
			return '30 дней'
		case '90':
			return '90 дней'
		case 'custom':
			return 'Свой период'
	}
}

/** Human period title for share / PDF cover. */
export function formatReportPeriodTitle (
	period: ReportPeriod,
	today: DateOnly = toLocalDateOnly(),
): string {
	if (period.startDate === period.endDate) {
		if (period.endDate === today) {
			return `Сегодня, ${formatRuLongDate(period.endDate)}`
		}
		return formatRuLongDateWithYear(period.endDate)
	}
	return `${formatRuLongDateWithYear(period.startDate)} — ${formatRuLongDateWithYear(period.endDate)}`
}

export function formatRuLongDateWithYear (dateOnly: DateOnly): string {
	const year = dateOnly.slice(0, 4)
	return `${formatRuLongDate(dateOnly)} ${year}`
}
