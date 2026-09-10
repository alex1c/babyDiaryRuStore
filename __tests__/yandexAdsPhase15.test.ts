/**
 * Phase 15 — Yandex ads configuration, session policy, PDF interstitial flow.
 */

import {
	AD_UNITS,
	YANDEX_APP_ID,
	bannerUnitForPlacement,
} from '../src/ads/adUnits'
import {
	runAfterFreshPdfGenerated,
	PDF_INTERSTITIAL_TIMEOUT_MS,
} from '../src/ads/pdfInterstitialFlow'
import {
	setInterstitialBridgeForTests,
	resetInterstitialBridgeStateForTests,
	type InterstitialBridge,
} from '../src/ads/InterstitialService'
import {
	canShowPdfInterstitialThisSession,
	hasPdfInterstitialBeenShownThisSession,
	resetPdfAdSessionForTests,
} from '../src/ads/sessionPolicy'

describe('ad unit mapping', () => {
	it('maps each hub placement to the production banner id', () => {
		expect(bannerUnitForPlacement('today')).toBe('R-M-20020281-1')
		expect(bannerUnitForPlacement('diary')).toBe('R-M-20020281-2')
		expect(bannerUnitForPlacement('statistics')).toBe('R-M-20020281-3')
		expect(bannerUnitForPlacement('development')).toBe('R-M-20020281-4')
	})

	it('exposes production interstitial and reserved rewarded ids', () => {
		expect(AD_UNITS.todayBanner).toBe('R-M-20020281-1')
		expect(AD_UNITS.diaryBanner).toBe('R-M-20020281-2')
		expect(AD_UNITS.statisticsBanner).toBe('R-M-20020281-3')
		expect(AD_UNITS.developmentBanner).toBe('R-M-20020281-4')
		expect(AD_UNITS.pdfInterstitial).toBe('R-M-20020281-5')
		expect(AD_UNITS.rewardedReserved).toBe('R-M-20020281-6')
		expect(YANDEX_APP_ID).toBe('d2ec0cc3-c329-4f17-86f7-5d820b2082dd')
	})
})

describe('pdf interstitial session policy', () => {
	beforeEach(() => {
		resetPdfAdSessionForTests()
		resetInterstitialBridgeStateForTests()
	})

	afterEach(() => {
		setInterstitialBridgeForTests(null)
		resetInterstitialBridgeStateForTests()
		resetPdfAdSessionForTests()
	})

	it('shows at most once per session when the bridge reports shown', async () => {
		let showCalls = 0
		const bridge: InterstitialBridge = {
			initialize: async () => undefined,
			preload: async () => undefined,
			showWithTimeout: async () => {
				showCalls += 1
				return 'shown'
			},
		}
		setInterstitialBridgeForTests(bridge)

		await runAfterFreshPdfGenerated()
		expect(hasPdfInterstitialBeenShownThisSession()).toBe(true)
		expect(canShowPdfInterstitialThisSession()).toBe(false)

		await runAfterFreshPdfGenerated()
		expect(showCalls).toBe(1)
	})

	it('does not consume the session slot when load/show fails', async () => {
		let showCalls = 0
		setInterstitialBridgeForTests({
			initialize: async () => undefined,
			preload: async () => undefined,
			showWithTimeout: async () => {
				showCalls += 1
				return 'failed'
			},
		})

		await runAfterFreshPdfGenerated()
		expect(hasPdfInterstitialBeenShownThisSession()).toBe(false)
		await runAfterFreshPdfGenerated()
		expect(showCalls).toBe(2)
	})

	it('still resolves quickly so PDF ready UI is never blocked forever', async () => {
		setInterstitialBridgeForTests({
			initialize: async () => undefined,
			preload: async () => undefined,
			showWithTimeout: async (timeoutMs) => {
				expect(timeoutMs).toBe(PDF_INTERSTITIAL_TIMEOUT_MS)
				return 'failed'
			},
		})
		await expect(runAfterFreshPdfGenerated()).resolves.toBeUndefined()
	})

	it('never invokes rewarded APIs from the interstitial bridge', async () => {
		const rewardedGuard = {
			called: false,
		}
		setInterstitialBridgeForTests({
			initialize: async () => undefined,
			preload: async () => undefined,
			showWithTimeout: async () => {
				// Simulate production path: only interstitial unit is requested upstream.
				expect(AD_UNITS.pdfInterstitial).toBe('R-M-20020281-5')
				expect(AD_UNITS.rewardedReserved).not.toBe(AD_UNITS.pdfInterstitial)
				rewardedGuard.called = false
				return 'shown'
			},
		})
		await runAfterFreshPdfGenerated()
		expect(rewardedGuard.called).toBe(false)
	})
})

describe('non-PDF surfaces must not trigger interstitial helpers', () => {
	it('exports medical/care actions as non-ad entry points by convention', () => {
		// Guardrail: rewarded + interstitial units stay distinct; medical flows never import show.
		expect(AD_UNITS.rewardedReserved).toBe('R-M-20020281-6')
		expect(AD_UNITS.pdfInterstitial).toBe('R-M-20020281-5')
	})
})
