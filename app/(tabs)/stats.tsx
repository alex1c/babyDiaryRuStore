/**
 * Statistics tab — period analytics (numbers first, then simple charts).
 */

import { useCallback, useState, type ReactNode } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { Link, useFocusEffect, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { SimpleDayBarChart } from '@/src/components/SimpleDayBarChart'
import { SimpleGrowthChart } from '@/src/components/SimpleGrowthChart'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { buildGrowthChartPoints } from '@/src/domain/growthCharts'
import {
	formatLengthCm,
	formatWeightKg,
} from '@/src/domain/growthLabels'
import { formatTemperatureCelsius } from '@/src/domain/quickEventLabels'
import type { PeriodReportData } from '@/src/domain/periodReport'
import {
	statsPeriodLabel,
	type StatsPeriodKind,
} from '@/src/domain/statsPeriod'
import { loadPeriodReport } from '@/src/presentation/loadPeriodReport'
import { formatMl } from '@/src/presentation/feedingFormat'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { formatDurationMs } from '@/src/utils/durationFormat'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

const PERIODS: StatsPeriodKind[] = ['7', '30', '90', 'all']

export default function StatsScreen () {
	const { colors } = useAppTheme()
	const { activeChild } = useActiveChild()
	const {
		sleep,
		feeding,
		diaper,
		growth,
		quickEvents,
		symptoms,
		doctorVisits,
	} = useDatabase()

	const [period, setPeriod] = useState<StatsPeriodKind>('7')
	const [report, setReport] = useState<PeriodReportData | null>(null)
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const reposReady = Boolean(
		sleep &&
			feeding &&
			diaper &&
			growth &&
			quickEvents &&
			symptoms &&
			doctorVisits,
	)

	const refresh = useCallback(
		async (kind: StatsPeriodKind, soft: boolean) => {
			if (
				!reposReady ||
				!activeChild ||
				!sleep ||
				!feeding ||
				!diaper ||
				!growth ||
				!quickEvents ||
				!symptoms ||
				!doctorVisits
			) {
				setReport(null)
				setLoading(false)
				return
			}
			if (soft) {
				setRefreshing(true)
			} else {
				setLoading(true)
			}
			try {
				const next = await loadPeriodReport(
					{
						sleep,
						feeding,
						diaper,
						growth,
						quickEvents,
						symptoms,
						doctorVisits,
					},
					activeChild,
					kind,
					toLocalDateOnly(),
					Date.now(),
				)
				setReport(next)
			} catch (err) {
				logger.error('Failed to load statistics', err)
			} finally {
				setLoading(false)
				setRefreshing(false)
			}
		},
		[
			reposReady,
			activeChild,
			sleep,
			feeding,
			diaper,
			growth,
			quickEvents,
			symptoms,
			doctorVisits,
		],
	)

	// Soft refresh keeps the previous report visible (no white flash).
	// Initial `loading` is true until the first fetch finishes.
	useFocusEffect(
		useCallback(() => {
			void refresh(period, true)
		}, [refresh, period]),
	)

	const handlePeriod = (kind: StatsPeriodKind): void => {
		setPeriod(kind)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.periodRow}>
					{PERIODS.map((kind) => (
						<Pressable
							key={kind}
							onPress={() => handlePeriod(kind)}
							style={[
								styles.periodChip,
								{
									backgroundColor:
										period === kind
											? colors.primarySoft
											: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text, fontSize: 13 }}>
								{statsPeriodLabel(kind)}
							</Text>
						</Pressable>
					))}
				</View>
				{refreshing ? (
					<Text style={[styles.softLoad, { color: colors.textMuted }]}>
						Обновление…
					</Text>
				) : null}

				{loading && !report ? (
					<ActivityIndicator color={colors.primary} />
				) : report ? (
					<>
						<SleepSection report={report} colors={colors} />
						<FeedingSection report={report} colors={colors} />
						<DiaperSection report={report} colors={colors} />
						<GrowthSection report={report} colors={colors} />
						<HealthSection report={report} colors={colors} />
					</>
				) : (
					<Text style={{ color: colors.textMuted, ...typography.body }}>
						Недостаточно данных за этот период
					</Text>
				)}

				<Link href={'/reports' as Href} asChild>
					<Pressable
						style={[
							styles.exportLink,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Text style={{ color: colors.text, ...typography.subtitle }}>
							Отчёты и экспорт
						</Text>
						<Text style={{ color: colors.textSecondary, ...typography.caption }}>
							Сводка, PDF и первый год
						</Text>
					</Pressable>
				</Link>

				<BannerAdSlot />
			</ScrollView>
		</SafeAreaView>
	)
}

function SleepSection ({
	report,
	colors,
}: {
	report: PeriodReportData
	colors: ThemeSlice
}) {
	const [open, setOpen] = useState(true)
	const s = report.sleep
	if (!s.hasAnyData) {
		return (
			<Collapsible
				title="Сон"
				open={open}
				onToggle={() => setOpen((v) => !v)}
				colors={colors}
			>
				<Text style={{ color: colors.textMuted }}>
					Недостаточно данных за этот период
				</Text>
			</Collapsible>
		)
	}
	const dayPoints = report.dailySeries.map((d) => ({
		id: d.date,
		label: d.date.slice(8),
		value: d.daySleepMinutes,
	}))
	const nightPoints = report.dailySeries.map((d) => ({
		id: `${d.date}-n`,
		label: d.date.slice(8),
		value: d.nightSleepMinutes,
	}))

	return (
		<Collapsible
			title="Сон"
			open={open}
			onToggle={() => setOpen((v) => !v)}
			colors={colors}
		>
			<StatLine
				text={`В среднем ${formatDurationMs(s.averageTotalMs)} в сутки`}
				colors={colors}
			/>
			<StatLine
				text={`Дневной: ${formatDurationMs(s.averageDayMs)}`}
				colors={colors}
			/>
			<StatLine
				text={`Ночной: ${formatDurationMs(s.averageNightMs)}`}
				colors={colors}
			/>
			<StatLine
				text={`Снов: ${formatAverage(s.averageSleepsPerDay)} в день`}
				colors={colors}
			/>
			<StatLine
				text={
					s.averageWakeWindowMs != null
						? `Среднее ВБ: ${formatDurationMs(s.averageWakeWindowMs)}`
						: 'Среднее ВБ: недостаточно интервалов'
				}
				colors={colors}
			/>
			<StatLine
				text={`Самый длинный сон: ${formatDurationMs(s.longestSleepMs)}`}
				colors={colors}
			/>
			<Text style={[styles.chartCaption, { color: colors.textSecondary }]}>
				Сон по дням (день / ночь)
			</Text>
			<SimpleDayBarChart
				points={dayPoints}
				secondaryPoints={nightPoints}
			/>
		</Collapsible>
	)
}

function FeedingSection ({
	report,
	colors,
}: {
	report: PeriodReportData
	colors: ThemeSlice
}) {
	const [open, setOpen] = useState(true)
	const f = report.feeding
	if (!f.hasAnyData) {
		return (
			<Collapsible
				title="Кормление"
				open={open}
				onToggle={() => setOpen((v) => !v)}
				colors={colors}
			>
				<Text style={{ color: colors.textMuted }}>
					Недостаточно данных за этот период
				</Text>
			</Collapsible>
		)
	}
	return (
		<Collapsible
			title="Кормление"
			open={open}
			onToggle={() => setOpen((v) => !v)}
			colors={colors}
		>
			<StatLine
				text={`В среднем ${formatAverage(f.averageFeedingsPerDay)} кормлений в день`}
				colors={colors}
			/>
			<StatLine
				text={`ГВ: ${f.breastfeedingCount} · ${formatDurationMs(f.breastfeedingTotalSeconds * 1000)}`}
				colors={colors}
			/>
			{f.breastfeedingAverageSeconds != null ? (
				<StatLine
					text={`Средняя длительность ГВ: ${formatDurationMs(f.breastfeedingAverageSeconds * 1000)}`}
					colors={colors}
				/>
			) : null}
			<StatLine text={`Смесь: ${formatMl(f.formulaMl)}`} colors={colors} />
			<StatLine
				text={`Сцеженное молоко: ${formatMl(f.expressedMilkMl)}`}
				colors={colors}
			/>
			<StatLine text={`Вода: ${formatMl(f.waterMl)}`} colors={colors} />
			<StatLine text={`Прикорм: ${f.solidsCount}`} colors={colors} />
			<Text style={[styles.chartCaption, { color: colors.textSecondary }]}>
				Кормления по дням
			</Text>
			<SimpleDayBarChart
				points={report.dailySeries.map((d) => ({
					id: d.date,
					label: d.date.slice(8),
					value: d.feedingCount,
				}))}
			/>
			<Text style={[styles.chartCaption, { color: colors.textSecondary }]}>
				Бутылочка по дням (смесь / сцеженное)
			</Text>
			<SimpleDayBarChart
				points={report.dailySeries.map((d) => ({
					id: `${d.date}-f`,
					label: d.date.slice(8),
					value: d.formulaMl,
				}))}
				secondaryPoints={report.dailySeries.map((d) => ({
					id: `${d.date}-e`,
					label: d.date.slice(8),
					value: d.expressedMilkMl,
				}))}
				emptyLabel="Нет данных по бутылочке"
			/>
		</Collapsible>
	)
}

function DiaperSection ({
	report,
	colors,
}: {
	report: PeriodReportData
	colors: ThemeSlice
}) {
	const [open, setOpen] = useState(false)
	const d = report.diapers
	if (!d.hasAnyData) {
		return (
			<Collapsible
				title="Подгузники"
				open={open}
				onToggle={() => setOpen((v) => !v)}
				colors={colors}
			>
				<Text style={{ color: colors.textMuted }}>
					Недостаточно данных за этот период
				</Text>
			</Collapsible>
		)
	}
	return (
		<Collapsible
			title="Подгузники"
			open={open}
			onToggle={() => setOpen((v) => !v)}
			colors={colors}
		>
			<StatLine
				text={`В среднем ${formatAverage(d.averagePerDay)} в день`}
				colors={colors}
			/>
			<StatLine text={`Всего: ${d.total}`} colors={colors} />
			<StatLine
				text={`Мокрые: ${d.wet} · Грязные: ${d.dirty} · Оба: ${d.both} · Сухие: ${d.dry}`}
				colors={colors}
			/>
			<SimpleDayBarChart
				points={report.dailySeries.map((day) => ({
					id: day.date,
					label: day.date.slice(8),
					value: day.diaperTotal,
				}))}
			/>
		</Collapsible>
	)
}

function GrowthSection ({
	report,
	colors,
}: {
	report: PeriodReportData
	colors: ThemeSlice
}) {
	const [open, setOpen] = useState(false)
	const g = report.growth
	const points = buildGrowthChartPoints(g.measurementsInPeriod, 'weight')
	return (
		<Collapsible
			title="Рост"
			open={open}
			onToggle={() => setOpen((v) => !v)}
			colors={colors}
		>
			{!g.hasAnyData ? (
				<Text style={{ color: colors.textMuted }}>
					Недостаточно данных за этот период
				</Text>
			) : (
				<>
					<StatLine
						text={
							g.latestWeightGrams != null
								? `Вес: ${formatWeightKg(g.latestWeightGrams)}`
								: 'Вес: —'
						}
						colors={colors}
					/>
					{g.weightDeltaGrams != null ? (
						<StatLine
							text={`Изменение веса: ${formatSignedGrams(g.weightDeltaGrams)}`}
							colors={colors}
						/>
					) : null}
					<StatLine
						text={
							g.latestHeightMm != null
								? `Рост: ${formatLengthCm(g.latestHeightMm)}`
								: 'Рост: —'
						}
						colors={colors}
					/>
					{g.heightDeltaMm != null ? (
						<StatLine
							text={`Изменение роста: ${formatSignedMm(g.heightDeltaMm)}`}
							colors={colors}
						/>
					) : null}
					<StatLine
						text={
							g.latestHeadMm != null
								? `Голова: ${formatLengthCm(g.latestHeadMm)}`
								: 'Голова: —'
						}
						colors={colors}
					/>
					{g.headDeltaMm != null ? (
						<StatLine
							text={`Изменение окружности: ${formatSignedMm(g.headDeltaMm)}`}
							colors={colors}
						/>
					) : null}
					{points.length > 0 ? (
						<>
							<Text
								style={[
									styles.chartCaption,
									{ color: colors.textSecondary },
								]}
							>
								Вес за период
							</Text>
							<SimpleGrowthChart points={points} unitSuffix="кг" />
						</>
					) : null}
				</>
			)}
		</Collapsible>
	)
}

function HealthSection ({
	report,
	colors,
}: {
	report: PeriodReportData
	colors: ThemeSlice
}) {
	const [open, setOpen] = useState(false)
	const h = report.health
	return (
		<Collapsible
			title="Здоровье"
			open={open}
			onToggle={() => setOpen((v) => !v)}
			colors={colors}
		>
			{!h.hasAnyData ? (
				<Text style={{ color: colors.textMuted }}>
					Недостаточно данных за этот период
				</Text>
			) : (
				<>
					<StatLine
						text={`Температура: ${h.temperatureCount} измерений`}
						colors={colors}
					/>
					{h.temperatureMin != null && h.temperatureMax != null ? (
						<StatLine
							text={`Диапазон: ${formatTemperatureCelsius(h.temperatureMin).replace(' °C', '')}–${formatTemperatureCelsius(h.temperatureMax)}`}
							colors={colors}
						/>
					) : null}
					<StatLine text={`Симптомов: ${h.symptomsCount}`} colors={colors} />
					<StatLine
						text={`Лекарств: ${h.medicineIntakes} приёмов`}
						colors={colors}
					/>
					<StatLine
						text={`Визитов к врачу: ${h.doctorVisits}`}
						colors={colors}
					/>
				</>
			)}
		</Collapsible>
	)
}

type ThemeSlice = {
	text: string
	textSecondary: string
	textMuted: string
	surface: string
	border: string
	primarySoft: string
}

function Collapsible ({
	title,
	open,
	onToggle,
	children,
	colors,
}: {
	title: string
	open: boolean
	onToggle: () => void
	children: ReactNode
	colors: ThemeSlice
}) {
	return (
		<View
			style={[
				styles.section,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
		>
			<Pressable onPress={onToggle} style={styles.sectionHeader}>
				<Text style={[styles.sectionTitle, { color: colors.text }]}>
					{title}
				</Text>
				<Text style={{ color: colors.textMuted }}>{open ? '▾' : '▸'}</Text>
			</Pressable>
			{open ? <View style={styles.sectionBody}>{children}</View> : null}
		</View>
	)
}

function StatLine ({
	text,
	colors,
}: {
	text: string
	colors: { text: string }
}) {
	return (
		<Text style={[styles.statLine, { color: colors.text }]}>{text}</Text>
	)
}

function formatAverage (value: number): string {
	if (Number.isInteger(value)) {
		return String(value)
	}
	return value.toFixed(1).replace('.', ',')
}

function formatSignedGrams (grams: number): string {
	const sign = grams > 0 ? '+' : ''
	return `${sign}${grams} г`
}

function formatSignedMm (mm: number): string {
	const cm = mm / 10
	const sign = cm > 0 ? '+' : ''
	const text = Number.isInteger(cm)
		? String(cm)
		: cm.toFixed(1).replace('.', ',')
	return `${sign}${text} см`
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
		gap: spacing.md,
	},
	periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	periodChip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	softLoad: { ...typography.caption },
	section: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		overflow: 'hidden',
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: spacing.md,
	},
	sectionTitle: { ...typography.subtitle },
	sectionBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 4 },
	statLine: { ...typography.body },
	chartCaption: { ...typography.caption, marginTop: spacing.sm },
	exportLink: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		gap: 2,
	},
})
