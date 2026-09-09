/**
 * Unified Russian timeline presentation for Diary / Today recent rows.
 */

import { sleepTypeLabel } from '../domain/sleepType'
import {
	diaperKindLabel,
} from '../domain/diaperLabels'
import {
	activityTypeLabel,
	formatTemperatureCelsius,
} from '../domain/quickEventLabels'
import { breastfeedingLiveTotals } from '../domain/breastfeedingDuration'
import {
	bottleContentLabel,
	feedingTypeLabel,
} from '../domain/feedingLabels'
import type { DiaperEvent } from '../models/diaper'
import type { FeedingEvent } from '../models/feeding'
import type { SleepEvent } from '../models/sleep'
import type {
	ActivityEvent,
	CustomEvent,
	MedicineEvent,
	NoteEvent,
	TemperatureEvent,
} from '../models/quickEvents'
import { formatDurationMs } from '../utils/durationFormat'
import { formatLocalTime, parseOffsetDateTime } from '../utils/datetime'
import { formatMl, formatFeedingDetail } from './feedingFormat'

export type TimelineKind =
	| 'sleep'
	| 'feeding'
	| 'diaper'
	| 'activity'
	| 'temperature'
	| 'medicine'
	| 'note'
	| 'custom'

export type DiaryFilter = 'all' | 'sleep' | 'feeding' | 'diaper' | 'other'

export interface TimelineRow {
	id: string
	kind: TimelineKind
	startAt: string
	label: string
	isActive: boolean
	href: string
	filterGroup: Exclude<DiaryFilter, 'all'>
}

export function formatDiaperDetail (event: DiaperEvent): string {
	return `Подгузник · ${diaperKindLabel(event.kind).toLowerCase()}`
}

export function formatActivityDetail (event: ActivityEvent): string {
	const name = activityTypeLabel(event.type)
	if (event.durationSeconds != null && event.durationSeconds > 0) {
		return `${name} · ${formatDurationMs(event.durationSeconds * 1000)}`
	}
	return name
}

export function formatTemperatureDetail (event: TemperatureEvent): string {
	return `Температура · ${formatTemperatureCelsius(event.celsius)}`
}

export function formatMedicineDetail (event: MedicineEvent): string {
	const prefix = event.kind === 'vitamin' ? 'Витамин' : 'Лекарство'
	const dose =
		event.doseText != null
			? ` · ${event.doseText}${event.unit ? ` ${event.unit}` : ''}`
			: ''
	return `${prefix} · ${event.name}${dose}`
}

export function formatNoteDetail (event: NoteEvent): string {
	const text = event.title?.trim() || event.notes?.trim() || 'Заметка'
	return `Заметка · ${text}`
}

export function formatCustomDetail (event: CustomEvent): string {
	const name = event.definitionName?.trim() || 'Своё событие'
	if (event.durationSeconds != null && event.durationSeconds > 0) {
		return `${name} · ${formatDurationMs(event.durationSeconds * 1000)}`
	}
	return name
}

export function sleepToTimeline (
	event: SleepEvent,
	nowMs: number,
): TimelineRow {
	const start = formatLocalTime(event.startAt)
	const end =
		event.endAt == null ? 'сейчас' : formatLocalTime(event.endAt)
	const endMs =
		event.endAt == null
			? nowMs
			: parseOffsetDateTime(event.endAt).getTime()
	const durMs = endMs - parseOffsetDateTime(event.startAt).getTime()
	const dur = formatDurationMs(Math.max(0, durMs))
	return {
		id: event.id,
		kind: 'sleep',
		startAt: event.startAt,
		label: `${start}–${end}  Сон · ${dur} · ${sleepTypeLabel(event.sleepType)}`,
		isActive: event.endAt == null,
		href: `/sleep/${event.id}`,
		filterGroup: 'sleep',
	}
}

export function feedingToTimeline (
	event: FeedingEvent,
	nowMs: number,
): TimelineRow {
	return {
		id: event.id,
		kind: 'feeding',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatFeedingDetail(event, nowMs)}`,
		isActive:
			event.type === 'breastfeeding' && event.endAt == null,
		href: `/feeding/${event.id}`,
		filterGroup: 'feeding',
	}
}

export function diaperToTimeline (event: DiaperEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'diaper',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatDiaperDetail(event)}`,
		isActive: false,
		href: `/diaper/${event.id}`,
		filterGroup: 'diaper',
	}
}

export function activityToTimeline (event: ActivityEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'activity',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatActivityDetail(event)}`,
		isActive: false,
		href: `/event/${event.id}?kind=activity`,
		filterGroup: 'other',
	}
}

export function temperatureToTimeline (event: TemperatureEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'temperature',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatTemperatureDetail(event)}`,
		isActive: false,
		href: `/event/${event.id}?kind=temperature`,
		filterGroup: 'other',
	}
}

export function medicineToTimeline (event: MedicineEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'medicine',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatMedicineDetail(event)}`,
		isActive: false,
		href: `/event/${event.id}?kind=medicine`,
		filterGroup: 'other',
	}
}

export function noteToTimeline (event: NoteEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'note',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatNoteDetail(event)}`,
		isActive: false,
		href: `/event/${event.id}?kind=note`,
		filterGroup: 'other',
	}
}

export function customToTimeline (event: CustomEvent): TimelineRow {
	return {
		id: event.id,
		kind: 'custom',
		startAt: event.startAt,
		label: `${formatLocalTime(event.startAt)} ${formatCustomDetail(event)}`,
		isActive: false,
		href: `/event/${event.id}?kind=custom`,
		filterGroup: 'other',
	}
}

/** Latest diaper card summary: «Мокрый · 35 мин назад». */
export function formatLatestDiaperSummary (
	event: DiaperEvent,
	agoLabel: string,
): string {
	return `${diaperKindLabel(event.kind)} · ${agoLabel}`
}

/** Compact feeding snippet for recent-events (reuse duration logic). */
export function formatCompactFeeding (event: FeedingEvent, nowMs: number): string {
	if (event.type === 'breastfeeding') {
		const totals = breastfeedingLiveTotals(event, nowMs)
		return `Грудь · ${formatDurationMs(totals.totalSeconds * 1000)}`
	}
	if (event.type === 'bottle') {
		return `${bottleContentLabel(
			event.feedingKind === 'formula' ? 'formula' : 'expressed_milk',
		)} · ${formatMl(event.amountMl)}`
	}
	return feedingTypeLabel(event.type, event.feedingKind)
}
