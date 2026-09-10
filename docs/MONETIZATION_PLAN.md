# Monetization plan (future)

Planning notes only — **no ad SDK and no AppMetrica** in the app until product decisions and keys exist. Do not invent unit IDs or wire SDKs from this document.

## Banner slots (allowed)

Place reserved `BannerAdSlot` regions on these browse/hub surfaces only:

- **Today** (`app/(tabs)/index.tsx`)
- **Diary** (`app/(tabs)/diary.tsx`)
- **Stats** (`app/(tabs)/stats.tsx`)
- **Development** (`app/(tabs)/development.tsx`)

Banners should sit at the bottom of scroll content (or an equivalent non-blocking footer), never over primary timers or CTAs.

## No banners

Do **not** show banners on:

- Active sleep / active breastfeeding screens
- Form / input screens (sleep, feeding, diaper, events, development forms, etc.)
- Health **input** flows (temperature, symptom, medicine, visit editors)
- Medicine / catalog entry screens when editing
- Backup create / restore
- In-app training

## Interstitial (PDF)

After a **successful** PDF export/share, at most **one** interstitial per app session. Never interrupt mid-form or during active timers.

## Analytics

**AppMetrica:** do not integrate until a real API key is provided and privacy copy is ready. No placeholder keys.

## Implementation rule

Ship empty / no-op ad slots in UI layout if needed for spacing experiments; keep SDK imports and IDs out of the repo until launch readiness.
