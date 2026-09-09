/**
 * Russian labels and compact summaries for feeding UI / diary / Today.
 */

import {
	bottleContentLabel,
	breastSideLabel,
} from '../domain/feedingLabels'
import { breastfeedingLiveTotals } from '../domain/breastfeedingDuration'
import type { FeedingEvent } from '../models/feeding'
import { formatDurationMs } from '../utils/durationFormat'
import { parseOffsetDateTime } from '../utils/datetime'

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

/** «120 мл» — whole millilitres only. */
export function formatMl (amountMl: number): string {
	return `${Math.round(amountMl)} мл`
}

/**
 * Relative age of an event: «48 мин назад», «1 ч 20 мин назад».
 */
export function formatRelativeAgo (
	fromAt: string,
	nowMs: number = Date.now(),
): string {
	const fromMs = parseOffsetDateTime(fromAt).getTime()
	const elapsed = Math.max(0, nowMs - fromMs)
	if (elapsed < 60_000) {
		return 'только что'
	}
	const totalMinutes = Math.floor(elapsed / 60_000)
	if (totalMinutes < 60) {
		return `${totalMinutes} мин назад`
	}
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	if (minutes === 0) {
		return `${hours} ч назад`
	}
	return `${hours} ч ${pad2(minutes)} мин назад`
}

/** Compact diary / list line body (without clock prefix). */
export function formatFeedingDetail (
	event: FeedingEvent,
	nowMs: number = Date.now(),
): string {
	switch (event.type) {
		case 'breastfeeding': {
			const totals = breastfeedingLiveTotals(event, nowMs)
			const sides: string[] = []
			if (totals.leftSeconds > 0) {
				sides.push('левая')
			}
			if (totals.rightSeconds > 0) {
				sides.push('правая')
			}
			const sidePart =
				sides.length > 0 ? sides.join('/') : breastSideLabel(event.lastSide).toLowerCase()
			return `Грудь · ${sidePart} · ${formatDurationMs(totals.totalSeconds * 1000)}`
		}
		case 'bottle':
			return `${bottleContentLabel(
				event.feedingKind === 'formula' ? 'formula' : 'expressed_milk',
			)} · ${formatMl(event.amountMl)}`
		case 'water':
			return `Вода · ${formatMl(event.amountMl)}`
		case 'pumping': {
			const parts = ['Сцеживание']
			if (event.amountMl != null) {
				parts.push(formatMl(event.amountMl))
			}
			if (event.durationSeconds != null) {
				parts.push(formatDurationMs(event.durationSeconds * 1000))
			}
			return parts.join(' · ')
		}
		case 'solid_food':
			return `Прикорм · ${event.foodName}`
	}
}

/** Today card line: «Грудь · 14 мин · 48 мин назад». */
export function formatLatestFeedingSummary (
	event: FeedingEvent,
	nowMs: number = Date.now(),
): string {
	const agoAnchor =
		event.endAt != null ? event.endAt : event.startAt
	const ago = formatRelativeAgo(agoAnchor, nowMs)

	switch (event.type) {
		case 'breastfeeding': {
			const totals = breastfeedingLiveTotals(event, nowMs)
			return `Грудь · ${formatDurationMs(totals.totalSeconds * 1000)} · ${ago}`
		}
		case 'bottle':
			return `${bottleContentLabel(
				event.feedingKind === 'formula' ? 'formula' : 'expressed_milk',
			)} · ${formatMl(event.amountMl)} · ${ago}`
		case 'water':
			return `Вода · ${formatMl(event.amountMl)} · ${ago}`
		case 'pumping': {
			const volume =
				event.amountMl != null ? ` · ${formatMl(event.amountMl)}` : ''
			return `Сцеживание${volume} · ${ago}`
		}
		case 'solid_food':
			return `Прикорм · ${event.foodName} · ${ago}`
	}
}
