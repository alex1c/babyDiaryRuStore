/**
 * In-app training — guided cards with skip, progress, and soft first offer.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useMemo, useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDatabase } from '@/src/context/DatabaseContext'
import {
	canGoBack,
	goBack,
	goNext,
	isLastTrainingPage,
	isWelcomePage,
	progressLabel,
	progressRatio,
	startTourFromWelcome,
	type TrainingNavState,
} from '@/src/domain/trainingNavigation'
import { getTrainingPageAt } from '@/src/domain/trainingPages'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function TrainingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { settings } = useDatabase()
	const params = useLocalSearchParams<{ from?: string }>()
	const fromOnboarding = String(params.from ?? '') === 'onboarding'

	const initialState = useMemo<TrainingNavState>(
		() =>
			fromOnboarding
				? { phase: 'offer', index: 0 }
				: startTourFromWelcome(),
		[fromOnboarding],
	)
	const [nav, setNav] = useState<TrainingNavState>(initialState)
	const [busy, setBusy] = useState(false)

	const page = nav.phase === 'tour' ? getTrainingPageAt(nav.index) : null
	const ratio = progressRatio(nav)
	const label = progressLabel(nav)

	const finishAndGoHome = async (markCompleted: boolean): Promise<void> => {
		if (busy) {
			return
		}
		setBusy(true)
		try {
			if (settings) {
				if (markCompleted) {
					await settings.setTrainingCompleted(true)
				}
				await settings.setTrainingOfferDismissed(true)
			}
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('training finish failed', err)
			router.replace('/(tabs)' as Href)
		} finally {
			setBusy(false)
		}
	}

	const handleLater = (): void => {
		void finishAndGoHome(false)
	}

	const handleSkip = (): void => {
		void finishAndGoHome(true)
	}

	const handleStartOffer = (): void => {
		setNav(startTourFromWelcome())
	}

	const handlePrimary = (): void => {
		if (!page) {
			return
		}
		if (isWelcomePage(nav)) {
			setNav(goNext(nav))
			return
		}
		if (isLastTrainingPage(nav)) {
			void finishAndGoHome(true)
			return
		}
		setNav(goNext(nav))
	}

	const primaryLabel = (): string => {
		if (nav.phase === 'offer') {
			return 'Посмотреть'
		}
		if (isWelcomePage(nav)) {
			return 'Начать знакомство'
		}
		if (isLastTrainingPage(nav)) {
			return 'Перейти в приложение'
		}
		return 'Далее'
	}

	if (nav.phase === 'offer') {
		return (
			<SafeAreaView
				style={[styles.safe, { backgroundColor: colors.background }]}
				edges={['left', 'right', 'bottom']}
			>
				<View style={styles.offerWrap}>
					<View
						style={[
							styles.iconBadge,
							{ backgroundColor: colors.primarySoft },
						]}
						accessibilityLabel="Обучение"
					>
						<Text style={[styles.iconText, { color: colors.primary }]}>
							?
						</Text>
					</View>
					<Text
						style={[styles.title, { color: colors.text }]}
						accessibilityRole="header"
					>
						Хотите быстро посмотреть основные возможности?
					</Text>
					<Text
						style={[styles.body, { color: colors.textSecondary }]}
					>
						Это займёт пару минут. Можно пропустить и открыть обучение
						позже в разделе «Ещё».
					</Text>
					<Pressable
						onPress={handleStartOffer}
						style={[
							styles.primaryBtn,
							{ backgroundColor: colors.primary },
						]}
						accessibilityRole="button"
						accessibilityLabel="Посмотреть"
					>
						<Text style={styles.primaryBtnText}>Посмотреть</Text>
					</Pressable>
					<Pressable
						onPress={handleLater}
						style={styles.secondaryBtn}
						accessibilityRole="button"
						accessibilityLabel="Позже"
					>
						<Text
							style={[
								styles.secondaryBtnText,
								{ color: colors.textSecondary },
							]}
						>
							Позже
						</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		)
	}

	if (!page) {
		return null
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right', 'bottom']}
		>
			<View style={styles.topBar}>
				<Pressable
					onPress={handleSkip}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="Пропустить обучение"
					style={styles.skipBtn}
				>
					<Text style={{ color: colors.textMuted, ...typography.caption }}>
						Пропустить
					</Text>
				</Pressable>
				<Text
					style={[styles.progressText, { color: colors.textSecondary }]}
					accessibilityLabel={`Прогресс: ${label}`}
				>
					{label}
				</Text>
			</View>

			<View
				style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}
				accessibilityRole="progressbar"
				accessibilityValue={{
					min: 0,
					max: 100,
					now: Math.round(ratio * 100),
					text: label,
				}}
			>
				<View
					style={[
						styles.progressFill,
						{
							backgroundColor: colors.primary,
							width: `${Math.max(8, ratio * 100)}%`,
						},
					]}
				/>
			</View>

			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View
					style={[
						styles.iconBadge,
						{ backgroundColor: colors.primarySoft },
					]}
					accessibilityLabel={page.iconLabel}
				>
					<Text style={[styles.iconText, { color: colors.primary }]}>
						{page.iconLabel.slice(0, 1)}
					</Text>
				</View>

				<Text
					style={[styles.title, { color: colors.text }]}
					accessibilityRole="header"
				>
					{page.title}
				</Text>
				<Text style={[styles.body, { color: colors.textSecondary }]}>
					{page.body}
				</Text>

				{page.bullets && page.bullets.length > 0 ? (
					<View style={styles.bullets}>
						{page.bullets.map((item) => (
							<View key={item} style={styles.bulletRow}>
								<Text style={{ color: colors.primary }}>•</Text>
								<Text
									style={[
										styles.bulletText,
										{ color: colors.text },
									]}
								>
									{item}
								</Text>
							</View>
						))}
					</View>
				) : null}

				{page.callout ? (
					<View
						style={[
							styles.callout,
							{
								backgroundColor: colors.primarySoft,
								borderColor: colors.border,
							},
						]}
					>
						<Text style={[styles.calloutText, { color: colors.text }]}>
							{page.callout}
						</Text>
					</View>
				) : null}

				{page.openHref && page.openLabel ? (
					<Pressable
						onPress={() => router.push(page.openHref as Href)}
						style={[
							styles.linkBtn,
							{
								borderColor: colors.border,
								backgroundColor: colors.surface,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel={page.openLabel}
					>
						<Text style={{ color: colors.primary, fontWeight: '600' }}>
							{page.openLabel}
						</Text>
					</Pressable>
				) : null}
			</ScrollView>

			<View style={styles.footer}>
				{canGoBack(nav) ? (
					<Pressable
						onPress={() => setNav(goBack(nav))}
						style={[
							styles.backBtn,
							{
								borderColor: colors.border,
								backgroundColor: colors.surface,
							},
						]}
						accessibilityRole="button"
						accessibilityLabel="Назад"
					>
						<Text style={{ color: colors.text, fontWeight: '600' }}>
							Назад
						</Text>
					</Pressable>
				) : (
					<View style={styles.backBtnSpacer} />
				)}
				<Pressable
					onPress={handlePrimary}
					disabled={busy}
					style={[
						styles.primaryBtn,
						styles.primaryFlex,
						{ backgroundColor: colors.primary },
					]}
					accessibilityRole="button"
					accessibilityLabel={primaryLabel()}
					accessibilityState={{ disabled: busy }}
				>
					<Text style={styles.primaryBtnText}>{primaryLabel()}</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	offerWrap: {
		flex: 1,
		padding: spacing.lg,
		justifyContent: 'center',
	},
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		minHeight: 44,
	},
	skipBtn: {
		minHeight: 44,
		justifyContent: 'center',
		paddingRight: spacing.md,
	},
	progressText: {
		...typography.caption,
	},
	progressTrack: {
		height: 6,
		marginHorizontal: spacing.md,
		borderRadius: 999,
		overflow: 'hidden',
		marginBottom: spacing.sm,
	},
	progressFill: {
		height: '100%',
		borderRadius: 999,
	},
	content: {
		padding: spacing.lg,
		paddingBottom: spacing.xl,
		flexGrow: 1,
	},
	iconBadge: {
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: spacing.md,
	},
	iconText: {
		...typography.title,
	},
	title: {
		...typography.title,
		marginBottom: spacing.md,
	},
	body: {
		...typography.body,
		marginBottom: spacing.md,
	},
	bullets: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	bulletRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		alignItems: 'flex-start',
	},
	bulletText: {
		...typography.body,
		flex: 1,
	},
	callout: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	calloutText: {
		...typography.body,
		fontWeight: '600',
	},
	linkBtn: {
		minHeight: 48,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.md,
		marginBottom: spacing.md,
	},
	footer: {
		flexDirection: 'row',
		gap: spacing.sm,
		padding: spacing.md,
		paddingBottom: spacing.lg,
	},
	backBtn: {
		minHeight: 52,
		minWidth: 96,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.md,
	},
	backBtnSpacer: {
		minWidth: 96,
	},
	primaryBtn: {
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	primaryFlex: {
		flex: 1,
	},
	primaryBtnText: {
		...typography.button,
		color: '#FFFFFF',
	},
	secondaryBtn: {
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	secondaryBtnText: {
		...typography.button,
	},
})
