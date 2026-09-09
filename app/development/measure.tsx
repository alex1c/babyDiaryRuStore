/**
 * Create / edit a growth measurement visit (weight, height, head).
 */

import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import {
	formatCmForInput,
	GrowthValidationError,
} from '@/src/domain/growthLabels'
import { formatKgForInput } from '@/src/utils/decimalParse'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toOffsetDateTime } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function MeasureFormScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { growth } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null

	const [weight, setWeight] = useState('')
	const [height, setHeight] = useState('')
	const [head, setHead] = useState('')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		void (async () => {
			if (!editId || !growth) {
				return
			}
			const row = await growth.getById(editId)
			if (!row) {
				return
			}
			setWeight(
				row.weightGrams != null ? formatKgForInput(row.weightGrams) : '',
			)
			setHeight(
				row.heightMm != null ? formatCmForInput(row.heightMm) : '',
			)
			setHead(
				row.headCircumferenceMm != null
					? formatCmForInput(row.headCircumferenceMm)
					: '',
			)
			setNotes(row.notes ?? '')
		})()
	}, [editId, growth])

	const handleSave = async (): Promise<void> => {
		if (!growth || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			if (editId) {
				await growth.update(editId, {
					weightKgRaw: weight,
					heightCmRaw: height,
					headCmRaw: head,
					notes,
					measuredAt: toOffsetDateTime(new Date()),
				})
			} else {
				await growth.create({
					childId: activeChild.id,
					weightKgRaw: weight,
					heightCmRaw: height,
					headCmRaw: head,
					notes,
				})
			}
			router.back()
		} catch (err) {
			if (err instanceof GrowthValidationError) {
				setError(err.message)
			} else {
				logger.error('save growth failed', err)
				setError('Не удалось сохранить')
			}
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !growth) {
			return
		}
		Alert.alert('Удалить измерение?', 'Запись будет удалена.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await growth.delete(editId)
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
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.content}>
					<Field
						label="Вес, кг"
						value={weight}
						onChangeText={setWeight}
						placeholder="6,4"
						colors={colors}
					/>
					<Field
						label="Рост, см"
						value={height}
						onChangeText={setHeight}
						placeholder="63,5"
						colors={colors}
					/>
					<Field
						label="Окружность головы, см"
						value={head}
						onChangeText={setHead}
						placeholder="41,5"
						colors={colors}
					/>
					<Field
						label="Заметка"
						value={notes}
						onChangeText={setNotes}
						placeholder="Необязательно"
						colors={colors}
						multiline
					/>
					{error ? (
						<Text style={[styles.error, { color: colors.danger }]}>
							{error}
						</Text>
					) : null}
					<Pressable
						onPress={() => void handleSave()}
						disabled={busy}
						style={[
							styles.save,
							{ backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
						]}
					>
						<Text style={[styles.saveText, { color: colors.surface }]}>
							Сохранить
						</Text>
					</Pressable>
					{editId ? (
						<Pressable onPress={handleDelete} style={styles.delete}>
							<Text style={{ color: colors.danger }}>Удалить</Text>
						</Pressable>
					) : null}
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	)
}

function Field ({
	label,
	value,
	onChangeText,
	placeholder,
	colors,
	multiline,
}: {
	label: string
	value: string
	onChangeText: (v: string) => void
	placeholder: string
	colors: { text: string; textSecondary: string; surface: string; border: string }
	multiline?: boolean
}) {
	return (
		<View style={styles.field}>
			<Text style={[styles.label, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.textSecondary}
				keyboardType={multiline ? 'default' : 'decimal-pad'}
				multiline={multiline}
				style={[
					styles.input,
					{
						color: colors.text,
						backgroundColor: colors.surface,
						borderColor: colors.border,
					},
					multiline ? styles.multiline : null,
				]}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	flex: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.md },
	field: { gap: spacing.xs },
	label: { ...typography.caption },
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		...typography.body,
	},
	multiline: { minHeight: 80, textAlignVertical: 'top' },
	error: { ...typography.body },
	save: {
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	saveText: { ...typography.body, fontWeight: '600' },
	delete: { alignItems: 'center', padding: spacing.md },
})
