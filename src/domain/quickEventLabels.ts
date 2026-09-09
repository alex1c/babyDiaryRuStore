/**
 * Labels and validation for everyday / custom quick events.
 */

import { parseDecimalInput } from '../utils/decimalParse'
import type { ActivityEventType, CustomIconKey } from '../models/quickEvents'
import { CUSTOM_ICON_KEYS } from '../models/quickEvents'

export class QuickEventValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'QuickEventValidationError'
	}
}

export const TEMP_MIN_C = 30
export const TEMP_MAX_C = 43

export function activityTypeLabel (type: ActivityEventType): string {
	switch (type) {
		case 'walk':
			return 'Прогулка'
		case 'bath':
			return 'Купание'
		case 'tummy_time':
			return 'Животик'
		case 'massage':
			return 'Массаж'
		case 'doctor':
			return 'Врач'
	}
}

export function customIconLabel (key: string): string {
	switch (key) {
		case 'star':
			return 'Звезда'
		case 'sun':
			return 'Солнце'
		case 'moon':
			return 'Луна'
		case 'home':
			return 'Дом'
		case 'car':
			return 'Машина'
		case 'book':
			return 'Книга'
		case 'music':
			return 'Музыка'
		case 'heart':
			return 'Сердце'
		case 'pool':
			return 'Бассейн'
		case 'gym':
			return 'Спорт'
		default:
			return 'Иконка'
	}
}

export function isCustomIconKey (value: string): value is CustomIconKey {
	return (CUSTOM_ICON_KEYS as readonly string[]).includes(value)
}

/**
 * Parse temperature with decimal comma support. Soft range check.
 */
export function parseTemperatureCelsius (raw: string): number {
	const value = parseDecimalInput(raw)
	if (value == null) {
		throw new QuickEventValidationError('Укажите температуру')
	}
	if (value < TEMP_MIN_C || value > TEMP_MAX_C) {
		throw new QuickEventValidationError(
			`Температура вне диапазона (${TEMP_MIN_C}–${TEMP_MAX_C} °C)`,
		)
	}
	return Math.round(value * 10) / 10
}

/** Display «36,7 °C». */
export function formatTemperatureCelsius (celsius: number): string {
	const text = celsius.toFixed(1).replace('.', ',')
	return `${text} °C`
}

export function assertNonEmptyName (name: string, label: string): string {
	const trimmed = name.trim()
	if (!trimmed) {
		throw new QuickEventValidationError(`Укажите ${label}`)
	}
	return trimmed
}
