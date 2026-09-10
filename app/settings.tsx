/**
 * Settings — theme + links to profile and future sections.
 */

import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useDatabase } from '@/src/context/DatabaseContext'
import type { ThemePreference } from '@/src/models/types'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: 'system', label: 'Системная' },
	{ value: 'light', label: 'Светлая' },
	{ value: 'dark', label: 'Тёмная' },
]

const PLACEHOLDER_SECTIONS = [
	{ title: 'Резервная копия', hint: 'Экспорт данных — позже' },
	{ title: 'Конфиденциальность', hint: 'Локальное хранение на устройстве' },
	{ title: 'О приложении', hint: 'Дневник малыша' },
] as const

export default function SettingsScreen () {
	const { colors, preference, setPreference } = useAppTheme()
	const { settings, setThemePreferenceState } = useDatabase()

	const handleTheme = (next: ThemePreference): void => {
		setPreference(next)
		setThemePreferenceState(next)
		void settings?.setThemePreference(next)
	}

	return (
		<ScrollView
			style={{ backgroundColor: colors.background }}
			contentContainerStyle={styles.content}
		>
			<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Тема</Text>
			<View style={styles.themeRow}>
				{THEME_OPTIONS.map((option) => {
					const selected = preference === option.value
					return (
						<Pressable
							key={option.value}
							onPress={() => handleTheme(option.value)}
							style={[
								styles.themeChip,
								{
									backgroundColor: selected
										? colors.primarySoft
										: colors.surface,
									borderColor: selected ? colors.primary : colors.border,
								},
							]}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							accessibilityLabel={option.label}
						>
							<Text
								style={{
									color: selected ? colors.primary : colors.text,
									fontWeight: selected ? '700' : '500',
								}}
							>
								{option.label}
							</Text>
						</Pressable>
					)
				})}
			</View>

			<Link href="/profile" asChild>
				<Pressable
					style={[
						styles.card,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
					accessibilityRole="button"
					accessibilityLabel="Профиль малыша"
				>
					<Text style={[styles.cardTitle, { color: colors.text }]}>
						Профиль малыша
					</Text>
					<Text style={[styles.cardHint, { color: colors.textSecondary }]}>
						Имя, дата рождения, вес и рост
					</Text>
				</Pressable>
			</Link>

			<Link href={'/reminders' as Href} asChild>
				<Pressable
					style={[
						styles.card,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
					accessibilityRole="button"
					accessibilityLabel="Напоминания"
				>
					<Text style={[styles.cardTitle, { color: colors.text }]}>
						Напоминания
					</Text>
					<Text style={[styles.cardHint, { color: colors.textSecondary }]}>
						Локальные уведомления
					</Text>
				</Pressable>
			</Link>

			{PLACEHOLDER_SECTIONS.map((section) => (
				<View
					key={section.title}
					style={[
						styles.card,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
				>
					<Text style={[styles.cardTitle, { color: colors.text }]}>
						{section.title}
					</Text>
					<Text style={[styles.cardHint, { color: colors.textSecondary }]}>
						{section.hint}
					</Text>
				</View>
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	sectionLabel: {
		...typography.caption,
		marginBottom: spacing.sm,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	themeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	themeChip: {
		minHeight: 44,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		justifyContent: 'center',
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		minHeight: 64,
		justifyContent: 'center',
	},
	cardTitle: {
		...typography.subtitle,
		marginBottom: 2,
	},
	cardHint: {
		...typography.caption,
	},
})
