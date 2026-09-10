/**
 * Today screen view-model helpers.
 * Phase 1 returns empty aggregates; later phases plug real event queries here.
 */

import type { Child, DiaryEvent } from '../models/types'
import { formatChildAge } from '../utils/childAge'
import { toLocalDateOnly } from '../utils/datetime'

export interface TodayStatusCard {
	id: 'sleep' | 'feeding' | 'diaper'
	title: string
	emptyMessage: string
	ctaLabel: string
	hasData: boolean
	summary: string
}

export interface TodayDaySummaryRow {
	id: 'sleep' | 'feeding' | 'diaper'
	label: string
	value: string
}

export interface TodayViewModel {
	childName: string
	ageLabel: string
	statusCards: TodayStatusCard[]
	daySummary: TodayDaySummaryRow[]
}

const EMPTY_SLEEP = 'Пока нет записей'
const EMPTY_FEEDING = 'Пока нет записей'
const EMPTY_DIAPER = 'Пока нет записей'

/**
 * Build Today UI model for the active child.
 * `todayEvents` is reserved for Phase 2+; Phase 1 passes [].
 */
export function buildTodayViewModel (
	child: Child,
	todayEvents: readonly DiaryEvent[] = [],
	asOfDate: string = toLocalDateOnly(),
): TodayViewModel {
	const sleepEvents = todayEvents.filter((e) => e.type === 'sleep')
	const feedingEvents = todayEvents.filter((e) =>
		['breastfeeding', 'bottle', 'pumping', 'water', 'solid_food'].includes(
			e.type,
		),
	)
	const diaperEvents = todayEvents.filter((e) => e.type === 'diaper')

	const hasSleep = sleepEvents.length > 0
	const feedingCount = feedingEvents.length
	const diaperCount = diaperEvents.length

	return {
		childName: child.name,
		ageLabel: formatChildAge(child.birthDate, asOfDate),
		statusCards: [
			{
				id: 'sleep',
				title: 'Сон',
				emptyMessage: EMPTY_SLEEP,
				ctaLabel: 'Начать сон',
				hasData: hasSleep,
				summary: hasSleep
					? `Записей сегодня: ${sleepEvents.length}`
					: EMPTY_SLEEP,
			},
			{
				id: 'feeding',
				title: 'Кормление',
				emptyMessage: EMPTY_FEEDING,
				ctaLabel: 'Кормление',
				hasData: feedingCount > 0,
				summary:
					feedingCount > 0
						? `Сегодня: ${feedingCount}`
						: EMPTY_FEEDING,
			},
			{
				id: 'diaper',
				title: 'Подгузник',
				emptyMessage: EMPTY_DIAPER,
				ctaLabel: 'Подгузник',
				hasData: diaperCount > 0,
				summary:
					diaperCount > 0
						? `Сегодня: ${diaperCount}`
						: EMPTY_DIAPER,
			},
		],
		daySummary: [
			{
				id: 'sleep',
				label: 'Сон',
				value: hasSleep ? `${sleepEvents.length}` : 'нет данных',
			},
			{
				id: 'feeding',
				label: 'Кормления',
				value: String(feedingCount),
			},
			{
				id: 'diaper',
				label: 'Подгузники',
				value: String(diaperCount),
			},
		],
	}
}
