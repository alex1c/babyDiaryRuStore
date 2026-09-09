/**
 * Compact day-series bar chart for Statistics (sleep / feedings / diapers).
 */

import { StyleSheet, Text, View } from 'react-native'

import { normalizeChartValues } from '../domain/growthCharts'
import { useAppTheme } from '../theme/ThemeProvider'
import { spacing, typography } from '../theme/tokens'

export interface DayBarPoint {
	id: string
	/** Short tick label (day-of-month). */
	label: string
	value: number
}

interface SimpleDayBarChartProps {
	points: DayBarPoint[]
	emptyLabel?: string
	/** Optional second series stacked on top (e.g. night sleep). */
	secondaryPoints?: DayBarPoint[]
	secondaryColor?: string
}

export function SimpleDayBarChart ({
	points,
	emptyLabel = 'Недостаточно данных за этот период',
	secondaryPoints,
	secondaryColor,
}: SimpleDayBarChartProps) {
	const { colors } = useAppTheme()

	if (points.length === 0 || points.every((p) => p.value === 0)) {
		if (!secondaryPoints?.some((p) => p.value > 0)) {
			return (
				<Text style={[styles.empty, { color: colors.textMuted }]}>
					{emptyLabel}
				</Text>
			)
		}
	}

	const combined = points.map((p, i) => p.value + (secondaryPoints?.[i]?.value ?? 0))
	const norms = normalizeChartValues(
		combined.every((v) => v === 0) ? combined.map(() => 1) : combined,
	)

	return (
		<View style={styles.wrap}>
			<View style={styles.bars}>
				{points.map((point, index) => {
					const total = combined[index] ?? 0
					const heightPct = Math.max(
						total > 0 ? 0.08 : 0.02,
						norms[index] ?? 0.5,
					)
					const barHeight = Math.round(heightPct * 96)
					const sec = secondaryPoints?.[index]?.value ?? 0
					const secShare = total > 0 ? sec / total : 0
					const secHeight = Math.round(barHeight * secShare)
					const primaryHeight = Math.max(0, barHeight - secHeight)
					return (
						<View key={point.id} style={styles.col}>
							<View style={styles.barTrack}>
								{secHeight > 0 ? (
									<View
										style={[
											styles.barSeg,
											{
												height: secHeight,
												backgroundColor:
													secondaryColor ?? colors.primaryMuted,
											},
										]}
									/>
								) : null}
								<View
									style={[
										styles.barSeg,
										{
											height: Math.max(
												primaryHeight,
												total > 0 ? 4 : 2,
											),
											backgroundColor: colors.primary,
											opacity: total > 0 ? 1 : 0.25,
										},
									]}
								/>
							</View>
							<Text
								style={[styles.tick, { color: colors.textMuted }]}
								numberOfLines={1}
							>
								{point.label}
							</Text>
						</View>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: { gap: spacing.sm },
	empty: { ...typography.body, paddingVertical: spacing.md },
	bars: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 3,
		minHeight: 120,
		paddingTop: spacing.sm,
	},
	col: {
		flex: 1,
		alignItems: 'center',
		maxWidth: 36,
	},
	barTrack: {
		height: 96,
		width: '70%',
		justifyContent: 'flex-end',
	},
	barSeg: {
		width: '100%',
		borderTopLeftRadius: 3,
		borderTopRightRadius: 3,
	},
	tick: {
		...typography.caption,
		marginTop: 4,
		fontSize: 9,
	},
})
