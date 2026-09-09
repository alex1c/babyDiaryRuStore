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

	async withTransactionAsync (task: () => Promise<void>): Promise<void> {
		const snapshot = JSON.parse(JSON.stringify(this.tables)) as Record<
			TableName,
			Row[]
		>
		const versionSnapshot = this.userVersion
		try {
			await task()
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

		const byId = normalized.match(/^SELECT \* FROM (\w+) WHERE id = \?$/i)
		if (byId) {
			const table = byId[1]
			if (!table || !isTableName(table)) {
				throw new Error(`Unknown table: ${table}`)
			}
			const row = this.tables[table].find((r) => r.id === params[0])
			return (row as T) ?? null
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
		if (table === 'events') {
			const child = this.tables.children.find((c) => c.id === row.child_id)
			if (!child) {
				throw new Error('FOREIGN KEY constraint failed: events.child_id')
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
	}
}
