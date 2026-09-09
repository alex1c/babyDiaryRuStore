/**
 * Development tab — growth chronicle: measurements, milestones, teeth, moments.
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
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { ManagedImage } from '@/src/components/ManagedImage'
import { SimpleGrowthChart } from '@/src/components/SimpleGrowthChart'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { buildGrowthChartPoints } from '@/src/domain/growthCharts'
import {
	formatLengthCm,
	formatWeightKg,
} from '@/src/domain/growthLabels'
import { ageAtDateLabel } from '@/src/domain/firstYearFoundation'
import { toothLabel } from '@/src/domain/developmentLabels'
import type { MilestoneEvent, MomentRecord, ToothRecord } from '@/src/models/development'
import type { GrowthMeasurement } from '@/src/models/growth'
import {
	formatMeasuredAgo,
	formatRuLongDate,
} from '@/src/presentation/growthFormat'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function DevelopmentScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { growth, milestones, teeth, moments } = useDatabase()

	const [loading, setLoading] = useState(true)
	const [history, setHistory] = useState<GrowthMeasurement[]>([])
	const [latest, setLatest] = useState<{
		weight: GrowthMeasurement | null
		height: GrowthMeasurement | null
		head: GrowthMeasurement | null
	}>({ weight: null, height: null, head: null })
	const [milestoneList, setMilestoneList] = useState<MilestoneEvent[]>([])
	const [toothList, setToothList] = useState<ToothRecord[]>([])
	const [momentList, setMomentList] = useState<MomentRecord[]>([])

	const refresh = useCallback(async () => {
		if (!activeChild || !growth || !milestones || !teeth || !moments) {
			setLoading(false)
			return
		}
		try {
			const list = await growth.listByChild(activeChild.id)
			const metrics = await growth.findLatestMetrics(activeChild.id)
			const ms = await milestones.listByChild(activeChild.id, 40)
			const ts = await teeth.listByChild(activeChild.id)
			const moms = await moments.listByChild(activeChild.id, 60)
			setHistory(list)
			setLatest(metrics)
			setMilestoneList(ms)
			setToothList(ts)
			setMomentList(moms)
		} catch (err) {
			logger.error('Failed to load development', err)
		} finally {
			setLoading(false)
		}
	}, [activeChild, growth, milestones, teeth, moments])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	const hasAnyMeasure = Boolean(
		latest.weight || latest.height || latest.head,
	)

	const weightPoints = buildGrowthChartPoints(history, 'weight')
	const heightPoints = buildGrowthChartPoints(history, 'height')
	const headPoints = buildGrowthChartPoints(history, 'head')

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Летопись роста и важных моментов — не медицинская карта.
				</Text>

				{loading ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					<>
						<Section title="Последние измерения" colors={colors}>
							{!hasAnyMeasure ? (
								<>
									<Text
										style={[
											styles.empty,
											{ color: colors.textMuted },
										]}
									>
										Пока нет измерений
									</Text>
									<PrimaryButton
										label="Добавить измерение"
										onPress={() =>
											router.push(
												'/development/measure' as Href,
											)
										}
										colors={colors}
									/>
								</>
							) : (
								<>
									<View style={styles.metricsRow}>
										<MetricCard
											label="Вес"
											value={
												latest.weight?.weightGrams != null
													? formatWeightKg(
															latest.weight.weightGrams,
														)
													: '—'
											}
											hint={
												latest.weight
													? formatMeasuredAgo(
															latest.weight.measuredLocalDate,
														)
													: undefined
											}
											colors={colors}
										/>
										<MetricCard
											label="Рост"
											value={
												latest.height?.heightMm != null
													? formatLengthCm(
															latest.height.heightMm,
														)
													: '—'
											}
											hint={
												latest.height
													? formatMeasuredAgo(
															latest.height.measuredLocalDate,
														)
													: undefined
											}
											colors={colors}
										/>
										<MetricCard
											label="Голова"
											value={
												latest.head?.headCircumferenceMm !=
												null
													? formatLengthCm(
															latest.head
																.headCircumferenceMm,
														)
													: '—'
											}
											hint={
												latest.head
													? formatMeasuredAgo(
															latest.head.measuredLocalDate,
														)
													: undefined
											}
											colors={colors}
										/>
									</View>
									<PrimaryButton
										label="Добавить измерение"
										onPress={() =>
											router.push(
												'/development/measure' as Href,
											)
										}
										colors={colors}
									/>
									<LinkButton
										label="История измерений"
										onPress={() =>
											router.push(
												'/development/measurements' as Href,
											)
										}
										colors={colors}
									/>
								</>
							)}
						</Section>

						<Section title="Динамика" colors={colors}>
							<Text
								style={[
									styles.chartLabel,
									{ color: colors.textSecondary },
								]}
							>
								Вес
							</Text>
							<SimpleGrowthChart
								points={weightPoints}
								unitSuffix="кг"
							/>
							<Text
								style={[
									styles.chartLabel,
									{ color: colors.textSecondary },
								]}
							>
								Рост
							</Text>
							<SimpleGrowthChart
								points={heightPoints}
								unitSuffix="см"
							/>
							<Text
								style={[
									styles.chartLabel,
									{ color: colors.textSecondary },
								]}
							>
								Окружность головы
							</Text>
							<SimpleGrowthChart
								points={headPoints}
								unitSuffix="см"
							/>
						</Section>

						<Section title="Достижения" colors={colors}>
							<PrimaryButton
								label="+ Добавить достижение"
								onPress={() =>
									router.push(
										'/development/milestone' as Href,
									)
								}
								colors={colors}
							/>
							{milestoneList.length === 0 ? (
								<Text
									style={[
										styles.empty,
										{ color: colors.textMuted },
									]}
								>
									Пока нет достижений
								</Text>
							) : (
								milestoneList.slice(0, 8).map((m) => (
									<Pressable
										key={m.id}
										onPress={() =>
											router.push(
												`/development/milestone/${m.id}` as Href,
											)
										}
										style={[
											styles.card,
											{
												backgroundColor: colors.surface,
												borderColor: colors.border,
											},
										]}
									>
										{m.photoUri ? (
											<ManagedImage
												uri={m.photoUri}
												style={styles.thumb}
											/>
										) : null}
										<View style={styles.cardBody}>
											<Text
												style={[
													styles.cardTitle,
													{ color: colors.text },
												]}
											>
												{m.title}
											</Text>
											{activeChild ? (
												<Text
													style={{
														color: colors.textSecondary,
														...typography.caption,
													}}
												>
													{ageAtDateLabel(
														activeChild.birthDate,
														m.startLocalDate,
													)}
												</Text>
											) : null}
											<Text
												style={{
													color: colors.textMuted,
													...typography.caption,
												}}
											>
												{formatRuLongDate(
													m.startLocalDate,
												)}
											</Text>
										</View>
									</Pressable>
								))
							)}
						</Section>

						<Section title="Зубы" colors={colors}>
							<PrimaryButton
								label="+ Отметить зуб"
								onPress={() =>
									router.push('/development/tooth' as Href)
								}
								colors={colors}
							/>
							{toothList.length === 0 ? (
								<Text
									style={[
										styles.empty,
										{ color: colors.textMuted },
									]}
								>
									Пока нет отмеченных зубов
								</Text>
							) : (
								toothList.slice(0, 10).map((t) => (
									<Pressable
										key={t.id}
										onPress={() =>
											router.push(
												`/development/tooth?id=${t.id}` as Href,
											)
										}
										style={[
											styles.listRow,
											{ borderColor: colors.border },
										]}
									>
										<Text
											style={[
												styles.cardTitle,
												{ color: colors.text },
											]}
										>
											{toothLabel(t.toothKey)}
										</Text>
										<Text
											style={{
												color: colors.textMuted,
												...typography.caption,
											}}
										>
											{formatRuLongDate(t.eruptedAt)}
										</Text>
									</Pressable>
								))
							)}
						</Section>

						<Section title="Моменты" colors={colors}>
							<PrimaryButton
								label="+ Добавить момент"
								onPress={() =>
									router.push('/development/moment' as Href)
								}
								colors={colors}
							/>
							{momentList.length === 0 ? (
								<Text
									style={[
										styles.empty,
										{ color: colors.textMuted },
									]}
								>
									Пока нет моментов
								</Text>
							) : (
								<View style={styles.grid}>
									{momentList.map((m) => (
										<Pressable
											key={m.id}
											style={styles.gridItem}
											onPress={() =>
												router.push(
													`/development/moment/${m.id}` as Href,
												)
											}
										>
											<ManagedImage
												uri={m.photoUri}
												style={styles.gridPhoto}
											/>
											<Text
												style={[
													styles.gridDate,
													{ color: colors.textMuted },
												]}
												numberOfLines={1}
											>
												{formatRuLongDate(
													m.takenLocalDate,
												)}
											</Text>
											{m.title ? (
												<Text
													style={[
														styles.gridTitle,
														{ color: colors.text },
													]}
													numberOfLines={2}
												>
													{m.title}
												</Text>
											) : null}
										</Pressable>
									))}
								</View>
							)}
						</Section>
					</>
				)}

				<BannerAdSlot />
			</ScrollView>
		</SafeAreaView>
	)
}

function Section ({
	title,
	children,
	colors,
}: {
	title: string
	children: ReactNode
	colors: { text: string }
}) {
	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.text }]}>
				{title}
			</Text>
			{children}
		</View>
	)
}

function MetricCard ({
	label,
	value,
	hint,
	colors,
}: {
	label: string
	value: string
	hint?: string
	colors: {
		surface: string
		border: string
		text: string
		textSecondary: string
		textMuted: string
	}
}) {
	return (
		<View
			style={[
				styles.metric,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
				},
			]}
		>
			<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<Text style={[styles.metricValue, { color: colors.text }]}>
				{value}
			</Text>
			{hint ? (
				<Text style={[styles.metricHint, { color: colors.textMuted }]}>
					{hint}
				</Text>
			) : null}
		</View>
	)
}

function PrimaryButton ({
	label,
	onPress,
	colors,
}: {
	label: string
	onPress: () => void
	colors: { primary: string; surface: string }
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
		>
			<Text style={[styles.primaryBtnText, { color: colors.surface }]}>
				{label}
			</Text>
		</Pressable>
	)
}

function LinkButton ({
	label,
	onPress,
	colors,
}: {
	label: string
	onPress: () => void
	colors: { primary: string }
}) {
	return (
		<Pressable onPress={onPress} style={styles.linkBtn}>
			<Text style={[styles.linkBtnText, { color: colors.primary }]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
	lead: { ...typography.body, marginBottom: spacing.xs },
	section: { gap: spacing.sm },
	sectionTitle: { ...typography.subtitle },
	empty: { ...typography.body },
	metricsRow: { flexDirection: 'row', gap: spacing.sm },
	metric: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		gap: 2,
	},
	metricLabel: { ...typography.caption },
	metricValue: { ...typography.subtitle, fontSize: 16 },
	metricHint: { ...typography.caption, fontSize: 11 },
	chartLabel: { ...typography.caption, marginTop: spacing.sm },
	primaryBtn: {
		borderRadius: radii.md,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		alignItems: 'center',
	},
	primaryBtnText: { ...typography.body, fontWeight: '600' },
	linkBtn: { paddingVertical: spacing.xs },
	linkBtnText: { ...typography.body, fontWeight: '600' },
	card: {
		flexDirection: 'row',
		gap: spacing.sm,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		alignItems: 'center',
	},
	thumb: { width: 56, height: 56, borderRadius: radii.sm },
	cardBody: { flex: 1, gap: 2 },
	cardTitle: { ...typography.body, fontWeight: '600' },
	listRow: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingVertical: spacing.sm,
		gap: 2,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	gridItem: { width: '31%', gap: 4 },
	gridPhoto: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: radii.sm,
	},
	gridDate: { ...typography.caption, fontSize: 11 },
	gridTitle: { ...typography.caption },
})
