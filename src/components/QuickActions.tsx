/**
 * Primary one-handed quick actions for Today.
 * Hide redundant actions while a live sleep/BF session owns the primary CTA.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

export type QuickActionId = 'sleep' | 'feeding' | 'diaper' | 'more'

interface QuickActionsProps {
	onAction: (id: QuickActionId) => void
	/** Actions hidden while active session cards already show the control. */
	hiddenIds?: QuickActionId[]
}

const ACTIONS: { id: QuickActionId; label: string }[] = [
	{ id: 'sleep', label: 'Сон' },
	{ id: 'feeding', label: 'Кормление' },
	{ id: 'diaper', label: 'Подгузник' },
	{ id: 'more', label: 'Ещё' },
]

export function QuickActions ({
	onAction,
	hiddenIds = [],
}: QuickActionsProps) {
	const { colors } = useAppTheme()
	const visible = ACTIONS.filter((action) => !hiddenIds.includes(action.id))

	return (
		<View style={styles.grid} accessibilityRole="toolbar">
			{visible.map((action) => (
				<Pressable
					key={action.id}
					onPress={() => onAction(action.id)}
					style={[
						styles.button,
						{
							backgroundColor:
								action.id === 'more' ? colors.surface : colors.primary,
							borderColor: colors.border,
							width: visible.length <= 2 ? '100%' : '47%',
						},
					]}
					accessibilityRole="button"
					accessibilityLabel={`Быстрое действие: ${action.label}`}
				>
					<Text
						style={[
							styles.label,
							{
								color:
									action.id === 'more' ? colors.text : colors.onPrimary,
							},
						]}
						numberOfLines={2}
					>
						{action.label}
					</Text>
				</Pressable>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		rowGap: spacing.md,
		marginBottom: spacing.lg,
	},
	button: {
		minHeight: 64,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.md,
	},
	label: {
		...typography.button,
		textAlign: 'center',
	},
})
