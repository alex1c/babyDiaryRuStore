/**
 * Global error boundary — never leave parents on a blank white screen.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { logger } from '../services/logger'
import { lightColors, spacing, typography } from '../theme/tokens'

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
			return (
				<View style={styles.container} accessibilityRole="alert">
					<Text style={styles.title}>Что-то пошло не так</Text>
					<Text style={styles.message}>
						Произошла непредвиденная ошибка. Можно продолжить работу —
						данные дневника сохранены.
					</Text>
					{__DEV__ && this.state.errorMessage ? (
						<Text style={styles.devDetail}>{this.state.errorMessage}</Text>
					) : null}
					<Pressable
						onPress={this.handleRetry}
						style={styles.button}
						accessibilityRole="button"
						accessibilityLabel="Продолжить"
					>
						<Text style={styles.buttonText}>Продолжить</Text>
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
		backgroundColor: lightColors.background,
	},
	title: {
		...typography.title,
		color: lightColors.danger,
		marginBottom: spacing.sm,
		textAlign: 'center',
	},
	message: {
		...typography.body,
		color: lightColors.textSecondary,
		textAlign: 'center',
		marginBottom: spacing.md,
	},
	devDetail: {
		...typography.caption,
		color: lightColors.textMuted,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	button: {
		alignSelf: 'center',
		backgroundColor: lightColors.primary,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm + 4,
		borderRadius: 12,
	},
	buttonText: {
		...typography.button,
		color: '#FFFFFF',
	},
})
