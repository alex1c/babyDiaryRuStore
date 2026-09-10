/**
 * Managed media path helpers for backup/restore across devices.
 * SQLite stores absolute URIs at runtime; backups use relative managed paths.
 */

import {
	HEALTH_DOCS_SUBDIR,
	MOMENTS_SUBDIR,
	PROFILE_PHOTOS_SUBDIR,
} from '../services/photoStorage'

export const MANAGED_MEDIA_SUBDIRS = [
	MOMENTS_SUBDIR,
	PROFILE_PHOTOS_SUBDIR,
	HEALTH_DOCS_SUBDIR,
] as const

export type ManagedMediaSubdir = (typeof MANAGED_MEDIA_SUBDIRS)[number]

function ensureTrailingSlash (path: string): string {
	if (!path) {
		return path
	}
	return path.endsWith('/') ? path : `${path}/`
}

function stripFileScheme (uri: string): string {
	return uri.replace(/^file:\/\//i, '')
}

/**
 * Reject path traversal and absolute escapes inside ZIP / relative media keys.
 */
export function isSafeRelativeMediaPath (relativePath: string): boolean {
	if (!relativePath || relativePath.includes('\0')) {
		return false
	}
	const normalized = relativePath.replace(/\\/g, '/')
	if (normalized.startsWith('/') || normalized.includes(':')) {
		return false
	}
	const parts = normalized.split('/')
	if (parts.some((p) => p === '..' || p === '')) {
		return false
	}
	const subdir = `${parts[0]}/`
	if (!(MANAGED_MEDIA_SUBDIRS as readonly string[]).includes(subdir)) {
		return false
	}
	if (parts.length < 2) {
		return false
	}
	return true
}

/**
 * Convert an absolute managed URI to a portable relative path (moments/x.jpg).
 * Returns null when the URI is not under a known managed root.
 */
export function toRelativeManagedPath (
	uri: string | null | undefined,
	documentDirectory: string,
): string | null {
	if (!uri) {
		return null
	}
	// Already relative and safe.
	if (isSafeRelativeMediaPath(uri)) {
		return uri.replace(/\\/g, '/')
	}
	const docRoot = ensureTrailingSlash(documentDirectory)
	const candidates = [docRoot, `file://${stripFileScheme(docRoot)}`]
	for (const root of candidates) {
		if (uri.startsWith(root)) {
			const relative = uri.slice(root.length).replace(/^\/+/, '')
			return isSafeRelativeMediaPath(relative) ? relative : null
		}
	}
	// memory://moments/file-1.jpg or memory://device-b/moments/file-1.jpg (Jest)
	const memoryMatch = uri.match(
		/^memory:\/\/(?:.*\/)?((?:moments|profile-photos|health-documents)\/.+)$/,
	)
	if (memoryMatch?.[1] && isSafeRelativeMediaPath(memoryMatch[1])) {
		return memoryMatch[1]
	}
	return null
}

/**
 * Rebuild absolute URI for the current device documentDirectory.
 */
export function toAbsoluteManagedPath (
	relativePath: string,
	documentDirectory: string,
): string {
	const safe = relativePath.replace(/\\/g, '/')
	if (!isSafeRelativeMediaPath(safe)) {
		throw new Error(`Unsafe media path: ${relativePath}`)
	}
	const docRoot = ensureTrailingSlash(documentDirectory)
	if (docRoot.startsWith('memory://')) {
		return `${docRoot}${safe}`
	}
	if (docRoot.startsWith('file://')) {
		return `${docRoot}${safe}`
	}
	return `file://${stripFileScheme(docRoot)}${safe}`
}

/**
 * Zip entry path for a relative managed file.
 */
export function mediaZipEntryPath (relativePath: string): string {
	const safe = relativePath.replace(/\\/g, '/')
	if (!isSafeRelativeMediaPath(safe)) {
		throw new Error(`Unsafe media path: ${relativePath}`)
	}
	return `baby-diary-backup/media/${safe}`
}

/**
 * Parse relative path from a ZIP media entry; null if outside media tree.
 */
export function relativePathFromMediaZipEntry (
	entryPath: string,
): string | null {
	const normalized = entryPath.replace(/\\/g, '/').replace(/^\.\//, '')
	const prefix = 'baby-diary-backup/media/'
	if (!normalized.startsWith(prefix)) {
		return null
	}
	const relative = normalized.slice(prefix.length)
	return isSafeRelativeMediaPath(relative) ? relative : null
}
