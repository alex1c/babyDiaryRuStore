"""Generate Expo/Android/RuStore icon assets from assets/icon_gpt.png."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'assets' / 'icon_gpt.png'
IMAGES = ROOT / 'assets' / 'images'
RELEASE = ROOT / 'release-artifacts'


def fit_square (im: Image.Image, size: int) -> Image.Image:
	"""Uniform LANCZOS resize to an exact square — no crop, no stretch."""
	return im.resize((size, size), Image.Resampling.LANCZOS)


def main () -> None:
	IMAGES.mkdir(parents=True, exist_ok=True)
	RELEASE.mkdir(parents=True, exist_ok=True)

	src = Image.open(MASTER).convert('RGBA')
	width, height = src.size
	print(f'master: {width}x{height} mode={src.mode}')
	if width != height:
		raise SystemExit(f'NOT SQUARE: {width}x{height}')

	# RuStore store listing icon — faithful 512×512 from master.
	icon512 = fit_square(src, 512)
	icon512_path = RELEASE / 'icon-512.png'
	icon512.save(icon512_path, 'PNG', optimize=True)
	print('wrote', icon512_path, icon512.size)

	# Expo / notification main icon.
	icon1024 = fit_square(src, 1024)
	icon_path = IMAGES / 'icon.png'
	icon1024.save(icon_path, 'PNG', optimize=True)
	print('wrote', icon_path, icon1024.size)

	# Adaptive foreground: inset ~78% so chick/nest/leaves/heart stay in safe zone.
	fg_size = 1024
	scale = 0.78
	content = fit_square(src, int(round(fg_size * scale)))
	fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
	offset_x = (fg_size - content.width) // 2
	offset_y = (fg_size - content.height) // 2
	fg.paste(content, (offset_x, offset_y), content)
	fg_path = IMAGES / 'android-icon-foreground.png'
	fg.save(fg_path, 'PNG', optimize=True)
	print(
		'wrote',
		fg_path,
		fg.size,
		f'content={content.size} offset=({offset_x},{offset_y})',
	)

	# Brand soft cream — matches splash / diary palette and sits quietly
	# behind the inset foreground without inventing a new illustration style.
	avg = (255, 248, 242)
	print('bg_brand_rgb', avg)
	bg = Image.new('RGB', (fg_size, fg_size), avg)
	bg_path = IMAGES / 'android-icon-background.png'
	bg.save(bg_path, 'PNG', optimize=True)
	print('wrote', bg_path, bg.size)

	# Splash + favicon from the same master (brand consistency, no redesign).
	splash = fit_square(src, 512)
	splash_path = IMAGES / 'splash-icon.png'
	splash.save(splash_path, 'PNG', optimize=True)
	print('wrote', splash_path, splash.size)

	favicon = fit_square(src, 48)
	favicon_path = IMAGES / 'favicon.png'
	favicon.save(favicon_path, 'PNG', optimize=True)
	print('wrote', favicon_path, favicon.size)

	verified = Image.open(icon512_path)
	assert verified.size == (512, 512), verified.size
	assert verified.width == verified.height
	print('VERIFY_OK', icon512_path, verified.size, verified.mode)

	# Hex for app.json backgroundColor
	hex_color = '#{:02X}{:02X}{:02X}'.format(*avg)
	(RELEASE / 'ICON_NOTES.md').write_text(
		f"""# App icon integration notes

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
Brand soft cream: `{hex_color}` (matches splash / diary palette)

## Monochrome
No custom monochrome asset is shipped — `monochromeImage` is omitted from `app.json` adaptiveIcon.
""",
		encoding='utf-8',
	)
	print('backgroundColor', hex_color)


if __name__ == '__main__':
	main()
