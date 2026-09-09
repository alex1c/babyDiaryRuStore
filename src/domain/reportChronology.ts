/**
 * Chronology rows for PDF — Russian labels only, period-scoped.
 */

import { diaperKindLabel } from './diaperLabels'
import { feedingTypeLabel } from './feedingLabels'
import { milestoneTypeLabel } from './developmentLabels'
import {
	doctorSpecialistLabel,
	medicineUnitLabel,
	symptomTypeLabel,
} from './healthLabels'
import { formatTemperatureCelsius } from './quickEventLabels'
import { formatMl } from '../presentation/feedingFormat'
import { formatDurationMs } from '../utils/durationFormat'
import { formatLocalTime, parseOffsetDateTime } from '../utils/datetime'
import { formatRuLongDateWithYear } from './reportPeriod'
import type { DiaperEvent } from '../models/diaper'
import type { FeedingEvent } from '../models/feeding'
import type { MilestoneEvent } from '../models/development'
import type { DoctorVisit, SymptomEvent } from '../models/health'
import type { MedicineEvent, TemperatureEvent } from '../models/quickEvents'
import type { SleepEvent } from '../models/sleep'
import type { GrowthMeasurement } from '../models/growth'
import {
	formatLengthCm,
	formatWeightKg,
} from './growthLabels'

export interface ChronologyRow {
	sortAt: string
	localDate: string
	dateTimeLabel: string
	eventLabel: string
	details: string
}

export interface BuildChronologyInput {
	sleeps: SleepEvent[]
	feedings: FeedingEvent[]
	diapers: DiaperEvent[]
	temperatures: TemperatureEvent[]
	medicines: MedicineEvent[]
	symptoms: SymptomEvent[]
	doctorVisits: DoctorVisit[]
	milestones: MilestoneEvent[]
	measurements: GrowthMeasurement[]
	periodStart: string
	periodEnd: string
	nowMs?: number
}

/** Rows per PDF table chunk (page-friendly). */
export const CHRONOLOGY_ROWS_PER_CHUNK = 35

/**
 * Build sorted chronology for the inclusive local-date period.
 * Does not silently drop events — callers paginate in the PDF.
 */
