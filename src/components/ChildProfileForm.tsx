/**
 * Shared child profile form for onboarding create and profile edit.
 */

import { useMemo, useState, type ReactNode } from 'react'
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
import { getProfilePhotoStorage } from '../services/appPhotoStorage'
import {
	photoPermissionDeniedMessage,
	pickImageFromLibrary,
	takePhotoWithCamera,
} from '../services/photoPicker'
import { logger } from '../services/logger'
import { formatKgForInput } from '../utils/decimalParse'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'
import { ChildAvatar } from './ChildAvatar'
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
	/** Optional content after the submit button (e.g. delete profile). */
	footer?: ReactNode
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
			photoUri: null,
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
		photoUri: child.photoUri,
	}
}

export function ChildProfileForm ({
	initial,
	submitLabel,
	onSubmit,
	footer,
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

	const importPicked = async (sourceUri: string): Promise<void> => {
		const managed = await getProfilePhotoStorage().importFromUri(sourceUri)
		patch({ photoUri: managed })
	}

	const handleGallery = async (): Promise<void> => {
		const picked = await pickImageFromLibrary()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setErrors([photoPermissionDeniedMessage()])
			}
			return
		}
		try {
			await importPicked(picked.uri)
			setErrors([])
		} catch (err) {
			logger.error('profile photo gallery import failed', err)
			setErrors(['Не удалось сохранить фото'])
		}
	}

	const handleCamera = async (): Promise<void> => {
		const picked = await takePhotoWithCamera()
		if (!picked.ok) {
			if (picked.reason === 'denied') {
				setErrors([photoPermissionDeniedMessage()])
			} else if (picked.reason === 'unavailable') {
				setErrors(['Камера сейчас недоступна — выберите фото из галереи'])
			}
			return
		}
		try {
			await importPicked(picked.uri)
			setErrors([])
		} catch (err) {
			logger.error('profile photo camera import failed', err)
			setErrors(['Не удалось сохранить фото'])
		}
	}

	const handleRemovePhoto = (): void => {
		patch({ photoUri: null })
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

	const previewName = values.name.trim() || 'Малыш'

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
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Фото
				</Text>
				<View style={styles.photoRow}>
					<ChildAvatar
						name={previewName}
						photoUri={values.photoUri}
						size={72}
					/>
					<View style={styles.photoActions}>
						<Pressable
							onPress={() => {
								void handleGallery()
							}}
							style={[
								styles.photoBtn,
								{
									backgroundColor: colors.primarySoft,
									borderColor: colors.border,
								},
							]}
							accessibilityRole="button"
							accessibilityLabel="Выбрать фото из галереи"
						>
							<Text style={{ color: colors.primary, fontWeight: '600' }}>
								Галерея
							</Text>
						</Pressable>
						<Pressable
							onPress={() => {
								void handleCamera()
							}}
							style={[
								styles.photoBtn,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
							accessibilityRole="button"
							accessibilityLabel="Сделать фото"
						>
							<Text style={{ color: colors.text }}>Камера</Text>
						</Pressable>
						{values.photoUri ? (
							<Pressable
								onPress={handleRemovePhoto}
								accessibilityRole="button"
								accessibilityLabel="Убрать фото"
							>
								<Text style={{ color: colors.danger }}>Убрать</Text>
							</Pressable>
						) : null}
					</View>
				</View>

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

				{footer}
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
	photoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		marginBottom: spacing.md,
	},
	photoActions: {
		flex: 1,
		gap: spacing.sm,
	},
	photoBtn: {
		minHeight: 40,
		paddingHorizontal: spacing.md,
		borderRadius: radii.sm,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
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
