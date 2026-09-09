/**
 * App-managed photo/document storage singletons (Expo FileSystem legacy API).
 */

import * as FileSystem from 'expo-file-system/legacy'

import {
	createFilePhotoStorage,
	HEALTH_DOCS_SUBDIR,
	MOMENTS_SUBDIR,
	type PhotoStorage,
} from './photoStorage'

const cache = new Map<string, PhotoStorage>()

function getOrCreate (subdir: string): PhotoStorage {
	const existing = cache.get(subdir)
	if (existing) {
		return existing
	}
	const created = createFilePhotoStorage(
		{
			documentDirectory: FileSystem.documentDirectory,
			copyAsync: FileSystem.copyAsync,
			deleteAsync: FileSystem.deleteAsync,
			makeDirectoryAsync: FileSystem.makeDirectoryAsync,
			getInfoAsync: FileSystem.getInfoAsync,
		},
		subdir,
	)
	cache.set(subdir, created)
	return created
}

/** Moments / milestone photos under documentDirectory/moments/. */
export function getAppPhotoStorage (): PhotoStorage {
	return getOrCreate(MOMENTS_SUBDIR)
}

/** Health symptom/visit attachments under documentDirectory/health-documents/. */
export function getHealthDocumentStorage (): PhotoStorage {
	return getOrCreate(HEALTH_DOCS_SUBDIR)
}
