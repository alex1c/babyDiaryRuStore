/**
 * Validate + restore backup ZIP with rollback snapshot safety.
 */

import {
	BACKUP_DATABASE_PATH,
	BACKUP_MANIFEST_PATH,
	parseManifestJson,
	type BackupManifest,
	validateBackupManifest,
} from '../domain/backupManifest'
import {
	isSafeRelativeMediaPath,
	relativePathFromMediaZipEntry,
	toAbsoluteManagedPath,
} from '../domain/backupMediaPaths'
import type { BackupTableDump } from '../domain/backupTables'
import { LATEST_SCHEMA_VERSION } from '../db/migrations'
import { migrateDatabase } from '../db/migrate'
import type { SqlExecutor } from '../db/types'
import {
	absolutizeDumpUris,
	clearReminderPlatformIds,
	exportBackupTableDump,
	importBackupTableDump,
} from './backupTableIo'
import {
	findZipEntry,
	readZipToFiles,
	unzipTextEntry,
	type ZipFileMap,
} from './backupZip'
import { logger } from './logger'

export class RestoreError extends Error {
	constructor (
		message: string,
		readonly code:
			| 'invalid_zip'
			| 'validation'
			| 'future_version'
			| 'future_schema'
			| 'missing_db'
			| 'corrupted'
			| 'rollback_failed'
			| 'apply_failed'
			| 'path_traversal' = 'apply_failed',
	) {
		super(message)
		this.name = 'RestoreError'
	}
}

export interface ValidatedBackup {
	manifest: BackupManifest
	dump: BackupTableDump
	media: Map<string, Uint8Array>
	files: ZipFileMap
}

export interface RestoreDeps {
	db: SqlExecutor
	documentDirectory: string
	/** Write restored media bytes to absolute URI. */
	writeMediaFile?: (
		relativePath: string,
		absoluteUri: string,
		bytes: Uint8Array,
	) => Promise<void>
	/** Optional: delete orphan managed files after success. */
	cleanupOrphans?: (keepRelativePaths: Set<string>) => Promise<void>
	/** After import: reschedule reminders. */
	reconcileReminders?: () => Promise<void>
	/**
	 * When true (tests / in-memory), import into the open DB after migrating
	 * in place instead of expecting a cold reopen.
	 */
	inPlace?: boolean
	/**
	 * Optional hook to recreate DB at a schema version (production close/reopen).
	 * Receives backup schema version; must return a live SqlExecutor ready for import.
	 */
	recreateDatabaseAtVersion?: (
		schemaVersion: number,
	) => Promise<SqlExecutor>
}

export interface RestoreResult {
	manifest: BackupManifest
	childrenCount: number
}

/**
 * Parse ZIP bytes and validate before mutating live data.
 */
export function validateBackupZipBytes (zipBytes: Uint8Array): ValidatedBackup {
	let files: ZipFileMap
	try {
		files = readZipToFiles(zipBytes)
	} catch {
		throw new RestoreError(
			'Не удалось прочитать ZIP-архив. Файл повреждён или это не резервная копия.',
			'invalid_zip',
		)
	}

	// Reject path traversal in any entry name.
	for (const key of Object.keys(files)) {
		const normalized = key.replace(/\\/g, '/')
		if (
			normalized.includes('..') ||
			normalized.startsWith('/') ||
			normalized.includes(':')
		) {
			throw new RestoreError(
				'В архиве обнаружен небезопасный путь файла.',
				'path_traversal',
			)
		}
	}

	const manifestBytes = findZipEntry(files, BACKUP_MANIFEST_PATH)
	if (!manifestBytes) {
		throw new RestoreError(
			'В архиве нет manifest.json',
			'validation',
		)
	}
	const manifestResult = parseManifestJson(unzipTextEntry(manifestBytes))
	if (!manifestResult.ok) {
		throw new RestoreError(
			manifestResult.message,
			manifestResult.code === 'unsupported_future_format'
				? 'future_version'
				: 'validation',
		)
	}
	const manifest = manifestResult.manifest

	if (manifest.databaseSchemaVersion > LATEST_SCHEMA_VERSION) {
		throw new RestoreError(
			'Эта копия создана более новой версией приложения. Обновите приложение и повторите восстановление.',
			'future_schema',
		)
	}

	const dbBytes = findZipEntry(files, BACKUP_DATABASE_PATH)
	if (!dbBytes) {
		throw new RestoreError(
			'В архиве нет database.json',
			'missing_db',
		)
	}

	let dump: BackupTableDump
	try {
		dump = JSON.parse(unzipTextEntry(dbBytes)) as BackupTableDump
	} catch {
		throw new RestoreError(
			'Файл базы в резервной копии повреждён.',
			'corrupted',
		)
	}
	if (!dump || typeof dump !== 'object' || !dump.tables) {
		throw new RestoreError(
			'Файл базы в резервной копии повреждён.',
			'corrupted',
		)
	}
	if (
		typeof dump.schemaVersion !== 'number' ||
		dump.schemaVersion < 1
	) {
		dump.schemaVersion = manifest.databaseSchemaVersion
	}

	const media = new Map<string, Uint8Array>()
	for (const [entry, bytes] of Object.entries(files)) {
		const relative = relativePathFromMediaZipEntry(entry)
		if (relative == null) {
			continue
		}
		if (!isSafeRelativeMediaPath(relative)) {
			throw new RestoreError(
				'В архиве обнаружен небезопасный путь медиафайла.',
				'path_traversal',
			)
		}
		media.set(relative, bytes)
	}

	return { manifest, dump, media, files }
}

