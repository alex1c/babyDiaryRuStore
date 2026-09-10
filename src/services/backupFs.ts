/**
 * Filesystem helpers for backup ZIP share + media byte IO.
 */

import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'

import { toAbsoluteManagedPath } from '../domain/backupMediaPaths'
import {
	HEALTH_DOCS_SUBDIR,
	MOMENTS_SUBDIR,
	PROFILE_PHOTOS_SUBDIR,
} from './photoStorage'
import { logger } from './logger'

const BACKUP_TEMP_SUBDIR = 'backups/'
const LAST_BACKUP_META = 'last-backup-meta.json'

export interface LastBackupMeta {
	createdAt: string
	kind: 'compact' | 'full'
	fileName: string
	zipByteLength: number
	includesMedia: boolean
	childrenCount: number
}

function documentRoot (): string {
	const root = FileSystem.documentDirectory
	if (!root) {
		throw new Error('Document directory is unavailable')
	}
	return root.endsWith('/') ? root : `${root}/`
}

export function getBackupTempDirectory (): string {
	return `${documentRoot()}${BACKUP_TEMP_SUBDIR}`
}

export async function ensureBackupTempDirectory (): Promise<string> {
	const dir = getBackupTempDirectory()
	await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	return dir
}

export async function writeBackupZipFile (
	fileName: string,
	zipBytes: Uint8Array,
): Promise<string> {
	const dir = await ensureBackupTempDirectory()
	let target = `${dir}${fileName}`
	let info = await FileSystem.getInfoAsync(target)
	let n = 1
	while (info.exists) {
		const base = fileName.replace(/\.zip$/i, '')
		target = `${dir}${base}-${n}.zip`
		info = await FileSystem.getInfoAsync(target)
		n += 1
	}
	// FileSystem.writeAsStringAsync with base64 encoding.
	const base64 = uint8ToBase64(zipBytes)
	await FileSystem.writeAsStringAsync(target, base64, {
		encoding: FileSystem.EncodingType.Base64,
	})
	return target
}

export async function shareBackupZipFile (uri: string): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('Системный обмен файлами сейчас недоступен')
	}
	await Sharing.shareAsync(uri, {
		mimeType: 'application/zip',
		dialogTitle: 'Поделиться резервной копией',
		UTI: 'public.zip-archive',
	})
}

export async function pickBackupZipFile (): Promise<{
	uri: string
	name: string | null
} | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: 'application/zip',
		copyToCacheDirectory: true,
		multiple: false,
	})
	if (result.canceled || !result.assets?.[0]?.uri) {
		return null
	}
	const asset = result.assets[0]
	return { uri: asset.uri, name: asset.name ?? null }
}

export async function readZipBytesFromUri (uri: string): Promise<Uint8Array> {
	const base64 = await FileSystem.readAsStringAsync(uri, {
		encoding: FileSystem.EncodingType.Base64,
	})
	return base64ToUint8(base64)
}

