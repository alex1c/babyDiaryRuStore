/**
 * Image picker helpers — request permission only on user action.
 */

import * as ImagePicker from 'expo-image-picker'

export type PhotoPickResult =
	| { ok: true; uri: string }
	| { ok: false; reason: 'cancelled' | 'denied' | 'unavailable' }

const DENIED_MESSAGE =
	'Нет доступа к фото. Можно продолжить без снимка или разрешить доступ в настройках.'

export function photoPermissionDeniedMessage (): string {
	return DENIED_MESSAGE
}

/** Pick from gallery; does not crash when permission is denied. */
export async function pickImageFromLibrary (): Promise<PhotoPickResult> {
	const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
	if (!permission.granted) {
		return { ok: false, reason: 'denied' }
	}
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
		quality: 0.85,
		allowsEditing: false,
	})
	if (result.canceled || !result.assets?.[0]?.uri) {
		return { ok: false, reason: 'cancelled' }
	}
	return { ok: true, uri: result.assets[0].uri }
}

/** Camera is optional — may be unavailable without rebuild. */
export async function takePhotoWithCamera (): Promise<PhotoPickResult> {
	try {
		const permission = await ImagePicker.requestCameraPermissionsAsync()
		if (!permission.granted) {
			return { ok: false, reason: 'denied' }
		}
		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ['images'],
			quality: 0.85,
			allowsEditing: false,
		})
		if (result.canceled || !result.assets?.[0]?.uri) {
			return { ok: false, reason: 'cancelled' }
		}
		return { ok: true, uri: result.assets[0].uri }
	} catch {
		return { ok: false, reason: 'unavailable' }
	}
}
