/**
 * Solid food entry with recent-product chips and reaction.
 */

import { useCallback, useState } from 'react'
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
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	FeedingValidationError,
	solidReactionLabel,
} from '@/src/domain/feedingLabels'
import type { SolidReaction } from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

const REACTIONS: SolidReaction[] = [
	'liked',
	'neutral',
	'disliked',
	'possible_reaction',
]

export default function SolidFoodScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [foodName, setFoodName] = useState('')
	const [amountText, setAmountText] = useState('')
	const [reaction, setReaction] = useState<SolidReaction | null>(null)
	const [notes, setNotes] = useState('')
	const [recent, setRecent] = useState<string[]>([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				if (!feeding || !activeChild) {
					return
				}
				try {
					const items = await feeding.listRecentFoods(activeChild.id)
					setRecent(items)
				} catch (err) {
					logger.error('list recent foods failed', err)
				}
			})()
		}, [feeding, activeChild]),
	)

	const handleSave = async (): Promise<void> => {
		if (!feeding || !activeChild || busy) {
			return
		}
		if (!foodName.trim()) {
			setError('Укажите продукт')
			return
		}
		setBusy(true)
		setError(null)
		try {
			await feeding.createSolid({
				childId: activeChild.id,
				foodName: foodName.trim(),
				amountText: amountText.trim() || null,
				reaction,
				notes: notes.trim() || null,
			})
			// Feeding type enum only — never food name, amount, or notes.
			trackAnalyticsEvent(ANALYTICS_EVENTS.feedingAdded, {
				feeding_type: 'solid',
			})
			showToast(`Прикорм · ${foodName.trim()} сохранён`)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('create solid failed', err)
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
					<Text style={[styles.lead, { color: colors.textSecondary }]}>
						Продукт
					</Text>
					{recent.length > 0 ? (
						<View style={styles.chips}>
							{recent.map((name) => (
								<Pressable
									key={name}
									onPress={() => setFoodName(name)}
									style={[
										styles.chip,
										{
											backgroundColor:
												foodName === name
													? colors.primary
													: colors.primarySoft,
											borderColor: colors.border,
										},
									]}
								>
									<Text
										style={{
											color:
												foodName === name
													? '#FFFFFF'
													: colors.primary,
											fontWeight: '600',
										}}
									>
										{name}
									</Text>
								</Pressable>
							))}
						</View>
					) : null}
					<TextInput
						value={foodName}
						onChangeText={setFoodName}
						placeholder="Например, кабачок"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
					<TextInput
						value={amountText}
						onChangeText={setAmountText}
						placeholder="Количество (текст)"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
					<Text style={[styles.lead, { color: colors.textSecondary }]}>
						Реакция
					</Text>
					{REACTIONS.map((item) => (
						<ChoiceButton
							key={item}
							label={solidReactionLabel(item)}
							primary={reaction === item}
							onPress={() =>
								setReaction((prev) => (prev === item ? null : item))
							}
						/>
					))}
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
	},
	lead: {
		...typography.caption,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: spacing.sm,
		marginTop: spacing.sm,
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
		alignItems: 'center',
		justifyContent: 'center',
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
})
