/**
 * Phase 13 — in-app training config, navigation, and persisted flags.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import {
	canGoBack,
	canGoNext,
	goBack,
	goNext,
	isLastTrainingPage,
	isWelcomePage,
	progressLabel,
	progressRatio,
	startTourFromWelcome,
	validateTrainingConfig,
} from '../src/domain/trainingNavigation'
import {
	TRAINING_PAGES,
	getTrainingPageCount,
	type TrainingPageId,
} from '../src/domain/trainingPages'
import { SettingsRepository } from '../src/repositories/settingsRepository'

describe('training page config', () => {
	it('has complete unique pages with titles and bodies', () => {
		const result = validateTrainingConfig()
		expect(result.errors).toEqual([])
		expect(result.ok).toBe(true)
		expect(getTrainingPageCount()).toBeGreaterThanOrEqual(12)
		expect(TRAINING_PAGES[0]?.id).toBe('welcome')
		expect(TRAINING_PAGES[TRAINING_PAGES.length - 1]?.id).toBe('done')
	})

	it('includes the required guide topics', () => {
		const ids = new Set(TRAINING_PAGES.map((p) => p.id))
		const required: TrainingPageId[] = [
			'today',
			'sleep',
			'feeding',
			'diaper',
			'quick-events',
			'diary',
			'development',
			'moments',
			'health',
			'statistics',
			'reports',
			'reminders',
			'multi-child',
			'backup',
		]
		for (const id of required) {
			expect(ids.has(id)).toBe(true)
		}
	})

	it('keeps Russian user-facing copy without English UI labels', () => {
		for (const page of TRAINING_PAGES) {
			expect(page.title).not.toMatch(/\b(training|skip|step)\b/i)
			expect(page.body).not.toMatch(/\b(training|skip|step)\b/i)
		}
	})
})

describe('training navigation', () => {
	it('moves forward and back within bounds', () => {
		let state = startTourFromWelcome()
		expect(isWelcomePage(state)).toBe(true)
		expect(canGoBack(state)).toBe(false)
		expect(canGoNext(state)).toBe(true)

		state = goNext(state)
		expect(canGoBack(state)).toBe(true)
		expect(TRAINING_PAGES[state.index]?.id).toBe('today')

		state = goBack(state)
		expect(isWelcomePage(state)).toBe(true)

		while (canGoNext(state)) {
			state = goNext(state)
		}
		expect(isLastTrainingPage(state)).toBe(true)
		expect(progressLabel(state)).toContain('из')
		expect(progressRatio(state)).toBe(1)
	})
})

describe('training settings persistence', () => {
	function setup () {
		const db = new MemorySqlExecutor()
		db.markMigrated(LATEST_SCHEMA_VERSION)
		return new SettingsRepository(db)
	}

	it('persists trainingCompleted and does not re-offer endlessly', async () => {
		const settings = setup()
		await settings.setOnboardingCompleted(true)
		expect(await settings.shouldShowTrainingOffer()).toBe(true)

		await settings.setTrainingOfferDismissed(true)
		expect(await settings.shouldShowTrainingOffer()).toBe(false)

		await settings.setTrainingOfferDismissed(false)
		await settings.setTrainingCompleted(true)
		expect(await settings.shouldShowTrainingOffer()).toBe(false)

		const loaded = await settings.get()
		expect(loaded.trainingCompleted).toBe(true)
		expect(loaded.trainingOfferDismissed).toBe(false)
	})

	it('allows manual reopen conceptually after completion flag is set', async () => {
		const settings = setup()
		await settings.setTrainingCompleted(true)
		const loaded = await settings.get()
		expect(loaded.trainingCompleted).toBe(true)
		// Manual route /training still works; offer stays suppressed.
		expect(await settings.shouldShowTrainingOffer()).toBe(false)
		expect(startTourFromWelcome().phase).toBe('tour')
	})
})
