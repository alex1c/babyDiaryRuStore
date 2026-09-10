/**
 * AppMetrica API key / App ID — production partner application UUID.
 * Same Yandex application id as Advertising Network registration.
 */

export const APPMETRICA_APP_ID = 'd2ec0cc3-c329-4f17-86f7-5d820b2082dd'

/** Alias used by the official SDK `apiKey` field. */
export function getAppMetricaApiKey (): string {
	return APPMETRICA_APP_ID
}
