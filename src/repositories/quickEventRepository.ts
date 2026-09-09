/**
 * Everyday + custom quick events repository.
 * Transactions use transactionDb directly (never re-enter the FIFO queue).
 */

import type { SqlExecutor } from '../db/types'
import { createEntityId } from '../domain/ids'
import {
	assertNonEmptyName,
	parseTemperatureCelsius,
	QuickEventValidationError,
} from '../domain/quickEventLabels'
import type {
	ActivityEvent,
	ActivityEventType,
	CustomEvent,
	CustomEventDefinition,
	MedicineEvent,
	MedicineKind,
	NoteEvent,
	TemperatureEvent,
} from '../models/quickEvents'
import { isActivityEventType } from '../models/quickEvents'
import {
	buildEventStart,
	localDateFromOffsetDateTime,
	nowUtcInstant,
	parseOffsetDateTime,
	toOffsetDateTime,
} from '../utils/datetime'

// Re-export input shapes used by the repository API.
export interface CreateActivityInput {
	childId: string
	type: ActivityEventType
	occurredAt?: string
	durationSeconds?: number | null
	notes?: string | null
	place?: string | null
}

export interface CreateTemperatureInput {
	childId: string
	celsiusRaw: string
	occurredAt?: string
	notes?: string | null
}

export interface CreateMedicineInput {
	childId: string
	kind: MedicineKind
	name: string
	occurredAt?: string
	doseText?: string | null
	unit?: string | null
	notes?: string | null
}

export interface CreateNoteInput {
	childId: string
	title?: string | null
	notes?: string | null
	occurredAt?: string
}

export interface CreateCustomDefinitionInput {
	childId: string
	name: string
	iconKey?: string | null
}

export interface CreateCustomEventInput {
	childId: string
	definitionId: string
	occurredAt?: string
	durationSeconds?: number | null
	notes?: string | null
}

interface ActivityJoinRow {
	id: string
	child_id: string
	type: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	place: string | null
}

interface TempJoinRow {
	id: string
	child_id: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	celsius: number
}

interface MedicineJoinRow {
	id: string
	child_id: string
	type: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	name: string
	dose_text: string | null
	unit: string | null
	kind: string | null
}

interface NoteRow {
	id: string
	child_id: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	title: string | null
	notes: string | null
	created_at: string
	updated_at: string
}

interface CustomDefRow {
	id: string
	child_id: string | null
	name: string
	icon_key: string | null
	color_token: string | null
	is_active: number
	created_at: string
	updated_at: string
}

interface CustomJoinRow {
	id: string
	child_id: string
	start_at: string
	end_at: string | null
	start_local_date: string
	end_local_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
	definition_id: string | null
	definition_name: string | null
	definition_icon_key: string | null
}

const ACTIVITY_SELECT = `
	SELECT e.id, e.child_id, e.type, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at, a.place
	FROM events e
	INNER JOIN event_activity a ON a.event_id = e.id
	WHERE e.type IN ('walk','bath','tummy_time','massage','doctor')
`

const TEMP_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at, t.celsius
	FROM events e
	INNER JOIN event_temperature t ON t.event_id = e.id
	WHERE e.type = 'temperature'
`

const MEDICINE_SELECT = `
	SELECT e.id, e.child_id, e.type, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at,
	       m.name, m.dose_text, m.unit, m.kind
	FROM events e
	INNER JOIN event_medicine m ON m.event_id = e.id
	WHERE e.type IN ('medicine','vitamin')
`

const CUSTOM_SELECT = `
	SELECT e.id, e.child_id, e.start_at, e.end_at, e.start_local_date,
	       e.end_local_date, e.notes, e.created_at, e.updated_at,
	       c.definition_id, d.name AS definition_name, d.icon_key AS definition_icon_key
	FROM events e
	INNER JOIN event_custom c ON c.event_id = e.id
	LEFT JOIN custom_event_definitions d ON d.id = c.definition_id
	WHERE e.type = 'custom'
