import Phaser from 'phaser';
import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_SPEED, MOUSE_DEAD_ZONE, MOUSE_MAX_DIST,
} from '../constants';
import { TileType, TILE_WALKABLE } from '../world/TileType';
import { generateWorld } from '../world/WorldGen';
import { TILESET_KEY, TILESET_PATH } from '../rendering/TilesetBuilder';
import { buildPlayerAnimations, PLAYER_KEY, PLAYER_PATH, FRAME_W, FRAME_H } from '../rendering/PlayerSpriteBuilder';
import { MusicPlayer } from '../audio/MusicPlayer';

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

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);

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
      [TileType.DenseForest]: 0.10,
      [TileType.Forest]:      0.06,
      [TileType.DarkGrass]:   0.018,
      [TileType.LightGrass]:  0.010,
      [TileType.Hills]:       0.015,
    };

    for (let ty = 0; ty < WORLD_HEIGHT; ty++) {
      for (let tx = 0; tx < WORLD_WIDTH; tx++) {
        const t = this.world[ty * WORLD_WIDTH + tx] as TileType;
        const d = density[t];
        if (!d) { rand(); continue; }      // consume RNG to keep sequence stable
        if (rand() > d) continue;
        const frame = Math.floor(rand() * 4);
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = (ty + 1) * TILE_SIZE;
        this.add.image(wx, wy, TREE_KEY, frame).setOrigin(0.5, 1.0).setDepth(wy);
      }
    }

    // ── castle interior items ────────────────────────────────────────────────
    // Castle top-left is at (WORLD_WIDTH/2 - 6, WORLD_HEIGHT/2 - 4) in tile coords
    const ox = Math.floor(WORLD_WIDTH  / 2) - 6;
    const oy = Math.floor(WORLD_HEIGHT / 2) - 4;

    const place = (relX: number, relY: number, key: string, frame: number) => {
      const wx = (ox + relX) * TILE_SIZE + TILE_SIZE / 2;
      const wy = (oy + relY + 1) * TILE_SIZE;
      this.add.image(wx, wy, key, frame).setOrigin(0.5, 1.0).setDepth(wy);
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

    for (let r = 0; r < 80; r++) {
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
    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;
    const keyboardActive = left || right || up || down;

    let vx = 0;
    let vy = 0;
    let speed = PLAYER_SPEED;

    if (keyboardActive) {
      if (left)  vx -= 1;
      if (right) vx += 1;
      if (up)    vy -= 1;
      if (down)  vy += 1;
      if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    } else if (this.input.mousePointer.rightButtonDown()) {
      const ptr   = this.input.mousePointer;
      const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const dx    = world.x - this.playerX;
      const dy    = world.y - this.playerY;
      const dist  = Math.sqrt(dx * dx + dy * dy);

      if (dist > MOUSE_DEAD_ZONE) {
        vx    = dx / dist;
        vy    = dy / dist;
        const t = Math.min(1, (dist - MOUSE_DEAD_ZONE) / (MOUSE_MAX_DIST - MOUSE_DEAD_ZONE));
        speed = PLAYER_SPEED * t * t;
      }
    }

    // ── movement ────────────────────────────────────────────────────────────
    const dt   = delta / 1000;
    const newX = this.playerX + vx * speed * dt;
    const newY = this.playerY + vy * speed * dt;

    if (this.canMoveTo(newX, this.playerY)) this.playerX = newX;
    if (this.canMoveTo(this.playerX, newY)) this.playerY = newY;

    this.playerX = Math.max(TILE_SIZE, Math.min((WORLD_WIDTH  - 1) * TILE_SIZE, this.playerX));
    this.playerY = Math.max(TILE_SIZE, Math.min((WORLD_HEIGHT - 1) * TILE_SIZE, this.playerY));

    // ── facing + animation ──────────────────────────────────────────────────
    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      if (Math.abs(vx) >= Math.abs(vy)) {
        this.facing = vx > 0 ? 'east' : 'west';
      } else {
        this.facing = vy > 0 ? 'south' : 'north';
      }
    }

    const animKey = moving ? `walk-${this.facing}` : `idle-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== animKey) {
      this.player.play(animKey);
    }

    this.player.setFlipX(this.facing === 'west');

    // ── camera + sprite position ─────────────────────────────────────────────
    this.player.setPosition(this.playerX, this.playerY);
    this.player.setDepth(this.playerY);

    this.cameras.main.setScroll(
      this.playerX - CANVAS_WIDTH  / 2,
      this.playerY - CANVAS_HEIGHT / 2,
    );

    this.drawCursor();
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

  private canMoveTo(x: number, y: number): boolean {
    const hw = 3;
    const hh = 4;
    const points = [[x, y], [x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]];

    for (const [px, py] of points) {
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return false;
      if (!TILE_WALKABLE[this.world[ty * WORLD_WIDTH + tx]]) return false;
    }
    return true;
  }
}
