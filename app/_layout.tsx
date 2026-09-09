/**
 * Root layout: error boundary, theme, database, active child, onboarding gate.
 */

import { Stack, useRouter, useSegments, type Href } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppErrorBoundary } from '@/src/components/AppErrorBoundary'
import {
	ActiveChildProvider,
	useActiveChild,
} from '@/src/context/ActiveChildContext'
import { DatabaseProvider, useDatabase } from '@/src/context/DatabaseContext'
import { AppThemeProvider, useAppTheme } from '@/src/theme/ThemeProvider'
import { lightColors } from '@/src/theme/tokens'

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

/**
 * Redirect to onboarding when there are no children yet.
 * Navigator stays mounted so replace() can resolve.
 */
function OnboardingGate ({ children }: { children: React.ReactNode }) {
	const { loading, needsOnboarding } = useActiveChild()
	const segments = useSegments()
	const router = useRouter()
	const { colors } = useAppTheme()

	useEffect(() => {
		if (loading) {
			return
		}
		const first = String(segments[0] ?? '')
		const onOnboarding = first === 'onboarding'
		if (needsOnboarding && !onOnboarding) {
			router.replace('/onboarding' as Href)
		} else if (!needsOnboarding && onOnboarding) {
			router.replace('/(tabs)' as Href)
		}
	}, [loading, needsOnboarding, segments, router])

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		)
	}

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
					name="onboarding"
					options={{ headerShown: false, animation: 'fade' }}
				/>
				<Stack.Screen
					name="profile"
					options={{ title: 'Профиль малыша', presentation: 'card' }}
				/>
				<Stack.Screen
					name="sleep/manual"
					options={{ title: 'Добавить сон', presentation: 'card' }}
				/>
				<Stack.Screen
					name="sleep/[id]"
					options={{ title: 'Сон', presentation: 'card' }}
				/>
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
								<ActiveChildProvider>
									<OnboardingGate>
										<RootNavigator />
									</OnboardingGate>
								</ActiveChildProvider>
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
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: lightColors.background,
	},
})
