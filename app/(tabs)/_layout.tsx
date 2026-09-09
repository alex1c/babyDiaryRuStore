/**
 * Bottom tabs: Сегодня / Дневник / Статистика / Развитие / Ещё
 */

import { Tabs } from 'expo-router'
import { Text, StyleSheet, type ColorValue } from 'react-native'

import { useAppTheme } from '@/src/theme/ThemeProvider'

function TabIcon ({ label, focused, color }: {
	label: string
	focused: boolean
	color: ColorValue
}) {
	return (
		<Text style={[styles.icon, focused && styles.iconFocused, { color }]}>
			{label}
		</Text>
	)
}

export default function TabsLayout () {
	const { colors } = useAppTheme()

	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: colors.background },
				headerTitleStyle: {
					color: colors.text,
					fontWeight: '700',
					fontSize: 20,
				},
				headerShadowVisible: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.tabInactive,
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					height: 64,
					paddingBottom: 8,
					paddingTop: 6,
				},
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: '600',
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Сегодня',
					tabBarLabel: 'Сегодня',
					tabBarIcon: ({ focused, color }) => (
						<TabIcon label="●" focused={focused} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="diary"
				options={{
					title: 'Дневник',
					tabBarLabel: 'Дневник',
					tabBarIcon: ({ focused, color }) => (
						<TabIcon label="☰" focused={focused} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="stats"
				options={{
					title: 'Статистика',
					tabBarLabel: 'Статистика',
					tabBarIcon: ({ focused, color }) => (
						<TabIcon label="▦" focused={focused} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="development"
				options={{
					title: 'Развитие',
					tabBarLabel: 'Развитие',
					tabBarIcon: ({ focused, color }) => (
						<TabIcon label="★" focused={focused} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="more"
				options={{
					title: 'Ещё',
					tabBarLabel: 'Ещё',
					tabBarIcon: ({ focused, color }) => (
						<TabIcon label="…" focused={focused} color={color} />
					),
				}}
			/>
		</Tabs>
	)
}

const styles = StyleSheet.create({
	icon: {
		fontSize: 14,
	},
	iconFocused: {
		fontWeight: '700',
	},
})
