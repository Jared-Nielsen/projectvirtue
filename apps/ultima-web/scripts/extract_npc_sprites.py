#!/usr/bin/env python3
"""
Extract NPC body sprites from Ultima 7 SHAPES.VGA as Phaser-compatible sprite sheets.

Modes:
  python3 extract_npc_sprites.py --preview
      Dumps a contact sheet of the south-standing frame for every human-NPC shape
      (TFA class 13) so you can pick shape numbers for each skin type.

  python3 extract_npc_sprites.py
      Builds one 4-col × 3-row sprite sheet per skin type using SKIN_SHAPES.
      Row 0: South  [stand, walk1, stand, walk2]
      Row 1: North  [stand, walk1, stand, walk2]
      Row 2: East   [stand, walk1, stand, walk2]  (mirrored South)
      West direction = East sheet + flipX in Phaser (not stored separately).

Animation key mapping (matches existing player/npc animation keys):
  idle-south → frame 0   walk-south → [1,2,3]
  idle-north → frame 4   walk-north → [5,6,7]
  idle-east  → frame 8   walk-east  → [9,10,11]
  idle-west  → frame 8   walk-west  → [9,10,11]  (flipX=true)
"""
import struct, sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

GAME_DIR = os.path.join(os.path.dirname(__file__), '../Contents/Resources/game/STATIC')
OUT_DIR  = os.path.join(os.path.dirname(__file__), '../public/assets/npc-sprites')

SCALE = 1   # no upscale — sprites are already the right size for the game

# ── Map skin type → SHAPES.VGA shape number ──────────────────────────────────
# Set after running --preview to inspect the contact sheet.
SKIN_SHAPES: dict[str, int] = {
    'noble':   265,   # red-clad regal male
    'guard':   720,
    'mystic':  274,   # winged demon (intentional)
    'healer':  462,   # redhead female
    'scholar': 861,   # older man in brown tunic
    'peasant': 319,   # plain-clothed common person
    'gypsy':   466,   # colourful purple woman
}

# ── FLX helpers ───────────────────────────────────────────────────────────────
def read_flex(path: str):
    with open(path, 'rb') as f:
        data = f.read()
    count = struct.unpack_from('<I', data, 0x54)[0]
    items = [struct.unpack_from('<II', data, 0x80 + i * 8) for i in range(count)]
    return data, items

def load_palette():
    data, items = read_flex(os.path.join(GAME_DIR, 'PALETTES.FLX'))
    off, _ = items[0]
    return [(data[off+i*3]*4, data[off+i*3+1]*4, data[off+i*3+2]*4) for i in range(256)]

# ── Frame decoder ─────────────────────────────────────────────────────────────
def decode_frame(sd: bytes, fo: int, palette, sz: int):
    """
    Decode one RLE frame from SHAPES.VGA shape_data.
    Returns (image, hotspot_x, hotspot_y) or None.
    Hotspot = (offX, offY): the registration point ("feet") in image space.
    """
    if fo + 8 > sz:
        return None
    maxX         = struct.unpack_from('<h', sd, fo    )[0]  # signed — can be negative
    offX, offY   = struct.unpack_from('<HH', sd, fo+2)      # unsigned extents left/above hotspot
    maxY         = struct.unpack_from('<h', sd, fo + 6)[0]  # signed — can be negative
    w = maxX + offX + 1
    h = maxY + offY + 1
    if w <= 0 or h <= 0 or w > 512 or h > 512:
        return None

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px  = img.load()
    pos = fo + 8

    while pos + 6 <= sz:
        bd = struct.unpack_from('<H', sd, pos)[0]
        if bd == 0:
            break
        bl = bd >> 1
        bt = bd & 1
        xs = struct.unpack_from('<h', sd, pos + 2)[0]
        ys = struct.unpack_from('<h', sd, pos + 4)[0]
        pos += 6
        col  = xs + offX
        row  = ys + offY

        if bt == 0:
            for k in range(bl):
                if pos >= sz: break
                p = sd[pos]; pos += 1
                if p and 0 <= col+k < w and 0 <= row < h:
                    px[col+k, row] = (*palette[p], 255)
        else:
            consumed = x_off = 0
            while consumed < bl:
                if pos >= sz: break
                rd = sd[pos]; pos += 1
                rl = rd >> 1
                rt = rd & 1
                if rt == 0:
                    for k in range(rl):
                        if pos >= sz: break
                        p = sd[pos]; pos += 1
                        c = col + x_off + k
                        if p and 0 <= c < w and 0 <= row < h:
                            px[c, row] = (*palette[p], 255)
                else:
                    if pos >= sz: break
                    p = sd[pos]; pos += 1
                    for k in range(rl):
                        c = col + x_off + k
                        if p and 0 <= c < w and 0 <= row < h:
                            px[c, row] = (*palette[p], 255)
                x_off += rl; consumed += rl

    return img, offX, offY

