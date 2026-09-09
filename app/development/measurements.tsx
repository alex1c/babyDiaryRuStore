/**
 * Growth measurement history list.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	formatLengthCm,
	formatWeightKg,
} from '@/src/domain/growthLabels'
import type { GrowthMeasurement } from '@/src/models/growth'
import { formatRuLongDate } from '@/src/presentation/growthFormat'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function MeasurementsHistoryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { growth } = useDatabase()
	const [rows, setRows] = useState<GrowthMeasurement[]>([])
	const [loading, setLoading] = useState(true)

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				if (!growth || !activeChild) {
					setLoading(false)
					return
				}
				const list = await growth.listByChild(activeChild.id)
				setRows(list)
				setLoading(false)
			})()
		}, [growth, activeChild]),
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			{loading ? (
				<ActivityIndicator color={colors.primary} style={styles.loader} />
			) : (
				<FlatList
					data={rows}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						<Text style={{ color: colors.textMuted, ...typography.body }}>
							Пока нет измерений
						</Text>
					}
					renderItem={({ item }) => (
						<Pressable
							onPress={() =>
								router.push(
									`/development/measure?id=${item.id}` as Href,
								)
							}
							style={[
								styles.row,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={[styles.line, { color: colors.text }]}>
								{formatHistoryLine(item)}
							</Text>
						</Pressable>
					)}
				/>
			)}
		</SafeAreaView>
	)
}

function formatHistoryLine (m: GrowthMeasurement): string {
	const parts: string[] = [formatRuLongDate(m.measuredLocalDate)]
	if (m.weightGrams != null) {
		parts.push(formatWeightKg(m.weightGrams))
	}
	if (m.heightMm != null) {
		parts.push(formatLengthCm(m.heightMm))
	}
	if (m.headCircumferenceMm != null) {
		parts.push(formatLengthCm(m.headCircumferenceMm))
	}
	return parts.join(' · ')
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	loader: { marginTop: spacing.xl },
	list: { padding: spacing.md, gap: spacing.sm },
	row: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
	},
	line: { ...typography.body },
})
