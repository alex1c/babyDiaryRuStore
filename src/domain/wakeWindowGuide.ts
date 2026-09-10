/**
 * Approximate wake-window (ВБ) guide by infant age.
 *
 * IMPORTANT: ranges are conservative product placeholders, not medical advice.
 * Easy to replace later without touching UI.
 */

import { calculateAgeParts } from '../utils/childAge'
import type { DateOnly } from '../models/types'
import { formatDurationMs } from '../utils/durationFormat'

export interface WakeWindowRange {
	/** Inclusive lower age in whole days. */
	fromDaysInclusive: number
	/** Exclusive upper age in whole days (Infinity-safe via large number). */
	toDaysExclusive: number
	minMs: number
	maxMs: number
	label: string
}

const HOUR = 3_600_000
const MIN = 60_000

/**
 * Indicative wake windows by age band (days from birth).
 * Marked as approximate — replace with product-approved table when ready.
 */
export const WAKE_WINDOW_GUIDE: readonly WakeWindowRange[] = [
	{
		fromDaysInclusive: 0,
		toDaysExclusive: 14,
		minMs: 45 * MIN,
		maxMs: 75 * MIN,
		label: '0–2 недели',
	},
	{
		fromDaysInclusive: 14,
		toDaysExclusive: 45,
		minMs: 60 * MIN,
		maxMs: 90 * MIN,
		label: '2–6 недель',
	},
	{
		fromDaysInclusive: 45,
		toDaysExclusive: 90,
		minMs: 75 * MIN,
		maxMs: 105 * MIN,
		label: '1.5–3 месяца',
	},
	{
		fromDaysInclusive: 90,
		toDaysExclusive: 180,
		minMs: 90 * MIN,
		maxMs: 2 * HOUR,
		label: '3–6 месяцев',
	},
	{
		fromDaysInclusive: 180,
		toDaysExclusive: 365,
		minMs: 2 * HOUR,
		maxMs: 3 * HOUR,
		label: '6–12 месяцев',
	},
	{
		fromDaysInclusive: 365,
		toDaysExclusive: 365 * 3,
		minMs: 3 * HOUR,
		maxMs: 5 * HOUR,
		label: '1–3 года',
	},
] as const

export function selectWakeWindowGuide (
	birthDate: DateOnly,
	asOf: DateOnly,
): WakeWindowRange | null {
	const age = calculateAgeParts(birthDate, asOf)
	const days = age.totalDays
	return (
		WAKE_WINDOW_GUIDE.find(
			(band) =>
				days >= band.fromDaysInclusive && days < band.toDaysExclusive,
		) ?? null
	)
}

export function formatWakeWindowGuideLabel (range: WakeWindowRange): string {
	return `Ориентир бодрствования для возраста: ${formatDurationMs(range.minMs)} – ${formatDurationMs(range.maxMs)}`
}

export const WAKE_WINDOW_DISCLAIMER =
	'У каждого ребёнка режим индивидуален.'
