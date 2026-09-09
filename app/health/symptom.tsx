/**
 * Symptom create / edit / resolve.
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

import { ManagedImage } from '@/src/components/ManagedImage'
import { LightweightToast, useLightweightToast } from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	symptomSeverityLabel,
	symptomTypeLabel,
} from '@/src/domain/healthLabels'
import {
	SYMPTOM_SEVERITIES,
	SYMPTOM_TYPES,
	type SymptomSeverity,
	type SymptomType,
} from '@/src/models/health'
import { getHealthDocumentStorage } from '@/src/services/appPhotoStorage'
import {
	photoPermissionDeniedMessage,
	pickImageFromLibrary,
} from '@/src/services/photoPicker'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthSymptomScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { symptoms } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null
	const { message, showToast } = useLightweightToast()

	const [type, setType] = useState<SymptomType>('runny_nose')
	const [customLabel, setCustomLabel] = useState('')
	const [severity, setSeverity] = useState<SymptomSeverity | null>(null)
	const [notes, setNotes] = useState('')
	const [photoUri, setPhotoUri] = useState<string | null>(null)
	const [resolved, setResolved] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!editId || !symptoms) {
				return
			}
			const row = await symptoms.getById(editId)
			if (!row) {
				return
			}
			setType(row.symptomType)
			setCustomLabel(row.customLabel ?? '')
			setSeverity(row.severity)
			setNotes(row.notes ?? '')
			setPhotoUri(row.photoUri)
			setResolved(row.resolvedAt != null)
		})()
	}, [editId, symptoms])

	const handlePick = async (): Promise<void> => {
		const picked = await pickImageFromLibrary()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setError(photoPermissionDeniedMessage())
			}
			return
		}
		try {
			const managed = await getHealthDocumentStorage().importFromUri(
				picked.uri,
			)
			setPhotoUri(managed)
			setError(null)
		} catch (err) {
			logger.error('symptom photo failed', err)
			setError('Не удалось сохранить фото')
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!symptoms || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			if (editId) {
				await symptoms.update(editId, {
					symptomType: type,
					customLabel,
					severity,
					notes,
					photoUri,
				})
			} else {
				await symptoms.create({
					childId: activeChild.id,
					symptomType: type,
					customLabel,
					severity,
					notes,
					photoUri,
				})
			}
			showToast('Запись сохранена')
			router.back()
		} catch (err) {
			logger.error('symptom save failed', err)
			setError('Не удалось сохранить')
			setBusy(false)
		}
	}

	const handleResolve = async (): Promise<void> => {
		if (!editId || !symptoms) {
			return
		}
		await symptoms.resolve(editId)
		showToast('Отмечено завершённым')
		router.back()
	}

	const handleDelete = (): void => {
		if (!editId || !symptoms) {
			return
		}
		Alert.alert('Удалить симптом?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await symptoms.delete(editId)
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
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Тип
				</Text>
				<View style={styles.chips}>
					{SYMPTOM_TYPES.map((t) => (
						<Pressable
							key={t}
							onPress={() => setType(t)}
							style={[
								styles.chip,
								{
									backgroundColor:
										type === t ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{symptomTypeLabel(t)}
							</Text>
						</Pressable>
					))}
				</View>
				{type === 'other' ? (
					<TextInput
						value={customLabel}
						onChangeText={setCustomLabel}
						placeholder="Название"
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
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Выраженность (необязательно)
				</Text>
				<View style={styles.chips}>
					{SYMPTOM_SEVERITIES.map((s) => (
						<Pressable
							key={s}
							onPress={() =>
								setSeverity((prev) => (prev === s ? null : s))
							}
							style={[
								styles.chip,
								{
									backgroundColor:
										severity === s
											? colors.primarySoft
											: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{symptomSeverityLabel(s)}
							</Text>
						</Pressable>
					))}
				</View>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					placeholder="Заметка"
					placeholderTextColor={colors.textMuted}
					multiline
					style={[
						styles.input,
						styles.multi,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				{photoUri ? (
					<ManagedImage uri={photoUri} style={styles.photo} />
				) : null}
				<Pressable
					onPress={() => void handlePick()}
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
					style={[styles.save, { backgroundColor: colors.primary }]}
				>
					<Text style={{ color: colors.surface, fontWeight: '600' }}>
						Сохранить
					</Text>
				</Pressable>
				{editId && !resolved ? (
					<Pressable
						onPress={() => void handleResolve()}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>
							Отметить завершённым
						</Text>
					</Pressable>
				) : null}
				{editId ? (
					<Pressable onPress={handleDelete} style={styles.delete}>
						<Text style={{ color: colors.danger }}>Удалить</Text>
					</Pressable>
				) : null}
				{!editId ? (
					<Pressable
						onPress={() => router.push('/health/history' as Href)}
						style={styles.delete}
					>
						<Text style={{ color: colors.primary }}>К истории</Text>
					</Pressable>
				) : null}
			</ScrollView>
			<LightweightToast message={message} />
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
	multi: { minHeight: 72, textAlignVertical: 'top' },
	photo: { width: '100%', height: 160, borderRadius: radii.md },
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
