/**
 * Milestone events repository (events.type = milestone + event_milestone).
 */

import type { SqlExecutor } from '../db/types'
import {
	defaultMilestoneTitle,
	isMilestoneType,
} from '../domain/developmentLabels'
import { createEntityId } from '../domain/ids'
import type {
	MilestoneEvent,
	MilestoneType,
} from '../models/development'
import {
	buildEventStart,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

export interface CreateMilestoneInput {
	childId: string
	milestoneType: MilestoneType
	title?: string | null
	occurredAt?: string
	notes?: string | null
	photoUri?: string | null
	linkedMomentId?: string | null
}

export interface UpdateMilestoneInput {
	milestoneType?: MilestoneType
	title?: string | null
	occurredAt?: string
	notes?: string | null
	photoUri?: string | null
	linkedMomentId?: string | null
}

interface MilestoneJoinRow {
	id: string
	child_id: string
	start_at: string
	start_local_date: string
	notes: string | null
	created_at: string
	updated_at: string
	label: string
	photo_uri: string | null
	milestone_type: string | null
	linked_moment_id: string | null
}

const MILESTONE_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.start_local_date, e.notes,
	       e.created_at, e.updated_at,
	       m.label, m.photo_uri, m.milestone_type, m.linked_moment_id
	FROM events e
	INNER JOIN event_milestone m ON m.event_id = e.id
	WHERE e.type = 'milestone'
`

function mapMilestone (row: MilestoneJoinRow): MilestoneEvent {
	const typeRaw = row.milestone_type ?? 'other'
	const milestoneType: MilestoneType = isMilestoneType(typeRaw)
		? typeRaw
		: 'other'
	return {
		id: row.id,
		childId: row.child_id,
		startAt: row.start_at,
		startLocalDate: row.start_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		milestoneType,
		title: row.label,
		photoUri: row.photo_uri,
		linkedMomentId: row.linked_moment_id,
	}
}

export class MilestoneRepository {
	constructor (private readonly db: SqlExecutor) {}

	async getById (id: string): Promise<MilestoneEvent | null> {
		const row = await this.db.getFirstAsync<MilestoneJoinRow>(
			`${MILESTONE_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapMilestone(row) : null
	}

	async listByChild (
		childId: string,
		limit = 200,
	): Promise<MilestoneEvent[]> {
		const rows = await this.db.getAllAsync<MilestoneJoinRow>(
			`${MILESTONE_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapMilestone)
	}

	async listByChildAndLocalDate (
		childId: string,
		localDate: string,
	): Promise<MilestoneEvent[]> {
		const rows = await this.db.getAllAsync<MilestoneJoinRow>(
			`${MILESTONE_SELECT} AND e.child_id = ? AND e.start_local_date = ?
			 ORDER BY e.start_at DESC`,
			childId,
			localDate,
		)
		return rows.map(mapMilestone)
	}

	async create (input: CreateMilestoneInput): Promise<MilestoneEvent> {
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const title =
			input.milestoneType === 'other'
				? (input.title?.trim() || 'Другое')
				: (input.title?.trim() ||
					defaultMilestoneTitle(input.milestoneType))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'milestone', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				`INSERT INTO event_milestone (
					event_id, label, photo_uri, milestone_type, linked_moment_id
				) VALUES (?, ?, ?, ?, ?)`,
				id,
				title,
				input.photoUri ?? null,
				input.milestoneType,
				input.linkedMomentId ?? null,
			)
		})

		const created = await this.getById(id)
		if (!created) {
			throw new Error('Failed to create milestone')
		}
		return created
	}

	async update (
		eventId: string,
		input: UpdateMilestoneInput,
	): Promise<MilestoneEvent> {
		const existing = await this.getById(eventId)
		if (!existing) {
			throw new Error('Достижение не найдено')
		}
		const milestoneType = input.milestoneType ?? existing.milestoneType
		const title =
			input.title !== undefined
				? input.title?.trim() ||
					(milestoneType === 'other'
						? 'Другое'
						: defaultMilestoneTitle(milestoneType))
				: existing.title
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const photoUri =
			input.photoUri !== undefined ? input.photoUri : existing.photoUri
		const linkedMomentId =
			input.linkedMomentId !== undefined
				? input.linkedMomentId
				: existing.linkedMomentId
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
				`UPDATE event_milestone SET
					label = ?, photo_uri = ?, milestone_type = ?, linked_moment_id = ?
				 WHERE event_id = ?`,
				title,
				photoUri,
				milestoneType,
				linkedMomentId,
				eventId,
			)
		})

		const updated = await this.getById(eventId)
		if (!updated) {
			throw new Error('Failed to update milestone')
		}
		return updated
	}

	async delete (eventId: string): Promise<void> {
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
	}
}
