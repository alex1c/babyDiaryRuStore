/**
 * Child create/delete lifecycle — cascade DB rows + managed file cleanup.
 * Reminder platform notifications are cancelled before SQLite delete.
 */

import type { SqlExecutor } from '../db/types'
import type { ChildRepository } from '../repositories/childRepository'
import type { ReminderRepository } from '../repositories/reminderRepository'
import type { SettingsRepository } from '../repositories/settingsRepository'
import type { PhotoStorage } from './photoStorage'
import { ReminderService } from './reminderService'
import { logger } from './logger'
import { resolveActiveChildId } from '../domain/onboarding'

export interface ChildLifecycleDeps {
	db: SqlExecutor
	children: ChildRepository
	reminders: ReminderRepository
	reminderService: ReminderService
	settings: SettingsRepository
	momentPhotos: PhotoStorage
	healthPhotos: PhotoStorage
	profilePhotos: PhotoStorage
}

export interface DeleteChildResult {
	deletedChildId: string
	/** Remaining children after delete. */
	remainingCount: number
	/** New active child id, or null when none left (onboarding). */
	nextActiveChildId: string | null
}

/**
 * Delete one child with controlled cleanup:
 * 1) cancel reminders / platform notifications
 * 2) collect managed file URIs
 * 3) delete custom_event_definitions (no FK in schema)
 * 4) DELETE child (SQLite CASCADE for events/etc.)
 * 5) delete orphan managed files (refcount-safe for moments)
 */
export async function deleteChildWithCleanup (
	deps: ChildLifecycleDeps,
	childId: string,
): Promise<DeleteChildResult> {
	const existing = await deps.children.getById(childId)
	if (!existing) {
		throw new Error('Профиль ребёнка не найден')
	}

	const reminderRows = await deps.reminders.listByChild(childId)
	for (const reminder of reminderRows) {
		try {
			await deps.reminderService.delete(reminder.id)
		} catch (err) {
			logger.warn('reminder cancel on child delete failed', {
				id: reminder.id,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	// Collect file URIs before cascade wipe (sequential queries).
	const profileUri = existing.photoUri
	const momentUris = await collectColumnUris(
		deps.db,
		`SELECT photo_uri AS uri FROM moments WHERE child_id = ? AND photo_uri IS NOT NULL`,
		childId,
	)
	const milestoneUris = await collectColumnUris(
		deps.db,
		`SELECT m.photo_uri AS uri
		 FROM event_milestone m
		 INNER JOIN events e ON e.id = m.event_id
		 WHERE e.child_id = ? AND m.photo_uri IS NOT NULL`,
		childId,
	)
	const healthUris = await collectColumnUris(
		deps.db,
		`SELECT file_uri AS uri FROM health_attachments WHERE child_id = ?`,
		childId,
	)
	const symptomPhotoUris = await collectColumnUris(
		deps.db,
		`SELECT s.photo_uri AS uri
		 FROM event_symptom s
		 INNER JOIN events e ON e.id = s.event_id
		 WHERE e.child_id = ? AND s.photo_uri IS NOT NULL`,
		childId,
	)

	await deps.db.withTransactionAsync(async (tx) => {
		await tx.runAsync(
			`DELETE FROM custom_event_definitions WHERE child_id = ?`,
			childId,
		)
		await tx.runAsync(`DELETE FROM children WHERE id = ?`, childId)
	})

	const momentCandidates = uniqueUris([
		...momentUris,
		...milestoneUris,
	])
	for (const uri of momentCandidates) {
		await safeDeleteIfUnused(deps, uri)
	}
	for (const uri of uniqueUris([...healthUris, ...symptomPhotoUris])) {
		if (deps.healthPhotos.isManaged(uri)) {
			await deps.healthPhotos.deleteManaged(uri)
		}
	}
	if (profileUri && deps.profilePhotos.isManaged(profileUri)) {
		await deps.profilePhotos.deleteManaged(profileUri)
	}

	const remaining = await deps.children.listAll()
	const nextActive = resolveActiveChildId(remaining, null)
	await deps.settings.setActiveChildId(nextActive)

	return {
		deletedChildId: childId,
		remainingCount: remaining.length,
		nextActiveChildId: nextActive,
	}
}

async function collectColumnUris (
	db: SqlExecutor,
	sql: string,
	childId: string,
): Promise<string[]> {
	const rows = await db.getAllAsync<{ uri: string | null }>(sql, childId)
	return rows
		.map((r) => r.uri)
		.filter((u): u is string => typeof u === 'string' && u.length > 0)
}

function uniqueUris (uris: string[]): string[] {
	return [...new Set(uris)]
}

/**
 * Delete a moments-managed URI only when no remaining child references it.
 * Shared files across children are preserved.
 */
async function safeDeleteIfUnused (
	deps: ChildLifecycleDeps,
	uri: string,
): Promise<void> {
	if (!deps.momentPhotos.isManaged(uri)) {
		return
	}
	const momentRefs = await deps.db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM moments WHERE photo_uri = ?`,
		uri,
	)
	const milestoneRefs = await deps.db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM event_milestone WHERE photo_uri = ?`,
		uri,
	)
	const total = Number(momentRefs?.c ?? 0) + Number(milestoneRefs?.c ?? 0)
	if (total === 0) {
		await deps.momentPhotos.deleteManaged(uri)
	}
}
