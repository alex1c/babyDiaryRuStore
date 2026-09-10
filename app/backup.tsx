/**
 * Backup & restore — compact / full ZIP export and validated import.
 */

import { useCallback, useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import type { BackupKind, BackupManifest } from '@/src/domain/backupManifest'
import {
	collectReferencedRelativeMedia,
	exportBackupTableDump,
} from '@/src/services/backupTableIo'
import { createBackupZip, BackupError } from '@/src/services/backupCreate'
import {
	previewBackupZip,
	restoreBackupZip,
	RestoreError,
} from '@/src/services/backupRestore'
import {
	cleanupOrphanManagedFiles,
	estimateManagedMediaBytes,
	loadLastBackupMeta,
	pickBackupZipFile,
	readManagedMediaBytes,
	readZipBytesFromUri,
	saveLastBackupMeta,
	shareBackupZipFile,
	writeBackupZipFile,
	writeManagedMediaBytes,
	type LastBackupMeta,
} from '@/src/services/backupFs'
import { recreateDatabaseAtSchemaVersion } from '@/src/db/client'
import { logger } from '@/src/services/logger'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

function formatBytes (bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} Б`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} КБ`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDateLabel (iso: string): string {
	const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
	if (m) {
		return `${m[1]} ${m[2]}`
	}
	return iso
}

export default function BackupScreen () {
	const { colors } = useAppTheme()
	const { db, reminderService, reloadDatabase } = useDatabase()
	const { refresh: refreshActiveChild } = useActiveChild()

	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState<string | null>(null)
	const [lastMeta, setLastMeta] = useState<LastBackupMeta | null>(null)
	const [mediaEstimate, setMediaEstimate] = useState<number | null>(null)
	const [introSeen, setIntroSeen] = useState(false)
	const [preview, setPreview] = useState<BackupManifest | null>(null)
	const [pendingZip, setPendingZip] = useState<Uint8Array | null>(null)

	const documentDirectory = FileSystem.documentDirectory ?? 'file:///'

	const refreshMeta = useCallback(async () => {
		setLastMeta(await loadLastBackupMeta())
	}, [])

	useEffect(() => {
		queueMicrotask(() => {
			void refreshMeta()
			void (async () => {
				if (!db) {
					return
				}
				try {
					const dump = await exportBackupTableDump(db)
					const refs = collectReferencedRelativeMedia(
						dump,
						documentDirectory,
					)
					const bytes = await estimateManagedMediaBytes(
						documentDirectory,
						refs,
					)
					setMediaEstimate(bytes)
				} catch {
					setMediaEstimate(null)
				}
			})()
		})
	}, [db, documentDirectory, refreshMeta])

	const runCreate = async (kind: BackupKind): Promise<void> => {
		if (!db || busy) {
			return
		}
		setBusy(true)
		setStatus('Создаём резервную копию…')
		try {
			const result = await createBackupZip({
				db,
				kind,
				documentDirectory,
				readMediaBytes: async (_relative, absolute) =>
					readManagedMediaBytes(absolute),
			})
			const uri = await writeBackupZipFile(
				result.fileName,
				result.zipBytes,
			)
			const meta: LastBackupMeta = {
				createdAt: result.manifest.createdAt,
				kind,
				fileName: result.fileName,
				zipByteLength: result.zipByteLength,
				includesMedia: result.manifest.includesMedia,
				childrenCount: result.manifest.childrenCount,
			}
			await saveLastBackupMeta(meta)
			setLastMeta(meta)
			setStatus(
				`Готово · ${formatBytes(result.zipByteLength)}. Можно поделиться файлом.`,
			)
			await shareBackupZipFile(uri)
		} catch (err) {
			logger.error('backup create failed', err)
			const message =
				err instanceof BackupError
					? err.message
					: 'Не удалось создать резервную копию.'
			Alert.alert('Ошибка', message)
			setStatus(null)
		} finally {
			setBusy(false)
		}
	}

	const handlePickRestore = async (): Promise<void> => {
		if (busy) {
			return
		}
		try {
			const picked = await pickBackupZipFile()
			if (!picked) {
				return
			}
			setBusy(true)
			setStatus('Проверяем архив…')
			const bytes = await readZipBytesFromUri(picked.uri)
			const manifest = previewBackupZip(bytes)
			setPreview(manifest)
			setPendingZip(bytes)
			setStatus(null)
		} catch (err) {
			logger.error('backup pick failed', err)
			const message =
				err instanceof RestoreError
					? err.message
					: 'Не удалось открыть файл резервной копии.'
			Alert.alert('Ошибка', message)
			setStatus(null)
		} finally {
			setBusy(false)
		}
	}

	const handleConfirmRestore = async (): Promise<void> => {
		if (!db || !pendingZip || busy) {
			return
		}
		setBusy(true)
		setStatus('Восстанавливаем данные…')
		try {
			await restoreBackupZip(pendingZip, {
				db,
				documentDirectory,
				recreateDatabaseAtVersion: recreateDatabaseAtSchemaVersion,
				writeMediaFile: writeManagedMediaBytes,
				cleanupOrphans: (keep) =>
					cleanupOrphanManagedFiles(documentDirectory, keep),
				reconcileReminders: async () => {
					if (reminderService) {
						await reminderService.reconcile()
					}
				},
			})
			await reloadDatabase()
			await refreshActiveChild()
			setPreview(null)
			setPendingZip(null)
			setStatus('Восстановление завершено.')
			Alert.alert('Готово', 'Данные успешно восстановлены.')
		} catch (err) {
			logger.error('backup restore failed', err)
			const message =
				err instanceof RestoreError
					? err.message
					: 'Не удалось восстановить резервную копию.'
			Alert.alert('Ошибка', message)
			setStatus(null)
			try {
				await reloadDatabase()
				await refreshActiveChild()
			} catch {
				// ignore
			}
		} finally {
			setBusy(false)
		}
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['left', 'right', 'bottom']}
		>
			<ScrollView contentContainerStyle={styles.content}>
				{!introSeen ? (
					<View
						style={[
							styles.card,
							{
								backgroundColor: colors.primarySoft,
								borderColor: colors.border,
							},
						]}
					>
						<Text style={[styles.body, { color: colors.text }]}>
							Резервная копия помогает перенести дневник на другой
							телефон. Файл создаётся локально — приложение само
							ничего не загружает в облако.
						</Text>
						<Pressable
							onPress={() => setIntroSeen(true)}
							accessibilityRole="button"
						>
							<Text
								style={{
									color: colors.primary,
									fontWeight: '700',
									marginTop: spacing.sm,
								}}
							>
								Понятно
							</Text>
						</Pressable>
					</View>
				) : null}

				<Text style={[styles.section, { color: colors.textMuted }]}>
					Создать копию
				</Text>

				{mediaEstimate != null && mediaEstimate > 0 ? (
					<Text
						style={[styles.hint, { color: colors.textSecondary }]}
					>
						Фотографии и документы: {formatBytes(mediaEstimate)}
					</Text>
				) : null}

				<Pressable
					disabled={busy}
					onPress={() => {
						void runCreate('compact')
					}}
					style={[
						styles.btn,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="Быстрая копия без фотографий"
				>
					<Text style={[styles.btnTitle, { color: colors.text }]}>
						Быстрая · без фотографий
					</Text>
					<Text
						style={[styles.hint, { color: colors.textSecondary }]}
					>
						Все записи и настройки, медиафайлы не включаются
					</Text>
				</Pressable>

				<Pressable
					disabled={busy}
					onPress={() => {
						void runCreate('full')
					}}
					style={[
						styles.btn,
						{
							backgroundColor: colors.primary,
							borderColor: colors.primary,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="Полная копия с фотографиями"
				>
					<Text style={[styles.btnTitle, { color: '#FFFFFF' }]}>
						Полная · с фотографиями
					</Text>
					<Text style={[styles.hint, { color: '#FFFFFFCC' }]}>
						Данные и используемые снимки / документы
					</Text>
				</Pressable>

				<Text
					style={[
						styles.section,
						{ color: colors.textMuted, marginTop: spacing.lg },
					]}
				>
					Восстановить
				</Text>
				<Pressable
					disabled={busy}
					onPress={() => {
						void handlePickRestore()
					}}
					style={[
						styles.btn,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel="Выбрать файл резервной копии"
				>
					<Text style={[styles.btnTitle, { color: colors.text }]}>
						Выбрать ZIP-файл
					</Text>
				</Pressable>

				{preview ? (
					<View
						style={[
							styles.card,
							{
								backgroundColor: colors.surface,
								borderColor: colors.danger,
							},
						]}
					>
						<Text style={[styles.btnTitle, { color: colors.text }]}>
							Резервная копия
						</Text>
						<Text
							style={[
								styles.hint,
								{ color: colors.textSecondary },
							]}
						>
							Дата: {formatDateLabel(preview.createdAt)}
						</Text>
						<Text
							style={[
								styles.hint,
								{ color: colors.textSecondary },
							]}
						>
							Детей: {preview.childrenCount}
						</Text>
						<Text
							style={[
								styles.hint,
								{ color: colors.textSecondary },
							]}
						>
							{preview.includesMedia
								? 'С фотографиями'
								: 'Без фотографий'}
						</Text>
						<Text
							style={[
								styles.hint,
								{ color: colors.textSecondary },
							]}
						>
							Версия приложения: {preview.appVersion}
						</Text>
						<Text
							style={[
								styles.warn,
								{ color: colors.danger, marginTop: spacing.sm },
							]}
						>
							Текущие данные будут заменены.
						</Text>
						<Pressable
							disabled={busy}
							onPress={() => {
								void handleConfirmRestore()
							}}
							style={[
								styles.dangerBtn,
								{ backgroundColor: colors.danger },
							]}
							accessibilityRole="button"
							accessibilityLabel="Подтвердить восстановление"
						>
							<Text style={styles.dangerBtnText}>
								Восстановить
							</Text>
						</Pressable>
						<Pressable
							onPress={() => {
								setPreview(null)
								setPendingZip(null)
							}}
							style={styles.cancel}
						>
							<Text style={{ color: colors.textSecondary }}>
								Отмена
							</Text>
						</Pressable>
					</View>
				) : null}

				<Text
					style={[
						styles.section,
						{ color: colors.textMuted, marginTop: spacing.lg },
					]}
				>
					Последняя созданная копия
				</Text>
				{lastMeta ? (
					<View
						style={[
							styles.card,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
					>
						<Text style={{ color: colors.text }}>
							{formatDateLabel(lastMeta.createdAt)}
						</Text>
						<Text
							style={[
								styles.hint,
								{ color: colors.textSecondary },
							]}
						>
							{lastMeta.kind === 'full' ? 'Полная' : 'Быстрая'} ·{' '}
							{formatBytes(lastMeta.zipByteLength)}
						</Text>
					</View>
				) : (
					<Text
						style={[styles.hint, { color: colors.textSecondary }]}
					>
						Пока не создавалась
					</Text>
				)}

				{busy || status ? (
					<View style={styles.statusRow}>
						{busy ? (
							<ActivityIndicator color={colors.primary} />
						) : null}
						{status ? (
							<Text
								style={[
									styles.hint,
									{ color: colors.textSecondary, flex: 1 },
								]}
							>
								{status}
							</Text>
						) : null}
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: {
		padding: spacing.md,
		paddingBottom: spacing.xxl,
	},
	section: {
		...typography.caption,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		marginBottom: spacing.sm,
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	body: {
		...typography.body,
	},
	btn: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.sm,
		minHeight: 64,
		justifyContent: 'center',
	},
	btnTitle: {
		...typography.subtitle,
		fontWeight: '700',
		marginBottom: 2,
	},
	hint: {
		...typography.caption,
	},
	warn: {
		...typography.body,
		fontWeight: '600',
	},
	dangerBtn: {
		marginTop: spacing.md,
		minHeight: 48,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dangerBtnText: {
		...typography.button,
		color: '#FFFFFF',
	},
	cancel: {
		alignItems: 'center',
		paddingVertical: spacing.md,
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginTop: spacing.md,
	},
})
