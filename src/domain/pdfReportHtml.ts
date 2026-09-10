/**
 * Build Russian HTML for period PDF (expo-print).
 * No emoji — Cyrillic-safe system fonts only.
 */

import type { HealthReportData } from './healthReport'
import type { PeriodReportData } from './periodReport'
import type { PdfReportSections } from './pdfReportOptions'
import type { ReportPeriod } from './reportPeriod'
import {
	formatReportPeriodTitle,
	formatRuLongDateWithYear,
} from './reportPeriod'
import {
	chunkChronologyRows,
	type ChronologyRow,
} from './reportChronology'
import { formatMl } from '../presentation/feedingFormat'
import {
	formatLengthCm,
	formatWeightKg,
} from './growthLabels'
import { formatTemperatureCelsius } from './quickEventLabels'
import { milestoneTypeLabel } from './developmentLabels'
import { formatChildAge } from '../utils/childAge'
import { formatDurationMs } from '../utils/durationFormat'
import { toLocalDateOnly } from '../utils/datetime'
import type { MilestoneEvent } from '../models/development'

export interface PdfReportHtmlInput {
	report: PeriodReportData
	period: ReportPeriod
	sections: PdfReportSections
	health: HealthReportData
	chronology: ChronologyRow[]
	milestones: MilestoneEvent[]
	generatedAtDate?: string
}

/**
 * Produce a complete HTML document for Print.printToFileAsync.
 */