export async function readManagedMediaBytes (
	absoluteUri: string,
): Promise<Uint8Array | null> {
	try {
		const info = await FileSystem.getInfoAsync(absoluteUri)
		if (!info.exists) {
			return null
		}
		const base64 = await FileSystem.readAsStringAsync(absoluteUri, {
			encoding: FileSystem.EncodingType.Base64,
		})
		return base64ToUint8(base64)
	} catch (err) {
		logger.warn('readManagedMediaBytes failed', {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

export async function writeManagedMediaBytes (
	relativePath: string,
	absoluteUri: string,
	bytes: Uint8Array,
): Promise<void> {
	const dir = absoluteUri.slice(0, absoluteUri.lastIndexOf('/') + 1)
	await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	await FileSystem.writeAsStringAsync(absoluteUri, uint8ToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})
	void relativePath
}

export async function estimateManagedMediaBytes (
	documentDirectory: string,
	relativePaths: string[],
): Promise<number> {
	let total = 0
	for (const relative of relativePaths) {
		const absolute = toAbsoluteManagedPath(relative, documentDirectory)
		try {
			const info = await FileSystem.getInfoAsync(absolute)
			if (info.exists && 'size' in info && typeof info.size === 'number') {
				total += info.size
			}
		} catch {
			// ignore
		}
	}
	return total
}

export async function saveLastBackupMeta (
	meta: LastBackupMeta,
): Promise<void> {
	const dir = await ensureBackupTempDirectory()
	const uri = `${dir}${LAST_BACKUP_META}`
	await FileSystem.writeAsStringAsync(uri, JSON.stringify(meta), {
		encoding: FileSystem.EncodingType.UTF8,
	})
}

export async function loadLastBackupMeta (): Promise<LastBackupMeta | null> {
	try {
		const uri = `${getBackupTempDirectory()}${LAST_BACKUP_META}`
		const info = await FileSystem.getInfoAsync(uri)
		if (!info.exists) {
			return null
		}
		const text = await FileSystem.readAsStringAsync(uri, {
			encoding: FileSystem.EncodingType.UTF8,
		})
		return JSON.parse(text) as LastBackupMeta
	} catch {
		return null
	}
}

/** Remove files under managed roots that are not in the keep set. */
export async function cleanupOrphanManagedFiles (
	documentDirectory: string,
	keepRelativePaths: Set<string>,
): Promise<void> {
	const root = documentDirectory.endsWith('/')
		? documentDirectory
		: `${documentDirectory}/`
	for (const sub of [MOMENTS_SUBDIR, PROFILE_PHOTOS_SUBDIR, HEALTH_DOCS_SUBDIR]) {
		const dir = `${root}${sub}`
		try {
			const info = await FileSystem.getInfoAsync(dir)
			if (!info.exists) {
				continue
			}
			const names = await FileSystem.readDirectoryAsync(dir)
			for (const name of names) {
				const relative = `${sub}${name}`
				if (keepRelativePaths.has(relative)) {
					continue
				}
				await FileSystem.deleteAsync(`${dir}${name}`, {
					idempotent: true,
				})
			}
		} catch (err) {
			logger.warn('orphan cleanup failed', {
				sub,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
}

function uint8ToBase64 (bytes: Uint8Array): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	let out = ''
	let i = 0
	for (; i + 2 < bytes.length; i += 3) {
		const n =
			(bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
		out +=
			chars[(n >> 18) & 63]! +
			chars[(n >> 12) & 63]! +
			chars[(n >> 6) & 63]! +
			chars[n & 63]!
	}
	if (i < bytes.length) {
		const a = bytes[i]!
		const b = i + 1 < bytes.length ? bytes[i + 1]! : 0
		const n = (a << 16) | (b << 8)
		out += chars[(n >> 18) & 63]!
		out += chars[(n >> 12) & 63]!
		out += i + 1 < bytes.length ? chars[(n >> 6) & 63]! : '='
		out += '='
	}
	return out
}

function base64ToUint8 (base64: string): Uint8Array {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	const clean = base64.replace(/=+$/, '')
	const len = clean.length
	const outLength = Math.floor((base64.replace(/\s/g, '').length * 3) / 4)
	const out = new Uint8Array(outLength)
	let o = 0
	for (let i = 0; i < len; i += 4) {
		const n =
			(chars.indexOf(clean[i]!) << 18) |
			(chars.indexOf(clean[i + 1]!) << 12) |
			((i + 2 < len ? chars.indexOf(clean[i + 2]!) : 0) << 6) |
			(i + 3 < len ? chars.indexOf(clean[i + 3]!) : 0)
		out[o++] = (n >> 16) & 255
		if (i + 2 < len) {
			out[o++] = (n >> 8) & 255
		}
		if (i + 3 < len) {
			out[o++] = n & 255
		}
	}
	return out.subarray(0, o)
}
