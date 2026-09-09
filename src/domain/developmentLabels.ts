/**
 * Milestone and tooth Russian labels for Development UI.
 */

import type { MilestoneType, ToothKey } from '../models/development'
import { MILESTONE_TYPES, TOOTH_KEYS } from '../models/development'

export const MILESTONE_TYPE_LABELS: Record<MilestoneType, string> = {
	first_smile: 'Первая улыбка',
	rolled_over: 'Перевернулся',
	sat_up: 'Сел',
	crawled: 'Пополз',
	stood_up: 'Встал',
	first_step: 'Первый шаг',
	first_word: 'Первое слово',
	first_tooth: 'Первый зуб',
	first_laugh: 'Первый смех',
	other: 'Другое',
}

export function milestoneTypeLabel (type: MilestoneType): string {
	return MILESTONE_TYPE_LABELS[type]
}

export function isMilestoneType (value: string): value is MilestoneType {
	return (MILESTONE_TYPES as readonly string[]).includes(value)
}

export function defaultMilestoneTitle (type: MilestoneType): string {
	return MILESTONE_TYPE_LABELS[type]
}

export const TOOTH_LABELS: Record<ToothKey, string> = {
	lower_central_left: 'Нижний центральный левый',
	lower_central_right: 'Нижний центральный правый',
	upper_central_left: 'Верхний центральный левый',
	upper_central_right: 'Верхний центральный правый',
	lower_lateral_left: 'Нижний боковой левый',
	lower_lateral_right: 'Нижний боковой правый',
	upper_lateral_left: 'Верхний боковой левый',
	upper_lateral_right: 'Верхний боковой правый',
	lower_canine_left: 'Нижний клык левый',
	lower_canine_right: 'Нижний клык правый',
	upper_canine_left: 'Верхний клык левый',
	upper_canine_right: 'Верхний клык правый',
	lower_first_molar_left: 'Нижний первый моляр левый',
	lower_first_molar_right: 'Нижний первый моляр правый',
	upper_first_molar_left: 'Верхний первый моляр левый',
	upper_first_molar_right: 'Верхний первый моляр правый',
	lower_second_molar_left: 'Нижний второй моляр левый',
	lower_second_molar_right: 'Нижний второй моляр правый',
	upper_second_molar_left: 'Верхний второй моляр левый',
	upper_second_molar_right: 'Верхний второй моляр правый',
}

export function toothLabel (key: ToothKey): string {
	return TOOTH_LABELS[key]
}

export function isToothKey (value: string): value is ToothKey {
	return (TOOTH_KEYS as readonly string[]).includes(value)
}

/** Compact ordered list for selectors (primary teeth first). */
export const TOOTH_SELECTOR_ORDER: ToothKey[] = [...TOOTH_KEYS]
