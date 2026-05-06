import Phaser from 'phaser';

export type NpcSkinId = 'noble' | 'guard' | 'mystic' | 'healer' | 'scholar' | 'peasant' | 'gypsy';

export const NPC_SKIN_KEYS: Record<NpcSkinId, string> = {
  noble:   'npc-noble',
  guard:   'npc-guard',
  mystic:  'npc-mystic',
  healer:  'npc-healer',
  scholar: 'npc-scholar',
  peasant: 'npc-peasant',
  gypsy:   'npc-gypsy',
};

// Frame layout matches player sheet: 4 cols × 3 rows, FRAME_W=32, FRAME_H=35
const FW = 32;
const FH = 35;

interface SkinPalette {
  skinTone: number;
  hair:     number;
  body:     number;  // main torso
  bodyLo:   number;  // legs / lower
  accent:   number;  // trim / details
  head:     number;  // helmet / hood / hat (if any)
}

const PALETTES: Record<NpcSkinId, SkinPalette> = {
  noble:   { skinTone:0xf5c890, hair:0xaa8822, body:0x5533aa, bodyLo:0x3322aa, accent:0xddaa22, head:0xddaa22 },
  guard:   { skinTone:0xe8b888, hair:0x664422, body:0x7788aa, bodyLo:0x556677, accent:0x99aabb, head:0x889aaa },
  mystic:  { skinTone:0x888899, hair:0x111122, body:0x11111e, bodyLo:0x11111e, accent:0x2233aa, head:0x11111e },
  healer:  { skinTone:0xf8d0a0, hair:0x553311, body:0x77cc77, bodyLo:0x55aa55, accent:0xffffff, head:0xffffff },
  scholar: { skinTone:0xeec090, hair:0x443322, body:0xaa8844, bodyLo:0x775522, accent:0xeeddcc, head:0x443322 },
  peasant: { skinTone:0xe0aa70, hair:0x553311, body:0xcc9955, bodyLo:0x774422, accent:0xaa7733, head:0x886633 },
  gypsy:   { skinTone:0xf0aa80, hair:0x110000, body:0x993399, bodyLo:0xcc55aa, accent:0xffcc22, head:0xffcc22 },
};

// Walk-phase leg offsets: [leftDX, leftDY, rightDX, rightDY]
const WALK_PHASES: [number,number,number,number][] = [
  [ 0,  0,  0,  0],  // 0 = idle
  [-2, -1,  2,  0],  // 1 = step A
  [ 0,  0,  0,  0],  // 2 = mid
  [ 2,  0, -2, -1],  // 3 = step B
];

