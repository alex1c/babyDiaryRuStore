/**
 * Managed photo storage — filesystem URIs only, never SQLite BLOBs.
 * Abstraction keeps unit tests free of real FS / Expo FileSystem.
 */

import { createEntityId } from '../domain/ids'

export interface PhotoStorage {
	/**
	 * Copy a user-picked URI into the app-managed moments directory.
	 * Returns the managed file URI/path.
	 */
	importFromUri (sourceUri: string): Promise<string>

	/** Delete a managed file if it exists; no-op for non-managed URIs. */
	deleteManaged (uri: string): Promise<void>

	/** True when URI lives under the managed moments root. */
	isManaged (uri: string): boolean

	/** Root prefix used for managed photos (for backup layout later). */
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

const MOMENTS_SUBDIR = 'moments/'

/**
 * Create filesystem-backed photo storage under documentDirectory/moments/.
 */
export function createFilePhotoStorage (
	deps: PhotoStorageDeps,
): PhotoStorage {
	const root = ensureTrailingSlash(deps.documentDirectory ?? '')
	const momentsRoot = `${root}${MOMENTS_SUBDIR}`
	const createId = deps.createId ?? createEntityId

	return {
		managedRoot (): string {
			return momentsRoot
		},

		isManaged (uri: string): boolean {
			if (!uri || !momentsRoot) {
				return false
			}
			return uri.startsWith(momentsRoot)
		},

		async importFromUri (sourceUri: string): Promise<string> {
			if (!root) {
				throw new Error('Document directory is unavailable')
			}
			await deps.makeDirectoryAsync(momentsRoot, { intermediates: true })
			const ext = extensionFromUri(sourceUri)
			const id = await createId()
			const dest = `${momentsRoot}${id}${ext}`
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

/** In-memory photo storage for Jest (no real filesystem). */
export function createMemoryPhotoStorage (): PhotoStorage & {
	files: Map<string, string>
} {
	const files = new Map<string, string>()
	const root = 'memory://moments/'
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
			const dest = `${root}photo-${counter}.jpg`
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
