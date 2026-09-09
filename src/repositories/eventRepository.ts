/**
 * Base event repository — shared CRUD for all diary event types.
 * Typed detail tables are filled by later phase services; Phase 0 stores the base row.
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import {
	isEventType,
	type CreateEventInput,
	type DiaryEvent,
	type EventType,
	type UpdateEventInput,
} from '../models/types'
import {
	isValidDateOnly,
	localDateFromOffsetDateTime,
	nowUtcInstant,
	parseOffsetDateTime,
} from '../utils/datetime'

interface EventRow {
	id: string
	child_id: string
	type: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	title: string | null
	notes: string | null
	created_at: string
	updated_at: string
}

function mapEvent (row: EventRow): DiaryEvent {
	if (!isEventType(row.type)) {
		throw new Error(`Unknown event type in database: ${row.type}`)
	}
	return {
		id: row.id,
		childId: row.child_id,
		type: row.type,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		title: row.title,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function assertEventTiming (
	startAt: string,
	endAt: string | null | undefined,
	startLocalDate: string,
	endLocalDate: string | null | undefined,
): void {
	if (!isValidDateOnly(startLocalDate)) {
		throw new Error(`Invalid startLocalDate: ${startLocalDate}`)
	}
	// Ensure startAt is parseable (absolute timestamp, not bare "09:30").
	parseOffsetDateTime(startAt)
	if (localDateFromOffsetDateTime(startAt) !== startLocalDate) {
		throw new Error(
			'startLocalDate must match the civil date embedded in startAt',
		)
	}
	if (endAt != null) {
		parseOffsetDateTime(endAt)
		if (parseOffsetDateTime(endAt).getTime() < parseOffsetDateTime(startAt).getTime()) {
			throw new Error('endAt must be >= startAt')
		}
		if (endLocalDate != null && !isValidDateOnly(endLocalDate)) {
			throw new Error(`Invalid endLocalDate: ${endLocalDate}`)
		}
		if (
			endLocalDate != null &&
			localDateFromOffsetDateTime(endAt) !== endLocalDate
		) {
			throw new Error(
				'endLocalDate must match the civil date embedded in endAt',
			)
		}
	}
}

export class EventRepository {
	constructor (private readonly db: SqlExecutor) {}

	async create (input: CreateEventInput): Promise<DiaryEvent> {
		if (!isEventType(input.type)) {
			throw new Error(`Unsupported event type: ${input.type}`)
		}
		assertEventTiming(
			input.startAt,
			input.endAt ?? null,
			input.startLocalDate,
			input.endLocalDate ?? null,
		)

		const now = nowUtcInstant()
		const event: DiaryEvent = {
			id: await createEntityId(),
			childId: input.childId,
			type: input.type,
			startAt: input.startAt,
			endAt: input.endAt ?? null,
			startLocalDate: input.startLocalDate,
			endLocalDate: input.endLocalDate ?? null,
			title: input.title?.trim() || null,
			notes: input.notes?.trim() || null,
			createdAt: now,
			updatedAt: now,
		}

		await this.db.runAsync(
			`INSERT INTO events (
				id, child_id, type, start_at, end_at,
				start_local_date, end_local_date, title, notes,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			event.id,
			event.childId,
			event.type,
			event.startAt,
			event.endAt,
			event.startLocalDate,
			event.endLocalDate,
			event.title,
			event.notes,
			event.createdAt,
			event.updatedAt,
		)

		return event
	}

	async getById (id: string): Promise<DiaryEvent | null> {
		const row = await this.db.getFirstAsync<EventRow>(
			'SELECT * FROM events WHERE id = ?',
			id,
		)
		return row ? mapEvent(row) : null
	}

	async listByChild (
		childId: string,
		limit = 100,
	): Promise<DiaryEvent[]> {
		const rows = await this.db.getAllAsync<EventRow>(
			`SELECT * FROM events WHERE child_id = ?
			 ORDER BY start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapEvent)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<DiaryEvent[]> {
		if (!isValidDateOnly(localDate)) {
			throw new Error(`Invalid localDate: ${localDate}`)
		}
		const rows = await this.db.getAllAsync<EventRow>(
			`SELECT * FROM events
			 WHERE child_id = ? AND start_local_date = ?
			 ORDER BY start_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapEvent)
	}

	async listByChildAndType (
		childId: string,
		type: EventType,
		limit = 20,
	): Promise<DiaryEvent[]> {
		const rows = await this.db.getAllAsync<EventRow>(
			`SELECT * FROM events
			 WHERE child_id = ? AND type = ?
			 ORDER BY start_at DESC LIMIT ?`,
			childId,
			type,
			limit,
		)
		return rows.map(mapEvent)
	}

	async update (id: string, input: UpdateEventInput): Promise<DiaryEvent> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error(`Event not found: ${id}`)
		}

		const next: DiaryEvent = {
			...existing,
			startAt: input.startAt ?? existing.startAt,
			endAt: input.endAt !== undefined ? input.endAt : existing.endAt,
			startLocalDate: input.startLocalDate ?? existing.startLocalDate,
			endLocalDate:
				input.endLocalDate !== undefined
					? input.endLocalDate
					: existing.endLocalDate,
			title:
				input.title !== undefined
					? input.title?.trim() || null
					: existing.title,
			notes:
				input.notes !== undefined
					? input.notes?.trim() || null
					: existing.notes,
			updatedAt: nowUtcInstant(),
		}

		assertEventTiming(
			next.startAt,
			next.endAt,
			next.startLocalDate,
			next.endLocalDate,
		)

		await this.db.runAsync(
			`UPDATE events SET
				start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
				title = ?, notes = ?, updated_at = ?
			 WHERE id = ?`,
			next.startAt,
			next.endAt,
			next.startLocalDate,
			next.endLocalDate,
			next.title,
			next.notes,
			next.updatedAt,
			id,
		)

		return next
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM events WHERE id = ?', id)
	}
}
