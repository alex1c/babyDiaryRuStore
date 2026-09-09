/**
 * Unified Russian timeline presentation for Diary.
 * Two-line rows: time + title / subtitle; searchText is separate from display.
 */

import { sleepTypeLabel } from '../domain/sleepType'
import { diaperKindLabel } from '../domain/diaperLabels'
import {
	activityTypeLabel,
	formatTemperatureCelsius,
} from '../domain/quickEventLabels'
import { breastfeedingLiveTotals } from '../domain/breastfeedingDuration'
import {
	bottleContentLabel,
	breastSideLabel,
	feedingTypeLabel,
} from '../domain/feedingLabels'
import type { MilestoneEvent } from '../models/development'
import type { DiaperEvent } from '../models/diaper'
import type { FeedingEvent } from '../models/feeding'
import type { SleepEvent } from '../models/sleep'
import type { DoctorVisit, SymptomEvent } from '../models/health'
import type {
	ActivityEvent,
	CustomEvent,
	MedicineEvent,
	NoteEvent,
	TemperatureEvent,
} from '../models/quickEvents'
import { formatDurationMs } from '../utils/durationFormat'
import {
	formatLocalTime,
	localDateFromOffsetDateTime,
	parseOffsetDateTime,
} from '../utils/datetime'
import { formatMl } from './feedingFormat'
import {
	diaryVisualForKind,
	type DiaryAccentToken,
} from './diaryVisual'

export type TimelineKind =
	| 'sleep'
	| 'feeding'
	| 'diaper'
	| 'activity'
	| 'temperature'
	| 'medicine'
	| 'note'
	| 'custom'
	| 'milestone'
	| 'symptom'
	| 'doctor'

export type DiaryFilter = 'all' | 'sleep' | 'feeding' | 'diaper' | 'other'

export type DiaryOtherFilter =
	| 'all'
	| 'activity'
	| 'temperature'
	| 'medicine'
	| 'custom'
	| 'milestone'
	| 'symptom'
	| 'doctor'

export interface TimelineRow {
	id: string
	kind: TimelineKind
	startAt: string
	/** Primary local date for day grouping (start, or selected day for overnight). */
	groupLocalDate: string
	timeLabel: string
	title: string
	subtitle: string
	/** Flat label for simple lists / accessibility. */
	label: string
	searchText: string
	isActive: boolean
	href: string
	filterGroup: Exclude<DiaryFilter, 'all'>
	otherGroup: DiaryOtherFilter
	iconKey: string
	accent: DiaryAccentToken
}

function withVisual (
	kind: TimelineKind,
	row: Omit<TimelineRow, 'kind' | 'iconKey' | 'accent' | 'label'>,
): TimelineRow {
	const visual = diaryVisualForKind(kind)
	const label = `${row.timeLabel}  ${row.title}${
		row.subtitle ? ` · ${row.subtitle}` : ''
	}`
	return {
		...row,
		kind,
		label,
		iconKey: visual.iconKey,
		accent: visual.accent,
	}
}

function joinSearch (...parts: (string | null | undefined)[]): string {
	return parts
		.filter((p): p is string => Boolean(p && p.trim()))
		.join(' ')
		.toLocaleLowerCase('ru')
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

/**
 * Sleep row for a selected diary day — overnight sleeps stay visible on the
 * morning day without duplicating the SQLite row.
 */
export function sleepToTimelineForDay (
	event: SleepEvent,
	selectedLocalDate: string,
	nowMs: number,
): TimelineRow {
	const startLocal = event.startLocalDate
	const endLocal =
		event.endLocalDate ??
		(event.endAt ? localDateFromOffsetDateTime(event.endAt) : selectedLocalDate)
	const startClock = formatLocalTime(event.startAt)
	const endClock =
		event.endAt == null ? 'сейчас' : formatLocalTime(event.endAt)

	let timeLabel = `${startClock}–${endClock}`
	if (startLocal < selectedLocalDate) {
		timeLabel = `с ${startClock}–${endClock}`
	} else if (event.endAt && endLocal > selectedLocalDate) {
		timeLabel = `${startClock}→`
	}

	const endMs =
		event.endAt == null
			? nowMs
			: parseOffsetDateTime(event.endAt).getTime()
	const durMs = Math.max(
		0,
		endMs - parseOffsetDateTime(event.startAt).getTime(),
	)
	const active = event.endAt == null
	const subtitle = active
		? `идёт · ${sleepTypeLabel(event.sleepType)}`
		: `${formatDurationMs(durMs)} · ${sleepTypeLabel(event.sleepType)}`

	return withVisual('sleep', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: selectedLocalDate,
		timeLabel,
		title: 'Сон',
		subtitle,
		searchText: joinSearch(
			'сон',
			sleepTypeLabel(event.sleepType),
			event.notes,
		),
		isActive: active,
		href: `/sleep/${event.id}`,
		filterGroup: 'sleep',
		otherGroup: 'all',
	})
}

