/**
 * Statistics placeholder — charts and aggregates come later.
 */

import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { PlaceholderSection } from '@/src/components/PlaceholderSection'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function StatsScreen () {
	const { colors } = useAppTheme()

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Сводка сна, кормлений и других событий — в следующих фазах.
				</Text>
				<PlaceholderSection
					title="Обзор"
					description="Сутки / неделя / месяц без тяжёлых графиков на старте."
				/>
				<BannerAdSlot />
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xl },
	lead: { ...typography.body, marginBottom: spacing.md },
})
