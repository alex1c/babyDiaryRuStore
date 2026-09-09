/**
 * Normalized per-day stats row for Statistics + future PDF.
 */

import type { DateOnly } from '../models/types'

export interface DailyStats {
	date: DateOnly
	sleepTotalMinutes: number
	daySleepMinutes: number
	nightSleepMinutes: number
	sleepCount: number
	wakeWindowAverageMinutes: number | null
	feedingCount: number
	breastfeedingMinutes: number
	formulaMl: number
	expressedMilkMl: number
	waterMl: number
	solidsCount: number
	diaperTotal: number
	diaperWet: number
	diaperDirty: number
	diaperBoth: number
	diaperDry: number
}

export function emptyDailyStats (date: DateOnly): DailyStats {
	return {
		date,
		sleepTotalMinutes: 0,
		daySleepMinutes: 0,
		nightSleepMinutes: 0,
		sleepCount: 0,
		wakeWindowAverageMinutes: null,
		feedingCount: 0,
		breastfeedingMinutes: 0,
		formulaMl: 0,
		expressedMilkMl: 0,
		waterMl: 0,
		solidsCount: 0,
		diaperTotal: 0,
		diaperWet: 0,
		diaperDirty: 0,
		diaperBoth: 0,
		diaperDry: 0,
	}
}
