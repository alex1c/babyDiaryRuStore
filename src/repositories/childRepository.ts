/**
 * Child repository — CRUD for multi-child foundation.
 * UI talks to this layer only; no raw SQL in React components.
 */

import { createEntityId } from '../domain/ids'
import type {
	Child,
	ChildSex,
	CreateChildInput,
	UpdateChildInput,
} from '../models/types'
import { isValidDateOnly, nowUtcInstant } from '../utils/datetime'
import type { SqlExecutor } from '../db/types'

interface ChildRow {
	id: string
	name: string
	sex: string | null
	birth_date: string
	birth_time: string | null
	birth_weight_grams: number | null
	birth_height_cm: number | null
	photo_uri: string | null
	is_active: number
	created_at: string
	updated_at: string
}

function mapChild (row: ChildRow): Child {
	return {
		id: row.id,
		name: row.name,
		sex: (row.sex as ChildSex | null) ?? null,
		birthDate: row.birth_date,
		birthTime: row.birth_time,
		birthWeightGrams: row.birth_weight_grams,
		birthHeightCm: row.birth_height_cm,
		photoUri: row.photo_uri,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function normalizeName (name: string): string {
	return name.trim()
}

function assertCreateInput (input: CreateChildInput): void {
	const name = normalizeName(input.name)
	if (!name) {
		throw new Error('Child name is required')
	}
	if (!isValidDateOnly(input.birthDate)) {
		throw new Error(`Invalid birthDate: ${input.birthDate}`)
	}
}

export class ChildRepository {
	constructor (private readonly db: SqlExecutor) {}

	async create (input: CreateChildInput): Promise<Child> {
		assertCreateInput(input)
		const now = nowUtcInstant()
		const child: Child = {
			id: await createEntityId(),
			name: normalizeName(input.name),
			sex: input.sex ?? null,
			birthDate: input.birthDate,
			birthTime: input.birthTime ?? null,
			birthWeightGrams: input.birthWeightGrams ?? null,
			birthHeightCm: input.birthHeightCm ?? null,
			photoUri: input.photoUri ?? null,
			isActive: input.isActive ?? true,
			createdAt: now,
			updatedAt: now,
		}

		await this.db.runAsync(
			`INSERT INTO children (
				id, name, sex, birth_date, birth_time,
				birth_weight_grams, birth_height_cm, photo_uri,
				is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			child.id,
			child.name,
			child.sex,
			child.birthDate,
			child.birthTime,
			child.birthWeightGrams,
			child.birthHeightCm,
			child.photoUri,
			child.isActive ? 1 : 0,
			child.createdAt,
			child.updatedAt,
		)

		return child
	}

	async getById (id: string): Promise<Child | null> {
		const row = await this.db.getFirstAsync<ChildRow>(
			'SELECT * FROM children WHERE id = ?',
			id,
		)
		return row ? mapChild(row) : null
	}

	async listAll (): Promise<Child[]> {
		const rows = await this.db.getAllAsync<ChildRow>(
			`SELECT * FROM children
			 ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
		)
		return rows.map(mapChild)
	}

	async update (id: string, input: UpdateChildInput): Promise<Child> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error(`Child not found: ${id}`)
		}

		const next: Child = {
			...existing,
			name:
				input.name !== undefined
					? normalizeName(input.name)
					: existing.name,
			sex: input.sex !== undefined ? input.sex : existing.sex,
			birthDate:
				input.birthDate !== undefined
					? input.birthDate
					: existing.birthDate,
			birthTime:
				input.birthTime !== undefined
					? input.birthTime
					: existing.birthTime,
			birthWeightGrams:
				input.birthWeightGrams !== undefined
					? input.birthWeightGrams
					: existing.birthWeightGrams,
			birthHeightCm:
				input.birthHeightCm !== undefined
					? input.birthHeightCm
					: existing.birthHeightCm,
			photoUri:
				input.photoUri !== undefined
					? input.photoUri
					: existing.photoUri,
			isActive:
				input.isActive !== undefined
					? input.isActive
					: existing.isActive,
			updatedAt: nowUtcInstant(),
		}

		if (!next.name) {
			throw new Error('Child name is required')
		}
		if (!isValidDateOnly(next.birthDate)) {
			throw new Error(`Invalid birthDate: ${next.birthDate}`)
		}

		await this.db.runAsync(
			`UPDATE children SET
				name = ?, sex = ?, birth_date = ?, birth_time = ?,
				birth_weight_grams = ?, birth_height_cm = ?, photo_uri = ?,
				is_active = ?, updated_at = ?
			 WHERE id = ?`,
			next.name,
			next.sex,
			next.birthDate,
			next.birthTime,
			next.birthWeightGrams,
			next.birthHeightCm,
			next.photoUri,
			next.isActive ? 1 : 0,
			next.updatedAt,
			id,
		)

		return next
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM children WHERE id = ?', id)
	}
}
