/**
 * Symptom observations repository (events.type = 'symptom').
 */

import type { SqlExecutor } from '../db/types'
import {
	isSymptomSeverity,
	isSymptomType,
	symptomTypeLabel,
} from '../domain/healthLabels'
import { createEntityId } from '../domain/ids'
import type {
	SymptomEvent,
	SymptomSeverity,
	SymptomType,
} from '../models/health'
import type { PhotoStorage } from '../services/photoStorage'
import {
	buildEventStart,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

export interface CreateSymptomInput {
	childId: string
	symptomType: SymptomType
	customLabel?: string | null
	startedAt?: string
	severity?: SymptomSeverity | null
	notes?: string | null
	photoUri?: string | null
}

export interface UpdateSymptomInput {
	symptomType?: SymptomType
	customLabel?: string | null
	startedAt?: string
	severity?: SymptomSeverity | null
	notes?: string | null
	photoUri?: string | null
	resolvedAt?: string | null
}

interface SymptomJoinRow {
	id: string
	child_id: string
	start_at: string
	start_local_date: string
	notes: string | null
	created_at: string
	updated_at: string
	symptom_type: string
	custom_label: string | null
	severity: string | null
	photo_uri: string | null
	resolved_at: string | null
}

const SYMPTOM_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.start_local_date, e.notes,
	       e.created_at, e.updated_at,
	       s.symptom_type, s.custom_label, s.severity, s.photo_uri, s.resolved_at
	FROM events e
	INNER JOIN event_symptom s ON s.event_id = e.id
	WHERE e.type = 'symptom'
`

function mapSymptom (row: SymptomJoinRow): SymptomEvent {
	const typeRaw = row.symptom_type
	const symptomType: SymptomType = isSymptomType(typeRaw)
		? typeRaw
		: 'other'
	const severity =
		row.severity && isSymptomSeverity(row.severity)
			? row.severity
			: null
	const title =
		symptomType === 'other'
			? row.custom_label?.trim() || 'Другое'
			: symptomTypeLabel(symptomType)
	return {
		id: row.id,
		childId: row.child_id,
		startAt: row.start_at,
		startLocalDate: row.start_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		symptomType,
		customLabel: row.custom_label,
		severity,
		photoUri: row.photo_uri,
		resolvedAt: row.resolved_at,
		title,
	}
}

export class SymptomRepository {
	constructor (
		private readonly db: SqlExecutor,
		private readonly photos: PhotoStorage,
	) {}

	async getById (id: string): Promise<SymptomEvent | null> {
		const row = await this.db.getFirstAsync<SymptomJoinRow>(
			`${SYMPTOM_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapSymptom(row) : null
	}

	async listByChild (childId: string, limit = 200): Promise<SymptomEvent[]> {
		const rows = await this.db.getAllAsync<SymptomJoinRow>(
			`${SYMPTOM_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapSymptom)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<SymptomEvent[]> {
		const rows = await this.db.getAllAsync<SymptomJoinRow>(
			`${SYMPTOM_SELECT} AND e.child_id = ? AND e.start_local_date = ?
			 ORDER BY e.start_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapSymptom)
	}

	async listActive (childId: string): Promise<SymptomEvent[]> {
		const rows = await this.db.getAllAsync<SymptomJoinRow>(
			`${SYMPTOM_SELECT} AND e.child_id = ? AND s.resolved_at IS NULL
			 ORDER BY e.start_at DESC`,
			childId,
		)
		return rows.map(mapSymptom)
	}

	async create (input: CreateSymptomInput): Promise<SymptomEvent> {
		const startedAt = input.startedAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(startedAt))
		const title =
			input.symptomType === 'other'
				? input.customLabel?.trim() || 'Другое'
				: symptomTypeLabel(input.symptomType)
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'symptom', ?, ?, ?, ?, ?, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				title,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_symptom (
					event_id, symptom_type, custom_label, severity, photo_uri, resolved_at
				) VALUES (?, ?, ?, ?, ?, NULL)`,
				id,
				input.symptomType,
				input.customLabel?.trim() || null,
				input.severity ?? null,
				input.photoUri ?? null,
			)
		})

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create symptom')
		}
		return created
	}

	async update (
		eventId: string,
		input: UpdateSymptomInput,
	): Promise<SymptomEvent> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new Error('Симптом не найден')
		}
		const symptomType = input.symptomType ?? existing.symptomType
		const customLabel =
			input.customLabel !== undefined
				? input.customLabel?.trim() || null
				: existing.customLabel
		const title =
			symptomType === 'other'
				? customLabel || 'Другое'
				: symptomTypeLabel(symptomType)
		const startedAt = input.startedAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(startedAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const severity =
			input.severity !== undefined ? input.severity : existing.severity
		const photoUri =
			input.photoUri !== undefined ? input.photoUri : existing.photoUri
		const resolvedAt =
			input.resolvedAt !== undefined
				? input.resolvedAt
				: existing.resolvedAt
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					title = ?, notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				title,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_symptom SET
					symptom_type = ?, custom_label = ?, severity = ?,
					photo_uri = ?, resolved_at = ?
				 WHERE event_id = ?`,
				symptomType,
				customLabel,
				severity,
				photoUri,
				resolvedAt,
				eventId,
			)
		})

		if (
			input.photoUri !== undefined &&
			existing.photoUri &&
			input.photoUri !== existing.photoUri
		) {
			await this.maybeDeleteUnusedPhoto(existing.photoUri, eventId)
		}

		const updated = await this.getById(eventId)
		if (!updated) {
			throw new Error('Failed to update symptom')
		}
		return updated
	}

	async resolve (eventId: string, resolvedAt?: string): Promise<SymptomEvent> {
		return this.update(eventId, {
			resolvedAt: resolvedAt ?? toOffsetDateTime(new Date()),
		})
	}

	async delete (eventId: string): Promise<void> {
		const existing = await this.getById(eventId)
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
		if (existing?.photoUri) {
			await this.maybeDeleteUnusedPhoto(existing.photoUri, eventId)
		}
	}

	private async maybeDeleteUnusedPhoto (
		photoUri: string,
		excludeEventId: string,
	): Promise<void> {
		if (!this.photos.isManaged(photoUri)) {
			return
		}
		const rows = await this.db.getAllAsync<{ event_id: string }>(
			`SELECT event_id FROM event_symptom WHERE photo_uri = ?`,
			photoUri,
		)
		const stillUsed = rows.some((r) => r.event_id !== excludeEventId)
		if (!stillUsed) {
			const attachments = await this.db.getAllAsync<{ id: string }>(
				`SELECT id FROM health_attachments WHERE file_uri = ?`,
				photoUri,
			)
			if (attachments.length === 0) {
				await this.photos.deleteManaged(photoUri)
			}
		}
	}
}
