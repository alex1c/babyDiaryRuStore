/**
 * Create / edit milestone (achievement).
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

import { FormKeyboardShell } from '@/src/components/FormKeyboardShell'
import { ManagedImage } from '@/src/components/ManagedImage'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	defaultMilestoneTitle,
	milestoneTypeLabel,
} from '@/src/domain/developmentLabels'
import { MILESTONE_TYPES, type MilestoneType } from '@/src/models/development'
import { getAppPhotoStorage } from '@/src/services/appPhotoStorage'
import {
	photoPermissionDeniedMessage,
	pickImageFromLibrary,
} from '@/src/services/photoPicker'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly, toOffsetDateTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function MilestoneFormScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { milestones, moments } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null

	const [type, setType] = useState<MilestoneType>('first_smile')
	const [title, setTitle] = useState('')
	const [notes, setNotes] = useState('')
	const [photoUri, setPhotoUri] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!editId || !milestones) {
				return
			}
			const row = await milestones.getById(editId)
			if (!row) {
				return
			}
			setType(row.milestoneType)
			setTitle(row.title)
			setNotes(row.notes ?? '')
			setPhotoUri(row.photoUri)
		})()
	}, [editId, milestones])

	const handlePickPhoto = async (): Promise<void> => {
		const picked = await pickImageFromLibrary()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setError(photoPermissionDeniedMessage())
			}
			return
		}
		try {
			const managed = await getAppPhotoStorage().importFromUri(picked.uri)
			setPhotoUri(managed)
			setError(null)
		} catch (err) {
			logger.error('import photo failed', err)
			setError('Не удалось сохранить фото')
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!milestones || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const resolvedTitle =
				type === 'other'
					? title.trim() || 'Другое'
					: title.trim() || defaultMilestoneTitle(type)

			let savedId = editId
			if (editId) {
				await milestones.update(editId, {
					milestoneType: type,
					title: resolvedTitle,
					notes,
					photoUri,
				})
			} else {
				const created = await milestones.create({
					childId: activeChild.id,
					milestoneType: type,
					title: resolvedTitle,
					notes,
					photoUri,
					occurredAt: toOffsetDateTime(new Date()),
				})
				savedId = created.id
			}

			// Optional moment sharing the same managed photo (no duplicate file).
			if (photoUri && moments && savedId) {
				const existing = await moments.listByChild(activeChild.id, 50)
				const linked = existing.find(
					(m) =>
						m.photoUri === photoUri ||
						m.milestoneEventId === savedId,
				)
				if (!linked) {
					const moment = await moments.create({
						childId: activeChild.id,
						photoUri,
						title: resolvedTitle,
						milestoneEventId: savedId,
						takenAt: toOffsetDateTime(new Date()),
					})
					await milestones.update(savedId, {
						linkedMomentId: moment.id,
					})
				}
			}

			router.back()
		} catch (err) {
			logger.error('save milestone failed', err)
			setError('Не удалось сохранить')
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !milestones) {
			return
		}
		Alert.alert('Удалить достижение?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await milestones.delete(editId)
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
			{/* Keep Save reachable above the keyboard on form screens. */}
			<FormKeyboardShell>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Тип
				</Text>
				<View style={styles.chips}>
					{MILESTONE_TYPES.map((t) => (
						<Pressable
							key={t}
							onPress={() => {
								setType(t)
								if (t !== 'other') {
									setTitle(defaultMilestoneTitle(t))
								}
							}}
							style={[
								styles.chip,
								{
									backgroundColor:
										type === t
											? colors.primarySoft
											: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{milestoneTypeLabel(t)}
							</Text>
						</Pressable>
					))}
				</View>
				{type === 'other' ? (
					<>
						<Text
							style={[styles.label, { color: colors.textSecondary }]}
						>
							Название
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
					</>
				) : null}
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
				{photoUri ? (
					<ManagedImage uri={photoUri} style={styles.preview} />
				) : null}
				<Pressable
					onPress={() => void handlePickPhoto()}
					style={[styles.secondary, { borderColor: colors.border }]}
				>
					<Text style={{ color: colors.primary }}>
						{photoUri ? 'Заменить фото' : 'Добавить фото'}
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
				<Text style={{ color: colors.textMuted, ...typography.caption }}>
					Дата: {toLocalDateOnly()}
				</Text>
			</ScrollView>
			</FormKeyboardShell>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm },
	label: { ...typography.caption },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		...typography.body,
	},
	multiline: { minHeight: 72, textAlignVertical: 'top' },
	preview: { width: '100%', height: 180, borderRadius: radii.md },
	secondary: {
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
