/**
 * Russian plural forms: one / few / many (день / дня / дней).
 */

export function pluralRu (
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	const abs = Math.abs(Math.trunc(count)) % 100
	const last = abs % 10
	if (abs > 10 && abs < 20) {
		return many
	}
	if (last === 1) {
		return one
	}
	if (last >= 2 && last <= 4) {
		return few
	}
	return many
}

/** "3 дня", "1 неделя", "5 месяцев" */
export function formatCountRu (
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	return `${count} ${pluralRu(count, one, few, many)}`
}
