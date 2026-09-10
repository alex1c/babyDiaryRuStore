/**
 * Temporary store-screenshot mode — hides banners so RuStore assets stay clean.
 * Must never be enabled in production UX by default.
 */

let storeScreenshotMode = false

export function setStoreScreenshotMode (enabled: boolean): void {
	storeScreenshotMode = enabled
}

export function isStoreScreenshotMode (): boolean {
	return storeScreenshotMode
}
