/**
 * Schema migration runner for expo-sqlite.
 * Uses PRAGMA user_version plus a schema_migrations audit table.
 * Idempotent: re-running when already current is a no-op.
 */

import { nowUtcInstant } from '../utils/datetime'
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations'
import type { SqlExecutor } from './types'

export interface MigrationResult {
	fromVersion: number
	toVersion: number
	applied: string[]
}

export async function getUserVersion (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ user_version: number }>(
		'PRAGMA user_version',
	)
	return row?.user_version ?? 0
}

/**
 * Apply all pending migrations transactionally (per migration).
 * Foreign keys are enabled for subsequent app usage.
 * Never wipes user data — only additive / transformative SQL in migrations.
 */
export async function migrateDatabase (
	db: SqlExecutor,
): Promise<MigrationResult> {
	MIGRATIONS.forEach((migration, index) => {
		const expectedVersion = index + 1
		if (migration.version !== expectedVersion) {
			throw new Error(
				`Invalid migration sequence: expected ${expectedVersion}, got ${migration.version}`,
			)
		}
	})
	await db.execAsync('PRAGMA foreign_keys = ON;')

	const fromVersion = await getUserVersion(db)
	const applied: string[] = []

	if (fromVersion > LATEST_SCHEMA_VERSION) {
		throw new Error(
			`Database version ${fromVersion} is newer than app schema ${LATEST_SCHEMA_VERSION}`,
		)
	}

	for (const migration of MIGRATIONS) {
		if (migration.version <= fromVersion) {
			continue
		}

		try {
			// One transaction per migration so a failure rolls back cleanly.
			await db.withTransactionAsync(async () => {
				await db.execAsync(migration.sql)
				await db.execAsync(`PRAGMA user_version = ${migration.version}`)

				// schema_migrations exists after v1; record audit when available.
				if (migration.version >= 1) {
					await db.runAsync(
						`INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
						 VALUES (?, ?, ?)`,
						migration.version,
						migration.name,
						nowUtcInstant(),
					)
				}
			})
			applied.push(`${migration.version}:${migration.name}`)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error)
			console.error(
				`[migrate] Migration ${migration.version} (${migration.name}) failed:`,
				message,
			)
			throw new Error(
				`Migration ${migration.version} (${migration.name}) failed: ${message}`,
			)
		}
	}

	const toVersion = await getUserVersion(db)
	return { fromVersion, toVersion, applied }
}

export function getExpectedSchemaVersion (): number {
	return LATEST_SCHEMA_VERSION
}
