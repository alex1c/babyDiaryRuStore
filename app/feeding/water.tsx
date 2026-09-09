/**
 * Water intake — separate from milk/formula aggregation.
 */

import { useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
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
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function WaterFeedingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [amount, setAmount] = useState<number | null>(40)
	const [custom, setCustom] = useState('')
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSave = async (): Promise<void> => {
		if (!feeding || !activeChild || busy) {
			return
		}
		const ml = custom.trim()
			? Math.round(Number(custom.trim()))
			: amount
		if (ml == null || !Number.isFinite(ml)) {
			setError('Укажите объём')
			return
		}
		setBusy(true)
		setError(null)
		try {
			await feeding.createWater({
				childId: activeChild.id,
				amountMl: ml,
				notes: notes.trim() || null,
			})
			showToast(`Вода ${ml} мл сохранена`)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('create water failed', err)
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
						Вода, мл
					</Text>
					<MlChipRow
						values={[30, 40, 50, 60, 80, 100, ...BOTTLE_QUICK_ML.slice(0, 3)]}
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
})
