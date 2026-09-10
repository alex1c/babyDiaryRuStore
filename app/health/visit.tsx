/**
 * Doctor visit create / edit + optional photo attachment.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
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
import { LightweightToast, useLightweightToast } from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { doctorSpecialistLabel } from '@/src/domain/healthLabels'
import {
	DOCTOR_SPECIALISTS,
	type DoctorSpecialistKey,
	type HealthAttachment,
} from '@/src/models/health'
import { getHealthDocumentStorage } from '@/src/services/appPhotoStorage'
import {
	photoPermissionDeniedMessage,
	pickImageFromLibrary,
} from '@/src/services/photoPicker'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toOffsetDateTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthVisitScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { doctorVisits, healthAttachments } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null
	const { message, showToast } = useLightweightToast()

	const [key, setKey] = useState<DoctorSpecialistKey>('pediatrician')
	const [custom, setCustom] = useState('')
	const [reason, setReason] = useState('')
	const [notes, setNotes] = useState('')
	const [recommendations, setRecommendations] = useState('')
	const [nextVisit, setNextVisit] = useState('')
	const [attachments, setAttachments] = useState<HealthAttachment[]>([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!editId || !doctorVisits) {
				return
			}
			const row = await doctorVisits.getById(editId)
			if (!row) {
				return
			}
			setKey(row.specialistKey)
			setCustom(
				row.specialistKey === 'other' ? row.specialistLabel : '',
			)
			setReason(row.reason ?? '')
			setNotes(row.notes ?? '')
			setRecommendations(row.recommendations ?? '')
			setNextVisit(row.nextVisitLocalDate ?? '')
			if (healthAttachments) {
				setAttachments(
					await healthAttachments.listByOwner('visit', editId),
				)
			}
		})()
	}, [editId, doctorVisits, healthAttachments])

	const handleAttach = async (visitId: string): Promise<void> => {
		if (!healthAttachments || !activeChild) {
			return
		}
		const picked = await pickImageFromLibrary()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setError(photoPermissionDeniedMessage())
			}
			return
		}
		try {
			const uri = await getHealthDocumentStorage().importFromUri(
				picked.uri,
			)
			await healthAttachments.create({
				childId: activeChild.id,
				ownerKind: 'visit',
				ownerId: visitId,
				fileUri: uri,
				mimeHint: 'image',
			})
			setAttachments(
				await healthAttachments.listByOwner('visit', visitId),
			)
		} catch (err) {
			logger.error('visit attach failed', err)
			setError('Не удалось прикрепить файл')
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!doctorVisits || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const nextVisitAt = nextVisit.trim()
				? toOffsetDateTime(new Date(`${nextVisit.trim()}T12:00:00`))
				: null
			if (editId) {
				await doctorVisits.update(editId, {
					specialistKey: key,
					specialistCustom: custom,
					reason,
					notes,
					recommendations,
					nextVisitAt,
				})
				showToast('Запись сохранена')
				router.back()
			} else {
				const created = await doctorVisits.create({
					childId: activeChild.id,
					specialistKey: key,
					specialistCustom: custom,
					reason,
					notes,
					recommendations,
					nextVisitAt,
				})
				showToast('Запись сохранена')
				router.replace(`/health/visit?id=${created.id}` as never)
			}
		} catch (err) {
			logger.error('visit save failed', err)
			setError('Не удалось сохранить')
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !doctorVisits) {
			return
		}
		Alert.alert('Удалить визит?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						if (healthAttachments) {
							await healthAttachments.deleteByOwner('visit', editId)
						}
						await doctorVisits.delete(editId)
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
					Специалист
				</Text>
				<View style={styles.chips}>
					{DOCTOR_SPECIALISTS.map((s) => (
						<Pressable
							key={s}
							onPress={() => setKey(s)}
							style={[
								styles.chip,
								{
									backgroundColor:
										key === s ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{doctorSpecialistLabel(s)}
							</Text>
						</Pressable>
					))}
				</View>
				{key === 'other' ? (
					<TextInput
						value={custom}
						onChangeText={setCustom}
						placeholder="Своё название"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{
								color: colors.text,
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
					/>
				) : null}
				<Field
					label="Причина"
					value={reason}
					onChangeText={setReason}
					colors={colors}
				/>
				<Field
					label="Заметки"
					value={notes}
					onChangeText={setNotes}
					colors={colors}
					multi
				/>
				<Field
					label="Рекомендации"
					value={recommendations}
					onChangeText={setRecommendations}
					colors={colors}
					multi
				/>
				<Field
					label="Следующий визит (ГГГГ-ММ-ДД)"
					value={nextVisit}
					onChangeText={setNextVisit}
					colors={colors}
				/>
				{nextVisit.trim() ? (
					<Pressable
						onPress={() => {
							const fireAt = toOffsetDateTime(
								new Date(`${nextVisit.trim()}T12:00:00`),
							)
							// Cast via unknown: typed routes lag behind new reminder screens.
							router.push({
								pathname: '/reminders/edit',
								params: {
									type: 'doctor',
									title: doctorSpecialistLabel(key),
									fireAt,
									relatedEntityId: editId ?? '',
								},
							} as unknown as Href)
						}}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>
							Добавить напоминание
						</Text>
					</Pressable>
				) : null}
				{attachments.map((a) => (
					<ManagedImage
						key={a.id}
						uri={a.fileUri}
						style={styles.photo}
					/>
				))}
				{editId ? (
					<Pressable
						onPress={() => void handleAttach(editId)}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>
							Прикрепить фото
						</Text>
					</Pressable>
				) : null}
				{error ? (
					<Text style={{ color: colors.danger }}>{error}</Text>
				) : null}
				<Pressable
					onPress={() => void handleSave()}
					disabled={busy}
					style={[styles.save, { backgroundColor: colors.primary }]}
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
			</FormKeyboardShell>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

function Field ({
	label,
	value,
	onChangeText,
	colors,
	multi,
}: {
	label: string
	value: string
	onChangeText: (v: string) => void
	colors: {
		text: string
		textSecondary: string
		surface: string
		border: string
	}
	multi?: boolean
}) {
	return (
		<>
			<Text style={[styles.label, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				multiline={multi}
				style={[
					styles.input,
					multi ? styles.multi : null,
					{
						color: colors.text,
						backgroundColor: colors.surface,
						borderColor: colors.border,
					},
				]}
			/>
		</>
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
	multi: { minHeight: 72, textAlignVertical: 'top' },
	photo: { width: '100%', height: 140, borderRadius: radii.md },
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
