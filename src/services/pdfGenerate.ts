/**
 * PDF generation + share using expo-print / expo-sharing (local only).
 *
 * Ad / interstitial insertion contract:
 * 1. At most one interstitial per app session after a *successful show*.
 * 2. Never delay PDF file creation for ads — file is written first.
 * 3. After write, await a bounded interstitial attempt, then return to UI.
 * 4. Re-opening an already created PDF file: no ad.
 * 5. Share / Open actions on the ready screen: no second ad.
 * 6. Never embed ads inside the PDF content itself.
 */

import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
	buildPdfFileName,
	resolveExportFileUri,
	resolveExportsDirectory,
	selectExportFilesToDelete,
} from './pdfExportStorage'
import { runAfterFreshPdfGenerated } from './pdfAdFlow'
import { logger } from './logger'

export interface GeneratePdfResult {
	uri: string
	fileName: string
	/** True when this call produced a new file (not a reopen). */
	isFreshGeneration: boolean
}

export interface GeneratePeriodPdfInput {
	html: string
	startDate: string
	endDate: string
}

/**
 * Render HTML to PDF, copy into managed exports/, then optional ad hook.
 */
export async function generatePeriodPdfFile (
	input: GeneratePeriodPdfInput,
): Promise<GeneratePdfResult> {
	const fileName = buildPdfFileName({
		kind: 'period',
		date: input.endDate,
		startDate: input.startDate,
		endDate: input.endDate,
	})
	return generateAndStorePdf(input.html, fileName, true)
}

export async function generateFirstYearPdfFile (
	html: string,
	generatedDate: string,
): Promise<GeneratePdfResult> {
	const fileName = buildPdfFileName({
		kind: 'first-year',
		date: generatedDate,
	})
	return generateAndStorePdf(html, fileName, true)
}

async function generateAndStorePdf (
	html: string,
	fileName: string,
	isFreshGeneration: boolean,
): Promise<GeneratePdfResult> {
	const { uri: tempUri } = await Print.printToFileAsync({
		html,
		base64: false,
	})
	const exportsDir = resolveExportsDirectory(FileSystem.documentDirectory)
	await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true })
	const dest = resolveExportFileUri(FileSystem.documentDirectory, fileName)
	const info = await FileSystem.getInfoAsync(dest)
	if (info.exists) {
		await FileSystem.deleteAsync(dest, { idempotent: true })
	}
	await FileSystem.copyAsync({ from: tempUri, to: dest })
	await softCleanupExports(exportsDir)

	if (isFreshGeneration) {
		// Await bounded interstitial attempt; PDF file already exists on disk.
		try {
			await runAfterFreshPdfGenerated()
		} catch (err) {
			logger.warn('pdf ad hook failed', {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return { uri: dest, fileName, isFreshGeneration }
}

async function softCleanupExports (exportsDir: string): Promise<void> {
	try {
		const names = await FileSystem.readDirectoryAsync(exportsDir)
		const toDelete = selectExportFilesToDelete(names, 20)
		for (const name of toDelete) {
			await FileSystem.deleteAsync(`${exportsDir}${name}`, {
				idempotent: true,
			})
		}
	} catch (err) {
		logger.warn('export cleanup skipped', {
			error: err instanceof Error ? err.message : String(err),
		})
	}
}

/** Open system share sheet for an existing local PDF URI. */
export async function sharePdfFile (uri: string): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('Обмен файлами недоступен на этом устройстве')
	}
	await Sharing.shareAsync(uri, {
		mimeType: 'application/pdf',
		dialogTitle: 'Поделиться отчётом',
		UTI: 'com.adobe.pdf',
	})
}

/** Re-open / re-share without regenerating (no ad). */
export async function shareExistingPdf (uri: string): Promise<void> {
	await sharePdfFile(uri)
}
