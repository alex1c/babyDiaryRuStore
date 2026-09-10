/**
 * Today — sleep, feeding, diaper and one-handed quick actions.
 */

import { useCallback, useEffect, useState } from 'react'
import {
	ActivityIndicator,
	AppState,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ActiveBreastfeedingCard } from '@/src/components/ActiveBreastfeedingCard'
import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { ChildSwitcherSheet } from '@/src/components/ChildSwitcherSheet'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import {
	MoreActionsSheet,
	type MoreActionId,
} from '@/src/components/MoreActionsSheet'
import { QuickActions, type QuickActionId } from '@/src/components/QuickActions'
import { SleepStatusCard } from '@/src/components/SleepStatusCard'
import { SmartTodayCard } from '@/src/components/SmartTodayCard'
import { StatusCard } from '@/src/components/StatusCard'
import { TodayChildHeader } from '@/src/components/TodayChildHeader'
import { TodaySummary } from '@/src/components/TodaySummary'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { breastfeedingLiveTotals } from '@/src/domain/breastfeedingDuration'
import { FeedingValidationError } from '@/src/domain/feedingLabels'
import { reminderScheduleLabel } from '@/src/domain/reminderLabels'
import { SleepValidationError } from '@/src/domain/sleepValidation'
import type { SmartTodayHint } from '@/src/domain/smartToday'
import type { Reminder } from '@/src/models/reminder'
import type { BreastSide } from '@/src/models/feeding'
import {
	buildTodayDiaperModel,
	type TodayDiaperModel,
} from '@/src/presentation/todayDiaperModel'
import {
	buildTodayFeedingModel,
	type TodayFeedingModel,
} from '@/src/presentation/todayFeedingModel'
import {
	buildTodaySleepModel,
	type TodaySleepModel,
} from '@/src/presentation/todaySleepModel'
import { hiddenQuickActionIds } from '@/src/presentation/quickActionVisibility'
import { loadSmartTodayHint } from '@/src/presentation/loadSmartToday'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatDurationMs, durationBetweenMs } from '@/src/utils/durationFormat'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { spacing, typography } from '@/src/theme/tokens'

