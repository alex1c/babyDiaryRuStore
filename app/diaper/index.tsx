/**
 * One-tap diaper entry: Мокрый | Грязный | Оба | Сухой → save immediately.
 */

import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { trackAnalyticsEvent, ANALYTICS_EVENTS } from '@/src/analytics'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { diaperKindLabel } from '@/src/domain/diaperLabels'
import type { DiaperKind } from '@/src/models/diaper'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

const KINDS: DiaperKind[] = ['wet', 'dirty', 'both', 'dry']

export default function DiaperQuickScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { diaper } = useDatabase()
	const { message, showToast } = useLightweightToast()
	const [busy, setBusy] = useState(false)

	const handleKind = async (kind: DiaperKind): Promise<void> => {
		if (!diaper || !activeChild || busy) {
			return
		}
		setBusy(true)
		try {
			const created = await diaper.create({
				childId: activeChild.id,
				kind,
			})
			// Kind enum only — never notes or free text.
			trackAnalyticsEvent(ANALYTICS_EVENTS.diaperAdded, {
				diaper_kind: kind,
			})
			showToast(`${diaperKindLabel(kind)} сохранён`)
			router.replace(`/(tabs)` as Href)
			// Allow opening details from toast path is optional; stay on Today.
			void created
		} catch (err) {
			logger.error('create diaper failed', err)
			showToast('Не удалось сохранить')
			setBusy(false)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<View style={styles.content}>
				<Text style={[styles.lead, { color: colors.textSecondary }]}>
					Подгузник
				</Text>
				{busy ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					KINDS.map((kind) => (
						<ChoiceButton
							key={kind}
							label={diaperKindLabel(kind)}
							onPress={() => void handleKind(kind)}
						/>
					))
				)}
			</View>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		flex: 1,
		justifyContent: 'flex-end',
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	lead: {
		...typography.subtitle,
		textAlign: 'center',
		marginBottom: spacing.md,
	},
})
