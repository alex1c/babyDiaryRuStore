/**
 * Quick share summary — period pick → preview → system share sheet.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ReportPeriodControls } from '@/src/components/ReportPeriodControls'
import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { addLocalDays } from '@/src/domain/statsPeriod'
import {
	validateCustomReportRange,
	type ReportPeriodPreset,
} from '@/src/domain/reportPeriod'
import { formatShareSummaryText } from '@/src/domain/shareSummaryText'
import { loadPeriodReportBundle } from '@/src/presentation/loadReportBundle'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ShareSummaryScreen () {
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
		milestones,
	} = useDatabase()

	const today = toLocalDateOnly()
	const [preset, setPreset] = useState<ReportPeriodPreset>('today')
	const [customStart, setCustomStart] = useState(addLocalDays(today, -6))
	const [customEnd, setCustomEnd] = useState(today)
	const [preview, setPreview] = useState('')
	const [loading, setLoading] = useState(true)
	const [sharing, setSharing] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (
			!activeChild ||
			!sleep ||
			!feeding ||
			!diaper ||
			!growth ||
			!quickEvents ||
			!symptoms ||
			!doctorVisits ||
			!milestones
		) {
			setLoading(false)
			return
		}
		if (preset === 'custom') {
			const err = validateCustomReportRange(customStart, customEnd, today)
			if (err) {
				setError(err)
				setPreview('')
				setLoading(false)
				return
			}
		}
		setLoading(true)
		setError(null)
		try {
			const bundle = await loadPeriodReportBundle(
				{
					sleep,
					feeding,
					diaper,
					growth,
					quickEvents,
					symptoms,
					doctorVisits,
					milestones,
				},
				activeChild,
				preset,
				{
					today,
					custom:
						preset === 'custom'
							? { startDate: customStart, endDate: customEnd }
							: null,
				},
			)
			setPreview(
				formatShareSummaryText({
					report: bundle.report,
					period: bundle.period,
					health: bundle.health,
					today,
				}),
			)
		} catch (err) {
			logger.error('share summary load failed', err)
			setError('Не удалось загрузить сводку')
			setPreview('')
		} finally {
			setLoading(false)
		}
	}, [
		activeChild,
		sleep,
		feeding,
		diaper,
		growth,
		quickEvents,
		symptoms,
		doctorVisits,
		milestones,
		preset,
		customStart,
		customEnd,
		today,
	])

	useFocusEffect(
		useCallback(() => {
			void refresh()
		}, [refresh]),
	)

	const handleShare = async (): Promise<void> => {
		if (!preview || sharing) {
			return
		}
		setSharing(true)
		setError(null)
		try {
			await Share.share({ message: preview, title: 'Сводка дневника' })
			// Kind enum only — never the shared text body.
			trackAnalyticsEvent(ANALYTICS_EVENTS.reportShared, {
				report_kind: 'share_text',
			})
		} catch (err) {
			logger.error('share failed', err)
			setError('Не удалось открыть окно «Поделиться»')
		} finally {
			setSharing(false)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<ReportPeriodControls
					preset={preset}
					onPresetChange={setPreset}
					customStart={customStart}
					customEnd={customEnd}
					onCustomStartChange={setCustomStart}
					onCustomEndChange={setCustomEnd}
					hideNinety
				/>

				{loading ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					<View
						style={[
							styles.preview,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Text style={[styles.previewText, { color: colors.text }]}>
							{preview || 'Недостаточно данных за этот период'}
						</Text>
					</View>
				)}

				{error ? (
					<Text style={{ color: colors.danger, ...typography.caption }}>
						{error}
					</Text>
				) : null}

				<Pressable
					onPress={() => void handleShare()}
					disabled={!preview || sharing || loading}
					style={[
						styles.cta,
						{
							backgroundColor: colors.primary,
							opacity: !preview || sharing || loading ? 0.5 : 1,
						},
					]}
				>
					<Text style={styles.ctaText}>
						{sharing ? 'Открываем…' : 'Поделиться'}
					</Text>
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
	preview: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		minHeight: 160,
	},
	previewText: { ...typography.body, lineHeight: 22 },
	cta: {
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
	},
	ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
