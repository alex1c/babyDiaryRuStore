/**
 * Growth measurement domain types (stored as grams / mm).
 */

import type { DateOnly, OffsetDateTime, UtcInstant } from './types'

export interface GrowthMeasurement {
	id: string
	childId: string
	measuredAt: OffsetDateTime
	measuredLocalDate: DateOnly
	weightGrams: number | null
	heightMm: number | null
	headCircumferenceMm: number | null
	notes: string | null
	createdAt: UtcInstant
	updatedAt: UtcInstant
}

export interface CreateGrowthInput {
	childId: string
	measuredAt?: OffsetDateTime
	weightKgRaw?: string | null
	heightCmRaw?: string | null
	headCmRaw?: string | null
	notes?: string | null
}

export interface UpdateGrowthInput {
	measuredAt?: OffsetDateTime
	weightKgRaw?: string | null
	heightCmRaw?: string | null
	headCmRaw?: string | null
	notes?: string | null
}
