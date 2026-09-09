/**
 * Load FirstYearReportData for memorial preview / future album PDF.
 */

import { buildFirstYearReportData } from '../domain/firstYearReport'
import type { FirstYearReportData } from '../domain/firstYearReport'
import type { Child } from '../models/types'
import type { GrowthRepository } from '../repositories/growthRepository'
import type { MilestoneRepository } from '../repositories/milestoneRepository'
import type { MomentRepository } from '../repositories/momentRepository'
import type { ToothRepository } from '../repositories/toothRepository'
import { toLocalDateOnly } from '../utils/datetime'

export interface FirstYearLoadRepos {
	growth: GrowthRepository
	milestones: MilestoneRepository
	teeth: ToothRepository
	moments: MomentRepository
}

export async function loadFirstYearReport (
	repos: FirstYearLoadRepos,
	child: Pick<Child, 'id' | 'name' | 'birthDate'>,
	today: string = toLocalDateOnly(),
): Promise<FirstYearReportData> {
	// Sequential loads — never Promise.all on one NativeDatabase.
	const measurements = await repos.growth.listByChild(child.id, 500)
	const milestones = await repos.milestones.listByChild(child.id, 500)
	const teeth = await repos.teeth.listByChild(child.id)
	const moments = await repos.moments.listByChild(child.id, 500)
	const monthPhotos = await repos.moments.listMonthPhotos(child.id)

	return buildFirstYearReportData({
		child,
		measurements,
		milestones,
		teeth,
		moments,
		monthPhotos,
		generatedLocalDate: today,
	})
}
