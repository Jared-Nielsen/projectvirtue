// City overview HUD — concept-art reference 2-5-PortCity.png.
//
// Renders a region banner ("Greenvale") and floating NPC labels at
// approximate world-screen positions. Because Wave 3 doesn't expose a
// world-to-screen projector from the canvas (Phase 6 owns that), we
// approximate by laying labels out as a sparse grid based on each NPC's
// tile position relative to the region bounds. When the canvas exposes a
// projector (TODO), swap this fixed mapping for a per-frame transform.

import type { Npc } from '@br/types';
import { type JSX, Show, createMemo, createResource } from 'solid-js';
import { For } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './CityHud.module.css';
import shared from './hud-shared.module.css';

export interface CityHudProps {
  readonly regionId?: string;
  readonly regionLabel?: string;
}

interface NpcsPayload {
  readonly npcs: readonly Npc[];
}

interface PlacedLabel {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly leftPct: number;
  readonly topPct: number;
}

/** Pure: project an NPC tile position to a screen percentage anchor. */
export function placeLabels(
  npcs: readonly Npc[],
  bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  },
): readonly PlacedLabel[] {
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  return npcs.map((n) => {
    const xPct = ((n.position.x - bounds.minX) / w) * 100;
    const yPct = ((n.position.y - bounds.minY) / h) * 100;
    return {
      id: n.id,
      name: n.name,
      title: n.title,
      // Pad to 8-92% so labels never clip the canvas edge.
      leftPct: 8 + Math.max(0, Math.min(100, xPct)) * 0.84,
      topPct: 12 + Math.max(0, Math.min(100, yPct)) * 0.7,
    };
  });
}

const DEFAULT_BOUNDS = { minX: 0, minY: 0, maxX: 32, maxY: 24 };

export function CityHud(props: CityHudProps): JSX.Element {
  const region = (): string => props.regionId ?? 'region_highmere';
  const label = (): string => props.regionLabel ?? 'Greenvale';

  const [npcs] = createResource(() => mockClient.get<NpcsPayload>('/v1/world/npcs'));

  const labels = createMemo<readonly PlacedLabel[]>(() => {
    const all = npcs();
    if (!all) return [];
    const filtered = all.npcs.filter((n) => n.regionId === region());
    return placeLabels(filtered, DEFAULT_BOUNDS);
  });

  return (
    <div class={shared.hudLayer}>
      <div class={`${shared.anchor} ${shared.topCenter}`}>
        <div class={shared.banner}>{label()}</div>
        <div class={shared.bannerSub}>Port City · Day · Clear</div>
      </div>

      <Show when={labels().length > 0}>
        <For each={labels()}>
          {(lbl) => (
            <div
              class={styles.npcLabel}
              style={{ left: `${lbl.leftPct}%`, top: `${lbl.topPct}%` }}
              data-npc-id={lbl.id}
            >
              <span class={styles.bubbleStem} aria-hidden="true" />
              <strong>{lbl.name}</strong>
              <span class={styles.title}>{lbl.title}</span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
