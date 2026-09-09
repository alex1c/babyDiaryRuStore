/**
 * Active child session — always resolves via activeChildId, never children[0] alone.
 * SQLite reads are sequential (no Promise.all against one NativeDatabase).
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'

import { useDatabase } from '../context/DatabaseContext'
import {
	findChildById,
	needsOnboarding,
	resolveActiveChildId,
} from '../domain/onboarding'
import type { Child } from '../models/types'
import { logger } from '../services/logger'

interface ActiveChildContextValue {
	loading: boolean
	children: Child[]
	activeChildId: string | null
	activeChild: Child | null
	needsOnboarding: boolean
	refresh: () => Promise<void>
	setActiveChildId: (childId: string) => Promise<void>
}

const ActiveChildContext = createContext<ActiveChildContextValue | null>(null)

export function ActiveChildProvider ({ children }: { children: ReactNode }) {
	const { childrenRepo, settings, ready } = useDatabase()
	const [list, setList] = useState<Child[]>([])
	const [activeChildId, setActiveChildIdState] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		if (!childrenRepo || !settings) {
			return
		}
		setLoading(true)
		try {
			// Sequential SQLite access — required for expo-sqlite@57 on Android.
			const all = await childrenRepo.listAll()
			const appSettings = await settings.get()
			let selected = resolveActiveChildId(all, appSettings.activeChildId)

			if (selected && selected !== appSettings.activeChildId) {
				await settings.setActiveChildId(selected)
			}

			setList(all)
			setActiveChildIdState(selected)
		} catch (error) {
			logger.error('Failed to refresh active child', error)
		} finally {
			setLoading(false)
		}
	}, [childrenRepo, settings])

	useEffect(() => {
		if (!ready) {
			return
		}
		// Defer so the initial setState is not synchronous inside the effect body.
		let cancelled = false
		queueMicrotask(() => {
			if (!cancelled) {
				void refresh()
			}
		})
		return () => {
			cancelled = true
		}
	}, [ready, refresh])

	const setActiveChildId = useCallback(
		async (childId: string) => {
			if (!settings) {
				return
			}
			await settings.setActiveChildId(childId)
			setActiveChildIdState(childId)
		},
		[settings],
	)

	const value = useMemo<ActiveChildContextValue>(
		() => ({
			loading,
			children: list,
			activeChildId,
			activeChild: findChildById(list, activeChildId),
			needsOnboarding: needsOnboarding(list),
			refresh,
			setActiveChildId,
		}),
		[loading, list, activeChildId, refresh, setActiveChildId],
	)

	return (
		<ActiveChildContext.Provider value={value}>
			{children}
		</ActiveChildContext.Provider>
	)
}

export function useActiveChild (): ActiveChildContextValue {
	const ctx = useContext(ActiveChildContext)
	if (!ctx) {
		throw new Error('useActiveChild must be used within ActiveChildProvider')
	}
	return ctx
}
