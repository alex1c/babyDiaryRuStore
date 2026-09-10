/**
 * Compact Smart Today hint card — one neutral tip, no diagnosis.
 */

import { StyleSheet, Text, View } from 'react-native'

import type { SmartTodayHint } from '../domain/smartToday'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

export function SmartTodayCard ({ hint }: { hint: SmartTodayHint }) {
	const { colors } = useAppTheme()
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.primarySoft, borderColor: colors.border },
			]}
			accessibilityRole="summary"
		>
			<Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
				Подсказка
			</Text>
			<Text style={[styles.title, { color: colors.text }]}>{hint.title}</Text>
			<Text style={[styles.body, { color: colors.textSecondary }]}>
				{hint.body}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		gap: 4,
	},
	eyebrow: { ...typography.caption, fontWeight: '600' },
	title: { ...typography.subtitle },
	body: { ...typography.body },
})
