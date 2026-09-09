/**
 * Shared large tap targets for feeding flows (one-handed UX).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface ChoiceButtonProps {
	label: string
	onPress: () => void
	primary?: boolean
	disabled?: boolean
}

export function ChoiceButton ({
	label,
	onPress,
	primary = true,
	disabled = false,
}: ChoiceButtonProps) {
	const { colors } = useAppTheme()
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={[
				styles.btn,
				{
					backgroundColor: primary
						? disabled
							? colors.surfaceMuted
							: colors.primary
						: colors.surface,
					borderColor: colors.border,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
		>
			<Text
				style={[
					styles.label,
					{ color: primary ? '#FFFFFF' : colors.text },
				]}
			>
				{label}
			</Text>
		</Pressable>
	)
}

interface ChipRowProps {
	values: readonly number[]
	selected: number | null
	onSelect: (value: number) => void
	suffix?: string
}

export function MlChipRow ({
	values,
	selected,
	onSelect,
	suffix = ' мл',
}: ChipRowProps) {
	const { colors } = useAppTheme()
	return (
		<View style={styles.chips}>
			{values.map((value) => {
				const isOn = selected === value
				return (
					<Pressable
						key={value}
						onPress={() => onSelect(value)}
						style={[
							styles.chip,
							{
								backgroundColor: isOn
									? colors.primary
									: colors.primarySoft,
								borderColor: colors.border,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel={`${value}${suffix}`}
						accessibilityState={{ selected: isOn }}
					>
						<Text
							style={{
								color: isOn ? '#FFFFFF' : colors.primary,
								fontWeight: '700',
							}}
						>
							{value}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	btn: {
		minHeight: 56,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	label: {
		...typography.button,
		textAlign: 'center',
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	chip: {
		minWidth: 64,
		minHeight: 48,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
