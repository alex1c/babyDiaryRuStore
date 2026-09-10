/**
 * First launch — create the first baby profile.
 */

import { useRouter, type Href } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChildProfileForm } from '@/src/components/ChildProfileForm'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	toCreateChildInput,
	validateChildForm,
	type ChildFormValues,
} from '@/src/domain/childValidation'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function OnboardingScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { childrenRepo, settings } = useDatabase()
	const { refresh, setActiveChildId } = useActiveChild()

	const handleSubmit = async (values: ChildFormValues): Promise<void> => {
		if (!childrenRepo || !settings) {
			throw new Error('База данных ещё не готова. Попробуйте чуть позже.')
		}

		const result = validateChildForm(values)
		if (!result.ok || !result.parsed) {
			throw new Error(result.errors[0] ?? 'Проверьте введённые данные')
		}

		try {
			const child = await childrenRepo.create(toCreateChildInput(result.parsed))
			await settings.setActiveChildId(child.id)
			await settings.setOnboardingCompleted(true)
			await setActiveChildId(child.id)
			await refresh()
			// Soft training offer once — never blocks the app permanently.
			const showOffer = await settings.shouldShowTrainingOffer()
			if (showOffer) {
				router.replace('/training?from=onboarding' as Href)
			} else {
				router.replace('/(tabs)' as Href)
			}
		} catch (error) {
			logger.error('Failed to create child during onboarding', error)
			throw new Error(
				'Не удалось сохранить профиль. Проверьте данные и попробуйте снова.',
			)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['top', 'left', 'right', 'bottom']}
		>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.text }]}>
					Расскажите о малыше
				</Text>
				<Text style={[styles.subtitle, { color: colors.textSecondary }]}>
					Достаточно имени и даты рождения. Остальное можно дополнить позже.
				</Text>
			</View>
			<ChildProfileForm submitLabel="Начать" onSubmit={handleSubmit} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	header: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	title: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	subtitle: {
		...typography.body,
	},
})
