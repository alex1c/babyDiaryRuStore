/**
 * Pumping — manual entry (side, duration minutes, volume).
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
import type { BreastSide } from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

type PumpSide = BreastSide | 'both'

export default function PumpingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [side, setSide] = useState<PumpSide>('both')
	const [amount, setAmount] = useState<number | null>(90)
	const [customMl, setCustomMl] = useState('')
	const [minutes, setMinutes] = useState('15')
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSave = async (): Promise<void> => {
		if (!feeding || !activeChild || busy) {
			return
		}
		const ml = customMl.trim()
			? Math.round(Number(customMl.trim()))
			: amount
		const mins = Math.round(Number(minutes.trim() || '0'))
		if (ml == null || !Number.isFinite(ml) || ml <= 0) {
			setError('Укажите объём')
			return
		}
		if (!Number.isFinite(mins) || mins < 0) {
			setError('Укажите длительность')
			return
		}
		setBusy(true)
		setError(null)
		try {
			await feeding.createPumping({
				childId: activeChild.id,
				side,
				amountMl: ml,
				durationSeconds: mins * 60,
				notes: notes.trim() || null,
			})
			showToast(`Сцеживание ${ml} мл сохранено`)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('create pumping failed', err)
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
						Сторона
					</Text>
					<ChoiceButton
						label="Обе"
						primary={side === 'both'}
						onPress={() => setSide('both')}
					/>
					<ChoiceButton
						label="Левая"
						primary={side === 'left'}
						onPress={() => setSide('left')}
					/>
					<ChoiceButton
						label="Правая"
						primary={side === 'right'}
						onPress={() => setSide('right')}
					/>

					<Text style={[styles.lead, { color: colors.textSecondary }]}>
						Объём, мл
					</Text>
					<MlChipRow
						values={BOTTLE_QUICK_ML}
						selected={customMl.trim() ? null : amount}
						onSelect={(value) => {
							setAmount(value)
							setCustomMl('')
						}}
					/>
					<TextInput
						value={customMl}
						onChangeText={setCustomMl}
						keyboardType="number-pad"
						placeholder="Другой объём"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							{ color: colors.text, borderColor: colors.border },
						]}
					/>
					<Text style={[styles.lead, { color: colors.textSecondary }]}>
						Длительность, мин
					</Text>
					<TextInput
						value={minutes}
						onChangeText={setMinutes}
						keyboardType="number-pad"
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
	},
	lead: {
		...typography.caption,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginTop: spacing.sm,
		marginBottom: spacing.sm,
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
})
