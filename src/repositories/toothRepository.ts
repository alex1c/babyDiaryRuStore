/**
 * Tooth eruption tracker repository.
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import type { ToothKey, ToothRecord } from '../models/development'
import { isValidDateOnly, nowUtcInstant } from '../utils/datetime'

export interface CreateToothInput {
	childId: string
	toothKey: ToothKey
	eruptedAt: string
	notes?: string | null
}

export interface UpdateToothInput {
	eruptedAt?: string
	notes?: string | null
}

interface ToothRow {
	id: string
	child_id: string
	tooth_key: string
	erupted_at: string
	notes: string | null
	created_at: string
	updated_at: string
}

const TOOTH_SELECT = `
	SELECT id, child_id, tooth_key, erupted_at, notes, created_at, updated_at
	FROM teeth
`

function mapTooth (row: ToothRow): ToothRecord {
	return {
		id: row.id,
		childId: row.child_id,
		toothKey: row.tooth_key as ToothKey,
		eruptedAt: row.erupted_at,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class ToothRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<ToothRecord | null> {
		const row = await this.db.getFirstAsync<ToothRow>(
			`${TOOTH_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapTooth(row) : null
	}

	async findByChildAndKey (
		childId: string,
		toothKey: ToothKey,
	): Promise<ToothRecord | null> {
		const row = await this.db.getFirstAsync<ToothRow>(
			`${TOOTH_SELECT} WHERE child_id = ? AND tooth_key = ?`,
			childId,
			toothKey,
		)
		return row ? mapTooth(row) : null
	}

	async listByChild (childId: string): Promise<ToothRecord[]> {
		const rows = await this.db.getAllAsync<ToothRow>(
			`${TOOTH_SELECT} WHERE child_id = ?
			 ORDER BY erupted_at DESC`,
			childId,
		)
		return rows.map(mapTooth)
	}

	/**
	 * Add tooth; if the same key already exists for the child, update date/notes
	 * instead of failing hard (reasonable duplicate handling).
	 */
	async upsert (input: CreateToothInput): Promise<ToothRecord> {
		if (!isValidDateOnly(input.eruptedAt)) {
			throw new Error('Проверьте введённое значение')
		}
		const existing = await this.findByChildAndKey(
			input.childId,
			input.toothKey,
		)
		if (existing) {
			return this.update(existing.id, {
				eruptedAt: input.eruptedAt,
				notes: input.notes,
			})
		}
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO teeth (
				id, child_id, tooth_key, erupted_at, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			input.toothKey,
			input.eruptedAt,
			input.notes?.trim() || null,
			audit,
			audit,
		)
		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create tooth')
		}
		return created
	}

	async update (id: string, input: UpdateToothInput): Promise<ToothRecord> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Запись зуба не найдена')
		}
		const eruptedAt = input.eruptedAt ?? existing.eruptedAt
		if (!isValidDateOnly(eruptedAt)) {
			throw new Error('Проверьте введённое значение')
		}
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE teeth SET erupted_at = ?, notes = ?, updated_at = ?
			 WHERE id = ?`,
			eruptedAt,
			notes,
			audit,
			id,
		)
		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update tooth')
		}
		return updated
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM teeth WHERE id = ?', id)
	}
}