def add_outline(img, color=(20, 16, 28, 255)):
    """Dilate the alpha mask by 1px to create a dark outline beneath the sprite."""
    alpha = img.split()[3]
    dilated = alpha.filter(ImageFilter.MaxFilter(3))  # 3×3 max = 1px expansion
    outline = Image.new('RGBA', img.size, color)
    outline.putalpha(dilated)
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result.paste(outline, (0, 0), outline)
    result.paste(img, (0, 0), img)
    return result

# ── Shape loader ──────────────────────────────────────────────────────────────
def load_shape_frames(shapes_data, items, shape_num, palette, frame_indices):
    """
    Return dict {frame_index: (img, hx, hy)} for the requested frame indices.
    """
    if shape_num >= len(items):
        return {}
    off, sz = items[shape_num]
    if off == 0 or sz < 12:
        return {}
    sd = shapes_data[off:off+sz]

    data_len = struct.unpack_from('<I', sd, 0)[0]
    if data_len != sz:
        return {}   # tile shape — skip

    hdr_len    = struct.unpack_from('<I', sd, 4)[0]
    num_frames = (hdr_len - 4) // 4

    result = {}
    for fi in frame_indices:
        if fi >= num_frames:
            continue
        fo = struct.unpack_from('<I', sd, 8 + fi * 4)[0]
        dec = decode_frame(sd, fo, palette, sz)
        if dec:
            result[fi] = dec
    return result

