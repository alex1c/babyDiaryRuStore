/**
 * Moments + month-photo selection repository.
 * Photo files are managed via PhotoStorage — SQLite stores URIs only.
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import type {
	MomentRecord,
	MonthPhotoSelection,
} from '../models/development'
import type { PhotoStorage } from '../services/photoStorage'
import {
	buildEventStart,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'
import { civilMonthKey } from '../domain/firstYearFoundation'

export interface CreateMomentInput {
	childId: string
	/** Already-managed photo URI (caller imports via PhotoStorage). */
	photoUri: string
	takenAt?: string
	title?: string | null
	notes?: string | null
	milestoneEventId?: string | null
}

export interface UpdateMomentInput {
	photoUri?: string
	takenAt?: string
	title?: string | null
	notes?: string | null
	milestoneEventId?: string | null
}

interface MomentRow {
	id: string
	child_id: string
	photo_uri: string
	taken_at: string
	taken_local_date: string
	title: string | null
	notes: string | null
	milestone_event_id: string | null
	created_at: string
	updated_at: string
}

interface MonthPhotoRow {
	id: string
	child_id: string
	month_key: string
	moment_id: string
	created_at: string
	updated_at: string
}

const MOMENT_SELECT = `
	SELECT id, child_id, photo_uri, taken_at, taken_local_date,
	       title, notes, milestone_event_id, created_at, updated_at
	FROM moments
`

