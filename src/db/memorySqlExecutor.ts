/**
 * Lightweight in-memory SQL executor for Jest.
 * Supports the parameterized statements used by Phase 0 repositories.
 * Not a general SQL engine — intentionally small.
 */

import { MIGRATIONS } from './migrations'
import type { SqlExecutor, SqlParam } from './types'

type Row = Record<string, string | number | null>

const TABLE_NAMES = [
	'children',
	'events',
	'event_sleep',
	'event_feeding',
	'event_diaper',
	'event_temperature',
	'event_medicine',
	'event_activity',
	'event_milestone',
	'custom_event_definitions',
	'event_custom',
	'recent_foods',
	'growth_measurements',
	'teeth',
	'moments',
	'month_photos',
	'app_settings',
	'schema_migrations',
] as const

type TableName = (typeof TABLE_NAMES)[number]

function emptyTables (): Record<TableName, Row[]> {
	const tables = {} as Record<TableName, Row[]>
	for (const name of TABLE_NAMES) {
		tables[name] = []
	}
	return tables
}

function isTableName (name: string): name is TableName {
	return (TABLE_NAMES as readonly string[]).includes(name)
}

/** Map INSERT column list + VALUES tokens (? and literals) onto a row. */
function buildInsertRow (
	columnsPart: string,
	valuesPart: string,
	params: SqlParam[],
): Row {
	const cols = columnsPart.split(',').map((c) => c.trim())
	const tokens = valuesPart.split(',').map((t) => t.trim())
	let paramIdx = 0
	const row: Row = {}
	cols.forEach((col, index) => {
		const token = tokens[index]
		if (token === '?') {
			row[col] = params[paramIdx++] ?? null
		} else if (/^NULL$/i.test(token ?? '')) {
			row[col] = null
		} else if (/^'([^']*)'$/.test(token ?? '')) {
			row[col] = (token ?? '').slice(1, -1)
		} else if (/^\d+$/.test(token ?? '')) {
			row[col] = Number(token)
		} else {
			throw new Error(`Unsupported literal in INSERT: ${token}`)
		}
	})
	return row
}

export class MemorySqlExecutor implements SqlExecutor {
	private tables = emptyTables()
	private userVersion = 0
	foreignKeysEnabled = true

	async execAsync (sql: string): Promise<void> {
		const trimmed = sql.trim()
		if (trimmed.startsWith('PRAGMA foreign_keys')) {
			this.foreignKeysEnabled = /ON/i.test(trimmed)
			return
		}
		const versionMatch = trimmed.match(/PRAGMA user_version\s*=\s*(\d+)/i)
		if (versionMatch) {
			this.userVersion = Number(versionMatch[1])
			return
		}
		// Ignore DDL in memory mode; tables are pre-created as arrays.
	}

	async withTransactionAsync (task: (transactionDb: SqlExecutor) => Promise<void>): Promise<void> {
		const snapshot = JSON.parse(JSON.stringify(this.tables)) as Record<
			TableName,
			Row[]
		>
		const versionSnapshot = this.userVersion
		try {
			await task(this)
		} catch (error) {
			this.tables = snapshot
			this.userVersion = versionSnapshot
			throw error
		}
	}