export function sleepToTimeline (
	event: SleepEvent,
	nowMs: number,
): TimelineRow {
	return sleepToTimelineForDay(event, event.startLocalDate, nowMs)
}

export function feedingToTimeline (
	event: FeedingEvent,
	nowMs: number,
): TimelineRow {
	const active = event.type === 'breastfeeding' && event.endAt == null
	let title = feedingTypeLabel(event.type, event.feedingKind)
	let subtitle = ''
	let searchExtra = ''

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
			if (sides.length === 0) {
				sides.push(breastSideLabel(event.lastSide).toLowerCase())
			}
			title = 'Грудь'
			subtitle = active
				? `идёт · ${sides.join(' + ')}`
				: `${sides.join(' + ')} · ${formatDurationMs(totals.totalSeconds * 1000)}`
			searchExtra = joinSearch(event.notes)
			break
		}
		case 'bottle':
			title = bottleContentLabel(
				event.feedingKind === 'formula' ? 'formula' : 'expressed_milk',
			)
			subtitle = formatMl(event.amountMl)
			searchExtra = joinSearch(event.notes)
			break
		case 'water':
			title = 'Вода'
			subtitle = formatMl(event.amountMl)
			searchExtra = joinSearch(event.notes)
			break
		case 'pumping':
			title = 'Сцеживание'
			subtitle = [
				event.amountMl != null ? formatMl(event.amountMl) : null,
				event.durationSeconds != null
					? formatDurationMs(event.durationSeconds * 1000)
					: null,
			]
				.filter(Boolean)
				.join(' · ')
			searchExtra = joinSearch(event.notes)
			break
		case 'solid_food':
			title = 'Прикорм'
			subtitle = event.foodName
			searchExtra = joinSearch(event.foodName, event.amountText, event.notes)
			break
	}

	return withVisual('feeding', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title,
		subtitle,
		searchText: joinSearch(title, subtitle, searchExtra),
		isActive: active,
		href: `/feeding/${event.id}`,
		filterGroup: 'feeding',
		otherGroup: 'all',
	})
}

export function diaperToTimeline (event: DiaperEvent): TimelineRow {
	const kind = diaperKindLabel(event.kind)
	return withVisual('diaper', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title: 'Подгузник',
		subtitle: kind.toLowerCase(),
		searchText: joinSearch('подгузник', kind, event.notes),
		isActive: false,
		href: `/diaper/${event.id}`,
		filterGroup: 'diaper',
		otherGroup: 'all',
	})
}

export function activityToTimeline (event: ActivityEvent): TimelineRow {
	const title = activityTypeLabel(event.type)
	const subtitle =
		event.durationSeconds != null && event.durationSeconds > 0
			? formatDurationMs(event.durationSeconds * 1000)
			: ''
	return withVisual('activity', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title,
		subtitle,
		searchText: joinSearch(title, event.place, event.notes),
		isActive: false,
		href: `/event/${event.id}?kind=activity`,
		filterGroup: 'other',
		otherGroup: 'activity',
	})
}