`

function durationFromEnds (
	startAt: string,
	endAt: string | null,
): number | null {
	if (!endAt) {
		return null
	}
	const ms =
		parseOffsetDateTime(endAt).getTime() -
		parseOffsetDateTime(startAt).getTime()
	return Math.max(0, Math.floor(ms / 1000))
}

function mapActivity (row: ActivityJoinRow): ActivityEvent {
	if (!isActivityEventType(row.type)) {
		throw new Error(`Unknown activity type: ${row.type}`)
	}
	return {
		id: row.id,
		childId: row.child_id,
		type: row.type,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		place: row.place,
		durationSeconds: durationFromEnds(row.start_at, row.end_at),
	}
}

function mapTemp (row: TempJoinRow): TemperatureEvent {
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
		celsius: row.celsius,
	}
}

function mapMedicine (row: MedicineJoinRow): MedicineEvent {
	const type = row.type === 'vitamin' ? 'vitamin' : 'medicine'
	const kind: MedicineKind =
		row.kind === 'vitamin' || type === 'vitamin' ? 'vitamin' : 'medicine'
	return {
		id: row.id,
		childId: row.child_id,
		type,
		kind,
		startAt: row.start_at,
		endAt: row.end_at,
		startLocalDate: row.start_local_date,
		endLocalDate: row.end_local_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		name: row.name,
		doseText: row.dose_text,
		unit: row.unit,
	}
}

function mapNote (row: NoteRow): NoteEvent {
	return {
		id: row.id,
		childId: row.child_id,
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

function mapDef (row: CustomDefRow): CustomEventDefinition {
	return {
		id: row.id,
		childId: row.child_id,
		name: row.name,
		iconKey: row.icon_key,
		colorToken: row.color_token,
		isActive: Number(row.is_active) === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapCustom (row: CustomJoinRow): CustomEvent {
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
		definitionId: row.definition_id,
		definitionName: row.definition_name,
		definitionIconKey: row.definition_icon_key,
		durationSeconds: durationFromEnds(row.start_at, row.end_at),
	}
}

function endFromDuration (
	startAt: string,
	durationSeconds: number | null | undefined,
): { endAt: string; endLocalDate: string } | null {
	if (durationSeconds == null || durationSeconds <= 0) {
		return null
	}
	const endMs =
		parseOffsetDateTime(startAt).getTime() + durationSeconds * 1000
	const endAt = toOffsetDateTime(new Date(endMs))
	return {
		endAt,
		endLocalDate: localDateFromOffsetDateTime(endAt),
	}
}

export class QuickEventRepository {
	constructor (private readonly db: SqlExecutor) {}

	// --- Activities ---

	async createActivity (input: CreateActivityInput): Promise<ActivityEvent> {
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const end = endFromDuration(start.startAt, input.durationSeconds)
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				input.type,
				start.startAt,
				end?.endAt ?? start.startAt,
				start.startLocalDate,
				end?.endLocalDate ?? start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_activity (event_id, place) VALUES (?, ?)`,
				id,
				input.place?.trim() || null,
			)
		})

		const created = await this.getActivityById(id)
		if (!created) {
			throw new Error('Failed to create activity')
		}
		return created
	}

	async getActivityById (id: string): Promise<ActivityEvent | null> {
		const row = await this.db.getFirstAsync<ActivityJoinRow>(
			`${ACTIVITY_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapActivity(row) : null
	}

	async listActivitiesByChild (
		childId: string,
		limit = 100,
	): Promise<ActivityEvent[]> {
		const rows = await this.db.getAllAsync<ActivityJoinRow>(
			`${ACTIVITY_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapActivity)
	}

	async updateActivity (
		eventId: string,
		input: {
			occurredAt?: string
			durationSeconds?: number | null
			notes?: string | null
			place?: string | null
		},
	): Promise<ActivityEvent> {
		const existing = await this.getActivityById(eventId)
		if (!existing) {
			throw new QuickEventValidationError('Запись не найдена')
		}
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const duration =
			input.durationSeconds !== undefined
				? input.durationSeconds
				: existing.durationSeconds
		const end = endFromDuration(start.startAt, duration)
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const place =
			input.place !== undefined
				? input.place?.trim() || null
				: existing.place
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`UPDATE events SET
					start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
					notes = ?, updated_at = ?
				 WHERE id = ?`,
				start.startAt,
				end?.endAt ?? start.startAt,
				start.startLocalDate,
				end?.endLocalDate ?? start.startLocalDate,
				notes,
				audit,
				eventId,
			)
			await tx.runAsync(
				`UPDATE event_activity SET place = ? WHERE event_id = ?`,
				place,
				eventId,
			)
		})

		const updated = await this.getActivityById(eventId)
		if (!updated) {
			throw new Error('Failed to update activity')
		}
		return updated
	}

	// --- Temperature ---

	async createTemperature (
		input: CreateTemperatureInput,
	): Promise<TemperatureEvent> {
		const celsius = parseTemperatureCelsius(input.celsiusRaw)
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'temperature', ?, ?, ?, ?, NULL, ?, ?, ?)`,
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
				`INSERT INTO event_temperature (event_id, celsius) VALUES (?, ?)`,
				id,
				celsius,
			)
		})

		const created = await this.getTemperatureById(id)
		if (!created) {
			throw new Error('Failed to create temperature')
		}
		return created
	}

	async getTemperatureById (id: string): Promise<TemperatureEvent | null> {
		const row = await this.db.getFirstAsync<TempJoinRow>(
			`${TEMP_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapTemp(row) : null
	}

	async listTemperaturesByChild (
		childId: string,
		limit = 100,
	): Promise<TemperatureEvent[]> {
		const rows = await this.db.getAllAsync<TempJoinRow>(
			`${TEMP_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapTemp)
	}

	async updateTemperature (
		eventId: string,
		input: {
			celsiusRaw?: string
			occurredAt?: string
			notes?: string | null
		},
	): Promise<TemperatureEvent> {
		const existing = await this.getTemperatureById(eventId)
		if (!existing) {
			throw new QuickEventValidationError('Запись температуры не найдена')
		}
		const celsius =
			input.celsiusRaw !== undefined
				? parseTemperatureCelsius(input.celsiusRaw)
				: existing.celsius
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
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
				`UPDATE event_temperature SET celsius = ? WHERE event_id = ?`,
				celsius,
				eventId,
			)
		})

		const updated = await this.getTemperatureById(eventId)
		if (!updated) {
			throw new Error('Failed to update temperature')
		}
		return updated
	}

	// --- Medicine / vitamin ---

	async createMedicine (input: CreateMedicineInput): Promise<MedicineEvent> {
		const name = assertNonEmptyName(input.name, 'название')
		const eventType = input.kind === 'vitamin' ? 'vitamin' : 'medicine'
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
				id,
				input.childId,
				eventType,
				start.startAt,
				start.startAt,
				start.startLocalDate,
				start.startLocalDate,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_medicine (
					event_id, name, dose_text, unit, kind
				) VALUES (?, ?, ?, ?, ?)`,
				id,
				name,
				input.doseText?.trim() || null,
				input.unit?.trim() || null,
				input.kind,
			)
		})

		const created = await this.getMedicineById(id)
		if (!created) {
			throw new Error('Failed to create medicine')
		}
		return created
	}

	async getMedicineById (id: string): Promise<MedicineEvent | null> {
		const row = await this.db.getFirstAsync<MedicineJoinRow>(
			`${MEDICINE_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapMedicine(row) : null
	}

	async listMedicinesByChild (
		childId: string,
		limit = 100,
	): Promise<MedicineEvent[]> {
		const rows = await this.db.getAllAsync<MedicineJoinRow>(
			`${MEDICINE_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapMedicine)
	}

	async listRecentMedicineNames (
		childId: string,
		kind: MedicineKind,
		limit = 8,
	): Promise<string[]> {
		const rows = await this.db.getAllAsync<{ name: string }>(
			`SELECT m.name FROM event_medicine m
			 INNER JOIN events e ON e.id = m.event_id
			 WHERE e.child_id = ? AND e.type = ? AND m.kind = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			kind === 'vitamin' ? 'vitamin' : 'medicine',
			kind,
			limit * 3,
		)
		const seen = new Set<string>()
		const result: string[] = []
		for (const row of rows) {
			const key = row.name.trim().toLowerCase()
			if (!key || seen.has(key)) {
				continue
			}
			seen.add(key)
			result.push(row.name)
			if (result.length >= limit) {
				break
			}
		}
		return result
	}

	async updateMedicine (
		eventId: string,
		input: {
			name?: string
			doseText?: string | null
			unit?: string | null
			occurredAt?: string
			notes?: string | null
		},
	): Promise<MedicineEvent> {
		const existing = await this.getMedicineById(eventId)
		if (!existing) {
			throw new QuickEventValidationError('Запись не найдена')
		}
		const name =
			input.name !== undefined
				? assertNonEmptyName(input.name, 'название')
				: existing.name
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const doseText =
			input.doseText !== undefined
				? input.doseText?.trim() || null
				: existing.doseText
		const unit =
			input.unit !== undefined
				? input.unit?.trim() || null
				: existing.unit
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
				`UPDATE event_medicine SET name = ?, dose_text = ?, unit = ?
				 WHERE event_id = ?`,
				name,
				doseText,
				unit,
				eventId,
			)
		})

		const updated = await this.getMedicineById(eventId)
		if (!updated) {
			throw new Error('Failed to update medicine')
		}
		return updated
	}

	// --- Notes ---

	async createNote (input: CreateNoteInput): Promise<NoteEvent> {
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const id = await createEntityId()
		const audit = nowUtcInstant()
		const title = input.title?.trim() || null
		const notes = input.notes?.trim() || null
		if (!title && !notes) {
			throw new QuickEventValidationError('Напишите заметку')
		}

		await this.db.runAsync(
			`INSERT INTO events (
				id, child_id, type, start_at, end_at,
				start_local_date, end_local_date, title, notes,
				created_at, updated_at
			) VALUES (?, ?, 'note', ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			input.childId,
			start.startAt,
			start.startAt,
			start.startLocalDate,
			start.startLocalDate,
			title,
			notes,
			audit,
			audit,
		)

		const created = await this.getNoteById(id)
		if (!created) {
			throw new Error('Failed to create note')
		}
		return created
	}

	async getNoteById (id: string): Promise<NoteEvent | null> {
		const row = await this.db.getFirstAsync<NoteRow>(
			`SELECT id, child_id, start_at, end_at, start_local_date, end_local_date,
			        title, notes, created_at, updated_at
			 FROM events WHERE type = 'note' AND id = ?`,
			id,
		)
		return row ? mapNote(row) : null
	}

	async listNotesByChild (childId: string, limit = 100): Promise<NoteEvent[]> {
		const rows = await this.db.getAllAsync<NoteRow>(
			`SELECT id, child_id, start_at, end_at, start_local_date, end_local_date,
			        title, notes, created_at, updated_at
			 FROM events WHERE type = 'note' AND child_id = ?
			 ORDER BY start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapNote)
	}

	async updateNote (
		eventId: string,
		input: {
			title?: string | null
			notes?: string | null
			occurredAt?: string
		},
	): Promise<NoteEvent> {
		const existing = await this.getNoteById(eventId)
		if (!existing) {
			throw new QuickEventValidationError('Заметка не найдена')
		}
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const title =
			input.title !== undefined
				? input.title?.trim() || null
				: existing.title
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		if (!title && !notes) {
			throw new QuickEventValidationError('Напишите заметку')
		}
		const audit = nowUtcInstant()
		await this.db.runAsync(
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
		const updated = await this.getNoteById(eventId)
		if (!updated) {
			throw new Error('Failed to update note')
		}
		return updated
	}

	// --- Custom definitions ---

	async createCustomDefinition (
		input: CreateCustomDefinitionInput,
	): Promise<CustomEventDefinition> {
		const name = assertNonEmptyName(input.name, 'название типа')
		const id = await createEntityId()
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`INSERT INTO custom_event_definitions (
				id, child_id, name, icon_key, color_token, is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
			id,
			input.childId,
			name,
			input.iconKey ?? 'star',
			audit,
			audit,
		)
		const created = await this.getCustomDefinitionById(id)
		if (!created) {
			throw new Error('Failed to create custom definition')
		}
		return created
	}

	async getCustomDefinitionById (
		id: string,
	): Promise<CustomEventDefinition | null> {
		const row = await this.db.getFirstAsync<CustomDefRow>(
			`SELECT id, child_id, name, icon_key, color_token, is_active,
			        created_at, updated_at
			 FROM custom_event_definitions WHERE id = ?`,
			id,
		)
		return row ? mapDef(row) : null
	}

	async listActiveCustomDefinitions (
		childId: string,
	): Promise<CustomEventDefinition[]> {
		const rows = await this.db.getAllAsync<CustomDefRow>(
			`SELECT id, child_id, name, icon_key, color_token, is_active,
			        created_at, updated_at
			 FROM custom_event_definitions
			 WHERE is_active = 1 AND (child_id = ? OR child_id IS NULL)
			 ORDER BY name COLLATE NOCASE ASC`,
			childId,
		)
		return rows.map(mapDef)
	}

	async listAllCustomDefinitions (
		childId: string,
	): Promise<CustomEventDefinition[]> {
		const rows = await this.db.getAllAsync<CustomDefRow>(
			`SELECT id, child_id, name, icon_key, color_token, is_active,
			        created_at, updated_at
			 FROM custom_event_definitions
			 WHERE child_id = ? OR child_id IS NULL
			 ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
			childId,
		)
		return rows.map(mapDef)
	}

	async updateCustomDefinition (
		id: string,
		input: {
			name?: string
			iconKey?: string | null
			isActive?: boolean
		},
	): Promise<CustomEventDefinition> {
		const existing = await this.getCustomDefinitionById(id)
		if (!existing) {
			throw new QuickEventValidationError('Тип события не найден')
		}
		const name =
			input.name !== undefined
				? assertNonEmptyName(input.name, 'название типа')
				: existing.name
		const iconKey =
			input.iconKey !== undefined ? input.iconKey : existing.iconKey
		const isActive =
			input.isActive !== undefined ? input.isActive : existing.isActive
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE custom_event_definitions SET
				name = ?, icon_key = ?, is_active = ?, updated_at = ?
			 WHERE id = ?`,
			name,
			iconKey,
			isActive ? 1 : 0,
			audit,
			id,
		)
		const updated = await this.getCustomDefinitionById(id)
		if (!updated) {
			throw new Error('Failed to update custom definition')
		}
		return updated
	}

	async archiveCustomDefinition (id: string): Promise<CustomEventDefinition> {
		return this.updateCustomDefinition(id, { isActive: false })
	}

	// --- Custom events ---

	async createCustomEvent (
		input: CreateCustomEventInput,
	): Promise<CustomEvent> {
		const def = await this.getCustomDefinitionById(input.definitionId)
		if (!def || !def.isActive) {
			throw new QuickEventValidationError('Тип события недоступен')
		}
		const occurredAt = input.occurredAt ?? toOffsetDateTime(new Date())
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const end = endFromDuration(start.startAt, input.durationSeconds)
		const id = await createEntityId()
		const audit = nowUtcInstant()

		await this.db.withTransactionAsync(async (tx) => {
			await tx.runAsync(
				`INSERT INTO events (
					id, child_id, type, start_at, end_at,
					start_local_date, end_local_date, title, notes,
					created_at, updated_at
				) VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?)`,
				id,
				input.childId,
				start.startAt,
				end?.endAt ?? start.startAt,
				start.startLocalDate,
				end?.endLocalDate ?? start.startLocalDate,
				def.name,
				input.notes?.trim() || null,
				audit,
				audit,
			)
			await tx.runAsync(
				`INSERT INTO event_custom (event_id, definition_id, payload_json)
				 VALUES (?, ?, NULL)`,
				id,
				input.definitionId,
			)
		})

		const created = await this.getCustomEventById(id)
		if (!created) {
			throw new Error('Failed to create custom event')
		}
		return created
	}

	async getCustomEventById (id: string): Promise<CustomEvent | null> {
		const row = await this.db.getFirstAsync<CustomJoinRow>(
			`${CUSTOM_SELECT} AND e.id = ?`,
			id,
		)
		return row ? mapCustom(row) : null
	}

	async listCustomEventsByChild (
		childId: string,
		limit = 100,
	): Promise<CustomEvent[]> {
		const rows = await this.db.getAllAsync<CustomJoinRow>(
			`${CUSTOM_SELECT} AND e.child_id = ?
			 ORDER BY e.start_at DESC LIMIT ?`,
			childId,
			limit,
		)
		return rows.map(mapCustom)
	}

	async updateCustomEvent (
		eventId: string,
		input: {
			occurredAt?: string
			durationSeconds?: number | null
			notes?: string | null
		},
	): Promise<CustomEvent> {
		const existing = await this.getCustomEventById(eventId)
		if (!existing) {
			throw new QuickEventValidationError('Запись не найдена')
		}
		const occurredAt = input.occurredAt ?? existing.startAt
		const start = buildEventStart(parseOffsetDateTime(occurredAt))
		const duration =
			input.durationSeconds !== undefined
				? input.durationSeconds
				: existing.durationSeconds
		const end = endFromDuration(start.startAt, duration)
		const notes =
			input.notes !== undefined
				? input.notes?.trim() || null
				: existing.notes
		const audit = nowUtcInstant()
		await this.db.runAsync(
			`UPDATE events SET
				start_at = ?, end_at = ?, start_local_date = ?, end_local_date = ?,
				notes = ?, updated_at = ?
			 WHERE id = ?`,
			start.startAt,
			end?.endAt ?? start.startAt,
			start.startLocalDate,
			end?.endLocalDate ?? start.startLocalDate,
			notes,
			audit,
			eventId,
		)
		const updated = await this.getCustomEventById(eventId)
		if (!updated) {
			throw new Error('Failed to update custom event')
		}
		return updated
	}

	async deleteEvent (eventId: string): Promise<void> {
		await this.db.runAsync('DELETE FROM events WHERE id = ?', eventId)
	}
}