	async runAsync (
		sql: string,
		...params: SqlParam[]
	): Promise<{ changes: number; lastInsertRowId: number }> {
		const normalized = sql.replace(/\s+/g, ' ').trim()

		if (/^INSERT OR IGNORE INTO schema_migrations/i.test(normalized)) {
			const [version, name, appliedAt] = params
			const exists = this.tables.schema_migrations.some(
				(r) => r.version === version,
			)
			if (!exists) {
				this.tables.schema_migrations.push({
					version: version as number,
					name: name as string,
					applied_at: appliedAt as string,
				})
				return { changes: 1, lastInsertRowId: 0 }
			}
			return { changes: 0, lastInsertRowId: 0 }
		}

		if (/^INSERT INTO app_settings/i.test(normalized)) {
			const [key, value] = params
			const existing = this.tables.app_settings.find((r) => r.key === key)
			if (existing && /ON CONFLICT/i.test(normalized)) {
				existing.value = value as string
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (!existing) {
				this.tables.app_settings.push({
					key: key as string,
					value: value as string,
				})
				return { changes: 1, lastInsertRowId: 0 }
			}
			return { changes: 0, lastInsertRowId: 0 }
		}

		const insertMatch = normalized.match(
			/^INSERT(?: OR IGNORE)? INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/i,
		)
		if (insertMatch) {
			const table = insertMatch[1]
			const columnsPart = insertMatch[2]
			const valuesPart = insertMatch[3]
			if (!table || !columnsPart || !valuesPart || !isTableName(table)) {
				throw new Error(`Unknown table: ${table}`)
			}
			const row = buildInsertRow(columnsPart, valuesPart, params)
			this.assertForeignKeysOnInsert(table, row)
			this.tables[table].push(row)
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE children SET/i.test(normalized)) {
			const id = params[params.length - 1]
			const child = this.tables.children.find((r) => r.id === id)
			if (!child) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [
				name,
				sex,
				birthDate,
				birthTime,
				birthWeight,
				birthHeight,
				photoUri,
				isActive,
				updatedAt,
			] = params
			child.name = name as string
			child.sex = sex as string | null
			child.birth_date = birthDate as string
			child.birth_time = birthTime as string | null
			child.birth_weight_grams = birthWeight as number | null
			child.birth_height_cm = birthHeight as number | null
			child.photo_uri = photoUri as string | null
			child.is_active = isActive as number
			child.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE events SET end_at = \?, end_local_date = \?, updated_at = \? WHERE id = \?$/i.test(normalized)) {
			const [endAt, endLocalDate, updatedAt, id] = params
			const event = this.tables.events.find((r) => r.id === id)
			if (!event) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			event.end_at = endAt as string
			event.end_local_date = endLocalDate as string | null
			event.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_sleep SET sleep_type = \? WHERE event_id = \?$/i.test(normalized)) {
			const [sleepType, eventId] = params
			const row = this.tables.event_sleep.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.sleep_type = sleepType as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_feeding SET/i.test(normalized)) {
			const eventId = params[params.length - 1]
			const row = this.tables.event_feeding.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			if (/left_duration_seconds = \?, right_duration_seconds = \?, last_side = \?, side_started_at = \?/i.test(normalized)) {
				const [left, right, lastSide, sideStartedAt] = params
				row.left_duration_seconds = left as number
				row.right_duration_seconds = right as number
				row.last_side = lastSide as string
				row.side_started_at = sideStartedAt as string | null
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/left_duration_seconds = \?, right_duration_seconds = \?, side_started_at = NULL, duration_seconds = \?/i.test(normalized)) {
				const [left, right, duration] = params
				row.left_duration_seconds = left as number
				row.right_duration_seconds = right as number
				row.side_started_at = null
				row.duration_seconds = duration as number
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/side_started_at = CASE WHEN/i.test(normalized)) {
				const [left, right, duration, endAt] = params
				row.left_duration_seconds = left as number
				row.right_duration_seconds = right as number
				row.duration_seconds = duration as number
				if (endAt != null) {
					row.side_started_at = null
				}
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/left_duration_seconds = \?, right_duration_seconds = \?, duration_seconds = \?/i.test(normalized)) {
				const [left, right, duration] = params
				row.left_duration_seconds = left as number
				row.right_duration_seconds = right as number
				row.duration_seconds = duration as number
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/feeding_kind = \?, amount_ml = \?, bottle_content = \?/i.test(normalized)) {
				const [kind, amount, content] = params
				row.feeding_kind = kind as string
				row.amount_ml = amount as number
				row.bottle_content = content as string
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/food_name = \?, amount_text = \?, reaction = \?/i.test(normalized)) {
				const [food, amountText, reaction] = params
				row.food_name = food as string
				row.amount_text = amountText as string | null
				row.reaction = reaction as string | null
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/side = \?, amount_ml = \?, duration_seconds = \?/i.test(normalized)) {
				const [side, amount, duration] = params
				row.side = side as string | null
				row.amount_ml = amount as number | null
				row.duration_seconds = duration as number | null
				return { changes: 1, lastInsertRowId: 0 }
			}
			if (/amount_ml = \? WHERE event_id = \?$/i.test(normalized)) {
				row.amount_ml = params[0] as number
				return { changes: 1, lastInsertRowId: 0 }
			}
			throw new Error(`Unsupported event_feeding UPDATE: ${normalized}`)
		}

		if (/^UPDATE events SET updated_at = \? WHERE id = \?$/i.test(normalized)) {
			const [updatedAt, id] = params
			const event = this.tables.events.find((r) => r.id === id)
			if (!event) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			event.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE recent_foods SET last_used_at = \?, use_count = \? WHERE id = \?$/i.test(normalized)) {
			const [lastUsed, useCount, id] = params
			const row = this.tables.recent_foods.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.last_used_at = lastUsed as string
			row.use_count = useCount as number
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_diaper SET/i.test(normalized)) {
			const eventId = params[params.length - 1]
			const row = this.tables.event_diaper.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [wet, dirty, hasRash, color, consistency] = params
			row.wet = wet as number
			row.dirty = dirty as number
			row.has_rash = hasRash as number
			row.color = color as string | null
			row.consistency = consistency as string | null
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_activity SET place = \? WHERE event_id = \?$/i.test(normalized)) {
			const [place, eventId] = params
			const row = this.tables.event_activity.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.place = place as string | null
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_temperature SET celsius = \? WHERE event_id = \?$/i.test(normalized)) {
			const [celsius, eventId] = params
			const row = this.tables.event_temperature.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.celsius = celsius as number
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_medicine SET name = \?, dose_text = \?, unit = \? WHERE event_id = \?$/i.test(normalized)) {
			const [name, dose, unit, eventId] = params
			const row = this.tables.event_medicine.find((r) => r.event_id === eventId)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.name = name as string
			row.dose_text = dose as string | null
			row.unit = unit as string | null
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE event_milestone SET/i.test(normalized)) {
			const eventId = params[params.length - 1]
			const row = this.tables.event_milestone.find(
				(r) => r.event_id === eventId,
			)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [label, photoUri, milestoneType, linkedMomentId] = params
			row.label = label as string
			row.photo_uri = photoUri as string | null
			row.milestone_type = milestoneType as string | null
			row.linked_moment_id = linkedMomentId as string | null
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE growth_measurements SET/i.test(normalized)) {
			const id = params[params.length - 1]
			const row = this.tables.growth_measurements.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [
				measuredAt,
				measuredLocalDate,
				weightGrams,
				heightMm,
				headMm,
				notes,
				updatedAt,
			] = params
			row.measured_at = measuredAt as string
			row.measured_local_date = measuredLocalDate as string
			row.weight_grams = weightGrams as number | null
			row.height_mm = heightMm as number | null
			row.head_circumference_mm = headMm as number | null
			row.notes = notes as string | null
			row.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE teeth SET erupted_at = \?, notes = \?, updated_at = \? WHERE id = \?$/i.test(normalized)) {
			const [eruptedAt, notes, updatedAt, id] = params
			const row = this.tables.teeth.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.erupted_at = eruptedAt as string
			row.notes = notes as string | null
			row.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE moments SET/i.test(normalized)) {
			const id = params[params.length - 1]
			const row = this.tables.moments.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [
				photoUri,
				takenAt,
				takenLocalDate,
				title,
				notes,
				milestoneEventId,
				updatedAt,
			] = params
			row.photo_uri = photoUri as string
			row.taken_at = takenAt as string
			row.taken_local_date = takenLocalDate as string
			row.title = title as string | null
			row.notes = notes as string | null
			row.milestone_event_id = milestoneEventId as string | null
			row.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE month_photos SET moment_id = \?, updated_at = \? WHERE id = \?$/i.test(normalized)) {
			const [momentId, updatedAt, id] = params
			const row = this.tables.month_photos.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			row.moment_id = momentId as string
			row.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE custom_event_definitions SET/i.test(normalized)) {
			const id = params[params.length - 1]
			const row = this.tables.custom_event_definitions.find((r) => r.id === id)
			if (!row) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [name, iconKey, isActive, updatedAt] = params
			row.name = name as string
			row.icon_key = iconKey as string | null
			row.is_active = isActive as number
			row.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE events SET start_at = \?, end_at = \?, start_local_date = \?, end_local_date = \?, notes = \?, updated_at = \? WHERE id = \?$/i.test(normalized)) {
			const [
				startAt,
				endAt,
				startLocalDate,
				endLocalDate,
				notes,
				updatedAt,
				id,
			] = params
			const event = this.tables.events.find((r) => r.id === id)
			if (!event) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			event.start_at = startAt as string
			event.end_at = endAt as string | null
			event.start_local_date = startLocalDate as string
			event.end_local_date = endLocalDate as string | null
			event.notes = notes as string | null
			event.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^UPDATE events SET/i.test(normalized)) {
			const id = params[params.length - 1]
			const event = this.tables.events.find((r) => r.id === id)
			if (!event) {
				return { changes: 0, lastInsertRowId: 0 }
			}
			const [
				startAt,
				endAt,
				startLocalDate,
				endLocalDate,
				title,
				notes,
				updatedAt,
			] = params
			event.start_at = startAt as string
			event.end_at = endAt as string | null
			event.start_local_date = startLocalDate as string
			event.end_local_date = endLocalDate as string | null
			event.title = title as string | null
			event.notes = notes as string | null
			event.updated_at = updatedAt as string
			return { changes: 1, lastInsertRowId: 0 }
		}

		if (/^DELETE FROM app_settings WHERE key = \?$/i.test(normalized)) {
			const [key] = params
			const before = this.tables.app_settings.length
			this.tables.app_settings = this.tables.app_settings.filter(
				(row) => row.key !== key,
			)
			return {
				changes: before - this.tables.app_settings.length,
				lastInsertRowId: 0,
			}
		}

		if (/^DELETE FROM app_settings WHERE key = \? AND value = \?$/i.test(normalized)) {
			const [key, value] = params
			const before = this.tables.app_settings.length
			this.tables.app_settings = this.tables.app_settings.filter(
				(row) => row.key !== key || row.value !== value,
			)
			return {
				changes: before - this.tables.app_settings.length,
				lastInsertRowId: 0,
			}
		}

		const deleteMatch = normalized.match(/^DELETE FROM (\w+) WHERE id = \?$/i)
		if (deleteMatch) {
			const table = deleteMatch[1]
			if (!table || !isTableName(table)) {
				throw new Error(`Unknown table: ${table}`)
			}
			const id = params[0]
			const before = this.tables[table].length
			this.tables[table] = this.tables[table].filter((r) => r.id !== id)
			const changes = before - this.tables[table].length
			if (changes > 0 && table === 'children' && this.foreignKeysEnabled) {
				this.cascadeDeleteChild(String(id))
			}
			if (changes > 0 && table === 'events') {
				this.cascadeDeleteEvent(String(id))
			}
			return { changes, lastInsertRowId: 0 }
		}

		throw new Error(`Unsupported SQL in MemorySqlExecutor.runAsync: ${normalized}`)
	}

	async getFirstAsync<T> (
		sql: string,
		...params: SqlParam[]
	): Promise<T | null> {
		const normalized = sql.replace(/\s+/g, ' ').trim()

		if (/^PRAGMA user_version$/i.test(normalized)) {
			return { user_version: this.userVersion } as T
		}

		if (/INNER JOIN event_sleep/i.test(normalized)) {
			const rows = this.querySleepJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_feeding/i.test(normalized)) {
			const rows = this.queryFeedingJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_diaper/i.test(normalized)) {
			const rows = this.queryDiaperJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_activity/i.test(normalized)) {
			const rows = this.queryActivityJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_temperature/i.test(normalized)) {
			const rows = this.queryTempJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_medicine/i.test(normalized) && /FROM events e/i.test(normalized)) {
			const rows = this.queryMedicineJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_custom/i.test(normalized)) {
			const rows = this.queryCustomJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/INNER JOIN event_milestone/i.test(normalized)) {
			const rows = this.queryMilestoneJoins(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/FROM growth_measurements/i.test(normalized)) {
			const rows = this.queryGrowth(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/FROM teeth/i.test(normalized)) {
			const rows = this.queryTeeth(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/FROM moments/i.test(normalized)) {
			const rows = this.queryMoments(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/FROM month_photos/i.test(normalized)) {
			const rows = this.queryMonthPhotos(normalized, params)
			return (rows[0] as T) ?? null
		}

		if (/^SELECT event_id FROM event_milestone WHERE photo_uri = \?$/i.test(normalized)) {
			return (
				(this.tables.event_milestone.find(
					(r) => r.photo_uri === params[0],
				) as T) ?? null
			)
		}

		if (/^SELECT id, child_id, name, icon_key, color_token, is_active, created_at, updated_at FROM custom_event_definitions WHERE id = \?$/i.test(normalized)) {
			const row = this.tables.custom_event_definitions.find((r) => r.id === params[0])
			return (row as T) ?? null
		}

		if (/^SELECT id, child_id, start_at, end_at, start_local_date, end_local_date, title, notes, created_at, updated_at FROM events WHERE type = 'note' AND id = \?$/i.test(normalized)) {
			const row = this.tables.events.find(
				(r) => r.type === 'note' && r.id === params[0],
			)
			return (row as T) ?? null
		}

		const byId = normalized.match(/^SELECT \* FROM (\w+) WHERE id = \?$/i)
		if (byId) {
			const table = byId[1]
			if (!table || !isTableName(table)) {
				throw new Error(`Unknown table: ${table}`)
			}
			const row = this.tables[table].find((r) => r.id === params[0])
			return (row as T) ?? null
		}

		if (/^SELECT id, use_count FROM recent_foods WHERE child_id = \? AND name = \?$/i.test(normalized)) {
			const [childId, name] = params
			const row = this.tables.recent_foods.find(
				(r) => r.child_id === childId && r.name === name,
			)
			return row
				? ({ id: row.id, use_count: row.use_count } as T)
				: null
		}

		if (/^SELECT value FROM app_settings WHERE key = \?$/i.test(normalized)) {
			const row = this.tables.app_settings.find((r) => r.key === params[0])
			return row ? ({ value: row.value } as T) : null
		}

		return null
	}

	async getAllAsync<T> (
		sql: string,
		...params: SqlParam[]
	): Promise<T[]> {
		const normalized = sql.replace(/\s+/g, ' ').trim()

		if (/INNER JOIN event_sleep/i.test(normalized)) {
			return this.querySleepJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_feeding/i.test(normalized)) {
			return this.queryFeedingJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_diaper/i.test(normalized)) {
			return this.queryDiaperJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_activity/i.test(normalized)) {
			return this.queryActivityJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_temperature/i.test(normalized)) {
			return this.queryTempJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_medicine m ON m\.event_id = e\.id/i.test(normalized)) {
			return this.queryMedicineJoins(normalized, params) as T[]
		}

		if (/FROM event_medicine m INNER JOIN events e/i.test(normalized)) {
			return this.queryRecentMedicineNames(normalized, params) as T[]
		}

		if (/INNER JOIN event_custom/i.test(normalized)) {
			return this.queryCustomJoins(normalized, params) as T[]
		}

		if (/INNER JOIN event_milestone/i.test(normalized)) {
			return this.queryMilestoneJoins(normalized, params) as T[]
		}

		if (/FROM growth_measurements/i.test(normalized)) {
			return this.queryGrowth(normalized, params) as T[]
		}

		if (/FROM teeth/i.test(normalized)) {
			return this.queryTeeth(normalized, params) as T[]
		}

		if (/FROM moments/i.test(normalized)) {
			return this.queryMoments(normalized, params) as T[]
		}

		if (/FROM month_photos/i.test(normalized)) {
			return this.queryMonthPhotos(normalized, params) as T[]
		}

		if (/^SELECT event_id FROM event_milestone WHERE photo_uri = \?$/i.test(normalized)) {
			return this.tables.event_milestone
				.filter((r) => r.photo_uri === params[0])
				.map((r) => ({ event_id: r.event_id })) as T[]
		}

		if (/FROM custom_event_definitions/i.test(normalized)) {
			return this.queryCustomDefinitions(normalized, params) as T[]
		}

		if (/FROM events WHERE type = 'note' AND child_id = \? AND start_local_date = \?/i.test(normalized)) {
			const [childId, localDate] = params
			return [...this.tables.events]
				.filter(
					(r) =>
						r.type === 'note' &&
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				) as T[]
		}

		if (/FROM events WHERE type = 'note' AND child_id = \?/i.test(normalized)) {
			const [childId, limit] = params
			return [...this.tables.events]
				.filter((r) => r.type === 'note' && r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, typeof limit === 'number' ? limit : undefined) as T[]
		}

		if (/^SELECT name FROM recent_foods WHERE child_id = \?/i.test(normalized)) {
			const [childId, limit] = params
			return [...this.tables.recent_foods]
				.filter((r) => r.child_id === childId)
				.sort((a, b) => {
					const byTime = String(b.last_used_at).localeCompare(
						String(a.last_used_at),
					)
					if (byTime !== 0) {
						return byTime
					}
					return Number(b.use_count) - Number(a.use_count)
				})
				.slice(0, typeof limit === 'number' ? limit : undefined)
				.map((r) => ({ name: r.name })) as T[]
		}

		if (/^SELECT \* FROM children ORDER BY/i.test(normalized)) {
			return [...this.tables.children].sort((a, b) => {
				const activeCmp = Number(b.is_active) - Number(a.is_active)
				if (activeCmp !== 0) {
					return activeCmp
				}
				return String(a.name).localeCompare(String(b.name), undefined, {
					sensitivity: 'base',
				})
			}) as T[]
		}

		if (/^SELECT key, value FROM app_settings$/i.test(normalized)) {
			return this.tables.app_settings as T[]
		}

		if (/^SELECT \* FROM events WHERE child_id = \? AND type = \?/i.test(normalized)) {
			const [childId, type, limit] = params
			return [...this.tables.events]
				.filter((r) => r.child_id === childId && r.type === type)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, typeof limit === 'number' ? limit : undefined) as T[]
		}

		if (/^SELECT \* FROM events WHERE child_id = \? AND start_local_date = \?/i.test(normalized)) {
			const [childId, date] = params
			return [...this.tables.events]
				.filter(
					(r) =>
						r.child_id === childId && r.start_local_date === date,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				) as T[]
		}

		if (/^SELECT \* FROM events WHERE child_id = \?/i.test(normalized)) {
			const [childId, limit] = params
			return [...this.tables.events]
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, typeof limit === 'number' ? limit : undefined) as T[]
		}

		return []
	}

	private joinSleepRow (event: Row): Row | null {
		const detail = this.tables.event_sleep.find(
			(s) => s.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			sleep_type: detail.sleep_type ?? 'auto',
			quality: detail.quality ?? null,
		}
	}

	private joinFeedingRow (event: Row): Row | null {
		const detail = this.tables.event_feeding.find(
			(f) => f.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			type: event.type ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			feeding_kind: detail.feeding_kind ?? null,
			side: detail.side ?? null,
			amount_ml: detail.amount_ml ?? null,
			duration_seconds: detail.duration_seconds ?? null,
			food_name: detail.food_name ?? null,
			left_duration_seconds: detail.left_duration_seconds ?? null,
			right_duration_seconds: detail.right_duration_seconds ?? null,
			initial_side: detail.initial_side ?? null,
			last_side: detail.last_side ?? null,
			side_started_at: detail.side_started_at ?? null,
			bottle_content: detail.bottle_content ?? null,
			amount_text: detail.amount_text ?? null,
			reaction: detail.reaction ?? null,
		}
	}

	private queryFeedingJoins (
		sql: string,
		params: SqlParam[],
	): Row[] {
		const feedingTypes = new Set([
			'breastfeeding',
			'bottle',
			'pumping',
			'water',
			'solid_food',
		])
		let rows = this.tables.events
			.filter((e) => feedingTypes.has(String(e.type)))
			.map((e) => this.joinFeedingRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			const id = params[0]
			return rows.filter((r) => r.id === id)
		}

		if (
			/AND e\.child_id = \? AND e\.type = 'breastfeeding' AND e\.end_at IS NULL/i.test(
				sql,
			)
		) {
			const childId = params[0]
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.type === 'breastfeeding' &&
						r.end_at == null,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, 1)
		}

		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}

		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}

		return rows
	}

