// World Editor screen — mounted at /play/editor inside the MenuLayout.
//
// Doc #43 phases 1–5 MVP. Single-room editor that paints onto a 16×16 iso
// grid (resizable to 10×10 / 24×24), persists to localStorage, and
// imports/exports Tiled .tmj.
//
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │ Toolbar                                      │
//   ├────────────┬─────────────────────────────────┤
//   │ Palette    │ Pixi canvas                     │
//   │            │                                 │
//   ├────────────┴─────────────────────────────────┤
//   │ Status                                       │
//   └──────────────────────────────────────────────┘
//
// TODO(editor-v2): Boot a "preview" runtime that re-uses the in-game
// CanvasRuntime with the editor's current grid injected as `tileMapSource`.
// Doc #43 §"Open question 2".

import { toast } from '@br/ui';
import {
  type JSX,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
} from 'solid-js';
import { isoMetricsFor } from '../canvas/scale';
import { SCALE_MODES } from '../canvas/scale';
import { EditorCanvas } from './EditorCanvas';
import { downloadTmj } from './lib/exportTmj';
import { parseTmj } from './lib/importTmj';
import { DEFAULT_GRID_SIZE, createEditorStore, makeInitialState } from './state/editorState';
import { clearStorage, loadFromStorage, makeDebouncedSave, saveToStorage } from './state/persist';
import { loadPaletteManifest } from './state/tileset';
import { ConfirmReset } from './ui/ConfirmReset';
import { PalettePanel } from './ui/PalettePanel';
import { StatusBar } from './ui/StatusBar';
import { Toolbar } from './ui/Toolbar';

export function EditorScreen(): JSX.Element {
  // Editor uses kenney-miniature dims (256×128) — Doc #43 §3 + §6.
  const metrics = isoMetricsFor(SCALE_MODES['kenney-miniature']);

  // Restore from localStorage if a snapshot exists; else start empty.
  const initialState = (() => {
    const snapshot = loadFromStorage();
    const base = makeInitialState(snapshot?.gridSize ?? DEFAULT_GRID_SIZE);
    if (!snapshot) return base;
    return {
      ...base,
      gridSize: snapshot.gridSize,
      ground: snapshot.ground,
      decor: snapshot.decor,
    };
  })();

  const [state, actions] = createEditorStore(initialState);

  // Debounced autosave (300ms after the last mutation).
  const debouncedSave = makeDebouncedSave(300, saveToStorage);
  createEffect(
    on(state, (s) => {
      debouncedSave(s);
    }),
  );

  // Palette load — fetches /maps/library-iso.manifest.json.
  const [paletteRes] = createResource(loadPaletteManifest);

  // Auto-select the first floor tile once the palette resolves so the user
  // can paint immediately (Doc #43 §6 phase 6 polish, but trivially cheap
  // here so we ship it in MVP).
  createEffect(() => {
    const data = paletteRes();
    if (!data) return;
    if (state().selectedTileId !== 0) return;
    const firstFloor = data.tiles.find((t) => t.category === 'floor') ?? data.tiles[0];
    if (firstFloor) actions.setSelectedTileId(firstFloor.id);
  });

  // Reset confirm state.
  const [confirmOpen, setConfirmOpen] = createSignal(false);

  // Hidden file input for import.
  let fileInput: HTMLInputElement | undefined;

  function handleImportClick(): void {
    fileInput?.click();
  }

  async function handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const result = parseTmj(text);
      if (!result.ok) {
        toast.error(`Import failed: ${result.error}`);
        return;
      }
      actions.replace({
        gridSize: result.gridSize,
        ground: result.ground,
        decor: result.decor,
      });
      toast.success(`Imported ${file.name} (${result.gridSize}×${result.gridSize}).`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[editor] import failed', err);
      toast.error('Import failed: could not read file.');
    }
  }

  function handleExport(): void {
    const filename = downloadTmj(state(), 'mythenor-map');
    toast.success(`Exported ${filename}.`);
  }

  function handleResetConfirm(): void {
    actions.reset();
    clearStorage();
    setConfirmOpen(false);
    toast.show('Map reset.');
  }

  // Suppress browser context menu on the canvas mount so right-click
  // erase/pan stays functional.
  let rootEl: HTMLDivElement | undefined;
  onMount(() => {
    if (!rootEl) return;
    const onContextMenu = (ev: Event): void => ev.preventDefault();
    rootEl.addEventListener('contextmenu', onContextMenu);
    onCleanup(() => rootEl?.removeEventListener('contextmenu', onContextMenu));
  });

  return (
    <div
      ref={rootEl}
      data-screen="editor"
      style={{
        display: 'grid',
        'grid-template-rows': 'auto 1fr auto',
        height: 'calc(100vh - 2rem)',
        'min-height': '600px',
        'border-radius': 'var(--br-radius-md, 6px)',
        overflow: 'hidden',
        border: '1px solid var(--br-color-border, #3a3328)',
        background: 'var(--br-color-surface-base, #14110c)',
      }}
    >
      <Toolbar
        state={state}
        actions={actions}
        onExport={handleExport}
        onImportClick={handleImportClick}
        onResetRequest={() => setConfirmOpen(true)}
      />

      <div
        style={{
          display: 'grid',
          'grid-template-columns': '260px 1fr',
          'min-height': 0,
        }}
      >
        <PalettePanel
          manifest={paletteRes() ?? null}
          loading={paletteRes.loading}
          error={paletteRes.error ? String(paletteRes.error) : null}
          selectedTileId={state().selectedTileId}
          onSelect={(id) => actions.setSelectedTileId(id)}
        />
        <EditorCanvas state={state} actions={actions} metrics={metrics} />
      </div>

      <StatusBar state={state} />

      <ConfirmReset
        open={confirmOpen()}
        onConfirm={handleResetConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <input
        ref={fileInput}
        type="file"
        accept=".tmj,application/json"
        style={{ display: 'none' }}
        onChange={(ev) => {
          const file = ev.currentTarget.files?.[0];
          if (file) void handleImportFile(file);
          ev.currentTarget.value = '';
        }}
      />
    </div>
  );
}
