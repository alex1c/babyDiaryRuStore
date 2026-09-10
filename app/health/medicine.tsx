/**
 * Medicine / vitamin intake + catalog pick.
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
import { LightweightToast, useLightweightToast } from '@/src/components/LightweightToast'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import { medicineUnitLabel } from '@/src/domain/healthLabels'
import { QuickEventValidationError } from '@/src/domain/quickEventLabels'
import { MEDICINE_UNITS, type MedicineCatalogItem, type MedicineUnit } from '@/src/models/health'
import type { MedicineKind } from '@/src/models/quickEvents'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthMedicineScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { quickEvents, medicineCatalog } = useDatabase()
	const params = useLocalSearchParams<{ id?: string }>()
	const editId = params.id ? String(params.id) : null
	const { message, showToast } = useLightweightToast()

	const [kind, setKind] = useState<MedicineKind>('medicine')
	const [name, setName] = useState('')
	const [dose, setDose] = useState('')
	const [unit, setUnit] = useState<MedicineUnit | 'other'>('ml')
	const [catalogId, setCatalogId] = useState<string | null>(null)
	const [catalog, setCatalog] = useState<MedicineCatalogItem[]>([])
	const [notes, setNotes] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		void (async () => {
			if (!medicineCatalog || !activeChild) {
				return
			}
			setCatalog(
				await medicineCatalog.listByChild(activeChild.id, kind, true),
			)
		})()
	}, [medicineCatalog, activeChild, kind])

	useEffect(() => {
		void (async () => {
			if (!editId || !quickEvents) {
				return
			}
			const row = await quickEvents.getMedicineById(editId)
			if (!row) {
				return
			}
			setKind(row.kind)
			setName(row.name)
			setDose(row.doseText ?? '')
			setUnit((row.unit as MedicineUnit) || 'other')
			setCatalogId(row.catalogId)
			setNotes(row.notes ?? '')
		})()
	}, [editId, quickEvents])

	const handlePickCatalog = (item: MedicineCatalogItem): void => {
		setCatalogId(item.id)
		setName(item.name)
		setKind(item.kind)
		if (item.defaultDose) {
			setDose(item.defaultDose)
		}
		if (item.defaultUnit) {
			setUnit(item.defaultUnit as MedicineUnit)
		}
	}

	const handleSaveCatalog = async (): Promise<void> => {
		if (!medicineCatalog || !activeChild || !name.trim()) {
			return
		}
		const created = await medicineCatalog.create({
			childId: activeChild.id,
			kind,
			name,
			defaultDose: dose || null,
			defaultUnit: unit,
		})
		setCatalogId(created.id)
		setCatalog(await medicineCatalog.listByChild(activeChild.id, kind, true))
		showToast('Добавлено в каталог')
	}

	const handleSave = async (): Promise<void> => {
		if (!quickEvents || !activeChild || busy) {
			return
		}
		setBusy(true)
		setError(null)
		try {
			if (editId) {
				await quickEvents.updateMedicine(editId, {
					name,
					doseText: dose,
					unit,
					notes,
					catalogId,
				})
			} else {
				await quickEvents.createMedicine({
					childId: activeChild.id,
					kind,
					name,
					doseText: dose,
					unit,
					notes,
					catalogId,
				})
			}
			showToast('Запись сохранена')
			router.back()
		} catch (err) {
			if (err instanceof QuickEventValidationError) {
				setError(err.message)
			} else {
				logger.error('medicine save failed', err)
				setError('Не удалось сохранить')
			}
			setBusy(false)
		}
	}

	const handleDelete = (): void => {
		if (!editId || !quickEvents) {
			return
		}
		Alert.alert('Удалить приём?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await quickEvents.deleteEvent(editId)
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
				<View style={styles.chips}>
					{(['medicine', 'vitamin'] as MedicineKind[]).map((k) => (
						<Pressable
							key={k}
							onPress={() => setKind(k)}
							style={[
								styles.chip,
								{
									backgroundColor:
										kind === k ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{k === 'vitamin' ? 'Витамин' : 'Лекарство'}
							</Text>
						</Pressable>
					))}
				</View>
				{catalog.length > 0 ? (
					<>
						<Text style={[styles.label, { color: colors.textSecondary }]}>
							Из каталога
						</Text>
						<View style={styles.chips}>
							{catalog.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => handlePickCatalog(item)}
									style={[
										styles.chip,
										{
											backgroundColor:
												catalogId === item.id
													? colors.primarySoft
													: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Text style={{ color: colors.text }}>{item.name}</Text>
								</Pressable>
							))}
						</View>
					</>
				) : null}
				<Text style={[styles.label, { color: colors.textSecondary }]}>
					Название
				</Text>
				<TextInput
					value={name}
					onChangeText={(v) => {
						setName(v)
						setCatalogId(null)
					}}
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
					Количество
				</Text>
				<TextInput
					value={dose}
					onChangeText={setDose}
					keyboardType="decimal-pad"
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
					Единица
				</Text>
				<View style={styles.chips}>
					{MEDICINE_UNITS.map((u) => (
						<Pressable
							key={u}
							onPress={() => setUnit(u)}
							style={[
								styles.chip,
								{
									backgroundColor:
										unit === u ? colors.primarySoft : colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={{ color: colors.text }}>
								{medicineUnitLabel(u)}
							</Text>
						</Pressable>
					))}
				</View>
				<TextInput
					value={notes}
					onChangeText={setNotes}
					placeholder="Заметка"
					placeholderTextColor={colors.textMuted}
					style={[
						styles.input,
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
					style={[styles.save, { backgroundColor: colors.primary }]}
				>
					<Text style={{ color: colors.surface, fontWeight: '600' }}>
						Сохранить приём
					</Text>
				</Pressable>
				{!editId ? (
					<Pressable
						onPress={() => void handleSaveCatalog()}
						style={[styles.secondary, { borderColor: colors.border }]}
					>
						<Text style={{ color: colors.primary }}>
							Сохранить в каталог
						</Text>
					</Pressable>
				) : (
					<Pressable onPress={handleDelete} style={styles.delete}>
						<Text style={{ color: colors.danger }}>Удалить</Text>
					</Pressable>
				)}
			</ScrollView>
			</FormKeyboardShell>
			<LightweightToast message={message} />
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: spacing.md, gap: spacing.sm },
	label: { ...typography.caption },
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
	save: {
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	secondary: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		alignItems: 'center',
	},
	delete: { alignItems: 'center', padding: spacing.md },
})
