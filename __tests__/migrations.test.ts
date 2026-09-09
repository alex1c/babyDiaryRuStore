/**
 * Migration runner tests.
 */

import { MemorySqlExecutor } from '../src/db/memorySqlExecutor'
import {
	getExpectedSchemaVersion,
	migrateDatabase,
} from '../src/db/migrate'
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '../src/db/migrations'

describe('migrations', () => {
	it('exposes a monotonic schema version sequence', () => {
		expect(MIGRATIONS.length).toBeGreaterThan(0)
		expect(LATEST_SCHEMA_VERSION).toBe(1)
		expect(getExpectedSchemaVersion()).toBe(1)
		expect(MIGRATIONS.map((m) => m.version)).toEqual([1])

		const v1 = MIGRATIONS[0]?.sql ?? ''
		expect(v1).toContain('CREATE TABLE children')
		expect(v1).toContain('CREATE TABLE events')
		expect(v1).toContain('CREATE TABLE event_sleep')
		expect(v1).toContain('CREATE TABLE event_feeding')
		expect(v1).toContain('CREATE TABLE event_diaper')
		expect(v1).toContain('CREATE TABLE custom_event_definitions')
		expect(v1).toContain('CREATE TABLE app_settings')
		expect(v1).toContain('photo_uri')
	})

	it('is a no-op when already at latest version', async () => {
		const db = new MemorySqlExecutor()
		db.markMigrated(LATEST_SCHEMA_VERSION)

		const result = await migrateDatabase(db)
		expect(result.fromVersion).toBe(LATEST_SCHEMA_VERSION)
		expect(result.toVersion).toBe(LATEST_SCHEMA_VERSION)
		expect(result.applied).toEqual([])
	})

	it('bumps user_version from 0 using migration runner', async () => {
		const db = new MemorySqlExecutor()
		const result = await migrateDatabase(db)
		expect(result.fromVersion).toBe(0)
		expect(result.toVersion).toBe(LATEST_SCHEMA_VERSION)
		expect(result.applied).toEqual(['1:initial_schema'])
		expect(db.getTable('schema_migrations')).toHaveLength(1)
	})

	it('preserves children data when re-running after markMigrated', async () => {
		const db = new MemorySqlExecutor()
		db.markMigrated(1)
		const now = new Date().toISOString()
		await db.runAsync(
			`INSERT INTO children (
				id, name, sex, birth_date, birth_time, birth_weight_grams,
				birth_height_cm, photo_uri, is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)`,
			'child-1',
			'Mila',
			'female',
			'2026-01-10',
			1,
			now,
			now,
		)

		const result = await migrateDatabase(db)
		expect(result.applied).toEqual([])
		expect(db.getTable('children')).toHaveLength(1)
		expect(db.getTable('children')[0]?.name).toBe('Mila')
	})
})
