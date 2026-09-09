/**
 * Edit / delete any feeding event by id.
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
	FeedingValidationError,
	solidReactionLabel,
} from '@/src/domain/feedingLabels'
import type {
	BottleContent,
	FeedingEvent,
	SolidReaction,
} from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatLocalTime } from '@/src/utils/datetime'
import {
	combineLocalDateAndTime,
	resolveManualSleepEnd,
} from '@/src/utils/intervalOverlap'
import { radii, spacing, typography } from '@/src/theme/tokens'

const REACTIONS: SolidReaction[] = [
	'liked',
	'neutral',
	'disliked',
	'possible_reaction',
]

export default function EditFeedingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { feeding } = useDatabase()
	const params = useLocalSearchParams<{ id: string }>()
	const eventId = String(params.id ?? '')

	const [row, setRow] = useState<FeedingEvent | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const [date, setDate] = useState<string | null>(null)
	const [startHm, setStartHm] = useState('00:00')
	const [endHm, setEndHm] = useState<string | null>(null)
	const [leftMin, setLeftMin] = useState('0')
	const [rightMin, setRightMin] = useState('0')
	const [amount, setAmount] = useState('')
	const [notes, setNotes] = useState('')
	const [bottleContent, setBottleContent] =
		useState<BottleContent>('expressed_milk')
	const [foodName, setFoodName] = useState('')
	const [amountText, setAmountText] = useState('')
	const [reaction, setReaction] = useState<SolidReaction | null>(null)
	const [pumpMinutes, setPumpMinutes] = useState('')

	useEffect(() => {
		let cancelled = false
		void (async () => {
			if (!feeding || !eventId) {
				setLoading(false)
				return
			}
			try {
				const existing = await feeding.getById(eventId)
				if (cancelled) {
					return
				}
				if (!existing) {
					setError('Запись не найдена')
					setLoading(false)
					return
				}
				setRow(existing)
				setDate(existing.startLocalDate)
				setStartHm(formatLocalTime(existing.startAt))
				setEndHm(existing.endAt ? formatLocalTime(existing.endAt) : null)
				setNotes(existing.notes ?? '')
				if (existing.type === 'breastfeeding') {
					setLeftMin(String(Math.round(existing.leftDurationSeconds / 60)))
					setRightMin(String(Math.round(existing.rightDurationSeconds / 60)))
				}
				if (existing.type === 'bottle' || existing.type === 'water') {
					setAmount(String(existing.amountMl))
				}
				if (existing.type === 'bottle') {
					setBottleContent(
						existing.feedingKind === 'formula'
							? 'formula'
							: 'expressed_milk',
					)
				}
				if (existing.type === 'solid_food') {
					setFoodName(existing.foodName)
					setAmountText(existing.amountText ?? '')
					setReaction(existing.reaction)
				}
				if (existing.type === 'pumping') {
					setAmount(
						existing.amountMl != null ? String(existing.amountMl) : '',
					)
					setPumpMinutes(
						existing.durationSeconds != null
							? String(Math.round(existing.durationSeconds / 60))
							: '',
					)
				}
			} catch (err) {
				logger.error('load feeding for edit failed', err)
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
	}, [feeding, eventId])

	const handleSave = async (): Promise<void> => {
		if (!feeding || !row || !date) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const startAt = combineLocalDateAndTime(date, startHm)
			if (row.type === 'breastfeeding') {
				let endAt: string | null = row.endAt
				if (endHm) {
					endAt = resolveManualSleepEnd(date, startHm, endHm).endAt
				}
				await feeding.updateBreastfeeding(row.id, {
					startAt,
					endAt,
					leftDurationSeconds: Math.round(Number(leftMin) || 0) * 60,
					rightDurationSeconds: Math.round(Number(rightMin) || 0) * 60,
					notes: notes.trim() || null,
				})
			} else if (row.type === 'bottle') {
				await feeding.updateBottle(row.id, {
					occurredAt: startAt,
					content: bottleContent,
					amountMl: Math.round(Number(amount)),
					notes: notes.trim() || null,
				})
			} else if (row.type === 'water') {
				await feeding.updateWater(row.id, {
					occurredAt: startAt,
					amountMl: Math.round(Number(amount)),
					notes: notes.trim() || null,
				})
			} else if (row.type === 'solid_food') {
				await feeding.updateSolid(row.id, {
					occurredAt: startAt,
					foodName,
					amountText: amountText.trim() || null,
					reaction,
					notes: notes.trim() || null,
				})
			} else if (row.type === 'pumping') {
				await feeding.updatePumping(row.id, {
					occurredAt: startAt,
					amountMl: amount.trim()
						? Math.round(Number(amount))
						: null,
					durationSeconds: pumpMinutes.trim()
						? Math.round(Number(pumpMinutes)) * 60
						: null,
					notes: notes.trim() || null,
				})
			}
			router.back()
		} catch (err) {
			logger.error('save feeding edit failed', err)
			setError(
				err instanceof FeedingValidationError
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
						if (!feeding || !row) {
							return
						}
						try {
							await feeding.delete(row.id)
							router.replace('/(tabs)' as Href)
						} catch (err) {
							logger.error('delete feeding failed', err)
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
				{date ? (
					<DateOnlyPickerField
						label="Дата"
						value={date}
						onChange={setDate}
					/>
				) : null}
				<TimePickerField
					label="Время"
					value={startHm}
					onChange={(hm) => {
						if (hm) {
							setStartHm(hm)
						}
					}}
				/>
				{row.type === 'breastfeeding' ? (
					<>
						<TimePickerField
							label="Окончание"
							value={endHm ?? startHm}
							onChange={(hm) => setEndHm(hm)}
						/>
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Левая, мин
						</Text>
						<TextInput
							value={leftMin}
							onChangeText={setLeftMin}
							keyboardType="number-pad"
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Правая, мин
						</Text>
						<TextInput
							value={rightMin}
							onChangeText={setRightMin}
							keyboardType="number-pad"
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					</>
				) : null}

				{row.type === 'bottle' ? (
					<>
						<ChoiceButton
							label="Сцеженное молоко"
							primary={bottleContent === 'expressed_milk'}
							onPress={() => setBottleContent('expressed_milk')}
						/>
						<ChoiceButton
							label="Смесь"
							primary={bottleContent === 'formula'}
							onPress={() => setBottleContent('formula')}
						/>
						<TextInput
							value={amount}
							onChangeText={setAmount}
							keyboardType="number-pad"
							placeholder="мл"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					</>
				) : null}

				{row.type === 'water' || row.type === 'pumping' ? (
					<TextInput
						value={amount}
						onChangeText={setAmount}
						keyboardType="number-pad"
						placeholder="мл"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
				) : null}

				{row.type === 'pumping' ? (
					<TextInput
						value={pumpMinutes}
						onChangeText={setPumpMinutes}
						keyboardType="number-pad"
						placeholder="Минуты"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
				) : null}

				{row.type === 'solid_food' ? (
					<>
						<TextInput
							value={foodName}
							onChangeText={setFoodName}
							placeholder="Продукт"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<TextInput
							value={amountText}
							onChangeText={setAmountText}
							placeholder="Количество"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						{REACTIONS.map((item) => (
							<ChoiceButton
								key={item}
								label={solidReactionLabel(item)}
								primary={reaction === item}
								onPress={() => setReaction(item)}
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
		marginBottom: spacing.xs,
		marginTop: spacing.sm,
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
		marginTop: spacing.sm,
	},
})
