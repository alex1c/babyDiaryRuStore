/**
 * Feeding validation and Russian labels.
 */

import type {
	BottleContent,
	BreastSide,
	SolidReaction,
} from '../models/feeding'

export class FeedingValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'FeedingValidationError'
	}
}

export const BOTTLE_QUICK_ML = [30, 60, 90, 120, 150, 180] as const
export const MAX_BOTTLE_ML = 500
export const MAX_WATER_ML = 500
export const MAX_PUMP_ML = 500

export function assertPositiveMl (
	amountMl: number,
	max: number,
	label: string,
): void {
	if (!Number.isFinite(amountMl) || amountMl <= 0) {
		throw new FeedingValidationError(`Укажите объём ${label}`)
	}
	if (!Number.isInteger(amountMl)) {
		throw new FeedingValidationError('Объём укажите целым числом мл')
	}
	if (amountMl > max) {
		throw new FeedingValidationError(
			`Слишком большой объём (максимум ${max} мл)`,
		)
	}
}

export function assertNonNegativeSeconds (value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new FeedingValidationError(`Некорректная длительность: ${label}`)
	}
}

export function breastSideLabel (side: BreastSide): string {
	return side === 'left' ? 'Левая' : 'Правая'
}

export function bottleContentLabel (content: BottleContent): string {
	return content === 'formula' ? 'Смесь' : 'Сцеженное молоко'
}

export function solidReactionLabel (reaction: SolidReaction): string {
	switch (reaction) {
		case 'liked':
			return 'Понравилось'
		case 'neutral':
			return 'Нейтрально'
		case 'disliked':
			return 'Не понравилось'
		case 'possible_reaction':
			return 'Возможная реакция'
	}
}

export function feedingTypeLabel (
	type: string,
	feedingKind?: string,
): string {
	switch (type) {
		case 'breastfeeding':
			return 'Грудь'
		case 'bottle':
			if (feedingKind === 'formula') {
				return 'Смесь'
			}
			if (feedingKind === 'expressed_milk') {
				return 'Сцеженное молоко'
			}
			return 'Бутылочка'
		case 'pumping':
			return 'Сцеживание'
		case 'water':
			return 'Вода'
		case 'solid_food':
			return 'Прикорм'
		default:
			return 'Кормление'
	}
}
