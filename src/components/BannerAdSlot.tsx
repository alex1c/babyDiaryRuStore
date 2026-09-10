/**
 * Reserved hub banner slot — renders production Yandex banner for a placement.
 */

import { BannerAd } from '../ads/BannerAd'
import type { BannerPlacement } from '../ads/adUnits'

interface BannerAdSlotProps {
	placement: BannerPlacement
}

export function BannerAdSlot ({ placement }: BannerAdSlotProps) {
	return <BannerAd placement={placement} />
}
