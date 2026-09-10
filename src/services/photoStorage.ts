/**
 * Managed file storage — filesystem URIs only, never SQLite BLOBs.
 * Abstraction keeps unit tests free of real FS / Expo FileSystem.
 */

import { createEntityId } from '../domain/ids'

export interface PhotoStorage {
	/**
	 * Copy a user-picked URI into the managed directory.
	 * Returns the managed file URI/path.
	 */
	importFromUri (sourceUri: string): Promise<string>

	/** Delete a managed file if it exists; no-op for non-managed URIs. */
	deleteManaged (uri: string): Promise<void>

	/** True when URI lives under this storage's managed root. */
	isManaged (uri: string): boolean

	/** Root prefix used for managed files (for backup layout later). */
	managedRoot (): string
}

export interface PhotoStorageDeps {
	documentDirectory: string | null
	copyAsync: (opts: { from: string; to: string }) => Promise<void>
	deleteAsync: (uri: string, opts?: { idempotent?: boolean }) => Promise<void>
	makeDirectoryAsync: (
		uri: string,
		opts?: { intermediates?: boolean },
	) => Promise<void>
	getInfoAsync: (uri: string) => Promise<{ exists: boolean }>
	createId?: () => Promise<string>
}

export const MOMENTS_SUBDIR = 'moments/'
export const HEALTH_DOCS_SUBDIR = 'health-documents/'
/** Per-child profile avatars under documentDirectory/profile-photos/. */
export const PROFILE_PHOTOS_SUBDIR = 'profile-photos/'

/**
 * Create filesystem-backed storage under documentDirectory/<subdir>/.
 */
export function createFilePhotoStorage (
	deps: PhotoStorageDeps,
	subdir: string = MOMENTS_SUBDIR,
): PhotoStorage {
	const root = ensureTrailingSlash(deps.documentDirectory ?? '')
	const managed = `${root}${ensureTrailingSlash(subdir)}`
	const createId = deps.createId ?? createEntityId

	return {
		managedRoot (): string {
			return managed
		},

		isManaged (uri: string): boolean {
			if (!uri || !managed) {
				return false
			}
			return uri.startsWith(managed)
		},

		async importFromUri (sourceUri: string): Promise<string> {
			if (!root) {
				throw new Error('Document directory is unavailable')
			}
			await deps.makeDirectoryAsync(managed, { intermediates: true })
			const ext = extensionFromUri(sourceUri)
			const id = await createId()
			const dest = `${managed}${id}${ext}`
			await deps.copyAsync({ from: sourceUri, to: dest })
			return dest
		},

		async deleteManaged (uri: string): Promise<void> {
			if (!this.isManaged(uri)) {
				return
			}
			try {
				const info = await deps.getInfoAsync(uri)
				if (info.exists) {
					await deps.deleteAsync(uri, { idempotent: true })
				}
			} catch {
				// Missing file is not fatal — keep DB as source of truth.
			}
		},
	}
}

/** In-memory storage for Jest (no real filesystem). */
export function createMemoryPhotoStorage (
	subdir: string = MOMENTS_SUBDIR,
): PhotoStorage & {
	files: Map<string, string>
} {
	const files = new Map<string, string>()
	const root = `memory://${ensureTrailingSlash(subdir)}`
	let counter = 0

	return {
		files,
		managedRoot (): string {
			return root
		},
		isManaged (uri: string): boolean {
			return uri.startsWith(root)
		},
		async importFromUri (sourceUri: string): Promise<string> {
			counter += 1
			const dest = `${root}file-${counter}${extensionFromUri(sourceUri)}`
			files.set(dest, sourceUri)
			return dest
		},
		async deleteManaged (uri: string): Promise<void> {
			if (this.isManaged(uri)) {
				files.delete(uri)
			}
		},
	}
}

function ensureTrailingSlash (path: string): string {
	if (!path) {
		return path
	}
	return path.endsWith('/') ? path : `${path}/`
}

function extensionFromUri (uri: string): string {
	const cleaned = uri.split('?')[0] ?? uri
	const match = cleaned.match(/(\.[a-zA-Z0-9]{2,5})$/)
	if (match?.[1]) {
		return match[1].toLowerCase()
	}
	return '.jpg'
}
