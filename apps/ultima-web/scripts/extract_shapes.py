#!/usr/bin/env python3
"""
Extract Ultima 7 shapes from SHAPES.VGA using PALETTES.FLX for color.
Usage: python3 extract_shapes.py [shape_nums...]
"""
import struct, sys, os
from PIL import Image

GAME_DIR = os.path.join(os.path.dirname(__file__), '../Contents/Resources/game/STATIC')
OUT_DIR   = os.path.join(os.path.dirname(__file__), '../public/assets')

# ── FLX reader ────────────────────────────────────────────────────────────────
def read_flex(path):
    """Return list of (offset, size) tuples from a FLX file."""
    with open(path, 'rb') as f:
        data = f.read()
    count = struct.unpack_from('<I', data, 0x54)[0]
    items = []
    for i in range(count):
        off, sz = struct.unpack_from('<II', data, 0x58 + i * 8)
        items.append((off, sz))
    return data, items

# ── Palette ───────────────────────────────────────────────────────────────────
def load_palette():
    data, items = read_flex(os.path.join(GAME_DIR, 'PALETTES.FLX'))
    # Use palette 0 (daytime)
    off, sz = items[0]
    # Each palette entry is 3 bytes (r, g, b), values 0-63 (VGA 6-bit)
    pal = []
    for i in range(256):
        r, g, b = data[off + i*3], data[off + i*3 + 1], data[off + i*3 + 2]
        pal.append((r * 4, g * 4, b * 4))  # scale 6-bit → 8-bit
    return pal

# ── Shape decoder ─────────────────────────────────────────────────────────────
def decode_frame(data, base):
    """
    Decode one U7 shape frame.
    Returns (pixels_dict, xright, xleft, ybelow, yabove)
    where pixels_dict maps (col, row) -> palette_index (0 = transparent).
    """
    xright, xleft, ybelow, yabove = struct.unpack_from('<HHHH', data, base + 2)
    w = xright + xleft
    h = ybelow + yabove
    if w <= 0 or h <= 0 or w > 2048 or h > 2048:
        return None, xright, xleft, ybelow, yabove

    pixels = {}
    pos = base + 10  # skip 2-byte len + 8-byte header

    # U7 shape data is column-major RLE
    for col in range(w):
        # Each column starts with a skip count (rows from top to skip)
        row = 0
        while True:
            if pos >= len(data): break
            skip = data[pos]; pos += 1
            if skip == 255:  # end of column
                break
            row += skip
            if pos >= len(data): break
            cnt = data[pos]; pos += 1
            if cnt == 0: break
            for _ in range(cnt):
                if pos >= len(data): break
                pix = data[pos]; pos += 1
                if pix != 0:
                    pixels[(col, row)] = pix
                row += 1
    return pixels, xright, xleft, ybelow, yabove

def extract_shape(shape_data, palette):
    """Extract all frames of a shape, return list of PIL Images (or None)."""
    if len(shape_data) < 4:
        return []
    # Number of frames = first frame offset / 4
    first_off = struct.unpack_from('<I', shape_data, 0)[0]
    num_frames = first_off // 4
    if num_frames == 0 or num_frames > 256:
        return []

    frame_offsets = [struct.unpack_from('<I', shape_data, i*4)[0] for i in range(num_frames)]

    images = []
    for fo in frame_offsets:
        if fo + 10 > len(shape_data):
            images.append(None)
            continue
        pixels, xright, xleft, ybelow, yabove = decode_frame(shape_data, fo)
        if pixels is None:
            images.append(None)
            continue
        w = xright + xleft
        h = ybelow + yabove
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        pdata = img.load()
        for (col, row), idx in pixels.items():
            if 0 <= col < w and 0 <= row < h:
                r, g, b = palette[idx]
                pdata[col, row] = (r, g, b, 255)
        images.append(img)
    return images

def get_shape_images(shape_num, palette):
    data, items = read_flex(os.path.join(GAME_DIR, 'SHAPES.VGA'))
    if shape_num >= len(items):
        return []
    off, sz = items[shape_num]
    if off == 0 or sz == 0:
        return []
    shape_data = data[off:off + sz]
    return extract_shape(shape_data, palette)

# ── Main ──────────────────────────────────────────────────────────────────────
def save_shape_sheet(shape_num, palette, out_path=None):
    imgs = get_shape_images(shape_num, palette)
    valid = [i for i in imgs if i is not None]
    if not valid:
        print(f'Shape {shape_num}: no valid frames')
        return None

    print(f'Shape {shape_num}: {len(valid)} frames, sizes: {[i.size for i in valid]}')

    # Lay frames out horizontally in a sprite sheet
    max_h = max(i.height for i in valid)
    total_w = sum(i.width for i in valid)
    sheet = Image.new('RGBA', (total_w, max_h), (0, 0, 0, 0))
    x = 0
    for img in valid:
        sheet.paste(img, (x, max_h - img.height))
        x += img.width

    if out_path is None:
        out_path = os.path.join(OUT_DIR, f'shape_{shape_num}.png')
    sheet.save(out_path)
    print(f'  → saved {out_path}')
    return out_path

if __name__ == '__main__':
    palette = load_palette()
    shape_nums = [int(x) for x in sys.argv[1:]] if sys.argv[1:] else list(range(290, 310))
    for n in shape_nums:
        save_shape_sheet(n, palette)
