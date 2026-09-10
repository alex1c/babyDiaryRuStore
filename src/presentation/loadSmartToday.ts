/**
 * Load Smart Today hint — sequential SQLite, local-only.
 */

import { addLocalDays } from '../domain/statsPeriod'
import { buildSmartTodayHint, type SmartTodayHint } from '../domain/smartToday'
import type { Child } from '../models/types'
import type { FeedingRepository } from '../repositories/feedingRepository'
import type { SleepRepository } from '../repositories/sleepRepository'
import { toLocalDateOnly } from '../utils/datetime'

export interface SmartTodayLoadRepos {
	sleep: SleepRepository
	feeding: FeedingRepository
}

export async function loadSmartTodayHint (
	repos: SmartTodayLoadRepos,
	child: Child,
	nowMs: number = Date.now(),
): Promise<SmartTodayHint | null> {
	const today = toLocalDateOnly(new Date(nowMs))
	const start = addLocalDays(today, -6)

	// Sequential — never Promise.all on one NativeDatabase.
	const activeSleep = await repos.sleep.findActive(child.id)
	const lastFinished = await repos.sleep.findLastFinished(child.id)
	const recentSleeps = await repos.sleep.listOverlappingLocalDateRange(
		child.id,
		start,
		today,
	)
	const activeBf = await repos.feeding.findActiveBreastfeeding(child.id)
	const latestFeeding = await repos.feeding.findLatest(child.id)
	const recentFeedings = await repos.feeding.listByChildAndLocalDateRange(
		child.id,
		start,
		today,
	)

	return buildSmartTodayHint({
		child,
		activeSleep,
		activeBreastfeeding: activeBf,
		lastFinishedSleep: lastFinished,
		recentSleeps,
		recentFeedings,
		latestFeeding,
		nowMs,
		asOfDate: today,
	})
}
