/**
 * Report ready — open / share existing PDF (no second ad).
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
	ActivityIndicator,
	Linking,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { shareExistingPdf } from '@/src/services/pdfGenerate'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ReportReadyScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const params = useLocalSearchParams<{
		uri?: string
		fileName?: string
	}>()
	const uri = typeof params.uri === 'string' ? params.uri : ''
	const fileName =
		typeof params.fileName === 'string' ? params.fileName : 'отчёт.pdf'

	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleOpen = async (): Promise<void> => {
		if (!uri) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const can = await Linking.canOpenURL(uri)
			if (can) {
				await Linking.openURL(uri)
			} else {
				// Fallback: share sheet often opens a viewer on Android.
				await shareExistingPdf(uri)
			}
		} catch (err) {
			logger.error('open pdf failed', err)
			setError('Не удалось открыть файл')
		} finally {
			setBusy(false)
		}
	}

	const handleShare = async (): Promise<void> => {
		if (!uri) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			await shareExistingPdf(uri)
		} catch (err) {
			logger.error('share pdf failed', err)
			setError('Не удалось поделиться файлом')
		} finally {
			setBusy(false)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<View style={styles.content}>
				<Text style={[styles.title, { color: colors.text }]}>Отчёт готов</Text>
				<Text style={[styles.sub, { color: colors.textSecondary }]}>
					{fileName}
				</Text>
				{!uri ? (
					<Text style={{ color: colors.danger }}>Файл не найден</Text>
				) : null}
				{error ? (
					<Text style={{ color: colors.danger, ...typography.body }}>{error}</Text>
				) : null}

				<Pressable
					onPress={() => void handleOpen()}
					disabled={!uri || busy}
					style={[styles.cta, { backgroundColor: colors.primary }]}
				>
					{busy ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text style={styles.ctaText}>Открыть</Text>
					)}
				</Pressable>
				<Pressable
					onPress={() => void handleShare()}
					disabled={!uri || busy}
					style={[
						styles.secondary,
						{ borderColor: colors.border, backgroundColor: colors.surface },
					]}
				>
					<Text style={{ color: colors.text, fontWeight: '600' }}>Поделиться</Text>
				</Pressable>
				<Pressable onPress={() => router.back()}>
					<Text style={{ color: colors.primary, textAlign: 'center' }}>
						Назад к настройкам
					</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		flex: 1,
		padding: spacing.lg,
		justifyContent: 'center',
		gap: spacing.md,
	},
	title: { ...typography.title, textAlign: 'center' },
	sub: { ...typography.body, textAlign: 'center', marginBottom: spacing.md },
	cta: {
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
		minHeight: 48,
		justifyContent: 'center',
	},
	ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
	secondary: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingVertical: spacing.md,
		alignItems: 'center',
	},
})
