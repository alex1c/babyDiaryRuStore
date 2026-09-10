# Release info — Гнёздышко — дневник малыша

## STATUS

`READY FOR RUSTORE RE-UPLOAD`

## App identity

| Field | Value |
| --- | --- |
| Display name | Гнёздышко — дневник малыша |
| Package | `com.calculatorplatform.babydiary` |
| Version | `1.0.0` |
| VersionCode | `1` |
| Final Git SHA | _(filled after commit)_ |

## Icon

| Asset | Path |
| --- | --- |
| Master | `assets/icon_gpt.png` |
| App / adaptive derivatives | `assets/images/icon.png` + Android mipmaps |
| RuStore 512×512 | `release-artifacts/icon-512.png` |

## Screenshots (RuStore, 1080×1920)

Captured on AVD `ForestMusic_Fast_API35`, cropped/resized to exactly `1080×1920`.

| # | File | Screen |
| --- | --- | --- |
| 01 | `release-artifacts/screenshots/01-today.png` | Сегодня |
| 02 | `release-artifacts/screenshots/02-diary.png` | Дневник |
| 03 | `release-artifacts/screenshots/03-statistics.png` | Статистика |
| 04 | `release-artifacts/screenshots/04-development.png` | Развитие |
| 05 | `release-artifacts/screenshots/05-health.png` | Здоровье |
| 06 | `release-artifacts/screenshots/06-reports.png` | Отчёты и экспорт |
| 07 | `release-artifacts/screenshots/07-moments.png` | Достижения / моменты |
| 08 | `release-artifacts/screenshots/08-more.png` | Ещё |

## Yandex Mobile Ads (unchanged)

| Placement | Unit ID |
| --- | --- |
| Today banner | `R-M-20020281-1` |
| Diary banner | `R-M-20020281-2` |
| Statistics banner | `R-M-20020281-3` |
| Development banner | `R-M-20020281-4` |
| Interstitial (PDF) | `R-M-20020281-5` |
| Rewarded (reserved, unused) | `R-M-20020281-6` |

## AppMetrica

| Field | Value |
| --- | --- |
| SDK | `@appmetrica/react-native-analytics` |
| App ID / API key | `d2ec0cc3-c329-4f17-86f7-5d820b2082dd` |
| Abstraction | `src/analytics/` |
| Sensitive diary data | not sent |

## Privacy

| Field | Value |
| --- | --- |
| Policy (markdown) | `docs/PRIVACY_POLICY_RU.md` |
| GitHub Pages HTML | `docs/privacy.html` |
| Privacy URL | `https://alex1c.github.io/babyDiaryRuStore/privacy.html` |
| Developer site | `https://forest-music.ru` |
| Notes | `release-artifacts/PRIVACY_INFO.md` |

## Store listing copy

See `release-artifacts/RUSTORE_LISTING_RU.md`.

## Signing

| Item | Value |
| --- | --- |
| Keystore (local, outside repo) | `D:\secure\android-signing\babyDiaryRuStore\babydiary-release.jks` |
| Alias | `babydiary` |
| Store password source | `D:\secure\android-signing\babyDiaryRuStore\keystore-password.txt` → `signing.properties` |
| Key password source | `D:\secure\android-signing\babyDiaryRuStore\key-password.txt` → `signing.properties` |
| Certificate SHA1 | `7C:0E:33:72:FD:C1:7C:98:82:32:1C:48:BB:61:16:00:6F:77:08:52` |
| Certificate SHA256 | `67:76:C9:BB:44:BE:DC:84:3E:7F:73:0E:11:DE:55:0A:7F:F1:99:B0:96:CD:9E:A2:BF:61:35:C3:21:1A:B5:B0` |
| Signing verified on AAB | **YES** (production key) |

## AAB

| Item | Value |
| --- | --- |
| Gradle output | `android/app/build/outputs/bundle/release/app-release.aab` |
| Release artifact | `release-artifacts/app-release.aab` |
| File size | `77911818` bytes |
| AAB SHA256 | `FF5EEF48D5EC741E019ED40DC314E7315FA6203DB5337EA416E5013835CD7726` |
| Production signed | **YES** |

## Android permissions (release merged / AAB)

Removed for RuStore (not required by product):

- `RECORD_AUDIO` — was from `expo-image-picker` (video mic); blocked via `microphonePermission: false` + `blockedPermissions`
- `SYSTEM_ALERT_WINDOW` — Expo/RN debug overlay template; blocked via `blockedPermissions`
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — legacy maxSdk 32 from `expo-image-picker` / `expo-file-system`; app uses Photo Picker / SAF / app-private storage; blocked via `blockedPermissions`

Kept (needed):

- `CAMERA` — `expo-image-picker` (photos of baby moments)
- `POST_NOTIFICATIONS` — `expo-notifications` (reminders)

Full merged release `uses-permission` list:

- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.CAMERA`
- `android.permission.INTERNET`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.READ_APP_BADGE`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- `android.permission.VIBRATE`
- `android.permission.WAKE_LOCK`
- `com.anddoes.launcher.permission.UPDATE_COUNT`
- `com.calculatorplatform.babydiary.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
- `com.google.android.c2dm.permission.RECEIVE`
- `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`
- `com.google.android.gms.permission.AD_ID`
- `com.htc.launcher.permission.READ_SETTINGS`
- `com.htc.launcher.permission.UPDATE_SHORTCUT`
- `com.huawei.android.launcher.permission.CHANGE_BADGE`
- `com.huawei.android.launcher.permission.READ_SETTINGS`
- `com.huawei.android.launcher.permission.WRITE_SETTINGS`
- `com.majeur.launcher.permission.UPDATE_BADGE`
- `com.oppo.launcher.permission.READ_SETTINGS`
- `com.oppo.launcher.permission.WRITE_SETTINGS`
- `com.sec.android.provider.badge.permission.READ`
- `com.sec.android.provider.badge.permission.WRITE`
- `com.sonyericsson.home.permission.BROADCAST_BADGE`
- `com.sonymobile.home.permission.PROVIDER_INSERT_BADGE`
- `me.everything.badger.permission.BADGE_COUNT_READ`
- `me.everything.badger.permission.BADGE_COUNT_WRITE`
