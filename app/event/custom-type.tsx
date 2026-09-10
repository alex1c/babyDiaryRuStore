/**
 * Create / manage custom event type definitions.
 */

import { useRouter, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChoiceButton } from '@/src/components/FeedingControls'
import { FormKeyboardShell } from '@/src/components/FormKeyboardShell'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	customIconLabel,
	QuickEventValidationError,
} from '@/src/domain/quickEventLabels'
import {
	CUSTOM_ICON_KEYS,
	type CustomEventDefinition,
	type CustomIconKey,
} from '@/src/models/quickEvents'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function CustomEventTypeScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents } = useDatabase()
	const [defs, setDefs] = useState<CustomEventDefinition[]>([])
	const [name, setName] = useState('')
	const [iconKey, setIconKey] = useState<CustomIconKey>('star')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [mode, setMode] = useState<'list' | 'new'>('list')

	const refresh = useCallback(async () => {
		if (!quickEvents || !activeChild) {
			setDefs([])
			return
		}
		const list = await quickEvents.listAllCustomDefinitions(activeChild.id)
		setDefs(list)
	}, [quickEvents, activeChild])

	useFocusEffect(
		useCallback(() => {
			void refresh()
		}, [refresh]),
	)

	const handleCreate = async (): Promise<void> => {
		if (!quickEvents || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			const created = await quickEvents.createCustomDefinition({
				childId: activeChild.id,
				name,
				iconKey,
			})
			router.replace(
				`/event/new?kind=custom&definitionId=${created.id}` as Href,
			)
		} catch (err) {
			logger.error('create custom definition failed', err)
			setError(
				err instanceof QuickEventValidationError
					? err.message
					: 'Не удалось сохранить',
			)
			setBusy(false)
		}
	}

	const handleArchive = async (id: string): Promise<void> => {
		if (!quickEvents) {
			return
		}
		await quickEvents.archiveCustomDefinition(id)
		await refresh()
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			{/* Keep Save reachable above the keyboard on form screens. */}
			<FormKeyboardShell>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{mode === 'list' ? (
					<>
						<ChoiceButton label="Новый тип" onPress={() => setMode('new')} />
						{defs.map((def) => (
							<View
								key={def.id}
								style={[
									styles.row,
									{
										borderColor: colors.border,
										backgroundColor: colors.surface,
										opacity: def.isActive ? 1 : 0.55,
									},
								]}
							>
								<Pressable
									style={styles.rowMain}
									onPress={() => {
										if (!def.isActive) {
											return
										}
										router.push(
											`/event/new?kind=custom&definitionId=${def.id}` as Href,
										)
									}}
								>
									<Text style={{ color: colors.text, fontWeight: '700' }}>
										{def.name}
									</Text>
									<Text style={{ color: colors.textMuted }}>
										{customIconLabel(def.iconKey ?? 'star')}
										{def.isActive ? '' : ' · скрыт'}
									</Text>
								</Pressable>
								{def.isActive ? (
									<Pressable
										onPress={() => void handleArchive(def.id)}
										accessibilityRole="button"
										accessibilityLabel="Скрыть тип"
									>
										<Text style={{ color: colors.danger }}>Скрыть</Text>
									</Pressable>
								) : null}
							</View>
						))}
					</>
				) : (
					<>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Название, например Бассейн"
							placeholderTextColor={colors.textMuted}
							style={[
								styles.input,
								{ color: colors.text, borderColor: colors.border },
							]}
						/>
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Иконка
						</Text>
						<View style={styles.chips}>
							{CUSTOM_ICON_KEYS.map((key) => (
								<Pressable
									key={key}
									onPress={() => setIconKey(key)}
									style={[
										styles.chip,
										{
											backgroundColor:
												iconKey === key
													? colors.primary
													: colors.primarySoft,
											borderColor: colors.border,
										},
									]}
								>
									<Text
										style={{
											color:
												iconKey === key ? '#FFFFFF' : colors.primary,
											fontWeight: '600',
										}}
									>
										{customIconLabel(key)}
									</Text>
								</Pressable>
							))}
						</View>
						{error ? (
							<Text style={{ color: colors.danger, marginBottom: spacing.sm }}>
								{error}
							</Text>
						) : null}
						<ChoiceButton
							label="Сохранить тип"
							onPress={() => void handleCreate()}
							disabled={busy}
						/>
						<ChoiceButton
							label="Назад"
							primary={false}
							onPress={() => setMode('list')}
						/>
					</>
				)}
			</ScrollView>
			</FormKeyboardShell>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, paddingBottom: spacing.xxl },
	row: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	rowMain: { flex: 1 },
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	label: {
		...typography.caption,
		textTransform: 'uppercase',
		marginBottom: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	chip: {
		minHeight: 40,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
})
