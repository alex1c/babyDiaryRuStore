/**
 * Large status card for sleep / feeding / diaper on Today.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { TodayStatusCard } from '../presentation/todayViewModel'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface StatusCardProps {
	card: TodayStatusCard
	onPressCta: () => void
}

function emptyHint (cardId: TodayStatusCard['id']): string {
	switch (cardId) {
		case 'sleep':
			return 'Здесь появятся записи о сне малыша'
		case 'feeding':
			return 'Здесь появятся записи о кормлениях'
		case 'diaper':
			return 'Здесь появятся записи о подгузниках'
	}
}

export function StatusCard ({ card, onPressCta }: StatusCardProps) {
	const { colors } = useAppTheme()

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
			accessibilityRole="summary"
			accessibilityLabel={`${card.title}. ${card.summary}`}
		>
			<Text style={[styles.title, { color: colors.text }]}>{card.title}</Text>
			<Text style={[styles.summary, { color: colors.textSecondary }]}>
				{card.summary}
			</Text>
			{!card.hasData ? (
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					{emptyHint(card.id)}
				</Text>
			) : null}
			<Pressable
				onPress={onPressCta}
				style={[styles.cta, { backgroundColor: colors.primarySoft }]}
				accessibilityRole="button"
				accessibilityLabel={card.ctaLabel}
			>
				<Text style={[styles.ctaText, { color: colors.primary }]}>
					{card.ctaLabel}
				</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.lg,
		padding: spacing.md,
		marginBottom: spacing.md,
		minHeight: 120,
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.xs,
	},
	summary: {
		...typography.body,
		marginBottom: spacing.sm,
	},
	hint: {
		...typography.caption,
		marginBottom: spacing.sm,
	},
	cta: {
		alignSelf: 'flex-start',
		minHeight: 44,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radii.sm,
		justifyContent: 'center',
	},
	ctaText: {
		...typography.button,
	},
})
