/**
 * Today screen foundation — placeholders for Phase 1 quick-log cards.
 * Layout reserves space for a future banner ad below the main content.
 */

import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { PlaceholderSection } from '@/src/components/PlaceholderSection'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function TodayScreen () {
	const { colors } = useAppTheme()

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Главные события — в 1–2 касания. Карточки появятся в следующих фазах.
				</Text>

				<PlaceholderSection
					title="Сон / бодрствование"
					description="Здесь будет текущий статус сна и быстрый старт/стоп."
				/>
				<PlaceholderSection
					title="Последнее кормление"
					description="Время с последнего кормления и быстрый лог."
				/>
				<PlaceholderSection
					title="Последний подгузник"
					description="Короткий статус и одно касание для новой записи."
				/>
				<PlaceholderSection
					title="Быстрые действия"
					description="Крупные кнопки для сна, кормления, подгузника и воды."
				/>

				{/* Reserved ad slot — no ads in Phase 0. */}
				<BannerAdSlot />
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
	},
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	lead: {
		...typography.body,
		marginBottom: spacing.md,
	},
})
