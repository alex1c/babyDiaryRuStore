/**
 * Centralized visual tokens for Diary timeline rows (icon key + soft accent).
 * Color is a secondary signal — type must remain clear without it.
 */

import type { TimelineKind } from './diaryTimeline'

export type DiaryAccentToken =
	| 'sleep'
	| 'feeding'
	| 'diaper'
	| 'activity'
	| 'health'
	| 'note'
	| 'custom'

export interface DiaryVisual {
	iconKey: string
	accent: DiaryAccentToken
}

export function diaryVisualForKind (kind: TimelineKind): DiaryVisual {
	switch (kind) {
		case 'sleep':
			return { iconKey: 'sleep', accent: 'sleep' }
		case 'feeding':
			return { iconKey: 'feeding', accent: 'feeding' }
		case 'diaper':
			return { iconKey: 'diaper', accent: 'diaper' }
		case 'activity':
			return { iconKey: 'activity', accent: 'activity' }
		case 'temperature':
		case 'medicine':
			return { iconKey: 'health', accent: 'health' }
		case 'note':
			return { iconKey: 'note', accent: 'note' }
		case 'custom':
			return { iconKey: 'custom', accent: 'custom' }
		case 'milestone':
			return { iconKey: 'milestone', accent: 'custom' }
		case 'symptom':
			return { iconKey: 'health', accent: 'health' }
		case 'doctor':
			return { iconKey: 'health', accent: 'health' }
	}
}

/** Soft accent background/text keyed by token (theme-aware mapping in UI). */
export const DIARY_ACCENT_FALLBACK: Record<
	DiaryAccentToken,
	{ bg: string; fg: string }
> = {
	sleep: { bg: '#E8EEF8', fg: '#3B5BDB' },
	feeding: { bg: '#FDECEC', fg: '#C92A2A' },
	diaper: { bg: '#E6FCF5', fg: '#0B7285' },
	activity: { bg: '#FFF4E6', fg: '#D9480F' },
	health: { bg: '#F3F0FF', fg: '#5F3DC4' },
	note: { bg: '#F1F3F5', fg: '#495057' },
	custom: { bg: '#E7F5FF', fg: '#1864AB' },
}
