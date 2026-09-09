/**
 * Health domain models: symptoms, medicine catalog, doctor visits, attachments.
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'
import type { MedicineKind } from './quickEvents'

export const TEMPERATURE_METHODS = [
	'unset',
	'axillary',
	'ear',
	'forehead',
	'rectal',
] as const

export type TemperatureMethod = (typeof TEMPERATURE_METHODS)[number]

export const SYMPTOM_TYPES = [
	'runny_nose',
	'cough',
	'rash',
	'vomiting',
	'loose_stool',
	'constipation',
	'tummy',
	'teething',
	'poor_appetite',
	'lethargy',
	'restlessness',
	'other',
] as const

export type SymptomType = (typeof SYMPTOM_TYPES)[number]

export const SYMPTOM_SEVERITIES = ['mild', 'moderate', 'strong'] as const
export type SymptomSeverity = (typeof SYMPTOM_SEVERITIES)[number]

export interface SymptomEvent {
	id: string
	childId: string
	startAt: OffsetDateTime
	startLocalDate: DateOnly
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
	symptomType: SymptomType
	customLabel: string | null
	severity: SymptomSeverity | null
	photoUri: string | null
	resolvedAt: OffsetDateTime | null
	/** Display title (standard label or custom). */
	title: string
}

export const MEDICINE_UNITS = [
	'ml',
	'mg',
	'drops',
	'tablet',
	'tablet_part',
	'dose',
	'other',
] as const

export type MedicineUnit = (typeof MEDICINE_UNITS)[number]

export interface MedicineCatalogItem {
	id: string
	childId: string
	kind: MedicineKind
	name: string
	defaultDose: string | null
	defaultUnit: string | null
	notes: string | null
	isActive: boolean
	reminderEnabled: boolean
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export const DOCTOR_SPECIALISTS = [
	'pediatrician',
	'neurologist',
	'ent',
	'surgeon',
	'orthopedist',
	'ophthalmologist',
	'dentist',
	'other',
] as const

export type DoctorSpecialistKey = (typeof DOCTOR_SPECIALISTS)[number]

export interface DoctorVisit {
	id: string
	childId: string
	visitedAt: OffsetDateTime
	visitedLocalDate: DateOnly
	specialistKey: DoctorSpecialistKey
	specialistLabel: string
	reason: string | null
	notes: string | null
	recommendations: string | null
	nextVisitAt: OffsetDateTime | null
	nextVisitLocalDate: DateOnly | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export type HealthAttachmentOwnerKind = 'visit' | 'symptom' | 'note'

export interface HealthAttachment {
	id: string
	childId: string
	ownerKind: HealthAttachmentOwnerKind
	ownerId: string
	fileUri: string
	mimeHint: string | null
	title: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}