function drawFrame(
  g: Phaser.GameObjects.Graphics,
  col: number, row: number,
  p: SkinPalette,
  phase: number,
  dir: 'south' | 'north' | 'east',
  skin: NpcSkinId,
): void {
  const ox = col * FW;
  const oy = row * FH;
  const cx = ox + 16;
  const [lx, ly, rx, ry] = WALK_PHASES[phase];

  // ── LEGS ─────────────────────────────────────────────────────────────────
  g.fillStyle(p.bodyLo, 1);
  if (dir === 'east') {
    g.fillRect(cx - 3 + lx, oy + 24 + ly, 5, 9);
    g.fillRect(cx + 0 + rx, oy + 25 + ry, 5, 8);
  } else {
    g.fillRect(cx - 7 + lx, oy + 24 + ly, 5, 9);
    g.fillRect(cx + 2 + rx, oy + 25 + ry, 5, 8);
  }

  // ── BODY ─────────────────────────────────────────────────────────────────
  g.fillStyle(p.body, 1);
  if (skin === 'mystic') {
    // Wide cloak covering legs
    g.fillRect(cx - 8, oy + 11, 16, 14);
    g.fillRect(cx - 6, oy + 25, 12, 6);
  } else if (skin === 'noble' || skin === 'healer' || skin === 'gypsy') {
    // Robe with hem
    g.fillRect(cx - 7, oy + 12, 14, 13);
    g.fillRect(cx - 5, oy + 25, 10, 5);
  } else {
    // Tunic / armour
    g.fillRect(cx - 7, oy + 12, 14, 14);
  }

  // ── ARMS ─────────────────────────────────────────────────────────────────
  g.fillStyle(p.body, 1);
  if (dir === 'east') {
    g.fillRect(cx + 5, oy + 13, 4, 9);
    g.fillStyle(p.skinTone, 1);
    g.fillRect(cx + 6, oy + 21, 3, 3);
  } else {
    g.fillRect(cx - 10, oy + 13, 4, 9);
    g.fillRect(cx + 6,  oy + 13, 4, 9);
    g.fillStyle(p.skinTone, 1);
    g.fillRect(cx - 10, oy + 21, 3, 3);
    g.fillRect(cx + 7,  oy + 21, 3, 3);
  }

  // ── SKIN ACCENTS / TRIM ──────────────────────────────────────────────────
  switch (skin) {
    case 'noble':
      g.fillStyle(p.accent, 1);
      g.fillRect(cx - 1, oy + 13, 2, 12); // centre stripe
      g.fillRect(cx - 6, oy + 12, 12, 2); // collar band
      break;
    case 'guard':
      g.fillStyle(p.accent, 1);
      g.fillRect(cx - 6, oy + 15, 12, 2); // chest plate
      g.fillRect(cx - 6, oy + 21, 12, 2); // belt
      break;
    case 'healer':
      g.fillStyle(p.accent, 1);
      g.fillRect(cx - 5, oy + 12, 10, 2); // white collar
      if (dir !== 'east') {
        g.fillRect(cx + 3, oy + 16, 3, 5); // satchel
      }
      break;
    case 'scholar':
      g.fillStyle(p.accent, 1);
      g.fillRect(cx - 5, oy + 12, 10, 3); // white stock collar
      if (dir !== 'east') {
        g.fillRect(cx - 9, oy + 16, 2, 6); // rolled scroll under arm
      }
      break;
    case 'gypsy':
      g.fillStyle(p.accent, 1);
      g.fillRect(cx - 6, oy + 21, 12, 2); // belt/sash
      g.fillRect(cx - 4, oy + 12, 8, 2);  // neckline
      break;
  }

  // ── HEAD ─────────────────────────────────────────────────────────────────
  if (skin === 'mystic') {
    g.fillStyle(p.head, 1);
    g.fillRect(cx - 5, oy + 1, 10, 11);  // hood
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(cx - 2, oy + 5, 4, 5);   // shadowed face
    if (dir === 'south') {
      g.fillStyle(0x334455, 1);
      g.fillRect(cx - 1, oy + 7, 1, 1); // faint eye glint left
      g.fillRect(cx + 1, oy + 7, 1, 1); // faint eye glint right
    }
  } else if (skin === 'guard') {
    g.fillStyle(p.head, 1);
    g.fillRect(cx - 5, oy + 2, 10, 9);  // helmet
    g.fillRect(cx - 4, oy + 2, 8, 2);   // helmet ridge
    g.fillStyle(p.skinTone, 1);
    g.fillRect(cx - 3, oy + 6, 6, 4);   // face visor opening
    if (dir === 'south') {
      g.fillStyle(0x222222, 1);
      g.fillRect(cx - 1, oy + 7, 1, 1);
      g.fillRect(cx + 1, oy + 7, 1, 1);
    }
  } else {
    // Bare head
    g.fillStyle(p.skinTone, 1);
    g.fillRect(cx - 4, oy + 4, 8, 8);
    // Hair
    g.fillStyle(p.hair, 1);
    g.fillRect(cx - 4, oy + 4, 8, 3);
    if (dir !== 'north') {
      g.fillRect(cx - 4, oy + 4, 2, 6);
      g.fillRect(cx + 2,  oy + 4, 2, 6);
    } else {
      g.fillRect(cx - 4, oy + 4, 8, 7); // more hair at back
    }
    // Headwear
    switch (skin) {
      case 'noble':
        g.fillStyle(p.accent, 1);
        g.fillRect(cx - 4, oy + 4, 8, 1); // circlet
        g.fillRect(cx - 1, oy + 3, 2, 2); // centre gem
        break;
      case 'scholar':
        g.fillStyle(p.head, 1);
        g.fillRect(cx - 4, oy + 1, 8, 3); // flat cap brim
        g.fillRect(cx - 3, oy + 0, 6, 2); // cap crown
        break;
      case 'peasant':
        g.fillStyle(p.head, 1);
        g.fillRect(cx - 5, oy + 2, 10, 2); // hat brim
        g.fillRect(cx - 3, oy + 0, 6, 3);  // hat crown
        break;
      case 'gypsy':
        g.fillStyle(p.accent, 1);
        g.fillRect(cx - 5, oy + 4, 10, 2); // headscarf band
        g.fillRect(cx + 3,  oy + 5, 3, 4);  // trailing scarf
        break;
    }
    // Face: eyes
    if (dir === 'south') {
      g.fillStyle(0x222222, 1);
      g.fillRect(cx - 2, oy + 8, 1, 1);
      g.fillRect(cx + 1,  oy + 8, 1, 1);
      if (skin === 'scholar') {
        // Tiny spectacle rims
        g.fillStyle(0x224466, 1);
        g.fillRect(cx - 3, oy + 8, 2, 1);
        g.fillRect(cx + 1,  oy + 8, 2, 1);
      }
    }
  }
}

export function buildNpcSprites(scene: Phaser.Scene): void {
  const dirRows: Array<'south' | 'north' | 'east'> = ['south', 'north', 'east'];
  const phases = [0, 1, 2, 3];

  for (const skinId of Object.keys(PALETTES) as NpcSkinId[]) {
    const key = NPC_SKIN_KEYS[skinId];
    const palette = PALETTES[skinId];
    const g = scene.make.graphics();

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        drawFrame(g, col, row, palette, phases[col], dirRows[row], skinId);
      }
    }

    g.generateTexture(key, FW * 4, FH * 3);
    g.destroy();

    // Register animations keyed to this skin texture
    const WFR = 8;
    const mk = (anim: string, frames: number | number[], loop = true) => {
      const animFrames = Array.isArray(frames)
        ? scene.anims.generateFrameNumbers(key, { frames })
        : [{ key, frame: frames as number }];
      scene.anims.create({
        key: `${key}:${anim}`,
        frames: animFrames,
        frameRate: Array.isArray(frames) ? WFR : 1,
        repeat: loop ? -1 : 0,
      });
    };
    mk('idle-south', 0); mk('walk-south', [1,2,3]);
    mk('idle-north', 4); mk('walk-north', [5,6,7]);
    mk('idle-east',  8); mk('walk-east',  [9,10,11]);
    mk('idle-west',  8); mk('walk-west',  [9,10,11]);
  }
}
