/**
 * Expo config plugin — documents native Yandex Mobile Ads linkage.
 * The npm package `yandex-mobile-ads` autolinks via React Native;
 * this plugin keeps a stable hook for future manifest tweaks (consent, AD_ID).
 */

const {
	withAndroidManifest,
	AndroidConfig,
} = require('expo/config-plugins')

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 */
function withYandexMobileAds (config) {
	return withAndroidManifest(config, (cfg) => {
		const manifest = cfg.modResults
		const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
		// Ensure INTERNET exists for ad requests (harmless if already present).
		AndroidConfig.Permissions.ensurePermissions(manifest, [
			'android.permission.INTERNET',
			'android.permission.ACCESS_NETWORK_STATE',
		])
		// Keep a stable marker so future privacy metadata can be attached here.
		if (!app['meta-data']) {
			app['meta-data'] = []
		}
		const markerName = 'com.calculatorplatform.babydiary.YANDEX_ADS'
		const existing = app['meta-data'].find(
			(item) => item.$?.['android:name'] === markerName,
		)
		if (!existing) {
			app['meta-data'].push({
				$: {
					'android:name': markerName,
					'android:value': 'enabled',
				},
			})
		}
		return cfg
	})
}

module.exports = withYandexMobileAds
