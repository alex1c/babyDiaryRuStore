/**
 * Period PDF — section selection → generate → ready screen.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ReportPeriodControls } from '@/src/components/ReportPeriodControls'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	DEFAULT_PDF_SECTIONS,
	PDF_SECTION_OPTIONS,
	hasAnyPdfSection,
	type PdfReportSections,
} from '@/src/domain/pdfReportOptions'
import { buildPeriodPdfHtml } from '@/src/domain/pdfReportHtml'
import {
	validateCustomReportRange,
	type ReportPeriodPreset,
} from '@/src/domain/reportPeriod'
import { addLocalDays } from '@/src/domain/statsPeriod'
import { loadPeriodReportBundle } from '@/src/presentation/loadReportBundle'
import { generatePeriodPdfFile } from '@/src/services/pdfGenerate'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function PdfReportScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
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
	const [preset, setPreset] = useState<ReportPeriodPreset>('7')
	const [customStart, setCustomStart] = useState(addLocalDays(today, -6))
	const [customEnd, setCustomEnd] = useState(today)
	const [sections, setSections] = useState<PdfReportSections>({
		...DEFAULT_PDF_SECTIONS,
	})
	const [generating, setGenerating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const toggleSection = (key: keyof PdfReportSections): void => {
		setSections((prev) => ({ ...prev, [key]: !prev[key] }))
	}

	const handleGenerate = useCallback(async () => {
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
			setError('Нет активного ребёнка или база ещё не готова')
			return
		}
		if (!hasAnyPdfSection(sections)) {
			setError('Выберите хотя бы один раздел')
			return
		}
		if (preset === 'custom') {
			const err = validateCustomReportRange(customStart, customEnd, today)
			if (err) {
				setError(err)
				return
			}
		}

		setGenerating(true)
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

			const html = buildPeriodPdfHtml({
				report: bundle.report,
				period: bundle.period,
				sections,
				health: bundle.health,
				chronology: bundle.chronology,
				milestones: bundle.milestones,
				generatedAtDate: today,
			})

			const result = await generatePeriodPdfFile({
				html,
				startDate: bundle.period.startDate,
				endDate: bundle.period.endDate,
			})

			router.push({
				pathname: '/reports/ready',
				params: {
					uri: result.uri,
					fileName: result.fileName,
					fresh: result.isFreshGeneration ? '1' : '0',
				},
			} as Href)
		} catch (err) {
			logger.error('pdf generation failed', err)
			setError(
				'Не удалось создать PDF. Проверьте данные и попробуйте ещё раз.',
			)
		} finally {
			setGenerating(false)
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
		sections,
		preset,
		customStart,
		customEnd,
		today,
		router,
	])

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Период отчёта
				</Text>
				<ReportPeriodControls
					preset={preset}
					onPresetChange={setPreset}
					customStart={customStart}
					customEnd={customEnd}
					onCustomStartChange={setCustomStart}
					onCustomEndChange={setCustomEnd}
				/>

				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Что включить
				</Text>
				<View
					style={[
						styles.box,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
				>
					{PDF_SECTION_OPTIONS.map((opt) => (
						<Pressable
							key={opt.key}
							onPress={() => toggleSection(opt.key)}
							style={styles.checkRow}
							accessibilityRole="checkbox"
							accessibilityState={{ checked: sections[opt.key] }}
						>
							<Text style={{ color: colors.primary, fontSize: 18 }}>
								{sections[opt.key] ? '☑' : '☐'}
							</Text>
							<Text style={{ color: colors.text, ...typography.body }}>
								{opt.label}
							</Text>
						</Pressable>
					))}
				</View>

				{error ? (
					<Text style={{ color: colors.danger, ...typography.body }}>{error}</Text>
				) : null}

				<Pressable
					onPress={() => void handleGenerate()}
					disabled={generating}
					style={[
						styles.cta,
						{
							backgroundColor: colors.primary,
							opacity: generating ? 0.6 : 1,
						},
					]}
				>
					{generating ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text style={styles.ctaText}>Создать PDF</Text>
					)}
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
	label: { ...typography.caption },
	box: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
	},
	checkRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.xs,
	},
	cta: {
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
		minHeight: 48,
		justifyContent: 'center',
	},
	ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
