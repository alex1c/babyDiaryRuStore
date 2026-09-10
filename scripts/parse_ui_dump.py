"""Dump visible UI texts and bounds from adb uiautomator XML."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

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
OUT = Path(__file__).resolve().parents[1] / 'release-artifacts' / 'screenshots' / '_ui.xml'


def main () -> None:
	subprocess.run(
		[ADB, '-s', DEVICE, 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml'],
		check=True,
	)
	subprocess.run([ADB, '-s', DEVICE, 'pull', '/sdcard/ui.xml', str(OUT)], check=True)
	text = OUT.read_text(encoding='utf-8')
	pattern = re.compile(
		r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
	)
	lines: list[str] = []
	for match in pattern.finditer(text):
		label, x1, y1, x2, y2 = match.groups()
		if not label.strip():
			continue
		line = f'{label[:48]:48} ({x1},{y1})-({x2},{y2})'
		lines.append(line)
	out_txt = OUT.with_suffix('.txt')
	out_txt.write_text('\n'.join(lines), encoding='utf-8')
	print(f'wrote {out_txt} ({len(lines)} nodes)')


if __name__ == '__main__':
	main()
