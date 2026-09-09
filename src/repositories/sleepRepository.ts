/**
 * Sleep repository — events + event_sleep detail.
 * All queries go through the shared SqlExecutor (serialized in production).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import {
	assertNoOverlapWithExisting,
	assertSingleActive,
	assertSleepTiming,
	SleepValidationError,
} from '../domain/sleepValidation'
import type {
	ManualSleepInput,
	SleepEvent,
	SleepType,
	StartSleepInput,
	UpdateSleepInput,
} from '../models/sleep'
import { isSleepType } from '../models/sleep'
import {
	buildEventEnd,
	buildEventStart,
	localDateFromOffsetDateTime,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

interface SleepJoinRow {
	id: string
	child_id: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	sleep_type: string
	quality?: string | null
}

function mapSleep (row: SleepJoinRow): SleepEvent {
	if (!isSleepType(row.sleep_type)) {
		throw new Error(`Unknown sleep_type: ${row.sleep_type}`)
	}
	return {
		id: row.id,
		childId: row.child_id,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		sleepType: row.sleep_type,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

const SLEEP_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.end_at, e.start_local_date, e.end_local_date,
	       e.notes, e.created_at, e.updated_at, s.sleep_type, s.quality
	FROM events e
	INNER JOIN event_sleep s ON s.event_id = e.id
	WHERE e.type = 'sleep'
`

export class SleepRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<SleepEvent | null> {
		const row = await this.db.getFirstAsync<SleepJoinRow>(
			`${SLEEP_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapSleep(row) : null
	}

	async findActive (childId: string): Promise<SleepEvent | null> {
		const row = await this.db.getFirstAsync<SleepJoinRow>(
			`${SLEEP_SELECT} AND e.child_id = ? AND e.end_at IS NULL
			 ORDER BY e.start_at DESC LIMIT 1`,
			childId,
		)
		return row ? mapSleep(row) : null
	}

	async findLastFinished (childId: string): Promise<SleepEvent | null> {
		const row = await this.db.getFirstAsync<SleepJoinRow>(
			`${SLEEP_SELECT} AND e.child_id = ? AND e.end_at IS NOT NULL
			 ORDER BY e.end_at DESC LIMIT 1`,
			childId,
		)
		return row ? mapSleep(row) : null
	}

	async listByChild (childId: string, limit = 100): Promise<SleepEvent[]> {
		const rows = await this.db.getAllAsync<SleepJoinRow>(
			`${SLEEP_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapSleep)
	}

	/**
	 * Sleeps that may overlap a local civil day (start/end dates around the day).
	 * Exact ms overlap is computed in aggregation helpers.
	 */
	async listOverlappingLocalDay (
		childId: string,
		localDate: string,
	): Promise<SleepEvent[]> {
		const rows = await this.db.getAllAsync<SleepJoinRow>(
			`${SLEEP_SELECT} AND e.child_id = ?
			 AND e.start_local_date <= ?
			 AND (e.end_local_date IS NULL OR e.end_local_date >= ?)
			 ORDER BY e.start_at ASC`,
			childId,
			localDate,
			localDate,
		)
		return rows.map(mapSleep)
	}

	async start (input: StartSleepInput): Promise<SleepEvent> {
		const now = new Date()
		const startedAt = input.startedAt ?? toOffsetDateTime(now)
		assertSleepTiming(startedAt, null)

		const active = await this.findActive(input.childId)
		assertSingleActive(active)

		const existing = await this.listByChild(input.childId, 200)
		assertNoOverlapWithExisting(startedAt, null, existing)

		const start = buildEventStart(parseOffsetDateTime(startedAt))
		const sleepType: SleepType = input.sleepType ?? 'auto'
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (transactionDb) => {
			await transactionDb.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'sleep', ?, NULL, ?, NULL, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await transactionDb.runAsync(
				`INSERT INTO event_sleep (event_id, quality, sleep_type)
				 VALUES (?, NULL, ?)`,
				id,
				sleepType,
			)
		})

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to load created sleep')
		}
		return created
	}

	async finish (
		eventId: string,
		endedAt?: string,
	): Promise<SleepEvent> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new SleepValidationError('Запись сна не найдена')
		}
		if (existing.endAt != null) {
			throw new SleepValidationError('Этот сон уже завершён')
		}

		const endInstant = endedAt ?? toOffsetDateTime(new Date())
		assertSleepTiming(existing.startAt, endInstant)

		const others = await this.listByChild(existing.childId, 200)
		assertNoOverlapWithExisting(
			existing.startAt,
			endInstant,
			others,
			eventId,
		)

		const end = buildEventEnd(parseOffsetDateTime(endInstant))
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE events SET end_at = ?, end_local_date = ?, updated_at = ?
			 WHERE id = ?`,
			end.endAt,
			end.endLocalDate,
			audit,
			eventId,
		)

		const updated = await this.getById(eventId)
		if (!updated) {
			throw new Error('Failed to load finished sleep')
		}
		return updated
	}

	async createManual (input: ManualSleepInput): Promise<SleepEvent> {
		assertSleepTiming(input.startAt, input.endAt)

		const active = await this.findActive(input.childId)
		assertSingleActive(active)

		const existing = await this.listByChild(input.childId, 200)
		assertNoOverlapWithExisting(input.startAt, input.endAt, existing)

		const id = await createEntityId()
		const audit = nowUtcInstant()
		const startLocalDate = localDateFromOffsetDateTime(input.startAt)
		const endLocalDate = localDateFromOffsetDateTime(input.endAt)

		await this.db.withTransactionAsync(async (transactionDb) => {
			await transactionDb.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'sleep', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				input.startAt,
				input.endAt,
				startLocalDate,
				endLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await transactionDb.runAsync(
				`INSERT INTO event_sleep (event_id, quality, sleep_type)
				 VALUES (?, NULL, ?)`,
				id,
				input.sleepType,
			)
		})

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to load manual sleep')
		}
		return created
	}

	async update (eventId: string, input: UpdateSleepInput): Promise<SleepEvent> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new SleepValidationError('Запись сна не найдена')
		}

		const nextStart = input.startAt ?? existing.startAt
		const nextEnd =
			input.endAt !== undefined ? input.endAt : existing.endAt
		const nextType = input.sleepType ?? existing.sleepType
		const nextNotes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes

		assertSleepTiming(nextStart, nextEnd)

		if (nextEnd == null) {
			const active = await this.findActive(existing.childId)
			assertSingleActive(active, eventId)
		}

		const others = await this.listByChild(existing.childId, 200)
		assertNoOverlapWithExisting(nextStart, nextEnd, others, eventId)

		const audit = nowUtcInstant()
		const startLocalDate = localDateFromOffsetDateTime(nextStart)
		const endLocalDate =
			nextEnd != null ? localDateFromOffsetDateTime(nextEnd) : null

		await this.db.withTransactionAsync(async (transactionDb) => {
			await transactionDb.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				nextStart,
				nextEnd,
				startLocalDate,
				endLocalDate,
				nextNotes,
				audit,
				eventId,
			)
			await transactionDb.runAsync(
				`UPDATE event_sleep SET sleep_type = ? WHERE event_id = ?`,
				nextType,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated) {
			throw new Error('Failed to load updated sleep')
		}
		return updated
	}

	async delete (eventId: string): Promise<void> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new SleepValidationError('Запись сна не найдена')
		}
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
	}
}
