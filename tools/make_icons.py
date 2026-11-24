#!/usr/bin/env python3
"""Иконки приложения: кладка из блоков в цветах рода на тёмном фоне.

Рисуем кодом, а не в редакторе: иконка повторяется в четырёх размерах, и шрифт
для неё не нужен — блоки складываются в «предложение собирается из частей».
Цвета те же, что кодируют род и падеж в интерфейсе (docs/design.md).

Каждый размер рисуется в четыре раза крупнее и усредняется: без сглаживания
скруглённые углы в мелком размере рвутся. Maskable — то же содержимое, сжатое
к центру до 80 % поля: Android режет иконку под свою форму.

    python3 -I tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public'
SS = 4
BG = (0x17, 0x17, 0x1C)
BLUE = (0x24, 0x48, 0xB8)     # der / Akkusativ
ORANGE = (0xD1, 0x67, 0x1A)   # die / Dativ
PURPLE = (0x7A, 0x4C, 0xB0)   # das / Genitiv


def chunk(tag, body):
    return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body))


def write_png(path, size, rows):
    raw = b''.join(b'\0' + bytes(r) for r in rows)
    head = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + head + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def downsample(rows, size):
    out, n = [], SS * SS
    for y in range(size):
        row = bytearray(3 * size)
        src = rows[y * SS:(y + 1) * SS]
        for x in range(size):
            r = g = b = 0
            for sr in src:
                for k in range(3 * x * SS, 3 * (x + 1) * SS, 3):
                    r, g, b = r + sr[k], g + sr[k + 1], b + sr[k + 2]
            row[3 * x:3 * x + 3] = bytes((r // n, g // n, b // n))
        out.append(row)
    return out


def rrect(rows, S, k, x, y, w, h, rad, color):
    """Скруглённый прямоугольник; координаты в долях поля, k сжимает к центру."""
    x0, y0 = (0.5 + (x - 0.5) * k) * S, (0.5 + (y - 0.5) * k) * S
    ww, hh = w * k * S, h * k * S
    rr = min(rad * k * S, ww / 2, hh / 2)
    c = bytes(color)
    for py in range(int(y0), int(y0 + hh) + 1):
        fy = py + 0.5
        if not y0 <= fy <= y0 + hh:
            continue
        row = rows[py]
        for px in range(int(x0), int(x0 + ww) + 1):
            fx = px + 0.5
            if not x0 <= fx <= x0 + ww:
                continue
            cx = min(max(fx, x0 + rr), x0 + ww - rr)
            cy = min(max(fy, y0 + rr), y0 + hh - rr)
            if (fx - cx) ** 2 + (fy - cy) ** 2 <= rr * rr + 1e-9:
                row[3 * px:3 * px + 3] = c


def icon(size, k):
    S = size * SS
    rows = [bytearray(bytes(BG) * S) for _ in range(S)]
    x, w, h, gap, rad = 0.14, 0.72, 0.20, 0.035, 0.045
    top, bottom, left = 0.5 - h - gap / 2, 0.5 + gap / 2, w * 0.56
    rrect(rows, S, k, x, top, left, h, rad, ORANGE)
    rrect(rows, S, k, x + left + gap, top, w - left - gap, h, rad, PURPLE)
    rrect(rows, S, k, x, bottom, w, h, rad, BLUE)
    return downsample(rows, size)


for name, size, k in [
    ('icon-192.png', 192, 1.0),
    ('icon-512.png', 512, 1.0),
    ('icon-maskable-512.png', 512, 0.8),
    ('apple-touch-icon-180.png', 180, 1.0),
]:
    write_png(OUT / name, size, icon(size, k))
    print(name)
