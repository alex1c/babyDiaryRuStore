/**
 * Privacy / consent extension point for a future store or SDK requirement.
 * Phase 15 keeps this minimal — no invented consent UI.
 */

export interface AdsConsentState {
	/** Whether the parent has given personalized-ads consent when required. */
	userConsent: boolean | null
	/** App is for parents; not directed at children as primary audience. */
	ageRestrictedUser: boolean
	locationConsent: boolean
}

const DEFAULT_CONSENT: AdsConsentState = {
	userConsent: null,
	ageRestrictedUser: false,
	locationConsent: false,
}

let consentState: AdsConsentState = { ...DEFAULT_CONSENT }

export function getAdsConsentState (): AdsConsentState {
	return { ...consentState }
}

/**
 * Future privacy flow can call this before SDK init / ad loads.
 * Never attach baby/health payload here.
 */
export function applyAdsConsent (patch: Partial<AdsConsentState>): void {
	consentState = { ...consentState, ...patch }
}

export function resetAdsConsentForTests (): void {
	consentState = { ...DEFAULT_CONSENT }
}
