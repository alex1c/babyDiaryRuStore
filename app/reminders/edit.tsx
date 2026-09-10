/**
 * Create / edit a local reminder (permission asked only on enable/save).
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { FormKeyboardShell } from '@/src/components/FormKeyboardShell'
import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	reminderScheduleTypeLabel,
	reminderTypeLabel,
	weekdayShortRu,
} from '@/src/domain/reminderLabels'
import {
	REMINDER_SCHEDULE_TYPES,
	REMINDER_TYPES,
	type ReminderScheduleType,
	type ReminderType,
	type Weekday,
} from '@/src/models/reminder'
import {
	ReminderValidationError,
} from '@/src/services/reminderService'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toOffsetDateTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export default function ReminderEditScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { reminders, reminderService } = useDatabase()
	const params = useLocalSearchParams<{
		id?: string
		type?: string
		title?: string
		fireAt?: string
		relatedEntityId?: string
	}>()
	const editId = params.id ? String(params.id) : null

	const [type, setType] = useState<ReminderType>(
		(params.type as ReminderType) || 'custom',
	)
	const [title, setTitle] = useState(params.title ? String(params.title) : '')
	const [scheduleType, setScheduleType] =
		useState<ReminderScheduleType>('daily')
	const [timeLocal, setTimeLocal] = useState('09:00')
	const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5, 6, 7])
	const [fireDate, setFireDate] = useState('')
	const [fireTime, setFireTime] = useState('09:00')
	const [intervalHours, setIntervalHours] = useState('3')
	const [doseText, setDoseText] = useState('')
	const [enabled, setEnabled] = useState(true)
	const [relatedEntityId, setRelatedEntityId] = useState<string | null>(
		params.relatedEntityId ? String(params.relatedEntityId) : null,
	)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!editId || !reminders) {
				if (params.type === 'no_feeding') {
					setType('no_feeding')
					setScheduleType('interval_hours')
					setTitle('Нет кормления')
				}
				if (params.type === 'doctor' && params.fireAt) {
					setType('doctor')
					setScheduleType('once')
					const raw = String(params.fireAt)
					const m = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
					if (m) {
						setFireDate(m[1]!)
						setFireTime(m[2]!)
					}
				}
				return
			}
			const row = await reminders.getById(editId)
			if (!row) {
				return
			}
			setType(row.type)
			setTitle(row.title)
			setScheduleType(row.scheduleType)
			setTimeLocal(row.timeLocal ?? '09:00')
			setDays(row.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7])
			setIntervalHours(
				row.intervalHours != null ? String(row.intervalHours) : '3',
			)
			setDoseText(row.doseText ?? '')
			setEnabled(row.enabled)
			setRelatedEntityId(row.relatedEntityId)
			if (row.fireAt) {
				const m = row.fireAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
				if (m) {
					setFireDate(m[1]!)
					setFireTime(m[2]!)
				}
			}
		})()
	}, [editId, reminders, params.type, params.fireAt])

	const toggleDay = (day: Weekday): void => {
		setDays((prev) =>
			prev.includes(day)
				? prev.filter((d) => d !== day)
				: [...prev, day].sort((a, b) => a - b),
		)
	}

	const handleSave = async (): Promise<void> => {
		if (!activeChild || !reminderService) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const effectiveSchedule: ReminderScheduleType =
				type === 'no_feeding' ? 'interval_hours' : scheduleType
			const fireAt =
				effectiveSchedule === 'once'
					? buildFireAt(fireDate, fireTime)
					: null
			const payload = {
				childId: activeChild.id,
				type,
				title: title.trim() || reminderTypeLabel(type),
				enabled,
				scheduleType: effectiveSchedule,
				timeLocal:
					effectiveSchedule === 'daily' || effectiveSchedule === 'weekly'
						? timeLocal
						: null,
				daysOfWeek: effectiveSchedule === 'weekly' ? days : null,
				fireAt,
				intervalHours:
					effectiveSchedule === 'interval_hours'
						? Number(intervalHours.replace(',', '.'))
						: null,
				relatedEntityId,
				doseText: doseText.trim() || null,
			}

			if (editId) {
				await reminderService.update(editId, payload)
			} else {
				await reminderService.create(payload)
				// Create only — reminder_type snake_case enum, never title/notes/dose.
				trackAnalyticsEvent(ANALYTICS_EVENTS.reminderCreated, {
					reminder_type: type,
				})
			}
			router.back()
		} catch (err) {
			logger.error('save reminder failed', err)
			setError(
				err instanceof ReminderValidationError
					? err.message
					: 'Не удалось сохранить напоминание',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !reminderService) {
			return
		}
		Alert.alert('Удалить напоминание?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await reminderService.delete(editId)
						router.back()
					})()
				},
			},
		])
	}

	const openSettings = (): void => {
		void reminderService?.openSystemSettings()
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			{/* Keep Save reachable above the keyboard on form screens. */}
			<FormKeyboardShell>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={[styles.label, { color: colors.textMuted }]}>Тип</Text>
				<View style={styles.chips}>
					{REMINDER_TYPES.map((t) => (
						<Pressable
							key={t}
							onPress={() => {
								setType(t)
								if (t === 'no_feeding') {
									setScheduleType('interval_hours')
									if (!title) {
										setTitle('Нет кормления')
									}
								}
							}}
							style={[
								styles.chip,
								{
									backgroundColor:
										type === t ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text, fontSize: 13 }}>
								{reminderTypeLabel(t)}
							</Text>
						</Pressable>
					))}
				</View>

				<Text style={[styles.label, { color: colors.textMuted }]}>Название</Text>
				<TextInput
					value={title}
					onChangeText={setTitle}
					placeholder="Например, Витамин D"
					placeholderTextColor={colors.textMuted}
					style={[
						styles.input,
						{ color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
					]}
				/>

				{type === 'medicine' || type === 'vitamin' ? (
					<>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Доза (необязательно, как вы записали)
						</Text>
						<TextInput
							value={doseText}
							onChangeText={setDoseText}
							placeholder="Например, 1 капля"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{
									color: colors.text,
									borderColor: colors.border,
									backgroundColor: colors.surface,
								},
							]}
						/>
					</>
				) : null}

				{type !== 'no_feeding' ? (
					<>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Расписание
						</Text>
						<View style={styles.chips}>
							{REMINDER_SCHEDULE_TYPES.filter((s) => s !== 'interval_hours').map(
								(s) => (
									<Pressable
										key={s}
										onPress={() => setScheduleType(s)}
										style={[
											styles.chip,
											{
												backgroundColor:
													scheduleType === s
														? colors.primarySoft
														: colors.surface,
												borderColor: colors.border,
											},
										]}
									>
										<Text style={{ color: colors.text, fontSize: 13 }}>
											{reminderScheduleTypeLabel(s)}
										</Text>
									</Pressable>
								),
							)}
						</View>
					</>
				) : null}

				{(scheduleType === 'daily' || scheduleType === 'weekly') &&
				type !== 'no_feeding' ? (
					<>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Время (ЧЧ:ММ)
						</Text>
						<TextInput
							value={timeLocal}
							onChangeText={setTimeLocal}
							placeholder="09:00"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{
									color: colors.text,
									borderColor: colors.border,
									backgroundColor: colors.surface,
								},
							]}
						/>
					</>
				) : null}

				{scheduleType === 'weekly' && type !== 'no_feeding' ? (
					<View style={styles.chips}>
						{WEEKDAYS.map((d) => (
							<Pressable
								key={d}
								onPress={() => toggleDay(d)}
								style={[
									styles.chip,
									{
										backgroundColor: days.includes(d)
											? colors.primarySoft
											: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={{ color: colors.text }}>
									{weekdayShortRu(d)}
								</Text>
							</Pressable>
						))}
					</View>
				) : null}

				{scheduleType === 'once' && type !== 'no_feeding' ? (
					<>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Дата (ГГГГ-ММ-ДД)
						</Text>
						<TextInput
							value={fireDate}
							onChangeText={setFireDate}
							placeholder="2026-09-15"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{
									color: colors.text,
									borderColor: colors.border,
									backgroundColor: colors.surface,
								},
							]}
						/>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Время (ЧЧ:ММ)
						</Text>
						<TextInput
							value={fireTime}
							onChangeText={setFireTime}
							placeholder="14:30"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{
									color: colors.text,
									borderColor: colors.border,
									backgroundColor: colors.surface,
								},
							]}
						/>
					</>
				) : null}

				{type === 'no_feeding' || scheduleType === 'interval_hours' ? (
					<>
						<Text style={[styles.label, { color: colors.textMuted }]}>
							Часов без кормления
						</Text>
						<TextInput
							value={intervalHours}
							onChangeText={setIntervalHours}
							keyboardType="decimal-pad"
							placeholder="3"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{
									color: colors.text,
									borderColor: colors.border,
									backgroundColor: colors.surface,
								},
							]}
						/>
						<Text style={{ color: colors.textMuted, ...typography.caption }}>
							После каждого кормления время пересчитается. Уведомление
							нейтральное: «Последнее кормление было N часов назад».
						</Text>
					</>
				) : null}

				<View style={styles.enableRow}>
					<Text style={{ color: colors.text, ...typography.body }}>Включено</Text>
					<Switch
						value={enabled}
						onValueChange={setEnabled}
						trackColor={{ true: colors.primaryMuted, false: colors.border }}
					/>
				</View>

				{error ? (
					<>
						<Text style={{ color: colors.danger, ...typography.body }}>
							{error}
						</Text>
						{error.includes('разрешен') ? (
							<Pressable onPress={openSettings}>
								<Text style={{ color: colors.primary }}>
									Открыть настройки системы
								</Text>
							</Pressable>
						) : null}
					</>
				) : null}

				<Pressable
					onPress={() => void handleSave()}
					disabled={busy}
					style={[
						styles.cta,
						{ backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
					]}
				>
					<Text style={styles.ctaText}>Сохранить</Text>
				</Pressable>

				{editId ? (
					<Pressable onPress={handleDelete}>
						<Text style={{ color: colors.danger, textAlign: 'center' }}>
							Удалить
						</Text>
					</Pressable>
				) : null}
			</ScrollView>
			</FormKeyboardShell>
		</SafeAreaView>
	)
}

function buildFireAt (dateOnly: string, timeLocal: string): string {
	const [y, m, d] = dateOnly.split('-').map(Number)
	const [hh, mm] = timeLocal.split(':').map(Number)
	const dt = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
	return toOffsetDateTime(dt)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
	label: { ...typography.caption, marginTop: spacing.xs },
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
	enableRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: spacing.sm,
	},
	cta: {
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
		marginTop: spacing.md,
	},
	ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
