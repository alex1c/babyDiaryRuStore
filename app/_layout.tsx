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
					name="children/index"
					options={{ title: 'Мои дети', presentation: 'card' }}
				/>
				<Stack.Screen
					name="children/new"
					options={{ title: 'Добавить ребёнка', presentation: 'card' }}
				/>
				<Stack.Screen
					name="children/[id]"
					options={{ title: 'Профиль ребёнка', presentation: 'card' }}
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
					name="feeding/index"
					options={{ title: 'Кормление', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/active"
					options={{ title: 'Кормление', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/bottle"
					options={{ title: 'Бутылочка', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/water"
					options={{ title: 'Вода', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/pumping"
					options={{ title: 'Сцеживание', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/solid"
					options={{ title: 'Прикорм', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/manual"
					options={{ title: 'ГВ вручную', presentation: 'card' }}
				/>
				<Stack.Screen
					name="feeding/[id]"
					options={{ title: 'Кормление', presentation: 'card' }}
				/>
				<Stack.Screen
					name="diaper/index"
					options={{ title: 'Подгузник', presentation: 'card' }}
				/>
				<Stack.Screen
					name="diaper/[id]"
					options={{ title: 'Подгузник', presentation: 'card' }}
				/>
				<Stack.Screen
					name="event/new"
					options={{ title: 'Событие', presentation: 'card' }}
				/>
				<Stack.Screen
					name="event/custom-type"
					options={{ title: 'Своё событие', presentation: 'card' }}
				/>
				<Stack.Screen
					name="event/[id]"
					options={{ title: 'Событие', presentation: 'card' }}
				/>
				<Stack.Screen
					name="settings"
					options={{ title: 'Настройки', presentation: 'card' }}
				/>
				<Stack.Screen
					name="backup"
					options={{ title: 'Резервная копия', presentation: 'card' }}
				/>
				<Stack.Screen
					name="training"
					options={{ title: 'Обучение', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reminders/index"
					options={{ title: 'Напоминания', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reminders/edit"
					options={{ title: 'Напоминание', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reports/index"
					options={{ title: 'Отчёты и экспорт', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reports/share"
					options={{ title: 'Поделиться сводкой', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reports/pdf"
					options={{ title: 'Создать PDF', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reports/ready"
					options={{ title: 'Отчёт готов', presentation: 'card' }}
				/>
				<Stack.Screen
					name="reports/first-year"
					options={{ title: 'Первый год малыша', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/index"
					options={{ title: 'Здоровье', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/temperature"
					options={{ title: 'Температура', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/symptom"
					options={{ title: 'Симптом', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/medicine"
					options={{ title: 'Лекарство', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/visit"
					options={{ title: 'Визит к врачу', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/history"
					options={{ title: 'История здоровья', presentation: 'card' }}
				/>
				<Stack.Screen
					name="health/documents"
					options={{ title: 'Документы', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/measure"
					options={{ title: 'Измерение', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/measurements"
					options={{ title: 'История измерений', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/milestone/index"
					options={{ title: 'Достижение', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/milestone/[id]"
					options={{ title: 'Достижение', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/tooth"
					options={{ title: 'Зуб', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/moment/index"
					options={{ title: 'Момент', presentation: 'card' }}
				/>
				<Stack.Screen
					name="development/moment/[id]"
					options={{ title: 'Момент', presentation: 'card' }}
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
