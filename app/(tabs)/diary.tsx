/**
 * Diary timeline — sleep + feedings with All | Sleep | Feeding filter.
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
import { sleepTypeLabel } from '@/src/domain/sleepType'
import type { FeedingEvent } from '@/src/models/feeding'
import type { SleepEvent } from '@/src/models/sleep'
import { formatFeedingDetail } from '@/src/presentation/feedingFormat'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import {
	durationBetweenMs,
	formatDurationMs,
} from '@/src/utils/durationFormat'
import { formatLocalTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

type DiaryFilter = 'all' | 'sleep' | 'feeding'

type DiaryRow =
	| { kind: 'sleep'; event: SleepEvent }
	| { kind: 'feeding'; event: FeedingEvent }

function formatSleepRow (sleep: SleepEvent, nowMs: number): string {
	const start = formatLocalTime(sleep.startAt)
	const end =
		sleep.endAt == null ? 'сейчас' : formatLocalTime(sleep.endAt)
	const dur = formatDurationMs(
		durationBetweenMs(sleep.startAt, sleep.endAt, nowMs),
	)
	const kind = sleepTypeLabel(sleep.sleepType)
	return `${start}–${end}  Сон · ${dur} · ${kind}`
}

function formatFeedingRow (event: FeedingEvent, nowMs: number): string {
	return `${formatLocalTime(event.startAt)} ${formatFeedingDetail(event, nowMs)}`
}

const FILTERS: { id: DiaryFilter; label: string }[] = [
	{ id: 'all', label: 'Все' },
	{ id: 'sleep', label: 'Сон' },
	{ id: 'feeding', label: 'Кормление' },
]

export default function DiaryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild, loading: childLoading } = useActiveChild()
	const { sleep, feeding } = useDatabase()
	const [rows, setRows] = useState<DiaryRow[]>([])
	const [filter, setFilter] = useState<DiaryFilter>('all')
	const [loading, setLoading] = useState(true)
	const [nowMs] = useState(() => Date.now())

	const refresh = useCallback(async () => {
		if (!sleep || !feeding || !activeChild) {
			setRows([])
			setLoading(false)
			return
		}
		try {
			// Sequential SQLite — never Promise.all on one NativeDatabase.
			const sleeps = await sleep.listByChild(activeChild.id, 100)
			const feedings = await feeding.listByChild(activeChild.id, 100)
			const merged: DiaryRow[] = [
				...sleeps.map((event) => ({ kind: 'sleep' as const, event })),
				...feedings.map((event) => ({
					kind: 'feeding' as const,
					event,
				})),
			]
			merged.sort((a, b) =>
				b.event.startAt.localeCompare(a.event.startAt),
			)
			setRows(merged)
		} catch (error) {
			logger.error('Failed to load diary', error)
		} finally {
			setLoading(false)
		}
	}, [sleep, feeding, activeChild])

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
		return row.kind === filter
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
				keyExtractor={(item) => `${item.kind}-${item.event.id}`}
				contentContainerStyle={styles.content}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							Сон и кормления. Нажмите запись, чтобы исправить.
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
								accessibilityRole="button"
								accessibilityLabel="Добавить сон"
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
								accessibilityRole="button"
								accessibilityLabel="Добавить кормление"
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Кормление
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
				renderItem={({ item }) => {
					const label =
						item.kind === 'sleep'
							? formatSleepRow(item.event, nowMs)
							: formatFeedingRow(item.event, nowMs)
					const href =
						item.kind === 'sleep'
							? (`/sleep/${item.event.id}` as Href)
							: (`/feeding/${item.event.id}` as Href)
					const isActive =
						item.kind === 'sleep'
							? item.event.endAt == null
							: item.kind === 'feeding' &&
								item.event.type === 'breastfeeding' &&
								item.event.endAt == null
					return (
						<Pressable
							onPress={() => router.push(href)}
							style={[
								styles.row,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
							accessibilityRole="button"
							accessibilityLabel={label}
						>
							<Text style={[styles.rowText, { color: colors.text }]}>
								{label}
							</Text>
							{isActive ? (
								<Text style={{ color: colors.primary, marginTop: 4 }}>
									Активный
								</Text>
							) : null}
						</Pressable>
					)
				}}
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
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	filterChip: {
		minHeight: 40,
		paddingHorizontal: spacing.md,
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
		minHeight: 48,
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
