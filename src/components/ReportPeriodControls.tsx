/**
 * Shared period chips + optional custom date range for reports.
 */

import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import {
	reportPeriodPresetLabel,
	validateCustomReportRange,
	type ReportPeriodPreset,
} from '@/src/domain/reportPeriod'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { toLocalDateOnly } from '@/src/utils/datetime'
import { radii, spacing, typography } from '@/src/theme/tokens'

const PRESETS: ReportPeriodPreset[] = ['today', '7', '30', '90', 'custom']

export interface ReportPeriodControlsProps {
	preset: ReportPeriodPreset
	onPresetChange: (preset: ReportPeriodPreset) => void
	customStart: string
	customEnd: string
	onCustomStartChange: (date: string) => void
	onCustomEndChange: (date: string) => void
	/** Hide 90 days for share (optional). */
	hideNinety?: boolean
}

export function ReportPeriodControls ({
	preset,
	onPresetChange,
	customStart,
	customEnd,
	onCustomStartChange,
	onCustomEndChange,
	hideNinety = false,
}: ReportPeriodControlsProps) {
	const { colors } = useAppTheme()
	const [picking, setPicking] = useState<'start' | 'end' | null>(null)
	const today = toLocalDateOnly()
	const rangeError =
		preset === 'custom'
			? validateCustomReportRange(customStart, customEnd, today)
			: null

	const visible = hideNinety
		? PRESETS.filter((p) => p !== '90')
		: PRESETS

	const onPickerChange = (
		event: DateTimePickerEvent,
		date?: Date,
	): void => {
		if (Platform.OS === 'android') {
			setPicking(null)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		const next = toLocalDateOnly(date)
		if (picking === 'start') {
			onCustomStartChange(next)
		} else if (picking === 'end') {
			onCustomEndChange(next)
		}
		if (Platform.OS === 'ios') {
			setPicking(null)
		}
	}

	return (
		<View style={styles.wrap}>
			<View style={styles.chips}>
				{visible.map((p) => (
					<Pressable
						key={p}
						onPress={() => onPresetChange(p)}
						style={[
							styles.chip,
							{
								backgroundColor:
									preset === p ? colors.primarySoft : colors.surface,
								borderColor: colors.border,
							},
						]}
					>
						<Text style={{ color: colors.text, fontSize: 13 }}>
							{reportPeriodPresetLabel(p)}
						</Text>
					</Pressable>
				))}
			</View>
			{preset === 'custom' ? (
				<View style={styles.customRow}>
					<Pressable
						onPress={() => setPicking('start')}
						style={[
							styles.dateBtn,
							{ borderColor: colors.border, backgroundColor: colors.surface },
						]}
					>
						<Text style={{ color: colors.textMuted, fontSize: 12 }}>С</Text>
						<Text style={{ color: colors.text }}>{customStart}</Text>
					</Pressable>
					<Pressable
						onPress={() => setPicking('end')}
						style={[
							styles.dateBtn,
							{ borderColor: colors.border, backgroundColor: colors.surface },
						]}
					>
						<Text style={{ color: colors.textMuted, fontSize: 12 }}>По</Text>
						<Text style={{ color: colors.text }}>{customEnd}</Text>
					</Pressable>
				</View>
			) : null}
			{rangeError ? (
				<Text style={{ color: colors.danger, ...typography.caption }}>
					{rangeError}
				</Text>
			) : null}
			{picking ? (
				<DateTimePicker
					value={parseLocalDate(
						picking === 'start' ? customStart : customEnd,
					)}
					mode="date"
					display="default"
					maximumDate={new Date()}
					onChange={onPickerChange}
				/>
			) : null}
		</View>
	)
}

function parseLocalDate (dateOnly: string): Date {
	const [y, m, d] = dateOnly.split('-').map(Number)
	return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

const styles = StyleSheet.create({
	wrap: { gap: spacing.sm },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	customRow: { flexDirection: 'row', gap: spacing.sm },
	dateBtn: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.sm,
		gap: 2,
	},
})
