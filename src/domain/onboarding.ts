/**
 * Pure onboarding / active-child decision helpers (easy to unit-test).
 */

import type { Child } from '../models/types'

/**
 * First-launch gate: empty children table → show profile creation.
 * Do not use children[0] as a permanent architecture assumption elsewhere.
 */
export function needsOnboarding (children: readonly Child[]): boolean {
	return children.length === 0
}

/**
 * Resolve which child is active given settings + the full list.
 * Never assumes a single child — always goes through activeChildId first.
 */
export function resolveActiveChildId (
	children: readonly Child[],
	activeChildId: string | null,
): string | null {
	if (children.length === 0) {
		return null
	}
	if (activeChildId && children.some((c) => c.id === activeChildId)) {
		return activeChildId
	}
	// Prefer an explicitly active profile, then stable name order (list already sorted).
	const flagged = children.find((c) => c.isActive)
	return flagged?.id ?? children[0]?.id ?? null
}

export function findChildById (
	children: readonly Child[],
	id: string | null,
): Child | null {
	if (!id) {
		return null
	}
	return children.find((c) => c.id === id) ?? null
}
