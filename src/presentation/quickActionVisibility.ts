/**
 * QuickActions visibility helpers — hide CTAs already owned by live session cards.
 */

import type { QuickActionId } from '../components/QuickActions'

export function hiddenQuickActionIds (input: {
	isSleeping: boolean
	hasActiveBreastfeeding: boolean
}): QuickActionId[] {
	const hidden: QuickActionId[] = []
	if (input.isSleeping) {
		hidden.push('sleep')
	}
	if (input.hasActiveBreastfeeding) {
		hidden.push('feeding')
	}
	return hidden
}
