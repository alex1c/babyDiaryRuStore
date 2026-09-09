/**
 * Create / edit a photo moment (managed filesystem URI).
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ManagedImage } from '@/src/components/ManagedImage'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { getAppPhotoStorage } from '@/src/services/appPhotoStorage'
import {
	photoPermissionDeniedMessage,
	pickImageFromLibrary,
	takePhotoWithCamera,
} from '@/src/services/photoPicker'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toOffsetDateTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function MomentFormScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { moments } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null

	const [photoUri, setPhotoUri] = useState<string | null>(null)
	const [previousUri, setPreviousUri] = useState<string | null>(null)
	const [title, setTitle] = useState('')
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isMonthPhoto, setIsMonthPhoto] = useState(false)

	useEffect(() => {
		void (async () => {
			if (!editId || !moments || !activeChild) {
				return
			}
			const row = await moments.getById(editId)
			if (!row) {
				return
			}
			setPhotoUri(row.photoUri)
			setPreviousUri(row.photoUri)
			setTitle(row.title ?? '')
			setNotes(row.notes ?? '')
			const selections = await moments.listMonthPhotos(activeChild.id)
			setIsMonthPhoto(selections.some((s) => s.momentId === editId))
		})()
	}, [editId, moments, activeChild])

	const importPicked = async (sourceUri: string): Promise<void> => {
		const managed = await getAppPhotoStorage().importFromUri(sourceUri)
		setPhotoUri(managed)
		setError(null)
	}

	const handleGallery = async (): Promise<void> => {
		const picked = await pickImageFromLibrary()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setError(photoPermissionDeniedMessage())
			}
			return
		}
		try {
			await importPicked(picked.uri)
		} catch (err) {
			logger.error('gallery import failed', err)
			setError('Не удалось сохранить фото')
		}
	}

	const handleCamera = async (): Promise<void> => {
		const picked = await takePhotoWithCamera()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setError(photoPermissionDeniedMessage())
			} else if (picked.reason === 'unavailable') {
				setError('Камера сейчас недоступна — выберите фото из галереи')
			}
			return
		}
		try {
			await importPicked(picked.uri)
		} catch (err) {
			logger.error('camera import failed', err)
			setError('Не удалось сохранить фото')
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!moments || !activeChild || busy) {
			return
		}
		if (!photoUri) {
			setError('Добавьте фото')
			return
		}
		setBusy(true)
		setError(null)
		try {
			let momentId = editId
			if (editId) {
				await moments.update(editId, {
					photoUri,
					title,
					notes,
				})
			} else {
				const created = await moments.create({
					childId: activeChild.id,
					photoUri,
					title,
					notes,
					takenAt: toOffsetDateTime(new Date()),
				})
				momentId = created.id
			}

			if (isMonthPhoto && momentId) {
				await moments.setMonthPhoto(activeChild.id, momentId)
			}

			// If photo was replaced on create flow leftover — delete old after update path
			if (
				editId &&
				previousUri &&
				photoUri !== previousUri
			) {
				// MomentRepository.update already cleans unused managed files.
			}

			router.back()
		} catch (err) {
			logger.error('save moment failed', err)
			setError('Не удалось сохранить')
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !moments) {
			return
		}
		Alert.alert('Удалить момент?', 'Фото в приложении будет удалено.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await moments.delete(editId)
						router.back()
					})()
				},
			},
		])
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				{photoUri ? (
					<ManagedImage uri={photoUri} style={styles.preview} />
				) : (
					<View
						style={[
							styles.preview,
							styles.placeholder,
							{ backgroundColor: colors.surfaceMuted },
						]}
					>
						<Text style={{ color: colors.textMuted }}>
							Выберите фото
						</Text>
					</View>
				)}
				<View style={styles.row}>
					<Pressable
						onPress={() => void handleGallery()}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>Галерея</Text>
					</Pressable>
					<Pressable
						onPress={() => void handleCamera()}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>Камера</Text>
					</Pressable>
				</View>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Подпись
				</Text>
				<TextInput
					value={title}
					onChangeText={setTitle}
					style={[
						styles.input,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Заметка
				</Text>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					multiline
					style={[
						styles.input,
						styles.multiline,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				<Pressable
					onPress={() => setIsMonthPhoto((v) => !v)}
					style={[
						styles.monthToggle,
						{
							backgroundColor: isMonthPhoto
								? colors.primarySoft
								: colors.surface,
							borderColor: colors.border,
						},
					]}
				>
					<Text style={{ color: colors.text }}>
						{isMonthPhoto
							? '★ Главное фото месяца'
							: 'Сделать фото месяца'}
					</Text>
				</Pressable>
				{error ? (
					<Text style={{ color: colors.danger }}>{error}</Text>
				) : null}
				<Pressable
					onPress={() => void handleSave()}
					disabled={busy}
					style={[
						styles.save,
						{ backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
					]}
				>
					<Text style={{ color: colors.surface, fontWeight: '600' }}>
						Сохранить
					</Text>
				</Pressable>
				{editId ? (
					<Pressable onPress={handleDelete} style={styles.delete}>
						<Text style={{ color: colors.danger }}>Удалить</Text>
					</Pressable>
				) : null}
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm },
	preview: {
		width: '100%',
		height: 220,
		borderRadius: radii.md,
	},
	placeholder: { alignItems: 'center', justifyContent: 'center' },
	row: { flexDirection: 'row', gap: spacing.sm },
	secondary: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	label: { ...typography.caption },
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		...typography.body,
	},
	multiline: { minHeight: 72, textAlignVertical: 'top' },
	monthToggle: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	save: {
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	delete: { alignItems: 'center', padding: spacing.md },
})
