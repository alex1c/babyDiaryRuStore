/**
 * Simple bar chart for personal growth dynamics (no medical norms).
 */

import { StyleSheet, Text, View } from 'react-native'

import type { GrowthChartPoint } from '../domain/growthCharts'
import { normalizeChartValues } from '../domain/growthCharts'
import { formatRuLongDate } from '../presentation/growthFormat'
import { useAppTheme } from '../theme/ThemeProvider'
import { spacing, typography } from '../theme/tokens'

interface SimpleGrowthChartProps {
	points: GrowthChartPoint[]
	emptyLabel?: string
	unitSuffix?: string
}

export function SimpleGrowthChart ({
	points,
	emptyLabel = 'Пока нет данных для графика',
	unitSuffix = '',
}: SimpleGrowthChartProps) {
	const { colors } = useAppTheme()

	if (points.length === 0) {
		return (
			<Text style={[styles.empty, { color: colors.textMuted }]}>
				{emptyLabel}
			</Text>
		)
	}

	const norms = normalizeChartValues(points.map((p) => p.value))
	const last = points[points.length - 1]

	return (
		<View style={styles.wrap}>
			<View style={styles.bars}>
				{points.map((point, index) => {
					const heightPct = Math.max(0.12, norms[index] ?? 0.5)
					const barHeight = Math.round(heightPct * 96)
					return (
						<View key={point.id} style={styles.col}>
							<View style={styles.barTrack}>
								<View
									style={[
										styles.bar,
										{
											height: barHeight,
											backgroundColor: colors.primary,
										},
									]}
								/>
							</View>
							<Text
								style={[styles.tick, { color: colors.textMuted }]}
								numberOfLines={1}
							>
								{formatRuLongDate(point.date).split(' ')[0]}
							</Text>
						</View>
					)
				})}
			</View>
			{last ? (
				<Text style={[styles.caption, { color: colors.textSecondary }]}>
					Последнее: {formatMeasure(last.value)}
					{unitSuffix ? ` ${unitSuffix}` : ''} ·{' '}
					{formatRuLongDate(last.date)}
				</Text>
			) : null}
		</View>
	)
}

function formatMeasure (value: number): string {
	if (Number.isInteger(value)) {
		return String(value)
	}
	return value.toFixed(1).replace('.', ',')
}

const styles = StyleSheet.create({
	wrap: { gap: spacing.sm },
	empty: { ...typography.body, paddingVertical: spacing.md },
	bars: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 4,
		minHeight: 120,
		paddingTop: spacing.sm,
	},
	col: {
		flex: 1,
		alignItems: 'center',
		maxWidth: 48,
	},
	barTrack: {
		height: 96,
		width: '70%',
		justifyContent: 'flex-end',
	},
	bar: {
		width: '100%',
		borderTopLeftRadius: 4,
		borderTopRightRadius: 4,
		minHeight: 8,
	},
	tick: {
		...typography.caption,
		marginTop: 4,
		fontSize: 10,
	},
	caption: { ...typography.caption },
})
