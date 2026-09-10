/**
 * Shared keyboard shell for form screens — keeps Save reachable above the keyboard.
 */

import type { ReactNode } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	type StyleProp,
	type ViewStyle,
} from 'react-native'

interface FormKeyboardShellProps {
	children: ReactNode
	style?: StyleProp<ViewStyle>
}

export function FormKeyboardShell ({
	children,
	style,
}: FormKeyboardShellProps) {
	return (
		<KeyboardAvoidingView
			style={[styles.flex, style]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
		>
			{children}
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
})
