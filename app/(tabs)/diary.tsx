/**
 * Diary — day-first timeline with date nav, filters, search, and quick add.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { DiaryTimelineRowView } from '@/src/components/DiaryTimelineRow'
import {
	MoreActionsSheet,
	type MoreActionId,
} from '@/src/components/MoreActionsSheet'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	clampLocalDateToToday,
	formatDiaryDayLabel,
	shiftLocalDate,
} from '@/src/presentation/diaryDayLabels'
import {
	loadDiaryDay,
	loadDiaryHistoryPage,
} from '@/src/presentation/diaryLoad'
import type { DiaryDaySummary } from '@/src/presentation/diaryDaySummary'
import {
	matchesDiaryFilters,
	matchesDiarySearch,
	type DiaryFilter,
	type DiaryOtherFilter,
	type TimelineRow,
} from '@/src/presentation/diaryTimeline'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

type ViewMode = 'day' | 'all'

const PRIMARY_FILTERS: { id: DiaryFilter; label: string }[] = [
	{ id: 'all', label: 'Все' },
	{ id: 'sleep', label: 'Сон' },
	{ id: 'feeding', label: 'Кормление' },
	{ id: 'diaper', label: 'Подгузники' },
	{ id: 'other', label: 'Другое' },
]

const OTHER_FILTERS: { id: DiaryOtherFilter; label: string }[] = [
	{ id: 'all', label: 'Все' },
	{ id: 'activity', label: 'Активности' },
	{ id: 'temperature', label: 'Температура' },
	{ id: 'medicine', label: 'Лекарства' },
	{ id: 'custom', label: 'Свои' },
	{ id: 'milestone', label: 'Достижения' },
	{ id: 'symptom', label: 'Симптомы' },
	{ id: 'doctor', label: 'Врачи' },
]

export default function DiaryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild, loading: childLoading } = useActiveChild()
	const { sleep, feeding, diaper, quickEvents, milestones, symptoms, doctorVisits } =
		useDatabase()

	const today = toLocalDateOnly()
	const [selectedDate, setSelectedDate] = useState(today)
	const [viewMode, setViewMode] = useState<ViewMode>('day')
	const [filter, setFilter] = useState<DiaryFilter>('all')
	const [otherFilter, setOtherFilter] = useState<DiaryOtherFilter>('all')
	const [searchOpen, setSearchOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [pickerOpen, setPickerOpen] = useState(false)
	const [moreOpen, setMoreOpen] = useState(false)
	const [customDefs, setCustomDefs] = useState<{ id: string; name: string }[]>(
		[],
	)
	const [rows, setRows] = useState<TimelineRow[]>([])
	const [summary, setSummary] = useState<DiaryDaySummary | null>(null)
	const [loading, setLoading] = useState(true)

	const reposReady = Boolean(
		sleep &&
			feeding &&
			diaper &&
			quickEvents &&
			milestones &&
			symptoms &&
			doctorVisits,
	)

	const refresh = useCallback(async () => {
		if (
			!reposReady ||
			!activeChild ||
			!sleep ||
			!feeding ||
			!diaper ||
			!quickEvents ||
			!milestones ||
			!symptoms ||
			!doctorVisits
		) {
			setRows([])
			setSummary(null)
			setLoading(false)
			return
		}
		const repos = {
			sleep,
			feeding,
			diaper,
			quickEvents,
			milestones,
			symptoms,
			doctorVisits,
		}
		const stamp = Date.now()
		try {
			if (viewMode === 'day') {
				const bundle = await loadDiaryDay(
					repos,
					activeChild.id,
					selectedDate,
					stamp,
				)
				setRows(bundle.rows)
				setSummary(bundle.summary)
			} else {
				const history = await loadDiaryHistoryPage(
					repos,
					activeChild.id,
					120,
					stamp,
				)
				setRows(history)
				setSummary(null)
			}
			const defs = await quickEvents.listActiveCustomDefinitions(
				activeChild.id,
			)
			setCustomDefs(defs.map((d) => ({ id: d.id, name: d.name })))
		} catch (error) {
			logger.error('Failed to load diary', error)
		} finally {
			setLoading(false)
		}
	}, [
		reposReady,
		activeChild,
		sleep,
		feeding,
		diaper,
		quickEvents,
		milestones,
		symptoms,
		doctorVisits,
		viewMode,
		selectedDate,
	])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	const visible = useMemo(() => {
		return rows.filter(
			(row) =>
				matchesDiaryFilters(row, filter, otherFilter) &&
				matchesDiarySearch(row, searchQuery),
		)
	}, [rows, filter, otherFilter, searchQuery])

	const goPrevDay = (): void => {
		setViewMode('day')
		setSelectedDate((d) => shiftLocalDate(d, -1))
	}

	const goNextDay = (): void => {
		setViewMode('day')
		setSelectedDate((d) => clampLocalDateToToday(shiftLocalDate(d, 1), today))
	}

	const onPickerChange = (
		event: DateTimePickerEvent,
		date?: Date,
	): void => {
		if (Platform.OS === 'android') {
			setPickerOpen(false)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		setViewMode('day')
		setSelectedDate(clampLocalDateToToday(toLocalDateOnly(date), today))
		if (Platform.OS === 'ios') {
			setPickerOpen(false)
		}
	}

	const handleMoreSelect = (id: MoreActionId): void => {
		if (id === 'custom') {
			router.push('/event/custom-type' as Href)
			return
		}
		router.push(`/event/new?kind=${id}` as Href)
	}

	const openAddMenu = (): void => {
		Alert.alert('Добавить', undefined, [
			{
				text: 'Сон',
				onPress: () => router.push('/sleep/manual' as Href),
			},
			{
				text: 'Кормление',
				onPress: () => router.push('/feeding' as Href),
			},
			{
				text: 'Подгузник',
				onPress: () => router.push('/diaper' as Href),
			},
			{
				text: 'Ещё…',
				onPress: () => setMoreOpen(true),
			},
			{ text: 'Отмена', style: 'cancel' },
		])
	}

	const onSummaryPress = (id: string): void => {
		if (id === 'diary-sleep') {
			setFilter('sleep')
		} else if (id === 'diary-feeding') {
			setFilter('feeding')
		} else if (id === 'diary-diaper') {
			setFilter('diaper')
		}
	}

	const canGoForward = selectedDate < today

	if (childLoading || (loading && rows.length === 0)) {
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
				keyExtractor={(item) => `${item.kind}-${item.id}-${item.groupLocalDate}`}
				contentContainerStyle={styles.content}
				ListHeaderComponent={
					<View style={styles.header}>
						<View style={styles.topBar}>
							<Pressable
								onPress={() => setSearchOpen((v) => !v)}
								style={styles.iconBtn}
								accessibilityRole="button"
								accessibilityLabel="Поиск"
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Поиск
								</Text>
							</Pressable>
							<Pressable
								onPress={() =>
									setViewMode((m) => (m === 'day' ? 'all' : 'day'))
								}
								style={styles.iconBtn}
								accessibilityRole="button"
								accessibilityLabel={
									viewMode === 'day' ? 'Все события' : 'Режим дня'
								}
							>
								<Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
									{viewMode === 'day' ? 'Все' : 'День'}
								</Text>
							</Pressable>
							<Pressable
								onPress={openAddMenu}
								style={[styles.addFab, { backgroundColor: colors.primary }]}
								accessibilityRole="button"
								accessibilityLabel="Добавить событие"
							>
								<Text style={styles.addFabText}>+</Text>
							</Pressable>
						</View>

						{searchOpen ? (
							<TextInput
								value={searchQuery}
								onChangeText={setSearchQuery}
								placeholder={
									viewMode === 'day'
										? 'Поиск в выбранном дне'
										: 'Поиск по истории'
								}
								placeholderTextColor={colors.textMuted}
								autoFocus
								style={[
									styles.search,
									{
										color: colors.text,
										borderColor: colors.border,
										backgroundColor: colors.surface,
									},
								]}
							/>
						) : null}

						{viewMode === 'day' ? (
							<View style={styles.dateNav}>
								<Pressable
									onPress={goPrevDay}
									style={styles.navArrow}
									accessibilityRole="button"
									accessibilityLabel="Предыдущий день"
								>
									<Text style={[styles.navArrowText, { color: colors.primary }]}>
										‹
									</Text>
								</Pressable>
								<Pressable
									onPress={() => setPickerOpen(true)}
									style={styles.dateBtn}
									accessibilityRole="button"
									accessibilityLabel="Выбрать дату"
								>
									<Text
										style={[styles.dateLabel, { color: colors.text }]}
										numberOfLines={1}
									>
										{formatDiaryDayLabel(selectedDate, today)}
									</Text>
								</Pressable>
								<Pressable
									onPress={goNextDay}
									disabled={!canGoForward}
									style={styles.navArrow}
									accessibilityRole="button"
									accessibilityLabel="Следующий день"
									accessibilityState={{ disabled: !canGoForward }}
								>
									<Text
										style={[
											styles.navArrowText,
											{
												color: canGoForward
													? colors.primary
													: colors.textMuted,
											},
										]}
									>
										›
									</Text>
								</Pressable>
							</View>
						) : (
							<Text style={[styles.allModeLead, { color: colors.textSecondary }]}>
								Недавние события (до 120)
							</Text>
						)}

						{viewMode === 'day' && summary ? (
							<View
								style={[
									styles.summary,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								{summary.rows.map((row) => (
									<Pressable
										key={row.id}
										onPress={() => onSummaryPress(row.id)}
										style={styles.summaryItem}
										accessibilityRole="button"
										accessibilityLabel={`${row.label} ${row.value}`}
									>
										<Text style={{ color: colors.textMuted, fontSize: 12 }}>
											{row.label}
										</Text>
										<Text style={{ color: colors.text, fontWeight: '700' }}>
											{row.value}
										</Text>
									</Pressable>
								))}
							</View>
						) : null}

						<View style={styles.filters}>
							{PRIMARY_FILTERS.map((item) => {
								const on = filter === item.id
								return (
									<Pressable
										key={item.id}
										onPress={() => {
											setFilter(item.id)
											if (item.id !== 'other') {
												setOtherFilter('all')
											}
										}}
										style={[
											styles.filterChip,
											{
												backgroundColor: on
													? colors.primary
													: colors.primarySoft,
												borderColor: colors.border,
											},
										]}
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

						{filter === 'other' ? (
							<View style={styles.filters}>
								{OTHER_FILTERS.map((item) => {
									const on = otherFilter === item.id
									return (
										<Pressable
											key={item.id}
											onPress={() => setOtherFilter(item.id)}
											style={[
												styles.filterChip,
												{
													backgroundColor: on
														? colors.primary
														: colors.surface,
													borderColor: colors.border,
												},
											]}
										>
											<Text
												style={{
													color: on ? '#FFFFFF' : colors.textSecondary,
													fontWeight: '600',
													fontSize: 12,
												}}
											>
												{item.label}
											</Text>
										</Pressable>
									)
								})}
							</View>
						) : null}
					</View>
				}
				ListEmptyComponent={
					<View style={styles.emptyBox}>
						<Text style={[styles.empty, { color: colors.textMuted }]}>
							{searchQuery.trim()
								? 'Ничего не найдено'
								: viewMode === 'day'
									? 'В этот день пока нет записей'
									: 'За выбранный период пока нет записей'}
						</Text>
						{!searchQuery.trim() ? (
							<Pressable
								onPress={openAddMenu}
								style={[
									styles.emptyBtn,
									{ backgroundColor: colors.primarySoft, borderColor: colors.border },
								]}
							>
								<Text style={{ color: colors.primary, fontWeight: '700' }}>
									Добавить событие
								</Text>
							</Pressable>
						) : null}
					</View>
				}
				renderItem={({ item }) => (
					<DiaryTimelineRowView
						item={item}
						onPress={() => router.push(item.href as Href)}
					/>
				)}
				ListFooterComponent={<BannerAdSlot placement="diary" />}
			/>

			{pickerOpen ? (
				<DateTimePicker
					value={new Date(
						Number(selectedDate.slice(0, 4)),
						Number(selectedDate.slice(5, 7)) - 1,
						Number(selectedDate.slice(8, 10)),
						12,
						0,
						0,
					)}
					mode="date"
					maximumDate={new Date()}
					onChange={onPickerChange}
				/>
			) : null}

			<MoreActionsSheet
				visible={moreOpen}
				onClose={() => setMoreOpen(false)}
				onSelect={handleMoreSelect}
				customNames={customDefs}
				onSelectCustom={(definitionId) =>
					router.push(
						`/event/new?kind=custom&definitionId=${definitionId}` as Href,
					)
				}
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
	header: { marginBottom: spacing.sm },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	iconBtn: {
		minHeight: 40,
		paddingHorizontal: spacing.sm,
		justifyContent: 'center',
	},
	addFab: {
		marginLeft: 'auto',
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addFabText: {
		color: '#FFFFFF',
		fontSize: 28,
		fontWeight: '600',
		lineHeight: 30,
	},
	search: {
		minHeight: 44,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	dateNav: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.sm,
	},
	navArrow: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	navArrowText: {
		fontSize: 28,
		fontWeight: '600',
	},
	dateBtn: {
		flex: 1,
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.xs,
	},
	dateLabel: {
		...typography.subtitle,
		textAlign: 'center',
	},
	allModeLead: {
		...typography.caption,
		marginBottom: spacing.sm,
	},
	summary: {
		flexDirection: 'row',
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingVertical: spacing.sm,
		marginBottom: spacing.sm,
	},
	summaryItem: {
		flex: 1,
		alignItems: 'center',
		gap: 2,
		minHeight: 44,
		justifyContent: 'center',
	},
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
	emptyBox: {
		alignItems: 'center',
		marginTop: spacing.lg,
		gap: spacing.md,
	},
	empty: {
		...typography.body,
		textAlign: 'center',
	},
	emptyBtn: {
		minHeight: 48,
		paddingHorizontal: spacing.lg,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
