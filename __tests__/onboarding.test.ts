/**
 * Onboarding decision and active-child resolution.
 */

import {
	findChildById,
	needsOnboarding,
	resolveActiveChildId,
} from '../src/domain/onboarding'
import type { Child } from '../src/models/types'

function child (partial: Partial<Child> & Pick<Child, 'id' | 'name'>): Child {
	return {
		sex: null,
		birthDate: '2026-01-01',
		birthTime: null,
		birthWeightGrams: null,
		birthHeightCm: null,
		photoUri: null,
		isActive: true,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...partial,
	}
}

describe('needsOnboarding', () => {
	it('is true when there are no children', () => {
		expect(needsOnboarding([])).toBe(true)
	})

	it('is false when at least one child exists', () => {
		expect(needsOnboarding([child({ id: 'c1', name: 'A' })])).toBe(false)
	})
})

describe('resolveActiveChildId', () => {
	const a = child({ id: 'a', name: 'Аня', isActive: true })
	const b = child({ id: 'b', name: 'Боря', isActive: false })

	it('returns null for empty list', () => {
		expect(resolveActiveChildId([], 'a')).toBeNull()
	})

	it('keeps a valid activeChildId', () => {
		expect(resolveActiveChildId([a, b], 'b')).toBe('b')
	})

	it('falls back when saved id is missing', () => {
		expect(resolveActiveChildId([a, b], 'missing')).toBe('a')
	})

	it('prefers isActive flag when setting is empty', () => {
		const inactiveFirst = child({ id: 'x', name: 'X', isActive: false })
		const activeSecond = child({ id: 'y', name: 'Y', isActive: true })
		expect(resolveActiveChildId([inactiveFirst, activeSecond], null)).toBe('y')
	})
})

describe('findChildById', () => {
	it('finds by id without assuming index 0', () => {
		const list = [
			child({ id: 'a', name: 'A' }),
			child({ id: 'b', name: 'B' }),
		]
		expect(findChildById(list, 'b')?.name).toBe('B')
		expect(findChildById(list, null)).toBeNull()
	})
})
