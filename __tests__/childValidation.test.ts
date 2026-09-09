/**
 * Child form validation and decimal parsing.
 */

import {
	isBirthDateAllowed,
	parseOptionalHeightCm,
	parseOptionalWeightKg,
	validateChildForm,
	validateChildName,
} from '../src/domain/childValidation'
import { parseDecimalInput } from '../src/utils/decimalParse'

describe('decimal parsing', () => {
	it('accepts comma and dot', () => {
		expect(parseDecimalInput('3,2')).toBe(3.2)
		expect(parseDecimalInput('3.25')).toBe(3.25)
		expect(parseDecimalInput(' 4 ')).toBe(4)
		expect(parseDecimalInput('')).toBeNull()
		expect(parseDecimalInput('abc')).toBeNull()
	})
})

describe('birth date validation', () => {
	it('rejects future dates', () => {
		expect(isBirthDateAllowed('2026-09-10', '2026-09-09')).toBe(false)
		expect(isBirthDateAllowed('2026-09-09', '2026-09-09')).toBe(true)
		expect(isBirthDateAllowed('2025-01-01', '2026-09-09')).toBe(true)
	})
})

describe('child form validation', () => {
	it('requires trimmed name and birth date', () => {
		expect(validateChildName('   ')).toMatch(/имя/i)
		expect(validateChildName('А')).toBeNull()

		const empty = validateChildForm(
			{
				name: '  ',
				birthDate: null,
				birthTime: null,
				sex: null,
				weightKgText: '',
				heightCmText: '',
			},
			'2026-09-09',
		)
		expect(empty.ok).toBe(false)
		expect(empty.errors.length).toBeGreaterThan(0)
	})

	it('parses weight kg with comma into grams', () => {
		const weight = parseOptionalWeightKg('3,2')
		expect(weight.error).toBeNull()
		expect(weight.grams).toBe(3200)

		expect(parseOptionalWeightKg('20').error).toMatch(/кг/i)
	})

	it('parses height cm', () => {
		expect(parseOptionalHeightCm('52').cm).toBe(52)
		expect(parseOptionalHeightCm('5').error).not.toBeNull()
	})

	it('accepts a complete valid form', () => {
		const result = validateChildForm(
			{
				name: '  Мила  ',
				birthDate: '2026-06-01',
				birthTime: '08:30',
				sex: 'female',
				weightKgText: '3,450',
				heightCmText: '51',
			},
			'2026-09-09',
		)
		expect(result.ok).toBe(true)
		expect(result.parsed?.name).toBe('Мила')
		expect(result.parsed?.birthWeightGrams).toBe(3450)
		expect(result.parsed?.birthHeightCm).toBe(51)
	})
})
