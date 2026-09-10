/**
 * Create a second (or additional) child profile — becomes active after save.
 */

import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
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
import { spacing } from '@/src/theme/tokens'

export default function NewChildScreen () {
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
			const child = await childrenRepo.create(
				toCreateChildInput(result.parsed),
			)
			// Prefer activating the newly created child — user just added them.
			await settings.setActiveChildId(child.id)
			await setActiveChildId(child.id)
			await refresh()
			// Privacy-safe: source enum only — never child name or birth date.
			trackAnalyticsEvent(ANALYTICS_EVENTS.childAdded, {
				source: 'settings',
			})
			router.replace('/(tabs)' as never)
		} catch (error) {
			logger.error('Failed to create child', error)
			throw new Error('Не удалось создать профиль. Попробуйте ещё раз.')
		}
	}

	return (
		<View style={[styles.flex, { backgroundColor: colors.background }]}>
			<ChildProfileForm
				submitLabel="Добавить ребёнка"
				onSubmit={handleSubmit}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
		paddingBottom: spacing.md,
	},
})
