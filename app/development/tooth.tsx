/**
 * Add / edit tooth eruption record.
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { FormKeyboardShell } from '@/src/components/FormKeyboardShell'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { toothLabel, TOOTH_SELECTOR_ORDER } from '@/src/domain/developmentLabels'
import type { ToothKey } from '@/src/models/development'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function ToothFormScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { teeth } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null

	const [toothKey, setToothKey] = useState<ToothKey>('lower_central_left')
	const [eruptedAt, setEruptedAt] = useState(toLocalDateOnly())
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!editId || !teeth) {
				return
			}
			const row = await teeth.getById(editId)
			if (!row) {
				return
			}
			setToothKey(row.toothKey)
			setEruptedAt(row.eruptedAt)
			setNotes(row.notes ?? '')
		})()
	}, [editId, teeth])

	const handleSave = async (): Promise<void> => {
		if (!teeth || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			if (editId) {
				await teeth.update(editId, { eruptedAt, notes })
			} else {
				await teeth.upsert({
					childId: activeChild.id,
					toothKey,
					eruptedAt,
					notes,
				})
			}
			router.back()
		} catch (err) {
			logger.error('save tooth failed', err)
			// Map repository English internals to Russian UI copy.
			const raw = err instanceof Error ? err.message : ''
			const russianByEnglish: Record<string, string> = {
				'Failed to create tooth': 'Не удалось сохранить запись о зубе',
				'Failed to update tooth': 'Не удалось сохранить запись о зубе',
			}
			setError(
				russianByEnglish[raw] ??
					(raw && /[А-Яа-яЁё]/.test(raw) ? raw : 'Не удалось сохранить'),
			)
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !teeth) {
			return
		}
		Alert.alert('Удалить запись о зубе?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await teeth.delete(editId)
						router.back()
					})()
				},
			},
		])
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
				{!editId ? (
					<>
						<Text
							style={[styles.label, { color: colors.textSecondary }]}
						>
							Зуб
						</Text>
						<View style={styles.chips}>
							{TOOTH_SELECTOR_ORDER.map((key) => (
								<Pressable
									key={key}
									onPress={() => setToothKey(key)}
									style={[
										styles.chip,
										{
											backgroundColor:
												toothKey === key
													? colors.primarySoft
													: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Text style={{ color: colors.text, fontSize: 13 }}>
										{toothLabel(key)}
									</Text>
								</Pressable>
							))}
						</View>
					</>
				) : (
					<Text style={[styles.title, { color: colors.text }]}>
						{toothLabel(toothKey)}
					</Text>
				)}
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Дата появления (ГГГГ-ММ-ДД)
				</Text>
				<TextInput
					value={eruptedAt}
					onChangeText={setEruptedAt}
					style={[
						styles.input,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Заметка
				</Text>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					multiline
					style={[
						styles.input,
						styles.multiline,
						{
							color: colors.text,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				/>
				{error ? (
					<Text style={{ color: colors.danger }}>{error}</Text>
				) : null}
				<Pressable
					onPress={() => void handleSave()}
					disabled={busy}
					style={[
						styles.save,
						{ backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
					]}
				>
					<Text style={{ color: colors.surface, fontWeight: '600' }}>
						Сохранить
					</Text>
				</Pressable>
				{editId ? (
					<Pressable onPress={handleDelete} style={styles.delete}>
						<Text style={{ color: colors.danger }}>Удалить</Text>
					</Pressable>
				) : null}
			</ScrollView>
			</FormKeyboardShell>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm },
	label: { ...typography.caption },
	title: { ...typography.subtitle },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		...typography.body,
	},
	multiline: { minHeight: 72, textAlignVertical: 'top' },
	save: {
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
		marginTop: spacing.sm,
	},
	delete: { alignItems: 'center', padding: spacing.md },
})
