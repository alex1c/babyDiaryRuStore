/**
 * Interval overlap / local-day slicing helpers.
 */

import {
	localDayBoundsMs,
	overlapMs,
	resolveManualSleepEnd,
	sleepOverlapWithLocalDayMs,
} from '../src/utils/intervalOverlap'
import { formatDurationMs, formatElapsedHms } from '../src/utils/durationFormat'
import {
	classifySleepTypeAuto,
	resolveSleepType,
} from '../src/domain/sleepType'
import {
	formatWakeWindowGuideLabel,
	selectWakeWindowGuide,
} from '../src/domain/wakeWindowGuide'
import { buildTodaySleepModel } from '../src/presentation/todaySleepModel'
import type { Child } from '../src/models/types'

describe('interval overlap', () => {
	it('computes local day bounds at civil midnight', () => {
		const bounds = localDayBoundsMs('2026-09-09')
		expect(bounds.endMs - bounds.startMs).toBe(24 * 60 * 60 * 1000)
	})

	it('slices sleep across midnight into the target day', () => {
		const ms = sleepOverlapWithLocalDayMs(
			'2026-09-08T22:00:00+03:00',
			'2026-09-09T06:00:00+03:00',
			'2026-09-09',
		)
		expect(ms).toBe(6 * 60 * 60 * 1000)

		const prev = sleepOverlapWithLocalDayMs(
			'2026-09-08T22:00:00+03:00',
			'2026-09-09T06:00:00+03:00',
			'2026-09-08',
		)
		expect(prev).toBe(2 * 60 * 60 * 1000)
	})

	it('handles 23:59 / 00:00 boundary', () => {
		expect(
			sleepOverlapWithLocalDayMs(
				'2026-09-09T23:59:00+03:00',
				'2026-09-10T00:01:00+03:00',
				'2026-09-09',
			),
		).toBe(60_000)
		expect(
			sleepOverlapWithLocalDayMs(
				'2026-09-09T23:59:00+03:00',
				'2026-09-10T00:01:00+03:00',
				'2026-09-10',
			),
		).toBe(60_000)
	})

	it('returns 0 for non-overlapping intervals', () => {
		expect(
			overlapMs(
				{ startMs: 0, endMs: 10 },
				{ startMs: 10, endMs: 20 },
			),
		).toBe(0)
	})

	it('rolls manual end to next day when clock is earlier', () => {
		const resolved = resolveManualSleepEnd('2026-09-09', '23:20', '01:10')
		expect(resolved.endLocalDate).toBe('2026-09-10')
		expect(resolved.endAt).toContain('T01:10:00')
	})
})

describe('duration formatting', () => {
	it('formats minutes and padded hours', () => {
		expect(formatDurationMs(42 * 60_000)).toBe('42 мин')
		expect(formatDurationMs(65 * 60_000)).toBe('1 ч 05 мин')
		expect(formatDurationMs(8 * 60 * 60_000 + 12 * 60_000)).toBe(
			'8 ч 12 мин',
		)
	})

	it('formats live elapsed hms from timestamps', () => {
		const start = '2026-09-09T10:00:00+03:00'
		const now = new Date('2026-09-09T10:37:12+03:00').getTime()
		expect(formatElapsedHms(start, now)).toBe('00:37:12')
	})
})

describe('sleep type auto', () => {
	it('classifies night and day by start hour', () => {
		expect(classifySleepTypeAuto('2026-09-09T20:00:00+03:00')).toBe('night')
		expect(classifySleepTypeAuto('2026-09-09T02:00:00+03:00')).toBe('night')
		expect(classifySleepTypeAuto('2026-09-09T14:00:00+03:00')).toBe('day')
		expect(resolveSleepType('day', '2026-09-09T22:00:00+03:00')).toBe('day')
	})
})

describe('wake window guide', () => {
	it('selects a range by age in days', () => {
		const guide = selectWakeWindowGuide('2026-09-01', '2026-09-09')
		expect(guide).not.toBeNull()
		expect(formatWakeWindowGuideLabel(guide!)).toMatch(/Ориентир ВБ/)
	})
})

describe('today sleep model wake window', () => {
	const child: Child = {
		id: 'c1',
		name: 'Соня',
		sex: null,
		birthDate: '2026-06-01',
		birthTime: null,
		birthWeightGrams: null,
		birthHeightCm: null,
		photoUri: null,
		isActive: true,
		createdAt: '2026-06-01T00:00:00.000Z',
		updatedAt: '2026-06-01T00:00:00.000Z',
	}

	it('shows insufficient data without finished sleep', () => {
		const model = buildTodaySleepModel(child, null, null, [], Date.now(), '2026-09-09')
		expect(model.mode).toBe('empty')
		expect(model.statusSummary).toMatch(/недостаточно/i)
	})

	it('shows awake after finished sleep', () => {
		const last = {
			id: 's1',
			childId: 'c1',
			startAt: '2026-09-09T10:00:00+03:00',
			endAt: '2026-09-09T11:00:00+03:00',
			startLocalDate: '2026-09-09',
			endLocalDate: '2026-09-09',
			sleepType: 'day' as const,
			notes: null,
			createdAt: 'x',
			updatedAt: 'x',
		}
		const now = new Date('2026-09-09T12:24:00+03:00').getTime()
		const model = buildTodaySleepModel(child, null, last, [last], now, '2026-09-09')
		expect(model.mode).toBe('awake')
		expect(model.statusSummary).toBe('1 ч 24 мин')
		expect(model.wakeGuideLabel).toMatch(/Ориентир/)
	})
})
