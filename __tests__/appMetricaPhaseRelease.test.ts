/**
 * Phase release-prep — AppMetrica analytics privacy + config.
 */

import {
	ANALYTICS_EVENTS,
	APPMETRICA_APP_ID,
	FORBIDDEN_ANALYTICS_PROP_KEYS,
	getAppMetricaApiKey,
	resetAnalyticsReporterForTests,
	sanitizeAnalyticsProps,
	setAnalyticsReporterForTests,
	trackAnalyticsEvent,
} from '../src/analytics'

describe('AppMetrica config', () => {
	it('uses the production App ID', () => {
		expect(APPMETRICA_APP_ID).toBe('d2ec0cc3-c329-4f17-86f7-5d820b2082dd')
		expect(getAppMetricaApiKey()).toBe(APPMETRICA_APP_ID)
	})
})

describe('analytics privacy sanitizer', () => {
	afterEach(() => {
		resetAnalyticsReporterForTests()
	})

	it('keeps allowlisted enum props only', () => {
		expect(
			sanitizeAnalyticsProps({
				feeding_type: 'bottle',
				diaper_kind: 'wet',
				name: 'Миша',
				temperature: '36.6',
				notes: 'secret',
				ml: 120,
			} as never),
		).toEqual({
			feeding_type: 'bottle',
			diaper_kind: 'wet',
		})
	})

	it('rejects free-text and forbidden keys', () => {
		const sanitized = sanitizeAnalyticsProps({
			source: 'today',
			child_name: 'Миша',
			birth_date: '2026-01-01',
			medicine: 'витамин',
			symptom: 'кашель',
			title: 'Произвольный текст',
		} as never)
		expect(sanitized).toEqual({ source: 'today' })
		for (const banned of ['name', 'medicine', 'symptom', 'title'] as const) {
			expect(
				FORBIDDEN_ANALYTICS_PROP_KEYS.includes(banned),
			).toBe(true)
		}
	})

	it('exposes the expected event catalog', () => {
		expect(ANALYTICS_EVENTS.appOpen).toBe('app_open')
		expect(ANALYTICS_EVENTS.reportCreated).toBe('report_created')
		expect(ANALYTICS_EVENTS.backupRestored).toBe('backup_restored')
	})

	it('never throws when the reporter fails', () => {
		setAnalyticsReporterForTests({
			reportEvent: () => {
				throw new Error('native analytics down')
			},
		})
		expect(() =>
			trackAnalyticsEvent(ANALYTICS_EVENTS.statisticsOpened, {
				period: '7',
			}),
		).not.toThrow()
	})

	it('forwards sanitized events to the reporter', () => {
		const calls: { name: string; props?: object }[] = []
		setAnalyticsReporterForTests({
			reportEvent: (name, props) => {
				calls.push({ name, props })
			},
		})
		trackAnalyticsEvent(ANALYTICS_EVENTS.feedingAdded, {
			feeding_type: 'breastfeeding',
			...({ notes: 'do-not-send' } as object),
		} as never)
		expect(calls).toEqual([
			{
				name: 'feeding_added',
				props: { feeding_type: 'breastfeeding' },
			},
		])
	})
})