/**
 * Apply a previously validated backup with rollback of the prior dump.
 */
export async function restoreValidatedBackup (
	validated: ValidatedBackup,
	deps: RestoreDeps,
): Promise<RestoreResult> {
	const rollbackDump = await exportBackupTableDump(deps.db)
	let workingDb = deps.db
	let replacedConnection = false

	try {
		if (deps.recreateDatabaseAtVersion) {
			workingDb = await deps.recreateDatabaseAtVersion(
				validated.dump.schemaVersion,
			)
			replacedConnection = true
		}

		const absoluteDump = absolutizeDumpUris(
			validated.dump,
			deps.documentDirectory,
		)
		await importBackupTableDump(workingDb, absoluteDump)
		await migrateDatabase(workingDb)
		await clearReminderPlatformIds(workingDb)

		if (deps.writeMediaFile && validated.manifest.includesMedia) {
			for (const [relative, bytes] of validated.media.entries()) {
				const absolute = toAbsoluteManagedPath(
					relative,
					deps.documentDirectory,
				)
				await deps.writeMediaFile(relative, absolute, bytes)
			}
		}

		if (deps.cleanupOrphans) {
			await deps.cleanupOrphans(new Set(validated.media.keys()))
		}

		if (deps.reconcileReminders) {
			await deps.reconcileReminders()
		}

		return {
			manifest: validated.manifest,
			childrenCount: (absoluteDump.tables.children ?? []).length,
		}
	} catch (err) {
		logger.error('restore failed — attempting rollback', err)
		try {
			let rollbackDb = deps.db
			if (replacedConnection && deps.recreateDatabaseAtVersion) {
				rollbackDb = await deps.recreateDatabaseAtVersion(
					rollbackDump.schemaVersion,
				)
			}
			await importBackupTableDump(rollbackDb, rollbackDump)
			await migrateDatabase(rollbackDb)
			if (deps.reconcileReminders) {
				await deps.reconcileReminders()
			}
		} catch (rollbackErr) {
			logger.error('rollback failed', rollbackErr)
			throw new RestoreError(
				'Восстановление не удалось, и откат тоже завершился ошибкой. Переустановите приложение или восстановите другую копию.',
				'rollback_failed',
			)
		}
		const message =
			err instanceof RestoreError
				? err.message
				: err instanceof Error
					? err.message
					: 'Не удалось восстановить резервную копию.'
		throw new RestoreError(message, 'apply_failed')
	}
}

/**
 * Convenience: validate ZIP then restore.
 */
export async function restoreBackupZip (
	zipBytes: Uint8Array,
	deps: RestoreDeps,
): Promise<RestoreResult> {
	const validated = validateBackupZipBytes(zipBytes)
	return restoreValidatedBackup(validated, deps)
}

/** Preview helper for UI — validate only. */
export function previewBackupZip (zipBytes: Uint8Array): BackupManifest {
	return validateBackupZipBytes(zipBytes).manifest
}

// Re-export for callers that already parsed JSON manifests in tests.
export { validateBackupManifest }
