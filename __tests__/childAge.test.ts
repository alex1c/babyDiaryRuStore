/**
 * Child age formatting — calendar months, Russian copy.
 */

import { calculateAgeParts, formatChildAge } from '../src/utils/childAge'

describe('formatChildAge', () => {
	it('formats born today', () => {
		expect(formatChildAge('2026-09-09', '2026-09-09')).toBe('Сегодня родился')
	})

	it('formats a few days', () => {
		expect(formatChildAge('2026-09-06', '2026-09-09')).toBe('3 дня')
		expect(formatChildAge('2026-09-08', '2026-09-09')).toBe('1 день')
	})

	it('formats weeks under one month', () => {
		expect(formatChildAge('2026-08-26', '2026-09-09')).toBe('2 недели')
		expect(formatChildAge('2026-08-25', '2026-09-09')).toBe('2 недели 1 день')
	})

	it('formats months with days using calendar length', () => {
		expect(formatChildAge('2026-08-04', '2026-09-09')).toBe('1 месяц 5 дней')
		expect(formatChildAge('2026-05-01', '2026-09-13')).toBe('4 месяца 12 дней')
	})

	it('formats years and months', () => {
		expect(formatChildAge('2025-07-09', '2026-09-09')).toBe('1 год 2 месяца')
		expect(formatChildAge('2024-09-09', '2026-09-09')).toBe('2 года')
	})

	it('handles February / month-length edges', () => {
		// Born Jan 31 → Feb 28 2026 = 28 days → weeks (still under 1 month).
		expect(formatChildAge('2026-01-31', '2026-02-28')).toBe('4 недели')
		// Jan 31 + 1 clamped month = Feb 28; Mar 1 → 1 month 1 day.
		const parts = calculateAgeParts('2026-01-31', '2026-03-01')
		expect(parts.months).toBe(1)
		expect(parts.days).toBe(1)
		expect(formatChildAge('2026-01-31', '2026-03-01')).toBe('1 месяц 1 день')
	})

	it('rejects future birth dates', () => {
		expect(() => formatChildAge('2026-09-10', '2026-09-09')).toThrow(
			/future/i,
		)
	})
})
