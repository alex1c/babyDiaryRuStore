/**
 * Shared child profile form for onboarding create and profile edit.
 */

import { useMemo, useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import type { Child, ChildSex } from '../models/types'
import {
	CHILD_NAME_MAX_LENGTH,
	type ChildFormValues,
	validateChildForm,
} from '../domain/childValidation'
import { formatKgForInput } from '../utils/decimalParse'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'
import { DateOnlyPickerField } from './DateOnlyPickerField'
import { TimePickerField } from './TimePickerField'

const SEX_OPTIONS: { value: ChildSex | null; label: string }[] = [
	{ value: null, label: 'Не указан' },
	{ value: 'female', label: 'Девочка' },
	{ value: 'male', label: 'Мальчик' },
]

export interface ChildProfileFormProps {
	initial?: Child | null
	submitLabel: string
	onSubmit: (values: ChildFormValues) => Promise<void>
}

function childToFormValues (child: Child | null | undefined): ChildFormValues {
	if (!child) {
		return {
			name: '',
			birthDate: null,
			birthTime: null,
			sex: null,
			weightKgText: '',
			heightCmText: '',
		}
	}
	return {
		name: child.name,
		birthDate: child.birthDate,
		birthTime: child.birthTime,
		sex: child.sex,
		weightKgText:
			child.birthWeightGrams != null
				? formatKgForInput(child.birthWeightGrams)
				: '',
		heightCmText:
			child.birthHeightCm != null ? String(child.birthHeightCm) : '',
	}
}

export function ChildProfileForm ({
	initial,
	submitLabel,
	onSubmit,
}: ChildProfileFormProps) {
	const { colors } = useAppTheme()
	const [values, setValues] = useState<ChildFormValues>(() =>
		childToFormValues(initial),
	)
	const [errors, setErrors] = useState<string[]>([])
	const [busy, setBusy] = useState(false)

	const canSubmit = useMemo(() => {
		return values.name.trim().length > 0 && values.birthDate != null && !busy
	}, [values.name, values.birthDate, busy])

	const patch = (partial: Partial<ChildFormValues>): void => {
		setValues((prev) => ({ ...prev, ...partial }))
	}

	const handleSubmit = async (): Promise<void> => {
		const result = validateChildForm(values)
		if (!result.ok) {
			setErrors(result.errors)
			return
		}
		setErrors([])
		setBusy(true)
		try {
			await onSubmit(values)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Не удалось сохранить. Попробуйте ещё раз.'
			setErrors([message])
		} finally {
			setBusy(false)
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={80}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={[styles.label, { color: colors.textSecondary }]}>Имя</Text>
				<TextInput
					value={values.name}
					onChangeText={(name) => patch({ name })}
					placeholder="Как зовут малыша"
					placeholderTextColor={colors.textMuted}
					maxLength={CHILD_NAME_MAX_LENGTH}
					style={[
						styles.input,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					accessibilityLabel="Имя малыша"
					autoCorrect={false}
					returnKeyType="next"
				/>

				<DateOnlyPickerField
					label="Дата рождения"
					value={values.birthDate}
					onChange={(birthDate) => patch({ birthDate })}
					accessibilityLabel="Дата рождения"
				/>

				<Text style={[styles.label, { color: colors.textSecondary }]}>Пол</Text>
				<View style={styles.sexRow}>
					{SEX_OPTIONS.map((option) => {
						const selected = values.sex === option.value
						return (
							<Pressable
								key={option.label}
								onPress={() => patch({ sex: option.value })}
								style={[
									styles.sexChip,
									{
										backgroundColor: selected
											? colors.primarySoft
											: colors.surface,
										borderColor: selected
											? colors.primary
											: colors.border,
									},
								]}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								accessibilityLabel={`Пол: ${option.label}`}
							>
								<Text
									style={{
										color: selected ? colors.primary : colors.text,
										fontWeight: selected ? '700' : '500',
									}}
								>
									{option.label}
								</Text>
							</Pressable>
						)
					})}
				</View>

				<TimePickerField
					label="Время рождения"
					value={values.birthTime}
					onChange={(birthTime) => patch({ birthTime })}
					accessibilityLabel="Время рождения"
				/>

				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Вес при рождении, кг
				</Text>
				<TextInput
					value={values.weightKgText}
					onChangeText={(weightKgText) => patch({ weightKgText })}
					placeholder="Например 3,2"
					placeholderTextColor={colors.textMuted}
					keyboardType="decimal-pad"
					style={[
						styles.input,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					accessibilityLabel="Вес при рождении в килограммах"
				/>

				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Рост при рождении, см
				</Text>
				<TextInput
					value={values.heightCmText}
					onChangeText={(heightCmText) => patch({ heightCmText })}
					placeholder="Например 52"
					placeholderTextColor={colors.textMuted}
					keyboardType="decimal-pad"
					style={[
						styles.input,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					accessibilityLabel="Рост при рождении в сантиметрах"
				/>

				{errors.length > 0 ? (
					<View
						style={[styles.errorBox, { backgroundColor: colors.primarySoft }]}
						accessibilityRole="alert"
					>
						{errors.map((err) => (
							<Text key={err} style={[styles.errorText, { color: colors.danger }]}>
								{err}
							</Text>
						))}
					</View>
				) : null}

				<Pressable
					onPress={() => {
						void handleSubmit()
					}}
					disabled={!canSubmit}
					style={[
						styles.submit,
						{
							backgroundColor: canSubmit
								? colors.primary
								: colors.surfaceMuted,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel={submitLabel}
					accessibilityState={{ disabled: !canSubmit, busy }}
				>
					<Text
						style={[
							styles.submitText,
							{ color: canSubmit ? '#FFFFFF' : colors.textMuted },
						]}
					>
						{busy ? 'Сохраняем…' : submitLabel}
					</Text>
				</Pressable>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
	},
	label: {
		...typography.caption,
		marginBottom: spacing.xs,
	},
	input: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.md,
		...typography.body,
	},
	sexRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	sexChip: {
		minHeight: 44,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
	},
	errorBox: {
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	errorText: {
		...typography.body,
	},
	submit: {
		minHeight: 52,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	submitText: {
		...typography.button,
	},
})
