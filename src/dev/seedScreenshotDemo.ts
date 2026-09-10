/**
 * Demo dataset for RuStore screenshots — realistic, non-technical labels.
 * Invoked from a __DEV__ route only.
 */

import type { ChildRepository } from '../repositories/childRepository'
import type { DiaperRepository } from '../repositories/diaperRepository'
import type { DoctorVisitRepository } from '../repositories/doctorVisitRepository'
import type { FeedingRepository } from '../repositories/feedingRepository'
import type { GrowthRepository } from '../repositories/growthRepository'
import type { MilestoneRepository } from '../repositories/milestoneRepository'
import type { QuickEventRepository } from '../repositories/quickEventRepository'
import type { SettingsRepository } from '../repositories/settingsRepository'
import type { SleepRepository } from '../repositories/sleepRepository'
import type { SymptomRepository } from '../repositories/symptomRepository'
import { setStoreScreenshotMode } from '../ads/storeScreenshotMode'
import { addLocalDays } from '../domain/statsPeriod'
import { toLocalDateOnly, toOffsetDateTime } from '../utils/datetime'

export interface DemoSeedDeps {
	childrenRepo: ChildRepository
	settings: SettingsRepository
	sleep: SleepRepository
	feeding: FeedingRepository
	diaper: DiaperRepository
	growth: GrowthRepository
	milestones: MilestoneRepository
	quickEvents: QuickEventRepository
	symptoms: SymptomRepository
	doctorVisits: DoctorVisitRepository
	setActiveChildId: (id: string) => Promise<void>
	refreshActiveChild: () => Promise<void>
}

export interface DemoSeedResult {
	childId: string
	childName: string
}

/**
 * Seeds a polished «Миша» week for store screenshots and enables ad-hide mode.
 */
