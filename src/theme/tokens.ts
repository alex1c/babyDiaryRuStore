/**
 * Design tokens — soft baby-diary palette (light / dark).
 * Do not scatter raw hex values across screens; use these tokens.
 */

export const lightColors = {
	primary: '#3D7A6A',
	primaryMuted: '#5C9A88',
	primarySoft: '#E4F2ED',
	text: '#1F2A28',
	textSecondary: '#4A5A56',
	textMuted: '#7A8A86',
	background: '#FFF8F2',
	surface: '#FFFFFF',
	surfaceMuted: '#F3EBE3',
	border: '#E2D6CC',
	danger: '#B42318',
	warning: '#B54708',
	success: '#027A48',
	tabInactive: '#9AA6A2',
	adSlot: '#F0E8E0',
} as const

export const darkColors = {
	primary: '#7CBCAC',
	primaryMuted: '#5C9A88',
	primarySoft: '#243832',
	text: '#F4F7F6',
	textSecondary: '#C5D0CC',
	textMuted: '#8A9793',
	background: '#121816',
	surface: '#1C2421',
	surfaceMuted: '#26302C',
	border: '#3A4642',
	danger: '#F97066',
	warning: '#FDB022',
	success: '#32D583',
	tabInactive: '#7A8884',
	adSlot: '#1E2623',
} as const

/** Shared semantic palette shape for light and dark schemes. */
export type ThemeColors = {
	[K in keyof typeof lightColors]: string
}

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const

export const typography = {
	title: {
		fontSize: 24,
		fontWeight: '700' as const,
		lineHeight: 32,
	},
	subtitle: {
		fontSize: 18,
		fontWeight: '600' as const,
		lineHeight: 24,
	},
	body: {
		fontSize: 16,
		fontWeight: '400' as const,
		lineHeight: 24,
	},
	caption: {
		fontSize: 13,
		fontWeight: '400' as const,
		lineHeight: 18,
	},
	button: {
		fontSize: 16,
		fontWeight: '600' as const,
		lineHeight: 22,
	},
} as const

export const radii = {
	sm: 8,
	md: 12,
	lg: 16,
} as const
