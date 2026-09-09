/**
 * Stable application-generated IDs (UUID v4).
 * Prefer these over SQLite autoincrement for backup / future sync.
 */

import * as Crypto from 'expo-crypto'

export async function createEntityId (): Promise<string> {
	return Crypto.randomUUID()
}

/**
 * Synchronous UUID for environments where Crypto.randomUUID is available
 * (tests / modern runtimes). Prefer createEntityId in app code.
 */
export function createEntityIdSync (): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	// Fallback for older Jest environments without Web Crypto UUID.
	const bytes = new Uint8Array(16)
	for (let i = 0; i < 16; i += 1) {
		bytes[i] = Math.floor(Math.random() * 256)
	}
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
