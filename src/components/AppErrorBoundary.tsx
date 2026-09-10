/**
 * Global error boundary — never leave parents on a blank white screen.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native'

import { logger } from '../services/logger'
import { darkColors, lightColors, spacing, typography } from '../theme/tokens'

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
	errorMessage: string | null
}

export class AppErrorBoundary extends Component<Props, State> {
	state: State = {
		hasError: false,
		errorMessage: null,
	}

	static getDerivedStateFromError (error: Error): State {
		return {
			hasError: true,
			errorMessage: error.message,
		}
	}

	componentDidCatch (error: Error, info: ErrorInfo): void {
		logger.error('Unhandled render error', error, {
			componentStack: info.componentStack,
		})
	}

	private handleRetry = (): void => {
		this.setState({ hasError: false, errorMessage: null })
	}

	render () {
		if (this.state.hasError) {
			// Match system appearance without depending on ThemeProvider.
			const colors =
				Appearance.getColorScheme() === 'dark' ? darkColors : lightColors
			return (
				<View
					style={[styles.container, { backgroundColor: colors.background }]}
					accessibilityRole="alert"
				>
					<Text style={[styles.title, { color: colors.danger }]}>
						Что-то пошло не так
					</Text>
					<Text style={[styles.message, { color: colors.textSecondary }]}>
						Произошла непредвиденная ошибка. Можно продолжить работу —
						данные дневника сохранены.
					</Text>
					{__DEV__ && this.state.errorMessage ? (
						<Text style={[styles.devDetail, { color: colors.textMuted }]}>
							{this.state.errorMessage}
						</Text>
					) : null}
					<Pressable
						onPress={this.handleRetry}
						style={[styles.button, { backgroundColor: colors.primary }]}
						accessibilityRole="button"
						accessibilityLabel="Продолжить"
					>
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
							Продолжить
						</Text>
					</Pressable>
				</View>
			)
		}

		return this.props.children
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	title: {
		...typography.title,
		marginBottom: spacing.sm,
		textAlign: 'center',
	},
	message: {
		...typography.body,
		textAlign: 'center',
		marginBottom: spacing.md,
	},
	devDetail: {
		...typography.caption,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	button: {
		alignSelf: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm + 4,
		borderRadius: 12,
	},
	buttonText: {
		...typography.button,
	},
})
