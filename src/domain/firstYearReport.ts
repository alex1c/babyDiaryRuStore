/**
 * First-year memorial report model (foundation for album PDF / preview).
 */

import {
	buildFirstYearFoundation,
	type FirstYearMonthBundle,
} from './firstYearFoundation'
import type {
	MilestoneEvent,
	MomentRecord,
	MonthPhotoSelection,
	ToothRecord,
} from '../models/development'
import type { GrowthMeasurement } from '../models/growth'
import type { Child, DateOnly } from '../models/types'

export interface FirstYearReportData {
	child: Pick<Child, 'id' | 'name' | 'birthDate'>
	birthDate: DateOnly
	months: FirstYearMonthBundle[]
	/** ISO-ish generation stamp for display (local date). */
	generatedLocalDate: DateOnly
}

export interface BuildFirstYearReportInput {
	child: Pick<Child, 'id' | 'name' | 'birthDate'>
	measurements: GrowthMeasurement[]
	milestones: MilestoneEvent[]
	teeth: ToothRecord[]
	moments: MomentRecord[]
	monthPhotos: MonthPhotoSelection[]
	generatedLocalDate: DateOnly
}

/**
 * Assemble FirstYearReportData from preloaded lists (no DB).
 */
export function buildFirstYearReportData (
	input: BuildFirstYearReportInput,
): FirstYearReportData {
	const months = buildFirstYearFoundation({
		birthDate: input.child.birthDate,
		measurements: input.measurements,
		milestones: input.milestones,
		teeth: input.teeth,
		moments: input.moments,
		monthPhotos: input.monthPhotos,
	})
	return {
		child: input.child,
		birthDate: input.child.birthDate,
		months,
		generatedLocalDate: input.generatedLocalDate,
	}
}

/** True when the month has any memorable content to show. */
export function firstYearMonthHasContent (month: FirstYearMonthBundle): boolean {
	return (
		month.monthPhoto != null ||
		month.milestones.length > 0 ||
		month.measurements.length > 0 ||
		month.teeth.length > 0 ||
		month.moments.length > 0
	)
}
