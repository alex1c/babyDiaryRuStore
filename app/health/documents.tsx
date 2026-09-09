/**
 * Health documents list — attachments across visits / symptoms.
 */

import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ManagedImage } from '@/src/components/ManagedImage'
import { useActiveChild } from '@/src/context/ActiveChildContext'
import { useDatabase } from '@/src/context/DatabaseContext'
import type { HealthAttachment } from '@/src/models/health'
import { useAppTheme } from '@/src/theme/ThemeProvider'
import { radii, spacing, typography } from '@/src/theme/tokens'

export default function HealthDocumentsScreen () {
	const { colors } = useAppTheme()
	const router = useRouter()
	const { activeChild } = useActiveChild()
	const { healthAttachments } = useDatabase()
	const [rows, setRows] = useState<HealthAttachment[]>([])
	const [loading, setLoading] = useState(true)

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				if (!healthAttachments || !activeChild) {
					setLoading(false)
					return
				}
				setRows(await healthAttachments.listByChild(activeChild.id))
				setLoading(false)
			})()
		}, [healthAttachments, activeChild]),
	)

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: colors.background }]}
			edges={['bottom', 'left', 'right']}
		>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				Фото и вложения хранятся только на устройстве.
			</Text>
			{loading ? (
				<ActivityIndicator color={colors.primary} />
			) : (
				<FlatList
					data={rows}
					keyExtractor={(item) => item.id}
					numColumns={2}
					columnWrapperStyle={styles.row}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						<Text style={{ color: colors.textMuted }}>
							Пока нет документов. Прикрепите фото к визиту или
							симптому.
						</Text>
					}
					renderItem={({ item }) => (
						<Pressable
							style={styles.item}
							onPress={() => {
								if (item.ownerKind === 'visit') {
									router.push(
										`/health/visit?id=${item.ownerId}` as Href,
									)
								} else if (item.ownerKind === 'symptom') {
									router.push(
										`/health/symptom?id=${item.ownerId}` as Href,
									)
								}
							}}
						>
							<ManagedImage
								uri={item.fileUri}
								style={styles.photo}
							/>
							<Text
								style={[styles.caption, { color: colors.textMuted }]}
								numberOfLines={1}
							>
								{item.ownerKind === 'visit' ? 'Визит' : 'Симптом'}
							</Text>
						</Pressable>
					)}
				/>
			)}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	lead: {
		...typography.caption,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	list: { padding: spacing.md, gap: spacing.sm },
	row: { gap: spacing.sm },
	item: { flex: 1, gap: 4, marginBottom: spacing.sm },
	photo: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: radii.sm,
	},
	caption: { ...typography.caption },
})
