import Phaser from 'phaser';

export const PLAYER_KEY  = 'player';
export const PLAYER_PATH = 'assets/player.png';
export const FRAME_W     = 32;
export const FRAME_H     = 35;

// Sprite sheet: 4 cols (idle + 3 walk) × 3 rows (south, north, east)
const SOUTH_IDLE = 0;  const SOUTH_A = 1;  const SOUTH_B = 2;  const SOUTH_C = 3;
const NORTH_IDLE = 4;  const NORTH_A = 5;  const NORTH_B = 6;  const NORTH_C = 7;
const EAST_IDLE  = 8;  const EAST_A  = 9;  const EAST_B  = 10; const EAST_C  = 11;

export function buildPlayerAnimations(scene: Phaser.Scene): void {
  const WFR = 8;

  scene.anims.create({ key: 'idle-south', frames: [{ key: PLAYER_KEY, frame: SOUTH_IDLE }], frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'walk-south', frames: scene.anims.generateFrameNumbers(PLAYER_KEY, { frames: [SOUTH_A, SOUTH_B, SOUTH_C] }), frameRate: WFR, repeat: -1 });

  scene.anims.create({ key: 'idle-north', frames: [{ key: PLAYER_KEY, frame: NORTH_IDLE }], frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'walk-north', frames: scene.anims.generateFrameNumbers(PLAYER_KEY, { frames: [NORTH_A, NORTH_B, NORTH_C] }), frameRate: WFR, repeat: -1 });

  // East and west share frames; west uses flipX
  scene.anims.create({ key: 'idle-east', frames: [{ key: PLAYER_KEY, frame: EAST_IDLE }], frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'walk-east', frames: scene.anims.generateFrameNumbers(PLAYER_KEY, { frames: [EAST_A, EAST_B, EAST_C] }), frameRate: WFR, repeat: -1 });
  scene.anims.create({ key: 'idle-west', frames: [{ key: PLAYER_KEY, frame: EAST_IDLE }], frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'walk-west', frames: scene.anims.generateFrameNumbers(PLAYER_KEY, { frames: [EAST_A, EAST_B, EAST_C] }), frameRate: WFR, repeat: -1 });
}
