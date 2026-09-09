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
		expect(LATEST_SCHEMA_VERSION).toBe(5)
		expect(getExpectedSchemaVersion()).toBe(5)
		expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3, 4, 5])

		const v5 = MIGRATIONS[4]?.sql ?? ''
		expect(v5).toContain('idx_events_child_start_at')
		expect(v5).toContain('idx_events_child_end_local')
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
		expect(result.applied).toEqual([
			'1:initial_schema',
			'2:sleep_type_on_event_sleep',
			'3:feeding_details_and_recent_foods',
			'4:diaper_details_and_quick_events',
			'5:diary_query_indexes',
		])
		expect(db.getTable('schema_migrations')).toHaveLength(5)
	})

	it('upgrades from v4 to v5', async () => {
		const db = new MemorySqlExecutor()
		db.markMigrated(4)
		const result = await migrateDatabase(db)
		expect(result.fromVersion).toBe(4)
		expect(result.toVersion).toBe(5)
		expect(result.applied).toEqual(['5:diary_query_indexes'])
	})
})
