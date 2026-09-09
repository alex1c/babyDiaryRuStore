/**
 * Reports hub — share summary, period PDF, first-year preview.
 */

import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

function HubLink ({
	href,
	title,
	subtitle,
}: {
	href: Href
	title: string
	subtitle: string
}) {
	const { colors } = useAppTheme()
	return (
		<Link href={href} asChild>
			<Pressable
				style={[
					styles.row,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
				accessibilityRole="button"
				accessibilityLabel={title}
			>
				<View style={styles.rowText}>
					<Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
					<Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
						{subtitle}
					</Text>
				</View>
				<Text style={{ color: colors.textMuted }}>›</Text>
			</Pressable>
		</Link>
	)
}

export default function ReportsHubScreen () {
	const { colors } = useAppTheme()

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Быстрая сводка для мессенджеров, PDF-отчёт за период и альбом
					первого года.
				</Text>
				<HubLink
					href={'/reports/share' as Href}
					title="Поделиться сводкой"
					subtitle="Короткий текст за сегодня, 7 или 30 дней"
				/>
				<HubLink
					href={'/reports/pdf' as Href}
					title="Создать PDF"
					subtitle="Читаемый отчёт за выбранный период"
				/>
				<HubLink
					href={'/reports/first-year' as Href}
					title="Первый год малыша"
					subtitle="Месяцы 1–12: фото, рост и достижения"
				/>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
	lead: { ...typography.body, marginBottom: spacing.sm },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		minHeight: 64,
	},
	rowText: { flex: 1, paddingRight: spacing.sm },
	rowTitle: { ...typography.subtitle, marginBottom: 2 },
	rowSubtitle: { ...typography.caption },
})