# ── TFA.DAT reader ────────────────────────────────────────────────────────────
def load_human_shape_indices() -> list[int]:
    """
    Return all shape indices classified as human NPC (TFA class 13).
    TFA.DAT: 3 bytes per shape; class = second_byte & 0x0F.
    """
    path = os.path.join(GAME_DIR, 'TFA.DAT')
    with open(path, 'rb') as f:
        tfa = f.read()
    human = []
    for i in range(len(tfa) // 3):
        second_byte = tfa[i * 3 + 1]
        if (second_byte & 0x0F) == 13:
            human.append(i)
    return human

# ── Sprite-sheet builder ──────────────────────────────────────────────────────
SOUTH = [16, 17, 18]   # stand, step-R, step-L
NORTH = [0,  1,  2]    # stand, step-R, step-L

def build_sheet(shapes_data, items, shape_num, palette, cell_w: int, cell_h: int):
    """
    Build a 4-col × 3-row RGBA sprite sheet for shape_num.
    Cells per row: [stand, walk1, stand, walk2]
    Row 0 = South, Row 1 = North, Row 2 = East (mirrored South).
    Hotspot aligned to bottom-centre of each cell.
    """
    needed = SOUTH + NORTH
    frames = load_shape_frames(shapes_data, items, shape_num, palette, needed)
    if not frames:
        return None

    sheet = Image.new('RGBA', (cell_w * 4, cell_h * 3), (0, 0, 0, 0))

    # [S-stand, S-walk1, S-stand, S-walk2]  [N-...] [E-... (mirror S)]
    rows = [
        (SOUTH, False),   # row 0: South
        (NORTH, False),   # row 1: North
        (SOUTH, True),    # row 2: East = mirrored South
    ]
    walk_order = [0, 1, 0, 2]  # indices into the 3-frame set

    for row_idx, (frame_set, mirror) in enumerate(rows):
        for col_idx, fi_idx in enumerate(walk_order):
            fi = frame_set[fi_idx]
            if fi not in frames:
                continue
            img, hx, hy = frames[fi]
            if mirror:
                img = ImageOps.mirror(img)
                hx  = img.width - 1 - hx   # flip hotspot X

            # Scale
            sw, sh = img.width * SCALE, img.height * SCALE
            img = img.resize((sw, sh), Image.NEAREST)
            hx *= SCALE; hy *= SCALE

            img = add_outline(img)

            # Place so hotspot lands at (cell_cx, cell_bottom - 2)
            cell_cx     = col_idx * cell_w + cell_w  // 2
            cell_bottom = row_idx * cell_h + cell_h - 2
            paste_x = cell_cx     - hx
            paste_y = cell_bottom - hy

            sheet.paste(img, (paste_x, paste_y), img)

    return sheet

# ── Preview contact sheet ─────────────────────────────────────────────────────
def make_preview(shapes_data, items, palette):
    human = load_human_shape_indices()
    print(f'Found {len(human)} human-NPC shapes (TFA class 13):')
    print(human)

    # Extract south-standing frame (16) for each; measure max size
    extracted = []
    for sn in human:
        frames = load_shape_frames(shapes_data, items, sn, palette, [16, 0])
        fi = 16 if 16 in frames else (0 if 0 in frames else None)
        if fi is None:
            continue
        img, hx, hy = frames[fi]
        sw, sh = img.width * SCALE, img.height * SCALE
        scaled = img.resize((sw, sh), Image.NEAREST)
        extracted.append((sn, scaled, hx * SCALE, hy * SCALE))

    if not extracted:
        print('No valid frames extracted.')
        return

    max_w = max(e[1].width  for e in extracted)
    max_h = max(e[1].height for e in extracted)
    pad   = 4
    lbl   = 14
    cell_w = max_w + pad * 2
    cell_h = max_h + pad * 2 + lbl
    cols   = 16
    rows   = (len(extracted) + cols - 1) // cols

    sheet = Image.new('RGBA', (cols * cell_w, rows * cell_h), (20, 10, 5, 255))

    for idx, (sn, img, hx, hy) in enumerate(extracted):
        cx = (idx % cols) * cell_w
        cy = (idx // cols) * cell_h
        # paste centred in cell
        img = add_outline(img)
        px = cx + (cell_w - img.width)  // 2
        py = cy + (cell_h - img.height - lbl) // 2 + lbl
        sheet.paste(img, (px, py), img)
        # label
        draw = ImageDraw.Draw(sheet)
        draw.text((cx + 2, cy + 1), str(sn), fill=(255, 220, 100))

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, 'preview_human_npcs.png')
    sheet.save(out)
    print(f'\nPreview saved → {out}')
    print(f'Cell size: {cell_w}×{cell_h}  (max sprite: {max_w}×{max_h})')
    print(f'Edit SKIN_SHAPES in this script, then run without --preview to build sprite sheets.')

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    palette = load_palette()
    shapes_data, items = read_flex(os.path.join(GAME_DIR, 'SHAPES.VGA'))

    if '--preview' in sys.argv:
        make_preview(shapes_data, items, palette)
        sys.exit(0)

    # ── Validate SKIN_SHAPES are filled in ───────────────────────────────────
    if any(v == 0 for v in SKIN_SHAPES.values()):
        print('Run with --preview first, then fill in SKIN_SHAPES at the top of this script.')
        sys.exit(1)

    # ── Determine unified cell size across all skin shapes ───────────────────
    all_shape_nums = list(set(SKIN_SHAPES.values()))
    needed = SOUTH + NORTH
    max_right = max_below = 0
    max_left  = max_above = 0
    for sn in all_shape_nums:
        frames = load_shape_frames(shapes_data, items, sn, palette, needed)
        for fi, (img, hx, hy) in frames.items():
            max_right = max(max_right, (img.width  - hx) * SCALE)
            max_below = max(max_below, (img.height - hy) * SCALE)
            max_left  = max(max_left,  hx * SCALE)
            max_above = max(max_above, hy * SCALE)

    cell_w = (max_left  + max_right + 4)
    cell_h = (max_above + max_below + 4)
    # Round up to even numbers
    cell_w += cell_w % 2
    cell_h += cell_h % 2
    print(f'Cell size: {cell_w}×{cell_h}')

    os.makedirs(OUT_DIR, exist_ok=True)

    for skin, sn in SKIN_SHAPES.items():
        sheet = build_sheet(shapes_data, items, sn, palette, cell_w, cell_h)
        if sheet is None:
            print(f'  SKIP {skin} (shape {sn} failed)')
            continue
        out = os.path.join(OUT_DIR, f'{skin}.png')
        sheet.save(out)
        print(f'  {skin}: shape {sn:4d} → {out}  ({cell_w * 4}×{cell_h * 3})')

    print(f'\nDone. Cell size for Phaser: frameWidth={cell_w}, frameHeight={cell_h}')
    print('Update NPC_SHEET_FRAME_W / NPC_SHEET_FRAME_H in GameScene.ts.')
