/**
 * Live breastfeeding session card — side switch / finish / note.
 * Elapsed time is derived from SQLite timestamps, not accumulated React state.
 */

import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'

import { breastfeedingLiveTotals } from '../domain/breastfeedingDuration'
import { breastSideLabel } from '../domain/feedingLabels'
import type { BreastfeedingEvent, BreastSide } from '../models/feeding'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'
import { formatDurationMs, formatElapsedHms } from '../utils/durationFormat'

interface ActiveBreastfeedingCardProps {
	event: BreastfeedingEvent
	busy: boolean
	onSwitchSide: (side: BreastSide) => void
	onFinish: () => void
	onAddNote: () => void
}

export function ActiveBreastfeedingCard ({
	event,
	busy,
	onSwitchSide,
	onFinish,
	onAddNote,
}: ActiveBreastfeedingCardProps) {
	const { colors } = useAppTheme()
	const [nowMs, setNowMs] = useState(() => Date.now())

	useEffect(() => {
		const id = setInterval(() => setNowMs(Date.now()), 1000)
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				setNowMs(Date.now())
			}
		})
		return () => {
			clearInterval(id)
			sub.remove()
		}
	}, [])

	const totals = breastfeedingLiveTotals(event, nowMs)
	const otherSide: BreastSide = event.lastSide === 'left' ? 'right' : 'left'
	const clock = formatElapsedHms(event.startAt, nowMs)

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.surface, borderColor: colors.border },
			]}
			accessibilityRole="summary"
			accessibilityLabel={`Кормление. ${breastSideLabel(event.lastSide)}. ${clock}`}
		>
			<Text style={[styles.title, { color: colors.text }]}>Кормление</Text>
			<Text style={[styles.side, { color: colors.primary }]}>
				{breastSideLabel(event.lastSide)}
			</Text>
			<Text style={[styles.clock, { color: colors.text }]}>{clock}</Text>
			<Text style={[styles.sides, { color: colors.textSecondary }]}>
				Левая {formatDurationMs(totals.leftSeconds * 1000)}
				{' · '}
				Правая {formatDurationMs(totals.rightSeconds * 1000)}
			</Text>

			<View style={styles.actions}>
				<Pressable
					onPress={() => onSwitchSide(otherSide)}
					disabled={busy}
					style={[
						styles.secondary,
						{
							borderColor: colors.border,
							backgroundColor: colors.primarySoft,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel={`Переключить на ${breastSideLabel(otherSide)}`}
				>
					<Text style={[styles.secondaryText, { color: colors.primary }]}>
						{breastSideLabel(otherSide)}
					</Text>
				</Pressable>
				<Pressable
					onPress={onFinish}
					disabled={busy}
					style={[
						styles.primary,
						{
							backgroundColor: busy
								? colors.surfaceMuted
								: colors.primary,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="Завершить кормление"
				>
					<Text style={styles.primaryText}>Завершить</Text>
				</Pressable>
			</View>
			<Pressable
				onPress={onAddNote}
				disabled={busy}
				style={styles.noteLink}
				accessibilityRole="button"
				accessibilityLabel="Добавить заметку"
			>
				<Text style={{ color: colors.textMuted }}>Добавить заметку</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.lg,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.xs,
	},
	side: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	clock: {
		fontSize: 36,
		fontWeight: '700',
		letterSpacing: 1,
		marginBottom: spacing.sm,
	},
	sides: {
		...typography.caption,
		marginBottom: spacing.md,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	primary: {
		flex: 1,
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	primaryText: {
		...typography.button,
		color: '#FFFFFF',
	},
	secondary: {
		flex: 1,
		minHeight: 52,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryText: {
		...typography.button,
	},
	noteLink: {
		minHeight: 44,
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
})
