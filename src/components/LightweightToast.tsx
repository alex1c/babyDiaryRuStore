/**
 * Lightweight in-app toast — no system Alert dialogs for Phase 1 CTAs.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

const DEFAULT_MS = 2200

export function useLightweightToast () {
	const [message, setMessage] = useState<string | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showToast = useCallback((text: string, durationMs = DEFAULT_MS) => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
		}
		setMessage(text)
		timerRef.current = setTimeout(() => {
			setMessage(null)
			timerRef.current = null
		}, durationMs)
	}, [])

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
			}
		}
	}, [])

	return { message, showToast }
}

export function LightweightToast ({ message }: { message: string | null }) {
	const { colors } = useAppTheme()

	if (!message) {
		return null
	}

	return (
		<View
			pointerEvents="none"
			accessibilityLiveRegion="polite"
			style={[
				styles.toast,
				{
					backgroundColor: colors.surfaceMuted,
					borderColor: colors.border,
				},
			]}
		>
			<Text style={[styles.text, { color: colors.text }]}>{message}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	toast: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		bottom: spacing.lg,
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.md,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		elevation: 3,
		shadowColor: '#000',
		shadowOpacity: 0.12,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	text: {
		...typography.body,
		textAlign: 'center',
	},
})
