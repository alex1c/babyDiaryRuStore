/**
 * Unified health history with simple filters.
 */

import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DiaryTimelineRowView } from '@/src/components/DiaryTimelineRow'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	doctorVisitToTimeline,
	healthMedicineRow,
	healthTemperatureRow,
	matchesHealthHistoryFilter,
	symptomToTimeline,
	type HealthHistoryFilter,
} from '@/src/presentation/healthTimeline'
import type { TimelineRow } from '@/src/presentation/diaryTimeline'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

const FILTERS: { id: HealthHistoryFilter; label: string }[] = [
	{ id: 'all', label: 'Все' },
	{ id: 'temperature', label: 'Температура' },
	{ id: 'symptom', label: 'Симптомы' },
	{ id: 'medicine', label: 'Лекарства' },
	{ id: 'doctor', label: 'Врачи' },
]

export default function HealthHistoryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents, symptoms, doctorVisits } = useDatabase()
	const [rows, setRows] = useState<TimelineRow[]>([])
	const [filter, setFilter] = useState<HealthHistoryFilter>('all')
	const [loading, setLoading] = useState(true)

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				if (!activeChild || !quickEvents || !symptoms || !doctorVisits) {
					setLoading(false)
					return
				}
				try {
					const temps = await quickEvents.listTemperaturesByChild(
						activeChild.id,
						80,
					)
					const meds = await quickEvents.listMedicinesByChild(
						activeChild.id,
						80,
					)
					const syms = await symptoms.listByChild(activeChild.id, 80)
					const visits = await doctorVisits.listByChild(
						activeChild.id,
						80,
					)
					const next: TimelineRow[] = [
						...temps.map(healthTemperatureRow),
						...meds.map(healthMedicineRow),
						...syms.map(symptomToTimeline),
						...visits.map(doctorVisitToTimeline),
					]
					next.sort((a, b) => b.startAt.localeCompare(a.startAt))
					setRows(next)
				} catch (err) {
					logger.error('health history failed', err)
				} finally {
					setLoading(false)
				}
			})()
		}, [activeChild, quickEvents, symptoms, doctorVisits]),
	)

	const visible = useMemo(
		() => rows.filter((r) => matchesHealthHistoryFilter(r, filter)),
		[rows, filter],
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<View style={styles.filters}>
				{FILTERS.map((f) => (
					<Pressable
						key={f.id}
						onPress={() => setFilter(f.id)}
						style={[
							styles.chip,
							{
								backgroundColor:
									filter === f.id
										? colors.primarySoft
										: colors.surface,
								borderColor: colors.border,
							},
						]}
					>
						<Text style={{ color: colors.text }}>{f.label}</Text>
					</Pressable>
				))}
			</View>
			{loading ? (
				<ActivityIndicator color={colors.primary} style={styles.loader} />
			) : (
				<FlatList
					data={visible}
					keyExtractor={(item) => `${item.kind}-${item.id}`}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						<Text style={{ color: colors.textMuted, ...typography.body }}>
							Пока нет записей
						</Text>
					}
					renderItem={({ item }) => (
						<DiaryTimelineRowView
							item={item}
							onPress={() => router.push(item.href as Href)}
						/>
					)}
				/>
			)}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	filters: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		padding: spacing.md,
	},
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	loader: { marginTop: spacing.xl },
	list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
})
