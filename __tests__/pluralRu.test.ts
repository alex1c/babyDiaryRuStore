/**
 * Russian pluralization helpers.
 */

import { formatCountRu, pluralRu } from '../src/utils/pluralRu'

describe('pluralRu', () => {
	it('picks one / few / many for day forms', () => {
		expect(pluralRu(1, 'день', 'дня', 'дней')).toBe('день')
		expect(pluralRu(2, 'день', 'дня', 'дней')).toBe('дня')
		expect(pluralRu(5, 'день', 'дня', 'дней')).toBe('дней')
		expect(pluralRu(11, 'день', 'дня', 'дней')).toBe('дней')
		expect(pluralRu(21, 'день', 'дня', 'дней')).toBe('день')
		expect(pluralRu(22, 'день', 'дня', 'дней')).toBe('дня')
	})

	it('formats count with noun', () => {
		expect(formatCountRu(3, 'месяц', 'месяца', 'месяцев')).toBe('3 месяца')
		expect(formatCountRu(1, 'год', 'года', 'лет')).toBe('1 год')
		expect(formatCountRu(5, 'год', 'года', 'лет')).toBe('5 лет')
	})
})
