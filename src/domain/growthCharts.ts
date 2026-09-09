/**
 * Map growth measurements to simple chart series (own dynamics only).
 */

import type { GrowthMeasurement } from '../models/growth'
import { mmToCm } from './growthLabels'

export type GrowthChartMetric = 'weight' | 'height' | 'head'

export interface GrowthChartPoint {
	id: string
	/** ISO local date YYYY-MM-DD for axis labels. */
	date: string
	/** Measured-at for stable sort. */
	measuredAt: string
	/** Display value in UI units (kg or cm). */
	value: number
}

/**
 * Build sorted chart points for one metric.
 * Skips nulls; works with 0/1/many points; identical values stay valid.
 */
export function buildGrowthChartPoints (
	measurements: GrowthMeasurement[],
	metric: GrowthChartMetric,
): GrowthChartPoint[] {
	const points: GrowthChartPoint[] = []
	for (const m of measurements) {
		let value: number | null = null
		if (metric === 'weight' && m.weightGrams != null) {
			value = m.weightGrams / 1000
		} else if (metric === 'height' && m.heightMm != null) {
			value = mmToCm(m.heightMm)
		} else if (metric === 'head' && m.headCircumferenceMm != null) {
			value = mmToCm(m.headCircumferenceMm)
		}
		if (value == null) {
			continue
		}
		points.push({
			id: m.id,
			date: m.measuredLocalDate,
			measuredAt: m.measuredAt,
			value,
		})
	}
	points.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
	return points
}

/**
 * Normalize Y for bar/line layout (0–1).
 * Single point or flat series → mid height so UI does not collapse.
 */
export function normalizeChartValues (values: number[]): number[] {
	if (values.length === 0) {
		return []
	}
	const min = Math.min(...values)
	const max = Math.max(...values)
	if (max === min) {
		return values.map(() => 0.5)
	}
	const span = max - min
	return values.map((v) => (v - min) / span)
}
