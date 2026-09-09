/**
 * Feeding quick entry — Грудь | Бутылочка | Ещё (1–2 taps for breastfeeding).
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { FeedingValidationError } from '@/src/domain/feedingLabels'
import type { BreastSide } from '@/src/models/feeding'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

type Step = 'root' | 'breast' | 'more'

export default function FeedingPickerScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { feeding } = useDatabase()
	const [step, setStep] = useState<Step>('root')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [checking, setChecking] = useState(true)

	useFocusEffect(
		useCallback(() => {
			let cancelled = false
			void (async () => {
				if (!feeding || !activeChild) {
					setChecking(false)
					return
				}
				try {
					const active = await feeding.findActiveBreastfeeding(
						activeChild.id,
					)
					if (!cancelled && active) {
						router.replace('/feeding/active' as Href)
						return
					}
				} catch (err) {
					logger.error('check active breastfeeding failed', err)
				} finally {
					if (!cancelled) {
						setChecking(false)
					}
				}
			})()
			return () => {
				cancelled = true
			}
		}, [feeding, activeChild, router]),
	)

	const startBreast = async (side: BreastSide): Promise<void> => {
		if (!feeding || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			await feeding.startBreastfeeding({
				childId: activeChild.id,
				side,
			})
			router.replace('/feeding/active' as Href)
		} catch (err) {
			logger.error('start breastfeeding failed', err)
			setError(
				err instanceof FeedingValidationError
					? err.message
					: 'Не удалось начать кормление',
			)
		} finally {
			setBusy(false)
		}
	}

	if (checking) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<View style={styles.content}>
				{step === 'root' ? (
					<>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							Что записать?
						</Text>
						<ChoiceButton
							label="Грудь"
							onPress={() => setStep('breast')}
							disabled={busy}
						/>
						<ChoiceButton
							label="Бутылочка"
							onPress={() => router.push('/feeding/bottle' as Href)}
							disabled={busy}
						/>
						<ChoiceButton
							label="Ещё"
							primary={false}
							onPress={() => setStep('more')}
							disabled={busy}
						/>
						<Pressable
							onPress={() => router.push('/feeding/manual' as Href)}
							style={styles.link}
							accessibilityRole="button"
							accessibilityLabel="Добавить грудное кормление вручную"
						>
							<Text style={{ color: colors.primary }}>
								Добавить ГВ вручную
							</Text>
						</Pressable>
					</>
				) : null}

				{step === 'breast' ? (
					<>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							С какой стороны начать?
						</Text>
						<ChoiceButton
							label="Левая"
							onPress={() => void startBreast('left')}
							disabled={busy}
						/>
						<ChoiceButton
							label="Правая"
							onPress={() => void startBreast('right')}
							disabled={busy}
						/>
						<ChoiceButton
							label="Назад"
							primary={false}
							onPress={() => setStep('root')}
							disabled={busy}
						/>
					</>
				) : null}

				{step === 'more' ? (
					<>
						<Text style={[styles.lead, { color: colors.textSecondary }]}>
							Другие записи
						</Text>
						<ChoiceButton
							label="Сцеживание"
							onPress={() => router.push('/feeding/pumping' as Href)}
						/>
						<ChoiceButton
							label="Вода"
							onPress={() => router.push('/feeding/water' as Href)}
						/>
						<ChoiceButton
							label="Прикорм"
							onPress={() => router.push('/feeding/solid' as Href)}
						/>
						<ChoiceButton
							label="Назад"
							primary={false}
							onPress={() => setStep('root')}
						/>
					</>
				) : null}

				{error ? (
					<Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
				) : null}
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		flex: 1,
		justifyContent: 'flex-end',
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	lead: {
		...typography.subtitle,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	link: {
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	error: {
		...typography.body,
		textAlign: 'center',
		marginTop: spacing.sm,
	},
})
