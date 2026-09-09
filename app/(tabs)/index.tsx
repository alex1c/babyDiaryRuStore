/**
 * Today — sleep tracking is live; feeding/diaper remain Phase 3 placeholders.
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
import { SleepValidationError } from '@/src/domain/sleepValidation'
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
	const { sleep } = useDatabase()
	const { message, showToast } = useLightweightToast()

	const [model, setModel] = useState<TodaySleepModel | null>(null)
	const [busy, setBusy] = useState(false)
	const [loadingSleep, setLoadingSleep] = useState(true)

	const refreshSleep = useCallback(async () => {
		if (!sleep || !activeChild) {
			setModel(null)
			setLoadingSleep(false)
			return
		}
		try {
			// Sequential SQLite reads — never Promise.all on one NativeDatabase.
			const active = await sleep.findActive(activeChild.id)
			const lastFinished = await sleep.findLastFinished(activeChild.id)
			const today = toLocalDateOnly()
			const daySleeps = await sleep.listOverlappingLocalDay(
				activeChild.id,
				today,
			)
			setModel(
				buildTodaySleepModel(
					activeChild,
					active,
					lastFinished,
					daySleeps,
					Date.now(),
					today,
				),
			)
		} catch (error) {
			logger.error('Failed to refresh sleep for Today', error)
			showToast('Не удалось обновить данные сна')
		} finally {
			setLoadingSleep(false)
		}
	}, [sleep, activeChild, showToast])

	useFocusEffect(
		useCallback(() => {
			setLoadingSleep(true)
			void refreshSleep()
		}, [refreshSleep]),
	)

	useEffect(() => {
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void refreshSleep()
			}
		})
		return () => sub.remove()
	}, [refreshSleep])

	const handleStartSleep = async (): Promise<void> => {
		if (!sleep || !activeChild || busy) {
			return
		}
		setBusy(true)
		try {
			await sleep.start({ childId: activeChild.id, sleepType: 'auto' })
			await refreshSleep()
		} catch (error) {
			logger.error('start sleep failed', error)
			await refreshSleep()
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
		if (!sleep || !model?.activeSleep || busy) {
			return
		}
		setBusy(true)
		try {
			const finished = await sleep.finish(model.activeSleep.id)
			const ms = durationBetweenMs(finished.startAt, finished.endAt)
			showToast(`Сон ${formatDurationMs(ms)} сохранён`)
			await refreshSleep()
		} catch (error) {
			logger.error('finish sleep failed', error)
			await refreshSleep()
			const text =
				error instanceof SleepValidationError
					? error.message
					: 'Не удалось завершить сон'
			showToast(text)
		} finally {
			setBusy(false)
		}
	}

	const handlePrimary = (): void => {
		if (!model) {
			return
		}
		if (model.mode === 'sleeping') {
			void handleFinishSleep()
		} else {
			void handleStartSleep()
		}
	}

	const handleAddSleep = (): void => {
		router.push('/sleep/manual' as Href)
	}

	const handleQuickAction = (id: QuickActionId): void => {
		if (id === 'sleep') {
			if (model?.mode === 'sleeping') {
				void handleFinishSleep()
			} else {
				void handleStartSleep()
			}
			return
		}
		if (id === 'more') {
			handleAddSleep()
			return
		}
		showToast(PHASE1_COMING_SOON)
	}

	if (childLoading || loadingSleep) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		)
	}

	if (!activeChild || !model) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={[styles.empty, { color: colors.textSecondary }]}>
					Добавьте малыша, чтобы начать дневник.
				</Text>
			</View>
		)
	}

	const summaryRows = [
		{ id: 'sleep' as const, label: 'Сон', value: model.aggregate.totalLabel },
		{ id: 'day' as const, label: 'Дневной', value: model.aggregate.dayLabel },
		{ id: 'night' as const, label: 'Ночной', value: model.aggregate.nightLabel },
		{
			id: 'count' as const,
			label: 'Снов',
			value: String(model.aggregate.finishedCount),
		},
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
						{model.childName}
					</Text>
					<Text style={[styles.age, { color: colors.textSecondary }]}>
						{model.ageLabel}
					</Text>
				</View>

				<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
					Быстрые действия
				</Text>
				<QuickActions onAction={handleQuickAction} />

				<SleepStatusCard
					model={model}
					busy={busy}
					onPrimary={handlePrimary}
					onSecondary={handleAddSleep}
				/>

				{model.activeSleep ? (
					<Pressable
						onPress={() =>
							router.push(`/sleep/${model.activeSleep!.id}` as Href)
						}
						accessibilityRole="button"
						accessibilityLabel="Изменить активный сон"
						style={styles.editLink}
					>
						<Text style={{ color: colors.primary }}>Изменить активный сон</Text>
					</Pressable>
				) : null}

				<StatusCard
					card={{
						id: 'feeding',
						title: 'Кормление',
						emptyMessage: 'Пока нет записей',
						ctaLabel: 'Кормление',
						hasData: false,
						summary: 'Пока нет записей',
					}}
					onPressCta={() => showToast(PHASE1_COMING_SOON)}
				/>
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

				<TodaySummary rows={summaryRows} />
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
