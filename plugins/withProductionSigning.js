/**
 * Expo config plugin — wires Android release signing to an external
 * ForestMusic-style signing.properties file that lives outside the repo.
 *
 * Secrets (passwords, keystore binary) must never enter git. Only the
 * absolute path to the local signing.properties file is embedded here.
 */

const { withAppBuildGradle } = require('expo/config-plugins')

/** Absolute path to local signing properties (outside repository). */
const SIGNING_PROPERTIES_PATH =
	'D:/secure/android-signing/babyDiaryRuStore/signing.properties'

/**
 * Groovy block injected into signingConfigs.release.
 * Reads storeFile / passwords / alias from the external properties file.
 */
const RELEASE_SIGNING_BLOCK = `
        release {
            // Production credentials live outside the repo (never committed).
            def signingPropertiesFile = file('${SIGNING_PROPERTIES_PATH}')
            if (!signingPropertiesFile.isFile()) {
                throw new GradleException("Production signing properties not found: \${signingPropertiesFile}. Fill this local file before running bundleRelease.")
            }
            def signingProperties = new Properties()
            signingPropertiesFile.withInputStream { signingProperties.load(it) }
            ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].each { propertyName ->
                if (!signingProperties.getProperty(propertyName)?.trim()) {
                    throw new GradleException("Production signing property '\${propertyName}' is missing or empty in \${signingPropertiesFile}.")
                }
            }
            storeFile file(signingProperties.getProperty('storeFile').trim())
            storePassword signingProperties.getProperty('storePassword')
            keyAlias signingProperties.getProperty('keyAlias').trim()
            keyPassword signingProperties.getProperty('keyPassword')
        }`

/**
 * Replace or insert the release signingConfig so bundleRelease never
 * falls back to the debug keystore.
 *
 * @param {string} buildGradle
 * @returns {string}
 */
function applyProductionSigning (buildGradle) {
	let next = buildGradle

	// Expo/RN template usually only defines signingConfigs.debug.
	// Insert a production release config after the debug block (idempotent).
	if (!next.includes(SIGNING_PROPERTIES_PATH)) {
		const debugOnlyPattern =
			/(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\})(\s*\n\s*\})/m
		if (debugOnlyPattern.test(next)) {
			next = next.replace(
				debugOnlyPattern,
				`$1${RELEASE_SIGNING_BLOCK}$2`,
			)
		} else {
			throw new Error(
				'withProductionSigning: could not locate signingConfigs.debug ' +
					'block in android/app/build.gradle',
			)
		}
	}

	// Force release buildType to use signingConfigs.release (not debug).
	// Expo template may place caution comments between `release {` and signingConfig.
	if (/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(next)) {
		next = next.replace(
			/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
			'$1signingConfig signingConfigs.release',
		)
	} else if (!/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(next)) {
		// No signingConfig line yet — inject one at the start of release {}.
		next = next.replace(
			/(buildTypes\s*\{[\s\S]*?release\s*\{)/,
			'$1\n            signingConfig signingConfigs.release',
		)
	}

	return next
}

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 */
function withProductionSigning (config) {
	return withAppBuildGradle(config, (cfg) => {
		if (cfg.modResults.language !== 'groovy') {
			throw new Error(
				'withProductionSigning: expected Groovy android/app/build.gradle',
			)
		}
		cfg.modResults.contents = applyProductionSigning(
			cfg.modResults.contents,
		)
		return cfg
	})
}

module.exports = withProductionSigning
