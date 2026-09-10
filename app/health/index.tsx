/**
 * Health hub — observations only (no diagnoses).
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
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { HEALTH_DISCLAIMER } from '@/src/domain/healthLabels'
import { formatTemperatureCelsius } from '@/src/domain/quickEventLabels'
import { formatMeasuredAgo } from '@/src/presentation/growthFormat'
import { formatLocalTime } from '@/src/utils/datetime'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents, symptoms, doctorVisits } = useDatabase()
	const [loading, setLoading] = useState(true)
	const [lastTemp, setLastTemp] = useState<string | null>(null)
	const [activeCount, setActiveCount] = useState(0)
	const [activeLines, setActiveLines] = useState<string[]>([])
	const [lastMed, setLastMed] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (!activeChild || !quickEvents || !symptoms) {
			setLoading(false)
			return
		}
		try {
			const temps = await quickEvents.listTemperaturesByChild(
				activeChild.id,
				1,
			)
			const t = temps[0]
			setLastTemp(
				t
					? `${formatTemperatureCelsius(t.celsius)} · ${formatMeasuredAgo(t.startLocalDate)} ${formatLocalTime(t.startAt)}`
					: null,
			)
			const active = await symptoms.listActive(activeChild.id)
			setActiveCount(active.length)
			setActiveLines(
				active.slice(0, 4).map((s) => {
					const ago = formatMeasuredAgo(s.startLocalDate)
					return `${s.title} · ${ago === 'Сегодня' ? 'сегодня' : ago}`
				}),
			)
			const meds = await quickEvents.listMedicinesByChild(activeChild.id, 1)
			const m = meds[0]
			setLastMed(
				m
					? `${m.name}${m.doseText ? ` · ${m.doseText}${m.unit ? ` ${m.unit}` : ''}` : ''} · ${formatLocalTime(m.startAt)}`
					: null,
			)
			void doctorVisits
		} catch (err) {
			logger.error('health hub load failed', err)
		} finally {
			setLoading(false)
		}
	}, [activeChild, quickEvents, symptoms, doctorVisits])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.disclaimer, { color: colors.textMuted }]}>
					{HEALTH_DISCLAIMER}
				</Text>

				{loading ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					<>
						<View
							style={[
								styles.card,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text
								style={[styles.cardLabel, { color: colors.textSecondary }]}
							>
								Последняя температура
							</Text>
							<Text style={[styles.cardValue, { color: colors.text }]}>
								{lastTemp ?? 'Добавьте первую запись ниже'}
							</Text>
						</View>
						<View
							style={[
								styles.card,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text
								style={[styles.cardLabel, { color: colors.textSecondary }]}
							>
								Активные симптомы
							</Text>
							<Text style={[styles.cardValue, { color: colors.text }]}>
								{activeCount === 0 ? 'Нет активных симптомов' : activeCount}
							</Text>
							{activeLines.map((line) => (
								<Text
									key={line}
									style={{ color: colors.textSecondary, ...typography.caption }}
								>
									{line}
								</Text>
							))}
						</View>
						<View
							style={[
								styles.card,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text
								style={[styles.cardLabel, { color: colors.textSecondary }]}
							>
								Последнее лекарство
							</Text>
							<Text style={[styles.cardValue, { color: colors.text }]}>
								{lastMed ?? 'Добавьте первую запись ниже'}
							</Text>
						</View>
					</>
				)}

				<Section
					title="Температура"
					onPress={() => router.push('/health/temperature' as Href)}
					colors={colors}
				/>
				<Section
					title="Симптомы"
					onPress={() => router.push('/health/symptom' as Href)}
					colors={colors}
				/>
				<Section
					title="Лекарства и витамины"
					onPress={() => router.push('/health/medicine' as Href)}
					colors={colors}
				/>
				<Section
					title="Врачи"
					onPress={() => router.push('/health/visit' as Href)}
					colors={colors}
				/>
				<Section
					title="Документы"
					onPress={() => router.push('/health/documents' as Href)}
					colors={colors}
				/>
				<Section
					title="История"
					onPress={() => router.push('/health/history' as Href)}
					colors={colors}
				/>
			</ScrollView>
		</SafeAreaView>
	)
}

function Section ({
	title,
	onPress,
	colors,
}: {
	title: string
	onPress: () => void
	colors: { surface: string; border: string; text: string; textMuted: string }
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.row,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
		>
			<Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
			<Text style={{ color: colors.textMuted }}>›</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
	disclaimer: { ...typography.caption, marginBottom: spacing.sm },
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		gap: 4,
	},
	cardLabel: { ...typography.caption },
	cardValue: { ...typography.subtitle, fontSize: 16 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		minHeight: 52,
	},
	rowTitle: { ...typography.body, fontWeight: '600' },
})
