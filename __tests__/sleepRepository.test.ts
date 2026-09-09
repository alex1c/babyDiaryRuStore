/**
 * Sleep repository — start/finish/manual/edit/overlap/recovery.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import { LATEST_SCHEMA_VERSION } from '../src/db/migrations'
import { ChildRepository } from '../src/repositories/childRepository'
import { SleepRepository } from '../src/repositories/sleepRepository'
import { SleepValidationError } from '../src/domain/sleepValidation'
import { aggregateSleepForLocalDay } from '../src/domain/sleepAggregation'
import { durationBetweenMs, formatDurationMs } from '../src/utils/durationFormat'
import { toLocalDateOnly, toOffsetDateTime } from '../src/utils/datetime'

async function setup () {
	const db = new MemorySqlExecutor()
	db.markMigrated(LATEST_SCHEMA_VERSION)
	const children = new ChildRepository(db)
	const sleep = new SleepRepository(db)
	const child = await children.create({
		name: 'Тест',
		birthDate: '2026-06-01',
	})
	return { db, sleep, childId: child.id }
}

describe('SleepRepository', () => {
	it('starts sleep immediately and recovers active sleep', async () => {
		const { sleep, childId } = await setup()
		const started = await sleep.start({
			childId,
			startedAt: '2026-09-09T13:10:00+03:00',
		})
		expect(started.endAt).toBeNull()

		const active = await sleep.findActive(childId)
		expect(active?.id).toBe(started.id)
		expect(active?.startAt).toBe('2026-09-09T13:10:00+03:00')

		const now = new Date('2026-09-09T14:00:00+03:00').getTime()
		expect(formatDurationMs(durationBetweenMs(active!.startAt, null, now))).toBe(
			'50 мин',
		)
	})

	it('prevents a second active sleep', async () => {
		const { sleep, childId } = await setup()
		await sleep.start({
			childId,
			startedAt: '2026-09-09T10:00:00+03:00',
		})
		await expect(
			sleep.start({
				childId,
				startedAt: '2026-09-09T11:00:00+03:00',
			}),
		).rejects.toBeInstanceOf(SleepValidationError)
	})

	it('finishes sleep and exposes wake window start', async () => {
		const { sleep, childId } = await setup()
		const started = await sleep.start({
			childId,
			startedAt: '2026-09-09T12:00:00+03:00',
		})
		const finished = await sleep.finish(
			started.id,
			'2026-09-09T13:18:00+03:00',
		)
		expect(finished.endAt).toBe('2026-09-09T13:18:00+03:00')
		expect(await sleep.findActive(childId)).toBeNull()

		const last = await sleep.findLastFinished(childId)
		expect(last?.endAt).toBe('2026-09-09T13:18:00+03:00')
		expect(
			formatDurationMs(
				durationBetweenMs(
					finished.startAt,
					finished.endAt,
				),
			),
		).toBe('1 ч 18 мин')
	})

	it('creates manual overnight sleep and rejects overlaps', async () => {
		const { sleep, childId } = await setup()
		await sleep.createManual({
			childId,
			startAt: '2026-09-08T22:00:00+03:00',
			endAt: '2026-09-09T06:00:00+03:00',
			sleepType: 'night',
		})

		await expect(
			sleep.createManual({
				childId,
				startAt: '2026-09-09T05:00:00+03:00',
				endAt: '2026-09-09T07:00:00+03:00',
				sleepType: 'day',
			}),
		).rejects.toThrow(/пересекается/)
	})

	it('edits and deletes sleep', async () => {
		const { sleep, childId } = await setup()
		const created = await sleep.createManual({
			childId,
			startAt: '2026-09-09T10:20:00+03:00',
			endAt: '2026-09-09T11:45:00+03:00',
			sleepType: 'auto',
		})

		const updated = await sleep.update(created.id, {
			startAt: '2026-09-09T10:15:00+03:00',
			sleepType: 'day',
			notes: 'исправлено',
		})
		expect(updated.startAt).toBe('2026-09-09T10:15:00+03:00')
		expect(updated.sleepType).toBe('day')
		expect(updated.notes).toBe('исправлено')

		await sleep.delete(created.id)
		expect(await sleep.getById(created.id)).toBeNull()
	})

	it('rejects end before start and far-future starts', async () => {
		const { sleep, childId } = await setup()
		await expect(
			sleep.createManual({
				childId,
				startAt: '2026-09-09T12:00:00+03:00',
				endAt: '2026-09-09T11:00:00+03:00',
				sleepType: 'day',
			}),
		).rejects.toThrow(/раньше начала|before/i)

		await expect(
			sleep.start({
				childId,
				startedAt: '2099-01-01T12:00:00+03:00',
			}),
		).rejects.toThrow(/будущем/)
	})

	it('aggregates midnight-crossing sleep into the correct local day', async () => {
		const { sleep, childId } = await setup()
		await sleep.createManual({
			childId,
			startAt: '2026-09-08T22:00:00+03:00',
			endAt: '2026-09-09T06:00:00+03:00',
			sleepType: 'night',
		})

		const daySleeps = await sleep.listOverlappingLocalDay(
			childId,
			'2026-09-09',
		)
		const agg = aggregateSleepForLocalDay(
			daySleeps,
			'2026-09-09',
			new Date('2026-09-09T12:00:00+03:00').getTime(),
		)
		// Only 00:00–06:00 on Sep 9 = 6 hours.
		expect(agg.totalMs).toBe(6 * 60 * 60 * 1000)
		expect(agg.nightMs).toBe(6 * 60 * 60 * 1000)
		expect(agg.finishedCount).toBe(1)
	})

	it('includes active sleep slice in today aggregate', async () => {
		const { sleep, childId } = await setup()
		const now = Date.now()
		const startAt = toOffsetDateTime(new Date(now - 20 * 60_000))
		const localDate = toLocalDateOnly(new Date(now - 20 * 60_000))

		await sleep.start({ childId, startedAt: startAt })
		const daySleeps = await sleep.listOverlappingLocalDay(childId, localDate)
		const agg = aggregateSleepForLocalDay(daySleeps, localDate, now)
		expect(agg.includesActive).toBe(true)
		expect(agg.totalMs).toBeGreaterThanOrEqual(19 * 60_000)
		expect(agg.totalMs).toBeLessThanOrEqual(21 * 60_000)
	})
})
