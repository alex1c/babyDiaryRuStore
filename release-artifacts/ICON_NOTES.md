# App icon integration notes

## Source of truth
`assets/icon_gpt.png` — do not redesign; regenerate derivatives from this file only.

Regenerate with:
```bash
python scripts/generate_app_icons.py
```

## Generated assets
| File | Size | Purpose |
|------|------|---------|
| `release-artifacts/icon-512.png` | 512×512 | RuStore store icon |
| `assets/images/icon.png` | 1024×1024 | Expo / notification icon |
| `assets/images/android-icon-foreground.png` | 1024×1024 | Adaptive foreground (content inset ~78%) |
| `assets/images/android-icon-background.png` | 1024×1024 | Adaptive solid background (sampled edge color) |
| `assets/images/splash-icon.png` | 512×512 | Splash |
| `assets/images/favicon.png` | 48×48 | Web favicon |

## Adaptive safe zone
Foreground content is centered at ~78% of the canvas so the chick head, nest, leaves, and heart remain inside Android adaptive masks (circle / squircle). No visual style changes to the illustration itself.

## Background color
Brand soft cream: `#FFF8F2` (matches splash / diary palette)

## Monochrome
No custom monochrome asset is shipped — `monochromeImage` is omitted from `app.json` adaptiveIcon.
