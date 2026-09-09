/**
 * Theme preference context: light / dark / system.
 */

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { useColorScheme as useSystemColorScheme } from 'react-native'

import type { ThemePreference } from '../models/types'
import { darkColors, lightColors, type ThemeColors } from './tokens'

interface ThemeContextValue {
	preference: ThemePreference
	resolvedScheme: 'light' | 'dark'
	colors: ThemeColors
	setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
	children: ReactNode
}

export function AppThemeProvider ({ children }: ThemeProviderProps) {
	const systemScheme = useSystemColorScheme()
	const [preference, setPreferenceState] =
		useState<ThemePreference>('system')

	const setPreference = useCallback((next: ThemePreference) => {
		setPreferenceState(next)
	}, [])

	const resolvedScheme: 'light' | 'dark' =
		preference === 'system'
			? systemScheme === 'dark'
				? 'dark'
				: 'light'
			: preference

	const colors: ThemeColors =
		resolvedScheme === 'dark' ? darkColors : lightColors

	const value = useMemo(
		() => ({
			preference,
			resolvedScheme,
			colors,
			setPreference,
		}),
		[preference, resolvedScheme, colors, setPreference],
	)

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	)
}

export function useAppTheme (): ThemeContextValue {
	const ctx = useContext(ThemeContext)
	if (!ctx) {
		throw new Error('useAppTheme must be used within AppThemeProvider')
	}
	return ctx
}
