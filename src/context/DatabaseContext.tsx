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
import { DoctorVisitRepository } from '../repositories/doctorVisitRepository'
import { EventRepository } from '../repositories/eventRepository'
import { FeedingRepository } from '../repositories/feedingRepository'
import { GrowthRepository } from '../repositories/growthRepository'
import { HealthAttachmentRepository } from '../repositories/healthAttachmentRepository'
import { MedicineCatalogRepository } from '../repositories/medicineCatalogRepository'
import { MilestoneRepository } from '../repositories/milestoneRepository'
import { MomentRepository } from '../repositories/momentRepository'
import { QuickEventRepository } from '../repositories/quickEventRepository'
import { SettingsRepository } from '../repositories/settingsRepository'
import { SleepRepository } from '../repositories/sleepRepository'
import { SymptomRepository } from '../repositories/symptomRepository'
import { ToothRepository } from '../repositories/toothRepository'
import { ReminderRepository } from '../repositories/reminderRepository'
import { ReminderService } from '../services/reminderService'
import {
	getAppPhotoStorage,
	getHealthDocumentStorage,
} from '../services/appPhotoStorage'
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
	growth: GrowthRepository | null
	milestones: MilestoneRepository | null
	teeth: ToothRepository | null
	moments: MomentRepository | null
	symptoms: SymptomRepository | null
	medicineCatalog: MedicineCatalogRepository | null
	doctorVisits: DoctorVisitRepository | null
	healthAttachments: HealthAttachmentRepository | null
	reminders: ReminderRepository | null
	reminderService: ReminderService | null
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
				growth: null,
				milestones: null,
				teeth: null,
				moments: null,
				symptoms: null,
				medicineCatalog: null,
				doctorVisits: null,
				healthAttachments: null,
				reminders: null,
				reminderService: null,
				settings: null,
			}
		}
		const photos = getAppPhotoStorage()
		const healthDocs = getHealthDocumentStorage()
		const reminders = new ReminderRepository(db)
		const feeding = new FeedingRepository(db)
		return {
			childrenRepo: new ChildRepository(db),
			events: new EventRepository(db),
			sleep: new SleepRepository(db),
			feeding,
			diaper: new DiaperRepository(db),
			quickEvents: new QuickEventRepository(db),
			growth: new GrowthRepository(db),
			milestones: new MilestoneRepository(db),
			teeth: new ToothRepository(db),
			moments: new MomentRepository(db, photos),
			symptoms: new SymptomRepository(db, healthDocs),
			medicineCatalog: new MedicineCatalogRepository(db),
			doctorVisits: new DoctorVisitRepository(db),
			healthAttachments: new HealthAttachmentRepository(db, healthDocs),
			reminders,
			reminderService: new ReminderService({ reminders, feeding }),
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

	// One-shot reconciliation after repos are ready (not on every render).
	useEffect(() => {
		if (!ready || !repos.reminderService) {
			return
		}
		void repos.reminderService.reconcile().catch((err) => {
			logger.warn('reminder reconcile failed', {
				error: err instanceof Error ? err.message : String(err),
			})
		})
	}, [ready, repos.reminderService])

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
		growth: repos.growth,
		milestones: repos.milestones,
		teeth: repos.teeth,
		moments: repos.moments,
		symptoms: repos.symptoms,
		medicineCatalog: repos.medicineCatalog,
		doctorVisits: repos.doctorVisits,
		healthAttachments: repos.healthAttachments,
		reminders: repos.reminders,
		reminderService: repos.reminderService,
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
