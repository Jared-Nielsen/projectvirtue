import Phaser from 'phaser';
import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_SPEED, MOUSE_DEAD_ZONE, MOUSE_MAX_DIST,
} from '../constants';
import { TileType, TILE_WALKABLE, TILE_NAMES, TILE_COLORS } from '../world/TileType';
import { generateWorld } from '../world/WorldGen';
import { TILESET_KEY, TILESET_PATH } from '../rendering/TilesetBuilder';
import { buildPlayerAnimations, PLAYER_KEY, PLAYER_PATH, FRAME_W, FRAME_H } from '../rendering/PlayerSpriteBuilder';
import { MusicPlayer } from '../audio/MusicPlayer';
import { ISLANDS_LORE, NpcTopic } from '../world/IslandLore';

interface NpcEntry {
  sprite: Phaser.GameObjects.Sprite;
  name: string;
  tint: number;
  dialogue: string[];
  ambientLines: string[];
  topics: NpcTopic[];
  homeX: number;
  homeY: number;
  wanderState: 'idle' | 'walking';
  targetX: number;
  targetY: number;
  idleTimer: number;
  speechTimer: number;
  facing: 'south' | 'north' | 'east' | 'west';
}

interface TrophyEntry {
  sprite: Phaser.GameObjects.Image;
  id: string;
  name: string;
  description: string;
}

interface WorldObjectEntry {
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
}

const WALL_KEY  = 'castle-wall';
const WALL_PATH = 'assets/wall.png';
const WALL_FRAME_W = 27;
const WALL_FRAME_H = 52;

const TREE_KEY     = 'tree';
const TREE_PATH    = 'assets/tree.png';
const TREE_FRAME_W = 70;
const TREE_FRAME_H = 69;
// frames: 0=leafy bush, 1=leafy large, 2=dead, 3=autumn

const ITEMS_KEY     = 'items';
const ITEMS_PATH    = 'assets/items.png';
const ITEMS_FRAME_W = 62;
const ITEMS_FRAME_H = 41;
// frames: 0=chest, 1=barrel, 2=table

type WASDKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

type Direction = 'south' | 'north' | 'east' | 'west';

export class GameScene extends Phaser.Scene {
  private world!: Uint8Array;
  private playerX = 0;
  private playerY = 0;
  private player!: Phaser.GameObjects.Sprite;
  private facing: Direction = 'south';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;
  private music = new MusicPlayer();
  private musicStarted = false;
  private cursorGfx!: Phaser.GameObjects.Graphics;

  private shipSprite!: Phaser.GameObjects.Image;
  private shipX = 0;
  private shipY = 0;
  private onShip = false;

  private npcSprites: NpcEntry[] = [];
  private trophySprites: Map<string, TrophyEntry> = new Map();
  private collectedTrophies = new Set<string>();
  private nearestNpc: NpcEntry | null = null;

  private dialogueActive = false;
  private dialogueLine = 0;
  private dialogueLines: string[] = [];
  private eKey!: Phaser.Input.Keyboard.Key;
  private dialogueBg!: Phaser.GameObjects.Rectangle;
  private dialogueNameText!: Phaser.GameObjects.Text;
  private dialogueBodyText!: Phaser.GameObjects.Text;
  private dialogueHintText!: Phaser.GameObjects.Text;
  private interactHintText!: Phaser.GameObjects.Text;
  private trophyHudText!: Phaser.GameObjects.Text;

  // Full Ultima-style conversation dialog
  private convOpen = false;
  private convObjects: Phaser.GameObjects.GameObject[] = [];
  private convResponseText: Phaser.GameObjects.Text | null = null;
  private lastClickNpc: NpcEntry | null = null;
  private lastClickTime = 0;

