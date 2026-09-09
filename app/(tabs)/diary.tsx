/**
 * Diary timeline placeholder — full history UI arrives later.
 */

import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import { PlaceholderSection } from '@/src/components/PlaceholderSection'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function DiaryScreen () {
	const { colors } = useAppTheme()

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Лента событий с правкой задним числом появится в Phase 1–2.
				</Text>
				<PlaceholderSection
					title="Лента дня"
					description="Список событий по дате с фильтрами по типу."
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
