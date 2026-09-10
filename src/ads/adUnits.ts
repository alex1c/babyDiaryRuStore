/**
 * Central production Yandex Advertising Network configuration.
 * Do not scatter ad unit IDs across UI screens.
 *
 * Rewarded unit is reserved for a future phase — never preload or show it here.
 */

/** Partner app UUID from Yandex Advertising Network (console). */
export const YANDEX_APP_ID = 'd2ec0cc3-c329-4f17-86f7-5d820b2082dd'

export const AD_UNITS = {
	todayBanner: 'R-M-20020281-1',
	diaryBanner: 'R-M-20020281-2',
	statisticsBanner: 'R-M-20020281-3',
	developmentBanner: 'R-M-20020281-4',
	pdfInterstitial: 'R-M-20020281-5',
	/** Reserved — Phase 15 must not load or show rewarded ads. */
	rewardedReserved: 'R-M-20020281-6',
} as const

export type BannerPlacement =
	| 'today'
	| 'diary'
	| 'statistics'
	| 'development'

export type AdUnitKey = keyof typeof AD_UNITS

/** Map UI placement → production banner unit. */
export function bannerUnitForPlacement (
	placement: BannerPlacement,
): string {
	switch (placement) {
		case 'today':
			return AD_UNITS.todayBanner
		case 'diary':
			return AD_UNITS.diaryBanner
		case 'statistics':
			return AD_UNITS.statisticsBanner
		case 'development':
			return AD_UNITS.developmentBanner
		default: {
			const _exhaustive: never = placement
			return _exhaustive
		}
	}
}