export function temperatureToTimeline (event: TemperatureEvent): TimelineRow {
	const subtitle = formatTemperatureCelsius(event.celsius)
	return withVisual('temperature', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title: 'Температура',
		subtitle,
		searchText: joinSearch('температура', subtitle, event.notes),
		isActive: false,
		href: `/health/temperature?id=${event.id}`,
		filterGroup: 'other',
		otherGroup: 'temperature',
	})
}

export function medicineToTimeline (event: MedicineEvent): TimelineRow {
	const title = event.kind === 'vitamin' ? 'Витамин' : 'Лекарство'
	const subtitle = [
		event.name,
		event.doseText
			? `${event.doseText}${event.unit ? ` ${event.unit}` : ''}`
			: null,
	]
		.filter(Boolean)
		.join(' · ')
	return withVisual('medicine', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title,
		subtitle,
		searchText: joinSearch(title, event.name, event.doseText, event.unit, event.notes),
		isActive: false,
		href: `/health/medicine?id=${event.id}`,
		filterGroup: 'other',
		otherGroup: 'medicine',
	})
}

export function noteToTimeline (event: NoteEvent): TimelineRow {
	const subtitle = event.title?.trim() || event.notes?.trim() || ''
	return withVisual('note', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title: 'Заметка',
		subtitle,
		searchText: joinSearch('заметка', event.title, event.notes),
		isActive: false,
		href: `/event/${event.id}?kind=note`,
		filterGroup: 'other',
		otherGroup: 'all',
	})
}

export function customToTimeline (event: CustomEvent): TimelineRow {
	const title = event.definitionName?.trim() || 'Своё событие'
	const subtitle =
		event.durationSeconds != null && event.durationSeconds > 0
			? formatDurationMs(event.durationSeconds * 1000)
			: ''
	return withVisual('custom', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title,
		subtitle,
		searchText: joinSearch(title, event.notes),
		isActive: false,
		href: `/event/${event.id}?kind=custom`,
		filterGroup: 'other',
		otherGroup: 'custom',
	})
}

/** Milestones appear under Diary «Другое». */
export function milestoneToTimeline (event: MilestoneEvent): TimelineRow {
	return withVisual('milestone', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title: 'Достижение',
		subtitle: event.title,
		searchText: joinSearch('достижение', event.title, event.notes),
		isActive: false,
		href: `/development/milestone/${event.id}`,
		filterGroup: 'other',
		otherGroup: 'milestone',
	})
}

export function symptomToTimeline (event: SymptomEvent): TimelineRow {
	return withVisual('symptom', {
		id: event.id,
		startAt: event.startAt,
		groupLocalDate: event.startLocalDate,
		timeLabel: formatLocalTime(event.startAt),
		title: 'Симптом',
		subtitle: event.title,
		searchText: joinSearch('симптом', event.title, event.notes),
		isActive: event.resolvedAt == null,
		href: `/health/symptom?id=${event.id}`,
		filterGroup: 'other',
		otherGroup: 'symptom',
	})
}

export function doctorVisitToTimeline (visit: DoctorVisit): TimelineRow {
	return withVisual('doctor', {
		id: visit.id,
		startAt: visit.visitedAt,
		groupLocalDate: visit.visitedLocalDate,
		timeLabel: formatLocalTime(visit.visitedAt),
		title: visit.specialistLabel,
		subtitle: visit.reason?.trim() || 'Визит к врачу',
		searchText: joinSearch(
			visit.specialistLabel,
			visit.reason,
			visit.notes,
			'врач',
		),
		isActive: false,
		href: `/health/visit?id=${visit.id}`,
		filterGroup: 'other',
		otherGroup: 'doctor',
	})
}

export function matchesDiarySearch (
	row: TimelineRow,
	query: string,
): boolean {
	const q = query.trim().toLocaleLowerCase('ru')
	if (!q) {
		return true
	}
	return row.searchText.includes(q)
}

export function matchesDiaryFilters (
	row: TimelineRow,
	filter: DiaryFilter,
	otherFilter: DiaryOtherFilter,
): boolean {
	if (filter === 'all') {
		return true
	}
	if (row.filterGroup !== filter) {
		return false
	}
	if (filter === 'other' && otherFilter !== 'all') {
		return row.otherGroup === otherFilter
	}
	return true
}
