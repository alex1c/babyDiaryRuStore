/**
 * Public analytics API for the baby diary app.
 */

export { AnalyticsProvider } from './AnalyticsProvider'
export {
	sanitizeAnalyticsProps,
	trackAnalyticsEvent,
	setAnalyticsReporterForTests,
	resetAnalyticsReporterForTests,
} from './analyticsService'
export {
	initializeAppMetrica,
	resetAppMetricaForTests,
	getAppMetricaModule,
} from './appMetricaAdapter'
export {
	ANALYTICS_EVENTS,
	FORBIDDEN_ANALYTICS_PROP_KEYS,
	SAFE_ANALYTICS_PROP_KEYS,
	type AnalyticsEventName,
	type SafeAnalyticsProps,
} from './events'
export { APPMETRICA_APP_ID, getAppMetricaApiKey } from './config'
