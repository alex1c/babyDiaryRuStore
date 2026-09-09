/**
 * Compact two-line diary timeline row with soft accent chip.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { TimelineRow } from '../presentation/diaryTimeline'
import { DIARY_ACCENT_FALLBACK } from '../presentation/diaryVisual'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface DiaryTimelineRowProps {
	item: TimelineRow
	onPress: () => void
	onLongPress?: () => void
}

export function DiaryTimelineRowView ({
	item,
	onPress,
	onLongPress,
}: DiaryTimelineRowProps) {
	const { colors } = useAppTheme()
	const accent = DIARY_ACCENT_FALLBACK[item.accent]

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			style={[
				styles.row,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: item.isActive ? 1 : 1,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={item.label}
		>
			<View style={[styles.chip, { backgroundColor: accent.bg }]}>
				<Text style={[styles.chipText, { color: accent.fg }]}>
					{item.timeLabel}
				</Text>
			</View>
			<View style={styles.body}>
				<Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
					{item.title}
					{item.isActive ? ' · идёт' : ''}
				</Text>
				{item.subtitle ? (
					<Text
						style={[styles.subtitle, { color: colors.textSecondary }]}
						numberOfLines={2}
					>
						{item.subtitle}
					</Text>
				) : null}
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: spacing.sm,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		marginBottom: spacing.sm,
		minHeight: 56,
	},
	chip: {
		minWidth: 72,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		alignItems: 'center',
		justifyContent: 'center',
	},
	chipText: {
		...typography.caption,
		fontWeight: '700',
		textAlign: 'center',
	},
	body: {
		flex: 1,
		minWidth: 0,
	},
	title: {
		...typography.body,
		fontWeight: '700',
	},
	subtitle: {
		...typography.caption,
		marginTop: 2,
	},
})
