# Monetization plan — Yandex Mobile Ads (Phase 15)

Production advertising is wired through `src/ads/` only. Do not scatter SDK calls or unit IDs across screens.

## App / partner

- Display name: **Гнёздышко — дневник малыша**
- Package: `com.calculatorplatform.babydiary`
- Yandex App ID (partner console): `d2ec0cc3-c329-4f17-86f7-5d820b2082dd`
- SDK uses **ad unit IDs** at runtime; App ID is stored for partner/account reference (not injected into ad requests).

## Production ad units

| Placement | Unit ID | Format |
|-----------|---------|--------|
| Today banner | `R-M-20020281-1` | Sticky adaptive banner |
| Diary banner | `R-M-20020281-2` | Sticky adaptive banner |
| Statistics banner | `R-M-20020281-3` | Sticky adaptive banner |
| Development banner | `R-M-20020281-4` | Sticky adaptive banner |
| PDF interstitial | `R-M-20020281-5` | Interstitial |
| Rewarded (reserved) | `R-M-20020281-6` | **Not used in Phase 15** |

## Implementation map

- Config: `src/ads/adUnits.ts`
- Banners: `src/ads/BannerAd.tsx` via `BannerAdSlot` on hub tabs only
- Interstitial: `src/ads/pdfInterstitialFlow.ts` ← `runAfterFreshPdfGenerated` after fresh PDF write
- Session cap: `src/ads/sessionPolicy.ts` — max **1 successful show** per app session
- Boot/preload: `src/ads/AdsProvider.tsx` (deferred, non-blocking)
- Consent hook: `src/ads/consent.ts` (architecture only)

## Banner rules

- One banner per: Today, Diary, Statistics, Development
- Bottom of scroll / list footer — never between timeline rows or photo grid cells
- Load failure → collapse slot (no technical error UI)

## No banners

Active sleep/feeding screens, forms, Health entry, medicine/symptoms/doctor editors, report generation form, backup/restore, training, onboarding, profile edit, reminder form, moment photo picker.

## Interstitial rules

1. User taps create PDF
2. PDF file is written successfully
3. Bounded attempt to show interstitial (`R-M-20020281-5`)
4. Ready screen always opens afterward

Never show on: reopen existing PDF, share, medical saves, sleep/feeding/diaper actions, onboarding, training.

## Rewarded

ID stored only. No preload, show, or feature gating.

## AppMetrica

Not connected — waiting for a real production API key.

## Native

- npm: `yandex-mobile-ads`
- Android native: `com.yandex.android:mobileads` (no mediation adapters in default dependency)
- Expo plugin: `plugins/withYandexMobileAds.js`
- Requires a **native rebuild** (dev client / EAS / prebuild) — not available inside Expo Go
