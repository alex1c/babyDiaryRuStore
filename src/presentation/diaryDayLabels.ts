/**
 * Russian calendar day labels for Diary section headers / date navigator.
 */

import type { DateOnly } from '../models/types'
import { compareDateOnly, isValidDateOnly, toLocalDateOnly } from '../utils/datetime'

const WEEKDAYS = [
	'воскресенье',
	'понедельник',
	'вторник',
	'среда',
	'четверг',
	'пятница',
	'суббота',
] as const

const MONTHS_GENITIVE = [
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
] as const

function parseParts (localDate: DateOnly): { y: number; m: number; d: number } {
	if (!isValidDateOnly(localDate)) {
		throw new Error(`Invalid local date: ${localDate}`)
	}
	const parts = localDate.split('-').map(Number)
	return { y: parts[0]!, m: parts[1]!, d: parts[2]! }
}

function toLocalMidnight (localDate: DateOnly): Date {
	const { y, m, d } = parseParts(localDate)
	return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Shift a civil date by whole days (local calendar). */
export function shiftLocalDate (localDate: DateOnly, deltaDays: number): DateOnly {
	const date = toLocalMidnight(localDate)
	date.setDate(date.getDate() + deltaDays)
	return toLocalDateOnly(date)
}

/** Clamp so the user cannot navigate past today. */
export function clampLocalDateToToday (
	localDate: DateOnly,
	today: DateOnly = toLocalDateOnly(),
): DateOnly {
	if (compareDateOnly(localDate, today) > 0) {
		return today
	}
	return localDate
}

/**
 * Compact date for the navigator: «Сегодня, 9 сентября» / «Вчера, 8 сентября»
 * / «6 сентября, воскресенье».
 */
export function formatDiaryDayLabel (
	localDate: DateOnly,
	today: DateOnly = toLocalDateOnly(),
): string {
	const { d, m } = parseParts(localDate)
	const month = MONTHS_GENITIVE[m - 1] ?? ''
	const dayMonth = `${d} ${month}`
	const yesterday = shiftLocalDate(today, -1)

	if (localDate === today) {
		return `Сегодня, ${dayMonth}`
	}
	if (localDate === yesterday) {
		return `Вчера, ${dayMonth}`
	}
	const weekday = WEEKDAYS[toLocalMidnight(localDate).getDay()] ?? ''
	return `${dayMonth}, ${weekday}`
}

/** Short section title without weekday for sticky headers when today/yesterday. */
export function formatDiarySectionTitle (
	localDate: DateOnly,
	today: DateOnly = toLocalDateOnly(),
): string {
	return formatDiaryDayLabel(localDate, today)
}
