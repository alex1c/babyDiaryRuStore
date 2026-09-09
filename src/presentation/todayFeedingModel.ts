/**
 * Today feeding card + compact daily aggregate rows.
 */

import {
	aggregateFeedingsForLocalDay,
	type DailyFeedingAggregate,
} from '../domain/feedingAggregation'
import type { FeedingEvent, BreastfeedingEvent } from '../models/feeding'
import { formatMl, formatLatestFeedingSummary } from './feedingFormat'
import type { SummaryRow } from '../components/TodaySummary'

export interface TodayFeedingModel {
	activeBreastfeeding: BreastfeedingEvent | null
	latest: FeedingEvent | null
	latestSummary: string
	hasData: boolean
	aggregate: DailyFeedingAggregate
	summaryRows: SummaryRow[]
}

export function buildTodayFeedingModel (
	active: BreastfeedingEvent | null,
	latest: FeedingEvent | null,
	dayFeedings: readonly FeedingEvent[],
	nowMs: number = Date.now(),
): TodayFeedingModel {
	const aggregate = aggregateFeedingsForLocalDay(dayFeedings, nowMs)
	const hasData = dayFeedings.length > 0 || active != null || latest != null

	const summaryRows: SummaryRow[] = [
		{
			id: 'feed-total',
			label: 'Кормлений',
			value: String(aggregate.totalCount),
		},
		{
			id: 'feed-bf-count',
			label: 'ГВ',
			value: String(aggregate.breastfeedingCount),
		},
		{
			id: 'feed-bf-dur',
			label: 'ГВ время',
			value: aggregate.breastfeedingDurationLabel,
		},
		{
			id: 'feed-bottle',
			label: 'Бутылочки',
			value: String(aggregate.bottleCount),
		},
		{
			id: 'feed-formula',
			label: 'Смесь',
			value: formatMl(aggregate.formulaMl),
		},
		{
			id: 'feed-expressed',
			label: 'Сцеж. молоко',
			value: formatMl(aggregate.expressedMilkMl),
		},
		{
			id: 'feed-water',
			label: 'Вода',
			value: formatMl(aggregate.waterMl),
		},
		{
			id: 'feed-solids',
			label: 'Прикорм',
			value: String(aggregate.solidsCount),
		},
	]

	return {
		activeBreastfeeding: active,
		latest,
		latestSummary: latest
			? formatLatestFeedingSummary(latest, nowMs)
			: 'Пока нет кормлений',
		hasData,
		aggregate,
		summaryRows,
	}
}
