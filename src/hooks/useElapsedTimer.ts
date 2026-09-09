/**
 * Elapsed timer derived from a start timestamp (SQLite is source of truth).
 */

import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { formatElapsedHms } from '../utils/durationFormat'

/**
 * Recomputes HH:MM:SS from startAt on each tick and on AppState resume.
 * Does not accumulate seconds in React state.
 */
export function useElapsedTimer (
	startAt: string | null,
	enabled: boolean,
): string {
	const [nowMs, setNowMs] = useState(() => Date.now())

	useEffect(() => {
		if (!enabled || !startAt) {
			return
		}
		// Tick from the interval / AppState — avoid sync setState in effect body.
		const id = setInterval(() => {
			setNowMs(Date.now())
		}, 1000)
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				setNowMs(Date.now())
			}
		})
		return () => {
			clearInterval(id)
			sub.remove()
		}
	}, [enabled, startAt])

	if (!enabled || !startAt) {
		return '00:00:00'
	}
	return formatElapsedHms(startAt, nowMs)
}
