/**
 * Parse user-entered decimals that may use comma or dot as separator.
 */

/**
 * Normalize "3,25" / "3.25" / " 3,25 " into a finite number.
 * Returns null for empty / invalid input (caller decides if optional).
 */
export function parseDecimalInput (raw: string): number | null {
	const trimmed = raw.trim()
	if (!trimmed) {
		return null
	}
	const normalized = trimmed.replace(',', '.')
	if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
		return null
	}
	const value = Number(normalized)
	if (!Number.isFinite(value)) {
		return null
	}
	return value
}

/** Convert kg (UI) to whole grams for storage. */
export function kgToGrams (kg: number): number {
	return Math.round(kg * 1000)
}

/** Convert stored grams back to kg for form display. */
export function gramsToKg (grams: number): number {
	return grams / 1000
}

/** Format grams as a compact kg string for forms (comma as decimal). */
export function formatKgForInput (grams: number): string {
	const kg = gramsToKg(grams)
	const text = Number.isInteger(kg) ? String(kg) : kg.toFixed(3).replace(/\.?0+$/, '')
	return text.replace('.', ',')
}
