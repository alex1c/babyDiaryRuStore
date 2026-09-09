/**
 * PDF export paths under documentDirectory/exports/.
 * Pure helpers are testable without Expo FileSystem.
 */

export const PDF_EXPORTS_SUBDIR = 'exports'

export interface PdfFileNameParts {
	kind: 'period' | 'first-year'
	/** YYYY-MM-DD end (or generation) date. */
	date: string
	/** Optional inclusive start for period reports. */
	startDate?: string
	endDate?: string
}

/**
 * Build a stable, filesystem-safe PDF filename.
 * Example: baby-diary-report-2026-09-03_2026-09-09.pdf
 */
export function buildPdfFileName (parts: PdfFileNameParts): string {
	if (parts.kind === 'first-year') {
		return `baby-diary-first-year-${parts.date}.pdf`
	}
	if (parts.startDate && parts.endDate && parts.startDate !== parts.endDate) {
		return `baby-diary-report-${parts.startDate}_${parts.endDate}.pdf`
	}
	return `baby-diary-report-${parts.date}.pdf`
}

/**
 * Resolve exports directory URI from documentDirectory.
 * Trailing slash is guaranteed when documentDirectory is present.
 */
export function resolveExportsDirectory (
	documentDirectory: string | null,
): string {
	if (!documentDirectory) {
		throw new Error('documentDirectory is unavailable')
	}
	const root = documentDirectory.endsWith('/')
		? documentDirectory
		: `${documentDirectory}/`
	return `${root}${PDF_EXPORTS_SUBDIR}/`
}

export function resolveExportFileUri (
	documentDirectory: string | null,
	fileName: string,
): string {
	return `${resolveExportsDirectory(documentDirectory)}${fileName}`
}

/**
 * Soft cleanup policy: keep newest N export files; delete older ones.
 * Returns names that should be deleted (caller performs FS deletes).
 */
export function selectExportFilesToDelete (
	fileNames: string[],
	keepNewest: number = 20,
): string[] {
	const pdfs = fileNames
		.filter((n) => n.toLowerCase().endsWith('.pdf'))
		.sort((a, b) => b.localeCompare(a))
	if (pdfs.length <= keepNewest) {
		return []
	}
	return pdfs.slice(keepNewest)
}
