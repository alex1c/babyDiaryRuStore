/**
 * ZIP pack/unpack for baby-diary backups using fflate (pure JS, Expo-safe).
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export type ZipFileMap = Record<string, Uint8Array>

export function createZipFromFiles (files: ZipFileMap): Uint8Array {
	return zipSync(files, { level: 6 })
}

export function readZipToFiles (bytes: Uint8Array): ZipFileMap {
	return unzipSync(bytes)
}

export function zipTextEntry (text: string): Uint8Array {
	return strToU8(text)
}

export function unzipTextEntry (bytes: Uint8Array): string {
	return strFromU8(bytes)
}

export function findZipEntry (
	files: ZipFileMap,
	path: string,
): Uint8Array | null {
	if (files[path]) {
		return files[path]!
	}
	// Tolerate missing trailing nuances / alternate separators.
	const normalized = path.replace(/\\/g, '/')
	for (const key of Object.keys(files)) {
		if (key.replace(/\\/g, '/') === normalized) {
			return files[key]!
		}
	}
	return null
}
