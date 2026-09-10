/**
 * Child detail — edit profile fields, activate, or delete with confirmation.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChildAvatar } from '@/src/components/ChildAvatar'
import { ChildProfileForm } from '@/src/components/ChildProfileForm'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	validateChildForm,
	type ChildFormValues,
} from '@/src/domain/childValidation'
import type { Child } from '@/src/models/types'
import {
	getAppPhotoStorage,
	getHealthDocumentStorage,
	getProfilePhotoStorage,
} from '@/src/services/appPhotoStorage'
import { deleteChildWithCleanup } from '@/src/services/childLifecycle'
import { logger } from '@/src/services/logger'
import { formatChildAge } from '@/src/utils/childAge'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ChildDetailScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const childId = params.id ? String(params.id) : null
	const {
		childrenRepo,
		reminders,
		reminderService,
		settings,
		db,
	} = useDatabase()
	const {
		activeChildId,
		refresh,
		setActiveChildId,
		children: list,
	} = useActiveChild()

	const [child, setChild] = useState<Child | null>(null)
	const [loading, setLoading] = useState(true)
	const [confirmName, setConfirmName] = useState('')
	const [deleting, setDeleting] = useState(false)
	const [showDelete, setShowDelete] = useState(false)

	const load = useCallback(async () => {
		if (!childrenRepo || !childId) {
			setChild(null)
			setLoading(false)
			return
		}
		setLoading(true)
		try {
			setChild(await childrenRepo.getById(childId))
		} catch (err) {
			logger.error('load child detail failed', err)
			setChild(null)
		} finally {
			setLoading(false)
		}
	}, [childrenRepo, childId])

	useEffect(() => {
		let cancelled = false
		queueMicrotask(() => {
			if (!cancelled) {
				void load()
			}
		})
		return () => {
			cancelled = true
		}
	}, [load])

	const handleSubmit = async (values: ChildFormValues): Promise<void> => {
		if (!childrenRepo || !child) {
			throw new Error('База данных ещё не готова.')
		}
		const result = validateChildForm(values)
		if (!result.ok || !result.parsed) {
			throw new Error(result.errors[0] ?? 'Проверьте введённые данные')
		}
		try {
			const updated = await childrenRepo.update(child.id, {
				name: result.parsed.name,
				birthDate: result.parsed.birthDate,
				birthTime: result.parsed.birthTime,
				sex: result.parsed.sex,
				birthWeightGrams: result.parsed.birthWeightGrams,
				birthHeightCm: result.parsed.birthHeightCm,
				photoUri: result.parsed.photoUri,
			})
			setChild(updated)
			await refresh()
		} catch (error) {
			logger.error('Failed to update child', error)
			throw new Error('Не удалось сохранить изменения.')
		}
	}

	const handleActivate = async (): Promise<void> => {
		if (!child) {
			return
		}
		await setActiveChildId(child.id)
		await refresh()
	}

	const handleDelete = async (): Promise<void> => {
		if (
			!child ||
			!db ||
			!childrenRepo ||
			!reminders ||
			!reminderService ||
			!settings ||
			deleting
		) {
			return
		}
		if (confirmName.trim() !== child.name) {
			Alert.alert(
				'Подтверждение',
				'Введите имя ребёнка точно, как в профиле.',
			)
			return
		}

		setDeleting(true)
		try {
			const result = await deleteChildWithCleanup(
				{
					db,
					children: childrenRepo,
					reminders,
					reminderService,
					settings,
					momentPhotos: getAppPhotoStorage(),
					healthPhotos: getHealthDocumentStorage(),
					profilePhotos: getProfilePhotoStorage(),
				},
				child.id,
			)
			await refresh()
			if (result.nextActiveChildId == null) {
				router.replace('/onboarding' as Href)
			} else {
				router.replace('/children' as Href)
			}
		} catch (error) {
			logger.error('delete child failed', error)
			Alert.alert('Ошибка', 'Не удалось удалить профиль.')
		} finally {
			setDeleting(false)
		}
	}

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	if (!child) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={{ color: colors.textSecondary }}>
					Профиль не найден.
				</Text>
			</View>
		)
	}

	const isActive = child.id === activeChildId

	const deleteFooter = (
		<View style={styles.deleteSection}>
			{!showDelete ? (
				<Pressable
					onPress={() => setShowDelete(true)}
					accessibilityRole="button"
					accessibilityLabel="Удалить профиль"
				>
					<Text style={[styles.deleteLink, { color: colors.danger }]}>
						Удалить профиль
					</Text>
				</Pressable>
			) : (
				<View
					style={[
						styles.deleteBox,
						{
							backgroundColor: colors.surface,
							borderColor: colors.danger,
						},
					]}
				>
					<Text style={[styles.warnTitle, { color: colors.danger }]}>
						Удаление профиля
					</Text>
					<Text style={{ color: colors.text, marginBottom: spacing.sm }}>
						Будут удалены все записи, фотографии, события и настройки
						этого ребёнка.
					</Text>
					{list.length === 1 ? (
						<Text
							style={{
								color: colors.textSecondary,
								marginBottom: spacing.sm,
							}}
						>
							Это единственный профиль. После удаления откроется экран
							создания нового малыша.
						</Text>
					) : null}
					<Text style={[styles.label, { color: colors.textSecondary }]}>
						Введите имя «{child.name}» для подтверждения
					</Text>
					<TextInput
						value={confirmName}
						onChangeText={setConfirmName}
						placeholder={child.name}
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{
								backgroundColor: colors.background,
								borderColor: colors.border,
								color: colors.text,
							},
						]}
						autoCorrect={false}
						accessibilityLabel="Подтверждение имени"
					/>
					<Pressable
						onPress={() => {
							void handleDelete()
						}}
						disabled={deleting}
						style={[styles.deleteBtn, { backgroundColor: colors.danger }]}
						accessibilityRole="button"
						accessibilityLabel="Подтвердить удаление"
					>
						<Text style={styles.deleteBtnText}>
							{deleting ? 'Удаляем…' : 'Удалить навсегда'}
						</Text>
					</Pressable>
					<Pressable
						onPress={() => {
							setShowDelete(false)
							setConfirmName('')
						}}
						style={styles.cancelDelete}
					>
						<Text style={{ color: colors.textSecondary }}>Отмена</Text>
					</Pressable>
				</View>
			)}
		</View>
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right', 'bottom']}
		>
			<View style={styles.header}>
				<ChildAvatar
					name={child.name}
					photoUri={child.photoUri}
					size={64}
				/>
				<View style={styles.headerText}>
					<Text style={[styles.name, { color: colors.text }]}>
						{child.name}
					</Text>
					<Text style={{ color: colors.textSecondary }}>
						{formatChildAge(child.birthDate)}
					</Text>
					{isActive ? (
						<Text style={{ color: colors.primary, fontWeight: '700' }}>
							Активный
						</Text>
					) : (
						<Pressable
							onPress={() => {
								void handleActivate()
							}}
							accessibilityRole="button"
						>
							<Text style={{ color: colors.primary, fontWeight: '600' }}>
								Сделать активным
							</Text>
						</Pressable>
					)}
				</View>
			</View>

			<ChildProfileForm
				key={`${child.id}-${child.updatedAt}`}
				initial={child}
				submitLabel="Сохранить"
				onSubmit={handleSubmit}
				footer={deleteFooter}
			/>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		marginBottom: spacing.sm,
	},
	headerText: {
		flex: 1,
		gap: 4,
	},
	name: {
		...typography.title,
	},
	deleteSection: {
		marginTop: spacing.lg,
	},
	deleteLink: {
		...typography.body,
		fontWeight: '600',
		textAlign: 'center',
		paddingVertical: spacing.md,
	},
	deleteBox: {
		borderWidth: 1,
		borderRadius: radii.md,
		padding: spacing.md,
	},
	warnTitle: {
		...typography.subtitle,
		fontWeight: '700',
		marginBottom: spacing.sm,
	},
	label: {
		...typography.caption,
		marginBottom: spacing.xs,
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.md,
		...typography.body,
	},
	deleteBtn: {
		minHeight: 48,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	deleteBtnText: {
		...typography.button,
		color: '#FFFFFF',
	},
	cancelDelete: {
		alignItems: 'center',
		paddingVertical: spacing.md,
	},
})
