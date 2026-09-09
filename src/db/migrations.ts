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
	{
		version: 4,
		name: 'diaper_details_and_quick_events',
		sql: `
PRAGMA foreign_keys = ON;

-- Optional observation fields for diaper (not medical diagnosis).
ALTER TABLE event_diaper ADD COLUMN color TEXT;
ALTER TABLE event_diaper ADD COLUMN consistency TEXT;

-- vitamin | medicine — same detail table, separate events.type values.
ALTER TABLE event_medicine ADD COLUMN kind TEXT NOT NULL DEFAULT 'medicine';

-- Per-child custom event types (nullable keeps legacy/global rows readable).
ALTER TABLE custom_event_definitions ADD COLUMN child_id TEXT;

CREATE INDEX idx_custom_defs_child_active
	ON custom_event_definitions(child_id, is_active);
`,
	},
	{
		version: 5,
		name: 'diary_query_indexes',
		sql: `
PRAGMA foreign_keys = ON;

-- Day-mode and timeline sorts by wall-clock start.
CREATE INDEX IF NOT EXISTS idx_events_child_start_at
	ON events(child_id, start_at);

-- Overnight sleep overlap lookups (end_local_date range).
CREATE INDEX IF NOT EXISTS idx_events_child_end_local
	ON events(child_id, end_local_date);
`,
	},
	{
		version: 6,
		name: 'growth_milestones_moments',
		sql: `
PRAGMA foreign_keys = ON;

-- Growth visit: any combination of weight / height / head (nullable).
CREATE TABLE growth_measurements (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	measured_at TEXT NOT NULL,
	measured_local_date TEXT NOT NULL,
	weight_grams INTEGER,
	height_mm INTEGER,
	head_circumference_mm INTEGER,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX idx_growth_child_date
	ON growth_measurements(child_id, measured_local_date);
CREATE INDEX idx_growth_child_measured_at
	ON growth_measurements(child_id, measured_at);

-- Milestone detail extras (events.type = 'milestone').
ALTER TABLE event_milestone ADD COLUMN milestone_type TEXT;
ALTER TABLE event_milestone ADD COLUMN linked_moment_id TEXT;

-- Tooth eruption tracker.
CREATE TABLE teeth (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	tooth_key TEXT NOT NULL,
	erupted_at TEXT NOT NULL,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
	UNIQUE (child_id, tooth_key)
);

CREATE INDEX idx_teeth_child ON teeth(child_id, erupted_at);

-- Photo moments — URI/path only, never BLOBs.
CREATE TABLE moments (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	photo_uri TEXT NOT NULL,
	taken_at TEXT NOT NULL,
	taken_local_date TEXT NOT NULL,
	title TEXT,
	notes TEXT,
	milestone_event_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
	FOREIGN KEY (milestone_event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE INDEX idx_moments_child_taken
	ON moments(child_id, taken_at);

-- First-year / monthly featured photo selection.
CREATE TABLE month_photos (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	month_key TEXT NOT NULL,
	moment_id TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
	FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
	UNIQUE (child_id, month_key)
);
`,
	},
	{
		version: 7,
		name: 'health_tracking',
		sql: `
PRAGMA foreign_keys = ON;

-- Optional measurement method (axillary / ear / forehead / rectal / unset).
ALTER TABLE event_temperature ADD COLUMN method TEXT;

-- Link intake rows to user catalog (name snapshot stays on event_medicine.name).
ALTER TABLE event_medicine ADD COLUMN catalog_id TEXT;

-- User-defined medicine / vitamin catalog (not a drug database).
CREATE TABLE medicine_catalog (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	name TEXT NOT NULL,
	default_dose TEXT,
	default_unit TEXT,
	notes TEXT,
	is_active INTEGER NOT NULL DEFAULT 1,
	-- Reserved for future reminders (unused in Phase 7).
	reminder_enabled INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX idx_medicine_catalog_child
	ON medicine_catalog(child_id, is_active, name);

-- Symptom observations (events.type = 'symptom').
CREATE TABLE event_symptom (
	event_id TEXT PRIMARY KEY NOT NULL,
	symptom_type TEXT NOT NULL,
	custom_label TEXT,
	severity TEXT,
	photo_uri TEXT,
	resolved_at TEXT,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Doctor visit records (observations / notes only — no diagnoses).
CREATE TABLE doctor_visits (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	visited_at TEXT NOT NULL,
	visited_local_date TEXT NOT NULL,
	specialist_key TEXT NOT NULL,
	specialist_label TEXT NOT NULL,
	reason TEXT,
	notes TEXT,
	recommendations TEXT,
	next_visit_at TEXT,
	next_visit_local_date TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX idx_doctor_visits_child
	ON doctor_visits(child_id, visited_at);

-- Health attachments — URI/path only under health-documents/.
CREATE TABLE health_attachments (
	id TEXT PRIMARY KEY NOT NULL,
	child_id TEXT NOT NULL,
	owner_kind TEXT NOT NULL,
	owner_id TEXT NOT NULL,
	file_uri TEXT NOT NULL,
	mime_hint TEXT,
	title TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX idx_health_attachments_owner
	ON health_attachments(owner_kind, owner_id);
CREATE INDEX idx_health_attachments_child
	ON health_attachments(child_id);
`,
	},
]

export const LATEST_SCHEMA_VERSION =
	MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0
