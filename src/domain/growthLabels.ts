/**
 * Soft growth measurement validation and unit conversion.
 * No medical judgments — only absurd-value checks.
 */

import {
	kgToGrams,
	parseDecimalInput,
} from '../utils/decimalParse'

export class GrowthValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'GrowthValidationError'
	}
}

/** Soft bounds — reject only clearly absurd entries. */
export const GROWTH_SOFT_BOUNDS = {
	weightKgMin: 0.3,
	weightKgMax: 80,
	heightCmMin: 20,
	heightCmMax: 200,
	headCmMin: 20,
	headCmMax: 70,
} as const

export function cmToMm (cm: number): number {
	return Math.round(cm * 10)
}

export function mmToCm (mm: number): number {
	return mm / 10
}

/** Format stored grams as UI kg with decimal comma. */
export function formatWeightKg (grams: number): string {
	const kg = grams / 1000
	return formatMeasureNumber(kg) + ' кг'
}

/** Format stored mm as UI cm with decimal comma. */
export function formatLengthCm (mm: number): string {
	return formatMeasureNumber(mmToCm(mm)) + ' см'
}

export function formatMeasureNumber (value: number): string {
	if (Number.isInteger(value)) {
		return String(value)
	}
	// Trim trailing zeros; keep one decimal when useful.
	const fixed = value.toFixed(1)
	const trimmed = fixed.replace(/\.0$/, '')
	return trimmed.replace('.', ',')
}

export function formatCmForInput (mm: number): string {
	return formatMeasureNumber(mmToCm(mm))
}

/**
 * Parse optional kg / cm raw fields into storage units.
 * Empty → null. Invalid / absurd → GrowthValidationError.
 */
export function parseGrowthFields (input: {
	weightKgRaw?: string | null
	heightCmRaw?: string | null
	headCmRaw?: string | null
}): {
	weightGrams: number | null
	heightMm: number | null
	headCircumferenceMm: number | null
} {
	const weightGrams = parseOptionalMeasure(
		input.weightKgRaw,
		GROWTH_SOFT_BOUNDS.weightKgMin,
		GROWTH_SOFT_BOUNDS.weightKgMax,
		kgToGrams,
	)
	const heightMm = parseOptionalMeasure(
		input.heightCmRaw,
		GROWTH_SOFT_BOUNDS.heightCmMin,
		GROWTH_SOFT_BOUNDS.heightCmMax,
		cmToMm,
	)
	const headCircumferenceMm = parseOptionalMeasure(
		input.headCmRaw,
		GROWTH_SOFT_BOUNDS.headCmMin,
		GROWTH_SOFT_BOUNDS.headCmMax,
		cmToMm,
	)

	if (
		weightGrams == null &&
		heightMm == null &&
		headCircumferenceMm == null
	) {
		throw new GrowthValidationError('Укажите хотя бы одно измерение')
	}

	return { weightGrams, heightMm, headCircumferenceMm }
}

function parseOptionalMeasure (
	raw: string | null | undefined,
	min: number,
	max: number,
	toStorage: (n: number) => number,
): number | null {
	if (raw == null || !String(raw).trim()) {
		return null
	}
	const value = parseDecimalInput(String(raw))
	if (value == null || value <= 0) {
		throw new GrowthValidationError('Проверьте введённое значение')
	}
	if (value < min || value > max) {
		throw new GrowthValidationError('Проверьте введённое значение')
	}
	return toStorage(value)
}
