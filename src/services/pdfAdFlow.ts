/**
 * Interstitial insertion point after fresh PDF generation.
 * No ad SDK in Phase 9 — keep API stable for monetization phase.
 *
 * Contract (also documented in pdfGenerate.ts):
 * - max one interstitial per session
 * - never block PDF if ad missing
 * - no ad when reopening existing PDF
 * - no ad on Share from ready screen
 * - no ads inside PDF bytes
 */

let interstitialShownThisSession = false

/**
 * Called after a successful fresh PDF write.
 * Resolves immediately; future SDK can show ad without awaiting here.
 */
export async function runAfterFreshPdfGenerated (): Promise<void> {
	if (interstitialShownThisSession) {
		return
	}
	// Placeholder: mark session slot so a future SDK only fires once.
	interstitialShownThisSession = true
	// Intentionally no await / no delay — PDF UI must proceed.
}

/** Test / debug helper. */
export function resetPdfAdSessionForTests (): void {
	interstitialShownThisSession = false
}

export function hasPdfInterstitialBeenShownThisSession (): boolean {
	return interstitialShownThisSession
}