export function buildPeriodPdfHtml (input: PdfReportHtmlInput): string {
	const today = input.generatedAtDate ?? toLocalDateOnly()
	const { report, period, sections, health, chronology, milestones } = input
	const age = formatChildAge(report.child.birthDate, period.endDate)
	const periodTitle = formatReportPeriodTitle(period, today)

	const parts: string[] = []
	parts.push(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>`)
	parts.push(`<title>Отчёт — ${escapeHtml(report.child.name)}</title>`)
	parts.push(`<style>${PDF_CSS}</style></head><body>`)

	parts.push(`<section class="block">`)
	parts.push(`<h1>${escapeHtml(report.child.name)}</h1>`)
	parts.push(`<p class="meta">Возраст: ${escapeHtml(age)}</p>`)
	parts.push(`<p class="meta">Период: ${escapeHtml(periodTitle)}</p>`)
	parts.push(
		`<p class="meta">Сформировано: ${escapeHtml(formatRuLongDateWithYear(today))}</p>`,
	)
	parts.push(`</section>`)

	parts.push(`<section class="block keep">`)
	parts.push(`<h2>Сводка</h2>`)
	parts.push(buildSummaryList(report))
	parts.push(`</section>`)

	if (sections.sleep && report.sleep.hasAnyData) {
		parts.push(buildSleepSection(report))
	}
	if (sections.feeding && report.feeding.hasAnyData) {
		parts.push(buildFeedingSection(report))
	}
	if (sections.diapers && report.diapers.hasAnyData) {
		parts.push(buildDiaperSection(report))
	}
	if (sections.growth && report.growth.hasAnyData) {
		parts.push(buildGrowthSection(report))
	}
	if (sections.health && report.health.hasAnyData) {
		parts.push(buildHealthSection(report, health))
	}
	if (sections.importantEvents) {
		parts.push(buildImportantEventsSection(milestones, period))
	}
	if (sections.chronology) {
		parts.push(buildChronologySection(chronology))
	}

	parts.push(`<p class="footer">Гнёздышко — локальный отчёт, без медицинских заключений.</p>`)
	parts.push(`</body></html>`)
	return parts.join('')
}

const PDF_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    line-height: 1.45;
    padding: 24px;
  }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 0 0 8px; page-break-after: avoid; }
  h3 { font-size: 13px; margin: 12px 0 6px; page-break-after: avoid; }
  .meta { margin: 2px 0; color: #444; }
  .block { margin-bottom: 18px; }
  .keep { page-break-inside: avoid; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 2px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 5px 6px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f3f3f3; }
  tr { page-break-inside: avoid; }
  .chunk { page-break-before: auto; margin-top: 10px; }
  .chunk-cont { page-break-before: always; }
  .footer {
    margin-top: 28px;
    font-size: 10px;
    color: #666;
  }
  .empty { color: #666; font-style: italic; }
`

function buildSummaryList (report: PeriodReportData): string {
	const items: string[] = []
	if (report.sleep.hasAnyData) {
		items.push(
			`Сон: в среднем ${formatDurationMs(report.sleep.averageTotalMs)} в сутки`,
		)
	}
	if (report.feeding.hasAnyData) {
		items.push(
			`Кормления: в среднем ${formatDecimal(report.feeding.averageFeedingsPerDay)} в день`,
		)
	}
	if (report.diapers.hasAnyData) {
		items.push(`Подгузники: ${report.diapers.total} за период`)
	}
	if (report.growth.latestWeightGrams != null) {
		items.push(`Вес: ${formatWeightKg(report.growth.latestWeightGrams)}`)
	}
	if (report.growth.latestHeightMm != null) {
		items.push(`Рост: ${formatLengthCm(report.growth.latestHeightMm)}`)
	}
	if (report.health.hasAnyData) {
		items.push(
			`Здоровье: температура ${report.health.temperatureCount}, симптомов ${report.health.symptomsCount}, лекарств ${report.health.medicineIntakes}`,
		)
	}
	if (items.length === 0) {
		return `<p class="empty">Недостаточно данных за этот период</p>`
	}
	return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
}

function buildSleepSection (report: PeriodReportData): string {
	const s = report.sleep
	const lines = [
		`Средний сон: ${formatDurationMs(s.averageTotalMs)}`,
		`Дневной: ${formatDurationMs(s.averageDayMs)}`,
		`Ночной: ${formatDurationMs(s.averageNightMs)}`,
		`Снов в день: ${formatDecimal(s.averageSleepsPerDay)}`,
		s.averageWakeWindowMs != null
			? `Среднее ВБ: ${formatDurationMs(s.averageWakeWindowMs)}`
			: 'Среднее ВБ: недостаточно интервалов',
		`Самый длинный сон: ${formatDurationMs(s.longestSleepMs)}`,
	]
	const rows = report.dailySeries
		.map(
			(d) =>
				`<tr><td>${escapeHtml(d.date)}</td><td>${d.sleepTotalMinutes} мин</td><td>${d.daySleepMinutes}</td><td>${d.nightSleepMinutes}</td><td>${d.sleepCount}</td></tr>`,
		)
		.join('')
	return `
<section class="block">
  <h2>Сон</h2>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
  <h3>По дням</h3>
  <table>
    <thead><tr><th>Дата</th><th>Всего</th><th>День</th><th>Ночь</th><th>Снов</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`
}

function buildFeedingSection (report: PeriodReportData): string {
	const f = report.feeding
	const lines = [
		`В среднем ${formatDecimal(f.averageFeedingsPerDay)} кормлений в день`,
		`ГВ: ${f.breastfeedingCount} · ${formatDurationMs(f.breastfeedingTotalSeconds * 1000)}`,
		f.breastfeedingAverageSeconds != null
			? `Средняя длительность ГВ: ${formatDurationMs(f.breastfeedingAverageSeconds * 1000)}`
			: null,
		`Смесь: ${formatMl(f.formulaMl)}`,
		`Сцеженное молоко: ${formatMl(f.expressedMilkMl)}`,
		`Вода: ${formatMl(f.waterMl)}`,
		`Прикорм: ${f.solidsCount}`,
	].filter(Boolean) as string[]
	return `
<section class="block keep">
  <h2>Кормления</h2>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
</section>`
}

function buildDiaperSection (report: PeriodReportData): string {
	const d = report.diapers
	const lines = [
		`Всего: ${d.total}`,
		`Мокрые: ${d.wet}`,
		`Грязные: ${d.dirty}`,
		`Оба: ${d.both}`,
		`Сухие: ${d.dry}`,
	]
	return `
<section class="block keep">
  <h2>Подгузники</h2>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
</section>`
}

function buildGrowthSection (report: PeriodReportData): string {
	const g = report.growth
	const lines: string[] = []
	lines.push(
		g.latestWeightGrams != null
			? `Вес: ${formatWeightKg(g.latestWeightGrams)}`
			: 'Вес: —',
	)
	if (g.weightDeltaGrams != null) {
		const sign = g.weightDeltaGrams > 0 ? '+' : ''
		lines.push(`Изменение веса: ${sign}${g.weightDeltaGrams} г`)
	}
	lines.push(
		g.latestHeightMm != null
			? `Рост: ${formatLengthCm(g.latestHeightMm)}`
			: 'Рост: —',
	)
	if (g.heightDeltaMm != null) {
		const cm = g.heightDeltaMm / 10
		const sign = cm > 0 ? '+' : ''
		const text = Number.isInteger(cm)
			? String(cm)
			: cm.toFixed(1).replace('.', ',')
		lines.push(`Изменение роста: ${sign}${text} см`)
	}
	lines.push(
		g.latestHeadMm != null
			? `Окружность головы: ${formatLengthCm(g.latestHeadMm)}`
			: 'Окружность головы: —',
	)
	return `
<section class="block keep">
  <h2>Рост</h2>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
</section>`
}

function buildHealthSection (
	report: PeriodReportData,
	health: HealthReportData,
): string {
	const h = report.health
	const lines: string[] = [
		`Температура: ${h.temperatureCount} измерений`,
	]
	if (h.temperatureMin != null && h.temperatureMax != null) {
		lines.push(
			`Диапазон: ${formatTemperatureCelsius(h.temperatureMin).replace(' °C', '')}–${formatTemperatureCelsius(h.temperatureMax)}`,
		)
	}
	lines.push(`Симптомов: ${h.symptomsCount}`)
	lines.push(`Лекарств и витаминов: ${h.medicineIntakes} приёмов`)
	lines.push(`Визитов к врачу: ${h.doctorVisits}`)

	const detailRows: string[] = []
	for (const t of health.temperatures.slice(0, 20)) {
		detailRows.push(
			`<tr><td>${escapeHtml(formatRuLongDateWithYear(t.startLocalDate))}</td><td>Температура</td><td>${escapeHtml(formatTemperatureCelsius(t.celsius))}</td></tr>`,
		)
	}
	for (const s of health.symptoms.slice(0, 20)) {
		detailRows.push(
			`<tr><td>${escapeHtml(formatRuLongDateWithYear(s.startLocalDate))}</td><td>Симптом</td><td>${escapeHtml(s.title)}</td></tr>`,
		)
	}
	for (const m of health.medicines.slice(0, 20)) {
		detailRows.push(
			`<tr><td>${escapeHtml(formatRuLongDateWithYear(m.startLocalDate))}</td><td>${m.type === 'vitamin' ? 'Витамин' : 'Лекарство'}</td><td>${escapeHtml(m.name)}</td></tr>`,
		)
	}
	for (const v of health.doctorVisits.slice(0, 20)) {
		detailRows.push(
			`<tr><td>${escapeHtml(formatRuLongDateWithYear(v.visitedLocalDate))}</td><td>Визит</td><td>${escapeHtml(v.specialistLabel)}</td></tr>`,
		)
	}

	const table =
		detailRows.length > 0
			? `<table><thead><tr><th>Дата</th><th>Тип</th><th>Детали</th></tr></thead><tbody>${detailRows.join('')}</tbody></table>`
			: ''

	return `
<section class="block">
  <h2>Здоровье</h2>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
  ${table}
</section>`
}

function buildImportantEventsSection (
	milestones: MilestoneEvent[],
	period: ReportPeriod,
): string {
	const inPeriod = milestones.filter(
		(m) =>
			m.startLocalDate >= period.startDate &&
			m.startLocalDate <= period.endDate,
	)
	if (inPeriod.length === 0) {
		return `
<section class="block keep">
  <h2>Важные события</h2>
  <p class="empty">Нет отмеченных достижений за этот период</p>
</section>`
	}
	const rows = inPeriod
		.map(
			(m) =>
				`<tr><td>${escapeHtml(formatRuLongDateWithYear(m.startLocalDate))}</td><td>${escapeHtml(m.title || milestoneTypeLabel(m.milestoneType))}</td></tr>`,
		)
		.join('')
	return `
<section class="block">
  <h2>Важные события</h2>
  <table>
    <thead><tr><th>Дата</th><th>Событие</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`
}

function buildChronologySection (chronology: ChronologyRow[]): string {
	if (chronology.length === 0) {
		return `
<section class="block keep">
  <h2>Хронология</h2>
  <p class="empty">Нет событий за этот период</p>
</section>`
	}
	const chunks = chunkChronologyRows(chronology)
	const htmlChunks = chunks.map((chunk, index) => {
		const rows = chunk
			.map(
				(r) =>
					`<tr><td>${escapeHtml(r.dateTimeLabel)}</td><td>${escapeHtml(r.eventLabel)}</td><td>${escapeHtml(r.details)}</td></tr>`,
			)
			.join('')
		const cls = index === 0 ? 'chunk' : 'chunk chunk-cont'
		const title =
			index === 0
				? 'Хронология'
				: `Хронология (продолжение ${index + 1})`
		return `
<section class="${cls}">
  <h2>${title}</h2>
  <table>
    <thead><tr><th>Дата/время</th><th>Событие</th><th>Детали</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`
	})
	return htmlChunks.join('')
}

function formatDecimal (value: number): string {
	if (Number.isInteger(value)) {
		return String(value)
	}
	return value.toFixed(1).replace('.', ',')
}

export function escapeHtml (value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
