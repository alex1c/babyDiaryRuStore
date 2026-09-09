/**
 * App-managed photo storage singleton (Expo FileSystem legacy API).
 */

import * as FileSystem from 'expo-file-system/legacy'

import {
	createFilePhotoStorage,
	type PhotoStorage,
} from './photoStorage'

let cached: PhotoStorage | null = null

export function getAppPhotoStorage (): PhotoStorage {
	if (!cached) {
		cached = createFilePhotoStorage({
			documentDirectory: FileSystem.documentDirectory,
			copyAsync: FileSystem.copyAsync,
			deleteAsync: FileSystem.deleteAsync,
			makeDirectoryAsync: FileSystem.makeDirectoryAsync,
			getInfoAsync: FileSystem.getInfoAsync,
		})
	}
	return cached
}
