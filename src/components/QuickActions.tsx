/**
 * Primary one-handed quick actions for Today.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

export type QuickActionId = 'sleep' | 'feeding' | 'diaper' | 'more'

interface QuickActionsProps {
	onAction: (id: QuickActionId) => void
}

const ACTIONS: { id: QuickActionId; label: string }[] = [
	{ id: 'sleep', label: 'Сон' },
	{ id: 'feeding', label: 'Кормление' },
	{ id: 'diaper', label: 'Подгузник' },
	{ id: 'more', label: 'Ещё' },
]

export function QuickActions ({ onAction }: QuickActionsProps) {
	const { colors } = useAppTheme()

	return (
		<View style={styles.grid} accessibilityRole="toolbar">
			{ACTIONS.map((action) => (
				<Pressable
					key={action.id}
					onPress={() => onAction(action.id)}
					style={[
						styles.button,
						{
							backgroundColor:
								action.id === 'more' ? colors.surface : colors.primary,
							borderColor: colors.border,
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
									action.id === 'more' ? colors.text : '#FFFFFF',
							},
						]}
						numberOfLines={2}
						adjustsFontSizeToFit
						minimumFontScale={0.85}
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
		width: '47%',
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
