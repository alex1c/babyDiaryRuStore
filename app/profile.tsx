/**
 * Edit the active child's profile (does not create a new child).
 */

import { useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { ChildProfileForm } from '@/src/components/ChildProfileForm'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	validateChildForm,
	type ChildFormValues,
} from '@/src/domain/childValidation'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function ProfileScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { childrenRepo } = useDatabase()
	const { activeChild, loading, refresh } = useActiveChild()

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.primary} />
			</View>
		)
	}

	if (!activeChild) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={[styles.empty, { color: colors.textSecondary }]}>
					Сначала создайте профиль малыша.
				</Text>
			</View>
		)
	}

	const handleSubmit = async (values: ChildFormValues): Promise<void> => {
		if (!childrenRepo) {
			throw new Error('База данных ещё не готова. Попробуйте чуть позже.')
		}
		const result = validateChildForm(values)
		if (!result.ok || !result.parsed) {
			throw new Error(result.errors[0] ?? 'Проверьте введённые данные')
		}

		try {
			await childrenRepo.update(activeChild.id, {
				name: result.parsed.name,
				birthDate: result.parsed.birthDate,
				birthTime: result.parsed.birthTime,
				sex: result.parsed.sex,
				birthWeightGrams: result.parsed.birthWeightGrams,
				birthHeightCm: result.parsed.birthHeightCm,
			})
			await refresh()
			router.back()
		} catch (error) {
			logger.error('Failed to update child profile', error)
			throw new Error(
				'Не удалось сохранить изменения. Попробуйте ещё раз.',
			)
		}
	}

	return (
		<ChildProfileForm
			key={activeChild.id}
			initial={activeChild}
			submitLabel="Сохранить"
			onSubmit={handleSubmit}
		/>
	)
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	empty: {
		...typography.body,
		textAlign: 'center',
	},
})
