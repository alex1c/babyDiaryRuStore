/**
 * Shared placeholder section used by Phase 0 skeleton screens.
 */

import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface PlaceholderSectionProps {
	title: string
	description: string
}

export function PlaceholderSection ({
	title,
	description,
}: PlaceholderSectionProps) {
	const { colors } = useAppTheme()

	return (
		<View
			style={[
				styles.section,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
		>
			<Text style={[styles.title, { color: colors.text }]}>{title}</Text>
			<Text style={[styles.description, { color: colors.textSecondary }]}>
				{description}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	section: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.xs,
	},
	description: {
		...typography.body,
	},
})
