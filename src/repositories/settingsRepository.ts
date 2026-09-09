/**
 * App settings repository (theme, active child, onboarding flag).
 */

import type { SqlExecutor } from '../db/types'
import type { AppSettings, ThemePreference } from '../models/types'

const KEY_THEME = 'themePreference'
const KEY_ACTIVE_CHILD = 'activeChildId'
const KEY_ONBOARDING = 'onboardingCompleted'

const DEFAULTS: AppSettings = {
	themePreference: 'system',
	activeChildId: null,
	onboardingCompleted: false,
}

function parseTheme (value: string | null | undefined): ThemePreference {
	if (value === 'light' || value === 'dark' || value === 'system') {
		return value
	}
	return 'system'
}

export class SettingsRepository {
	constructor (private readonly db: SqlExecutor) {}

	async get (): Promise<AppSettings> {
		const rows = await this.db.getAllAsync<{ key: string; value: string }>(
			'SELECT key, value FROM app_settings',
		)
		const map = new Map(rows.map((r) => [r.key, r.value]))
		const activeRaw = map.get(KEY_ACTIVE_CHILD)
		return {
			themePreference: parseTheme(map.get(KEY_THEME)),
			activeChildId: activeRaw && activeRaw.length > 0 ? activeRaw : null,
			onboardingCompleted: map.get(KEY_ONBOARDING) === '1',
		}
	}

	async setThemePreference (preference: ThemePreference): Promise<void> {
		await this.upsert(KEY_THEME, preference)
	}

	async setActiveChildId (childId: string | null): Promise<void> {
		if (childId == null) {
			await this.db.runAsync(
				'DELETE FROM app_settings WHERE key = ?',
				KEY_ACTIVE_CHILD,
			)
			return
		}
		await this.upsert(KEY_ACTIVE_CHILD, childId)
	}

	async setOnboardingCompleted (done: boolean): Promise<void> {
		await this.upsert(KEY_ONBOARDING, done ? '1' : '0')
	}

	private async upsert (key: string, value: string): Promise<void> {
		await this.db.runAsync(
			`INSERT INTO app_settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			key,
			value,
		)
	}

	/** Exposed for tests that need known defaults. */
	static defaults (): AppSettings {
		return { ...DEFAULTS }
	}
}
