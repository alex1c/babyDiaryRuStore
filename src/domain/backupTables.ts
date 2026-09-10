/**
 * Ordered table list for portable backup dumps (parents before children).
 */

export const BACKUP_DATA_TABLES = [
	'children',
	'events',
	'event_sleep',
	'event_feeding',
	'event_diaper',
	'event_temperature',
	'event_medicine',
	'event_activity',
	'event_milestone',
	'event_custom',
	'event_symptom',
	'custom_event_definitions',
	'recent_foods',
	'growth_measurements',
	'teeth',
	'moments',
	'month_photos',
	'medicine_catalog',
	'doctor_visits',
	'health_attachments',
	'reminders',
	'app_settings',
] as const

export type BackupDataTable = (typeof BACKUP_DATA_TABLES)[number]

/** Columns that may hold managed media URIs. */
export const BACKUP_URI_COLUMNS: {
	table: BackupDataTable
	column: string
}[] = [
	{ table: 'children', column: 'photo_uri' },
	{ table: 'moments', column: 'photo_uri' },
	{ table: 'event_milestone', column: 'photo_uri' },
	{ table: 'event_symptom', column: 'photo_uri' },
	{ table: 'health_attachments', column: 'file_uri' },
]

export type BackupTableDump = {
	schemaVersion: number
	tables: Record<string, Record<string, string | number | null>[]>
}

export function emptyBackupTableDump (
	schemaVersion: number,
): BackupTableDump {
	const tables: BackupTableDump['tables'] = {}
	for (const name of BACKUP_DATA_TABLES) {
		tables[name] = []
	}
	return { schemaVersion, tables }
}
