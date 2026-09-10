/**
 * Production banner for hub screens — one placement per screen.
 * Collapses quietly on load failure so the diary UI stays usable.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
	Dimensions,
	Platform,
	StyleSheet,
	View,
	type LayoutChangeEvent,
} from 'react-native'

import { logger } from '../services/logger'
import { spacing } from '../theme/tokens'
import {
	bannerUnitForPlacement,
	type BannerPlacement,
} from './adUnits'

interface BannerAdProps {
	placement: BannerPlacement
}

type BannerSize = {
	width: number
	height: number
	initialWidth: number
	initialHeight: number
	widthInPixels: number
	heightInPixels: number
	type: string
}

type BannerViewComponent = ComponentType<{
	size: BannerSize
	adRequest: { adUnitId: string }
	onAdLoaded?: () => void
	onAdFailedToLoad?: () => void
	style?: object
}>

function resolveBannerApi (): {
	BannerView: BannerViewComponent
	stickySize: (width: number) => Promise<BannerSize>
} | null {
	if (Platform.OS === 'web') {
		return null
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const sdk = require('yandex-mobile-ads') as {
			BannerView: BannerViewComponent
			BannerAdSize: { stickySize: (width: number) => Promise<BannerSize> }
		}
		return {
			BannerView: sdk.BannerView,
			stickySize: (width) => sdk.BannerAdSize.stickySize(width),
		}
	} catch (err) {
		logger.warn('banner SDK unavailable', {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

export function BannerAd ({ placement }: BannerAdProps) {
	const adUnitId = useMemo(
		() => bannerUnitForPlacement(placement),
		[placement],
	)
	const api = useMemo(() => resolveBannerApi(), [])
	const [width, setWidth] = useState(
		() => Math.max(0, Dimensions.get('window').width - spacing.md * 2),
	)
	const [size, setSize] = useState<BannerSize | null>(null)
	const [visible, setVisible] = useState(true)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		let cancelled = false
		if (!api || width <= 0) {
			return
		}
		void (async () => {
			try {
				const next = await api.stickySize(Math.floor(width))
				if (!cancelled) {
					setSize(next)
				}
			} catch (err) {
				if (!cancelled) {
					setVisible(false)
					logger.warn('banner size failed', {
						placement,
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [api, width, placement])

	const onLayout = (event: LayoutChangeEvent): void => {
		const next = Math.floor(event.nativeEvent.layout.width)
		if (next > 0 && Math.abs(next - width) > 1) {
			setWidth(next)
		}
	}

	if (!visible || !api) {
		return null
	}

	const BannerView = api.BannerView
	const reservedHeight = loaded
		? size?.height ?? 50
		: Math.min(size?.height ?? 50, 50)

	return (
		<View
			style={[styles.wrap, { minHeight: reservedHeight }]}
			onLayout={onLayout}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			{size ? (
				<BannerView
					size={size}
					adRequest={{ adUnitId }}
					style={styles.banner}
					onAdLoaded={() => setLoaded(true)}
					onAdFailedToLoad={() => {
						setVisible(false)
						setLoaded(false)
					}}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		marginVertical: spacing.sm,
		overflow: 'hidden',
	},
	banner: {
		alignSelf: 'center',
	},
})
