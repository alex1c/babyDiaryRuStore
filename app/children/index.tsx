/**
 * Children manager — list profiles, mark active, open detail / add.
 */

import { Link, useRouter, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChildAvatar } from '@/src/components/ChildAvatar'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { formatChildAge } from '@/src/utils/childAge'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ChildrenListScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const {
		children: list,
		activeChildId,
		loading,
		refresh,
		setActiveChildId,
	} = useActiveChild()
	const [busyId, setBusyId] = useState<string | null>(null)

	useFocusEffect(
		useCallback(() => {
			void refresh()
		}, [refresh]),
	)

	const handleActivate = async (childId: string): Promise<void> => {
		if (childId === activeChildId || busyId) {
			return
		}
		setBusyId(childId)
		try {
			await setActiveChildId(childId)
			await refresh()
		} finally {
			setBusyId(null)
		}
	}

	if (loading && list.length === 0) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right', 'bottom']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				{list.map((child) => {
					const isActive = child.id === activeChildId
					return (
						<View
							key={child.id}
							style={[
								styles.card,
								{
									backgroundColor: colors.surface,
									borderColor: isActive ? colors.primary : colors.border,
								},
							]}
						>
							<Pressable
								onPress={() =>
									router.push(`/children/${child.id}` as Href)
								}
								style={styles.cardMain}
								accessibilityRole="button"
								accessibilityLabel={`Профиль ${child.name}`}
							>
								<ChildAvatar
									name={child.name}
									photoUri={child.photoUri}
									size={52}
								/>
								<View style={styles.cardText}>
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
									{isActive ? (
										<Text
											style={[
												styles.activeBadge,
												{ color: colors.primary },
											]}
										>
											Активный
										</Text>
									) : null}
								</View>
								<Text style={{ color: colors.textMuted }}>›</Text>
							</Pressable>
							{!isActive ? (
								<Pressable
									onPress={() => {
										void handleActivate(child.id)
									}}
									disabled={busyId != null}
									style={[
										styles.activateBtn,
										{ borderColor: colors.border },
									]}
									accessibilityRole="button"
									accessibilityLabel={`Сделать ${child.name} активным`}
								>
									<Text style={{ color: colors.primary, fontWeight: '600' }}>
										{busyId === child.id
											? 'Переключаем…'
											: 'Сделать активным'}
									</Text>
								</Pressable>
							) : null}
						</View>
					)
				})}

				<Link href={'/children/new' as Href} asChild>
					<Pressable
						style={StyleSheet.flatten([
							styles.addBtn,
							{
								backgroundColor: colors.primary,
							},
						])}
						accessibilityRole="button"
						accessibilityLabel="Добавить ребёнка"
					>
						<Text style={styles.addLabel}>+ Добавить ребёнка</Text>
					</Pressable>
				</Link>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xl,
		gap: spacing.md,
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		overflow: 'hidden',
	},
	cardMain: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		padding: spacing.md,
	},
	cardText: {
		flex: 1,
		minWidth: 0,
	},
	name: {
		...typography.subtitle,
		fontWeight: '700',
	},
	age: {
		...typography.caption,
		marginTop: 2,
	},
	activeBadge: {
		...typography.caption,
		fontWeight: '700',
		marginTop: 4,
	},
	activateBtn: {
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	addBtn: {
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	addLabel: {
		...typography.button,
		color: '#FFFFFF',
	},
})
