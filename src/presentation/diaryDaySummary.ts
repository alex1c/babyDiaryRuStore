/**
 * Compact day summary for Diary header.
 */

import type { DailyDiaperAggregate } from '../domain/diaperLabels'
import type { DailyFeedingAggregate } from '../domain/feedingAggregation'
import type { DailySleepAggregate } from '../domain/sleepAggregation'
import type { SummaryRow } from '../components/TodaySummary'

export interface DiaryDaySummary {
	sleepLabel: string
	feedingCount: number
	diaperCount: number
	rows: SummaryRow[]
}

export function buildDiaryDaySummary (
	sleepAgg: DailySleepAggregate,
	feedingAgg: DailyFeedingAggregate,
	diaperAgg: DailyDiaperAggregate,
): DiaryDaySummary {
	return {
		sleepLabel: sleepAgg.totalLabel,
		feedingCount: feedingAgg.totalCount,
		diaperCount: diaperAgg.totalCount,
		rows: [
			{
				id: 'diary-sleep',
				label: 'Сон',
				value: sleepAgg.totalLabel,
			},
			{
				id: 'diary-feeding',
				label: 'Кормлений',
				value: String(feedingAgg.totalCount),
			},
			{
				id: 'diary-diaper',
				label: 'Подгузников',
				value: String(diaperAgg.totalCount),
			},
		],
	}
}
