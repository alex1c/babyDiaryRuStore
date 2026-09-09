/**
 * Today diaper card model + summary rows.
 */

import {
	aggregateDiapersForLocalDay,
	type DailyDiaperAggregate,
} from '../domain/diaperLabels'
import type { DiaperEvent } from '../models/diaper'
import { formatRelativeAgo } from './feedingFormat'
import { formatLatestDiaperSummary } from './diaryTimeline'
import type { SummaryRow } from '../components/TodaySummary'

export interface TodayDiaperModel {
	latest: DiaperEvent | null
	latestSummary: string
	hasData: boolean
	aggregate: DailyDiaperAggregate
	summaryRows: SummaryRow[]
}

export function buildTodayDiaperModel (
	latest: DiaperEvent | null,
	dayDiapers: readonly DiaperEvent[],
	nowMs: number = Date.now(),
): TodayDiaperModel {
	const aggregate = aggregateDiapersForLocalDay(dayDiapers)
	const hasData = dayDiapers.length > 0 || latest != null
	const latestSummary = latest
		? formatLatestDiaperSummary(
			latest,
			formatRelativeAgo(latest.startAt, nowMs),
		)
		: 'Пока нет записей'

	return {
		latest,
		latestSummary,
		hasData,
		aggregate,
		summaryRows: [
			{
				id: 'diaper-total',
				label: 'Подгузники',
				value: String(aggregate.totalCount),
			},
			{
				id: 'diaper-wet',
				label: 'Мокрые',
				value: String(aggregate.wetCount),
			},
			{
				id: 'diaper-dirty',
				label: 'Грязные',
				value: String(aggregate.dirtyCount),
			},
			{
				id: 'diaper-both',
				label: 'Оба',
				value: String(aggregate.bothCount),
			},
		],
	}
}
