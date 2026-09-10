/**
 * Jest setup: mock native modules touched by repositories in Node.
 */

let mockUuidCounter = 0

jest.mock('expo-crypto', () => ({
	randomUUID: () => {
		mockUuidCounter += 1
		const hex = mockUuidCounter.toString(16).padStart(12, '0')
		return `00000000-0000-4000-8000-${hex}`
	},
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(async () => undefined),
		setUserConsent: jest.fn(),
		setAgeRestrictedUser: jest.fn(),
		setLocationConsent: jest.fn(),
	},
	InterstitialAdLoader: {
		create: jest.fn(async () => ({
			loadAd: jest.fn(async () => {
				throw new Error('ads mocked — no fill in tests')
			}),
		})),
	},
	BannerAdSize: {
		stickySize: jest.fn(async () => ({
			width: 320,
			height: 50,
			initialWidth: 320,
			initialHeight: 50,
			widthInPixels: 320,
			heightInPixels: 50,
			type: 'sticky',
		})),
	},
	BannerView: () => null,
	RewardedAdLoader: {
		create: jest.fn(async () => {
			throw new Error('rewarded must not be used in Phase 15')
		}),
	},
}))

beforeEach(() => {
	mockUuidCounter = 0
})
