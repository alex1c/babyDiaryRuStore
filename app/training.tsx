/**
 * Training / onboarding placeholder — full guided tour comes later.
 * Required in every ForestMusic app; route must exist from Phase 0.
 */

import { ScrollView, StyleSheet, Text } from 'react-native'

import { PlaceholderSection } from '@/src/components/PlaceholderSection'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function TrainingScreen () {
	const { colors } = useAppTheme()

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				Короткое обучение появится здесь. Сейчас это заглушка маршрута.
			</Text>
			<PlaceholderSection
				title="Быстрый старт"
				description="Как записать сон, кормление и подгузник одной рукой."
			/>
			<PlaceholderSection
				title="Исправление задним числом"
				description="Как поправить время, если событие внесли не сразу."
			/>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	lead: {
		...typography.body,
		marginBottom: spacing.md,
	},
})
