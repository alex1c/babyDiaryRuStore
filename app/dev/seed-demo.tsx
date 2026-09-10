/**
 * __DEV__ only — seed polished demo data for RuStore screenshots.
 */

import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { seedScreenshotDemoData } from '@/src/dev/seedScreenshotDemo'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function SeedDemoScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const {
		childrenRepo,
		settings,
		sleep,
		feeding,
		diaper,
		growth,
		milestones,
		quickEvents,
		symptoms,
		doctorVisits,
	} = useDatabase()
	const { setActiveChildId, refresh: refreshActiveChild } = useActiveChild()
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState<string | null>(null)

	const handleSeed = async (): Promise<void> => {
		if (
			!childrenRepo ||
			!settings ||
			!sleep ||
			!feeding ||
			!diaper ||
			!growth ||
			!milestones ||
			!quickEvents ||
			!symptoms ||
			!doctorVisits
		) {
			setStatus('База ещё не готова')
			return
		}
		setBusy(true)
		setStatus(null)
		try {
			const result = await seedScreenshotDemoData({
				childrenRepo,
				settings,
				sleep,
				feeding,
				diaper,
				growth,
				milestones,
				quickEvents,
				symptoms,
				doctorVisits,
				setActiveChildId,
				refreshActiveChild,
			})
			setStatus(`Готово: ${result.childName}`)
			router.replace('/(tabs)' as Href)
		} catch (err) {
			logger.error('demo seed failed', err)
			setStatus('Не удалось создать demo data')
		} finally {
			setBusy(false)
		}
	}

	if (!__DEV__) {
		return (
			<SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
				<Text style={{ color: colors.textMuted, padding: spacing.md }}>
					Доступно только в debug-сборке
				</Text>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<View style={styles.content}>
				<Text style={[styles.title, { color: colors.text }]}>
					Demo data для скриншотов
				</Text>
				<Text style={{ color: colors.textSecondary, ...typography.body }}>
					Создаёт профиль «Миша» и реалистичные записи. Баннеры скрываются.
				</Text>
				<Pressable
					onPress={() => void handleSeed()}
					disabled={busy}
					style={[styles.btn, { backgroundColor: colors.primary }]}
				>
					{busy ? (
						<ActivityIndicator color={colors.onPrimary} />
					) : (
						<Text style={[styles.btnText, { color: colors.onPrimary }]}>
							Заполнить
						</Text>
					)}
				</Pressable>
				{status ? (
					<Text style={{ color: colors.textSecondary }}>{status}</Text>
				) : null}
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		padding: spacing.md,
		gap: spacing.md,
	},
	title: {
		...typography.title,
	},
	btn: {
		minHeight: 48,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnText: {
		...typography.button,
	},
})
