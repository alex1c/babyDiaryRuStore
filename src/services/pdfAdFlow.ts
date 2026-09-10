/**
 * Interstitial insertion point after fresh PDF generation.
 * Implementation: src/ads/pdfInterstitialFlow.ts (Yandex production units).
 */

export {
	runAfterFreshPdfGenerated,
	hasPdfInterstitialBeenShownThisSession,
	resetPdfAdSessionForTests,
	PDF_INTERSTITIAL_TIMEOUT_MS,
} from '../ads/pdfInterstitialFlow'
