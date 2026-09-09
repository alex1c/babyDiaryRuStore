/**
 * Build a short Russian share summary from PeriodReportData.
 * Omits empty lines that would only add noise.
 */

import type { HealthReportData } from './healthReport'
import type { PeriodReportData } from './periodReport'
import type { ReportPeriod } from './reportPeriod'
import { formatReportPeriodTitle } from './reportPeriod'
import { formatMl } from '../presentation/feedingFormat'
import { formatTemperatureCelsius } from './quickEventLabels'
import {
	formatLengthCm,
	formatWeightKg,
} from './growthLabels'
import { formatChildAge } from '../utils/childAge'
import { formatDurationMs } from '../utils/durationFormat'
import { toLocalDateOnly } from '../utils/datetime'

export interface ShareSummaryInput {
	report: PeriodReportData
	period: ReportPeriod
	/** Optional detailed health (temps list) for last reading. */
	health?: HealthReportData | null
	today?: string
}

/**
 * Format shareable plain text for Android system share sheet.
 */
export function formatShareSummaryText (input: ShareSummaryInput): string {
	const today = input.today ?? toLocalDateOnly()
	const { report, period, health } = input
	const lines: string[] = []

	const age = formatChildAge(report.child.birthDate, period.endDate)
	lines.push(`${report.child.name} · ${age}`)
	lines.push('')
	lines.push(formatReportPeriodTitle(period, today))
	lines.push('')

	const sleep = report.sleep
	if (sleep.hasAnyData) {
		if (period.dayCount === 1) {
			lines.push(`Сон: ${formatDurationMs(sleep.totalSleepMs)}`)
		} else {
			lines.push(
				`Сон: в среднем ${formatDurationMs(sleep.averageTotalMs)} в сутки`,
			)
		}
		if (sleep.averageDayMs > 0) {
			lines.push(
				period.dayCount === 1
					? `Дневной сон: ${formatDurationMs(sumDayMs(report))}`
					: `Дневной сон: ${formatDurationMs(sleep.averageDayMs)}`,
			)
		}
		if (sleep.averageNightMs > 0) {
			lines.push(
				period.dayCount === 1
					? `Ночной сон: ${formatDurationMs(sumNightMs(report))}`
					: `Ночной сон: ${formatDurationMs(sleep.averageNightMs)}`,
			)
		}
		if (sleep.averageWakeWindowMs != null) {
			lines.push(
				`Среднее ВБ: ${formatDurationMs(sleep.averageWakeWindowMs)}`,
			)
		}
	}

	const feeding = report.feeding
	if (feeding.hasAnyData) {
		const feedCount =
			period.dayCount === 1
				? Math.round(feeding.averageFeedingsPerDay)
				: feeding.averageFeedingsPerDay
		lines.push(
			period.dayCount === 1
				? `Кормления: ${Math.round(feedCount)}`
				: `Кормления: в среднем ${formatDecimal(feedCount)} в день`,
		)
		if (feeding.breastfeedingCount > 0) {
			lines.push(
				`ГВ: ${feeding.breastfeedingCount} · ${formatDurationMs(feeding.breastfeedingTotalSeconds * 1000)}`,
			)
		}
		if (feeding.formulaMl > 0) {
			lines.push(`Смесь: ${formatMl(feeding.formulaMl)}`)
		}
		if (feeding.expressedMilkMl > 0) {
			lines.push(`Сцеженное молоко: ${formatMl(feeding.expressedMilkMl)}`)
		}
		if (feeding.waterMl > 0) {
			lines.push(`Вода: ${formatMl(feeding.waterMl)}`)
		}
		if (feeding.solidsCount > 0) {
			lines.push(`Прикорм: ${feeding.solidsCount}`)
		}
	}

	const diapers = report.diapers
	if (diapers.hasAnyData) {
		lines.push(
			period.dayCount === 1
				? `Подгузники: ${diapers.total}`
				: `Подгузники: ${diapers.total} (в среднем ${formatDecimal(diapers.averagePerDay)} в день)`,
		)
	}

	const growth = report.growth
	if (growth.latestWeightGrams != null) {
		lines.push(`Вес: ${formatWeightKg(growth.latestWeightGrams)}`)
	}
	if (growth.latestHeightMm != null) {
		lines.push(`Рост: ${formatLengthCm(growth.latestHeightMm)}`)
	}
	if (growth.weightDeltaGrams != null) {
		const sign = growth.weightDeltaGrams > 0 ? '+' : ''
		lines.push(`Изменение веса: ${sign}${growth.weightDeltaGrams} г`)
	}

	const tempLine = formatTemperatureShareLine(report, health)
	if (tempLine) {
		lines.push(tempLine)
	} else if (report.health.symptomsCount > 0) {
		lines.push(`Симптомов: ${report.health.symptomsCount}`)
	}

	// Drop trailing blank lines while keeping structure.
	while (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop()
	}
	return lines.join('\n')
}

function sumDayMs (report: PeriodReportData): number {
	return report.dailySeries.reduce(
		(sum, d) => sum + d.daySleepMinutes * 60_000,
		0,
	)
}

function sumNightMs (report: PeriodReportData): number {
	return report.dailySeries.reduce(
		(sum, d) => sum + d.nightSleepMinutes * 60_000,
		0,
	)
}

function formatDecimal (value: number): string {
	if (Number.isInteger(value)) {
		return String(value)
	}
	return value.toFixed(1).replace('.', ',')
}

function formatTemperatureShareLine (
	report: PeriodReportData,
	health: HealthReportData | null | undefined,
): string | null {
	if (health && health.temperatures.length > 0) {
		const sorted = [...health.temperatures].sort((a, b) =>
			b.startAt.localeCompare(a.startAt),
		)
		const last = sorted[0]!
		if (report.period.dayCount === 1) {
			return `Температура: ${formatTemperatureCelsius(last.celsius)}`
		}
	}
	const h = report.health
	if (h.temperatureCount > 0 && h.temperatureMin != null && h.temperatureMax != null) {
		if (h.temperatureMin === h.temperatureMax) {
			return `Температура: ${formatTemperatureCelsius(h.temperatureMin)}`
		}
		return `Температура: ${formatTemperatureCelsius(h.temperatureMin).replace(' °C', '')}–${formatTemperatureCelsius(h.temperatureMax)}`
	}
	return null
}