export async function seedScreenshotDemoData (
	deps: DemoSeedDeps,
): Promise<DemoSeedResult> {
	setStoreScreenshotMode(true)

	const today = toLocalDateOnly()
	const birthDate = addLocalDays(today, -120)

	const existing = await deps.childrenRepo.listAll()
	let child = existing.find((row) => row.name === 'Миша') ?? null
	if (!child) {
		child = await deps.childrenRepo.create({
			name: 'Миша',
			birthDate,
			sex: 'male',
		})
	}

	await deps.settings.setActiveChildId(child.id)
	await deps.settings.setOnboardingCompleted(true)
	await deps.setActiveChildId(child.id)
	await deps.refreshActiveChild()

	// Idempotent: re-running seed must not duplicate milestones / timeline rows
	// (duplicate React keys trigger LogBox and break store screenshot taps).
	const existingMilestones = await deps.milestones.listByChild(child.id)
	if (existingMilestones.length > 0) {
		return { childId: child.id, childName: child.name }
	}

	const iso = (localDate: string, hour: number, minute = 0): string => {
		// Build wall-clock time in the device local timezone (avoid hardcoded +03:00).
		const hh = String(hour).padStart(2, '0')
		const mm = String(minute).padStart(2, '0')
		return toOffsetDateTime(new Date(`${localDate}T${hh}:${mm}:00`))
	}

	const safe = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
		try {
			await fn()
		} catch (err) {
			// Screenshot seeding should continue even if one insert overlaps.
			console.warn(`[demo-seed] ${label}`, err)
		}
	}

	await safe('night sleep', () =>
		deps.sleep.createManual({
			childId: child.id,
			sleepType: 'night',
			startAt: iso(addLocalDays(today, -1), 21, 10),
			endAt: iso(today, 6, 40),
		}),
	)
	await safe('day sleep', () =>
		deps.sleep.createManual({
			childId: child.id,
			sleepType: 'day',
			startAt: iso(today, 9, 30),
			endAt: iso(today, 11, 0),
		}),
	)

	await safe('bottle morning', () =>
		deps.feeding.createBottle({
			childId: child.id,
			content: 'formula',
			amountMl: 140,
			occurredAt: iso(today, 7, 15),
		}),
	)
	await safe('bf', () =>
		deps.feeding.createManualBreastfeeding({
			childId: child.id,
			startAt: iso(today, 10, 5),
			endAt: iso(today, 10, 22),
			leftDurationSeconds: 480,
			rightDurationSeconds: 360,
			initialSide: 'left',
		}),
	)
	await safe('bottle noon', () =>
		deps.feeding.createBottle({
			childId: child.id,
			content: 'expressed_milk',
			amountMl: 100,
			occurredAt: iso(today, 12, 40),
		}),
	)

	await safe('diaper wet', () =>
		deps.diaper.create({
			childId: child.id,
			kind: 'wet',
			occurredAt: iso(today, 7, 40),
		}),
	)
	await safe('diaper dirty', () =>
		deps.diaper.create({
			childId: child.id,
			kind: 'dirty',
			occurredAt: iso(today, 11, 20),
		}),
	)
	await safe('diaper both', () =>
		deps.diaper.create({
			childId: child.id,
			kind: 'both',
			occurredAt: iso(today, 13, 5),
		}),
	)

	await safe('walk', () =>
		deps.quickEvents.createActivity({
			childId: child.id,
			type: 'walk',
			occurredAt: iso(today, 11, 40),
			durationSeconds: 35 * 60,
		}),
	)

	await safe('growth 1', () =>
		deps.growth.create({
			childId: child.id,
			weightKgRaw: '6,8',
			heightCmRaw: '65',
			measuredAt: iso(addLocalDays(today, -3), 12, 0),
		}),
	)
	await safe('growth 2', () =>
		deps.growth.create({
			childId: child.id,
			weightKgRaw: '7,1',
			heightCmRaw: '66',
			measuredAt: iso(today, 12, 10),
		}),
	)

	await safe('milestone smile', () =>
		deps.milestones.create({
			childId: child.id,
			milestoneType: 'first_smile',
			occurredAt: iso(addLocalDays(today, -40), 15, 0),
		}),
	)
	await safe('milestone laugh', () =>
		deps.milestones.create({
			childId: child.id,
			milestoneType: 'first_laugh',
			occurredAt: iso(addLocalDays(today, -10), 16, 0),
		}),
	)

	await safe('temp', () =>
		deps.quickEvents.createTemperature({
			childId: child.id,
			celsiusRaw: '36,6',
			method: 'axillary',
			occurredAt: iso(today, 8, 0),
		}),
	)
	await safe('vitamin', () =>
		deps.quickEvents.createMedicine({
			childId: child.id,
			kind: 'vitamin',
			name: 'Витамин D',
			doseText: '1',
			unit: 'drops',
			occurredAt: iso(today, 9, 0),
		}),
	)

	await safe('symptom', () =>
		deps.symptoms.create({
			childId: child.id,
			symptomType: 'runny_nose',
			severity: 'mild',
			startedAt: iso(addLocalDays(today, -1), 18, 0),
		}),
	)

	await safe('visit', () =>
		deps.doctorVisits.create({
			childId: child.id,
			specialistKey: 'pediatrician',
			visitedAt: iso(addLocalDays(today, -14), 11, 0),
			reason: 'Плановый осмотр',
		}),
	)

	for (let i = 1; i <= 6; i += 1) {
		const day = addLocalDays(today, -i)
		await safe(`hist sleep ${i}`, () =>
			deps.sleep.createManual({
				childId: child.id,
				sleepType: 'night',
				startAt: iso(addLocalDays(day, -1), 21, 0 + i),
				endAt: iso(day, 6, 30 + i),
			}),
		)
		await safe(`hist bottle ${i}`, () =>
			deps.feeding.createBottle({
				childId: child.id,
				content: 'formula',
				amountMl: 120 + i * 5,
				occurredAt: iso(day, 8, i),
			}),
		)
		await safe(`hist diaper ${i}`, () =>
			deps.diaper.create({
				childId: child.id,
				kind: i % 2 === 0 ? 'wet' : 'dirty',
				occurredAt: iso(day, 10, i),
			}),
		)
	}

	return { childId: child.id, childName: child.name }
}
