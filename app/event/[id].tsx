/**
 * Edit / delete activity, temperature, medicine, note, or custom event.
 * Query: ?kind=activity|temperature|medicine|note|custom
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import { ChoiceButton } from '@/src/components/FeedingControls'
import { DateOnlyPickerField } from '@/src/components/DateOnlyPickerField'
import { TimePickerField } from '@/src/components/TimePickerField'
import { useDatabase } from '@/src/context/DatabaseContext'
import { QuickEventValidationError } from '@/src/domain/quickEventLabels'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatLocalTime } from '@/src/utils/datetime'
import { combineLocalDateAndTime } from '@/src/utils/intervalOverlap'
import { radii, spacing } from '@/src/theme/tokens'

export default function EditQuickEventScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { quickEvents } = useDatabase()
	const params = useLocalSearchParams<{ id: string; kind?: string }>()
	const eventId = String(params.id ?? '')
	const kind = String(params.kind ?? 'activity')

	const [loading, setLoading] = useState(true)
	const [date, setDate] = useState<string | null>(null)
	const [timeHm, setTimeHm] = useState('12:00')
	const [minutes, setMinutes] = useState('')
	const [notes, setNotes] = useState('')
	const [celsius, setCelsius] = useState('36,6')
	const [name, setName] = useState('')
	const [dose, setDose] = useState('')
	const [unit, setUnit] = useState('')
	const [title, setTitle] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [found, setFound] = useState(false)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			if (!quickEvents || !eventId) {
				setLoading(false)
				return
			}
			try {
				if (kind === 'activity') {
					const row = await quickEvents.getActivityById(eventId)
					if (!row) {
						setError('Запись не найдена')
						return
					}
					setDate(row.startLocalDate)
					setTimeHm(formatLocalTime(row.startAt))
					setMinutes(
						row.durationSeconds != null
							? String(Math.round(row.durationSeconds / 60))
							: '',
					)
					setNotes(row.notes ?? '')
					setFound(true)
				} else if (kind === 'temperature') {
					const row = await quickEvents.getTemperatureById(eventId)
					if (!row) {
						setError('Запись не найдена')
						return
					}
					setDate(row.startLocalDate)
					setTimeHm(formatLocalTime(row.startAt))
					setCelsius(row.celsius.toFixed(1).replace('.', ','))
					setNotes(row.notes ?? '')
					setFound(true)
				} else if (kind === 'medicine') {
					const row = await quickEvents.getMedicineById(eventId)
					if (!row) {
						setError('Запись не найдена')
						return
					}
					setDate(row.startLocalDate)
					setTimeHm(formatLocalTime(row.startAt))
					setName(row.name)
					setDose(row.doseText ?? '')
					setUnit(row.unit ?? '')
					setNotes(row.notes ?? '')
					setFound(true)
				} else if (kind === 'note') {
					const row = await quickEvents.getNoteById(eventId)
					if (!row) {
						setError('Запись не найдена')
						return
					}
					setDate(row.startLocalDate)
					setTimeHm(formatLocalTime(row.startAt))
					setTitle(row.title ?? '')
					setNotes(row.notes ?? '')
					setFound(true)
				} else if (kind === 'custom') {
					const row = await quickEvents.getCustomEventById(eventId)
					if (!row) {
						setError('Запись не найдена')
						return
					}
					setDate(row.startLocalDate)
					setTimeHm(formatLocalTime(row.startAt))
					setMinutes(
						row.durationSeconds != null
							? String(Math.round(row.durationSeconds / 60))
							: '',
					)
					setNotes(row.notes ?? '')
					setFound(true)
				}
			} catch (err) {
				logger.error('load quick event failed', err)
				if (!cancelled) {
					setError('Не удалось загрузить')
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [quickEvents, eventId, kind])

	const handleSave = async (): Promise<void> => {
		if (!quickEvents || !date) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const occurredAt = combineLocalDateAndTime(date, timeHm)
			const durationSeconds = minutes.trim()
				? Math.round(Number(minutes.trim())) * 60
				: null

			if (kind === 'activity') {
				await quickEvents.updateActivity(eventId, {
					occurredAt,
					durationSeconds,
					notes: notes.trim() || null,
				})
			} else if (kind === 'temperature') {
				await quickEvents.updateTemperature(eventId, {
					occurredAt,
					celsiusRaw: celsius,
					notes: notes.trim() || null,
				})
			} else if (kind === 'medicine') {
				await quickEvents.updateMedicine(eventId, {
					occurredAt,
					name,
					doseText: dose.trim() || null,
					unit: unit.trim() || null,
					notes: notes.trim() || null,
				})
			} else if (kind === 'note') {
				await quickEvents.updateNote(eventId, {
					occurredAt,
					title: title.trim() || null,
					notes: notes.trim() || null,
				})
			} else if (kind === 'custom') {
				await quickEvents.updateCustomEvent(eventId, {
					occurredAt,
					durationSeconds,
					notes: notes.trim() || null,
				})
			}
			router.back()
		} catch (err) {
			logger.error('save quick event failed', err)
			setError(
				err instanceof QuickEventValidationError
					? err.message
					: 'Не удалось сохранить',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		Alert.alert('Удалить запись?', 'Это нельзя отменить.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						if (!quickEvents) {
							return
						}
						try {
							await quickEvents.deleteEvent(eventId)
							router.replace('/(tabs)' as Href)
						} catch (err) {
							logger.error('delete quick event failed', err)
							setError('Не удалось удалить')
						}
					})()
				},
			},
		])
	}

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	if (!found) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={{ color: colors.textSecondary }}>
					{error ?? 'Запись не найдена'}
				</Text>
			</View>
		)
	}

	return (
		<KeyboardAvoidingView
			style={[styles.flex, { backgroundColor: colors.background }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{date ? (
					<DateOnlyPickerField label="Дата" value={date} onChange={setDate} />
				) : null}
				<TimePickerField
					label="Время"
					value={timeHm}
					onChange={(hm) => {
						if (hm) {
							setTimeHm(hm)
						}
					}}
				/>
				{kind === 'temperature' ? (
					<TextInput
						value={celsius}
						onChangeText={setCelsius}
						keyboardType="decimal-pad"
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
				) : null}
				{kind === 'medicine' ? (
					<>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Название"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<TextInput
							value={dose}
							onChangeText={setDose}
							placeholder="Количество"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<TextInput
							value={unit}
							onChangeText={setUnit}
							placeholder="Единица"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					</>
				) : null}
				{kind === 'note' ? (
					<TextInput
						value={title}
						onChangeText={setTitle}
						placeholder="Заголовок"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
				) : null}
				{kind === 'activity' || kind === 'custom' ? (
					<TextInput
						value={minutes}
						onChangeText={setMinutes}
						keyboardType="number-pad"
						placeholder="Минуты"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
				) : null}
				<TextInput
					value={notes}
					onChangeText={setNotes}
					placeholder="Заметка"
					placeholderTextColor={colors.textMuted}
					style={[
						styles.input,
						{ color: colors.text, borderColor: colors.border },
					]}
				/>
				{error ? (
					<Text style={{ color: colors.danger, marginBottom: spacing.sm }}>
						{error}
					</Text>
				) : null}
				<ChoiceButton
					label="Сохранить"
					onPress={() => void handleSave()}
					disabled={busy}
				/>
				<Pressable onPress={handleDelete} style={styles.delete}>
					<Text style={{ color: colors.danger, fontWeight: '700' }}>
						Удалить
					</Text>
				</Pressable>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xxl },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	delete: {
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
