/**
 * Diary timeline — sleep events (other types arrive later).
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { sleepTypeLabel } from '@/src/domain/sleepType'
import type { SleepEvent } from '@/src/models/sleep'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import {
	durationBetweenMs,
	formatDurationMs,
} from '@/src/utils/durationFormat'
import { formatLocalTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

function formatSleepRow (sleep: SleepEvent, nowMs: number): string {
	const start = formatLocalTime(sleep.startAt)
	const end =
		sleep.endAt == null ? 'сейчас' : formatLocalTime(sleep.endAt)
	const dur = formatDurationMs(
		durationBetweenMs(sleep.startAt, sleep.endAt, nowMs),
	)
	const kind = sleepTypeLabel(sleep.sleepType)
	return `${start}–${end}  Сон · ${dur} · ${kind}`
}

export default function DiaryScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild, loading: childLoading } = useActiveChild()
	const { sleep } = useDatabase()
	const [rows, setRows] = useState<SleepEvent[]>([])
	const [loading, setLoading] = useState(true)
	const [nowMs] = useState(() => Date.now())

	const refresh = useCallback(async () => {
		if (!sleep || !activeChild) {
			setRows([])
			setLoading(false)
			return
		}
		try {
			const list = await sleep.listByChild(activeChild.id, 100)
			setRows(list)
		} catch (error) {
			logger.error('Failed to load diary sleeps', error)
		} finally {
			setLoading(false)
		}
	}, [sleep, activeChild])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			void refresh()
		}, [refresh]),
	)

	if (childLoading || loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<FlatList
				data={rows}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.content}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							Сон малыша. Нажмите запись, чтобы исправить.
						</Text>
						<Pressable
							onPress={() => router.push('/sleep/manual' as Href)}
							style={[
								styles.addBtn,
								{ backgroundColor: colors.primarySoft, borderColor: colors.border },
							]}
							accessibilityRole="button"
							accessibilityLabel="Добавить сон"
						>
							<Text style={{ color: colors.primary, fontWeight: '700' }}>
								Добавить сон
							</Text>
						</Pressable>
					</View>
				}
				ListEmptyComponent={
					<Text style={[styles.empty, { color: colors.textMuted }]}>
						Здесь появятся записи о сне малыша
					</Text>
				}
				renderItem={({ item }) => (
					<Pressable
						onPress={() => router.push(`/sleep/${item.id}` as Href)}
						style={[
							styles.row,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel={formatSleepRow(item, nowMs)}
					>
						<Text style={[styles.rowText, { color: colors.text }]}>
							{formatSleepRow(item, nowMs)}
						</Text>
						{item.endAt == null ? (
							<Text style={{ color: colors.primary, marginTop: 4 }}>
								Активный
							</Text>
						) : null}
					</Pressable>
				)}
				ListFooterComponent={<BannerAdSlot />}
			/>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xl },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	header: { marginBottom: spacing.md },
	lead: { ...typography.body, marginBottom: spacing.sm },
	addBtn: {
		minHeight: 48,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	empty: {
		...typography.body,
		textAlign: 'center',
		marginTop: spacing.lg,
	},
	row: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		minHeight: 56,
		justifyContent: 'center',
	},
	rowText: {
		...typography.body,
		flexShrink: 1,
	},
})
