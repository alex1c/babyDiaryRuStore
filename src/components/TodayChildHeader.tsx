/**
 * Compact Today header: avatar + name + age + dropdown for child switch.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Child } from '../models/types'
import { formatChildAge } from '../utils/childAge'
import { useAppTheme } from '../theme/ThemeProvider'
import { spacing, typography } from '../theme/tokens'
import { ChildAvatar } from './ChildAvatar'

interface TodayChildHeaderProps {
	child: Child
	onPress: () => void
}

export function TodayChildHeader ({ child, onPress }: TodayChildHeaderProps) {
	const { colors } = useAppTheme()

	return (
		<Pressable
			onPress={onPress}
			style={styles.row}
			accessibilityRole="button"
			accessibilityLabel={`Активный ребёнок ${child.name}. Сменить`}
		>
			<ChildAvatar name={child.name} photoUri={child.photoUri} size={36} />
			<View style={styles.textCol}>
				<View style={styles.nameRow}>
					<Text
						style={[styles.name, { color: colors.text }]}
						numberOfLines={1}
						accessibilityRole="header"
					>
						{child.name}
					</Text>
					<Text style={[styles.chevron, { color: colors.textMuted }]}>
						▼
					</Text>
				</View>
				<Text style={[styles.age, { color: colors.textSecondary }]}>
					{formatChildAge(child.birthDate)}
				</Text>
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	textCol: {
		flex: 1,
		minWidth: 0,
	},
	nameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.xs,
	},
	name: {
		...typography.title,
		flexShrink: 1,
	},
	chevron: {
		fontSize: 10,
		marginTop: 2,
	},
	age: {
		...typography.caption,
	},
})
