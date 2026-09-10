/**
 * Quick bottle feeding — expressed milk / formula + ml chips.
 */

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
import { useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton, MlChipRow } from '@/src/components/FeedingControls'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	BOTTLE_QUICK_ML,
	FeedingValidationError,
} from '@/src/domain/feedingLabels'
import type { BottleContent } from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function BottleFeedingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding, reminderService } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [content, setContent] = useState<BottleContent | null>(null)
	const [amount, setAmount] = useState<number | null>(120)
	const [custom, setCustom] = useState('')
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const resolvedAmount = (): number | null => {
		if (custom.trim()) {
			const n = Number(custom.trim())
			return Number.isFinite(n) ? Math.round(n) : null
		}
		return amount
	}

	const handleSave = async (): Promise<void> => {
		if (!feeding || !activeChild || !content || busy) {
			return
		}
		const ml = resolvedAmount()
		if (ml == null) {
			setError('Укажите объём')
			return
		}
		setBusy(true)
		setError(null)
		try {
			await feeding.createBottle({
				childId: activeChild.id,
				content,
				amountMl: ml,
				notes: notes.trim() || null,
			})
			if (reminderService) {
				await reminderService.rescheduleNoFeedingForChild(activeChild.id)
			}
			showToast(
				`${content === 'formula' ? 'Смесь' : 'Сцеженное молоко'} ${ml} мл сохранено`,
			)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('create bottle failed', err)
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
					{content == null ? (
						<>
							<Text style={[styles.lead, { color: colors.textSecondary }]}>
								Содержимое
							</Text>
							<ChoiceButton
								label="Сцеженное молоко"
								onPress={() => setContent('expressed_milk')}
							/>
							<ChoiceButton
								label="Смесь"
								onPress={() => setContent('formula')}
							/>
						</>
					) : (
						<>
							<Text style={[styles.lead, { color: colors.textSecondary }]}>
								Объём, мл
							</Text>
							<MlChipRow
								values={BOTTLE_QUICK_ML}
								selected={custom.trim() ? null : amount}
								onSelect={(value) => {
									setAmount(value)
									setCustom('')
								}}
							/>
							<TextInput
								value={custom}
								onChangeText={setCustom}
								keyboardType="number-pad"
								placeholder="Другой объём"
								placeholderTextColor={colors.textMuted}
								style={[
									styles.input,
									{ color: colors.text, borderColor: colors.border },
								]}
							/>
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
							<Pressable
								onPress={() => setContent(null)}
								style={styles.link}
							>
								<Text style={{ color: colors.textMuted }}>Назад</Text>
							</Pressable>
						</>
					)}
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
	link: {
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
