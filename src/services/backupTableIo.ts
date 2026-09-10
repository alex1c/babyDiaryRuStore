/**
 * Export / import portable JSON table dumps through SqlExecutor.
 * Sequential queries only — respects SQLite serialization rules.
 */

import {
	BACKUP_DATA_TABLES,
	BACKUP_URI_COLUMNS,
	emptyBackupTableDump,
	type BackupTableDump,
} from '../domain/backupTables'
import {
	toAbsoluteManagedPath,
	toRelativeManagedPath,
} from '../domain/backupMediaPaths'
import { getUserVersion } from '../db/migrate'
import type { SqlExecutor } from '../db/types'

type Row = Record<string, string | number | null>

/**
 * Snapshot all backup data tables (current schema version).
 */
export async function exportBackupTableDump (
	db: SqlExecutor,
): Promise<BackupTableDump> {
	const schemaVersion = await getUserVersion(db)
	const dump = emptyBackupTableDump(schemaVersion)
	for (const table of BACKUP_DATA_TABLES) {
		// Sequential reads — never Promise.all on one NativeDatabase.
		const rows = await db.getAllAsync<Row>(`SELECT * FROM ${table}`)
		dump.tables[table] = rows.map((r) => ({ ...r }))
	}
	return dump
}

/**
 * Rewrite managed URI columns to relative paths for portable backups.
 */
export function relativizeDumpUris (
	dump: BackupTableDump,
	documentDirectory: string,
): BackupTableDump {
	const next = cloneDump(dump)
	for (const { table, column } of BACKUP_URI_COLUMNS) {
		const rows = next.tables[table] ?? []
		for (const row of rows) {
			const raw = row[column]
			if (typeof raw !== 'string' || !raw) {
				continue
			}
			const relative = toRelativeManagedPath(raw, documentDirectory)
			row[column] = relative
		}
	}
	return next
}

/**
 * Rewrite relative managed paths to absolute URIs for the current device.
 */
export function absolutizeDumpUris (
	dump: BackupTableDump,
	documentDirectory: string,
): BackupTableDump {
	const next = cloneDump(dump)
	for (const { table, column } of BACKUP_URI_COLUMNS) {
		const rows = next.tables[table] ?? []
		for (const row of rows) {
			const raw = row[column]
			if (typeof raw !== 'string' || !raw) {
				continue
			}
			const relative = toRelativeManagedPath(raw, documentDirectory)
			if (relative) {
				row[column] = toAbsoluteManagedPath(relative, documentDirectory)
			}
		}
	}
	return next
}

/**
 * Collect unique relative managed paths referenced by a dump.
 */
export function collectReferencedRelativeMedia (
	dump: BackupTableDump,
	documentDirectory: string,
): string[] {
	const set = new Set<string>()
	for (const { table, column } of BACKUP_URI_COLUMNS) {
		const rows = dump.tables[table] ?? []
		for (const row of rows) {
			const raw = row[column]
			if (typeof raw !== 'string' || !raw) {
				continue
			}
			const relative = toRelativeManagedPath(raw, documentDirectory)
			if (relative) {
				set.add(relative)
			}
		}
	}
	return [...set].sort()
}

/**
 * Find original absolute URI for a relative path from a pre-relativized dump.
 */
export function findAbsoluteUriForRelative (
	dumpRaw: BackupTableDump,
	relativePath: string,
	documentDirectory: string,
): string | null {
	for (const { table, column } of BACKUP_URI_COLUMNS) {
		for (const row of dumpRaw.tables[table] ?? []) {
			const raw = row[column]
			if (typeof raw !== 'string') {
				continue
			}
			if (toRelativeManagedPath(raw, documentDirectory) === relativePath) {
				return raw
			}
		}
	}
	return null
}

/**
 * Clear data tables and insert dump rows. Caller must ensure schema matches
 * dump.schemaVersion (migrate first). Disables FK during import.
 */
export async function importBackupTableDump (
	db: SqlExecutor,
	dump: BackupTableDump,
): Promise<void> {
	await db.execAsync('PRAGMA foreign_keys = OFF;')
	try {
		for (const table of [...BACKUP_DATA_TABLES].reverse()) {
			await db.runAsync(`DELETE FROM ${table}`)
		}
		for (const table of BACKUP_DATA_TABLES) {
			const rows = dump.tables[table] ?? []
			for (const row of rows) {
				await insertRow(db, table, row)
			}
		}
	} finally {
		await db.execAsync('PRAGMA foreign_keys = ON;')
	}
}

/**
 * Clear platform notification IDs after restore (device-local, not portable).
 */
export async function clearReminderPlatformIds (
	db: SqlExecutor,
): Promise<void> {
	const rows = await db.getAllAsync<{ id: string }>(`SELECT * FROM reminders`)
	const now = new Date().toISOString()
	for (const row of rows) {
		await db.runAsync(
			`UPDATE reminders SET platform_notification_id = ?, updated_at = ? WHERE id = ?`,
			null,
			now,
			row.id,
		)
	}
}

async function insertRow (
	db: SqlExecutor,
	table: string,
	row: Row,
): Promise<void> {
	const columns = Object.keys(row)
	if (columns.length === 0) {
		return
	}
	const placeholders = columns.map(() => '?').join(', ')
	const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
	const values = columns.map((c) => row[c] ?? null)
	await db.runAsync(sql, ...values)
}

function cloneDump (dump: BackupTableDump): BackupTableDump {
	return JSON.parse(JSON.stringify(dump)) as BackupTableDump
}
