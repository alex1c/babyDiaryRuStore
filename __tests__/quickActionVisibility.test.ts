/**
 * Phase 14 — Today quick actions hide when live session cards own the CTA.
 */

import { hiddenQuickActionIds } from '../src/presentation/quickActionVisibility'

describe('hiddenQuickActionIds', () => {
	it('hides sleep while sleeping and feeding while BF is active', () => {
		expect(
			hiddenQuickActionIds({
				isSleeping: true,
				hasActiveBreastfeeding: true,
			}),
		).toEqual(['sleep', 'feeding'])
	})

	it('keeps all actions when idle', () => {
		expect(
			hiddenQuickActionIds({
				isSleeping: false,
				hasActiveBreastfeeding: false,
			}),
		).toEqual([])
	})
})