	private querySleepJoins (
		sql: string,
		params: SqlParam[],
	): Row[] {
		let rows = this.tables.events
			.filter((e) => e.type === 'sleep')
			.map((e) => this.joinSleepRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			const id = params[0]
			rows = rows.filter((r) => r.id === id)
			return rows
		}

		if (/AND e\.child_id = \? AND e\.end_at IS NULL/i.test(sql)) {
			const childId = params[0]
			rows = rows
				.filter((r) => r.child_id === childId && r.end_at == null)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
			return rows.slice(0, 1)
		}

		if (/AND e\.child_id = \? AND e\.end_at IS NOT NULL/i.test(sql)) {
			const childId = params[0]
			rows = rows
				.filter((r) => r.child_id === childId && r.end_at != null)
				.sort((a, b) =>
					String(b.end_at).localeCompare(String(a.end_at)),
				)
			return rows.slice(0, 1)
		}

		if (
			/AND e\.child_id = \? AND e\.start_local_date <= \? AND \(e\.end_local_date IS NULL OR e\.end_local_date >= \?\)/i.test(
				sql,
			)
		) {
			const [childId, localDate] = params
			rows = rows
				.filter(
					(r) =>
						r.child_id === childId &&
						String(r.start_local_date) <= String(localDate) &&
						(r.end_local_date == null ||
							String(r.end_local_date) >= String(localDate)),
				)
				.sort((a, b) =>
					String(a.start_at).localeCompare(String(b.start_at)),
				)
			return rows
		}

		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			rows = rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
			return rows.slice(0, limit)
		}

