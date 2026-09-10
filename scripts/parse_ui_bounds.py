import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
text = Path('.tmp-ui3.xml').read_text(encoding='utf-8')
for m in re.finditer(
	r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
	text,
):
	label, x1, y1, x2, y2 = m.groups()
	if not label.strip():
		continue
	cx = (int(x1) + int(x2)) // 2
	cy = (int(y1) + int(y2)) // 2
	print(f'{label!r} center=({cx},{cy}) bounds=[{x1},{y1}][{x2},{y2}]')
