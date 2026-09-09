/**
 * Compact bottom sheet for Today «Ещё» quick everyday actions.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

export type MoreActionId =
	| 'walk'
	| 'bath'
	| 'massage'
	| 'tummy_time'
	| 'vitamin'
	| 'temperature'
	| 'medicine'
	| 'note'
	| 'custom'
	| 'doctor'

interface MoreActionsSheetProps {
	visible: boolean
	onClose: () => void
	onSelect: (id: MoreActionId) => void
	customNames?: { id: string; name: string }[]
	onSelectCustom?: (definitionId: string) => void
}

const ACTIONS: { id: MoreActionId; label: string }[] = [
	{ id: 'walk', label: 'Прогулка' },
	{ id: 'bath', label: 'Купание' },
	{ id: 'massage', label: 'Массаж' },
	{ id: 'tummy_time', label: 'Животик' },
	{ id: 'vitamin', label: 'Витамин' },
	{ id: 'temperature', label: 'Температура' },
	{ id: 'medicine', label: 'Лекарство' },
	{ id: 'doctor', label: 'Врач' },
	{ id: 'note', label: 'Заметка' },
	{ id: 'custom', label: 'Своё событие' },
]

export function MoreActionsSheet ({
	visible,
	onClose,
	onSelect,
	customNames = [],
	onSelectCustom,
}: MoreActionsSheetProps) {
	const { colors } = useAppTheme()

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable
					style={[
						styles.sheet,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
					onPress={(e) => e.stopPropagation()}
				>
					<Text style={[styles.title, { color: colors.text }]}>Ещё</Text>
					<View style={styles.grid}>
						{ACTIONS.map((action) => (
							<Pressable
								key={action.id}
								onPress={() => {
									onSelect(action.id)
									onClose()
								}}
								style={[
									styles.btn,
									{
										backgroundColor: colors.primarySoft,
										borderColor: colors.border,
									},
								]}
								accessibilityRole="button"
								accessibilityLabel={action.label}
							>
								<Text
									style={{ color: colors.primary, fontWeight: '700' }}
									numberOfLines={1}
								>
									{action.label}
								</Text>
							</Pressable>
						))}
					</View>
					{customNames.length > 0 ? (
						<View style={styles.customBlock}>
							<Text style={[styles.sub, { color: colors.textMuted }]}>
								Ваши типы
							</Text>
							{customNames.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => {
										onSelectCustom?.(item.id)
										onClose()
									}}
									style={[
										styles.customRow,
										{ borderColor: colors.border },
									]}
									accessibilityRole="button"
									accessibilityLabel={item.name}
								>
									<Text style={{ color: colors.text, fontWeight: '600' }}>
										{item.name}
									</Text>
								</Pressable>
							))}
						</View>
					) : null}
					<Pressable onPress={onClose} style={styles.cancel}>
						<Text style={{ color: colors.textMuted }}>Закрыть</Text>
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
		maxHeight: '85%',
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	btn: {
		width: '47%',
		minHeight: 48,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
	customBlock: {
		marginTop: spacing.md,
	},
	sub: {
		...typography.caption,
		marginBottom: spacing.sm,
		textTransform: 'uppercase',
	},
	customRow: {
		minHeight: 44,
		borderBottomWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
	cancel: {
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
})
