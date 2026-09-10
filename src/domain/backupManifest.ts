/**
 * Backup format constants and manifest validation (Phase 12).
 */

export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_ROOT_PREFIX = 'baby-diary-backup/'
export const BACKUP_MANIFEST_PATH = `${BACKUP_ROOT_PREFIX}manifest.json`
export const BACKUP_DATABASE_PATH = `${BACKUP_ROOT_PREFIX}database.json`
export const BACKUP_MEDIA_PREFIX = `${BACKUP_ROOT_PREFIX}media/`

/** Supported format versions this app can restore. */
export const SUPPORTED_BACKUP_FORMAT_VERSIONS = [1] as const

export type BackupKind = 'compact' | 'full'

export interface BackupManifest {
	backupFormatVersion: number
	appVersion: string
	createdAt: string
	includesMedia: boolean
	kind: BackupKind
	childrenCount: number
	databaseSchemaVersion: number
	platform: string
	fileCount?: number
	mediaFileCount?: number
	totalMediaBytes?: number
	/** Portable JSON table dump (format v1). */
	databaseEncoding: 'json-tables'
}

export type ManifestValidationResult =
	| { ok: true; manifest: BackupManifest }
	| { ok: false; code: ManifestErrorCode; message: string }

export type ManifestErrorCode =
	| 'missing_manifest'
	| 'invalid_json'
	| 'invalid_manifest'
	| 'unsupported_future_format'
	| 'unsupported_format'

export function isBackupFormatSupported (version: number): boolean {
	return (SUPPORTED_BACKUP_FORMAT_VERSIONS as readonly number[]).includes(
		version,
	)
}

/**
 * Parse and validate a manifest object from backup ZIP.
 * User-facing messages stay Russian and avoid internal field names.
 */
export function validateBackupManifest (
	raw: unknown,
): ManifestValidationResult {
	if (raw == null) {
		return {
			ok: false,
			code: 'missing_manifest',
			message: 'В архиве нет описания копии',
		}
	}
	if (typeof raw !== 'object') {
		return {
			ok: false,
			code: 'invalid_manifest',
			message: 'Некорректное описание копии',
		}
	}
	const obj = raw as Record<string, unknown>
	const formatVersion = Number(obj.backupFormatVersion)
	if (!Number.isFinite(formatVersion)) {
		return {
			ok: false,
			code: 'invalid_manifest',
			message: 'В описании копии нет версии формата',
		}
	}
	if (formatVersion > BACKUP_FORMAT_VERSION) {
		return {
			ok: false,
			code: 'unsupported_future_format',
			message:
				'Эта копия создана более новой версией приложения. Обновите приложение и повторите восстановление.',
		}
	}
	if (!isBackupFormatSupported(formatVersion)) {
		return {
			ok: false,
			code: 'unsupported_format',
			message: `Формат резервной копии ${formatVersion} не поддерживается`,
		}
	}

	const includesMedia = Boolean(obj.includesMedia)
	const kind: BackupKind =
		obj.kind === 'full' || obj.kind === 'compact'
			? obj.kind
			: includesMedia
				? 'full'
				: 'compact'

	const schemaVersion = Number(obj.databaseSchemaVersion)
	if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
		return {
			ok: false,
			code: 'invalid_manifest',
			message: 'Некорректная версия базы в копии',
		}
	}

	const childrenCount = Number(obj.childrenCount)
	if (!Number.isFinite(childrenCount) || childrenCount < 0) {
		return {
			ok: false,
			code: 'invalid_manifest',
			message: 'Некорректное число детей в копии',
		}
	}

	const appVersion =
		typeof obj.appVersion === 'string' && obj.appVersion.trim()
			? obj.appVersion.trim()
			: 'неизвестно'
	const createdAt =
		typeof obj.createdAt === 'string' && obj.createdAt.trim()
			? obj.createdAt.trim()
			: ''
	if (!createdAt) {
		return {
			ok: false,
			code: 'invalid_manifest',
			message: 'В описании копии нет даты создания',
		}
	}

	const platform =
		typeof obj.platform === 'string' && obj.platform.trim()
			? obj.platform.trim()
			: 'неизвестно'

	if (obj.databaseEncoding != null && obj.databaseEncoding !== 'json-tables') {
		return {
			ok: false,
			code: 'unsupported_format',
			message: 'Неподдерживаемое кодирование базы в резервной копии',
		}
	}

	const manifest: BackupManifest = {
		backupFormatVersion: formatVersion,
		appVersion,
		createdAt,
		includesMedia,
		kind,
		childrenCount,
		databaseSchemaVersion: schemaVersion,
		platform,
		databaseEncoding: 'json-tables',
	}
	if (typeof obj.fileCount === 'number') {
		manifest.fileCount = obj.fileCount
	}
	if (typeof obj.mediaFileCount === 'number') {
		manifest.mediaFileCount = obj.mediaFileCount
	}
	if (typeof obj.totalMediaBytes === 'number') {
		manifest.totalMediaBytes = obj.totalMediaBytes
	}
	return { ok: true, manifest }
}

export function parseManifestJson (text: string): ManifestValidationResult {
	try {
		const parsed: unknown = JSON.parse(text)
		return validateBackupManifest(parsed)
	} catch {
		return {
			ok: false,
			code: 'invalid_json',
			message: 'Не удалось прочитать описание копии',
		}
	}
}
