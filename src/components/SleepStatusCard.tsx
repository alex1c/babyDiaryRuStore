/**
 * Sleep status card for Today — start / finish / wake window.
 * While sleeping, "Завершить сон" stays the dominant control.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { TodaySleepModel } from '../presentation/todaySleepModel'
import { useElapsedTimer } from '../hooks/useElapsedTimer'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface SleepStatusCardProps {
	model: TodaySleepModel
	busy: boolean
	onPrimary: () => void
	onSecondary: () => void
}

export function SleepStatusCard ({
	model,
	busy,
	onPrimary,
	onSecondary,
}: SleepStatusCardProps) {
	const { colors } = useAppTheme()
	const elapsed = useElapsedTimer(
		model.activeSleep?.startAt ?? null,
		model.mode === 'sleeping',
	)
	const isSleeping = model.mode === 'sleeping'

	const summary = isSleeping ? elapsed : model.statusSummary

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: isSleeping ? colors.primary : colors.border,
					borderWidth: isSleeping ? 2 : StyleSheet.hairlineWidth,
				},
			]}
			accessibilityRole="summary"
			accessibilityLabel={`${model.statusTitle}. ${summary}`}
		>
			<Text style={[styles.title, { color: colors.text }]}>
				{isSleeping ? 'Малыш спит' : model.statusTitle}
			</Text>
			<Text
				style={[
					styles.summary,
					{
						color:
							model.mode === 'empty'
								? colors.textMuted
								: colors.text,
					},
				]}
			>
				{summary}
			</Text>

			{model.mode === 'awake' && model.wakeGuideLabel ? (
				<View style={styles.guide}>
					<Text style={[styles.guideText, { color: colors.textSecondary }]}>
						{model.wakeGuideLabel}
					</Text>
					<Text style={[styles.disclaimer, { color: colors.textMuted }]}>
						{model.wakeGuideDisclaimer}
					</Text>
				</View>
			) : null}

			{model.mode === 'empty' ? (
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					Здесь появятся записи о сне малыша
				</Text>
			) : null}

			{/* Finish sleep takes the full row so it cannot hide behind secondary CTAs. */}
			<View style={[styles.actions, isSleeping && styles.actionsStacked]}>
				<Pressable
					onPress={onPrimary}
					disabled={busy}
					style={[
						styles.primary,
						isSleeping && styles.primaryDominant,
						{
							backgroundColor: busy
								? colors.surfaceMuted
								: colors.primary,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel={model.primaryCta}
					accessibilityState={{ busy, disabled: busy }}
				>
					<Text style={[styles.primaryText, { color: colors.onPrimary }]}>
						{model.primaryCta}
					</Text>
				</Pressable>
				{isSleeping ? (
					<Pressable
						onPress={onSecondary}
						disabled={busy}
						style={styles.secondaryLink}
						accessibilityRole="button"
						accessibilityLabel={model.secondaryCta}
					>
						<Text style={{ color: colors.textMuted, ...typography.body }}>
							{model.secondaryCta}
						</Text>
					</Pressable>
				) : (
					<Pressable
						onPress={onSecondary}
						disabled={busy}
						style={[
							styles.secondary,
							{
								borderColor: colors.border,
								backgroundColor: colors.primarySoft,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel={model.secondaryCta}
					>
						<Text
							style={[styles.secondaryText, { color: colors.primary }]}
						>
							{model.secondaryCta}
						</Text>
					</Pressable>
				)}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderRadius: radii.lg,
		padding: spacing.md,
		marginBottom: spacing.md,
		minHeight: 140,
	},
	title: {
		...typography.subtitle,
		marginBottom: spacing.xs,
	},
	summary: {
		fontSize: 28,
		fontWeight: '700',
		lineHeight: 34,
		marginBottom: spacing.sm,
	},
	hint: {
		...typography.caption,
		marginBottom: spacing.sm,
	},
	guide: {
		marginBottom: spacing.sm,
		gap: 4,
	},
	guideText: {
		...typography.body,
	},
	disclaimer: {
		...typography.caption,
	},
	actions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginTop: spacing.xs,
	},
	actionsStacked: {
		flexDirection: 'column',
	},
	primary: {
		minHeight: 48,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		alignItems: 'center',
		justifyContent: 'center',
		flexGrow: 1,
	},
	primaryDominant: {
		minHeight: 56,
		width: '100%',
		borderRadius: radii.md,
	},
	primaryText: {
		...typography.button,
	},
	secondary: {
		minHeight: 48,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		flexGrow: 1,
	},
	secondaryLink: {
		minHeight: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryText: {
		...typography.button,
	},
})
