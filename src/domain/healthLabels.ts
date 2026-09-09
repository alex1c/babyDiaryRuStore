/**
 * Russian labels for Health section (observations only — no diagnoses).
 */

import type {
	DoctorSpecialistKey,
	MedicineUnit,
	SymptomSeverity,
	SymptomType,
	TemperatureMethod,
} from '../models/health'
import {
	DOCTOR_SPECIALISTS,
	MEDICINE_UNITS,
	SYMPTOM_SEVERITIES,
	SYMPTOM_TYPES,
	TEMPERATURE_METHODS,
} from '../models/health'

export const HEALTH_DISCLAIMER =
	'Приложение не заменяет консультацию врача.'

export function temperatureMethodLabel (method: TemperatureMethod): string {
	switch (method) {
		case 'axillary':
			return 'Подмышка'
		case 'ear':
			return 'Ушной'
		case 'forehead':
			return 'Лоб'
		case 'rectal':
			return 'Ректально'
		case 'unset':
		default:
			return 'Не указано'
	}
}

export function isTemperatureMethod (value: string): value is TemperatureMethod {
	return (TEMPERATURE_METHODS as readonly string[]).includes(value)
}

export const SYMPTOM_TYPE_LABELS: Record<SymptomType, string> = {
	runny_nose: 'Насморк',
	cough: 'Кашель',
	rash: 'Сыпь',
	vomiting: 'Рвота',
	loose_stool: 'Жидкий стул',
	constipation: 'Запор',
	tummy: 'Живот',
	teething: 'Зубы/дёсны',
	poor_appetite: 'Плохой аппетит',
	lethargy: 'Вялость',
	restlessness: 'Беспокойство',
	other: 'Другое',
}

export function symptomTypeLabel (type: SymptomType): string {
	return SYMPTOM_TYPE_LABELS[type]
}

export function isSymptomType (value: string): value is SymptomType {
	return (SYMPTOM_TYPES as readonly string[]).includes(value)
}

export function symptomSeverityLabel (severity: SymptomSeverity): string {
	switch (severity) {
		case 'mild':
			return 'Лёгкий'
		case 'moderate':
			return 'Средний'
		case 'strong':
			return 'Выраженный'
	}
}

export function isSymptomSeverity (value: string): value is SymptomSeverity {
	return (SYMPTOM_SEVERITIES as readonly string[]).includes(value)
}

export const MEDICINE_UNIT_LABELS: Record<MedicineUnit, string> = {
	ml: 'мл',
	mg: 'мг',
	drops: 'капли',
	tablet: 'таблетка',
	tablet_part: 'часть таблетки',
	dose: 'доза',
	other: 'другое',
}

export function medicineUnitLabel (unit: string): string {
	if ((MEDICINE_UNITS as readonly string[]).includes(unit)) {
		return MEDICINE_UNIT_LABELS[unit as MedicineUnit]
	}
	return unit
}

export function isMedicineUnit (value: string): value is MedicineUnit {
	return (MEDICINE_UNITS as readonly string[]).includes(value)
}

export const DOCTOR_SPECIALIST_LABELS: Record<DoctorSpecialistKey, string> = {
	pediatrician: 'Педиатр',
	neurologist: 'Невролог',
	ent: 'ЛОР',
	surgeon: 'Хирург',
	orthopedist: 'Ортопед',
	ophthalmologist: 'Офтальмолог',
	dentist: 'Стоматолог',
	other: 'Другое',
}

export function doctorSpecialistLabel (key: DoctorSpecialistKey): string {
	return DOCTOR_SPECIALIST_LABELS[key]
}

export function isDoctorSpecialistKey (
	value: string,
): value is DoctorSpecialistKey {
	return (DOCTOR_SPECIALISTS as readonly string[]).includes(value)
}

export function defaultSpecialistLabel (
	key: DoctorSpecialistKey,
	custom?: string | null,
): string {
	if (key === 'other') {
		return custom?.trim() || 'Другое'
	}
	return DOCTOR_SPECIALIST_LABELS[key]
}
