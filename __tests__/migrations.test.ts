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
		expect(LATEST_SCHEMA_VERSION).toBe(9)
		expect(getExpectedSchemaVersion()).toBe(9)
		expect(MIGRATIONS.map((m) => m.version)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9,
		])

		const v7 = MIGRATIONS[6]?.sql ?? ''
		expect(v7).toContain('medicine_catalog')
		expect(v7).toContain('event_symptom')
		expect(v7).toContain('doctor_visits')
		expect(v7).toContain('health_attachments')

		const v8 = MIGRATIONS[7]?.sql ?? ''
		expect(v8).toContain('CREATE TABLE reminders')
		expect(v8).toContain('platform_notification_id')

		const v9 = MIGRATIONS[8]?.sql ?? ''
		expect(v9).toContain('idx_custom_defs_child_id')
		expect(v9).toContain('idx_reminders_child_type_enabled')
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
			'7:health_tracking',
			'8:reminders',
			'9:multi_child_cleanup_indexes',
		])
		expect(db.getTable('schema_migrations')).toHaveLength(9)
	})

	it('upgrades from v8 to v9', async () => {
		const db = new MemorySqlExecutor()
		db.markMigrated(8)
		const result = await migrateDatabase(db)
		expect(result.fromVersion).toBe(8)
		expect(result.toVersion).toBe(9)
		expect(result.applied).toEqual(['9:multi_child_cleanup_indexes'])
	})

	it('repeated migrate at v9 is idempotent', async () => {
		const db = new MemorySqlExecutor()
		await migrateDatabase(db)
		const again = await migrateDatabase(db)
		expect(again.applied).toEqual([])
		expect(again.toVersion).toBe(9)
	})
})
