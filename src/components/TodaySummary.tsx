/**
 * Compact daily summary block for Today.
 */

import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

export interface SummaryRow {
	id: string
	label: string
	value: string
}

interface TodaySummaryProps {
	rows: SummaryRow[]
	title?: string
}

export function TodaySummary ({
	rows,
	title = 'Сегодня',
}: TodaySummaryProps) {
	const { colors } = useAppTheme()

	return (
		<View
			style={[
				styles.box,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
			accessibilityRole="summary"
			accessibilityLabel={`Сводка: ${title}`}
		>
			<Text style={[styles.title, { color: colors.text }]}>{title}</Text>
			{rows.map((row) => (
				<View key={row.id} style={styles.row}>
					<Text style={[styles.label, { color: colors.textSecondary }]}>
						{row.label}
					</Text>
					<Text style={[styles.value, { color: colors.text }]}>{row.value}</Text>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	box: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.sm,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: spacing.xs,
		gap: spacing.md,
	},
	label: {
		...typography.body,
		flexShrink: 1,
	},
	value: {
		...typography.body,
		fontWeight: '600',
		flexShrink: 0,
	},
})
