/**
 * Compatibility facade for Phase 9 PDF ad hook.
 * Real implementation lives in src/ads (Phase 15).
 */

export {
	runAfterFreshPdfGenerated,
	hasPdfInterstitialBeenShownThisSession,
	resetPdfAdSessionForTests,
	PDF_INTERSTITIAL_TIMEOUT_MS,
} from './pdfInterstitialFlow'
