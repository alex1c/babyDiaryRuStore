/**
 * SQLite database client bootstrap with mandatory query serialization.
 */

import * as SQLite from 'expo-sqlite'

import { migrateDatabase } from './migrate'
import { createSerializedExecutor, SqliteWriteQueue } from './sqliteQueue'
import type { SqlExecutor } from './types'

export const DATABASE_NAME = 'baby-diary.db'

let dbPromise: Promise<SqlExecutor> | null = null
const sharedQueue = new SqliteWriteQueue()

/**
 * Open (or reuse) the app database, run migrations, and wrap with a queue.
 * All callers share one serialized executor — never Promise.all against the
 * raw NativeDatabase.
 */
export async function getDatabase (): Promise<SqlExecutor> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const raw = await SQLite.openDatabaseAsync(DATABASE_NAME)
			const adapter: SqlExecutor = {
				runAsync: (sql, ...params) => raw.runAsync(sql, ...params),
				getFirstAsync: <T>(sql: string, ...params: (string | number | null)[]) =>
					raw.getFirstAsync<T>(sql, ...params),
				getAllAsync: <T>(sql: string, ...params: (string | number | null)[]) =>
					raw.getAllAsync<T>(sql, ...params),
				execAsync: (sql) => raw.execAsync(sql),
				withTransactionAsync: (task) => raw.withTransactionAsync(task),
			}

			const serialized = createSerializedExecutor(adapter, sharedQueue)
			await migrateDatabase(serialized)
			await serialized.execAsync('PRAGMA foreign_keys = ON;')
			return serialized
		})()
	}
	return dbPromise
}

/** Test helper: reset the cached promise between Jest cases. */
export function resetDatabaseCache (): void {
	dbPromise = null
}

export type AppDatabase = SqlExecutor
