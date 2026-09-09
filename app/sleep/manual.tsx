/**
 * Manual / backdated sleep entry form.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { SleepValidationError } from '@/src/domain/sleepValidation'
import type { SleepType } from '@/src/models/sleep'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
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

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

function dateToHm (date: Date): string {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export default function ManualSleepScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { sleep } = useDatabase()

	const [localDate, setLocalDate] = useState(toLocalDateOnly())
	const [startHm, setStartHm] = useState('10:00')
	const [endHm, setEndHm] = useState('11:30')
	const [sleepType, setSleepType] = useState<SleepType>('auto')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [picker, setPicker] = useState<'date' | 'start' | 'end' | null>(null)

	const onPickerChange = (
		event: DateTimePickerEvent,
		date?: Date,
	): void => {
		if (Platform.OS === 'android') {
			setPicker(null)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		if (picker === 'date') {
			setLocalDate(toLocalDateOnly(date))
		} else if (picker === 'start') {
			setStartHm(dateToHm(date))
		} else if (picker === 'end') {
			setEndHm(dateToHm(date))
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!sleep || !activeChild) {
			setError('Нет активного профиля малыша')
			return
		}
		setBusy(true)
		setError(null)
		try {
			const startAt = combineLocalDateAndTime(localDate, startHm)
			const resolved = resolveManualSleepEnd(localDate, startHm, endHm)
			await sleep.createManual({
				childId: activeChild.id,
				startAt,
				endAt: resolved.endAt,
				sleepType,
				notes: notes.trim() || null,
			})
			router.back()
		} catch (err) {
			logger.error('manual sleep failed', err)
			setError(
				err instanceof SleepValidationError
					? err.message
					: 'Не удалось сохранить сон',
			)
		} finally {
			setBusy(false)
		}
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
				<Text style={[styles.label, { color: colors.textSecondary }]}>Дата начала</Text>
				<Pressable
					style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
					onPress={() => setPicker('date')}
					accessibilityRole="button"
					accessibilityLabel="Дата сна"
				>
					<Text style={{ color: colors.text }}>{localDate}</Text>
				</Pressable>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Начало</Text>
				<Pressable
					style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
					onPress={() => setPicker('start')}
					accessibilityRole="button"
					accessibilityLabel="Время начала сна"
				>
					<Text style={{ color: colors.text }}>{startHm}</Text>
				</Pressable>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Окончание</Text>
				<Pressable
					style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
					onPress={() => setPicker('end')}
					accessibilityRole="button"
					accessibilityLabel="Время окончания сна"
				>
					<Text style={{ color: colors.text }}>{endHm}</Text>
				</Pressable>
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					Если окончание раньше начала, сон считается через полночь.
				</Text>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Тип сна</Text>
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
								accessibilityLabel={`Тип сна: ${opt.label}`}
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
					placeholder="Необязательно"
					placeholderTextColor={colors.textMuted}
					style={[
						styles.input,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					accessibilityLabel="Заметка к сну"
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
					accessibilityLabel="Сохранить сон"
				>
					<Text style={styles.saveText}>
						{busy ? 'Сохраняем…' : 'Сохранить'}
					</Text>
				</Pressable>
			</ScrollView>

			{picker ? (
				<DateTimePicker
					value={new Date()}
					mode={picker === 'date' ? 'date' : 'time'}
					is24Hour
					display="default"
					onChange={onPickerChange}
				/>
			) : null}
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xxl },
	label: { ...typography.caption, marginBottom: spacing.xs },
	field: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
		marginBottom: spacing.md,
	},
	hint: { ...typography.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
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
	},
	saveText: { ...typography.button, color: '#FFFFFF' },
})
