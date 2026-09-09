/**
 * Optional birth-time field using the system time picker.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { radii, spacing, typography } from '../theme/tokens'

interface TimePickerFieldProps {
	label: string
	value: string | null
	onChange: (next: string | null) => void
	accessibilityLabel?: string
}

function pad2 (n: number): string {
	return n.toString().padStart(2, '0')
}

function timeToDate (value: string | null): Date {
	const now = new Date()
	if (!value) {
		return now
	}
	const parts = value.split(':').map(Number)
	const h = parts[0] ?? 12
	const m = parts[1] ?? 0
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
}

export function TimePickerField ({
	label,
	value,
	onChange,
	accessibilityLabel,
}: TimePickerFieldProps) {
	const { colors } = useAppTheme()
	const [open, setOpen] = useState(false)

	const handleChange = (event: DateTimePickerEvent, date?: Date): void => {
		if (Platform.OS === 'android') {
			setOpen(false)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		onChange(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`)
	}

	return (
		<View style={styles.wrap}>
			<Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
			<View style={styles.row}>
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
						{value ?? 'Не указано'}
					</Text>
				</Pressable>
				{value ? (
					<Pressable
						onPress={() => onChange(null)}
						style={styles.clear}
						accessibilityRole="button"
						accessibilityLabel="Очистить время рождения"
					>
						<Text style={{ color: colors.primary }}>Очистить</Text>
					</Pressable>
				) : null}
			</View>
			{open ? (
				<DateTimePicker
					value={timeToDate(value)}
					mode="time"
					display="default"
					is24Hour
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
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	field: {
		flex: 1,
		minHeight: 48,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	value: {
		...typography.body,
	},
	clear: {
		minHeight: 48,
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
})
