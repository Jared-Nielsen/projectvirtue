// Trigger zones — dialog, loot, region transition.
//
// Triggers are tile-coordinate predicates. When the player enters a tile
// that satisfies any trigger, a CustomEvent is dispatched on the supplied
// EventTarget. The route layer subscribes from outside (`/play`) and lifts
// the player into the matching modal/route. The canvas does NOT import the
// router — it only emits.
//
// Event contract (stable):
//   `br:trigger:dialog`     detail: { npcId: string }
//   `br:trigger:loot`       detail: { lootId: string, tile: { x, y } }
//   `br:trigger:transition` detail: { regionId: string, tile: { x, y } }

import type { Npc } from '@br/types';

export interface TileTrigger {
  readonly kind: 'dialog' | 'loot' | 'transition';
  readonly tile: { readonly x: number; readonly y: number };
  readonly payload: Record<string, unknown>;
}

export interface TriggerHostOptions {
  readonly target: EventTarget;
  readonly triggers: readonly TileTrigger[];
  readonly npcs: readonly Npc[];
}

export class TriggerHost {
  private lastTile: { x: number; y: number } | null = null;
  private readonly triggers: readonly TileTrigger[];
  private readonly target: EventTarget;
  private readonly npcs: readonly Npc[];

  constructor(opts: TriggerHostOptions) {
    this.triggers = opts.triggers;
    this.target = opts.target;
    this.npcs = opts.npcs;
  }

  /** Call once per frame (or after movement) with the player's current tile. */
  notify(playerTile: { x: number; y: number }): void {
    if (this.lastTile && this.lastTile.x === playerTile.x && this.lastTile.y === playerTile.y) {
      return;
    }
    this.lastTile = { ...playerTile };
    for (const t of this.triggers) {
      if (t.tile.x === playerTile.x && t.tile.y === playerTile.y) {
        this.dispatch(t);
      }
    }
    // NPC adjacency triggers a dialog suggestion event. The route layer
    // decides whether to surface a "Press E to talk" prompt.
    for (const npc of this.npcs) {
      const dx = Math.abs(Math.floor(npc.position.x) - playerTile.x);
      const dy = Math.abs(Math.floor(npc.position.y) - playerTile.y);
      if (dx + dy === 1) {
        this.target.dispatchEvent(
          new CustomEvent('br:trigger:dialog-prompt', {
            detail: { npcId: npc.id, npcName: npc.name },
          }),
        );
      }
    }
  }

  /** Manually fire dialog from a click on an NPC entity. */
  fireDialog(npcId: string): void {
    this.target.dispatchEvent(new CustomEvent('br:trigger:dialog', { detail: { npcId } }));
  }

  private dispatch(t: TileTrigger): void {
    const name = `br:trigger:${t.kind}`;
    this.target.dispatchEvent(new CustomEvent(name, { detail: { ...t.payload, tile: t.tile } }));
  }
}
