import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function NotFoundScreen () {
	const { colors } = useAppTheme()

	return (
		<>
			<Stack.Screen options={{ title: 'Не найдено' }} />
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				<Text style={[styles.title, { color: colors.text }]}>
					Экрана не существует
				</Text>
				<Link href="/" style={styles.link}>
					<Text style={{ color: colors.primary }}>На главный экран</Text>
				</Link>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	title: {
		...typography.title,
		marginBottom: spacing.md,
	},
	link: {
		marginTop: spacing.sm,
		paddingVertical: spacing.sm,
	},
})
