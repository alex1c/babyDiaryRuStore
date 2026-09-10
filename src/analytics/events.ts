/**
 * Allowlisted analytics event names and safe property keys.
 * Never add free-text or baby/health payload keys here.
 */

export const ANALYTICS_EVENTS = {
	appOpen: 'app_open',
	onboardingCompleted: 'onboarding_completed',
	trainingOpened: 'training_opened',
	trainingCompleted: 'training_completed',
	sleepStarted: 'sleep_started',
	sleepFinished: 'sleep_finished',
	feedingAdded: 'feeding_added',
	diaperAdded: 'diaper_added',
	developmentOpened: 'development_opened',
	healthOpened: 'health_opened',
	statisticsOpened: 'statistics_opened',
	reportCreated: 'report_created',
	reportShared: 'report_shared',
	backupCreated: 'backup_created',
	backupRestored: 'backup_restored',
	reminderCreated: 'reminder_created',
	childAdded: 'child_added',
} as const

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** Coarse enum-only props — never notes, names, doses, temperatures, etc. */
export type SafeAnalyticsProps = {
	feeding_type?: 'breastfeeding' | 'bottle' | 'solid' | 'water' | 'pumping' | 'manual'
	diaper_kind?: 'wet' | 'dirty' | 'both' | 'dry'
	backup_kind?: 'compact' | 'full'
	reminder_type?: string
	source?: 'onboarding' | 'settings' | 'today' | 'manual'
	period?: '7' | '30' | '90' | 'all' | 'custom'
	report_kind?: 'period' | 'first_year' | 'share_text'
}

export const SAFE_ANALYTICS_PROP_KEYS = new Set<keyof SafeAnalyticsProps>([
	'feeding_type',
	'diaper_kind',
	'backup_kind',
	'reminder_type',
	'source',
	'period',
	'report_kind',
])

/** Explicit denylist — substring/exact matches blocked in sanitizer. */
export const FORBIDDEN_ANALYTICS_PROP_KEYS = [
	'name',
	'child_name',
	'birth',
	'birth_date',
	'age',
	'photo',
	'notes',
	'note',
	'medicine',
	'medication',
	'symptom',
	'temperature',
	'celsius',
	'weight',
	'height',
	'ml',
	'duration',
	'seconds',
	'pdf',
	'backup',
	'path',
	'uri',
	'filename',
	'content',
	'title',
	'text',
] as const
