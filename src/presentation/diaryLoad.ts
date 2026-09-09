/**
 * Diary data loading — day-scoped queries (primary) and limited history (All).
 * Always sequential SQLite access — never Promise.all on one NativeDatabase.
 */

import { aggregateDiapersForLocalDay } from '../domain/diaperLabels'
import { aggregateFeedingsForLocalDay } from '../domain/feedingAggregation'
import { aggregateSleepForLocalDay } from '../domain/sleepAggregation'
import type { DiaperRepository } from '../repositories/diaperRepository'
import type { DoctorVisitRepository } from '../repositories/doctorVisitRepository'
import type { FeedingRepository } from '../repositories/feedingRepository'
import type { MilestoneRepository } from '../repositories/milestoneRepository'
import type { QuickEventRepository } from '../repositories/quickEventRepository'
import type { SleepRepository } from '../repositories/sleepRepository'
import type { SymptomRepository } from '../repositories/symptomRepository'
import {
	buildDiaryDaySummary,
	type DiaryDaySummary,
} from '../presentation/diaryDaySummary'
import {
	activityToTimeline,
	customToTimeline,
	diaperToTimeline,
	doctorVisitToTimeline,
	feedingToTimeline,
	medicineToTimeline,
	milestoneToTimeline,
	noteToTimeline,
	sleepToTimeline,
	sleepToTimelineForDay,
	symptomToTimeline,
	temperatureToTimeline,
	type TimelineRow,
} from '../presentation/diaryTimeline'

export const DIARY_HISTORY_PAGE_SIZE = 120

export interface DiaryLoadRepos {
	sleep: SleepRepository
	feeding: FeedingRepository
	diaper: DiaperRepository
	quickEvents: QuickEventRepository
	milestones: MilestoneRepository
	symptoms: SymptomRepository
	doctorVisits: DoctorVisitRepository
}

export interface DiaryDayBundle {
	rows: TimelineRow[]
	summary: DiaryDaySummary
}

/** Load events for one local calendar day (newest first). */
export async function loadDiaryDay (
	repos: DiaryLoadRepos,
	childId: string,
	localDate: string,
	nowMs: number = Date.now(),
): Promise<DiaryDayBundle> {
	const sleeps = await repos.sleep.listOverlappingLocalDay(childId, localDate)
	const feedings = await repos.feeding.listByChildAndLocalDate(
		childId,
		localDate,
	)
	const diapers = await repos.diaper.listByChildAndLocalDate(
		childId,
		localDate,
	)
	const activities = await repos.quickEvents.listActivitiesByChildAndLocalDate(
		childId,
		localDate,
	)
	const temps = await repos.quickEvents.listTemperaturesByChildAndLocalDate(
		childId,
		localDate,
	)
	const medicines = await repos.quickEvents.listMedicinesByChildAndLocalDate(
		childId,
		localDate,
	)
	const notes = await repos.quickEvents.listNotesByChildAndLocalDate(
		childId,
		localDate,
	)
	const customs = await repos.quickEvents.listCustomEventsByChildAndLocalDate(
		childId,
		localDate,
	)
	const milestones = await repos.milestones.listByChildAndLocalDate(
		childId,
		localDate,
	)
	const symptoms = await repos.symptoms.listByChildAndLocalDate(
		childId,
		localDate,
	)
	const visits = await repos.doctorVisits.listByChildAndLocalDate(
		childId,
		localDate,
	)

	const rows: TimelineRow[] = [
		...sleeps.map((e) => sleepToTimelineForDay(e, localDate, nowMs)),
		...feedings.map((e) => feedingToTimeline(e, nowMs)),
		...diapers.map((e) => diaperToTimeline(e)),
		...activities.map((e) => activityToTimeline(e)),
		...temps.map((e) => temperatureToTimeline(e)),
		...medicines.map((e) => medicineToTimeline(e)),
		...notes.map((e) => noteToTimeline(e)),
		...customs.map((e) => customToTimeline(e)),
		...milestones.map((e) => milestoneToTimeline(e)),
		...symptoms.map((e) => symptomToTimeline(e)),
		...visits.map((e) => doctorVisitToTimeline(e)),
	]
	rows.sort((a, b) => b.startAt.localeCompare(a.startAt))

	const summary = buildDiaryDaySummary(
		aggregateSleepForLocalDay(sleeps, localDate, nowMs),
		aggregateFeedingsForLocalDay(feedings, nowMs),
		aggregateDiapersForLocalDay(diapers),
	)

	return { rows, summary }
}

/** Limited recent history across days (for «Все события» / wide search). */
export async function loadDiaryHistoryPage (
	repos: DiaryLoadRepos,
	childId: string,
	limit: number = DIARY_HISTORY_PAGE_SIZE,
	nowMs: number = Date.now(),
): Promise<TimelineRow[]> {
	const sleeps = await repos.sleep.listByChild(childId, limit)
	const feedings = await repos.feeding.listByChild(childId, limit)
	const diapers = await repos.diaper.listByChild(childId, limit)
	const activities = await repos.quickEvents.listActivitiesByChild(
		childId,
		limit,
	)
	const temps = await repos.quickEvents.listTemperaturesByChild(childId, limit)
	const medicines = await repos.quickEvents.listMedicinesByChild(
		childId,
		limit,
	)
	const notes = await repos.quickEvents.listNotesByChild(childId, limit)
	const customs = await repos.quickEvents.listCustomEventsByChild(
		childId,
		limit,
	)
	const milestones = await repos.milestones.listByChild(childId, limit)
	const symptoms = await repos.symptoms.listByChild(childId, limit)
	const visits = await repos.doctorVisits.listByChild(childId, limit)

	const rows: TimelineRow[] = [
		...sleeps.map((e) => sleepToTimeline(e, nowMs)),
		...feedings.map((e) => feedingToTimeline(e, nowMs)),
		...diapers.map((e) => diaperToTimeline(e)),
		...activities.map((e) => activityToTimeline(e)),
		...temps.map((e) => temperatureToTimeline(e)),
		...medicines.map((e) => medicineToTimeline(e)),
		...notes.map((e) => noteToTimeline(e)),
		...customs.map((e) => customToTimeline(e)),
		...milestones.map((e) => milestoneToTimeline(e)),
		...symptoms.map((e) => symptomToTimeline(e)),
		...visits.map((e) => doctorVisitToTimeline(e)),
	]
	rows.sort((a, b) => b.startAt.localeCompare(a.startAt))
	return rows.slice(0, limit)
}
