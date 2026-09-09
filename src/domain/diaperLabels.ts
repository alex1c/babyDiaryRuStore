/**
 * Diaper labels, validation, and daily aggregation.
 */

import type {
	DiaperColor,
	DiaperConsistency,
	DiaperEvent,
	DiaperKind,
} from '../models/diaper'

export class DiaperValidationError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'DiaperValidationError'
	}
}

export function diaperKindLabel (kind: DiaperKind): string {
	switch (kind) {
		case 'wet':
			return 'Мокрый'
		case 'dirty':
			return 'Грязный'
		case 'both':
			return 'Оба'
		case 'dry':
			return 'Сухой'
	}
}

export function diaperColorLabel (color: DiaperColor): string {
	switch (color) {
		case 'yellow':
			return 'Жёлтый'
		case 'brown':
			return 'Коричневый'
		case 'green':
			return 'Зелёный'
		case 'black':
			return 'Тёмный'
		case 'other':
			return 'Другой'
	}
}

export function diaperConsistencyLabel (value: DiaperConsistency): string {
	switch (value) {
		case 'liquid':
			return 'Жидкий'
		case 'soft':
			return 'Мягкий'
		case 'formed':
			return 'Оформленный'
		case 'hard':
			return 'Плотный'
		case 'other':
			return 'Другое'
	}
}

export const DIAPER_COLORS: DiaperColor[] = [
	'yellow',
	'brown',
	'green',
	'black',
	'other',
]

export const DIAPER_CONSISTENCIES: DiaperConsistency[] = [
	'liquid',
	'soft',
	'formed',
	'hard',
	'other',
]

export interface DailyDiaperAggregate {
	totalCount: number
	wetCount: number
	dirtyCount: number
	bothCount: number
	dryCount: number
}

export function emptyDiaperAggregate (): DailyDiaperAggregate {
	return {
		totalCount: 0,
		wetCount: 0,
		dirtyCount: 0,
		bothCount: 0,
		dryCount: 0,
	}
}

/**
 * Count each diaper once. `both` increments bothCount only (not wet+dirty).
 */
export function aggregateDiapersForLocalDay (
	diapers: readonly DiaperEvent[],
): DailyDiaperAggregate {
	const agg = emptyDiaperAggregate()
	for (const item of diapers) {
		agg.totalCount += 1
		switch (item.kind) {
			case 'wet':
				agg.wetCount += 1
				break
			case 'dirty':
				agg.dirtyCount += 1
				break
			case 'both':
				agg.bothCount += 1
				break
			case 'dry':
				agg.dryCount += 1
				break
		}
	}
	return agg
}