export default function TodayScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const {
		activeChild,
		activeChildId,
		children: childrenList,
		loading: childLoading,
		setActiveChildId,
		refresh: refreshActiveChild,
	} = useActiveChild()
	const { sleep, feeding, diaper, quickEvents, reminders, reminderService } =
		useDatabase()
	const { message, showToast } = useLightweightToast()

	const [sleepModel, setSleepModel] = useState<TodaySleepModel | null>(null)
	const [feedingModel, setFeedingModel] = useState<TodayFeedingModel | null>(
		null,
	)
	const [diaperModel, setDiaperModel] = useState<TodayDiaperModel | null>(null)
	const [smartHint, setSmartHint] = useState<SmartTodayHint | null>(null)
	const [nextReminder, setNextReminder] = useState<Reminder | null>(null)
	const [customDefs, setCustomDefs] = useState<{ id: string; name: string }[]>(
		[],
	)
	const [moreOpen, setMoreOpen] = useState(false)
	const [switcherOpen, setSwitcherOpen] = useState(false)
	const [busy, setBusy] = useState(false)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		if (!sleep || !feeding || !diaper || !quickEvents || !activeChild) {
			setSleepModel(null)
			setFeedingModel(null)
			setDiaperModel(null)
			setSmartHint(null)
			setNextReminder(null)
			setLoading(false)
			return
		}
		try {
			// Sequential SQLite reads — never Promise.all on one NativeDatabase.
			const activeSleep = await sleep.findActive(activeChild.id)
			const lastFinished = await sleep.findLastFinished(activeChild.id)
			const today = toLocalDateOnly()
			const daySleeps = await sleep.listOverlappingLocalDay(
				activeChild.id,
				today,
			)
			setSleepModel(
				buildTodaySleepModel(
					activeChild,
					activeSleep,
					lastFinished,
					daySleeps,
					Date.now(),
					today,
				),
			)

			const activeBf = await feeding.findActiveBreastfeeding(activeChild.id)
			const latestFeeding = await feeding.findLatest(activeChild.id)
			const dayFeedings = await feeding.listByChildAndLocalDate(
				activeChild.id,
				today,
			)
			setFeedingModel(
				buildTodayFeedingModel(
					activeBf,
					latestFeeding,
					dayFeedings,
					Date.now(),
				),
			)

			const latestDiaper = await diaper.findLatest(activeChild.id)
			const dayDiapers = await diaper.listByChildAndLocalDate(
				activeChild.id,
				today,
			)
			setDiaperModel(
				buildTodayDiaperModel(latestDiaper, dayDiapers, Date.now()),
			)

			const defs = await quickEvents.listActiveCustomDefinitions(
				activeChild.id,
			)
			setCustomDefs(defs.map((d) => ({ id: d.id, name: d.name })))

			const hint = await loadSmartTodayHint(
				{ sleep, feeding },
				activeChild,
				Date.now(),
			)
			setSmartHint(hint)

			if (reminders) {
				const enabled = await reminders.listEnabledByChild(activeChild.id)
				const withTime = enabled
					.filter((r) => r.timeLocal || r.fireAt)
					.sort((a, b) =>
						(a.timeLocal ?? a.fireAt ?? '').localeCompare(
							b.timeLocal ?? b.fireAt ?? '',
						),
					)
				setNextReminder(withTime[0] ?? null)
			} else {
				setNextReminder(null)
			}
		} catch (error) {
			logger.error('Failed to refresh Today', error)
			showToast('Не удалось обновить данные')
		} finally {
			setLoading(false)
		}
	}, [
		sleep,
		feeding,
		diaper,
		quickEvents,
		reminders,
		activeChild,
		showToast,
	])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	useEffect(() => {
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void refresh()
			}
		})
		return () => sub.remove()
	}, [refresh])

	const handleStartSleep = async (): Promise<void> => {
		if (!sleep || !activeChild || busy) {
			return
		}
		setBusy(true)
		try {
			await sleep.start({ childId: activeChild.id, sleepType: 'auto' })
			await refresh()
		} catch (error) {
			logger.error('start sleep failed', error)
			await refresh()
			const text =
				error instanceof SleepValidationError
					? error.message
					: 'Не удалось начать сон'
			showToast(text)
		} finally {
			setBusy(false)
		}
	}

	const handleFinishSleep = async (): Promise<void> => {
		if (!sleep || !sleepModel?.activeSleep || busy) {
			return
		}
		setBusy(true)
		try {
			const finished = await sleep.finish(sleepModel.activeSleep.id)
			const ms = durationBetweenMs(finished.startAt, finished.endAt)
			showToast(`Сон ${formatDurationMs(ms)} сохранён`)
			await refresh()
		} catch (error) {
			logger.error('finish sleep failed', error)
			await refresh()
			const text =
				error instanceof SleepValidationError
					? error.message
					: 'Не удалось завершить сон'
			showToast(text)
		} finally {
			setBusy(false)
		}
	}

	const handlePrimarySleep = (): void => {
		if (!sleepModel) {
			return
		}
		if (sleepModel.mode === 'sleeping') {
			void handleFinishSleep()
		} else {
			void handleStartSleep()
		}
	}

	const handleAddSleep = (): void => {
		router.push('/sleep/manual' as Href)
	}

	const openFeeding = (): void => {
		if (feedingModel?.activeBreastfeeding) {
			router.push('/feeding/active' as Href)
			return
		}
		router.push('/feeding' as Href)
	}

	const handleSwitchSide = async (side: BreastSide): Promise<void> => {
		if (!feeding || !feedingModel?.activeBreastfeeding || busy) {
			return
		}
		setBusy(true)
		try {
			await feeding.switchBreastSide(
				feedingModel.activeBreastfeeding.id,
				side,
			)
			await refresh()
		} catch (error) {
			logger.error('switch side on Today failed', error)
			showToast(
				error instanceof FeedingValidationError
					? error.message
					: 'Не удалось переключить сторону',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleFinishBreastfeeding = async (): Promise<void> => {
		if (!feeding || !feedingModel?.activeBreastfeeding || busy) {
			return
		}
		setBusy(true)
		try {
			const finished = await feeding.finishBreastfeeding(
				feedingModel.activeBreastfeeding.id,
			)
			const totals = breastfeedingLiveTotals(finished, Date.now())
			showToast(
				`Кормление ${formatDurationMs(totals.totalSeconds * 1000)} сохранено`,
			)
			if (reminderService && activeChild) {
				await reminderService.rescheduleNoFeedingForChild(activeChild.id)
			}
			await refresh()
		} catch (error) {
			logger.error('finish breastfeeding on Today failed', error)
			await refresh()
			showToast(
				error instanceof FeedingValidationError
					? error.message
					: 'Не удалось завершить кормление',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleQuickAction = (id: QuickActionId): void => {
		if (id === 'sleep') {
			if (sleepModel?.mode === 'sleeping') {
				void handleFinishSleep()
			} else {
				void handleStartSleep()
			}
			return
		}
		if (id === 'feeding') {
			openFeeding()
			return
		}
		if (id === 'diaper') {
			router.push('/diaper' as Href)
			return
		}
		if (id === 'more') {
			setMoreOpen(true)
		}
	}

	const handleMoreSelect = (id: MoreActionId): void => {
		if (id === 'custom') {
			router.push('/event/custom-type' as Href)
			return
		}
		router.push(`/event/new?kind=${id}` as Href)
	}

	if (childLoading || loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.empty, { color: colors.textMuted }]}>
					Загрузка…
				</Text>
			</View>
		)
	}

	if (!activeChild || !sleepModel || !feedingModel || !diaperModel) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={[styles.empty, { color: colors.textSecondary }]}>
					Добавьте малыша, чтобы начать дневник.
				</Text>
			</View>
		)
	}

	const summaryRows = [
		{
			id: 'sleep',
			label: 'Сон',
			value: sleepModel.aggregate.totalLabel,
		},
		{
			id: 'day',
			label: 'Дневной',
			value: sleepModel.aggregate.dayLabel,
		},
		{
			id: 'night',
			label: 'Ночной',
			value: sleepModel.aggregate.nightLabel,
		},
		{
			id: 'count',
			label: 'Снов',
			value: String(sleepModel.aggregate.finishedCount),
		},
		...feedingModel.summaryRows,
		...diaperModel.summaryRows,
	]

	// Hide quick actions that duplicate an active session's primary CTA.
	const hiddenQuickIds = hiddenQuickActionIds({
		isSleeping: sleepModel.mode === 'sleeping',
		hasActiveBreastfeeding: Boolean(feedingModel.activeBreastfeeding),
	})

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<TodayChildHeader
					child={activeChild}
					onPress={() => setSwitcherOpen(true)}
				/>

				<SleepStatusCard
					model={sleepModel}
					busy={busy}
					onPrimary={handlePrimarySleep}
					onSecondary={handleAddSleep}
				/>

				{sleepModel.activeSleep ? (
					<Pressable
						onPress={() =>
							router.push(
								`/sleep/${sleepModel.activeSleep!.id}` as Href,
							)
						}
						accessibilityRole="button"
						accessibilityLabel="Изменить активный сон"
						style={styles.editLink}
					>
						<Text style={{ color: colors.primary }}>
							Изменить активный сон
						</Text>
					</Pressable>
				) : null}

				{feedingModel.activeBreastfeeding ? (
					<ActiveBreastfeedingCard
						event={feedingModel.activeBreastfeeding}
						busy={busy}
						onSwitchSide={(side) => void handleSwitchSide(side)}
						onFinish={() => void handleFinishBreastfeeding()}
						onAddNote={() =>
							router.push(
								`/feeding/${feedingModel.activeBreastfeeding!.id}` as Href,
							)
						}
					/>
				) : (
					<StatusCard
						card={{
							id: 'feeding',
							title: 'Кормление',
							emptyMessage: 'Пока нет кормлений',
							ctaLabel: 'Кормление',
							hasData: feedingModel.hasData,
							summary: feedingModel.latestSummary,
						}}
						onPressCta={openFeeding}
					/>
				)}

				<StatusCard
					card={{
						id: 'diaper',
						title: 'Подгузник',
						emptyMessage: 'Пока нет записей',
						ctaLabel: 'Подгузник',
						hasData: diaperModel.hasData,
						summary: diaperModel.latestSummary,
					}}
					onPressCta={() => router.push('/diaper' as Href)}
				/>
				{diaperModel.latest ? (
					<Pressable
						onPress={() =>
							router.push(`/diaper/${diaperModel.latest!.id}` as Href)
						}
						style={styles.editLink}
						accessibilityRole="button"
						accessibilityLabel="Изменить последний подгузник"
					>
						<Text style={{ color: colors.primary }}>
							Изменить запись
						</Text>
					</Pressable>
				) : null}

				<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
					Быстрые действия
				</Text>
				<QuickActions
					onAction={handleQuickAction}
					hiddenIds={hiddenQuickIds}
				/>

				{smartHint ? <SmartTodayCard hint={smartHint} /> : null}

				{nextReminder ? (
					<Pressable
						onPress={() => router.push('/reminders' as Href)}
						style={styles.nextReminder}
					>
						<Text style={{ color: colors.textMuted, ...typography.caption }}>
							Следующее
						</Text>
						<Text style={{ color: colors.text, ...typography.body }}>
							{nextReminder.title} ·{' '}
							{nextReminder.timeLocal ??
								reminderScheduleLabel(nextReminder)}
						</Text>
					</Pressable>
				) : null}

				<TodaySummary rows={summaryRows} title="Сегодня" />
				<BannerAdSlot />
			</ScrollView>
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
			<ChildSwitcherSheet
				visible={switcherOpen}
				childrenList={childrenList}
				activeChildId={activeChildId}
				onClose={() => setSwitcherOpen(false)}
				onSelect={(id) => {
					void (async () => {
						if (id === activeChildId) {
							return
						}
						setLoading(true)
						setSleepModel(null)
						setFeedingModel(null)
						setDiaperModel(null)
						setSmartHint(null)
						await setActiveChildId(id)
						await refreshActiveChild()
						await refresh()
					})()
				}}
				onAddChild={() => router.push('/children/new' as Href)}
			/>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	empty: {
		...typography.body,
		textAlign: 'center',
	},
	header: {
		marginBottom: spacing.lg,
	},
	name: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	age: {
		...typography.subtitle,
		fontWeight: '500',
	},
	sectionLabel: {
		...typography.caption,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		marginBottom: spacing.sm,
	},
	editLink: {
		minHeight: 44,
		marginBottom: spacing.md,
		justifyContent: 'center',
	},
	nextReminder: {
		marginBottom: spacing.md,
		gap: 2,
	},
})
