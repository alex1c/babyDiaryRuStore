/**
 * Create compact / full backup ZIP packages (portable JSON + optional media).
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'

import {
	BACKUP_DATABASE_PATH,
	BACKUP_FORMAT_VERSION,
	BACKUP_MANIFEST_PATH,
	type BackupKind,
	type BackupManifest,
} from '../domain/backupManifest'
import { mediaZipEntryPath } from '../domain/backupMediaPaths'
import { LATEST_SCHEMA_VERSION } from '../db/migrations'
import type { SqlExecutor } from '../db/types'
import { nowUtcInstant } from '../utils/datetime'
import {
	collectReferencedRelativeMedia,
	exportBackupTableDump,
	findAbsoluteUriForRelative,
	relativizeDumpUris,
} from './backupTableIo'
import { createZipFromFiles, zipTextEntry, type ZipFileMap } from './backupZip'
import { logger } from './logger'

export interface CreateBackupInput {
	db: SqlExecutor
	kind: BackupKind
	documentDirectory: string
	/** Load bytes for relative media paths (full backup only). */
	readMediaBytes?: (
		relativePath: string,
		absoluteUri: string,
	) => Promise<Uint8Array | null>
	/** Optional map of absolute URI → bytes for tests. */
	mediaBytesByAbsoluteUri?: Map<string, Uint8Array>
	appVersion?: string
	platform?: string
	nowIso?: string
}

export interface CreateBackupResult {
	zipBytes: Uint8Array
	manifest: BackupManifest
	fileName: string
	zipByteLength: number
}

export class BackupError extends Error {
	constructor (
		message: string,
		readonly code:
			| 'disk_full'
			| 'media_read'
			| 'export_failed'
			| 'busy' = 'export_failed',
	) {
		super(message)
		this.name = 'BackupError'
	}
}

let backupInFlight = false

export function isBackupInFlight (): boolean {
	return backupInFlight
}

/**
 * Build a versioned ZIP backup. Does not finish active sleep/BF timers.
 */
export async function createBackupZip (
	input: CreateBackupInput,
): Promise<CreateBackupResult> {
	if (backupInFlight) {
		throw new BackupError(
			'Резервная копия уже создаётся. Подождите…',
			'busy',
		)
	}
	backupInFlight = true
	try {
		const dumpRaw = await exportBackupTableDump(input.db)
		const dump = relativizeDumpUris(dumpRaw, input.documentDirectory)
		const childrenCount = (dump.tables.children ?? []).length
		const referenced = collectReferencedRelativeMedia(
			dumpRaw,
			input.documentDirectory,
		)

		const files: ZipFileMap = {}
		let mediaFileCount = 0
		let totalMediaBytes = 0

		if (input.kind === 'full') {
			for (const relativePath of referenced) {
				const absolute = findAbsoluteUriForRelative(
					dumpRaw,
					relativePath,
					input.documentDirectory,
				)
				let bytes: Uint8Array | null = null
				if (absolute && input.mediaBytesByAbsoluteUri?.has(absolute)) {
					bytes = input.mediaBytesByAbsoluteUri.get(absolute) ?? null
				} else if (absolute && input.readMediaBytes) {
					try {
						bytes = await input.readMediaBytes(relativePath, absolute)
					} catch (err) {
						logger.warn('backup media read failed', {
							relativePath,
							error: err instanceof Error ? err.message : String(err),
						})
						bytes = null
					}
				}
				if (!bytes) {
					// Skip missing files — keep DB metadata; restore shows fallback.
					continue
				}
				files[mediaZipEntryPath(relativePath)] = bytes
				mediaFileCount += 1
				totalMediaBytes += bytes.byteLength
			}
		}

		const createdAt = input.nowIso ?? nowUtcInstant()
		const includesMedia = input.kind === 'full'
		const manifest: BackupManifest = {
			backupFormatVersion: BACKUP_FORMAT_VERSION,
			appVersion:
				input.appVersion ??
				Constants.expoConfig?.version ??
				'1.0.0',
			createdAt,
			includesMedia,
			kind: input.kind,
			childrenCount,
			databaseSchemaVersion:
				dump.schemaVersion || LATEST_SCHEMA_VERSION,
			platform: input.platform ?? Platform.OS,
			mediaFileCount: input.kind === 'full' ? mediaFileCount : 0,
			totalMediaBytes: input.kind === 'full' ? totalMediaBytes : 0,
			databaseEncoding: 'json-tables',
		}

		files[BACKUP_MANIFEST_PATH] = zipTextEntry(
			JSON.stringify(manifest, null, 2),
		)
		files[BACKUP_DATABASE_PATH] = zipTextEntry(JSON.stringify(dump))
		manifest.fileCount = Object.keys(files).length
		files[BACKUP_MANIFEST_PATH] = zipTextEntry(
			JSON.stringify(manifest, null, 2),
		)

		let zipBytes: Uint8Array
		try {
			zipBytes = createZipFromFiles(files)
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			if (/ENOSPC|no space|disk/i.test(message)) {
				throw new BackupError(
					'Недостаточно свободного места для создания полной копии.',
					'disk_full',
				)
			}
			throw new BackupError(
				'Не удалось упаковать резервную копию.',
				'export_failed',
			)
		}

		return {
			zipBytes,
			manifest,
			fileName: buildBackupFileName(input.kind, createdAt),
			zipByteLength: zipBytes.byteLength,
		}
	} finally {
		backupInFlight = false
	}
}

function buildBackupFileName (kind: BackupKind, createdAt: string): string {
	const day = createdAt.slice(0, 10) || 'backup'
	const prefix =
		kind === 'full' ? 'baby-diary-full-backup' : 'baby-diary-backup'
	return `${prefix}-${day}.zip`
}

/** Exported for tests — reset in-flight guard. */
export function resetBackupInFlightForTests (): void {
	backupInFlight = false
}
