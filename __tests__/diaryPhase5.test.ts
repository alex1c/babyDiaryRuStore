/**
 * Phase 5 — diary day labels, day load, search, filters, overnight sleep.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { ChildRepository } from '../src/repositories/childRepository'
import { DiaperRepository } from '../src/repositories/diaperRepository'
import { FeedingRepository } from '../src/repositories/feedingRepository'
import { QuickEventRepository } from '../src/repositories/quickEventRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import {
	clampLocalDateToToday,
	formatDiaryDayLabel,
	shiftLocalDate,
} from '../src/presentation/diaryDayLabels'
import {
	loadDiaryDay,
} from '../src/presentation/diaryLoad'
import {
	matchesDiaryFilters,
	matchesDiarySearch,
	sleepToTimelineForDay,
} from '../src/presentation/diaryTimeline'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const sleep = new SleepRepository(db)
	const feeding = new FeedingRepository(db)
	const diaper = new DiaperRepository(db)
	const quickEvents = new QuickEventRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-06-01',
	})
	return {
		db,
		repos: { sleep, feeding, diaper, quickEvents },
		childId: child.id,
	}
}

describe('diary day labels', () => {
	it('formats today / yesterday / weekday', () => {
		expect(formatDiaryDayLabel('2026-09-09', '2026-09-09')).toBe(
			'Сегодня, 9 сентября',
		)
		expect(formatDiaryDayLabel('2026-09-08', '2026-09-09')).toBe(
			'Вчера, 8 сентября',
		)
		expect(formatDiaryDayLabel('2026-09-06', '2026-09-09')).toContain(
			'6 сентября',
		)
		expect(formatDiaryDayLabel('2026-09-06', '2026-09-09')).toContain(
			'воскресенье',
		)
	})

	it('clamps future dates and shifts days', () => {
		expect(clampLocalDateToToday('2026-09-20', '2026-09-09')).toBe(
			'2026-09-09',
		)
		expect(shiftLocalDate('2026-09-09', -1)).toBe('2026-09-08')
		expect(shiftLocalDate('2026-09-09', 1)).toBe('2026-09-10')
	})
})

describe('diary day load', () => {
	it('returns only the target day and builds summary', async () => {
		const { repos, childId } = await setup()
		await repos.diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T14:20:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'dirty',
			occurredAt: '2026-09-08T10:00:00+03:00',
		})
		await repos.feeding.createBottle({
			childId,
			content: 'formula',
			amountMl: 120,
			occurredAt: '2026-09-09T12:00:00+03:00',
		})

		const day = await loadDiaryDay(repos, childId, '2026-09-09')
		expect(day.rows.every((r) => r.groupLocalDate === '2026-09-09')).toBe(
			true,
		)
		expect(day.rows).toHaveLength(2)
		expect(day.summary.feedingCount).toBe(1)
		expect(day.summary.diaperCount).toBe(1)
		expect(day.summary.rows).toHaveLength(3)
	})

	it('shows overnight sleep on the morning day', async () => {
		const { repos, childId } = await setup()
		const started = await repos.sleep.start({
			childId,
			startedAt: '2026-09-08T23:10:00+03:00',
			sleepType: 'night',
		})
		await repos.sleep.finish(started.id, '2026-09-09T07:30:00+03:00')

		const day = await loadDiaryDay(
			repos,
			childId,
			'2026-09-09',
			new Date('2026-09-09T12:00:00+03:00').getTime(),
		)
		const sleepRow = day.rows.find((r) => r.kind === 'sleep')
		expect(sleepRow).toBeTruthy()
		expect(sleepRow?.title).toBe('Сон')
		expect(sleepRow?.groupLocalDate).toBe('2026-09-09')

		const presentation = sleepToTimelineForDay(
			(await repos.sleep.getById(started.id))!,
			'2026-09-09',
			new Date('2026-09-09T12:00:00+03:00').getTime(),
		)
		expect(presentation.isActive).toBe(false)
		expect(presentation.subtitle).toContain('ч')
	})

	it('marks active sleep as идёт', async () => {
		const { repos, childId } = await setup()
		await repos.sleep.start({
			childId,
			startedAt: '2026-09-09T18:20:00+03:00',
		})
		const day = await loadDiaryDay(
			repos,
			childId,
			'2026-09-09',
			new Date('2026-09-09T19:00:00+03:00').getTime(),
		)
		const sleepRow = day.rows.find((r) => r.kind === 'sleep')
		expect(sleepRow?.isActive).toBe(true)
		expect(sleepRow?.subtitle).toContain('идёт')
		expect(sleepRow?.timeLabel).toContain('сейчас')
	})

	it('returns empty day bundle with zero summary', async () => {
		const { repos, childId } = await setup()
		const day = await loadDiaryDay(repos, childId, '2026-09-01')
		expect(day.rows).toHaveLength(0)
		expect(day.summary.feedingCount).toBe(0)
		expect(day.summary.diaperCount).toBe(0)
	})
})

describe('diary search and filters', () => {
	it('searches notes, medicine, solid food, custom by text', async () => {
		const { repos, childId } = await setup()
		await repos.quickEvents.createNote({
			childId,
			notes: 'визит к бабушке',
			occurredAt: '2026-09-09T10:00:00+03:00',
		})
		await repos.quickEvents.createMedicine({
			childId,
			kind: 'medicine',
			name: 'Нурофен',
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await repos.feeding.createSolid({
			childId,
			foodName: 'кабачок',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		const def = await repos.quickEvents.createCustomDefinition({
			childId,
			name: 'Бассейн',
		})
		await repos.quickEvents.createCustomEvent({
			childId,
			definitionId: def.id,
			occurredAt: '2026-09-09T17:30:00+03:00',
		})

		const day = await loadDiaryDay(repos, childId, '2026-09-09')
		expect(
			day.rows.filter((r) => matchesDiarySearch(r, 'бабушке')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) => matchesDiarySearch(r, 'нурофен')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) => matchesDiarySearch(r, 'Кабачок')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) => matchesDiarySearch(r, 'бассейн')),
		).toHaveLength(1)
	})

	it('filters sleep / feeding / diaper / other', async () => {
		const { repos, childId } = await setup()
		await repos.sleep.start({
			childId,
			startedAt: '2026-09-09T10:00:00+03:00',
		})
		await repos.feeding.createBottle({
			childId,
			content: 'formula',
			amountMl: 90,
			occurredAt: '2026-09-09T11:00:00+03:00',
		})
		await repos.diaper.create({
			childId,
			kind: 'wet',
			occurredAt: '2026-09-09T12:00:00+03:00',
		})
		await repos.quickEvents.createActivity({
			childId,
			type: 'walk',
			occurredAt: '2026-09-09T13:00:00+03:00',
		})

		const day = await loadDiaryDay(
			repos,
			childId,
			'2026-09-09',
			new Date('2026-09-09T14:00:00+03:00').getTime(),
		)
		expect(
			day.rows.filter((r) => matchesDiaryFilters(r, 'sleep', 'all')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) => matchesDiaryFilters(r, 'feeding', 'all')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) => matchesDiaryFilters(r, 'diaper', 'all')),
		).toHaveLength(1)
		expect(
			day.rows.filter((r) =>
				matchesDiaryFilters(r, 'other', 'activity'),
			),
		).toHaveLength(1)
	})
})
