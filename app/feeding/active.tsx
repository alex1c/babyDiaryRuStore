/**
 * Active breastfeeding session — recover from SQLite after app restart.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ActiveBreastfeedingCard } from '@/src/components/ActiveBreastfeedingCard'
import { FormKeyboardShell } from '@/src/components/FormKeyboardShell'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { breastfeedingLiveTotals } from '@/src/domain/breastfeedingDuration'
import { FeedingValidationError } from '@/src/domain/feedingLabels'
import type { BreastfeedingEvent, BreastSide } from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatDurationMs } from '@/src/utils/durationFormat'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ActiveBreastfeedingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding, reminderService } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [event, setEvent] = useState<BreastfeedingEvent | null>(null)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [noteOpen, setNoteOpen] = useState(false)
	const [noteDraft, setNoteDraft] = useState('')

	const refresh = useCallback(async () => {
		if (!feeding || !activeChild) {
			setEvent(null)
			setLoading(false)
			return
		}
		try {
			const active = await feeding.findActiveBreastfeeding(activeChild.id)
			setEvent(active)
			if (!active) {
				router.replace('/feeding' as Href)
			}
		} catch (err) {
			logger.error('load active breastfeeding failed', err)
		} finally {
			setLoading(false)
		}
	}, [feeding, activeChild, router])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	const handleSwitch = async (side: BreastSide): Promise<void> => {
		if (!feeding || !event || busy) {
			return
		}
		setBusy(true)
		try {
			const updated = await feeding.switchBreastSide(event.id, side)
			setEvent(updated)
		} catch (err) {
			logger.error('switch breast side failed', err)
			showToast(
				err instanceof FeedingValidationError
					? err.message
					: 'Не удалось переключить сторону',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleFinish = async (): Promise<void> => {
		if (!feeding || !event || busy) {
			return
		}
		setBusy(true)
		try {
			const finished = await feeding.finishBreastfeeding(event.id)
			const totals = breastfeedingLiveTotals(finished, Date.now())
			showToast(
				`Кормление ${formatDurationMs(totals.totalSeconds * 1000)} сохранено`,
			)
			if (reminderService && activeChild) {
				await reminderService.rescheduleNoFeedingForChild(activeChild.id)
			}
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('finish breastfeeding failed', err)
			showToast(
				err instanceof FeedingValidationError
					? err.message
					: 'Не удалось завершить кормление',
			)
			await refresh()
		} finally {
			setBusy(false)
		}
	}

	const handleSaveNote = async (): Promise<void> => {
		if (!feeding || !event) {
			return
		}
		setBusy(true)
		try {
			const updated = await feeding.updateBreastfeeding(event.id, {
				notes: noteDraft.trim() || null,
			})
			setEvent(updated)
			setNoteOpen(false)
			showToast('Заметка сохранена')
		} catch (err) {
			logger.error('save breastfeeding note failed', err)
			Alert.alert('Ошибка', 'Не удалось сохранить заметку')
		} finally {
			setBusy(false)
		}
	}

	if (loading || !event) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<View style={styles.content}>
				<ActiveBreastfeedingCard
					event={event}
					busy={busy}
					onSwitchSide={(side) => void handleSwitch(side)}
					onFinish={() => void handleFinish()}
					onAddNote={() => {
						setNoteDraft(event.notes ?? '')
						setNoteOpen(true)
					}}
				/>
				<Pressable
					onPress={() => router.push(`/feeding/${event.id}` as Href)}
					style={styles.link}
					accessibilityRole="button"
					accessibilityLabel="Изменить кормление"
				>
					<Text style={{ color: colors.primary }}>Изменить</Text>
				</Pressable>
			</View>

			<Modal
				visible={noteOpen}
				transparent
				animationType="slide"
				onRequestClose={() => setNoteOpen(false)}
			>
				{/* Avoid covering the note field / Save when the keyboard opens. */}
				<FormKeyboardShell style={styles.modalBackdrop}>
					<View
						style={[
							styles.modalCard,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Text style={[styles.modalTitle, { color: colors.text }]}>
							Заметка
						</Text>
						<TextInput
							value={noteDraft}
							onChangeText={setNoteDraft}
							placeholder="Необязательно"
							placeholderTextColor={colors.textMuted}
							multiline
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<Pressable
							onPress={() => void handleSaveNote()}
							style={[styles.save, { backgroundColor: colors.primary }]}
						>
							<Text style={[styles.saveText, { color: colors.onPrimary }]}>
								Сохранить
							</Text>
						</Pressable>
						<Pressable onPress={() => setNoteOpen(false)} style={styles.link}>
							<Text style={{ color: colors.textMuted }}>Отмена</Text>
						</Pressable>
					</View>
				</FormKeyboardShell>
			</Modal>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		flex: 1,
		justifyContent: 'flex-end',
		padding: spacing.md,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	link: {
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalBackdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	modalCard: {
		borderTopLeftRadius: radii.lg,
		borderTopRightRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	modalTitle: {
		...typography.subtitle,
		marginBottom: spacing.sm,
	},
	input: {
		minHeight: 88,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		marginBottom: spacing.md,
		textAlignVertical: 'top',
	},
	save: {
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	saveText: {
		...typography.button,
	},
})
