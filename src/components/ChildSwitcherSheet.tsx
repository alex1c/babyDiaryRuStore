/**
 * Bottom sheet to switch the active child or add another profile.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Child } from '../models/types'
import { formatChildAge } from '../utils/childAge'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'
import { ChildAvatar } from './ChildAvatar'

interface ChildSwitcherSheetProps {
	visible: boolean
	childrenList: Child[]
	activeChildId: string | null
	onClose: () => void
	onSelect: (childId: string) => void
	onAddChild: () => void
}

export function ChildSwitcherSheet ({
	visible,
	childrenList,
	activeChildId,
	onClose,
	onSelect,
	onAddChild,
}: ChildSwitcherSheetProps) {
	const { colors } = useAppTheme()

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable
					style={[
						styles.sheet,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
					onPress={(e) => e.stopPropagation()}
				>
					<Text style={[styles.title, { color: colors.text }]}>
						Выберите ребёнка
					</Text>
					<ScrollView style={styles.list}>
						{childrenList.map((child) => {
							const isActive = child.id === activeChildId
							return (
								<Pressable
									key={child.id}
									onPress={() => {
										onSelect(child.id)
										onClose()
									}}
									style={[
										styles.row,
										{
											backgroundColor: isActive
												? colors.primarySoft
												: colors.background,
											borderColor: isActive
												? colors.primary
												: colors.border,
										},
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: isActive }}
									accessibilityLabel={`Выбрать ${child.name}`}
								>
									<ChildAvatar
										name={child.name}
										photoUri={child.photoUri}
										size={40}
									/>
									<View style={styles.rowText}>
										<Text
											style={[styles.name, { color: colors.text }]}
											numberOfLines={1}
										>
											{child.name}
										</Text>
										<Text
											style={[
												styles.age,
												{ color: colors.textSecondary },
											]}
										>
											{formatChildAge(child.birthDate)}
										</Text>
									</View>
									{isActive ? (
										<Text
											style={[
												styles.badge,
												{ color: colors.primary },
											]}
										>
											Активный
										</Text>
									) : null}
								</Pressable>
							)
						})}
					</ScrollView>
					<Pressable
						onPress={() => {
							onClose()
							onAddChild()
						}}
						style={[
							styles.addBtn,
							{
								backgroundColor: colors.primarySoft,
								borderColor: colors.border,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel="Добавить ребёнка"
					>
						<Text style={[styles.addLabel, { color: colors.primary }]}>
							+ Добавить ребёнка
						</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	sheet: {
		borderTopLeftRadius: radii.lg,
		borderTopRightRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: spacing.md,
		paddingBottom: spacing.xl,
		maxHeight: '70%',
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	list: {
		maxHeight: 320,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		padding: spacing.sm,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		marginBottom: spacing.sm,
		minHeight: 56,
	},
	rowText: {
		flex: 1,
		minWidth: 0,
	},
	name: {
		...typography.body,
		fontWeight: '600',
	},
	age: {
		...typography.caption,
	},
	badge: {
		...typography.caption,
		fontWeight: '700',
	},
	addBtn: {
		marginTop: spacing.sm,
		minHeight: 48,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addLabel: {
		...typography.button,
	},
})
