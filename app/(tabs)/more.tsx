/**
 * More tab — profile, settings, health, training.
 */

import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

interface MoreLinkProps {
	href: Href
	title: string
	subtitle: string
}

function MoreLink ({ href, title, subtitle }: MoreLinkProps) {
	const { colors } = useAppTheme()

	return (
		<Link href={href} asChild>
			<Pressable
				style={StyleSheet.flatten([
					styles.row,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				])}
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

export default function MoreScreen () {
	const { colors } = useAppTheme()
	const { activeChild } = useActiveChild()

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<MoreLink
					href={'/reminders' as Href}
					title="Напоминания"
					subtitle="Локальные уведомления — только то, что включите сами"
				/>
				<MoreLink
					href={'/reports' as Href}
					title="Отчёты и экспорт"
					subtitle="Сводка, PDF за период и первый год"
				/>
				<MoreLink
					href={'/health' as Href}
					title="Здоровье"
					subtitle="Температура, симптомы, лекарства и визиты"
				/>
				<MoreLink
					href={'/children' as Href}
					title="Мои дети"
					subtitle="Профили, переключение и добавление ребёнка"
				/>
				<MoreLink
					href="/profile"
					title="Профиль малыша"
					subtitle={
						activeChild
							? activeChild.name
							: 'Имя, дата рождения и данные при рождении'
					}
				/>
				<MoreLink
					href={'/backup' as Href}
					title="Резервная копия"
					subtitle="Экспорт и восстановление дневника"
				/>
				<MoreLink
					href="/settings"
					title="Настройки"
					subtitle="Тема, уведомления, резервная копия и другое"
				/>
				<MoreLink
					href="/training"
					title="Обучение"
					subtitle="Как пользоваться дневником"
				/>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xl },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		minHeight: 64,
	},
	rowText: { flex: 1, paddingRight: spacing.sm },
	rowTitle: { ...typography.subtitle, marginBottom: 2 },
	rowSubtitle: { ...typography.caption },
})
