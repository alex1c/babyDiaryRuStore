/**
 * Migration definitions.
 * Each migration bumps schema version by 1 and runs inside a transaction.
 */

export interface Migration {
	version: number
	name: string
	sql: string
}

/**
 * Initial schema:
 * - multi-child profiles
 * - shared events table + typed detail tables
 * - custom event definitions for future user types
 * - app_settings key/value store
 *
 * Photos are URI/path only — never BLOBs in SQLite.
 */
export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		name: 'initial_schema',
		sql: `
PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
	version INTEGER PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	applied_at TEXT NOT NULL
);

CREATE TABLE children (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	sex TEXT,
	birth_date TEXT NOT NULL,
	birth_time TEXT,
	birth_weight_grams INTEGER,
	birth_height_cm REAL,
	photo_uri TEXT,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX idx_children_active ON children(is_active);

CREATE TABLE events (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	type TEXT NOT NULL,
	start_at TEXT NOT NULL,
	end_at TEXT,
	start_local_date TEXT NOT NULL,
	end_local_date TEXT,
	title TEXT,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
	UNIQUE (id, child_id)
);

CREATE INDEX idx_events_child_start_local ON events(child_id, start_local_date);
CREATE INDEX idx_events_child_type_start ON events(child_id, type, start_at);
CREATE INDEX idx_events_type ON events(type);

-- Sleep: duration lives on events.start_at / end_at; quality is optional detail.
CREATE TABLE event_sleep (
	event_id TEXT PRIMARY KEY NOT NULL,
	quality TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Feeding kinds share one detail table (breastfeeding/bottle/pumping/water/solid).
CREATE TABLE event_feeding (
	event_id TEXT PRIMARY KEY NOT NULL,
	feeding_kind TEXT NOT NULL,
	side TEXT,
	amount_ml REAL,
	duration_seconds INTEGER,
	food_name TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_diaper (
	event_id TEXT PRIMARY KEY NOT NULL,
	wet INTEGER NOT NULL DEFAULT 0,
	dirty INTEGER NOT NULL DEFAULT 0,
	has_rash INTEGER NOT NULL DEFAULT 0,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_temperature (
	event_id TEXT PRIMARY KEY NOT NULL,
	celsius REAL NOT NULL,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_medicine (
	event_id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	dose_text TEXT,
	unit TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Walk / bath / tummy_time / massage share a light activity detail row.
CREATE TABLE event_activity (
	event_id TEXT PRIMARY KEY NOT NULL,
	place TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE event_milestone (
	event_id TEXT PRIMARY KEY NOT NULL,
	label TEXT NOT NULL,
	photo_uri TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE custom_event_definitions (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	icon_key TEXT,
	color_token TEXT,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE event_custom (
	event_id TEXT PRIMARY KEY NOT NULL,
	definition_id TEXT,
	payload_json TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
	FOREIGN KEY (definition_id) REFERENCES custom_event_definitions(id) ON DELETE SET NULL
);

CREATE TABLE app_settings (
	key TEXT PRIMARY KEY NOT NULL,
	value TEXT NOT NULL
);

CREATE TRIGGER clear_active_child_after_delete
AFTER DELETE ON children
BEGIN
	DELETE FROM app_settings
	WHERE key = 'activeChildId' AND value = OLD.id;
END;
`,
	},
	{
		version: 2,
		name: 'sleep_type_on_event_sleep',
		sql: `
PRAGMA foreign_keys = ON;

-- day | night | auto — user can override; auto is a simple heuristic only.
ALTER TABLE event_sleep ADD COLUMN sleep_type TEXT NOT NULL DEFAULT 'auto';
`,
	},
	{
		version: 3,
		name: 'feeding_details_and_recent_foods',
		sql: `
PRAGMA foreign_keys = ON;

-- Breastfeeding side segments + bottle/solid extras on event_feeding.
ALTER TABLE event_feeding ADD COLUMN left_duration_seconds INTEGER;
ALTER TABLE event_feeding ADD COLUMN right_duration_seconds INTEGER;
ALTER TABLE event_feeding ADD COLUMN initial_side TEXT;
ALTER TABLE event_feeding ADD COLUMN last_side TEXT;
ALTER TABLE event_feeding ADD COLUMN side_started_at TEXT;
ALTER TABLE event_feeding ADD COLUMN bottle_content TEXT;
ALTER TABLE event_feeding ADD COLUMN amount_text TEXT;
ALTER TABLE event_feeding ADD COLUMN reaction TEXT;

CREATE TABLE recent_foods (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	name TEXT NOT NULL,
	last_used_at TEXT NOT NULL,
	use_count INTEGER NOT NULL DEFAULT 1,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
	UNIQUE (child_id, name)
);

CREATE INDEX idx_recent_foods_child ON recent_foods(child_id, last_used_at);
`,
	},
]

export const LATEST_SCHEMA_VERSION =
	MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0
