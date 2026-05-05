// PalettePanel — left-side scrollable grid of palette tiles.
//
// Tiles are listed straight from the manifest. Selecting a tile sets
// `selectedTileId` on the editor state; the canvas reads that signal when
// painting. Keyboard accessibility: each tile is a real <button> so Tab /
// Enter / Space all work; arrow keys would be a nice-to-have polish task
// (Doc #43 phase 6).

import { type Component, For, Show } from 'solid-js';
import type { PaletteManifest, PaletteTile } from '../state/tileset';

export interface PalettePanelProps {
  readonly manifest: PaletteManifest | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectedTileId: number;
  readonly onSelect: (id: number) => void;
}

export const PalettePanel: Component<PalettePanelProps> = (props) => {
  return (
    <aside
      aria-label="Tile palette"
      style={{
        display: 'flex',
        'flex-direction': 'column',
        height: '100%',
        'border-right': '1px solid var(--br-color-border, #3a3328)',
        background: 'var(--br-color-surface-raised, #1c1812)',
      }}
    >
      <header
        style={{
          padding: 'var(--br-space-2, 0.5rem) var(--br-space-3, 0.75rem)',
          'border-bottom': '1px solid var(--br-color-border, #3a3328)',
        }}
      >
        <strong style={{ 'font-size': '0.85rem', 'letter-spacing': '0.06em' }}>
          LIBRARY PALETTE
        </strong>
        <Show when={props.manifest}>
          {(m) => (
            <span style={{ 'margin-left': '0.5rem', opacity: 0.6, 'font-size': '0.8rem' }}>
              {m().tiles.length} tiles
            </span>
          )}
        </Show>
      </header>

      <Show when={props.loading}>
        <div style={{ padding: '0.75rem', opacity: 0.7, 'font-size': '0.85rem' }}>
          Loading palette…
        </div>
      </Show>
      <Show when={props.error}>
        <div role="alert" style={{ padding: '0.75rem', color: '#fca', 'font-size': '0.85rem' }}>
          {props.error}
        </div>
      </Show>

      <Show when={props.manifest}>
        {(m) => (
          <div
            aria-label="Palette tiles"
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(2, 1fr)',
              gap: 'var(--br-space-2, 0.5rem)',
              padding: 'var(--br-space-2, 0.5rem)',
              overflow: 'auto',
              flex: '1 1 auto',
            }}
          >
            <For each={m().tiles}>
              {(tile) => (
                <PaletteCell
                  tile={tile}
                  selected={props.selectedTileId === tile.id}
                  onSelect={() => props.onSelect(tile.id)}
                />
              )}
            </For>
          </div>
        )}
      </Show>
    </aside>
  );
};

interface PaletteCellProps {
  readonly tile: PaletteTile;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

const PaletteCell: Component<PaletteCellProps> = (props) => {
  return (
    <button
      type="button"
      aria-pressed={props.selected ? 'true' : 'false'}
      onClick={props.onSelect}
      title={props.tile.label}
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '0.25rem',
        padding: '0.4rem',
        'border-radius': '4px',
        border: props.selected
          ? '2px solid var(--br-color-accent, #c8a55a)'
          : '1px solid var(--br-color-border, #3a3328)',
        background: props.selected ? 'var(--br-color-surface-base, #14110c)' : 'transparent',
        cursor: 'pointer',
        color: 'var(--br-color-ink, #e8e2d2)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '64px',
          height: '64px',
          background: '#0c0a07',
          'border-radius': '3px',
          display: 'flex',
          'align-items': 'flex-end',
          'justify-content': 'center',
          overflow: 'hidden',
        }}
      >
        {/*
          crossorigin="anonymous" forces the palette image fetch to the
          same CORS mode Pixi's Assets.load uses for the canvas. Without
          this, the palette would load in no-cors mode and populate the
          browser cache with an entry that has no Access-Control-Allow-
          Origin header. The canvas's later cors-mode fetch for the same
          URL would reuse that tainted cache entry and fail with
          "No 'Access-Control-Allow-Origin' header is present" — even
          though the server (R2) returns the header correctly. Tagging
          the <img> with crossorigin populates the cache CORS-ready so
          the canvas hits a clean entry.
        */}
        <img
          src={props.tile.src}
          alt=""
          loading="lazy"
          crossOrigin="anonymous"
          style={{
            width: '100%',
            height: 'auto',
            'object-fit': 'contain',
            'object-position': 'center bottom',
          }}
        />
      </div>
      <span
        style={{
          'font-size': '0.7rem',
          'text-align': 'center',
          'line-height': 1.1,
          opacity: 0.85,
        }}
      >
        {props.tile.label}
      </span>
    </button>
  );
};
