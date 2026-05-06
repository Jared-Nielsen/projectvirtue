# Britannia Reborn — Project Context

## Ultima 7 Game File Formats

### FLX Container (all U7 data files)

**Header layout:**
- `0x00–0x4F`: Title/description string (80 bytes)
- `0x50–0x53`: Magic/version bytes
- `0x54–0x57`: `uint32` entry count
- `0x58–0x7F`: **Padding — do NOT use as table base**
- `0x80+`: Entry lookup table (`count × 8` bytes)

Each entry is two `uint32` LE values: `(offset, size)`.

```python
count = struct.unpack_from('<I', data, 0x54)[0]
items = [(struct.unpack_from('<II', data, 0x80 + i * 8)) for i in range(count)]
```

> **Critical:** Using `0x58` instead of `0x80` reads padding bytes as entries — confirmed source of wrong palette colors during FACES.VGA extraction.

---

### PALETTES.FLX

- Entry 0 = main daytime game palette (offset `0x100`, size `768`)
- 256 colors × 3 bytes (R, G, B) in **6-bit VGA format (0–63)**
- Scale to 8-bit: `r8 = r6 * 4`
- Color 0 = transparent/black; skin tones ~180–210

```python
off, _ = items[0]
palette = [(data[off+i*3]*4, data[off+i*3+1]*4, data[off+i*3+2]*4) for i in range(256)]
```

---

### FACES.VGA — NPC Portrait Faces

Standard FLX container; 294 entries (283 non-empty), indices 0–293.

**Entry internal structure:**
```
[0x00–0x03]  uint32  entry_size (self-describing)
[0x04+]      uint32  frame offsets, one per frame, relative to entry start
num_frames = (first_frame_offset - 4) // 4
```

**Frame format:**
```
[+0] uint16 MaxX
[+2] uint16 NegX
[+4] uint16 NegY
[+6] uint16 MaxY
width  = MaxX + NegX + 1
height = MaxY + NegY + 1
```

Followed by span records until `BlockData == 0`:
```
BlockData  uint16   (block_type = BlockData & 1,  block_length = BlockData >> 1)
XStart     int16    signed — column relative to origin
YStart     int16    signed — row relative to origin
```

Image placement: `col = XStart + NegX`, `row = YStart + NegY`

- **BlockType 0 (raw):** read `block_length` palette indices directly
- **BlockType 1 (RLE):** consume `RunData` bytes until `block_length` pixels written
  - `run_type = RunData & 1` (0=literal, 1=repeat)
  - `run_length = RunData >> 1`
  - Literal: read `run_length` indices one by one
  - Repeat: read 1 index, write it `run_length` times

Faces are typically 52×59 px. Frame 0 = neutral expression. Extracted at 2× NEAREST scale.

---

---

### SHAPES.VGA — NPC / Character Body Sprites

Standard FLX container; 1024 entries (0x400). Same `0x80` table offset rule.

**Distinguishing tile shapes from RLE shapes:**
```python
data_len = struct.unpack_from('<I', shape_data, 0)[0]
if data_len != flx_entry_size:
    # TILE SHAPE (indices 0–149): raw 8×8 uncompressed palette indices, no header
else:
    # RLE SHAPE (indices 150+): NPC / object sprite with span encoding
```

**RLE shape entry structure:**
```
[0–3]  uint32  data_length   (equals FLX entry size)
[4–7]  uint32  hdr_length    (= 4 + num_frames × 4)
[8+]   uint32[]  frame offsets — relative to shape_data start (NOT entry start)
num_frames = (hdr_length - 4) // 4
```

**Frame structure** (identical span encoding to FACES.VGA):
```
[+0] uint16 MaxX     — rightmost extent
[+2] uint16 OffsetX  — pixels LEFT of hotspot
[+4] uint16 OffsetY  — pixels ABOVE hotspot
[+6] uint16 MaxY     — bottommost extent
width  = MaxX + OffsetX + 1
height = MaxY + OffsetY + 1
hotspot at pixel (OffsetX, OffsetY)
```

Span records until `BlockData == 0` — byte-for-byte same as FACES.VGA.
Image placement: `col = XStart + OffsetX`, `row = YStart + OffsetY`
Palette index 0 = transparent (skip).

**Animation layout — 32 frames per human NPC shape:**

| Frames | Direction | Notes |
|--------|-----------|-------|
| 0–15   | North     | stored |
| 16–31  | South     | stored |
| —      | West      | mirror of North frames (flip horizontally) |
| —      | East      | mirror of South frames (flip horizontally) |

Walk cycle frame sequence: `0, 1, 0, 2, 0` (idle pose between each step).
Key frames: 0=stand, 1=step-right, 2=step-left, 10=sit, 13=sleep/dead, 15=knocked-out.
South equivalents: add 16 to each index.

**To mirror for East/West:**
```python
from PIL import ImageOps
img_west = ImageOps.mirror(north_frame)
img_east = ImageOps.mirror(south_frame)
```

**Human NPC shape numbers** (TFA class 13, shapes with 32 frames):
- 228–229: male/female base types
- 265, 274, 299, 304, 317–319: common NPC variants
- 445–490: large block of civilian male/female types
- TFA.DAT: 3 bytes per shape; `second_byte & 0x0F == 13` = human NPC

**NPC → shape assignment:** stored in `INITGAME.DAT` FLX entry 0 (embedded `npc.dat`).
Shape packed as `uint16`: bits 0–9 = shape number, bits 10–15 = frame offset.

**Frame header field types (critical):**
```python
maxX       = struct.unpack_from('<h',  sd, fo    )[0]  # signed int16 — can be negative!
offX, offY = struct.unpack_from('<HH', sd, fo + 2)     # unsigned uint16
maxY       = struct.unpack_from('<h',  sd, fo + 6)[0]  # signed int16 — can be negative!
w = maxX + offX + 1
h = maxY + offY + 1
```
`maxX`/`maxY` are **signed** — shapes like 274 store them as −2/−4; reading as uint16 gives 65534 and breaks the bbox.

**Common bugs to avoid:**
- Frame offsets are at bytes 8+ (not 4+); bytes 4–7 are `hdr_length`
- East/West frames are NOT stored — mirror at runtime
- Some frames may be null (offset out-of-bounds or zero-size bbox) — handle gracefully

---

### Extraction Scripts

- `scripts/extract_faces.py` — extracts all FACES.VGA portraits to `public/assets/faces/face_NNN.png`
- Named skin portraits (`portrait_noble.png` etc.) are manually copied from chosen face indices
- Game files expected at `Contents/Resources/game/STATIC/`
