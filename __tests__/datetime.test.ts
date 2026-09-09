/**
 * Date / duration helper tests.
 */

import {
	buildEventEnd,
	buildEventStart,
	durationMs,
	formatDurationMs,
	formatLocalTime,
	isValidDateOnly,
	localDateFromOffsetDateTime,
	toLocalDateOnly,
	toOffsetDateTime,
} from '../src/utils/datetime'

describe('datetime helpers', () => {
	it('validates date-only strings', () => {
		expect(isValidDateOnly('2026-02-28')).toBe(true)
		expect(isValidDateOnly('2026-02-30')).toBe(false)
		expect(isValidDateOnly('02/28/2026')).toBe(false)
	})

	it('builds start/end without relying on bare HH:MM strings', () => {
		const local = new Date(2026, 2, 15, 21, 5, 0)
		const start = buildEventStart(local)
		expect(start.startLocalDate).toBe('2026-03-15')
		expect(start.startAt).toContain('T21:05:00')
		expect(localDateFromOffsetDateTime(start.startAt)).toBe('2026-03-15')

		const endLocal = new Date(2026, 2, 16, 6, 0, 0)
		const end = buildEventEnd(endLocal)
		expect(end.endLocalDate).toBe('2026-03-16')
	})

	it('computes overnight duration reliably', () => {
		const ms = durationMs(
			'2026-03-14T22:00:00+03:00',
			'2026-03-15T06:30:00+03:00',
		)
		expect(ms).toBe(8.5 * 60 * 60 * 1000)
		expect(formatDurationMs(ms!)).toBe('8 ч 30 мин')
	})

	it('returns null duration for ongoing events', () => {
		expect(durationMs('2026-03-15T10:00:00+03:00', null)).toBeNull()
	})

	it('formats local wall-clock time from offset datetime', () => {
		expect(formatLocalTime('2026-03-15T09:07:00+03:00')).toBe('09:07')
	})

	it('toOffsetDateTime / toLocalDateOnly stay consistent for same Date', () => {
		const d = new Date(2026, 0, 5, 0, 15, 0)
		expect(toLocalDateOnly(d)).toBe('2026-01-05')
		expect(toOffsetDateTime(d).startsWith('2026-01-05T00:15:00')).toBe(true)
	})
})
