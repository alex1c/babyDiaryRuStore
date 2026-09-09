/**
 * Today — sleep + feeding tracking; diaper remains a later phase.
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
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { QuickActions, type QuickActionId } from '@/src/components/QuickActions'
import { SleepStatusCard } from '@/src/components/SleepStatusCard'
import { StatusCard } from '@/src/components/StatusCard'
import { TodaySummary } from '@/src/components/TodaySummary'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { breastfeedingLiveTotals } from '@/src/domain/breastfeedingDuration'
import { FeedingValidationError } from '@/src/domain/feedingLabels'
import { SleepValidationError } from '@/src/domain/sleepValidation'
import type { BreastSide } from '@/src/models/feeding'
import {
	buildTodayFeedingModel,
	type TodayFeedingModel,
} from '@/src/presentation/todayFeedingModel'
import {
	buildTodaySleepModel,
	type TodaySleepModel,
} from '@/src/presentation/todaySleepModel'
import { PHASE1_COMING_SOON } from '@/src/presentation/todayViewModel'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatDurationMs, durationBetweenMs } from '@/src/utils/durationFormat'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { spacing, typography } from '@/src/theme/tokens'

export default function TodayScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild, loading: childLoading } = useActiveChild()
	const { sleep, feeding } = useDatabase()
	const { message, showToast } = useLightweightToast()

	const [sleepModel, setSleepModel] = useState<TodaySleepModel | null>(null)
	const [feedingModel, setFeedingModel] = useState<TodayFeedingModel | null>(
		null,
	)
	const [busy, setBusy] = useState(false)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		if (!sleep || !feeding || !activeChild) {
			setSleepModel(null)
			setFeedingModel(null)
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
			const latest = await feeding.findLatest(activeChild.id)
			const dayFeedings = await feeding.listByChildAndLocalDate(
				activeChild.id,
				today,
			)
			setFeedingModel(
				buildTodayFeedingModel(activeBf, latest, dayFeedings, Date.now()),
			)
		} catch (error) {
			logger.error('Failed to refresh Today', error)
			showToast('Не удалось обновить данные')
		} finally {
			setLoading(false)
		}
	}, [sleep, feeding, activeChild, showToast])

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
		if (id === 'more') {
			handleAddSleep()
			return
		}
		showToast(PHASE1_COMING_SOON)
	}

	if (childLoading || loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		)
	}

	if (!activeChild || !sleepModel || !feedingModel) {
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
	]

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<Text
						style={[styles.name, { color: colors.text }]}
						accessibilityRole="header"
					>
						{sleepModel.childName}
					</Text>
					<Text style={[styles.age, { color: colors.textSecondary }]}>
						{sleepModel.ageLabel}
					</Text>
				</View>

				<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
					Быстрые действия
				</Text>
				<QuickActions onAction={handleQuickAction} />

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
						hasData: false,
						summary: 'Пока нет записей',
					}}
					onPressCta={() => showToast(PHASE1_COMING_SOON)}
				/>

				<TodaySummary rows={summaryRows} title="Сегодня" />
				<BannerAdSlot />
			</ScrollView>
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
})
