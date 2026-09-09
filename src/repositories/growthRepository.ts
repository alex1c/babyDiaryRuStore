/**
 * Growth measurements repository (weight / height / head circumference).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import { parseGrowthFields } from '../domain/growthLabels'
import type {
	CreateGrowthInput,
	GrowthMeasurement,
	UpdateGrowthInput,
} from '../models/growth'
import {
	buildEventStart,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

interface GrowthRow {
	id: string
	child_id: string
	measured_at: string
	measured_local_date: string
	weight_grams: number | null
	height_mm: number | null
	head_circumference_mm: number | null
	notes: string | null
	created_at: string
	updated_at: string
}

const GROWTH_SELECT = `
	SELECT id, child_id, measured_at, measured_local_date,
	       weight_grams, height_mm, head_circumference_mm,
	       notes, created_at, updated_at
	FROM growth_measurements
`

function mapGrowth (row: GrowthRow): GrowthMeasurement {
	return {
		id: row.id,
		childId: row.child_id,
		measuredAt: row.measured_at,
		measuredLocalDate: row.measured_local_date,
		weightGrams: row.weight_grams,
		heightMm: row.height_mm,
		headCircumferenceMm: row.head_circumference_mm,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class GrowthRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<GrowthMeasurement | null> {
		const row = await this.db.getFirstAsync<GrowthRow>(
			`${GROWTH_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapGrowth(row) : null
	}

	async listByChild (
		childId: string,
		limit = 200,
	): Promise<GrowthMeasurement[]> {
		const rows = await this.db.getAllAsync<GrowthRow>(
			`${GROWTH_SELECT} WHERE child_id = ?
			 ORDER BY measured_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapGrowth)
	}

	/** Latest non-null value per metric (may come from different visits). */
	async findLatestMetrics (childId: string): Promise<{
		weight: GrowthMeasurement | null
		height: GrowthMeasurement | null
		head: GrowthMeasurement | null
	}> {
		const list = await this.listByChild(childId, 500)
		let weight: GrowthMeasurement | null = null
		let height: GrowthMeasurement | null = null
		let head: GrowthMeasurement | null = null
		for (const m of list) {
			if (!weight && m.weightGrams != null) {
				weight = m
			}
			if (!height && m.heightMm != null) {
				height = m
			}
			if (!head && m.headCircumferenceMm != null) {
				head = m
			}
			if (weight && height && head) {
				break
			}
		}
		return { weight, height, head }
	}

	async create (input: CreateGrowthInput): Promise<GrowthMeasurement> {
		const fields = parseGrowthFields(input)
		const measuredAt = input.measuredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(measuredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.runAsync(
			`INSERT INTO growth_measurements (
				id, child_id, measured_at, measured_local_date,
				weight_grams, height_mm, head_circumference_mm,
				notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			start.startAt,
			start.startLocalDate,
			fields.weightGrams,
			fields.heightMm,
			fields.headCircumferenceMm,
			input.notes?.trim() || null,
			audit,
			audit,
		)

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create growth measurement')
		}
		return created
	}

	async update (
		id: string,
		input: UpdateGrowthInput,
	): Promise<GrowthMeasurement> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Измерение не найдено')
		}

		const weightKgRaw =
			input.weightKgRaw !== undefined
				? input.weightKgRaw
				: existing.weightGrams != null
					? String(existing.weightGrams / 1000).replace('.', ',')
					: null
		const heightCmRaw =
			input.heightCmRaw !== undefined
				? input.heightCmRaw
				: existing.heightMm != null
					? String(existing.heightMm / 10).replace('.', ',')
					: null
		const headCmRaw =
			input.headCmRaw !== undefined
				? input.headCmRaw
				: existing.headCircumferenceMm != null
					? String(existing.headCircumferenceMm / 10).replace('.', ',')
					: null

		const fields = parseGrowthFields({
			weightKgRaw,
			heightCmRaw,
			headCmRaw,
		})
		const measuredAt = input.measuredAt ?? existing.measuredAt
		const start = buildEventStart(parseOffsetDateTime(measuredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const audit = nowUtcInstant()

		await this.db.runAsync(
			`UPDATE growth_measurements SET
				measured_at = ?, measured_local_date = ?,
				weight_grams = ?, height_mm = ?, head_circumference_mm = ?,
				notes = ?, updated_at = ?
			 WHERE id = ?`,
			start.startAt,
			start.startLocalDate,
			fields.weightGrams,
			fields.heightMm,
			fields.headCircumferenceMm,
			notes,
			audit,
			id,
		)

		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update growth measurement')
		}
		return updated
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync(
			'DELETE FROM growth_measurements WHERE id = ?',
			id,
		)
	}
}
