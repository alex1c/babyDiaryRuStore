/**
 * Root layout: error boundary, theme, database gate, navigation shell.
 */

import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppErrorBoundary } from '@/src/components/AppErrorBoundary'
import { DatabaseProvider, useDatabase } from '@/src/context/DatabaseContext'
import { AppThemeProvider, useAppTheme } from '@/src/theme/ThemeProvider'

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync().catch(() => {
	// Splash may already be hidden in some environments.
})

/** Keep AppThemeProvider preference in sync with persisted settings. */
function ThemeSync ({ children }: { children: React.ReactNode }) {
	const { themePreference } = useDatabase()
	const { setPreference } = useAppTheme()

	useEffect(() => {
		setPreference(themePreference)
	}, [themePreference, setPreference])

	return <>{children}</>
}

function RootNavigator () {
	const { resolvedScheme, colors } = useAppTheme()

	useEffect(() => {
		SplashScreen.hideAsync().catch(() => undefined)
	}, [])

	return (
		<>
			<StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: colors.background },
					headerTintColor: colors.primary,
					headerTitleStyle: { color: colors.text, fontWeight: '600' },
					contentStyle: { backgroundColor: colors.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="settings"
					options={{ title: 'Настройки', presentation: 'card' }}
				/>
				<Stack.Screen
					name="training"
					options={{ title: 'Обучение', presentation: 'card' }}
				/>
			</Stack>
		</>
	)
}

export default function RootLayout () {
	return (
		<GestureHandlerRootView style={styles.flex}>
			<SafeAreaProvider>
				<AppErrorBoundary>
					<AppThemeProvider>
						<DatabaseProvider>
							<ThemeSync>
								<RootNavigator />
							</ThemeSync>
						</DatabaseProvider>
					</AppThemeProvider>
				</AppErrorBoundary>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
})
