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
		expect(LATEST_SCHEMA_VERSION).toBe(6)
		expect(getExpectedSchemaVersion()).toBe(6)
		expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6])

		const v6 = MIGRATIONS[5]?.sql ?? ''
		expect(v6).toContain('growth_measurements')
		expect(v6).toContain('moments')
		expect(v6).toContain('month_photos')
		expect(v6).toContain('teeth')
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
			'6:growth_milestones_moments',
		])
		expect(db.getTable('schema_migrations')).toHaveLength(6)
	})

	it('upgrades from v5 to v6', async () => {
		const db = new MemorySqlExecutor()
		db.markMigrated(5)
		const result = await migrateDatabase(db)
		expect(result.fromVersion).toBe(5)
		expect(result.toVersion).toBe(6)
		expect(result.applied).toEqual(['6:growth_milestones_moments'])
	})

	it('repeated migrate at v6 is idempotent', async () => {
		const db = new MemorySqlExecutor()
		await migrateDatabase(db)
		const again = await migrateDatabase(db)
		expect(again.applied).toEqual([])
		expect(again.toVersion).toBe(6)
	})
})
