/**
 * First-year memorial preview (months 1–12). PDF album optional later.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	firstYearMonthHasContent,
	type FirstYearReportData,
} from '@/src/domain/firstYearReport'
import { milestoneTypeLabel } from '@/src/domain/developmentLabels'
import {
	formatLengthCm,
	formatWeightKg,
} from '@/src/domain/growthLabels'
import { formatRuLongDateWithYear } from '@/src/domain/reportPeriod'
import { loadFirstYearReport } from '@/src/presentation/loadFirstYearReport'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'
import { formatCountRu } from '@/src/utils/pluralRu'

export default function FirstYearPreviewScreen () {
	const { colors } = useAppTheme()
	const { activeChild } = useActiveChild()
	const { growth, milestones, teeth, moments } = useDatabase()
	const [data, setData] = useState<FirstYearReportData | null>(null)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		if (!activeChild || !growth || !milestones || !teeth || !moments) {
			setLoading(false)
			return
		}
		setLoading(true)
		try {
			const next = await loadFirstYearReport(
				{ growth, milestones, teeth, moments },
				activeChild,
			)
			setData(next)
		} catch (err) {
			logger.error('first year load failed', err)
			setData(null)
		} finally {
			setLoading(false)
		}
	}, [activeChild, growth, milestones, teeth, moments])

	useFocusEffect(
		useCallback(() => {
			void refresh()
		}, [refresh]),
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Предпросмотр альбома первого года. PDF-альбом можно будет создать
					позже; сейчас собраны месяцы, фото и достижения.
				</Text>

				{loading ? <ActivityIndicator color={colors.primary} /> : null}

				{!loading && data
					? data.months.map((month) => {
							const has = firstYearMonthHasContent(month)
							return (
								<View
									key={month.monthKey}
									style={[
										styles.card,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Text style={[styles.monthTitle, { color: colors.text }]}>
										{formatCountRu(month.monthIndex, 'месяц', 'месяца', 'месяцев')}
									</Text>
									<Text style={{ color: colors.textMuted, ...typography.caption }}>
										{formatRuLongDateWithYear(month.windowStart)} —{' '}
										{formatRuLongDateWithYear(month.windowEnd)}
									</Text>
									{!has ? (
										<Text
											style={{
												color: colors.textMuted,
												marginTop: spacing.sm,
											}}
										>
											Пока нет записей за этот месяц
										</Text>
									) : (
										<>
											{month.monthPhoto?.photoUri ? (
												<Image
													source={{ uri: month.monthPhoto.photoUri }}
													style={styles.photo}
												/>
											) : (
												<Text
													style={{
														color: colors.textMuted,
														marginTop: spacing.sm,
													}}
												>
													Фото месяца не выбрано
												</Text>
											)}
											{month.milestones.map((m) => (
												<Text
													key={m.id}
													style={{ color: colors.text, marginTop: 4 }}
												>
													• {m.title || milestoneTypeLabel(m.milestoneType)}
												</Text>
											))}
											{month.measurements.slice(0, 2).map((g) => (
												<Text
													key={g.id}
													style={{ color: colors.textSecondary, marginTop: 4 }}
												>
													Измерение:{' '}
													{[
														g.weightGrams != null
															? formatWeightKg(g.weightGrams)
															: null,
														g.heightMm != null
															? formatLengthCm(g.heightMm)
															: null,
													]
														.filter(Boolean)
														.join(' · ')}
												</Text>
											))}
											{month.teeth.length > 0 ? (
												<Text
													style={{ color: colors.textSecondary, marginTop: 4 }}
												>
													Зубов: {month.teeth.length}
												</Text>
											) : null}
										</>
									)}
								</View>
							)
						})
					: null}
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
	lead: { ...typography.body },
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
	},
	monthTitle: { ...typography.subtitle },
	photo: {
		width: '100%',
		height: 180,
		borderRadius: radii.sm,
		marginTop: spacing.sm,
		backgroundColor: '#eee',
	},
})
