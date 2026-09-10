"""Capture RuStore screenshots via bottom-tab taps (1080x1920)."""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'release-artifacts' / 'screenshots'
ADB = str(
	Path.home()
	/ 'AppData'
	/ 'Local'
	/ 'Android'
	/ 'Sdk'
	/ 'platform-tools'
	/ 'adb.exe'
)
DEVICE = 'emulator-5554'
PACKAGE = 'com.calculatorplatform.babydiary'
TARGET_W, TARGET_H = 1080, 1920

# Bottom tab centers on ForestMusic_Fast_API35 (1080x2340).
# Labels sit near y≈2290; icons slightly above.
TABS = {
	'today': (108, 2290),
	'diary': (324, 2290),
	'stats': (540, 2290),
	'development': (756, 2290),
	'more': (972, 2290),
}


def adb (*args: str) -> None:
	subprocess.run([ADB, '-s', DEVICE, *args], check=True)


def tap (x: int, y: int) -> None:
	adb('shell', 'input', 'tap', str(x), str(y))


def deep_link (path: str) -> None:
	uri = f"babydiary://{path.lstrip('/')}"
	adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', uri, PACKAGE)


def dismiss_logbox () -> None:
	# Collapse / dismiss RN LogBox overlays that can intercept tab taps.
	for _ in range(3):
		tap(540, 2050)
		time.sleep(0.3)
		tap(1000, 1980)
		time.sleep(0.3)


def capture (name: str) -> None:
	remote = '/sdcard/gn_shot.png'
	raw = OUT / f'_raw_{name}'
	final = OUT / name
	adb('shell', 'screencap', '-p', remote)
	adb('pull', remote, str(raw))
	img = Image.open(raw).convert('RGB')
	w, h = img.size
	target_ratio = TARGET_W / TARGET_H
	src_ratio = w / h
	if src_ratio > target_ratio:
		new_w = int(round(h * target_ratio))
		left = (w - new_w) // 2
		img = img.crop((left, 0, left + new_w, h))
	elif src_ratio < target_ratio:
		# Keep top of phone UI (status + content); crop bottom system chrome/tabs.
		new_h = int(round(w / target_ratio))
		img = img.crop((0, 0, w, new_h))
	img = img.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
	img.save(final, 'PNG', optimize=True)
	raw.unlink(missing_ok=True)
	print('saved', final, img.size)


def main () -> None:
	OUT.mkdir(parents=True, exist_ok=True)
	dismiss_logbox()
	tap(*TABS['today'])
	time.sleep(2.5)
	capture('01-today.png')

	tap(*TABS['diary'])
	time.sleep(2.5)
	capture('02-diary.png')

	tap(*TABS['stats'])
	time.sleep(2.8)
	capture('03-statistics.png')

	tap(*TABS['development'])
	time.sleep(2.5)
	capture('04-development.png')

	deep_link('health')
	time.sleep(2.5)
	capture('05-health.png')
	# Leave stack screens before more tab navigation.
	adb('shell', 'input', 'keyevent', '4')
	time.sleep(0.8)

	deep_link('reports')
	time.sleep(2.5)
	capture('06-reports.png')
	adb('shell', 'input', 'keyevent', '4')
	time.sleep(0.8)

	tap(*TABS['development'])
	time.sleep(1.5)
	adb('shell', 'input', 'swipe', '540', '1700', '540', '500', '350')
	time.sleep(0.8)
	adb('shell', 'input', 'swipe', '540', '1700', '540', '500', '350')
	time.sleep(1.2)
	capture('07-moments.png')

	tap(*TABS['more'])
	time.sleep(2.5)
	capture('08-more.png')

	for path in sorted(OUT.glob('*.png')):
		if path.name.startswith('_'):
			continue
		im = Image.open(path)
		assert im.size == (TARGET_W, TARGET_H), (path, im.size)
		print('OK', path.name, im.size)


if __name__ == '__main__':
	main()
