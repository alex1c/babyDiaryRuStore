/**
 * Session-scoped interstitial policy — max one PDF interstitial per app process.
 */

let interstitialShownThisSession = false

export function canShowPdfInterstitialThisSession (): boolean {
	return !interstitialShownThisSession
}

export function markPdfInterstitialShownThisSession (): void {
	interstitialShownThisSession = true
}

export function hasPdfInterstitialBeenShownThisSession (): boolean {
	return interstitialShownThisSession
}

/** Jest / debug helper — never call from production UI. */
export function resetPdfAdSessionForTests (): void {
	interstitialShownThisSession = false
}
