/**
 * Daily feeding aggregates for Today (local calendar day by start_local_date).
 * Water is kept separate from milk/formula totals.
 */

import type { FeedingEvent } from '../models/feeding'
import { formatDurationMs } from '../utils/durationFormat'
import {
	breastfeedingLiveTotals,
} from './breastfeedingDuration'

export interface DailyFeedingAggregate {
	totalCount: number
	breastfeedingCount: number
	breastfeedingDurationSeconds: number
	breastfeedingDurationLabel: string
	bottleCount: number
	formulaMl: number
	expressedMilkMl: number
	waterMl: number
	pumpingCount: number
	solidsCount: number
}

export function emptyFeedingAggregate (): DailyFeedingAggregate {
	return {
		totalCount: 0,
		breastfeedingCount: 0,
		breastfeedingDurationSeconds: 0,
		breastfeedingDurationLabel: '0 мин',
		bottleCount: 0,
		formulaMl: 0,
		expressedMilkMl: 0,
		waterMl: 0,
		pumpingCount: 0,
		solidsCount: 0,
	}
}

export function aggregateFeedingsForLocalDay (
	feedings: readonly FeedingEvent[],
	nowMs: number = Date.now(),
): DailyFeedingAggregate {
	const agg = emptyFeedingAggregate()

	for (const item of feedings) {
		agg.totalCount += 1
		switch (item.type) {
			case 'breastfeeding': {
				agg.breastfeedingCount += 1
				const totals = breastfeedingLiveTotals(item, nowMs)
				agg.breastfeedingDurationSeconds += totals.totalSeconds
				break
			}
			case 'bottle': {
				agg.bottleCount += 1
				if (item.feedingKind === 'formula') {
					agg.formulaMl += item.amountMl
				} else {
					agg.expressedMilkMl += item.amountMl
				}
				break
			}
			case 'water':
				agg.waterMl += item.amountMl
				break
			case 'pumping':
				agg.pumpingCount += 1
				break
			case 'solid_food':
				agg.solidsCount += 1
				break
		}
	}

	agg.breastfeedingDurationLabel = formatDurationMs(
		agg.breastfeedingDurationSeconds * 1000,
	)
	return agg
}
