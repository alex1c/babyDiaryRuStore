/**
 * Phase 9 — share text, PDF data/HTML, export paths, first-year report.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { buildHealthReportData } from '../src/domain/healthReport'
import { buildFirstYearReportData } from '../src/domain/firstYearReport'
import { firstYearMonthKey } from '../src/domain/firstYearFoundation'
import {
	buildPeriodPdfHtml,
	escapeHtml,
} from '../src/domain/pdfReportHtml'
import {
	DEFAULT_PDF_SECTIONS,
	hasAnyPdfSection,
} from '../src/domain/pdfReportOptions'
import {
	buildReportChronology,
	chunkChronologyRows,
} from '../src/domain/reportChronology'
import {
	formatReportPeriodTitle,
	resolveReportPeriod,
	validateCustomReportRange,
} from '../src/domain/reportPeriod'
import { formatShareSummaryText } from '../src/domain/shareSummaryText'
import {
	buildPdfFileName,
	resolveExportFileUri,
	resolveExportsDirectory,
	selectExportFilesToDelete,
} from '../src/services/pdfExportStorage'
import {
	hasPdfInterstitialBeenShownThisSession,
	resetPdfAdSessionForTests,
	runAfterFreshPdfGenerated,
} from '../src/services/pdfAdFlow'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { DoctorVisitRepository } from '../src/repositories/doctorVisitRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { GrowthRepository } from '../src/repositories/growthRepository'
import { MilestoneRepository } from '../src/repositories/milestoneRepository'
import { MomentRepository } from '../src/repositories/momentRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import { SymptomRepository } from '../src/repositories/symptomRepository'
import { ToothRepository } from '../src/repositories/toothRepository'
import { createMemoryPhotoStorage } from '../src/services/photoStorage'
import { loadPeriodReportBundle } from '../src/presentation/loadReportBundle'
import { loadFirstYearReport } from '../src/presentation/loadFirstYearReport'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const child = await children.create({
		name: 'Миша',
		birthDate: '2026-05-01',
	})
	const healthDocs = createMemoryPhotoStorage('health-documents/')
	const photos = createMemoryPhotoStorage('moments/')
	const repos = {
		sleep: new SleepRepository(db),
		feeding: new FeedingRepository(db),
		diaper: new DiaperRepository(db),
		growth: new GrowthRepository(db),
		quickEvents: new QuickEventRepository(db),
		symptoms: new SymptomRepository(db, healthDocs),
		doctorVisits: new DoctorVisitRepository(db),
		milestones: new MilestoneRepository(db),
		teeth: new ToothRepository(db),
		moments: new MomentRepository(db, photos),
	}
	return { db, child, repos, childId: child.id }
}

describe('report periods', () => {
	it('resolves today / 7 / 30 / 90 and custom', () => {
		const today = resolveReportPeriod('today', '2026-09-09')
		expect(today.startDate).toBe('2026-09-09')
		expect(today.dayCount).toBe(1)
		expect(resolveReportPeriod('7', '2026-09-09').dayCount).toBe(7)
		expect(resolveReportPeriod('30', '2026-09-09').dayCount).toBe(30)
		expect(resolveReportPeriod('90', '2026-09-09').dayCount).toBe(90)
		const custom = resolveReportPeriod('custom', '2026-09-09', {
			startDate: '2026-08-01',
			endDate: '2026-08-15',
		})
		expect(custom.dayCount).toBe(15)
		expect(formatReportPeriodTitle(today, '2026-09-09')).toContain('Сегодня')
	})

	it('rejects invalid custom ranges', () => {
		expect(
			validateCustomReportRange('2026-09-10', '2026-09-01', '2026-09-09'),
		).toBeTruthy()
		expect(
			validateCustomReportRange('2026-09-01', '2026-09-20', '2026-09-09'),
		).toBeTruthy()
		expect(
			validateCustomReportRange('2026-09-01', '2026-09-09', '2026-09-09'),
		).toBeNull()
	})
})

describe('share summary text', () => {
	it('formats today with Russian labels and skips empty noise', async () => {
		const { repos, child, childId } = await setup()
		await repos.sleep.createManual({
			childId,
			startAt: '2026-09-09T01:00:00+03:00',
			endAt: '2026-09-09T08:00:00+03:00',
			sleepType: 'night',
		})
		await repos.feeding.createBottle({
			childId,
			amountMl: 120,
			content: 'formula',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await repos.feeding.createWater({
			childId,
			amountMl: 40,
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.quickEvents.createTemperature({
			childId,
			celsiusRaw: '36,8',
			occurredAt: '2026-09-09T13:00:00+03:00',
		})

		const bundle = await loadPeriodReportBundle(
			repos,
			child,
			'today',
			{ today: '2026-09-09' },
		)
		const text = formatShareSummaryText({
			report: bundle.report,
			period: bundle.period,
			health: bundle.health,
			today: '2026-09-09',
		})
		expect(text).toContain('Миша')
		expect(text).toContain('Сегодня')
		expect(text).toContain('Сон:')
		expect(text).toContain('Смесь: 120 мл')
		expect(text).toContain('Вода: 40 мл')
		expect(text).toContain('Подгузники:')
		expect(text).toContain('36,8')
		expect(text).not.toContain('expressed_milk')
		expect(text).not.toContain('formula')
	})

	it('formats 7-day averages', async () => {
		const { repos, child, childId } = await setup()
		await repos.sleep.createManual({
			childId,
			startAt: '2026-09-08T20:00:00+03:00',
			endAt: '2026-09-09T06:00:00+03:00',
			sleepType: 'night',
		})
		const bundle = await loadPeriodReportBundle(repos, child, '7', {
			today: '2026-09-09',
		})
		const text = formatShareSummaryText({
			report: bundle.report,
			period: bundle.period,
			health: bundle.health,
			today: '2026-09-09',
		})
		expect(text).toContain('в среднем')
	})
})

describe('pdf report data and html', () => {
	it('builds HTML with selected sections, chronology order, Russian numbers', async () => {
		const { repos, child, childId } = await setup()
		await repos.sleep.createManual({
			childId,
			startAt: '2026-09-09T10:00:00+03:00',
			endAt: '2026-09-09T11:00:00+03:00',
			sleepType: 'day',
		})
		await repos.feeding.createBottle({
			childId,
			amountMl: 90,
			content: 'expressed_milk',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.growth.create({
			childId,
			weightKgRaw: '6,4',
			measuredAt: '2026-09-01T12:00:00+03:00',
		})
		await repos.growth.create({
			childId,
			weightKgRaw: '6,8',
			measuredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.milestones.create({
			childId,
			milestoneType: 'first_smile',
			occurredAt: '2026-09-05T12:00:00+03:00',
		})

		const bundle = await loadPeriodReportBundle(repos, child, '30', {
			today: '2026-09-09',
		})
		expect(bundle.report.growth.weightDeltaGrams).toBe(400)
		expect(bundle.chronology.length).toBeGreaterThan(0)
		const sorted = [...bundle.chronology].sort((a, b) =>
			a.sortAt.localeCompare(b.sortAt),
		)
		expect(bundle.chronology.map((r) => r.sortAt)).toEqual(
			sorted.map((r) => r.sortAt),
		)

		const sections = { ...DEFAULT_PDF_SECTIONS, chronology: true }
		expect(hasAnyPdfSection(sections)).toBe(true)
		const html = buildPeriodPdfHtml({
			report: bundle.report,
			period: bundle.period,
			sections,
			health: bundle.health,
			chronology: bundle.chronology,
			milestones: bundle.milestones,
			generatedAtDate: '2026-09-09',
		})
		expect(html).toContain('Миша')
		expect(html).toContain('Сон')
		expect(html).toContain('Сцеженное молоко')
		expect(html).toContain('6,4')
		expect(html).not.toContain('6.399999')
		expect(html).not.toContain('expressed_milk')
		expect(html).toContain('Хронология')
		expect(escapeHtml('<x>')).toBe('&lt;x&gt;')
	})

	it('handles empty period and custom range', async () => {
		const { repos, child } = await setup()
		const empty = await loadPeriodReportBundle(repos, child, 'today', {
			today: '2026-09-09',
		})
		expect(empty.report.sleep.hasAnyData).toBe(false)
		const html = buildPeriodPdfHtml({
			report: empty.report,
			period: empty.period,
			sections: DEFAULT_PDF_SECTIONS,
			health: empty.health,
			chronology: [],
			milestones: [],
			generatedAtDate: '2026-09-09',
		})
		expect(html).toContain('Недостаточно данных')

		const custom = await loadPeriodReportBundle(repos, child, 'custom', {
			today: '2026-09-09',
			custom: { startDate: '2026-08-01', endDate: '2026-08-10' },
		})
		expect(custom.period.dayCount).toBe(10)
	})

	it('chunks huge chronology without dropping rows', () => {
		const rows = Array.from({ length: 80 }, (_, i) => ({
			sortAt: `2026-09-01T${String(i).padStart(2, '0')}:00:00+03:00`,
			localDate: '2026-09-01',
			dateTimeLabel: `row ${i}`,
			eventLabel: 'Сон',
			details: 'x',
		}))
		const chunks = chunkChronologyRows(rows, 35)
		expect(chunks).toHaveLength(3)
		expect(chunks.flat()).toHaveLength(80)
	})
})

describe('pdf export storage', () => {
	it('builds export path, unique names, cleanup list', () => {
		expect(
			buildPdfFileName({
				kind: 'period',
				date: '2026-09-09',
				startDate: '2026-09-03',
				endDate: '2026-09-09',
			}),
		).toBe('baby-diary-report-2026-09-03_2026-09-09.pdf')
		expect(
			resolveExportsDirectory('file:///data/'),
		).toBe('file:///data/exports/')
		expect(
			resolveExportFileUri('file:///data/', 'a.pdf'),
		).toBe('file:///data/exports/a.pdf')
		const deleteNames = selectExportFilesToDelete(
			Array.from({ length: 25 }, (_, i) => `f-${String(i).padStart(2, '0')}.pdf`),
			20,
		)
		expect(deleteNames).toHaveLength(5)
	})

	it('ad flow marks session once and never blocks', async () => {
		resetPdfAdSessionForTests()
		expect(hasPdfInterstitialBeenShownThisSession()).toBe(false)
		await runAfterFreshPdfGenerated()
		expect(hasPdfInterstitialBeenShownThisSession()).toBe(true)
		await runAfterFreshPdfGenerated()
		expect(hasPdfInterstitialBeenShownThisSession()).toBe(true)
	})
})

describe('first year foundation report', () => {
	it('builds 12 months with missing photos and milestone/growth association', async () => {
		const { repos, child, childId } = await setup()
		await repos.growth.create({
			childId,
			weightKgRaw: '4,5',
			measuredAt: '2026-05-15T12:00:00+03:00',
		})
		await repos.milestones.create({
			childId,
			milestoneType: 'first_smile',
			occurredAt: '2026-05-20T12:00:00+03:00',
		})
		const moment = await repos.moments.create({
			childId,
			photoUri: 'file:///mem/photo.jpg',
			takenAt: '2026-06-10T12:00:00+03:00',
			title: 'Улыбка',
		})
		await repos.moments.setMonthPhoto(
			childId,
			moment.id,
			firstYearMonthKey(child.birthDate, 2),
		)

		const report = await loadFirstYearReport(repos, child, '2026-09-09')
		expect(report.months).toHaveLength(12)
		expect(report.months[0]?.milestones.length).toBe(1)
		expect(report.months[0]?.measurements.length).toBe(1)
		expect(report.months[0]?.monthPhoto).toBeNull()
		expect(report.months[1]?.monthPhoto?.id).toBe(moment.id)

		const pure = buildFirstYearReportData({
			child,
			measurements: report.months.flatMap((m) => m.measurements),
			milestones: report.months.flatMap((m) => m.milestones),
			teeth: [],
			moments: [moment],
			monthPhotos: [
				{
					id: 'mp1',
					childId,
					monthKey: firstYearMonthKey(child.birthDate, 2),
					momentId: moment.id,
					createdAt: '2026-09-09T00:00:00.000Z',
					updatedAt: '2026-09-09T00:00:00.000Z',
				},
			],
			generatedLocalDate: '2026-09-09',
		})
		expect(pure.months[1]?.monthPhoto?.id).toBe(moment.id)
	})
})

describe('health summary for pdf', () => {
	it('aggregates temps min/max', () => {
		const health = buildHealthReportData({
			periodStart: '2026-09-01',
			periodEnd: '2026-09-09',
			temperatures: [
				{
					id: '1',
					childId: 'c',
					startAt: '2026-09-02T10:00:00+03:00',
					endAt: '2026-09-02T10:00:00+03:00',
					startLocalDate: '2026-09-02',
					endLocalDate: '2026-09-02',
					notes: null,
					createdAt: 'x',
					updatedAt: 'x',
					celsius: 36.6,
					method: 'unset',
				},
				{
					id: '2',
					childId: 'c',
					startAt: '2026-09-03T10:00:00+03:00',
					endAt: '2026-09-03T10:00:00+03:00',
					startLocalDate: '2026-09-03',
					endLocalDate: '2026-09-03',
					notes: null,
					createdAt: 'x',
					updatedAt: 'x',
					celsius: 38.2,
					method: 'unset',
				},
			],
			symptoms: [],
			medicines: [],
			doctorVisits: [],
		})
		expect(health.temperatureMin).toBe(36.6)
		expect(health.temperatureMax).toBe(38.2)
	})
})

describe('chronology builder unit', () => {
	it('orders mixed events', () => {
		const rows = buildReportChronology({
			sleeps: [],
			feedings: [],
			diapers: [
				{
					id: 'd1',
					childId: 'c',
					startAt: '2026-09-09T11:00:00+03:00',
					endAt: '2026-09-09T11:00:00+03:00',
					startLocalDate: '2026-09-09',
					endLocalDate: '2026-09-09',
					notes: null,
					createdAt: 'x',
					updatedAt: 'x',
					kind: 'wet',
					wet: true,
					dirty: false,
					hasRash: false,
					color: null,
					consistency: null,
				},
			],
			temperatures: [],
			medicines: [],
			symptoms: [],
			doctorVisits: [],
			milestones: [],
			measurements: [],
			periodStart: '2026-09-09',
			periodEnd: '2026-09-09',
		})
		expect(rows[0]?.eventLabel).toBe('Подгузник')
		expect(rows[0]?.details).toBe('Мокрый')
	})
})
