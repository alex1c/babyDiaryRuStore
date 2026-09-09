/**
 * PDF report section selection (keep options few and clear).
 */

export interface PdfReportSections {
	sleep: boolean
	feeding: boolean
	diapers: boolean
	growth: boolean
	health: boolean
	/** Milestones and notable development events. */
	importantEvents: boolean
	/** Detailed event table for the selected period. */
	chronology: boolean
}

/** Default: main care sections on; chronology off (can be heavy). */
export const DEFAULT_PDF_SECTIONS: PdfReportSections = {
	sleep: true,
	feeding: true,
	diapers: true,
	growth: true,
	health: true,
	importantEvents: true,
	chronology: false,
}

export const PDF_SECTION_OPTIONS: {
	key: keyof PdfReportSections
	label: string
}[] = [
	{ key: 'sleep', label: 'Сон' },
	{ key: 'feeding', label: 'Кормления' },
	{ key: 'diapers', label: 'Подгузники' },
	{ key: 'growth', label: 'Рост' },
	{ key: 'health', label: 'Здоровье' },
	{ key: 'importantEvents', label: 'Важные события' },
	{ key: 'chronology', label: 'Подробная хронология' },
]

export function hasAnyPdfSection (sections: PdfReportSections): boolean {
	return Object.values(sections).some(Boolean)
}
