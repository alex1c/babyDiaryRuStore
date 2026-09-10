/**
 * PDF interstitial orchestration — single insertion point for monetization.
 * Never gates PDF creation; only runs after a fresh file is already on disk.
 */

import { logger } from '../services/logger'
import { getInterstitialBridge } from './InterstitialService'
import {
	canShowPdfInterstitialThisSession,
	hasPdfInterstitialBeenShownThisSession,
	markPdfInterstitialShownThisSession,
	resetPdfAdSessionForTests,
} from './sessionPolicy'

/** Max wait for interstitial before continuing to the ready screen. */
export const PDF_INTERSTITIAL_TIMEOUT_MS = 2500

/**
 * Called after a successful fresh PDF write.
 * Awaits a bounded interstitial attempt, then always resolves.
 */
export async function runAfterFreshPdfGenerated (): Promise<void> {
	if (!canShowPdfInterstitialThisSession()) {
		return
	}
	try {
		const result = await getInterstitialBridge().showWithTimeout(
			PDF_INTERSTITIAL_TIMEOUT_MS,
		)
		if (result === 'shown') {
			markPdfInterstitialShownThisSession()
		}
	} catch (err) {
		logger.warn('pdf interstitial hook failed', {
			error: err instanceof Error ? err.message : String(err),
		})
	}
}

export {
	hasPdfInterstitialBeenShownThisSession,
	resetPdfAdSessionForTests,
}
