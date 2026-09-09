/**
 * Relative date labels for growth measurements (Russian).
 */

import type { DateOnly } from '../models/types'
import { toLocalDateOnly } from '../utils/datetime'
import { formatCountRu } from '../utils/pluralRu'

/**
 * «Сегодня» / «Вчера» / «N дней назад» / date fallback.
 * Uses civil calendar day difference (not hours/24).
 */
export function formatMeasuredAgo (
	measuredLocalDate: DateOnly,
	asOf: DateOnly = toLocalDateOnly(),
): string {
	const days = civilDayDiff(measuredLocalDate, asOf)
	if (days === 0) {
		return 'Сегодня'
	}
	if (days === 1) {
		return 'Вчера'
	}
	if (days > 1 && days < 60) {
		return `${formatCountRu(days, 'день', 'дня', 'дней')} назад`
	}
	return formatRuLongDate(measuredLocalDate)
}

export function formatRuLongDate (dateOnly: DateOnly): string {
	const [, ms, ds] = dateOnly.split('-').map(Number)
	const months = [
		'января',
		'февраля',
		'марта',
		'апреля',
		'мая',
		'июня',
		'июля',
		'августа',
		'сентября',
		'октября',
		'ноября',
		'декабря',
	]
	const m = months[(ms ?? 1) - 1] ?? ''
	return `${ds ?? 1} ${m}`
}

function civilDayDiff (from: DateOnly, to: DateOnly): number {
	const a = from.split('-').map(Number)
	const b = to.split('-').map(Number)
	const fromDate = new Date(a[0] ?? 0, (a[1] ?? 1) - 1, a[2] ?? 1, 12, 0, 0, 0)
	const toDate = new Date(b[0] ?? 0, (b[1] ?? 1) - 1, b[2] ?? 1, 12, 0, 0, 0)
	return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}