  private clickLabel: Phaser.GameObjects.Text | null = null;
  private clickLabelTween: Phaser.Tweens.Tween | null = null;
  private worldObjects: WorldObjectEntry[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.load.image(TILESET_KEY, TILESET_PATH);
    this.load.spritesheet(PLAYER_KEY, PLAYER_PATH, { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(WALL_KEY,   WALL_PATH,   { frameWidth: WALL_FRAME_W, frameHeight: WALL_FRAME_H });
    this.load.spritesheet(TREE_KEY,   TREE_PATH,   { frameWidth: TREE_FRAME_W, frameHeight: TREE_FRAME_H });
    this.load.spritesheet(ITEMS_KEY,  ITEMS_PATH,  { frameWidth: ITEMS_FRAME_W, frameHeight: ITEMS_FRAME_H });
  }

  create(): void {
    this.world = generateWorld(42);

    const mapData: number[][] = [];
    for (let ty = 0; ty < WORLD_HEIGHT; ty++) {
      const row = new Array<number>(WORLD_WIDTH);
      for (let tx = 0; tx < WORLD_WIDTH; tx++) {
        const t = this.world[ty * WORLD_WIDTH + tx];
        // CastleWall shows as Road (stone floor) underneath the wall sprite
        row[tx] = (t === TileType.CastleWall ? TileType.Road : t) + 1;
      }
      mapData.push(row);
    }

    const map = this.make.tilemap({
      data: mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });

    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0, 1)!;
    map.createLayer(0, tileset, 0, 0)!.setDepth(0);

    this.placeWallSprites();
    this.placeObjects();

    buildPlayerAnimations(this);

    const spawn = this.findSpawn();
    this.playerX = spawn.x * TILE_SIZE + TILE_SIZE / 2;
    this.playerY = spawn.y * TILE_SIZE + TILE_SIZE / 2;

    this.player = this.add.sprite(this.playerX, this.playerY, PLAYER_KEY)
      .setOrigin(0.5, 0.9)
      .setDepth(this.playerY);
    this.player.play('idle-south');

    // No camera bounds — world wraps toroidally

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as WASDKeys;
    this.input.mouse!.disableContextMenu();

    // Music starts on first input to satisfy browser autoplay policy
    const startMusic = () => {
      if (this.musicStarted) return;
      this.musicStarted = true;
      this.music.start();
    };
    this.input.keyboard!.once('keydown', startMusic);
    this.input.once('pointerdown', startMusic);

    this.cursorGfx = this.add.graphics().setDepth(10000).setScrollFactor(0);
    this.game.canvas.style.cursor = 'none';

    this.eKey = this.input.keyboard!.addKey('E');

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.leftButtonDown() || this.convOpen) return;
      this.showClickLabel(ptr);
    });

    this.buildLandmarkTextures();
    this.placeIslandContent();
    this.createHUD();
    this.createShip();
  }

  private placeWallSprites(): void {
    for (let ty = 0; ty < WORLD_HEIGHT; ty++) {
      for (let tx = 0; tx < WORLD_WIDTH; tx++) {
        if (this.world[ty * WORLD_WIDTH + tx] !== TileType.CastleWall) continue;

        // Anchor sprite at the bottom-center of the tile so it rises upward.
        // Depth = tile bottom Y so the player Y-sorts correctly against walls.
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = (ty + 1) * TILE_SIZE;
        this.add.sprite(wx, wy, WALL_KEY, 0)
          .setOrigin(0.5, 1.0)
          .setDepth(wy);
      }
    }
  }

  private placeObjects(): void {
    // Tiny seeded LCG so object scatter is deterministic
    let s = 1337;
    const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0xFFFFFFFF; };

    // ── scatter trees on terrain tiles ──────────────────────────────────────
    const density: Partial<Record<TileType, number>> = {
      [TileType.DenseForest]: 0.05,
      [TileType.Forest]:      0.03,
      [TileType.DarkGrass]:   0.009,
      [TileType.LightGrass]:  0.005,
      [TileType.Hills]:       0.007,
    };

    const TREE_LABELS = ['Shrub', 'Oak Tree', 'Dead Tree', 'Autumn Tree'];
    const TREE_COLORS = [0x88cc44, 0x55aa33, 0x998855, 0xcc7722];

    for (let ty = 0; ty < WORLD_HEIGHT; ty++) {
      for (let tx = 0; tx < WORLD_WIDTH; tx++) {
        const t = this.world[ty * WORLD_WIDTH + tx] as TileType;
        const d = density[t];
        if (!d) { rand(); continue; }
        if (rand() > d) continue;
        const frame = Math.floor(rand() * 4);
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = (ty + 1) * TILE_SIZE;
        this.add.image(wx, wy, TREE_KEY, frame).setOrigin(0.5, 1.0).setDepth(wy);
        // Visual centre is half the frame height above the base
        this.worldObjects.push({
          x: wx, y: wy - TREE_FRAME_H / 2,
          radius: TREE_FRAME_H / 2,
          label: TREE_LABELS[frame], color: TREE_COLORS[frame],
        });
      }
    }

    // ── castle interior items ────────────────────────────────────────────────
    const ox = Math.floor(WORLD_WIDTH  / 2) - 6;
    const oy = Math.floor(WORLD_HEIGHT / 2) - 4;

    const ITEM_LABELS = ['Treasure Chest', 'Barrel', 'Table'];
    const ITEM_COLORS = [0xddaa33, 0x995533, 0xbbaa77];

    const place = (relX: number, relY: number, key: string, frame: number) => {
      const wx = (ox + relX) * TILE_SIZE + TILE_SIZE / 2;
      const wy = (oy + relY + 1) * TILE_SIZE;
      this.add.image(wx, wy, key, frame).setOrigin(0.5, 1.0).setDepth(wy);
      this.worldObjects.push({
        x: wx, y: wy - ITEMS_FRAME_H / 2,
        radius: ITEMS_FRAME_H / 2,
        label: ITEM_LABELS[frame], color: ITEM_COLORS[frame],
      });
    };

    place(3,  3, ITEMS_KEY, 0);  // chest — inside the keep
    place(10, 2, ITEMS_KEY, 0);  // chest — east courtyard corner
    place(2,  6, ITEMS_KEY, 1);  // barrel — west wall
    place(10, 5, ITEMS_KEY, 1);  // barrel — east side
    place(7,  4, ITEMS_KEY, 2);  // table  — courtyard centre
  }

  private findSpawn(): { x: number; y: number } {
    const cx = Math.floor(WORLD_WIDTH / 2);
    const cy = Math.floor(WORLD_HEIGHT / 2);

    for (let r = 0; r < 160; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) continue;
          if (TILE_WALKABLE[this.world[ty * WORLD_WIDTH + tx]]) return { x: tx, y: ty };
        }
      }
    }
    return { x: cx, y: cy };
  }

  update(_time: number, delta: number): void {
    if (this.convOpen) { this.drawCursor(); return; }

    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;
    const keyboardActive = left || right || up || down;

    let vx = 0;
    let vy = 0;
    let speed = PLAYER_SPEED;

    const anchorX = this.onShip ? this.shipX : this.playerX;
    const anchorY = this.onShip ? this.shipY : this.playerY;

    if (keyboardActive) {
      if (left)  vx -= 1;
      if (right) vx += 1;
      if (up)    vy -= 1;
      if (down)  vy += 1;
      if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    } else if (this.input.mousePointer.rightButtonDown()) {
      const ptr   = this.input.mousePointer;
      const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const dx    = world.x - anchorX;
      const dy    = world.y - anchorY;
      const dist  = Math.sqrt(dx * dx + dy * dy);

      if (dist > MOUSE_DEAD_ZONE) {
        vx    = dx / dist;
        vy    = dy / dist;
        const t = Math.min(1, (dist - MOUSE_DEAD_ZONE) / (MOUSE_MAX_DIST - MOUSE_DEAD_ZONE));
        speed = PLAYER_SPEED * t * t;
      }
    }

    const dt     = delta / 1000;
    const moving = vx !== 0 || vy !== 0;

    if (this.onShip) {
      // ── ship movement ──────────────────────────────────────────────────────
      const sx = this.shipX + vx * speed * 0.55 * dt;
      const sy = this.shipY + vy * speed * 0.55 * dt;

      const movedX = this.canShipMoveTo(sx, this.shipY);
      const movedY = this.canShipMoveTo(this.shipX, sy);
      if (movedX) this.shipX = sx;
      if (movedY) this.shipY = sy;

      // Disembark: blocked in all axes and adjacent land is walkable
      if (moving && !movedX && !movedY) {
        const lx = this.shipX + vx * TILE_SIZE * 2;
        const ly = this.shipY + vy * TILE_SIZE * 2;
        if (this.canMoveTo(lx, ly)) {
          this.playerX = lx;
          this.playerY = ly;
          this.onShip = false;
        }
      }

      // Toroidal wrap for ship
      const sWW = WORLD_WIDTH  * TILE_SIZE;
      const sWH = WORLD_HEIGHT * TILE_SIZE;
      this.shipX = ((this.shipX % sWW) + sWW) % sWW;
      this.shipY = ((this.shipY % sWH) + sWH) % sWH;

      if (this.onShip) {
        this.playerX = this.shipX;
        this.playerY = this.shipY;
      }
    } else {
      // ── land movement ──────────────────────────────────────────────────────
      const newX = this.playerX + vx * speed * dt;
      const newY = this.playerY + vy * speed * dt;

      if (this.canMoveTo(newX, this.playerY)) this.playerX = newX;
      if (this.canMoveTo(this.playerX, newY)) this.playerY = newY;

      // Toroidal wrap
      const WW = WORLD_WIDTH  * TILE_SIZE;
      const WH = WORLD_HEIGHT * TILE_SIZE;
      this.playerX = ((this.playerX % WW) + WW) % WW;
      this.playerY = ((this.playerY % WH) + WH) % WH;

      // Board ship when close enough
      if (Math.hypot(this.playerX - this.shipX, this.playerY - this.shipY) < TILE_SIZE * 1.2) {
        this.onShip = true;
        this.playerX = this.shipX;
        this.playerY = this.shipY;
      }
    }

    // ── facing + animation ──────────────────────────────────────────────────
    if (!this.onShip) {
      if (moving) {
        if (Math.abs(vx) >= Math.abs(vy)) {
          this.facing = vx > 0 ? 'east' : 'west';
        } else {
          this.facing = vy > 0 ? 'south' : 'north';
        }
      }
      const animKey = moving ? `walk-${this.facing}` : `idle-${this.facing}`;
      if (this.player.anims.currentAnim?.key !== animKey) this.player.play(animKey);
      this.player.setFlipX(this.facing === 'west');
    }

    // ── ship sprite ─────────────────────────────────────────────────────────
    this.shipSprite.setPosition(this.shipX, this.shipY);
    this.shipSprite.setDepth(this.shipY - 1);
    this.player.setVisible(!this.onShip);

    // ── camera + player sprite ───────────────────────────────────────────────
    this.player.setPosition(this.playerX, this.playerY);
    this.player.setDepth(this.playerY);

    const camX = this.onShip ? this.shipX : this.playerX;
    const camY = this.onShip ? this.shipY : this.playerY;
    this.cameras.main.setScroll(
      camX - CANVAS_WIDTH  / 2,
      camY - CANVAS_HEIGHT / 2,
    );

    this.updateNpcs(delta);
    this.checkInteractions();

    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      if (this.dialogueActive) {
        this.advanceDialogue();
      } else if (this.nearestNpc) {
        this.openDialogue(this.nearestNpc.name, this.nearestNpc.dialogue);
      }
    }

    this.drawCursor();
  }

  private createShip(): void {
    const W = 24, H = 44;
    const g = this.make.graphics();

    // Hull shadow
    g.fillStyle(0x1a0a00, 1);
    g.fillEllipse(W / 2 + 1, H / 2 + 1, W, H);

    // Hull body
    g.fillStyle(0x3d2008, 1);
    g.fillEllipse(W / 2, H / 2, W, H);

    // Deck planking
    g.fillStyle(0x7a4c20, 1);
    g.fillEllipse(W / 2, H / 2, W - 4, H - 6);

    // Deck highlight stripe
    g.fillStyle(0x9a6030, 1);
    g.fillRect(W / 2 - 2, 6, 4, H - 12);

    // Main sail
    g.fillStyle(0xd8cfa0, 1);
    g.fillRect(W / 2 - 7, 10, 14, 14);

    // Fore sail
    g.fillStyle(0xd8cfa0, 1);
    g.fillRect(W / 2 - 4, H - 22, 8, 9);

    // Mast (vertical, on top of sail)
    g.fillStyle(0x1a0a04, 1);
    g.fillRect(W / 2 - 1, 4, 2, H - 8);

    // Yardarm (crossbar)
    g.fillStyle(0x1a0a04, 1);
    g.fillRect(W / 2 - 8, 14, 16, 1);

    g.generateTexture('ship', W, H);
    g.destroy();

    const spawn = this.findShipSpawn();
    this.shipX = spawn.x;
    this.shipY = spawn.y;

    this.shipSprite = this.add.image(this.shipX, this.shipY, 'ship')
      .setOrigin(0.5, 0.5)
      .setDepth(this.shipY - 1);
  }

  private findShipSpawn(): { x: number; y: number } {
    const isWaterTile = (tx: number, ty: number) => {
      const ttx = ((tx % WORLD_WIDTH)  + WORLD_WIDTH)  % WORLD_WIDTH;
      const tty = ((ty % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;
      const t = this.world[tty * WORLD_WIDTH + ttx];
      return t === TileType.DeepOcean || t === TileType.ShallowWater;
    };

    // BFS from a candidate tile; if we reach 400+ connected water tiles it's open ocean not a lake
    const isOcean = (startTx: number, startTy: number): boolean => {
      const visited = new Set<number>();
      const queue: number[] = [startTy * WORLD_WIDTH + startTx];
      visited.add(queue[0]);
      let head = 0;
      while (head < queue.length) {
        if (visited.size >= 400) return true;
        const key = queue[head++];
        const tx = key % WORLD_WIDTH, ty = Math.floor(key / WORLD_WIDTH);
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
          const nx = ((tx+dx) % WORLD_WIDTH  + WORLD_WIDTH)  % WORLD_WIDTH;
          const ny = ((ty+dy) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
          const nk = ny * WORLD_WIDTH + nx;
          if (!visited.has(nk) && isWaterTile(nx, ny)) { visited.add(nk); queue.push(nk); }
        }
      }
      return false;
    };

    const cx = Math.floor(WORLD_WIDTH  / 2);
    const cy = Math.floor(WORLD_HEIGHT / 2) + 8;
    for (let r = 1; r < 240; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (isWaterTile(tx, ty) && isOcean(tx, ty)) {
            return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
          }
        }
      }
    }
    return { x: cx * TILE_SIZE, y: cy * TILE_SIZE };
  }

  private canShipMoveTo(cx: number, cy: number): boolean {
    for (const [px, py] of [[cx,cy],[cx-4,cy-4],[cx+4,cy-4],[cx-4,cy+4],[cx+4,cy+4]] as [number,number][]) {
      const t = this.tileAt(px, py);
      if (t !== TileType.DeepOcean && t !== TileType.ShallowWater) return false;
    }
    return true;
  }

  private drawCursor(): void {
    const ptr = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const dx = world.x - this.playerX;
    const dy = world.y - this.playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.cursorGfx.clear();

    if (dist < MOUSE_DEAD_ZONE) {
      // Too close — small crosshair dot
      this.cursorGfx.fillStyle(0x000000, 1);
      this.cursorGfx.fillRect(ptr.x - 1, ptr.y - 1, 3, 3);
      this.cursorGfx.fillStyle(0x00ff00, 1);
      this.cursorGfx.fillRect(ptr.x, ptr.y, 1, 1);
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const t = Math.min(1, (dist - MOUSE_DEAD_ZONE) / (MOUSE_MAX_DIST - MOUSE_DEAD_ZONE));

    // Shaft grows from 2 to 8 game pixels with distance
    const shaftLen = 2 + t * 6;
    const headLen  = 4;
    const headHalf = 2.5;

    const tipX  = ptr.x;
    const tipY  = ptr.y;
    const baseX = tipX - nx * (shaftLen + headLen);
    const baseY = tipY - ny * (shaftLen + headLen);

    // Arrowhead base centre and wing offsets
    const hbx = tipX - nx * headLen;
    const hby = tipY - ny * headLen;
    const lx = hbx - ny * headHalf;
    const ly = hby + nx * headHalf;
    const rx = hbx + ny * headHalf;
    const ry = hby - nx * headHalf;

    // Black outline (3px shaft, filled head)
    this.cursorGfx.lineStyle(3, 0x000000, 1);
    this.cursorGfx.beginPath();
    this.cursorGfx.moveTo(baseX, baseY);
    this.cursorGfx.lineTo(hbx, hby);
    this.cursorGfx.strokePath();
    this.cursorGfx.fillStyle(0x000000, 1);
    this.cursorGfx.fillTriangle(tipX, tipY, lx, ly, rx, ry);

    // White fill on top (1px shaft, slightly smaller head)
    this.cursorGfx.lineStyle(1, 0x00ff00, 1);
    this.cursorGfx.beginPath();
    this.cursorGfx.moveTo(baseX, baseY);
    this.cursorGfx.lineTo(hbx, hby);
    this.cursorGfx.strokePath();
    const s = 0.6;
    this.cursorGfx.fillStyle(0x00ff00, 1);
    this.cursorGfx.fillTriangle(
      tipX, tipY,
      hbx - ny * headHalf * s, hby + nx * headHalf * s,
      hbx + ny * headHalf * s, hby - nx * headHalf * s,
    );
  }

  // Tile lookup with toroidal wrapping
  private tileAt(wx: number, wy: number): TileType {
    const tx = ((Math.floor(wx / TILE_SIZE) % WORLD_WIDTH)  + WORLD_WIDTH)  % WORLD_WIDTH;
    const ty = ((Math.floor(wy / TILE_SIZE) % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;
    return this.world[ty * WORLD_WIDTH + tx] as TileType;
  }

  private canMoveTo(x: number, y: number): boolean {
    const hw = 3, hh = 4;
    for (const [px, py] of [[x,y],[x-hw,y-hh],[x+hw,y-hh],[x-hw,y+hh],[x+hw,y+hh]]) {
      if (!TILE_WALKABLE[this.tileAt(px, py)]) return false;
    }
    return true;
  }

  private showClickLabel(ptr: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);

    // NPCs
    for (const npc of this.npcSprites) {
      if (Math.hypot(world.x - npc.sprite.x, world.y - npc.sprite.y) < TILE_SIZE * 1.5) {
        this.displayLabel(ptr.x, ptr.y, npc.name, npc.tint);
        return;
      }
    }

    // Ship
    if (Math.hypot(world.x - this.shipX, world.y - this.shipY) < TILE_SIZE * 1.8) {
      this.displayLabel(ptr.x, ptr.y, 'Your Ship', 0xa06030);
      return;
    }

    // Trophies
    for (const [, entry] of this.trophySprites) {
      if (Math.hypot(world.x - entry.sprite.x, world.y - entry.sprite.y) < TILE_SIZE * 1.2) {
        this.displayLabel(ptr.x, ptr.y, entry.name, 0xffdd44);
        return;
      }
    }

    // World objects: trees, items, landmarks
    let closest: WorldObjectEntry | null = null;
    let closestDist = Infinity;
    for (const wo of this.worldObjects) {
      const d = Math.hypot(world.x - wo.x, world.y - wo.y);
      if (d < wo.radius && d < closestDist) { closestDist = d; closest = wo; }
    }
    if (closest) {
      this.displayLabel(ptr.x, ptr.y, closest.label, closest.color);
      return;
    }

    // Terrain tile
    const tile    = this.tileAt(world.x, world.y);
    const name    = TILE_NAMES[tile]  ?? 'Unknown';
    const color   = TILE_COLORS[tile] ?? 0xffffff;
    this.displayLabel(ptr.x, ptr.y, name, color);
  }

  private displayLabel(sx: number, sy: number, text: string, color: number): void {
    // Kill any previous label immediately
    if (this.clickLabelTween) { this.clickLabelTween.stop(); this.clickLabelTween = null; }
    if (this.clickLabel)      { this.clickLabel.destroy();   this.clickLabel = null; }

    // Brighten very dark colours so text is legible on the dark background
    const r = (color >> 16) & 0xff;
    const g = (color >>  8) & 0xff;
    const b =  color        & 0xff;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const displayColor = luminance < 80
      ? ((Math.min(r + 120, 255) << 16) | (Math.min(g + 120, 255) << 8) | Math.min(b + 120, 255))
      : color;
    const hex = '#' + displayColor.toString(16).padStart(6, '0');

    const lx = Phaser.Math.Clamp(sx, 50, CANVAS_WIDTH - 50);
    const ly = Math.max(sy - 16, 16);

    this.clickLabel = this.add.text(lx, ly, text, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: hex,
      stroke: '#000000',
      strokeThickness: 3,
      padding: { x: 5, y: 3 },
      backgroundColor: '#000000bb',
    }).setScrollFactor(0).setDepth(9850).setOrigin(0.5, 1).setAlpha(1);

    this.clickLabelTween = this.tweens.add({
      targets: this.clickLabel,
      y: ly - 14,
      alpha: 0,
      delay: 1400,
      duration: 500,
      onComplete: () => {
        this.clickLabel?.destroy();
        this.clickLabel = null;
        this.clickLabelTween = null;
      },
    });
  }

  private buildLandmarkTextures(): void {
    // monolith: thin dark standing stone
    {
      const g = this.make.graphics();
      g.fillStyle(0x222233, 1);
      g.fillRect(1, 0, 4, 22);
      g.fillStyle(0x4444aa, 1);
      g.fillRect(1, 0, 1, 20);  // left highlight
      g.fillStyle(0x111122, 1);
      g.fillRect(4, 2, 1, 18);  // right shadow
      g.fillStyle(0x333344, 1);
      g.fillRect(0, 18, 6, 4);  // base
      g.generateTexture('lm-monolith', 6, 22);
      g.destroy();
    }
    // altar: wide flat stone slab with rune marks
    {
      const g = this.make.graphics();
      g.fillStyle(0x776655, 1);
      g.fillRect(0, 4, 22, 8);
      g.fillStyle(0x998877, 1);
      g.fillRect(0, 4, 22, 3);  // top highlight
      g.fillStyle(0x554433, 1);
      g.fillRect(0, 9, 22, 3);  // bottom shadow
      g.fillStyle(0xaa9966, 1);
      g.fillRect(3, 5, 2, 2);
      g.fillRect(10, 5, 2, 2);
      g.fillRect(17, 5, 2, 2);
      g.generateTexture('lm-altar', 22, 12);
      g.destroy();
    }
    // tower: cylindrical fortress tower with battlements
    {
      const g = this.make.graphics();
      g.fillStyle(0x887766, 1);
      for (let bx = 0; bx <= 8; bx += 4) g.fillRect(bx, 0, 3, 3);
      g.fillStyle(0x998877, 1);
      g.fillRect(0, 3, 14, 23);
      g.fillStyle(0xbbaa99, 1);
      g.fillRect(1, 3, 3, 23);  // left highlight
      g.fillStyle(0x776655, 1);
      g.fillRect(11, 3, 3, 23); // right shadow
      g.fillStyle(0x1a1210, 1);
      g.fillRect(5, 10, 4, 6);  // window
      g.generateTexture('lm-tower', 14, 26);
      g.destroy();
    }
    // hut: small peaked-roof dwelling
    {
      const g = this.make.graphics();
      g.fillStyle(0x886644, 1);
      g.fillTriangle(10, 0, 0, 8, 20, 8);
      g.fillStyle(0xaa8855, 1);
      g.fillTriangle(10, 1, 1, 8, 10, 8);  // roof highlight
      g.fillStyle(0xccbb99, 1);
      g.fillRect(1, 8, 18, 10);
      g.fillStyle(0xddccaa, 1);
      g.fillRect(1, 8, 4, 10);  // wall highlight
      g.fillStyle(0x664422, 1);
      g.fillRect(8, 11, 5, 7);  // door
      g.generateTexture('lm-hut', 20, 18);
      g.destroy();
    }
    // dome: rounded mystical dome building
    {
      const g = this.make.graphics();
      g.fillStyle(0x997799, 1);
      g.fillEllipse(11, 7, 22, 14);
      g.fillStyle(0xbbaacc, 1);
      g.fillEllipse(9, 5, 12, 8);   // highlight
      g.fillStyle(0x776677, 1);
      g.fillRect(0, 9, 22, 7);      // lower half flat
      g.fillStyle(0x887788, 1);
      g.fillRect(1, 10, 20, 6);
      g.fillStyle(0x221133, 1);
      g.fillEllipse(11, 16, 6, 6);  // doorway
      g.generateTexture('lm-dome', 22, 16);
      g.destroy();
    }
    // ruins-circle: collapsed stone blocks
    {
      const g = this.make.graphics();
      g.fillStyle(0x998877, 1);
      g.fillRect(0, 4, 7, 8);
      g.fillRect(9, 2, 6, 10);
      g.fillRect(17, 5, 7, 7);
      g.fillStyle(0xbbaa99, 1);
      g.fillRect(0, 4, 7, 2);
      g.fillRect(9, 2, 6, 2);
      g.fillRect(17, 5, 7, 2);
      g.fillStyle(0x554433, 1);
      g.fillRect(0, 9, 7, 3);
      g.fillRect(17, 9, 7, 3);
      g.generateTexture('lm-ruins-circle', 24, 12);
      g.destroy();
    }
    // trophy gem: white diamond shape (tinted per trophy)
    {
      const g = this.make.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(5, 0, 0, 5, 10, 5);   // top half bright
      g.fillStyle(0xaaaaaa, 1);
      g.fillTriangle(5, 10, 0, 5, 10, 5);  // bottom half dark
      g.fillStyle(0xdddddd, 1);
      g.fillTriangle(5, 0, 0, 5, 5, 5);    // left facet highlight
      g.generateTexture('trophy-gem', 10, 10);
      g.destroy();
    }
  }

  private placeIslandContent(): void {
    const isLandTile = (tx: number, ty: number): boolean => {
      const ttx = ((tx % WORLD_WIDTH)  + WORLD_WIDTH)  % WORLD_WIDTH;
      const tty = ((ty % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;
      const t = this.world[tty * WORLD_WIDTH + ttx] as TileType;
      return t !== TileType.DeepOcean && t !== TileType.ShallowWater;
    };
    const isWalkableTile = (tx: number, ty: number): boolean => {
      const ttx = ((tx % WORLD_WIDTH)  + WORLD_WIDTH)  % WORLD_WIDTH;
      const tty = ((ty % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;
      return TILE_WALKABLE[this.world[tty * WORLD_WIDTH + ttx] as TileType];
    };

    for (const islandDef of ISLANDS_LORE) {
      const cx = Math.floor(islandDef.nx * WORLD_WIDTH);
      const cy = Math.floor(islandDef.ny * WORLD_HEIGHT);

      const LANDMARK_INFO: Record<string, { label: string; color: number; h: number }> = {
        'monolith':     { label: 'Standing Stone', color: 0x8888cc, h: 22 },
        'altar':        { label: 'Stone Altar',    color: 0xbbaa77, h: 12 },
        'tower':        { label: 'Watch Tower',    color: 0xaa9977, h: 26 },
        'hut':          { label: 'Dwelling',       color: 0xddbb88, h: 18 },
        'dome':         { label: 'Mystical Dome',  color: 0xbb99cc, h: 16 },
        'ruins-circle': { label: 'Fallen Stones',  color: 0x998877, h: 12 },
      };

      for (const lm of islandDef.landmarks) {
        const tx = cx + lm.dx;
        const ty = cy + lm.dy;
        if (!isLandTile(tx, ty)) continue;
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = (ty + 1) * TILE_SIZE;
        this.add.image(wx, wy, `lm-${lm.type}`).setOrigin(0.5, 1.0).setDepth(wy);
        const info = LANDMARK_INFO[lm.type];
        if (info) {
          this.worldObjects.push({
            x: wx, y: wy - info.h / 2,
            radius: Math.max(info.h / 2, TILE_SIZE),
            label: info.label, color: info.color,
          });
        }
      }

      for (const npc of islandDef.npcs) {
        const tx = cx + npc.dx;
        const ty = cy + npc.dy;
        if (!isWalkableTile(tx, ty)) continue;
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        const sprite = this.add.sprite(wx, wy, PLAYER_KEY, 0)
          .setOrigin(0.5, 0.9)
          .setTint(npc.tint)
          .setDepth(wy)
          .setInteractive({ useHandCursor: true });

        const entry: NpcEntry = {
          sprite,
          name: npc.name,
          tint: npc.tint,
          dialogue: npc.dialogue,
          ambientLines: npc.ambientLines,
          topics: npc.topics,
          homeX: wx,
          homeY: wy,
          wanderState: 'idle',
          targetX: wx,
          targetY: wy,
          idleTimer: 1000 + Math.random() * 3000,
          speechTimer: 6000 + Math.random() * 12000,
          facing: 'south',
        };

        sprite.on('pointerdown', () => {
          if (this.convOpen) return;
          const now = this.time.now;
          if (this.lastClickNpc === entry && now - this.lastClickTime < 450) {
            this.openConversation(entry);
            this.lastClickNpc = null;
          } else {
            this.lastClickNpc = entry;
            this.lastClickTime = now;
          }
        });

        this.npcSprites.push(entry);
      }

      if (islandDef.trophy) {
        // Place trophy two tiles east and two south of island center
        const tx = cx + 2;
        const ty = cy + 2;
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        const sprite = this.add.image(wx, wy, 'trophy-gem')
          .setOrigin(0.5, 0.5)
          .setTint(islandDef.trophy.tint)
          .setDepth(wy + 50);
        this.tweens.add({
          targets: sprite,
          scaleX: 1.4, scaleY: 1.4,
          yoyo: true, repeat: -1,
          duration: 900,
          ease: 'Sine.easeInOut',
        });
        this.trophySprites.set(islandDef.trophy.id, {
          sprite,
          id: islandDef.trophy.id,
          name: islandDef.trophy.name,
          description: islandDef.trophy.description,
        });
      }
    }
  }

  private createHUD(): void {
    const dlgTop = CANVAS_HEIGHT - 42;
    const dlgH   = 38;

    this.dialogueBg = this.add.rectangle(
      CANVAS_WIDTH / 2, dlgTop + dlgH / 2,
      CANVAS_WIDTH - 6, dlgH,
      0x000000, 0.88,
    ).setScrollFactor(0).setDepth(9990).setVisible(false);

    this.dialogueNameText = this.add.text(8, dlgTop + 3, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#ffdd44',
    }).setScrollFactor(0).setDepth(9991).setVisible(false);

    this.dialogueBodyText = this.add.text(8, dlgTop + 14, '', {
      fontSize: '7px', fontFamily: 'monospace', color: '#ffffff',
      wordWrap: { width: CANVAS_WIDTH - 16 },
    }).setScrollFactor(0).setDepth(9991).setVisible(false);

    this.dialogueHintText = this.add.text(CANVAS_WIDTH - 6, dlgTop + dlgH - 9, 'E:next', {
      fontSize: '6px', fontFamily: 'monospace', color: '#888888',
    }).setScrollFactor(0).setDepth(9991).setOrigin(1, 0).setVisible(false);

    this.interactHintText = this.add.text(CANVAS_WIDTH / 2, 6, '', {
      fontSize: '7px', fontFamily: 'monospace', color: '#88ff88',
    }).setScrollFactor(0).setDepth(9991).setOrigin(0.5, 0).setVisible(false);

    this.trophyHudText = this.add.text(CANVAS_WIDTH - 4, 4, 'Relics: 0/5', {
      fontSize: '7px', fontFamily: 'monospace', color: '#ffdd44',
    }).setScrollFactor(0).setDepth(9991).setOrigin(1, 0);
  }

  private checkInteractions(): void {
    if (this.onShip || this.dialogueActive) {
      this.interactHintText.setVisible(false);
      return;
    }

    // Trophy proximity: walk over to collect
    for (const [id, entry] of this.trophySprites) {
      const dist = Math.hypot(this.playerX - entry.sprite.x, this.playerY - entry.sprite.y);
      if (dist < TILE_SIZE * 1.2) {
        this.collectTrophy(id, entry);
        break;
      }
    }

    // Nearest NPC within interaction radius
    let nearest: NpcEntry | null = null;
    let nearestDist = 26;
    for (const npc of this.npcSprites) {
      const dist = Math.hypot(this.playerX - npc.sprite.x, this.playerY - npc.sprite.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = npc; }
    }
    this.nearestNpc = nearest;
    if (nearest) {
      this.interactHintText.setText(`E: ${nearest.name}`).setVisible(true);
    } else {
      this.interactHintText.setVisible(false);
    }
  }

  private collectTrophy(id: string, entry: TrophyEntry): void {
    this.collectedTrophies.add(id);
    this.trophySprites.delete(id);
    this.tweens.killTweensOf(entry.sprite);
    entry.sprite.destroy();
    this.trophyHudText.setText(`Relics: ${this.collectedTrophies.size}/5`);
    this.showNotification(`Obtained: ${entry.name}`);
  }

  private showNotification(text: string): void {
    const notif = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 24, text, {
      fontSize: '7px', fontFamily: 'monospace', color: '#ffdd44',
      backgroundColor: '#000000', padding: { x: 4, y: 2 },
    }).setScrollFactor(0).setDepth(9995).setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: notif,
      alpha: 0,
      delay: 1600,
      duration: 600,
      onComplete: () => notif.destroy(),
    });
  }

  private updateNpcs(delta: number): void {
    const SPEED = 64;
    const RANGE = 64;
    const dt    = delta / 1000;

    for (const npc of this.npcSprites) {
      npc.speechTimer -= delta;
      if (npc.speechTimer <= 0) {
        npc.speechTimer = 14000 + Math.random() * 16000;
        if (!this.dialogueActive) this.showSpeechBubble(npc);
      }
      if (this.dialogueActive) continue;

      // Always show idle animation while idling
      if (npc.wanderState === 'idle') {
        const idleAnim = `idle-${npc.facing}`;
        if (npc.sprite.anims.currentAnim?.key !== idleAnim) npc.sprite.play(idleAnim);
        npc.idleTimer -= delta;
        if (npc.idleTimer > 0) continue;

        // Pick a wander target relative to home
        const angle     = Math.random() * Math.PI * 2;
        const radius    = 24 + Math.random() * (RANGE - 24);
        npc.targetX     = npc.homeX + Math.cos(angle) * radius;
        npc.targetY     = npc.homeY + Math.sin(angle) * radius;
        npc.wanderState = 'walking';
      }

      // Walking state
      const dx   = npc.targetX - npc.sprite.x;
      const dy   = npc.targetY - npc.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        npc.wanderState = 'idle';
        npc.idleTimer   = 1000 + Math.random() * 3000;
        continue;
      }

      const nx = npc.sprite.x + (dx / dist) * SPEED * dt;
      const ny = npc.sprite.y + (dy / dist) * SPEED * dt;

      const canX  = this.canMoveTo(nx, npc.sprite.y);
      const canY  = this.canMoveTo(npc.sprite.x, ny);
      const prevX = npc.sprite.x;
      const prevY = npc.sprite.y;

      if (canX) npc.sprite.x = nx;
      if (canY) npc.sprite.y = ny;

      // Only register as "moved" when the position actually changed meaningfully.
      // Without this check, canMoveTo(nx, sprite.y) returns true even when vx≈0
      // (because nx≈sprite.x is already a valid position), causing the walk
      // animation to play with no visible displacement.
      const moved = Math.abs(npc.sprite.x - prevX) + Math.abs(npc.sprite.y - prevY) > 0.3;

      if (!moved) {
        // Stuck — abandon this target and idle briefly before picking another
        npc.wanderState = 'idle';
        npc.idleTimer   = 400 + Math.random() * 600;
        continue;
      }

      if (Math.abs(dx) >= Math.abs(dy)) {
        npc.facing = dx > 0 ? 'east' : 'west';
      } else {
        npc.facing = dy > 0 ? 'south' : 'north';
      }
      npc.sprite.setFlipX(npc.facing === 'west');
      npc.sprite.setDepth(npc.sprite.y);

      const walkAnim = `walk-${npc.facing}`;
      if (npc.sprite.anims.currentAnim?.key !== walkAnim) npc.sprite.play(walkAnim);
    }
  }

  private showSpeechBubble(npc: NpcEntry): void {
    if (npc.ambientLines.length === 0) return;
    const line   = npc.ambientLines[Math.floor(Math.random() * npc.ambientLines.length)];
    const bx     = npc.sprite.x;
    const by     = npc.sprite.y - 18;
    const bubble = this.add.text(bx, by, line, {
      fontSize: '6px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#111111',
      padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setDepth(npc.sprite.depth + 20);

    this.tweens.add({
      targets: bubble,
      y: by - 10,
      alpha: 0,
      delay: 2200,
      duration: 700,
      onComplete: () => bubble.destroy(),
    });
  }

  // ── Full Ultima-style conversation screen ──────────────────────────────────

  private openConversation(npc: NpcEntry): void {
    this.convOpen = true;
    // Close any quick-E dialogue that might be open
    this.closeDialogue();

    const D = 9200;
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.convObjects.push(obj);
      return obj;
    };

    // Dims the world behind the box
    add(this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(D));

    // Outer border (warm brown frame)
    const BX = 4, BY = 6, BW = 312, BH = 228;
    const frame = add(this.add.graphics().setScrollFactor(0).setDepth(D + 1));
    frame.fillStyle(0x7a4f1a, 1);
    frame.fillRect(BX, BY, BW, BH);
    frame.fillStyle(0x120900, 1);
    frame.fillRect(BX + 3, BY + 3, BW - 6, BH - 6);
    // Inner highlight line
    frame.lineStyle(1, 0x3a2008, 1);
    frame.strokeRect(BX + 2, BY + 2, BW - 4, BH - 4);

    // Portrait panel (left column)
    const PX = BX + 5, PY = BY + 5, PW = 66, PH = 120;
    const pfx = add(this.add.graphics().setScrollFactor(0).setDepth(D + 2));
    pfx.fillStyle(0x0d0500, 1);
    pfx.fillRect(PX, PY, PW, PH);
    pfx.lineStyle(1, npc.tint, 0.6);
    pfx.strokeRect(PX, PY, PW, PH);
    // Decorative corner ticks
    pfx.lineStyle(2, npc.tint, 0.9);
    [[PX, PY], [PX + PW, PY], [PX, PY + PH], [PX + PW, PY + PH]].forEach(([cx, cy]) => {
      const sx = cx === PX ? 1 : -1;
      const sy = cy === PY ? 1 : -1;
      pfx.lineBetween(cx, cy, cx + sx * 6, cy);
      pfx.lineBetween(cx, cy, cx, cy + sy * 6);
    });

    // NPC sprite in portrait (2.8× scale, anchored to portrait bottom)
    add(this.add.sprite(PX + PW / 2, PY + PH - 4, PLAYER_KEY, 0)
      .setTint(npc.tint).setScale(2.8).setOrigin(0.5, 0.9)
      .setScrollFactor(0).setDepth(D + 3));

    // NPC name across portrait bottom
    add(this.add.text(PX + 2, PY + PH + 3, npc.name, {
      fontSize: '7px', fontFamily: 'monospace', color: '#f5c842',
    }).setScrollFactor(0).setDepth(D + 3));

    // ── Right panel: text area ──────────────────────────────────────────────
    const TX = PX + PW + 6;
    const TY = BY + 5;
    const TW = BX + BW - TX - 5;
    // TW is the text column width; height fills from TY to portrait bottom

    // Section header
    add(this.add.text(TX, TY, npc.name.toUpperCase(), {
      fontSize: '6px', fontFamily: 'monospace', color: '#6a5030',
    }).setScrollFactor(0).setDepth(D + 3));

    const divGfx = add(this.add.graphics().setScrollFactor(0).setDepth(D + 2));
    divGfx.lineStyle(1, 0x3a2008, 1);
    divGfx.lineBetween(TX, TY + 10, TX + TW, TY + 10);

    // Response text (initial greeting = first dialogue line)
    const greeting = npc.dialogue[0] ?? '"Hello."';
    this.convResponseText = add(this.add.text(TX, TY + 14, greeting, {
      fontSize: '7px', fontFamily: 'monospace', color: '#e8d4a0',
      wordWrap: { width: TW },
    }).setScrollFactor(0).setDepth(D + 3));

    // ── Keyword area ────────────────────────────────────────────────────────
    const KY = BY + 5 + PH + 18;
    const kwDivGfx = add(this.add.graphics().setScrollFactor(0).setDepth(D + 2));
    kwDivGfx.lineStyle(1, 0x3a2008, 1);
    kwDivGfx.lineBetween(BX + 5, KY - 2, BX + BW - 5, KY - 2);

    add(this.add.text(BX + 7, KY, 'ASK ABOUT:', {
      fontSize: '6px', fontFamily: 'monospace', color: '#6a5030',
    }).setScrollFactor(0).setDepth(D + 3));

    const allTopics = [...npc.topics, { keyword: 'bye', response: '"Farewell, traveller. May virtue guide your path."' }];
    const COL_W = 98;
    const ROW_H = 14;
    const COLS  = 3;
    allTopics.forEach((topic, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const kx  = BX + 7 + col * COL_W;
      const ky  = KY + 12 + row * ROW_H;

      const btn = add(this.add.text(kx, ky, `[${topic.keyword}]`, {
        fontSize: '7px', fontFamily: 'monospace', color: '#6ab4f5',
      })
        .setScrollFactor(0).setDepth(D + 4)
        .setInteractive({ useHandCursor: true }));

      btn.on('pointerover',  () => btn.setColor('#f5d642'));
      btn.on('pointerout',   () => btn.setColor('#6ab4f5'));
      btn.on('pointerdown',  () => {
        if (topic.keyword === 'bye') {
          this.closeConversation();
        } else if (this.convResponseText) {
          this.convResponseText.setText(topic.response);
        }
      });
    });

    // Close [X] button
    const closeBtn = add(this.add.text(BX + BW - 6, BY + 4, '[X]', {
      fontSize: '7px', fontFamily: 'monospace', color: '#885533',
    }).setScrollFactor(0).setDepth(D + 4).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }));
    closeBtn.on('pointerover',  () => closeBtn.setColor('#ff7733'));
    closeBtn.on('pointerout',   () => closeBtn.setColor('#885533'));
    closeBtn.on('pointerdown',  () => this.closeConversation());
  }

  private closeConversation(): void {
    this.convOpen = false;
    this.convResponseText = null;
    for (const obj of this.convObjects) obj.destroy();
    this.convObjects = [];
  }

  private openDialogue(name: string, lines: string[]): void {
    this.dialogueLines = lines;
    this.dialogueLine  = 0;
    this.dialogueActive = true;
    this.dialogueBg.setVisible(true);
    this.dialogueNameText.setText(name).setVisible(true);
    this.dialogueBodyText.setText(lines[0]).setVisible(true);
    this.dialogueHintText.setText(lines.length > 1 ? 'E:next' : 'E:close').setVisible(true);
    this.interactHintText.setVisible(false);
  }

  private advanceDialogue(): void {
    this.dialogueLine++;
    if (this.dialogueLine >= this.dialogueLines.length) {
      this.closeDialogue();
    } else {
      this.dialogueBodyText.setText(this.dialogueLines[this.dialogueLine]);
      const isLast = this.dialogueLine === this.dialogueLines.length - 1;
      this.dialogueHintText.setText(isLast ? 'E:close' : 'E:next');
    }
  }

  private closeDialogue(): void {
    this.dialogueActive = false;
    this.dialogueBg.setVisible(false);
    this.dialogueNameText.setVisible(false);
    this.dialogueBodyText.setVisible(false);
    this.dialogueHintText.setVisible(false);
  }
}
