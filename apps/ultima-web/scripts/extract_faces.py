#!/usr/bin/env python3
"""
Extract NPC portrait faces from Ultima 7 FACES.VGA.

Frame format (per Ultima VII Internal Formats wiki):
  - 8-byte header: MaxX(u16), NegX(u16), NegY(u16), MaxY(u16)
  - Span records until BlockData == 0:
      BlockData (u16)  -- BlockType = BlockData & 1, BlockLength = BlockData >> 1
      XStart    (i16)  -- pixel start column, relative to origin
      YStart    (i16)  -- pixel start row, relative to origin
      pixel data       -- BlockLength pixels:
        BlockType 0: raw palette indices
        BlockType 1: RLE -- RunData bytes until BlockLength pixels consumed
                           RunType = RunData & 1 (0=literal, 1=repeat)
                           RunLength = RunData >> 1
  Width  = MaxX + NegX + 1
  Height = MaxY + NegY + 1
  Image pixel (XStart+NegX, YStart+NegY) is top-left of each span.

Usage:
  python3 extract_faces.py           -- extract all valid faces
  python3 extract_faces.py 5 14 79   -- extract specific face indices
"""
import struct, sys, os
from PIL import Image

GAME_DIR = os.path.join(os.path.dirname(__file__), '../Contents/Resources/game/STATIC')
OUT_DIR   = os.path.join(os.path.dirname(__file__), '../public/assets/faces')

# ── FLX helpers ───────────────────────────────────────────────────────────────
def read_flex(path):
    with open(path, 'rb') as f:
        data = f.read()
    count = struct.unpack_from('<I', data, 0x54)[0]
    # FLX entry table starts at 0x80; bytes 0x58-0x7F are padding/unused
    items = [(struct.unpack_from('<II', data, 0x80 + i * 8)) for i in range(count)]
    return data, items

def load_palette():
    data, items = read_flex(os.path.join(GAME_DIR, 'PALETTES.FLX'))
    off, _ = items[0]
    return [(data[off+i*3]*4, data[off+i*3+1]*4, data[off+i*3+2]*4) for i in range(256)]

# ── Frame decoder ─────────────────────────────────────────────────────────────
def decode_frame(sd, base, palette):
    """
    Decode one face frame from shape_data `sd` at offset `base`.
    Returns a PIL Image or None.
    """
    if base + 8 > len(sd):
        return None

    max_x, neg_x, neg_y, max_y = struct.unpack_from('<HHHH', sd, base)
    w = max_x + neg_x + 1
    h = max_y + neg_y + 1
    if w <= 0 or h <= 0 or w > 512 or h > 512:
        return None

    img  = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pxls = img.load()
    pos  = base + 8

    while pos + 6 <= len(sd):
        block_data = struct.unpack_from('<H', sd, pos)[0]; pos += 2
        if block_data == 0:
            break

        block_type   = block_data & 1
        block_length = block_data >> 1

        x_start = struct.unpack_from('<h', sd, pos)[0]; pos += 2
        y_start = struct.unpack_from('<h', sd, pos)[0]; pos += 2

        px = x_start + neg_x   # image-space column
        py = y_start + neg_y   # image-space row

        if block_type == 0:
            # Uncompressed: read block_length raw palette indices
            for i in range(block_length):
                if pos >= len(sd): break
                idx = sd[pos]; pos += 1
                if 0 <= px + i < w and 0 <= py < h:
                    r, g, b = palette[idx]
                    pxls[px + i, py] = (r, g, b, 255)
        else:
            # RLE: consume until block_length pixels written
            written = 0
            while written < block_length and pos < len(sd):
                run_data   = sd[pos]; pos += 1
                run_type   = run_data & 1
                run_length = run_data >> 1
                if run_type == 0:
                    # Literal: read run_length pixels
                    for i in range(run_length):
                        if pos >= len(sd): break
                        idx = sd[pos]; pos += 1
                        cx = px + written
                        if 0 <= cx < w and 0 <= py < h:
                            r, g, b = palette[idx]
                            pxls[cx, py] = (r, g, b, 255)
                        written += 1
                else:
                    # Repeat: read 1 color, replicate run_length times
                    if pos >= len(sd): break
                    idx = sd[pos]; pos += 1
                    r, g, b = palette[idx]
                    for i in range(run_length):
                        cx = px + written
                        if 0 <= cx < w and 0 <= py < h:
                            pxls[cx, py] = (r, g, b, 255)
                        written += 1

    return img

# ── Entry extractor ───────────────────────────────────────────────────────────
def extract_face_entry(data, off, sz, palette):
    """Extract all frames from one FACES.VGA FLX entry."""
    if sz < 12 or off == 0 or off + sz > len(data):
        return []

    sd = data[off:off + sz]

    # First 4 bytes = entry size (self-describing prefix)
    first_frame_off = struct.unpack_from('<I', sd, 4)[0]
    if first_frame_off < 8 or first_frame_off > sz:
        return []
    num_frames = (first_frame_off - 4) // 4
    if num_frames <= 0 or num_frames > 64:
        return []

    images = []
    for fi in range(num_frames):
        fo = struct.unpack_from('<I', sd, 4 + fi * 4)[0]
        if fo == 0 or fo + 8 > sz:
            continue
        img = decode_frame(sd, fo, palette)
        if img and img.size[0] >= 20 and img.size[1] >= 20:
            images.append((fi, img))
    return images

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    palette = load_palette()
    data, items = read_flex(os.path.join(GAME_DIR, 'FACES.VGA'))

    indices = [int(x) for x in sys.argv[1:]] if sys.argv[1:] else range(len(items))

    os.makedirs(OUT_DIR, exist_ok=True)

    # Remove old stale outputs
    for f in os.listdir(OUT_DIR):
        if f.startswith('face_') and f.endswith('.png'):
            os.remove(os.path.join(OUT_DIR, f))

    extracted = []
    for i in indices:
        if i >= len(items): continue
        off, sz = items[i]
        frames = extract_face_entry(data, off, sz, palette)
        if not frames: continue

        fi, img = frames[0]   # use first frame (neutral face)
        w, h = img.size
        # Scale 2× for legibility
        scaled = img.resize((w * 2, h * 2), Image.NEAREST)
        out_path = os.path.join(OUT_DIR, f'face_{i:03d}.png')
        scaled.save(out_path)
        extracted.append((i, w, h))
        print(f'  face {i:3d}: {w}×{h} → {out_path}')

    print(f'\nExtracted {len(extracted)} faces.')
    print('Indices:', [x[0] for x in extracted])
