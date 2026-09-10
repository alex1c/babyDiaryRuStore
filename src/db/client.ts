/**
 * SQLite database client bootstrap with mandatory query serialization.
 * Supports close/reopen for backup restore replacement.
 */

import * as SQLite from 'expo-sqlite'
import * as FileSystem from 'expo-file-system/legacy'

import { migrateDatabase, migrateDatabaseTo } from './migrate'
import { createSerializedExecutor, SqliteWriteQueue } from './sqliteQueue'
import type { SqlExecutor } from './types'

export const DATABASE_NAME = 'baby-diary.db'

let dbPromise: Promise<SqlExecutor> | null = null
let rawDatabase: SQLite.SQLiteDatabase | null = null
const sharedQueue = new SqliteWriteQueue()

/**
 * Default on-disk location used by expo-sqlite (documentDirectory/SQLite/).
 */
export function getDatabaseFileUri (): string {
	const root = FileSystem.documentDirectory ?? ''
	return `${root}SQLite/${DATABASE_NAME}`
}

async function openRawDatabase (): Promise<SQLite.SQLiteDatabase> {
	return SQLite.openDatabaseAsync(DATABASE_NAME)
}

function wrapRaw (raw: SQLite.SQLiteDatabase): SqlExecutor {
	const adapter: SqlExecutor = {
		runAsync: (sql, ...params) => raw.runAsync(sql, ...params),
		getFirstAsync: <T>(sql: string, ...params: (string | number | null)[]) =>
			raw.getFirstAsync<T>(sql, ...params),
		getAllAsync: <T>(sql: string, ...params: (string | number | null)[]) =>
			raw.getAllAsync<T>(sql, ...params),
		execAsync: (sql) => raw.execAsync(sql),
		withTransactionAsync: (task) =>
			raw.withTransactionAsync(() => task(adapter)),
	}
	return createSerializedExecutor(adapter, sharedQueue)
}

/**
 * Open (or reuse) the app database, run migrations, and wrap with a queue.
 * All callers share one serialized executor — never Promise.all against the
 * raw NativeDatabase.
 */
export async function getDatabase (): Promise<SqlExecutor> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const raw = await openRawDatabase()
			rawDatabase = raw
			const serialized = wrapRaw(raw)
			await migrateDatabase(serialized)
			await serialized.execAsync('PRAGMA foreign_keys = ON;')
			return serialized
		})()
	}
	return dbPromise
}

/**
 * Close the native connection after draining the write queue.
 * Required before replacing the DB file during restore.
 */
export async function closeDatabase (): Promise<void> {
	await sharedQueue.run(async () => {
		if (rawDatabase) {
			await rawDatabase.closeAsync()
			rawDatabase = null
		}
		dbPromise = null
	})
}

/**
 * Delete the on-disk database file and WAL/SHM sidecars if present.
 */
export async function deleteDatabaseFiles (): Promise<void> {
	const base = getDatabaseFileUri()
	const candidates = [base, `${base}-wal`, `${base}-shm`, `${base}-journal`]
	for (const uri of candidates) {
		try {
			const info = await FileSystem.getInfoAsync(uri)
			if (info.exists) {
				await FileSystem.deleteAsync(uri, { idempotent: true })
			}
		} catch {
			// Missing sidecar is fine.
		}
	}
}

/**
 * Recreate an empty database migrated to `schemaVersion`, then return it.
 * Used by restore before importing a dump at that schema.
 */
export async function recreateDatabaseAtSchemaVersion (
	schemaVersion: number,
): Promise<SqlExecutor> {
	await closeDatabase()
	await deleteDatabaseFiles()
	const raw = await openRawDatabase()
	rawDatabase = raw
	const serialized = wrapRaw(raw)
	await migrateDatabaseTo(serialized, schemaVersion)
	await serialized.execAsync('PRAGMA foreign_keys = ON;')
	dbPromise = Promise.resolve(serialized)
	return serialized
}

/**
 * Finish restore by migrating the reopened DB to the latest schema.
 */
export async function finalizeRestoredDatabase (
	db: SqlExecutor,
): Promise<void> {
	await migrateDatabase(db)
	await db.execAsync('PRAGMA foreign_keys = ON;')
}

/** Test helper: reset the cached promise between Jest cases. */
export function resetDatabaseCache (): void {
	dbPromise = null
	rawDatabase = null
}

export type AppDatabase = SqlExecutor
