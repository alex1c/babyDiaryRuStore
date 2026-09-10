# Release info — Гнёздышко — дневник малыша

## STATUS

`READY FOR PRODUCTION SIGNING`

Production keystore / production-signed AAB are **not** part of this phase.

## App identity

| Field | Value |
| --- | --- |
| Display name | Гнёздышко — дневник малыша |
| Package | `com.calculatorplatform.babydiary` |
| Version | `1.0.0` |
| VersionCode | `1` |
| Git SHA | commit `chore: prepare baby diary release` on `main` |

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
| Intended URL | `https://alex1c.github.io/babyDiaryRuStore/privacy.html` |
| Publication status | `NEEDS PUBLISH` (URL returned 404 at packaging time) |
| Notes | `release-artifacts/PRIVACY_INFO.md` |

## Store listing copy

See `release-artifacts/RUSTORE_LISTING_RU.md`.

## Signing

| Item | Status |
| --- | --- |
| Production keystore created | **NO** |
| Production AAB created | **NO** |
| Signing status | **NOT YET SIGNED** / waiting for user signing phase |
