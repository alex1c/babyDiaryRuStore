/**
 * Tiny logger — keep user-facing UI free of technical stack traces.
 */

type LogPayload = Record<string, unknown>

function serializeError (error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	return String(error)
}

export const logger = {
	error (message: string, error?: unknown, extra?: LogPayload): void {
		console.error(`[baby-diary] ${message}`, serializeError(error), extra ?? {})
	},
	warn (message: string, extra?: LogPayload): void {
		console.warn(`[baby-diary] ${message}`, extra ?? {})
	},
	info (message: string, extra?: LogPayload): void {
		if (__DEV__) {
			console.log(`[baby-diary] ${message}`, extra ?? {})
		}
	},
}
