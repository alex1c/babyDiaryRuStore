/**
 * Manual breastfeeding entry when the timer was not started.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useRouter, type Href } from 'expo-router'
import { useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { FeedingValidationError } from '@/src/domain/feedingLabels'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import {
	combineLocalDateAndTime,
	resolveManualSleepEnd,
} from '@/src/utils/intervalOverlap'
import { radii, spacing, typography } from '@/src/theme/tokens'

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

function dateToHm (date: Date): string {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export default function ManualBreastfeedingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding } = useDatabase()
	const { message, showToast } = useLightweightToast()

	const [localDate, setLocalDate] = useState(toLocalDateOnly())
	const [startHm, setStartHm] = useState('10:00')
	const [endHm, setEndHm] = useState('10:18')
	const [leftMin, setLeftMin] = useState('10')
	const [rightMin, setRightMin] = useState('8')
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
		if (!feeding || !activeChild) {
			setError('Нет активного профиля малыша')
			return
		}
		const left = Math.round(Number(leftMin) || 0) * 60
		const right = Math.round(Number(rightMin) || 0) * 60
		setBusy(true)
		setError(null)
		try {
			const startAt = combineLocalDateAndTime(localDate, startHm)
			const resolved = resolveManualSleepEnd(localDate, startHm, endHm)
			await feeding.createManualBreastfeeding({
				childId: activeChild.id,
				startAt,
				endAt: resolved.endAt,
				leftDurationSeconds: left,
				rightDurationSeconds: right,
				notes: notes.trim() || null,
			})
			// Feeding type enum only — never durations or notes.
			trackAnalyticsEvent(ANALYTICS_EVENTS.feedingAdded, {
				feeding_type: 'manual',
			})
			showToast('Кормление сохранено')
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('manual breastfeeding failed', err)
			setError(
				err instanceof FeedingValidationError
					? err.message
					: 'Не удалось сохранить',
			)
		} finally {
			setBusy(false)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
				>
					<FieldButton
						label="Дата"
						value={localDate}
						onPress={() => setPicker('date')}
					/>
					<FieldButton
						label="Начало"
						value={startHm}
						onPress={() => setPicker('start')}
					/>
					<FieldButton
						label="Окончание"
						value={endHm}
						onPress={() => setPicker('end')}
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
				</ScrollView>
			</KeyboardAvoidingView>

			{picker ? (
				<DateTimePicker
					value={new Date()}
					mode={picker === 'date' ? 'date' : 'time'}
					is24Hour
					onChange={onPickerChange}
				/>
			) : null}
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

function FieldButton ({
	label,
	value,
	onPress,
}: {
	label: string
	value: string
	onPress: () => void
}) {
	const { colors } = useAppTheme()
	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.field,
				{ borderColor: colors.border, backgroundColor: colors.surface },
			]}
		>
			<Text style={{ color: colors.textMuted }}>{label}</Text>
			<Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	flex: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xxl },
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
	field: {
		minHeight: 56,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
})
