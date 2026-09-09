/**
 * Today sleep / wake presentation built from SQLite sleep rows.
 */

import { aggregateSleepForLocalDay } from '../domain/sleepAggregation'
import {
	formatWakeWindowGuideLabel,
	selectWakeWindowGuide,
	WAKE_WINDOW_DISCLAIMER,
} from '../domain/wakeWindowGuide'
import type { Child } from '../models/types'
import type { SleepEvent } from '../models/sleep'
import { formatChildAge } from '../utils/childAge'
import {
	durationBetweenMs,
	formatDurationMs,
} from '../utils/durationFormat'
import { parseOffsetDateTime, toLocalDateOnly } from '../utils/datetime'

export type SleepCardMode = 'sleeping' | 'awake' | 'empty'

export interface TodaySleepModel {
	childName: string
	ageLabel: string
	mode: SleepCardMode
	/** Active sleep row when mode === sleeping. */
	activeSleep: SleepEvent | null
	/** Wake started at last finished sleep end. */
	wakeStartAt: string | null
	wakeDurationLabel: string | null
	statusTitle: string
	statusSummary: string
	primaryCta: string
	secondaryCta: string
	aggregate: {
		totalLabel: string
		dayLabel: string
		nightLabel: string
		finishedCount: number
		includesActive: boolean
	}
	wakeGuideLabel: string | null
	wakeGuideDisclaimer: string
}

export function buildTodaySleepModel (
	child: Child,
	activeSleep: SleepEvent | null,
	lastFinished: SleepEvent | null,
	daySleeps: readonly SleepEvent[],
	nowMs: number = Date.now(),
	asOfDate: string = toLocalDateOnly(new Date(nowMs)),
): TodaySleepModel {
	const aggregate = aggregateSleepForLocalDay(daySleeps, asOfDate, nowMs)
	const guide = selectWakeWindowGuide(child.birthDate, asOfDate)

	if (activeSleep) {
		return {
			childName: child.name,
			ageLabel: formatChildAge(child.birthDate, asOfDate),
			mode: 'sleeping',
			activeSleep,
			wakeStartAt: null,
			wakeDurationLabel: null,
			statusTitle: 'Малыш спит',
			statusSummary: formatDurationMs(
				durationBetweenMs(activeSleep.startAt, null, nowMs),
			),
			primaryCta: 'Завершить сон',
			secondaryCta: 'Добавить сон',
			aggregate: {
				totalLabel: aggregate.totalLabel,
				dayLabel: aggregate.dayLabel,
				nightLabel: aggregate.nightLabel,
				finishedCount: aggregate.finishedCount,
				includesActive: aggregate.includesActive,
			},
			wakeGuideLabel: null,
			wakeGuideDisclaimer: WAKE_WINDOW_DISCLAIMER,
		}
	}

	if (lastFinished?.endAt) {
		const wakeMs = Math.max(
			0,
			nowMs - parseOffsetDateTime(lastFinished.endAt).getTime(),
		)
		return {
			childName: child.name,
			ageLabel: formatChildAge(child.birthDate, asOfDate),
			mode: 'awake',
			activeSleep: null,
			wakeStartAt: lastFinished.endAt,
			wakeDurationLabel: formatDurationMs(wakeMs),
			statusTitle: 'Бодрствует',
			statusSummary: formatDurationMs(wakeMs),
			primaryCta: 'Начать сон',
			secondaryCta: 'Добавить сон',
			aggregate: {
				totalLabel: aggregate.totalLabel,
				dayLabel: aggregate.dayLabel,
				nightLabel: aggregate.nightLabel,
				finishedCount: aggregate.finishedCount,
				includesActive: aggregate.includesActive,
			},
			wakeGuideLabel: guide ? formatWakeWindowGuideLabel(guide) : null,
			wakeGuideDisclaimer: WAKE_WINDOW_DISCLAIMER,
		}
	}

	return {
		childName: child.name,
		ageLabel: formatChildAge(child.birthDate, asOfDate),
		mode: 'empty',
		activeSleep: null,
		wakeStartAt: null,
		wakeDurationLabel: null,
		statusTitle: 'Сон',
		statusSummary: 'Пока недостаточно данных',
		primaryCta: 'Начать сон',
		secondaryCta: 'Добавить сон',
		aggregate: {
			totalLabel: aggregate.totalMs > 0 ? aggregate.totalLabel : 'нет данных',
			dayLabel: aggregate.dayLabel,
			nightLabel: aggregate.nightLabel,
			finishedCount: aggregate.finishedCount,
			includesActive: aggregate.includesActive,
		},
		wakeGuideLabel: guide ? formatWakeWindowGuideLabel(guide) : null,
		wakeGuideDisclaimer: WAKE_WINDOW_DISCLAIMER,
	}
}
