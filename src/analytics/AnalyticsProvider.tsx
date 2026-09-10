/**
 * Boots AppMetrica once after first paint — never blocks UI.
 */

import { useEffect, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { trackAnalyticsEvent } from './analyticsService'
import { initializeAppMetrica } from './appMetricaAdapter'
import { ANALYTICS_EVENTS } from './events'

interface AnalyticsProviderProps {
	children: ReactNode
}

export function AnalyticsProvider ({ children }: AnalyticsProviderProps) {
	useEffect(() => {
		if (Platform.OS === 'web') {
			return
		}
		const timer = setTimeout(() => {
			try {
				initializeAppMetrica()
				trackAnalyticsEvent(ANALYTICS_EVENTS.appOpen)
			} catch {
				// Non-blocking.
			}
		}, 800)
		return () => clearTimeout(timer)
	}, [])

	return <>{children}</>
}
