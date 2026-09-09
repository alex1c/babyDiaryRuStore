/**
 * Doctor visit repository — observations and notes only.
 */

import type { SqlExecutor } from '../db/types'
import {
	defaultSpecialistLabel,
	isDoctorSpecialistKey,
} from '../domain/healthLabels'
import { createEntityId } from '../domain/ids'
import type {
	DoctorSpecialistKey,
	DoctorVisit,
} from '../models/health'
import {
	buildEventStart,
	localDateFromOffsetDateTime,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

export interface CreateDoctorVisitInput {
	childId: string
	visitedAt?: string
	specialistKey: DoctorSpecialistKey
	specialistCustom?: string | null
	reason?: string | null
	notes?: string | null
	recommendations?: string | null
	nextVisitAt?: string | null
}

export interface UpdateDoctorVisitInput {
	visitedAt?: string
	specialistKey?: DoctorSpecialistKey
	specialistCustom?: string | null
	reason?: string | null
	notes?: string | null
	recommendations?: string | null
	nextVisitAt?: string | null
}

interface VisitRow {
	id: string
	child_id: string
	visited_at: string
	visited_local_date: string
	specialist_key: string
	specialist_label: string
	reason: string | null
	notes: string | null
	recommendations: string | null
	next_visit_at: string | null
	next_visit_local_date: string | null
	created_at: string
	updated_at: string
}

const VISIT_SELECT = `
	SELECT id, child_id, visited_at, visited_local_date,
	       specialist_key, specialist_label, reason, notes, recommendations,
	       next_visit_at, next_visit_local_date, created_at, updated_at
	FROM doctor_visits
`

function mapVisit (row: VisitRow): DoctorVisit {
	const keyRaw = row.specialist_key
	const specialistKey: DoctorSpecialistKey = isDoctorSpecialistKey(keyRaw)
		? keyRaw
		: 'other'
	return {
		id: row.id,
		childId: row.child_id,
		visitedAt: row.visited_at,
		visitedLocalDate: row.visited_local_date,
		specialistKey,
		specialistLabel: row.specialist_label,
		reason: row.reason,
		notes: row.notes,
		recommendations: row.recommendations,
		nextVisitAt: row.next_visit_at,
		nextVisitLocalDate: row.next_visit_local_date,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class DoctorVisitRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<DoctorVisit | null> {
		const row = await this.db.getFirstAsync<VisitRow>(
			`${VISIT_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapVisit(row) : null
	}

	async listByChild (childId: string, limit = 100): Promise<DoctorVisit[]> {
		const rows = await this.db.getAllAsync<VisitRow>(
			`${VISIT_SELECT} WHERE child_id = ?
			 ORDER BY visited_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapVisit)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<DoctorVisit[]> {
		const rows = await this.db.getAllAsync<VisitRow>(
			`${VISIT_SELECT} WHERE child_id = ? AND visited_local_date = ?
			 ORDER BY visited_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapVisit)
	}

	async create (input: CreateDoctorVisitInput): Promise<DoctorVisit> {
		const visitedAt = input.visitedAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(visitedAt))
		const label = defaultSpecialistLabel(
			input.specialistKey,
			input.specialistCustom,
		)
		let nextAt: string | null = null
		let nextLocal: string | null = null
		if (input.nextVisitAt) {
			nextAt = input.nextVisitAt
			nextLocal = localDateFromOffsetDateTime(input.nextVisitAt)
		}
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO doctor_visits (
				id, child_id, visited_at, visited_local_date,
				specialist_key, specialist_label, reason, notes, recommendations,
				next_visit_at, next_visit_local_date, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			start.startAt,
			start.startLocalDate,
			input.specialistKey,
			label,
			input.reason?.trim() || null,
			input.notes?.trim() || null,
			input.recommendations?.trim() || null,
			nextAt,
			nextLocal,
			audit,
			audit,
		)
		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create doctor visit')
		}
		return created
	}

	async update (
		id: string,
		input: UpdateDoctorVisitInput,
	): Promise<DoctorVisit> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Визит не найден')
		}
		const specialistKey = input.specialistKey ?? existing.specialistKey
		const label =
			input.specialistKey !== undefined ||
			input.specialistCustom !== undefined
				? defaultSpecialistLabel(
						specialistKey,
						input.specialistCustom ??
							(specialistKey === 'other'
								? existing.specialistLabel
								: null),
					)
				: existing.specialistLabel
		const visitedAt = input.visitedAt ?? existing.visitedAt
		const start = buildEventStart(parseOffsetDateTime(visitedAt))
		const reason =
			input.reason !== undefined
				? input.reason?.trim() || null
				: existing.reason
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const recommendations =
			input.recommendations !== undefined
				? input.recommendations?.trim() || null
				: existing.recommendations
		let nextAt = existing.nextVisitAt
		let nextLocal = existing.nextVisitLocalDate
		if (input.nextVisitAt !== undefined) {
			if (input.nextVisitAt) {
				nextAt = input.nextVisitAt
				nextLocal = localDateFromOffsetDateTime(input.nextVisitAt)
			} else {
				nextAt = null
				nextLocal = null
			}
		}
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE doctor_visits SET
				visited_at = ?, visited_local_date = ?,
				specialist_key = ?, specialist_label = ?,
				reason = ?, notes = ?, recommendations = ?,
				next_visit_at = ?, next_visit_local_date = ?, updated_at = ?
			 WHERE id = ?`,
			start.startAt,
			start.startLocalDate,
			specialistKey,
			label,
			reason,
			notes,
			recommendations,
			nextAt,
			nextLocal,
			audit,
			id,
		)
		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update doctor visit')
		}
		return updated
	}

	async delete (id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM doctor_visits WHERE id = ?', id)
	}
}
