/**
 * Reminders list — user-managed local notifications.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	reminderScheduleLabel,
	reminderTypeLabel,
} from '@/src/domain/reminderLabels'
import type { Reminder } from '@/src/models/reminder'
import {
	ReminderValidationError,
} from '@/src/services/reminderService'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function RemindersListScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { reminders, reminderService } = useDatabase()
	const [items, setItems] = useState<Reminder[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (!reminders || !activeChild) {
			setItems([])
			setLoading(false)
			return
		}
		setLoading(true)
		try {
			setItems(await reminders.listByChild(activeChild.id))
			setError(null)
		} catch (err) {
			logger.error('reminders list failed', err)
			setError('Не удалось загрузить напоминания')
		} finally {
			setLoading(false)
		}
	}, [reminders, activeChild])

	useFocusEffect(
		useCallback(() => {
			void refresh()
		}, [refresh]),
	)

	const toggle = async (item: Reminder): Promise<void> => {
		if (!reminderService) {
			return
		}
		try {
			await reminderService.setEnabled(item.id, !item.enabled)
			await refresh()
		} catch (err) {
			const text =
				err instanceof ReminderValidationError
					? err.message
					: 'Не удалось изменить напоминание'
			setError(text)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Все напоминания выключены, пока вы сами их не создадите. Без
					медицинских назначений — только то, что настроили вы.
				</Text>

				<Pressable
					onPress={() => router.push('/reminders/edit' as Href)}
					style={[styles.cta, { backgroundColor: colors.primary }]}
				>
					<Text style={styles.ctaText}>Добавить напоминание</Text>
				</Pressable>

				{loading ? <ActivityIndicator color={colors.primary} /> : null}
				{error ? (
					<Text style={{ color: colors.danger, ...typography.body }}>{error}</Text>
				) : null}

				{!loading && items.length === 0 ? (
					<Text style={{ color: colors.textMuted, ...typography.body }}>
						Напоминания создаёте только вы — нажмите кнопку выше
					</Text>
				) : null}

				{items.map((item) => (
					<View
						key={item.id}
						style={[
							styles.row,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Pressable
							style={styles.rowMain}
							onPress={() =>
								router.push(`/reminders/edit?id=${item.id}` as Href)
							}
						>
							<Text style={{ color: colors.text, ...typography.subtitle }}>
								{item.title}
							</Text>
							<Text style={{ color: colors.textMuted, ...typography.caption }}>
								{reminderTypeLabel(item.type)} · {reminderScheduleLabel(item)}
							</Text>
						</Pressable>
						<Switch
							value={item.enabled}
							onValueChange={() => void toggle(item)}
							trackColor={{ true: colors.primaryMuted, false: colors.border }}
						/>
					</View>
				))}
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
	lead: { ...typography.body },
	cta: {
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
	},
	ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
	row: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	rowMain: { flex: 1, gap: 2 },
})
