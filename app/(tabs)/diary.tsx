/**
 * Diary timeline — sleep, feeding, diaper, and other everyday events.
 */

import { useCallback, useState } from 'react'
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

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	activityToTimeline,
	customToTimeline,
	diaperToTimeline,
	feedingToTimeline,
	medicineToTimeline,
	noteToTimeline,
	sleepToTimeline,
	temperatureToTimeline,
	type DiaryFilter,
	type TimelineRow,
} from '@/src/presentation/diaryTimeline'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

const FILTERS: { id: DiaryFilter; label: string }[] = [
	{ id: 'all', label: 'Все' },
	{ id: 'sleep', label: 'Сон' },
	{ id: 'feeding', label: 'Кормление' },
	{ id: 'diaper', label: 'Подгузники' },
	{ id: 'other', label: 'Другое' },
]

export default function DiaryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild, loading: childLoading } = useActiveChild()
	const { sleep, feeding, diaper, quickEvents } = useDatabase()
	const [rows, setRows] = useState<TimelineRow[]>([])
	const [filter, setFilter] = useState<DiaryFilter>('all')
	const [loading, setLoading] = useState(true)
	const [nowMs] = useState(() => Date.now())

	const refresh = useCallback(async () => {
		if (!sleep || !feeding || !diaper || !quickEvents || !activeChild) {
			setRows([])
			setLoading(false)
			return
		}
		try {
			// Sequential SQLite — never Promise.all on one NativeDatabase.
			const sleeps = await sleep.listByChild(activeChild.id, 100)
			const feedings = await feeding.listByChild(activeChild.id, 100)
			const diapers = await diaper.listByChild(activeChild.id, 100)
			const activities = await quickEvents.listActivitiesByChild(
				activeChild.id,
				100,
			)
			const temps = await quickEvents.listTemperaturesByChild(
				activeChild.id,
				50,
			)
			const medicines = await quickEvents.listMedicinesByChild(
				activeChild.id,
				50,
			)
			const notes = await quickEvents.listNotesByChild(activeChild.id, 50)
			const customs = await quickEvents.listCustomEventsByChild(
				activeChild.id,
				50,
			)

			const merged: TimelineRow[] = [
				...sleeps.map((e) => sleepToTimeline(e, nowMs)),
				...feedings.map((e) => feedingToTimeline(e, nowMs)),
				...diapers.map((e) => diaperToTimeline(e)),
				...activities.map((e) => activityToTimeline(e)),
				...temps.map((e) => temperatureToTimeline(e)),
				...medicines.map((e) => medicineToTimeline(e)),
				...notes.map((e) => noteToTimeline(e)),
				...customs.map((e) => customToTimeline(e)),
			]
			merged.sort((a, b) => b.startAt.localeCompare(a.startAt))
			setRows(merged)
		} catch (error) {
			logger.error('Failed to load diary', error)
		} finally {
			setLoading(false)
		}
	}, [sleep, feeding, diaper, quickEvents, activeChild, nowMs])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	const visible = rows.filter((row) => {
		if (filter === 'all') {
			return true
		}
		return row.filterGroup === filter
	})

	if (childLoading || loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<FlatList
				data={visible}
				keyExtractor={(item) => `${item.kind}-${item.id}`}
				contentContainerStyle={styles.content}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							Все события дня. Нажмите запись, чтобы исправить.
						</Text>
						<View style={styles.filters}>
							{FILTERS.map((item) => {
								const on = filter === item.id
								return (
									<Pressable
										key={item.id}
										onPress={() => setFilter(item.id)}
										style={[
											styles.filterChip,
											{
												backgroundColor: on
													? colors.primary
													: colors.primarySoft,
												borderColor: colors.border,
											},
										]}
										accessibilityRole="button"
										accessibilityState={{ selected: on }}
										accessibilityLabel={item.label}
									>
										<Text
											style={{
												color: on ? '#FFFFFF' : colors.primary,
												fontWeight: '700',
												fontSize: 13,
											}}
										>
											{item.label}
										</Text>
									</Pressable>
								)
							})}
						</View>
						<View style={styles.addRow}>
							<Pressable
								onPress={() => router.push('/sleep/manual' as Href)}
								style={[
									styles.addBtn,
									{
										backgroundColor: colors.primarySoft,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Сон
								</Text>
							</Pressable>
							<Pressable
								onPress={() => router.push('/feeding' as Href)}
								style={[
									styles.addBtn,
									{
										backgroundColor: colors.primarySoft,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Кормление
								</Text>
							</Pressable>
							<Pressable
								onPress={() => router.push('/diaper' as Href)}
								style={[
									styles.addBtn,
									{
										backgroundColor: colors.primarySoft,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Подгузник
								</Text>
							</Pressable>
						</View>
					</View>
				}
				ListEmptyComponent={
					<Text style={[styles.empty, { color: colors.textMuted }]}>
						Здесь появятся записи дневника
					</Text>
				}
				renderItem={({ item }) => (
					<Pressable
						onPress={() => router.push(item.href as Href)}
						style={[
							styles.row,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel={item.label}
					>
						<Text style={[styles.rowText, { color: colors.text }]}>
							{item.label}
						</Text>
						{item.isActive ? (
							<Text style={{ color: colors.primary, marginTop: 4 }}>
								Активный
							</Text>
						) : null}
					</Pressable>
				)}
				ListFooterComponent={<BannerAdSlot />}
			/>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xl },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	header: { marginBottom: spacing.md },
	lead: { ...typography.body, marginBottom: spacing.sm },
	filters: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	filterChip: {
		minHeight: 36,
		paddingHorizontal: spacing.sm,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addRow: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	addBtn: {
		flex: 1,
		minHeight: 44,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	empty: {
		...typography.body,
		textAlign: 'center',
		marginTop: spacing.lg,
	},
	row: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		minHeight: 56,
		justifyContent: 'center',
	},
	rowText: {
		...typography.body,
		flexShrink: 1,
	},
})
