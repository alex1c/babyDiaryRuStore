/**
 * Today view-model empty aggregates for Phase 1.
 */

import { buildTodayViewModel } from '../src/presentation/todayViewModel'
import type { Child } from '../src/models/types'

const child: Child = {
	id: 'c1',
	name: 'Соня',
	sex: 'female',
	birthDate: '2026-06-01',
	birthTime: null,
	birthWeightGrams: null,
	birthHeightCm: null,
	photoUri: null,
	isActive: true,
	createdAt: '2026-06-01T00:00:00.000Z',
	updatedAt: '2026-06-01T00:00:00.000Z',
}

describe('buildTodayViewModel', () => {
	it('builds empty status cards and zero summary', () => {
		const model = buildTodayViewModel(child, [], '2026-09-09')
		expect(model.childName).toBe('Соня')
		expect(model.ageLabel).toContain('месяц')
		expect(model.statusCards).toHaveLength(3)
		expect(model.statusCards.every((c) => !c.hasData)).toBe(true)
		expect(model.daySummary.find((r) => r.id === 'feeding')?.value).toBe('0')
		expect(model.daySummary.find((r) => r.id === 'sleep')?.value).toBe(
			'нет данных',
		)
	})
})
