/**
 * Share plain-text summary via Android system share sheet.
 */

import { Share } from 'react-native'

import {
	formatShareSummaryText,
	type ShareSummaryInput,
} from '../domain/shareSummaryText'

/** Build text then open the OS share sheet (explicit user action only). */
export async function shareSummaryText (
	input: ShareSummaryInput,
): Promise<void> {
	const message = formatShareSummaryText(input)
	await Share.share({
		message,
		title: 'Сводка дневника',
	})
}

export { formatShareSummaryText }
