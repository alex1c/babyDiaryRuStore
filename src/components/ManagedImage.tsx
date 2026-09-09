/**
 * Safe image for managed photo URIs — missing files show a fallback.
 */

import { useState } from 'react'
import {
	Image,
	StyleSheet,
	Text,
	View,
	type ImageStyle,
	type StyleProp,
	type ViewStyle,
} from 'react-native'

import { useAppTheme } from '../theme/ThemeProvider'
import { typography } from '../theme/tokens'

interface ManagedImageProps {
	uri: string | null | undefined
	style?: StyleProp<ViewStyle>
	imageStyle?: StyleProp<ImageStyle>
	fallbackLabel?: string
}

export function ManagedImage ({
	uri,
	style,
	imageStyle,
	fallbackLabel = 'Фото недоступно',
}: ManagedImageProps) {
	const { colors } = useAppTheme()
	const [failed, setFailed] = useState(false)

	if (!uri || failed) {
		return (
			<View
				style={[
					styles.fallback,
					{ backgroundColor: colors.surfaceMuted, borderColor: colors.border },
					style,
				]}
			>
				<Text style={[styles.fallbackText, { color: colors.textMuted }]}>
					{fallbackLabel}
				</Text>
			</View>
		)
	}

	return (
		<View style={[{ overflow: 'hidden' }, style]}>
			<Image
				source={{ uri }}
				style={[styles.image, imageStyle]}
				resizeMode="cover"
				onError={() => setFailed(true)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	image: {
		width: '100%',
		height: '100%',
	},
	fallback: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
	},
	fallbackText: {
		...typography.caption,
		textAlign: 'center',
		paddingHorizontal: 8,
	},
})
