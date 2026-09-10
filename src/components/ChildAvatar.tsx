/**
 * Compact child avatar — photo when available, otherwise name initial.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { ManagedImage } from './ManagedImage'
import { useAppTheme } from '../theme/ThemeProvider'
import { typography } from '../theme/tokens'

interface ChildAvatarProps {
	name: string
	photoUri?: string | null
	size?: number
	style?: StyleProp<ViewStyle>
}

export function ChildAvatar ({
	name,
	photoUri,
	size = 40,
	style,
}: ChildAvatarProps) {
	const { colors } = useAppTheme()
	const initial = (name.trim().charAt(0) || '?').toUpperCase()
	const radius = size / 2

	if (photoUri) {
		return (
			<ManagedImage
				uri={photoUri}
				style={[
					{
						width: size,
						height: size,
						borderRadius: radius,
					},
					style,
				]}
				fallbackLabel={initial}
			/>
		)
	}

	return (
		<View
			style={[
				styles.initial,
				{
					width: size,
					height: size,
					borderRadius: radius,
					backgroundColor: colors.primarySoft,
					borderColor: colors.border,
				},
				style,
			]}
			accessibilityLabel={`Аватар ${name}`}
		>
			<Text
				style={[
					styles.initialText,
					{ color: colors.primary, fontSize: size * 0.4 },
				]}
			>
				{initial}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	initial: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
	},
	initialText: {
		...typography.button,
		fontWeight: '700',
	},
})