export function buildReportChronology (
	input: BuildChronologyInput,
): ChronologyRow[] {
	const nowMs = input.nowMs ?? Date.now()
	const rows: ChronologyRow[] = []

	for (const s of input.sleeps) {
		if (!overlapsPeriod(s.startLocalDate, s.endLocalDate, input)) {
			continue
		}
		const endMs =
			s.endAt == null
				? nowMs
				: parseOffsetDateTime(s.endAt).getTime()
		const startMs = parseOffsetDateTime(s.startAt).getTime()
		const dur = Math.max(0, endMs - startMs)
		const type =
			s.sleepType === 'night'
				? 'Ночной'
				: s.sleepType === 'day'
					? 'Дневной'
					: 'Сон'
		rows.push(
			makeRow(
				s.startAt,
				s.startLocalDate,
				'Сон',
				`${type}, ${formatDurationMs(dur)}${s.endAt == null ? ' (идёт)' : ''}`,
			),
		)
	}

	for (const f of input.feedings) {
		if (!inPeriod(f.startLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				f.startAt,
				f.startLocalDate,
				'Кормление',
				formatFeedingDetails(f),
			),
		)
	}

	for (const d of input.diapers) {
		if (!inPeriod(d.startLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				d.startAt,
				d.startLocalDate,
				'Подгузник',
				diaperKindLabel(d.kind),
			),
		)
	}

	for (const t of input.temperatures) {
		if (!inPeriod(t.startLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				t.startAt,
				t.startLocalDate,
				'Температура',
				formatTemperatureCelsius(t.celsius),
			),
		)
	}

	for (const m of input.medicines) {
		if (!inPeriod(m.startLocalDate, input)) {
			continue
		}
		const unit =
			m.unit && m.unit !== 'none' ? ` ${medicineUnitLabel(m.unit)}` : ''
		const dose = m.doseText ? ` · ${m.doseText}${unit}` : ''
		rows.push(
			makeRow(
				m.startAt,
				m.startLocalDate,
				m.type === 'vitamin' ? 'Витамин' : 'Лекарство',
				`${m.name}${dose}`,
			),
		)
	}

	for (const s of input.symptoms) {
		if (!inPeriod(s.startLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				s.startAt,
				s.startLocalDate,
				'Симптом',
				s.title || symptomTypeLabel(s.symptomType),
			),
		)
	}

	for (const v of input.doctorVisits) {
		if (!inPeriod(v.visitedLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				v.visitedAt,
				v.visitedLocalDate,
				'Визит к врачу',
				v.specialistLabel || doctorSpecialistLabel(v.specialistKey),
			),
		)
	}

	for (const m of input.milestones) {
		if (!inPeriod(m.startLocalDate, input)) {
			continue
		}
		rows.push(
			makeRow(
				m.startAt,
				m.startLocalDate,
				'Достижение',
				m.title || milestoneTypeLabel(m.milestoneType),
			),
		)
	}

	for (const g of input.measurements) {
		if (!inPeriod(g.measuredLocalDate, input)) {
			continue
		}
		const parts: string[] = []
		if (g.weightGrams != null) {
			parts.push(formatWeightKg(g.weightGrams))
		}
		if (g.heightMm != null) {
			parts.push(formatLengthCm(g.heightMm))
		}
		if (g.headCircumferenceMm != null) {
			parts.push(`голова ${formatLengthCm(g.headCircumferenceMm)}`)
		}
		rows.push(
			makeRow(
				g.measuredAt,
				g.measuredLocalDate,
				'Измерение',
				parts.join(' · ') || '—',
			),
		)
	}

	rows.sort((a, b) => a.sortAt.localeCompare(b.sortAt))
	return rows
}

/** Split chronology into page-friendly table chunks (no silent truncation). */
export function chunkChronologyRows (
	rows: ChronologyRow[],
	chunkSize: number = CHRONOLOGY_ROWS_PER_CHUNK,
): ChronologyRow[][] {
	if (rows.length === 0) {
		return []
	}
	const chunks: ChronologyRow[][] = []
	for (let i = 0; i < rows.length; i += chunkSize) {
		chunks.push(rows.slice(i, i + chunkSize))
	}
	return chunks
}

function formatFeedingDetails (f: FeedingEvent): string {
	const label = feedingTypeLabel(f.type, f.feedingKind)
	if (f.type === 'breastfeeding') {
		const sec = f.leftDurationSeconds + f.rightDurationSeconds
		return sec > 0 ? `${label}, ${formatDurationMs(sec * 1000)}` : label
	}
	if (f.type === 'bottle' || f.type === 'water') {
		return `${label}, ${formatMl(f.amountMl)}`
	}
	if (f.type === 'pumping') {
		return f.amountMl != null ? `${label}, ${formatMl(f.amountMl)}` : label
	}
	return f.foodName ? `${label}: ${f.foodName}` : label
}

function makeRow (
	sortAt: string,
	localDate: string,
	eventLabel: string,
	details: string,
): ChronologyRow {
	const time = formatLocalTime(sortAt)
	return {
		sortAt,
		localDate,
		dateTimeLabel: `${formatRuLongDateWithYear(localDate)}, ${time}`,
		eventLabel,
		details,
	}
}

function inPeriod (
	date: string,
	input: Pick<BuildChronologyInput, 'periodStart' | 'periodEnd'>,
): boolean {
	return date >= input.periodStart && date <= input.periodEnd
}

function overlapsPeriod (
	startLocal: string,
	endLocal: string | null,
	input: Pick<BuildChronologyInput, 'periodStart' | 'periodEnd'>,
): boolean {
	const end = endLocal ?? startLocal
	return startLocal <= input.periodEnd && end >= input.periodStart
}