		return rows
	}

	private queryDiaperJoins (sql: string, params: SqlParam[]): Row[] {
		let rows = this.tables.events
			.filter((e) => e.type === 'diaper')
			.map((e) => this.joinDiaperRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			return rows.filter((r) => r.id === params[0])
		}
		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}
		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}
		return rows
	}

	private joinDiaperRow (event: Row): Row | null {
		const detail = this.tables.event_diaper.find(
			(d) => d.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			wet: detail.wet ?? 0,
			dirty: detail.dirty ?? 0,
			has_rash: detail.has_rash ?? 0,
			color: detail.color ?? null,
			consistency: detail.consistency ?? null,
		}
	}

	private queryActivityJoins (sql: string, params: SqlParam[]): Row[] {
		const types = new Set([
			'walk',
			'bath',
			'tummy_time',
			'massage',
			'doctor',
		])
		let rows = this.tables.events
			.filter((e) => types.has(String(e.type)))
			.map((e) => this.joinActivityRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			return rows.filter((r) => r.id === params[0])
		}
		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}
		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}
		return rows
	}

	private joinActivityRow (event: Row): Row | null {
		const detail = this.tables.event_activity.find(
			(a) => a.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			type: event.type ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			place: detail.place ?? null,
		}
	}

	private queryTempJoins (sql: string, params: SqlParam[]): Row[] {
		let rows = this.tables.events
			.filter((e) => e.type === 'temperature')
			.map((e) => this.joinTempRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			return rows.filter((r) => r.id === params[0])
		}
		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}
		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}
		return rows
	}

	private joinTempRow (event: Row): Row | null {
		const detail = this.tables.event_temperature.find(
			(t) => t.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			celsius: detail.celsius ?? null,
		}
	}

	private queryMedicineJoins (sql: string, params: SqlParam[]): Row[] {
		let rows = this.tables.events
			.filter((e) => e.type === 'medicine' || e.type === 'vitamin')
			.map((e) => this.joinMedicineRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			return rows.filter((r) => r.id === params[0])
		}
		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}
		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}
		return rows
	}

	private joinMedicineRow (event: Row): Row | null {
		const detail = this.tables.event_medicine.find(
			(m) => m.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			type: event.type ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			name: detail.name ?? null,
			dose_text: detail.dose_text ?? null,
			unit: detail.unit ?? null,
			kind: detail.kind ?? 'medicine',
		}
	}

	private queryRecentMedicineNames (
		_sql: string,
		params: SqlParam[],
	): Row[] {
		const [childId, type, kind, limit] = params
		const mapped: Row[] = []
		for (const e of this.tables.events) {
			if (e.child_id !== childId || e.type !== type) {
				continue
			}
			const detail = this.tables.event_medicine.find(
				(m) => m.event_id === e.id && m.kind === kind,
			)
			if (!detail) {
				continue
			}
			mapped.push({
				name: detail.name ?? null,
				start_at: e.start_at ?? null,
			})
		}
		return mapped
			.sort((a, b) =>
				String(b.start_at).localeCompare(String(a.start_at)),
			)
			.slice(0, typeof limit === 'number' ? limit : undefined)
			.map((r) => ({ name: r.name ?? null }))
	}

	private queryCustomJoins (sql: string, params: SqlParam[]): Row[] {
		let rows = this.tables.events
			.filter((e) => e.type === 'custom')
			.map((e) => this.joinCustomRow(e))
			.filter((r): r is Row => r != null)

		if (/AND e\.id = \?/i.test(sql)) {
			return rows.filter((r) => r.id === params[0])
		}
		if (/AND e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			const [childId, localDate] = params
			return rows
				.filter(
					(r) =>
						r.child_id === childId &&
						r.start_local_date === localDate,
				)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
		}
		if (/AND e\.child_id = \?/i.test(sql)) {
			const childId = params[0]
			const limit =
				typeof params[1] === 'number' ? params[1] : rows.length
			return rows
				.filter((r) => r.child_id === childId)
				.sort((a, b) =>
					String(b.start_at).localeCompare(String(a.start_at)),
				)
				.slice(0, limit)
		}
		return rows
	}

	private joinCustomRow (event: Row): Row | null {
		const detail = this.tables.event_custom.find(
			(c) => c.event_id === event.id,
		)
		if (!detail) {
			return null
		}
		const def = this.tables.custom_event_definitions.find(
			(d) => d.id === detail.definition_id,
		)
		return {
			id: event.id ?? null,
			child_id: event.child_id ?? null,
			start_at: event.start_at ?? null,
			end_at: event.end_at ?? null,
			start_local_date: event.start_local_date ?? null,
			end_local_date: event.end_local_date ?? null,
			notes: event.notes ?? null,
			created_at: event.created_at ?? null,
			updated_at: event.updated_at ?? null,
			definition_id: detail.definition_id ?? null,
			definition_name: def?.name ?? null,
			definition_icon_key: def?.icon_key ?? null,
		}
	}

	private queryCustomDefinitions (
		sql: string,
		params: SqlParam[],
	): Row[] {
		let rows = [...this.tables.custom_event_definitions]
		const childId = params[0]
		rows = rows.filter(
			(r) => r.child_id === childId || r.child_id == null,
		)
		if (/is_active = 1/i.test(sql)) {
			rows = rows.filter((r) => Number(r.is_active) === 1)
		}
		rows.sort((a, b) => {
			const activeCmp = Number(b.is_active) - Number(a.is_active)
			if (activeCmp !== 0 && /is_active DESC/i.test(sql)) {
				return activeCmp
			}
			return String(a.name).localeCompare(String(b.name), undefined, {
				sensitivity: 'base',
			})
		})
		return rows
	}

	/** Apply initial migration metadata for tests that skip exec DDL. */
	markMigrated (version = 1): void {
		this.userVersion = version
		const migration =
			MIGRATIONS.find((m) => m.version === version) ?? MIGRATIONS[0]
		this.tables.schema_migrations.push({
			version,
			name: migration?.name ?? 'initial_schema',
			applied_at: new Date().toISOString(),
		})
	}

	getTable (name: TableName): Row[] {
		return this.tables[name]
	}

	private assertForeignKeysOnInsert (table: TableName, row: Row): void {
		if (!this.foreignKeysEnabled) {
			return
		}
		if (table === 'events' || table === 'recent_foods' || table === 'custom_event_definitions'
			|| table === 'growth_measurements' || table === 'teeth' || table === 'moments'
			|| table === 'month_photos') {
			if (row.child_id != null) {
				const child = this.tables.children.find((c) => c.id === row.child_id)
				if (!child) {
					throw new Error(
						`FOREIGN KEY constraint failed: ${table}.child_id`,
					)
				}
			}
		}
		if (
			table === 'event_sleep' ||
			table === 'event_feeding' ||
			table === 'event_diaper' ||
			table === 'event_temperature' ||
			table === 'event_medicine' ||
			table === 'event_activity' ||
			table === 'event_milestone' ||
			table === 'event_custom'
		) {
			const event = this.tables.events.find((e) => e.id === row.event_id)
			if (!event) {
				throw new Error(
					`FOREIGN KEY constraint failed: ${table}.event_id`,
				)
			}
		}
	}

	private cascadeDeleteEvent (eventId: string): void {
		const detailTables: TableName[] = [
			'event_sleep',
			'event_feeding',
			'event_diaper',
			'event_temperature',
			'event_medicine',
			'event_activity',
			'event_milestone',
			'event_custom',
		]
		for (const table of detailTables) {
			this.tables[table] = this.tables[table].filter(
				(r) => r.event_id !== eventId,
			)
		}
	}

	private cascadeDeleteChild (childId: string): void {
		const eventIds = this.tables.events
			.filter((e) => e.child_id === childId)
			.map((e) => String(e.id))
		this.tables.events = this.tables.events.filter(
			(e) => e.child_id !== childId,
		)
		for (const eventId of eventIds) {
			this.cascadeDeleteEvent(eventId)
		}
		this.tables.app_settings = this.tables.app_settings.filter(
			(row) => !(row.key === 'activeChildId' && row.value === childId),
		)
		this.tables.recent_foods = this.tables.recent_foods.filter(
			(row) => row.child_id !== childId,
		)
		this.tables.growth_measurements = this.tables.growth_measurements.filter(
			(row) => row.child_id !== childId,
		)
		this.tables.teeth = this.tables.teeth.filter(
			(row) => row.child_id !== childId,
		)
		this.tables.moments = this.tables.moments.filter(
			(row) => row.child_id !== childId,
		)
		this.tables.month_photos = this.tables.month_photos.filter(
			(row) => row.child_id !== childId,
		)
	}

	private queryMilestoneJoins (sql: string, params: SqlParam[]): Row[] {
		let rows: Row[] = this.tables.events
			.filter((e) => e.type === 'milestone')
			.map((e) => {
				const m = this.tables.event_milestone.find(
					(d) => d.event_id === e.id,
				)
				if (!m) {
					return null
				}
				const row: Row = {
					id: e.id as string,
					child_id: e.child_id as string,
					start_at: e.start_at as string,
					start_local_date: e.start_local_date as string,
					notes: (e.notes as string | null) ?? null,
					created_at: e.created_at as string,
					updated_at: e.updated_at as string,
					label: m.label as string,
					photo_uri: (m.photo_uri as string | null) ?? null,
					milestone_type: (m.milestone_type as string | null) ?? null,
					linked_moment_id:
						(m.linked_moment_id as string | null) ?? null,
				}
				return row
			})
			.filter((r): r is Row => r != null)

		if (/e\.id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.id === params[0])
		} else if (/e\.child_id = \? AND e\.start_local_date = \?/i.test(sql)) {
			rows = rows.filter(
				(r) =>
					r.child_id === params[0] &&
					r.start_local_date === params[1],
			)
		} else if (/e\.child_id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.child_id === params[0])
		}

		rows.sort((a, b) =>
			String(b.start_at).localeCompare(String(a.start_at)),
		)
		if (/LIMIT \?/i.test(sql)) {
			const limit = params[params.length - 1]
			if (typeof limit === 'number') {
				rows = rows.slice(0, limit)
			}
		}
		return rows
	}

	private queryGrowth (sql: string, params: SqlParam[]): Row[] {
		let rows = [...this.tables.growth_measurements]
		if (/WHERE id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.id === params[0])
		} else if (/child_id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.child_id === params[0])
		}
		rows.sort((a, b) =>
			String(b.measured_at).localeCompare(String(a.measured_at)),
		)
		if (/LIMIT \?/i.test(sql)) {
			const limit = params[params.length - 1]
			if (typeof limit === 'number') {
				rows = rows.slice(0, limit)
			}
		}
		return rows
	}

	private queryTeeth (sql: string, params: SqlParam[]): Row[] {
		let rows = [...this.tables.teeth]
		if (/WHERE id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.id === params[0])
		} else if (/child_id = \? AND tooth_key = \?/i.test(sql)) {
			rows = rows.filter(
				(r) =>
					r.child_id === params[0] && r.tooth_key === params[1],
			)
		} else if (/child_id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.child_id === params[0])
		}
		rows.sort((a, b) =>
			String(b.erupted_at).localeCompare(String(a.erupted_at)),
		)
		return rows
	}

	private queryMoments (sql: string, params: SqlParam[]): Row[] {
		let rows = [...this.tables.moments]
		if (/WHERE id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.id === params[0])
		} else if (/photo_uri = \?/i.test(sql)) {
			rows = rows.filter((r) => r.photo_uri === params[0])
		} else if (/child_id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.child_id === params[0])
		}
		rows.sort((a, b) =>
			String(b.taken_at).localeCompare(String(a.taken_at)),
		)
		if (/LIMIT \?/i.test(sql)) {
			const limit = params[params.length - 1]
			if (typeof limit === 'number') {
				rows = rows.slice(0, limit)
			}
		}
		return rows
	}

	private queryMonthPhotos (sql: string, params: SqlParam[]): Row[] {
		let rows = [...this.tables.month_photos]
		if (/WHERE id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.id === params[0])
		} else if (/child_id = \? AND month_key = \?/i.test(sql)) {
			rows = rows.filter(
				(r) =>
					r.child_id === params[0] && r.month_key === params[1],
			)
		} else if (/child_id = \?/i.test(sql)) {
			rows = rows.filter((r) => r.child_id === params[0])
		}
		return rows
	}
}
