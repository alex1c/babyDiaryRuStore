/**
 * Pure navigation helpers for the training carousel.
 */

import {
	TRAINING_PAGES,
	type TrainingPage,
	type TrainingPageId,
} from './trainingPages'

export type TrainingPhase = 'offer' | 'tour'

export interface TrainingNavState {
	phase: TrainingPhase
	index: number
}

export function clampTrainingIndex (index: number): number {
	if (TRAINING_PAGES.length === 0) {
		return 0
	}
	return Math.max(0, Math.min(index, TRAINING_PAGES.length - 1))
}

export function canGoBack (state: TrainingNavState): boolean {
	if (state.phase === 'offer') {
		return false
	}
	return state.index > 0
}

export function canGoNext (state: TrainingNavState): boolean {
	if (state.phase === 'offer') {
		return false
	}
	return state.index < TRAINING_PAGES.length - 1
}

export function isLastTrainingPage (state: TrainingNavState): boolean {
	return (
		state.phase === 'tour' &&
		state.index === TRAINING_PAGES.length - 1
	)
}

export function isWelcomePage (state: TrainingNavState): boolean {
	return (
		state.phase === 'tour' &&
		TRAINING_PAGES[state.index]?.id === 'welcome'
	)
}

export function currentTrainingPage (
	state: TrainingNavState,
): TrainingPage | null {
	if (state.phase !== 'tour') {
		return null
	}
	return TRAINING_PAGES[clampTrainingIndex(state.index)] ?? null
}

export function goNext (state: TrainingNavState): TrainingNavState {
	if (state.phase !== 'tour') {
		return state
	}
	return {
		phase: 'tour',
		index: clampTrainingIndex(state.index + 1),
	}
}

export function goBack (state: TrainingNavState): TrainingNavState {
	if (state.phase !== 'tour') {
		return state
	}
	return {
		phase: 'tour',
		index: clampTrainingIndex(state.index - 1),
	}
}

export function startTourFromWelcome (): TrainingNavState {
	const welcomeIndex = TRAINING_PAGES.findIndex((p) => p.id === 'welcome')
	return {
		phase: 'tour',
		index: welcomeIndex >= 0 ? welcomeIndex : 0,
	}
}

export function progressLabel (state: TrainingNavState): string {
	if (state.phase === 'offer') {
		return ''
	}
	const total = TRAINING_PAGES.length
	const current = clampTrainingIndex(state.index) + 1
	return `${current} из ${total}`
}

export function progressRatio (state: TrainingNavState): number {
	if (state.phase === 'offer' || TRAINING_PAGES.length === 0) {
		return 0
	}
	return (clampTrainingIndex(state.index) + 1) / TRAINING_PAGES.length
}

/** Validate config integrity for tests and startup sanity. */
export function validateTrainingConfig (): {
	ok: boolean
	errors: string[]
} {
	const errors: string[] = []
	const ids = new Set<string>()
	for (const page of TRAINING_PAGES) {
		if (!page.id) {
			errors.push('empty id')
		}
		if (ids.has(page.id)) {
			errors.push(`duplicate id: ${page.id}`)
		}
		ids.add(page.id)
		if (!page.title?.trim()) {
			errors.push(`missing title: ${page.id}`)
		}
		if (!page.body?.trim()) {
			errors.push(`missing body: ${page.id}`)
		}
		if (!page.iconLabel?.trim()) {
			errors.push(`missing iconLabel: ${page.id}`)
		}
	}
	const required: TrainingPageId[] = [
		'welcome',
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
		'done',
	]
	for (const id of required) {
		if (!ids.has(id)) {
			errors.push(`missing required page: ${id}`)
		}
	}
	return { ok: errors.length === 0, errors }
}
