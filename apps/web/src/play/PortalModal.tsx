// Moon-portal travel modal — concept-art reference 2-7-MoonPortal.png.
//
// Triggered when the canvas dispatches a `br:trigger:transition` event for
// a portal-tagged tile. Displays a small SVG overworld map with selectable
// destinations (regions known to the player) and a "Travel" CTA. The
// route layer drives `open`; the modal owns the destination signal and
// confirms via `onTravel`.

import type { Region } from '@br/types';
import { Button } from '@br/ui';
import { type JSX, Show, createMemo, createResource, createSignal } from 'solid-js';
import { For } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './PortalModal.module.css';

export interface PortalModalProps {
  readonly open: boolean;
  readonly originRegionId: string | null;
  readonly onClose: () => void;
  readonly onTravel: (region: Region) => void;
}

interface RegionsPayload {
  readonly regions: readonly Region[];
}

/** Pure: convert a region's bounds into a 0-1 svg-space rectangle. */
export function regionToSvgRect(
  region: Region,
  world: { readonly maxX: number; readonly maxY: number },
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const x = region.bounds.minX / world.maxX;
  const y = region.bounds.minY / world.maxY;
  const w = (region.bounds.maxX - region.bounds.minX) / world.maxX;
  const h = (region.bounds.maxY - region.bounds.minY) / world.maxY;
  return { x, y, w, h };
}

export function PortalModal(props: PortalModalProps): JSX.Element {
  const [regions] = createResource(() => mockClient.get<RegionsPayload>('/v1/world/regions'));
  const [pickId, setPickId] = createSignal<string | null>(null);

  const list = createMemo<readonly Region[]>(() => regions()?.regions ?? []);

  const worldBounds = createMemo(() => {
    const all = list();
    if (all.length === 0) return { maxX: 64, maxY: 64 };
    let maxX = 0;
    let maxY = 0;
    for (const r of all) {
      if (r.bounds.maxX > maxX) maxX = r.bounds.maxX;
      if (r.bounds.maxY > maxY) maxY = r.bounds.maxY;
    }
    return { maxX, maxY };
  });

  const picked = createMemo<Region | null>(() => {
    const id = pickId();
    if (!id) return null;
    return list().find((r) => r.id === id) ?? null;
  });

  function confirm(): void {
    const r = picked();
    if (!r) return;
    props.onTravel(r);
  }

  return (
    <Show when={props.open}>
      <dialog
        class={styles.scrim}
        aria-modal="true"
        aria-label="Moonstone portal"
        open
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) props.onClose();
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') props.onClose();
        }}
      >
        <div class={styles.shell}>
          <header class={styles.head}>
            <span class={styles.headTitle}>Moonstone Portal</span>
            <span class={styles.headSub}>Choose a destination</span>
          </header>

          <div class={styles.body}>
            <svg
              class={styles.map}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Mythenor overview map"
            >
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill="rgba(8, 21, 35, 0.85)"
                stroke="rgba(244, 204, 102, 0.25)"
              />
              <For each={list()}>
                {(r) => {
                  const rect = () => regionToSvgRect(r, worldBounds());
                  const isOrigin = () => r.id === props.originRegionId;
                  const isPicked = () => r.id === pickId();
                  return (
                    <g
                      class={`${styles.regionGroup} ${isPicked() ? styles.picked : ''} ${isOrigin() ? styles.origin : ''}`}
                      onClick={() => setPickId(r.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          setPickId(r.id);
                        }
                      }}
                      // biome-ignore lint/a11y/useSemanticElements: <button> cannot be a child of <svg>; this <g> models a clickable region overlay.
                      role="button"
                      tabindex={0}
                      aria-label={r.displayName.en}
                    >
                      <rect
                        x={rect().x * 100}
                        y={rect().y * 100}
                        width={rect().w * 100}
                        height={rect().h * 100}
                        rx="2"
                      />
                      <text
                        x={(rect().x + rect().w / 2) * 100}
                        y={(rect().y + rect().h / 2) * 100 + 1}
                        text-anchor="middle"
                        font-size="3"
                        fill="currentColor"
                      >
                        {r.displayName.en}
                      </text>
                    </g>
                  );
                }}
              </For>
            </svg>

            <aside class={styles.detail}>
              <Show
                when={picked()}
                fallback={
                  <p class={styles.dim}>Select a region on the map to read its description.</p>
                }
              >
                {(r) => (
                  <>
                    <h3>{r().displayName.en}</h3>
                    <p class={styles.biome}>
                      Biome: {r().biome} · Lvl {r().recommendedLevel}
                      {r().safeZone ? ' · safe zone' : ' · contested'}
                    </p>
                    <p>{r().description}</p>
                  </>
                )}
              </Show>
            </aside>
          </div>

          <footer class={styles.foot}>
            <Button variant="secondary" onClick={props.onClose}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!picked()}>
              Travel
            </Button>
          </footer>
        </div>
      </dialog>
    </Show>
  );
}
