/**
 * Diaper repository — one-tap create + optional detail edit.
 * Transactions use transactionDb directly (never re-enter the FIFO queue).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import type {
	CreateDiaperInput,
	DiaperEvent,
	UpdateDiaperInput,
} from '../models/diaper'
import {
	diaperFlagsFromKind,
	diaperKindFromFlags,
} from '../models/diaper'
import {
	buildEventStart,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

interface DiaperJoinRow {
	id: string
	child_id: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	wet: number
	dirty: number
	has_rash: number
	color: string | null
	consistency: string | null
}

const DIAPER_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at,
	       d.wet, d.dirty, d.has_rash, d.color, d.consistency
	FROM events e
	INNER JOIN event_diaper d ON d.event_id = e.id
	WHERE e.type = 'diaper'
`

function mapDiaper (row: DiaperJoinRow): DiaperEvent {
	const wet = Number(row.wet) === 1
	const dirty = Number(row.dirty) === 1
	return {
		id: row.id,
		childId: row.child_id,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		kind: diaperKindFromFlags(wet, dirty),
		wet,
		dirty,
		hasRash: Number(row.has_rash) === 1,
		color: (row.color as DiaperEvent['color']) ?? null,
		consistency: (row.consistency as DiaperEvent['consistency']) ?? null,
	}
}

export class DiaperRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<DiaperEvent | null> {
		const row = await this.db.getFirstAsync<DiaperJoinRow>(
			`${DIAPER_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapDiaper(row) : null
	}

	async findLatest (childId: string): Promise<DiaperEvent | null> {
		const row = await this.db.getFirstAsync<DiaperJoinRow>(
			`${DIAPER_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT 1`,
			childId,
		)
		return row ? mapDiaper(row) : null
	}

	async listByChild (childId: string, limit = 100): Promise<DiaperEvent[]> {
		const rows = await this.db.getAllAsync<DiaperJoinRow>(
			`${DIAPER_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapDiaper)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<DiaperEvent[]> {
		const rows = await this.db.getAllAsync<DiaperJoinRow>(
			`${DIAPER_SELECT} AND e.child_id = ? AND e.start_local_date = ?
			 ORDER BY e.start_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapDiaper)
	}

	async listByChildAndLocalDateRange (
		childId: string,
		startDate: string,
		endDate: string,
	): Promise<DiaperEvent[]> {
		const rows = await this.db.getAllAsync<DiaperJoinRow>(
			`${DIAPER_SELECT} AND e.child_id = ?
			 AND e.start_local_date >= ? AND e.start_local_date <= ?
			 ORDER BY e.start_at ASC`,
			childId,
			startDate,
			endDate,
		)
		return rows.map(mapDiaper)
	}

	async create (input: CreateDiaperInput): Promise<DiaperEvent> {
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const flags = diaperFlagsFromKind(input.kind)
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'diaper', ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_diaper (
					event_id, wet, dirty, has_rash, color, consistency
				) VALUES (?, ?, ?, ?, ?, ?)`,
				id,
				flags.wet ? 1 : 0,
				flags.dirty ? 1 : 0,
				input.hasRash ? 1 : 0,
				input.color ?? null,
				input.consistency ?? null,
			)
		})

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create diaper')
		}
		return created
	}

	async update (eventId: string, input: UpdateDiaperInput): Promise<DiaperEvent> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new Error('Запись подгузника не найдена')
		}
		const kind = input.kind ?? existing.kind
		const flags = diaperFlagsFromKind(kind)
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const color =
			input.color !== undefined ? input.color : existing.color
		const consistency =
			input.consistency !== undefined
				? input.consistency
				: existing.consistency
		const hasRash =
			input.hasRash !== undefined ? input.hasRash : existing.hasRash
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_diaper SET
					wet = ?, dirty = ?, has_rash = ?, color = ?, consistency = ?
				 WHERE event_id = ?`,
				flags.wet ? 1 : 0,
				flags.dirty ? 1 : 0,
				hasRash ? 1 : 0,
				color,
				consistency,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated) {
			throw new Error('Failed to update diaper')
		}
		return updated
	}

	async delete (eventId: string): Promise<void> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new Error('Запись подгузника не найдена')
		}
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
	}
}