function mapMoment (row: MomentRow): MomentRecord {
	return {
		id: row.id,
		childId: row.child_id,
		photoUri: row.photo_uri,
		takenAt: row.taken_at,
		takenLocalDate: row.taken_local_date,
		title: row.title,
		notes: row.notes,
		milestoneEventId: row.milestone_event_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapMonthPhoto (row: MonthPhotoRow): MonthPhotoSelection {
	return {
		id: row.id,
		childId: row.child_id,
		monthKey: row.month_key,
		momentId: row.moment_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class MomentRepository {
	constructor (
		private readonly db: SqlExecutor,
		private readonly photos: PhotoStorage,
	) {}

	async getById (id: string): Promise<MomentRecord | null> {
		const row = await this.db.getFirstAsync<MomentRow>(
			`${MOMENT_SELECT} WHERE id = ?`,
			id,
		)
		return row ? mapMoment(row) : null
	}

	async listByChild (
		childId: string,
		limit = 200,
	): Promise<MomentRecord[]> {
		const rows = await this.db.getAllAsync<MomentRow>(
			`${MOMENT_SELECT} WHERE child_id = ?
			 ORDER BY taken_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapMoment)
	}

	async create (input: CreateMomentInput): Promise<MomentRecord> {
		const takenAt = input.takenAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(takenAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.runAsync(
			`INSERT INTO moments (
				id, child_id, photo_uri, taken_at, taken_local_date,
				title, notes, milestone_event_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			input.photoUri,
			start.startAt,
			start.startLocalDate,
			input.title?.trim() || null,
			input.notes?.trim() || null,
			input.milestoneEventId ?? null,
			audit,
			audit,
		)

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create moment')
		}
		return created
	}

	async update (
		id: string,
		input: UpdateMomentInput,
	): Promise<MomentRecord> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Момент не найден')
		}

		const nextUri =
			input.photoUri !== undefined ? input.photoUri : existing.photoUri
		const takenAt = input.takenAt ?? existing.takenAt
		const start = buildEventStart(parseOffsetDateTime(takenAt))
		const title =
			input.title !== undefined
				? input.title?.trim() || null
				: existing.title
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const milestoneEventId =
			input.milestoneEventId !== undefined
				? input.milestoneEventId
				: existing.milestoneEventId
		const audit = nowUtcInstant()

		await this.db.runAsync(
			`UPDATE moments SET
				photo_uri = ?, taken_at = ?, taken_local_date = ?,
				title = ?, notes = ?, milestone_event_id = ?, updated_at = ?
			 WHERE id = ?`,
			nextUri,
			start.startAt,
			start.startLocalDate,
			title,
			notes,
			milestoneEventId,
			audit,
			id,
		)

		// Delete previous managed file after successful update if replaced.
		if (
			input.photoUri !== undefined &&
			input.photoUri !== existing.photoUri
		) {
			await this.maybeDeleteUnusedPhoto(existing.photoUri, id)
		}

		const updated = await this.getById(id)
		if (!updated) {
			throw new Error('Failed to update moment')
		}
		return updated
	}

	async delete (id: string): Promise<void> {
		const existing = await this.getById(id)
		if (!existing) {
			return
		}
		await this.db.runAsync('DELETE FROM moments WHERE id = ?', id)
		await this.maybeDeleteUnusedPhoto(existing.photoUri, id)
	}

	async listMonthPhotos (
		childId: string,
	): Promise<MonthPhotoSelection[]> {
		const rows = await this.db.getAllAsync<MonthPhotoRow>(
			`SELECT id, child_id, month_key, moment_id, created_at, updated_at
			 FROM month_photos WHERE child_id = ?`,
			childId,
		)
		return rows.map(mapMonthPhoto)
	}

	/** Mark a moment as the featured photo for its civil month (or custom key). */
	async setMonthPhoto (
		childId: string,
		momentId: string,
		monthKey?: string,
	): Promise<MonthPhotoSelection> {
		const moment = await this.getById(momentId)
		if (!moment || moment.childId !== childId) {
			throw new Error('Момент не найден')
		}
		const key = monthKey ?? civilMonthKey(moment.takenLocalDate)
		const existing = await this.db.getFirstAsync<MonthPhotoRow>(
			`SELECT id, child_id, month_key, moment_id, created_at, updated_at
			 FROM month_photos WHERE child_id = ? AND month_key = ?`,
			childId,
			key,
		)
		const audit = nowUtcInstant()
		if (existing) {
			await this.db.runAsync(
				`UPDATE month_photos SET moment_id = ?, updated_at = ?
				 WHERE id = ?`,
				momentId,
				audit,
				existing.id,
			)
			const updated = await this.db.getFirstAsync<MonthPhotoRow>(
				`SELECT id, child_id, month_key, moment_id, created_at, updated_at
				 FROM month_photos WHERE id = ?`,
				existing.id,
			)
			if (!updated) {
				throw new Error('Failed to update month photo')
			}
			return mapMonthPhoto(updated)
		}
		const id = await createEntityId()
		await this.db.runAsync(
			`INSERT INTO month_photos (
				id, child_id, month_key, moment_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
			id,
			childId,
			key,
			momentId,
			audit,
			audit,
		)
		const created = await this.db.getFirstAsync<MonthPhotoRow>(
			`SELECT id, child_id, month_key, moment_id, created_at, updated_at
			 FROM month_photos WHERE id = ?`,
			id,
		)
		if (!created) {
			throw new Error('Failed to create month photo')
		}
		return mapMonthPhoto(created)
	}

	/**
	 * Count references to a photo URI across moments and milestones.
	 * Used before deleting a managed file.
	 */
	async countPhotoReferences (
		photoUri: string,
		excludeMomentId?: string,
	): Promise<number> {
		const moments = await this.db.getAllAsync<{ id: string }>(
			`SELECT id FROM moments WHERE photo_uri = ?`,
			photoUri,
		)
		const milestones = await this.db.getAllAsync<{ event_id: string }>(
			`SELECT event_id FROM event_milestone WHERE photo_uri = ?`,
			photoUri,
		)
		let count = milestones.length
		for (const m of moments) {
			if (excludeMomentId && m.id === excludeMomentId) {
				continue
			}
			count += 1
		}
		return count
	}

	private async maybeDeleteUnusedPhoto (
		photoUri: string,
		excludeMomentId: string,
	): Promise<void> {
		if (!this.photos.isManaged(photoUri)) {
			return
		}
		const refs = await this.countPhotoReferences(
			photoUri,
			excludeMomentId,
		)
		if (refs === 0) {
			await this.photos.deleteManaged(photoUri)
		}
	}
}
