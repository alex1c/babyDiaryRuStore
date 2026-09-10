/**
 * Thin injectable bridge over Yandex Mobile Ads interstitial APIs.
 * Keeps SDK imports out of screens and allows Jest mocks.
 */

import { logger } from '../services/logger'
import { AD_UNITS } from './adUnits'
import { getAdsConsentState } from './consent'

export type InterstitialShowResult = 'shown' | 'skipped' | 'failed'

export interface InterstitialBridge {
	initialize (): Promise<void>
	preload (): Promise<void>
	/**
	 * Attempt to show a preloaded (or freshly loaded) interstitial.
	 * Must resolve quickly on failure — never block PDF forever.
	 */
	showWithTimeout (timeoutMs: number): Promise<InterstitialShowResult>
}

type YandexSdk = typeof import('yandex-mobile-ads')

let sdkModule: YandexSdk | null = null
let initStarted = false
let initDone = false
let cachedAd: import('yandex-mobile-ads').InterstitialAd | null = null
let loadInFlight: Promise<void> | null = null

function loadSdk (): YandexSdk | null {
	if (sdkModule) {
		return sdkModule
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		sdkModule = require('yandex-mobile-ads') as YandexSdk
		return sdkModule
	} catch (err) {
		logger.warn('yandex-mobile-ads module unavailable', {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

async function applyConsentToSdk (sdk: YandexSdk): Promise<void> {
	const consent = getAdsConsentState()
	try {
		sdk.MobileAds.setAgeRestrictedUser(consent.ageRestrictedUser)
		sdk.MobileAds.setLocationConsent(consent.locationConsent)
		if (consent.userConsent != null) {
			sdk.MobileAds.setUserConsent(consent.userConsent)
		}
	} catch (err) {
		logger.warn('ads consent apply failed', {
			error: err instanceof Error ? err.message : String(err),
		})
	}
}

async function ensureInitialized (): Promise<YandexSdk | null> {
	const sdk = loadSdk()
	if (!sdk) {
		return null
	}
	if (initDone) {
		return sdk
	}
	if (initStarted) {
		// Wait briefly for in-flight init without spinning forever.
		const deadline = Date.now() + 4000
		while (!initDone && Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 50))
		}
		return initDone ? sdk : null
	}
	initStarted = true
	try {
		await applyConsentToSdk(sdk)
		await sdk.MobileAds.initialize()
		initDone = true
		return sdk
	} catch (err) {
		initStarted = false
		logger.warn('MobileAds.initialize failed', {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

async function loadInterstitialAd (): Promise<void> {
	if (cachedAd) {
		return
	}
	if (loadInFlight) {
		await loadInFlight
		return
	}
	loadInFlight = (async () => {
		const sdk = await ensureInitialized()
		if (!sdk) {
			return
		}
		try {
			const loader = await sdk.InterstitialAdLoader.create()
			const ad = await loader.loadAd({
				adUnitId: AD_UNITS.pdfInterstitial,
			})
			cachedAd = ad
		} catch (err) {
			cachedAd = null
			logger.warn('interstitial preload/load failed', {
				error: err instanceof Error ? err.message : String(err),
			})
		} finally {
			loadInFlight = null
		}
	})()
	await loadInFlight
}

function withTimeout<T> (
	promise: Promise<T>,
	timeoutMs: number,
	fallback: T,
): Promise<T> {
	return new Promise((resolve) => {
		let settled = false
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true
				resolve(fallback)
			}
		}, timeoutMs)
		promise
			.then((value) => {
				if (!settled) {
					settled = true
					clearTimeout(timer)
					resolve(value)
				}
			})
			.catch(() => {
				if (!settled) {
					settled = true
					clearTimeout(timer)
					resolve(fallback)
				}
			})
	})
}

async function showLoadedAd (
	ad: import('yandex-mobile-ads').InterstitialAd,
	timeoutMs: number,
): Promise<InterstitialShowResult> {
	return new Promise((resolve) => {
		let settled = false
		let didShow = false
		const finish = (result: InterstitialShowResult) => {
			if (settled) {
				return
			}
			settled = true
			clearTimeout(startTimer)
			resolve(result)
		}
		// If the ad cannot start within timeoutMs, continue to the ready screen.
		const startTimer = setTimeout(() => {
			if (!didShow) {
				finish('failed')
			}
		}, timeoutMs)
		ad.onAdShown = () => {
			didShow = true
			clearTimeout(startTimer)
		}
		ad.onAdDismissed = () => finish(didShow ? 'shown' : 'failed')
		ad.onAdFailedToShow = () => finish('failed')
		void ad.show().catch(() => finish('failed'))
	})
}

export const defaultInterstitialBridge: InterstitialBridge = {
	async initialize (): Promise<void> {
		await ensureInitialized()
	},

	async preload (): Promise<void> {
		try {
			await loadInterstitialAd()
		} catch {
			// Preload must never affect UI.
		}
	},

	async showWithTimeout (timeoutMs: number): Promise<InterstitialShowResult> {
		try {
			if (!cachedAd) {
				await withTimeout(loadInterstitialAd(), Math.min(timeoutMs, 2000), undefined)
			}
			const ad = cachedAd
			cachedAd = null
			if (!ad) {
				return 'failed'
			}
			const result = await showLoadedAd(ad, timeoutMs)
			// Soft reload next interstitial for a future session action (still capped).
			void defaultInterstitialBridge.preload()
			return result
		} catch (err) {
			logger.warn('interstitial show failed', {
				error: err instanceof Error ? err.message : String(err),
			})
			return 'failed'
		}
	},
}

let activeBridge: InterstitialBridge = defaultInterstitialBridge

export function getInterstitialBridge (): InterstitialBridge {
	return activeBridge
}

/** Tests inject a mock bridge; production always uses the Yandex default. */
export function setInterstitialBridgeForTests (
	bridge: InterstitialBridge | null,
): void {
	activeBridge = bridge ?? defaultInterstitialBridge
}

export function resetInterstitialBridgeStateForTests (): void {
	cachedAd = null
	loadInFlight = null
	initStarted = false
	initDone = false
	sdkModule = null
	activeBridge = defaultInterstitialBridge
}
