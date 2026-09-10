/**
 * Boots Yandex Mobile Ads after the app is ready — never blocks startup UI.
 */

import { useEffect, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'

import { logger } from '../services/logger'
import { getInterstitialBridge } from './InterstitialService'

interface AdsProviderProps {
	children: ReactNode
}

export function AdsProvider ({ children }: AdsProviderProps) {
	useEffect(() => {
		if (Platform.OS === 'web') {
			return
		}

		let cancelled = false
		const bridge = getInterstitialBridge()

		const boot = async (): Promise<void> => {
			try {
				await bridge.initialize()
				if (cancelled) {
					return
				}
				// Soft preload — errors are swallowed inside the bridge.
				await bridge.preload()
			} catch (err) {
				logger.warn('AdsProvider boot failed', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}

		// Defer past first paint so Today / DB init stay snappy.
		const timer = setTimeout(() => {
			void boot()
		}, 1500)

		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void bridge.preload()
			}
		})

		return () => {
			cancelled = true
			clearTimeout(timer)
			sub.remove()
		}
	}, [])

	return <>{children}</>
}
