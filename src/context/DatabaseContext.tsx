/**
 * Database + repository bootstrap for the React tree.
 * Loading / error UI uses static light tokens so this provider can sit
 * under AppThemeProvider without circular init issues.
 */

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { getDatabase } from '../db/client'
import type { SqlExecutor } from '../db/types'
import type { ThemePreference } from '../models/types'
import { ChildRepository } from '../repositories/childRepository'
import { DiaperRepository } from '../repositories/diaperRepository'
import { EventRepository } from '../repositories/eventRepository'
import { FeedingRepository } from '../repositories/feedingRepository'
import { QuickEventRepository } from '../repositories/quickEventRepository'
import { SettingsRepository } from '../repositories/settingsRepository'
import { SleepRepository } from '../repositories/sleepRepository'
import { logger } from '../services/logger'
import { lightColors, spacing, typography } from '../theme/tokens'

interface DatabaseContextValue {
	ready: boolean
	error: string | null
	db: SqlExecutor | null
	childrenRepo: ChildRepository | null
	events: EventRepository | null
	sleep: SleepRepository | null
	feeding: FeedingRepository | null
	diaper: DiaperRepository | null
	quickEvents: QuickEventRepository | null
	settings: SettingsRepository | null
	themePreference: ThemePreference
	setThemePreferenceState: (preference: ThemePreference) => void
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function DatabaseProvider ({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [db, setDb] = useState<SqlExecutor | null>(null)
	const [themePreference, setThemePreferenceState] =
		useState<ThemePreference>('system')

	const repos = useMemo(() => {
		if (!db) {
			return {
				childrenRepo: null,
				events: null,
				sleep: null,
				feeding: null,
				diaper: null,
				quickEvents: null,
				settings: null,
			}
		}
		return {
			childrenRepo: new ChildRepository(db),
			events: new EventRepository(db),
			sleep: new SleepRepository(db),
			feeding: new FeedingRepository(db),
			diaper: new DiaperRepository(db),
			quickEvents: new QuickEventRepository(db),
			settings: new SettingsRepository(db),
		}
	}, [db])

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const database = await getDatabase()
				if (cancelled) {
					return
				}
				const settings = new SettingsRepository(database)
				const appSettings = await settings.get()
				setDb(database)
				setThemePreferenceState(appSettings.themePreference)
				setReady(true)
			} catch (err) {
				logger.error('Failed to open database', err)
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: 'Не удалось открыть базу данных',
					)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const value: DatabaseContextValue = {
		ready,
		error,
		db,
		childrenRepo: repos.childrenRepo,
		events: repos.events,
		sleep: repos.sleep,
		feeding: repos.feeding,
		diaper: repos.diaper,
		quickEvents: repos.quickEvents,
		settings: repos.settings,
		themePreference,
		setThemePreferenceState,
	}

	if (error) {
		return (
			<View style={styles.center}>
				<Text style={styles.errorTitle}>Не удалось открыть базу</Text>
				<Text style={styles.errorBody}>
					{__DEV__ ? error : 'Попробуйте перезапустить приложение.'}
				</Text>
			</View>
		)
	}

	if (!ready) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color={lightColors.primary} />
				<Text style={styles.loading}>Загрузка дневника…</Text>
			</View>
		)
	}

	return (
		<DatabaseContext.Provider value={value}>
			{children}
		</DatabaseContext.Provider>
	)
}

export function useDatabase (): DatabaseContextValue {
	const ctx = useContext(DatabaseContext)
	if (!ctx) {
		throw new Error('useDatabase must be used within DatabaseProvider')
	}
	return ctx
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		backgroundColor: lightColors.background,
	},
	loading: {
		marginTop: spacing.sm,
		...typography.body,
		color: lightColors.textMuted,
	},
	errorTitle: {
		...typography.subtitle,
		marginBottom: spacing.sm,
		textAlign: 'center',
		color: lightColors.danger,
	},
	errorBody: {
		...typography.body,
		textAlign: 'center',
		color: lightColors.textMuted,
	},
})
