/**
 * Validation helpers for child profile create / edit forms.
 */

import type { ChildSex, CreateChildInput, DateOnly } from '../models/types'
import { isValidDateOnly, toLocalDateOnly } from '../utils/datetime'
import { kgToGrams, parseDecimalInput } from '../utils/decimalParse'

export const CHILD_NAME_MAX_LENGTH = 40

/** Reasonable birth-weight bounds in kilograms. */
export const BIRTH_WEIGHT_KG_MIN = 0.5
export const BIRTH_WEIGHT_KG_MAX = 8

/** Reasonable birth-height bounds in centimetres. */
export const BIRTH_HEIGHT_CM_MIN = 20
export const BIRTH_HEIGHT_CM_MAX = 70

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface ChildFormValues {
	name: string
	birthDate: DateOnly | null
	birthTime: string | null
	sex: ChildSex | null
	/** Raw weight text from the form (kg). */
	weightKgText: string
	/** Raw height text from the form (cm). */
	heightCmText: string
	/** Optional managed profile photo URI. */
	photoUri: string | null
}

export interface ChildFormParsed {
	name: string
	birthDate: DateOnly
	birthTime: string | null
	sex: ChildSex | null
	birthWeightGrams: number | null
	birthHeightCm: number | null
	photoUri: string | null
}

export interface ValidationResult {
	ok: boolean
	errors: string[]
	parsed: ChildFormParsed | null
}

export function isBirthDateAllowed (
	birthDate: DateOnly,
	today: DateOnly = toLocalDateOnly(),
): boolean {
	if (!isValidDateOnly(birthDate)) {
		return false
	}
	// Future civil dates are not allowed.
	return birthDate <= today
}

export function validateBirthDate (
	birthDate: DateOnly | null | undefined,
	today: DateOnly = toLocalDateOnly(),
): string | null {
	if (!birthDate) {
		return 'Укажите дату рождения'
	}
	if (!isValidDateOnly(birthDate)) {
		return 'Некорректная дата рождения'
	}
	if (!isBirthDateAllowed(birthDate, today)) {
		return 'Дата рождения не может быть в будущем'
	}
	return null
}

export function validateChildName (name: string): string | null {
	const trimmed = name.trim()
	if (!trimmed) {
		return 'Укажите имя малыша'
	}
	if (trimmed.length > CHILD_NAME_MAX_LENGTH) {
		return `Имя слишком длинное (максимум ${CHILD_NAME_MAX_LENGTH} символов)`
	}
	return null
}

export function parseOptionalWeightKg (raw: string): {
	error: string | null
	grams: number | null
} {
	if (!raw.trim()) {
		return { error: null, grams: null }
	}
	const kg = parseDecimalInput(raw)
	if (kg == null) {
		return { error: 'Вес укажите числом, например 3,2', grams: null }
	}
	if (kg < BIRTH_WEIGHT_KG_MIN || kg > BIRTH_WEIGHT_KG_MAX) {
		return {
			error: `Вес при рождении: от ${BIRTH_WEIGHT_KG_MIN} до ${BIRTH_WEIGHT_KG_MAX} кг`,
			grams: null,
		}
	}
	return { error: null, grams: kgToGrams(kg) }
}

export function parseOptionalHeightCm (raw: string): {
	error: string | null
	cm: number | null
} {
	if (!raw.trim()) {
		return { error: null, cm: null }
	}
	const cm = parseDecimalInput(raw)
	if (cm == null) {
		return { error: 'Рост укажите числом, например 52', cm: null }
	}
	if (cm < BIRTH_HEIGHT_CM_MIN || cm > BIRTH_HEIGHT_CM_MAX) {
		return {
			error: `Рост при рождении: от ${BIRTH_HEIGHT_CM_MIN} до ${BIRTH_HEIGHT_CM_MAX} см`,
			cm: null,
		}
	}
	if (cm <= 0) {
		return { error: 'Рост должен быть положительным', cm: null }
	}
	return { error: null, cm }
}

export function validateBirthTime (value: string | null): string | null {
	if (value == null || value.trim() === '') {
		return null
	}
	if (!TIME_RE.test(value.trim())) {
		return 'Время рождения в формате ЧЧ:ММ'
	}
	return null
}

/**
 * Validate the full profile form and produce repository-ready values.
 */
export function validateChildForm (
	values: ChildFormValues,
	today: DateOnly = toLocalDateOnly(),
): ValidationResult {
	const errors: string[] = []

	const nameError = validateChildName(values.name)
	if (nameError) {
		errors.push(nameError)
	}

	const birthError = validateBirthDate(values.birthDate, today)
	if (birthError) {
		errors.push(birthError)
	}

	const timeError = validateBirthTime(values.birthTime)
	if (timeError) {
		errors.push(timeError)
	}

	const weight = parseOptionalWeightKg(values.weightKgText)
	if (weight.error) {
		errors.push(weight.error)
	}

	const height = parseOptionalHeightCm(values.heightCmText)
	if (height.error) {
		errors.push(height.error)
	}

	if (errors.length > 0 || !values.birthDate) {
		return { ok: false, errors, parsed: null }
	}

	const parsed: ChildFormParsed = {
		name: values.name.trim(),
		birthDate: values.birthDate,
		birthTime: values.birthTime?.trim() || null,
		sex: values.sex,
		birthWeightGrams: weight.grams,
		birthHeightCm: height.cm,
		photoUri: values.photoUri,
	}

	return { ok: true, errors: [], parsed }
}

export function toCreateChildInput (parsed: ChildFormParsed): CreateChildInput {
	return {
		name: parsed.name,
		birthDate: parsed.birthDate,
		birthTime: parsed.birthTime,
		sex: parsed.sex,
		birthWeightGrams: parsed.birthWeightGrams,
		birthHeightCm: parsed.birthHeightCm,
		photoUri: parsed.photoUri,
		isActive: true,
	}
}
