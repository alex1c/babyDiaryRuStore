/**
 * Reserved banner ad slot — Phase 0 does not load ads, but layout must leave room.
 */

import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface BannerAdSlotProps {
	/** Visible only in dev so QA can verify reserved space. */
	label?: string
}

export function BannerAdSlot ({ label = 'Реклама' }: BannerAdSlotProps) {
	const { colors } = useAppTheme()

	return (
		<View
			style={[styles.slot, { backgroundColor: colors.adSlot, borderColor: colors.border }]}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			{__DEV__ ? (
				<Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	slot: {
		minHeight: 52,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: spacing.md,
		marginVertical: spacing.sm,
	},
	label: {
		...typography.caption,
	},
})
