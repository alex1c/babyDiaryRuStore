/**
 * Edit / delete an existing sleep event.
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import { DateOnlyPickerField } from '@/src/components/DateOnlyPickerField'
import { TimePickerField } from '@/src/components/TimePickerField'
import { useDatabase } from '@/src/context/DatabaseContext'
import { SleepValidationError } from '@/src/domain/sleepValidation'
import type { SleepEvent, SleepType } from '@/src/models/sleep'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import {
	formatLocalTime,
	localDateFromOffsetDateTime,
} from '@/src/utils/datetime'
import {
	combineLocalDateAndTime,
	resolveManualSleepEnd,
} from '@/src/utils/intervalOverlap'
import { radii, spacing, typography } from '@/src/theme/tokens'

const TYPE_OPTIONS: { value: SleepType; label: string }[] = [
	{ value: 'auto', label: 'Авто' },
	{ value: 'day', label: 'Дневной' },
	{ value: 'night', label: 'Ночной' },
]

export default function EditSleepScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { sleep } = useDatabase()
	const params = useLocalSearchParams<{ id: string }>()
	const eventId = String(params.id ?? '')

	const [row, setRow] = useState<SleepEvent | null>(null)
	const [loading, setLoading] = useState(true)
	const [startDate, setStartDate] = useState<string | null>(null)
	const [startHm, setStartHm] = useState('00:00')
	const [endHm, setEndHm] = useState<string | null>(null)
	const [sleepType, setSleepType] = useState<SleepType>('auto')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			if (!sleep || !eventId) {
				setLoading(false)
				return
			}
			try {
				const existing = await sleep.getById(eventId)
				if (cancelled) {
					return
				}
				if (!existing) {
					setError('Запись сна не найдена')
					setLoading(false)
					return
				}
				setRow(existing)
				setStartDate(existing.startLocalDate)
				setStartHm(formatLocalTime(existing.startAt))
				setEndHm(
					existing.endAt ? formatLocalTime(existing.endAt) : null,
				)
				setSleepType(existing.sleepType)
				setNotes(existing.notes ?? '')
			} catch (err) {
				logger.error('load sleep for edit failed', err)
				if (!cancelled) {
					setError('Не удалось загрузить запись')
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
	}, [sleep, eventId])

	const handleSave = async (): Promise<void> => {
		if (!sleep || !row || !startDate) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const startAt = combineLocalDateAndTime(startDate, startHm)
			let endAt: string | null = null
			if (endHm) {
				const resolved = resolveManualSleepEnd(startDate, startHm, endHm)
				endAt = resolved.endAt
			} else if (row.endAt != null) {
				setError('Укажите время окончания или удалите запись')
				setBusy(false)
				return
			}

			await sleep.update(row.id, {
				startAt,
				endAt: row.endAt == null && endHm == null ? null : endAt,
				sleepType,
				notes: notes.trim() || null,
			})
			router.back()
		} catch (err) {
			logger.error('update sleep failed', err)
			setError(
				err instanceof SleepValidationError
					? err.message
					: 'Не удалось сохранить изменения',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleDelete = async (): Promise<void> => {
		if (!sleep || !row) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			await sleep.delete(row.id)
			router.back()
		} catch (err) {
			logger.error('delete sleep failed', err)
			setError(
				err instanceof SleepValidationError
					? err.message
					: 'Не удалось удалить запись',
			)
		} finally {
			setBusy(false)
		}
	}

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	if (!row) {
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
				<DateOnlyPickerField
					label="Дата начала"
					value={startDate}
					onChange={setStartDate}
				/>
				<TimePickerField
					label="Начало"
					value={startHm}
					onChange={(v) => setStartHm(v ?? startHm)}
				/>
				<TimePickerField
					label={row.endAt == null ? 'Окончание (пусто = ещё спит)' : 'Окончание'}
					value={endHm}
					onChange={setEndHm}
				/>
				{row.endAt == null ? (
					<Text style={[styles.hint, { color: colors.textMuted }]}>
						Активный сон. Можно задать окончание или завершить с экрана «Сегодня».
					</Text>
				) : null}

				<Text style={[styles.label, { color: colors.textSecondary }]}>Тип</Text>
				<View style={styles.typeRow}>
					{TYPE_OPTIONS.map((opt) => {
						const selected = sleepType === opt.value
						return (
							<Pressable
								key={opt.value}
								onPress={() => setSleepType(opt.value)}
								style={[
									styles.chip,
									{
										backgroundColor: selected
											? colors.primarySoft
											: colors.surface,
										borderColor: selected
											? colors.primary
											: colors.border,
									},
								]}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								accessibilityLabel={opt.label}
							>
								<Text
									style={{
										color: selected ? colors.primary : colors.text,
										fontWeight: selected ? '700' : '500',
									}}
								>
									{opt.label}
								</Text>
							</Pressable>
						)
					})}
				</View>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Заметка</Text>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					style={[
						styles.input,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					accessibilityLabel="Заметка"
				/>

				{error ? (
					<Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
				) : null}

				<Pressable
					onPress={() => {
						void handleSave()
					}}
					disabled={busy}
					style={[
						styles.save,
						{ backgroundColor: busy ? colors.surfaceMuted : colors.primary },
					]}
					accessibilityRole="button"
					accessibilityLabel="Сохранить изменения"
				>
					<Text style={styles.saveText}>Сохранить</Text>
				</Pressable>

				<Pressable
					onPress={() => {
						void handleDelete()
					}}
					disabled={busy}
					style={[styles.delete, { borderColor: colors.danger }]}
					accessibilityRole="button"
					accessibilityLabel="Удалить запись сна"
				>
					<Text style={{ color: colors.danger, fontWeight: '700' }}>
						Удалить запись
					</Text>
				</Pressable>

				{row.endAt ? (
					<Text style={[styles.meta, { color: colors.textMuted }]}>
						Было: {localDateFromOffsetDateTime(row.startAt)}{' '}
						{formatLocalTime(row.startAt)}–
						{formatLocalTime(row.endAt)}
					</Text>
				) : null}
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	content: { padding: spacing.md, paddingBottom: spacing.xxl },
	label: { ...typography.caption, marginBottom: spacing.xs },
	hint: { ...typography.caption, marginBottom: spacing.md },
	typeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	chip: {
		minHeight: 44,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.md,
		...typography.body,
	},
	error: { ...typography.body, marginBottom: spacing.md },
	save: {
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: spacing.sm,
	},
	saveText: { ...typography.button, color: '#FFFFFF' },
	delete: {
		minHeight: 48,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: spacing.md,
	},
	meta: { ...typography.caption, textAlign: 'center' },
})
