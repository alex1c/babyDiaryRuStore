/**
 * Date-only field backed by the Android system date picker.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import type { DateOnly } from '../models/types'
import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'
import { toLocalDateOnly } from '../utils/datetime'

interface DateOnlyPickerFieldProps {
	label: string
	value: DateOnly | null
	onChange: (next: DateOnly) => void
	maximumDate?: Date
	accessibilityLabel?: string
}

function dateOnlyToLocalDate (value: DateOnly): Date {
	const parts = value.split('-').map(Number)
	const y = parts[0] ?? 2000
	const m = parts[1] ?? 1
	const d = parts[2] ?? 1
	return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function formatDisplay (value: DateOnly): string {
	const parts = value.split('-')
	if (parts.length !== 3) {
		return value
	}
	return `${parts[2]}.${parts[1]}.${parts[0]}`
}

export function DateOnlyPickerField ({
	label,
	value,
	onChange,
	maximumDate = new Date(),
	accessibilityLabel,
}: DateOnlyPickerFieldProps) {
	const { colors } = useAppTheme()
	const [open, setOpen] = useState(false)

	const handleChange = (event: DateTimePickerEvent, date?: Date): void => {
		if (Platform.OS === 'android') {
			setOpen(false)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		onChange(toLocalDateOnly(date))
	}

	return (
		<View style={styles.wrap}>
			<Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
			<Pressable
				onPress={() => setOpen(true)}
				style={[
					styles.field,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? label}
			>
				<Text
					style={[
						styles.value,
						{ color: value ? colors.text : colors.textMuted },
					]}
				>
					{value ? formatDisplay(value) : 'Выберите дату'}
				</Text>
			</Pressable>
			{open ? (
				<DateTimePicker
					value={value ? dateOnlyToLocalDate(value) : new Date()}
					mode="date"
					display="default"
					maximumDate={maximumDate}
					onChange={handleChange}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		marginBottom: spacing.md,
	},
	label: {
		...typography.caption,
		marginBottom: spacing.xs,
	},
	field: {
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	value: {
		...typography.body,
	},
})
