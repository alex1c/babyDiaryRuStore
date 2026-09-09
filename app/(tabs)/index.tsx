/**
 * Today — main screen: active child header, status cards, quick actions, summary.
 */

import { useMemo } from 'react'
import {
	ActivityIndicator,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BannerAdSlot } from '@/src/components/BannerAdSlot'
import {
	LightweightToast,
	useLightweightToast,
} from '@/src/components/LightweightToast'
import { QuickActions, type QuickActionId } from '@/src/components/QuickActions'
import { StatusCard } from '@/src/components/StatusCard'
import { TodaySummary } from '@/src/components/TodaySummary'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import {
	buildTodayViewModel,
	PHASE1_COMING_SOON,
} from '@/src/presentation/todayViewModel'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { spacing, typography } from '@/src/theme/tokens'

export default function TodayScreen () {
	const { colors } = useAppTheme()
	const { activeChild, loading } = useActiveChild()
	const { message, showToast } = useLightweightToast()

	const model = useMemo(
		() => (activeChild ? buildTodayViewModel(activeChild, []) : null),
		[activeChild],
	)

	const handleComingSoon = (): void => {
		showToast(PHASE1_COMING_SOON)
	}

	const handleQuickAction = (id: QuickActionId): void => {
		void id
		handleComingSoon()
	}

	if (loading) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		)
	}

	if (!activeChild || !model) {
		return (
			<View style={[styles.center, { backgroundColor: colors.background }]}>
				<Text style={[styles.empty, { color: colors.textSecondary }]}>
					Добавьте малыша, чтобы начать дневник.
				</Text>
			</View>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right']}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<Text
						style={[styles.name, { color: colors.text }]}
						accessibilityRole="header"
					>
						{model.childName}
					</Text>
					<Text style={[styles.age, { color: colors.textSecondary }]}>
						{model.ageLabel}
					</Text>
				</View>

				<Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
					Быстрые действия
				</Text>
				<QuickActions onAction={handleQuickAction} />

				{model.statusCards.map((card) => (
					<StatusCard
						key={card.id}
						card={card}
						onPressCta={handleComingSoon}
					/>
				))}

				<TodaySummary rows={model.daySummary} />
				<BannerAdSlot />
			</ScrollView>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
	},
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	empty: {
		...typography.body,
		textAlign: 'center',
	},
	header: {
		marginBottom: spacing.lg,
	},
	name: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	age: {
		...typography.subtitle,
		fontWeight: '500',
	},
	sectionLabel: {
		...typography.caption,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		marginBottom: spacing.sm,
	},
})
