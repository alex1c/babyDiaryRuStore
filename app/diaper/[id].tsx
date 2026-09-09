/**
 * Edit / delete diaper — type, time, optional color/consistency/notes.
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
import {
	DIAPER_COLORS,
	DIAPER_CONSISTENCIES,
	diaperColorLabel,
	diaperConsistencyLabel,
	diaperKindLabel,
} from '@/src/domain/diaperLabels'
import type {
	DiaperColor,
	DiaperConsistency,
	DiaperEvent,
	DiaperKind,
} from '@/src/models/diaper'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatLocalTime } from '@/src/utils/datetime'
import { combineLocalDateAndTime } from '@/src/utils/intervalOverlap'
import { radii, spacing, typography } from '@/src/theme/tokens'

const KINDS: DiaperKind[] = ['wet', 'dirty', 'both', 'dry']

export default function EditDiaperScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { diaper } = useDatabase()
	const params = useLocalSearchParams<{ id: string }>()
	const eventId = String(params.id ?? '')

	const [row, setRow] = useState<DiaperEvent | null>(null)
	const [loading, setLoading] = useState(true)
	const [kind, setKind] = useState<DiaperKind>('wet')
	const [date, setDate] = useState<string | null>(null)
	const [timeHm, setTimeHm] = useState('12:00')
	const [color, setColor] = useState<DiaperColor | null>(null)
	const [consistency, setConsistency] = useState<DiaperConsistency | null>(null)
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			if (!diaper || !eventId) {
				setLoading(false)
				return
			}
			try {
				const existing = await diaper.getById(eventId)
				if (cancelled) {
					return
				}
				if (!existing) {
					setError('Запись не найдена')
					setLoading(false)
					return
				}
				setRow(existing)
				setKind(existing.kind)
				setDate(existing.startLocalDate)
				setTimeHm(formatLocalTime(existing.startAt))
				setColor(existing.color)
				setConsistency(existing.consistency)
				setNotes(existing.notes ?? '')
			} catch (err) {
				logger.error('load diaper failed', err)
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
	}, [diaper, eventId])

	const handleSave = async (): Promise<void> => {
		if (!diaper || !row || !date) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			await diaper.update(row.id, {
				kind,
				occurredAt: combineLocalDateAndTime(date, timeHm),
				color,
				consistency,
				notes: notes.trim() || null,
			})
			router.back()
		} catch (err) {
			logger.error('save diaper failed', err)
			setError('Не удалось сохранить')
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
						if (!diaper || !row) {
							return
						}
						try {
							await diaper.delete(row.id)
							router.replace('/(tabs)' as Href)
						} catch (err) {
							logger.error('delete diaper failed', err)
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
				{KINDS.map((item) => (
					<ChoiceButton
						key={item}
						label={diaperKindLabel(item)}
						primary={kind === item}
						onPress={() => setKind(item)}
					/>
				))}
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
				{(kind === 'dirty' || kind === 'both') ? (
					<>
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Цвет
						</Text>
						{DIAPER_COLORS.map((item) => (
							<ChoiceButton
								key={item}
								label={diaperColorLabel(item)}
								primary={color === item}
								onPress={() =>
									setColor((prev) => (prev === item ? null : item))
								}
							/>
						))}
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Консистенция
						</Text>
						{DIAPER_CONSISTENCIES.map((item) => (
							<ChoiceButton
								key={item}
								label={diaperConsistencyLabel(item)}
								primary={consistency === item}
								onPress={() =>
									setConsistency((prev) => (prev === item ? null : item))
								}
							/>
						))}
					</>
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
	label: {
		...typography.caption,
		marginTop: spacing.sm,
		marginBottom: spacing.xs,
		textTransform: 'uppercase',
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
