#!/usr/bin/env python3
"""Иконки приложения: три полосы в цветах рода на тёмном фоне.

Рисуем кодом, а не в редакторе: иконка повторяется в четырёх размерах, и шрифт
для неё не нужен — полосы складываются в «строится предложение». Цвета те же,
что кодируют род и падеж в интерфейсе (docs/design.md).

    python3 -I tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public'
BG = (0x17, 0x17, 0x1C)
BARS = [(0x24, 0x48, 0xB8), (0xD1, 0x67, 0x1A), (0x7A, 0x4C, 0xB0)]
WIDTHS = [1.0, 0.72, 0.88]


def chunk(tag, body):
    return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body))


def write_png(path, size, px):
    raw = b''.join(b'\0' + bytes(v for x in range(size) for v in px[y][x]) for y in range(size))
    head = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + head + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def rounded_bar(px, x0, y0, w, h, color):
    """Полоса с круглыми концами: прямоугольник плюс два полукруга."""
    r = h / 2
    cy = y0 + r
    for y in range(int(y0), int(y0 + h) + 1):
        for x in range(int(x0), int(x0 + w) + 1):
            dx = min(max(x + 0.5, x0 + r), x0 + w - r)
            if (x + 0.5 - dx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r + 0.01:
                px[y][x] = color


def icon(size, inset):
    px = [[BG] * size for _ in range(size)]
    inner = size * (1 - 2 * inset)
    h = inner * 0.16
    gap = inner * 0.1
    top = (size - (3 * h + 2 * gap)) / 2
    for i, (color, wf) in enumerate(zip(BARS, WIDTHS)):
        rounded_bar(px, size * inset, top + i * (h + gap), inner * wf, h, color)
    return px


for name, size, inset in [
    ('icon-192.png', 192, 0.16),
    ('icon-512.png', 512, 0.16),
    ('icon-maskable-512.png', 512, 0.24),
    ('apple-touch-icon-180.png', 180, 0.16),
]:
    write_png(OUT / name, size, icon(size, inset))
    print(name)
