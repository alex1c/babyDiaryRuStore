/**
 * Create everyday / health / note / custom event (shared form).
 * Query: ?kind=walk|bath|...|temperature|medicine|vitamin|note|custom&definitionId=
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	activityTypeLabel,
	QuickEventValidationError,
} from '@/src/domain/quickEventLabels'
import type { ActivityEventType } from '@/src/models/quickEvents'
import { isActivityEventType } from '@/src/models/quickEvents'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function CreateQuickEventScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const params = useLocalSearchParams<{
		kind?: string
		definitionId?: string
	}>()
	const kind = String(params.kind ?? 'walk')
	const definitionId = params.definitionId
		? String(params.definitionId)
		: null

	const [celsius, setCelsius] = useState('36,6')
	const [name, setName] = useState('')
	const [dose, setDose] = useState('')
	const [unit, setUnit] = useState('')
	const [minutes, setMinutes] = useState('')
	const [notes, setNotes] = useState('')
	const [title, setTitle] = useState('')
	const [recent, setRecent] = useState<string[]>([])
	const [defName, setDefName] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!quickEvents || !activeChild) {
				return
			}
			if (kind === 'vitamin' || kind === 'medicine') {
				const names = await quickEvents.listRecentMedicineNames(
					activeChild.id,
					kind === 'vitamin' ? 'vitamin' : 'medicine',
				)
				setRecent(names)
			}
			if (kind === 'custom' && definitionId) {
				const def = await quickEvents.getCustomDefinitionById(definitionId)
				setDefName(def?.name ?? 'Своё событие')
			}
		})()
	}, [quickEvents, activeChild, kind, definitionId])

	const heading = (): string => {
		if (isActivityEventType(kind)) {
			return activityTypeLabel(kind)
		}
		switch (kind) {
			case 'temperature':
				return 'Температура'
			case 'vitamin':
				return 'Витамин'
			case 'medicine':
				return 'Лекарство'
			case 'note':
				return 'Заметка'
			case 'custom':
				return defName || 'Своё событие'
			default:
				return 'Событие'
		}
	}

	const headingText = heading()

	const handleSave = useCallback(async (): Promise<void> => {
		if (!quickEvents || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const durationSeconds = minutes.trim()
				? Math.round(Number(minutes.trim())) * 60
				: null

			if (isActivityEventType(kind)) {
				await quickEvents.createActivity({
					childId: activeChild.id,
					type: kind as ActivityEventType,
					durationSeconds:
						durationSeconds != null && Number.isFinite(durationSeconds)
							? durationSeconds
							: null,
					notes: notes.trim() || null,
				})
			} else if (kind === 'temperature') {
				await quickEvents.createTemperature({
					childId: activeChild.id,
					celsiusRaw: celsius,
					notes: notes.trim() || null,
				})
			} else if (kind === 'vitamin' || kind === 'medicine') {
				await quickEvents.createMedicine({
					childId: activeChild.id,
					kind,
					name,
					doseText: dose.trim() || null,
					unit: unit.trim() || null,
					notes: notes.trim() || null,
				})
			} else if (kind === 'note') {
				await quickEvents.createNote({
					childId: activeChild.id,
					title: title.trim() || null,
					notes: notes.trim() || null,
				})
			} else if (kind === 'custom' && definitionId) {
				await quickEvents.createCustomEvent({
					childId: activeChild.id,
					definitionId,
					durationSeconds:
						durationSeconds != null && Number.isFinite(durationSeconds)
							? durationSeconds
							: null,
					notes: notes.trim() || null,
				})
			} else {
				throw new QuickEventValidationError('Неизвестный тип')
			}

			showToast(`${headingText} сохранено`)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('create quick event failed', err)
			setError(
				err instanceof QuickEventValidationError
					? err.message
					: 'Не удалось сохранить',
			)
			setBusy(false)
		}
	}, [
		quickEvents,
		activeChild,
		busy,
		kind,
		minutes,
		notes,
		celsius,
		name,
		dose,
		unit,
		title,
		definitionId,
		router,
		showToast,
		headingText,
	])

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
					<Text style={[styles.lead, { color: colors.textSecondary }]}>
						{heading()}
					</Text>

					{kind === 'temperature' ? (
						<TextInput
							value={celsius}
							onChangeText={setCelsius}
							keyboardType="decimal-pad"
							placeholder="36,7"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					) : null}

					{kind === 'vitamin' || kind === 'medicine' ? (
						<>
							{recent.length > 0 ? (
								<View style={styles.chips}>
									{recent.map((item) => (
										<Pressable
											key={item}
											onPress={() => setName(item)}
											style={[
												styles.chip,
												{
													backgroundColor:
														name === item
															? colors.primary
															: colors.primarySoft,
													borderColor: colors.border,
												},
											]}
										>
											<Text
												style={{
													color:
														name === item
															? '#FFFFFF'
															: colors.primary,
													fontWeight: '600',
												}}
											>
												{item}
											</Text>
										</Pressable>
									))}
								</View>
							) : null}
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
								placeholder="Количество (необязательно)"
								placeholderTextColor={colors.textMuted}
								style={[
									styles.input,
									{ color: colors.text, borderColor: colors.border },
								]}
							/>
							<TextInput
								value={unit}
								onChangeText={setUnit}
								placeholder="Единица (необязательно)"
								placeholderTextColor={colors.textMuted}
								style={[
									styles.input,
									{ color: colors.text, borderColor: colors.border },
								]}
							/>
						</>
					) : null}

					{kind === 'note' ? (
						<>
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
							<TextInput
								value={notes}
								onChangeText={setNotes}
								placeholder="Текст заметки"
								placeholderTextColor={colors.textMuted}
								multiline
								style={[
									styles.input,
									styles.multiline,
									{ color: colors.text, borderColor: colors.border },
								]}
							/>
						</>
					) : null}

					{isActivityEventType(kind) || kind === 'custom' ? (
						<TextInput
							value={minutes}
							onChangeText={setMinutes}
							keyboardType="number-pad"
							placeholder="Длительность, мин (необязательно)"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					) : null}

					{kind !== 'note' ? (
						<TextInput
							value={notes}
							onChangeText={setNotes}
							placeholder="Заметка (необязательно)"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
					) : null}

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
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	flex: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
		justifyContent: 'flex-end',
		flexGrow: 1,
	},
	lead: {
		...typography.subtitle,
		marginBottom: spacing.md,
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	multiline: {
		minHeight: 96,
		textAlignVertical: 'top',
		paddingVertical: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	chip: {
		minHeight: 40,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
})
