/**
 * Temperature quick add / edit / history entry.
 */

import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
	Alert,
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	temperatureMethodLabel,
} from '@/src/domain/healthLabels'
import {
	formatTemperatureCelsius,
	QuickEventValidationError,
} from '@/src/domain/quickEventLabels'
import { TEMPERATURE_METHODS, type TemperatureMethod } from '@/src/models/health'
import type { TemperatureEvent } from '@/src/models/quickEvents'
import { formatLocalTime } from '@/src/utils/datetime'
import { formatRuLongDate } from '@/src/presentation/growthFormat'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { LightweightToast, useLightweightToast } from '@/src/components/LightweightToast'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthTemperatureScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null
	const { message, showToast } = useLightweightToast()

	const [celsius, setCelsius] = useState('36,6')
	const [method, setMethod] = useState<TemperatureMethod>('unset')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [history, setHistory] = useState<TemperatureEvent[]>([])

	useEffect(() => {
		void (async () => {
			if (!editId || !quickEvents) {
				return
			}
			const row = await quickEvents.getTemperatureById(editId)
			if (!row) {
				return
			}
			setCelsius(row.celsius.toFixed(1).replace('.', ','))
			setMethod(row.method)
			setNotes(row.notes ?? '')
		})()
	}, [editId, quickEvents])

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				if (!quickEvents || !activeChild || editId) {
					return
				}
				setHistory(await quickEvents.listTemperaturesByChild(activeChild.id, 40))
			})()
		}, [quickEvents, activeChild, editId]),
	)

	const handleSave = async (): Promise<void> => {
		if (!quickEvents || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			if (editId) {
				await quickEvents.updateTemperature(editId, {
					celsiusRaw: celsius,
					method,
					notes,
				})
			} else {
				await quickEvents.createTemperature({
					childId: activeChild.id,
					celsiusRaw: celsius,
					method,
					notes,
				})
			}
			showToast('Запись сохранена')
			if (editId) {
				router.back()
			} else {
				setCelsius('36,6')
				setNotes('')
				setHistory(
					await quickEvents.listTemperaturesByChild(activeChild.id, 40),
				)
			}
		} catch (err) {
			if (err instanceof QuickEventValidationError) {
				setError(err.message)
			} else {
				logger.error('temp save failed', err)
				setError('Не удалось сохранить')
			}
		} finally {
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !quickEvents) {
			return
		}
		Alert.alert('Удалить запись?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await quickEvents.deleteEvent(editId)
						router.back()
					})()
				},
			},
		])
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Температура, °C
				</Text>
				<TextInput
					value={celsius}
					onChangeText={setCelsius}
					keyboardType="decimal-pad"
					style={[
						styles.input,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Способ (необязательно)
				</Text>
				<View style={styles.chips}>
					{TEMPERATURE_METHODS.map((m) => (
						<Pressable
							key={m}
							onPress={() => setMethod(m)}
							style={[
								styles.chip,
								{
									backgroundColor:
										method === m ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{temperatureMethodLabel(m)}
							</Text>
						</Pressable>
					))}
				</View>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Заметка
				</Text>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					style={[
						styles.input,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				{error ? (
					<Text style={{ color: colors.danger }}>{error}</Text>
				) : null}
				<Pressable
					onPress={() => void handleSave()}
					disabled={busy}
					style={[styles.save, { backgroundColor: colors.primary }]}
				>
					<Text style={{ color: colors.surface, fontWeight: '600' }}>
						Сохранить
					</Text>
				</Pressable>
				{editId ? (
					<Pressable onPress={handleDelete} style={styles.delete}>
						<Text style={{ color: colors.danger }}>Удалить</Text>
					</Pressable>
				) : null}
				{!editId ? (
					<>
						<Text style={[styles.histTitle, { color: colors.text }]}>
							История
						</Text>
						<FlatList
							data={history}
							keyExtractor={(item) => item.id}
							scrollEnabled={false}
							renderItem={({ item }) => (
								<Pressable
									onPress={() =>
										router.push(
											`/health/temperature?id=${item.id}` as never,
										)
									}
									style={[styles.histRow, { borderColor: colors.border }]}
								>
									<Text style={{ color: colors.text }}>
										{formatLocalTime(item.startAt)} ·{' '}
										{formatTemperatureCelsius(item.celsius)}
									</Text>
									<Text
										style={{
											color: colors.textMuted,
											...typography.caption,
										}}
									>
										{formatRuLongDate(item.startLocalDate)}
									</Text>
								</Pressable>
							)}
						/>
					</>
				) : null}
			</ScrollView>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm },
	label: { ...typography.caption },
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		...typography.body,
	},
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	save: {
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	delete: { alignItems: 'center', padding: spacing.md },
	histTitle: { ...typography.subtitle, marginTop: spacing.md },
	histRow: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingVertical: spacing.sm,
		gap: 2,
	},
})
