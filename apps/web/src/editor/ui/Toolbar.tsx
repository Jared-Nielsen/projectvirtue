// Editor toolbar — paint/erase tools, layer toggle, grid size, grid-lines,
// import, export, reset. Composed from @br/ui primitives so the editor
// matches the rest of the game client's chrome.

import { Cluster, IconButton, Select, Toggle } from '@br/ui';
import { type Component, For, Show } from 'solid-js';
import {
  ALLOWED_GRID_SIZES,
  type EditorActions,
  type EditorLayer,
  type EditorState,
  type EditorTool,
  type GridSize,
} from '../state/editorState';

export interface ToolbarProps {
  readonly state: () => EditorState;
  readonly actions: EditorActions;
  readonly onExport: () => void;
  readonly onImportClick: () => void;
  readonly onResetRequest: () => void;
}

export const Toolbar: Component<ToolbarProps> = (props) => {
  const state = (): EditorState => props.state();

  const tools: ReadonlyArray<{ id: EditorTool; icon: 'star' | 'x'; label: string }> = [
    { id: 'paint', icon: 'star', label: 'Paint' },
    { id: 'erase', icon: 'x', label: 'Erase' },
  ];

  const layers: ReadonlyArray<{ id: EditorLayer; label: string }> = [
    { id: 'ground', label: 'Ground' },
    { id: 'decor', label: 'Decor' },
  ];

  return (
    <div
      role="toolbar"
      aria-label="World editor toolbar"
      style={{
        display: 'flex',
        'flex-wrap': 'wrap',
        gap: 'var(--br-space-3, 0.75rem)',
        padding: 'var(--br-space-2, 0.5rem) var(--br-space-3, 0.75rem)',
        'border-bottom': '1px solid var(--br-color-border, #3a3328)',
        background: 'var(--br-color-surface-raised, #1c1812)',
      }}
    >
      <Cluster gap="2" align="center">
        <span style={{ opacity: 0.7, 'font-size': '0.8rem' }}>Tool</span>
        <For each={tools}>
          {(tool) => (
            <IconButton
              icon={tool.icon}
              label={tool.label}
              variant={state().tool === tool.id ? 'primary' : 'ghost'}
              aria-pressed={state().tool === tool.id ? 'true' : 'false'}
              onClick={() => props.actions.setTool(tool.id)}
            />
          )}
        </For>
      </Cluster>

      <Cluster gap="2" align="center">
        <span style={{ opacity: 0.7, 'font-size': '0.8rem' }}>Layer</span>
        <For each={layers}>
          {(layer) => (
            <button
              type="button"
              aria-pressed={state().layer === layer.id ? 'true' : 'false'}
              onClick={() => props.actions.setLayer(layer.id)}
              style={{
                padding: '0.4rem 0.7rem',
                'border-radius': '4px',
                border: '1px solid var(--br-color-border, #3a3328)',
                background:
                  state().layer === layer.id ? 'var(--br-color-accent, #c8a55a)' : 'transparent',
                color:
                  state().layer === layer.id
                    ? 'var(--br-color-surface-base, #14110c)'
                    : 'var(--br-color-ink, #e8e2d2)',
                cursor: 'pointer',
                'font-size': '0.85rem',
              }}
            >
              {layer.label}
            </button>
          )}
        </For>
      </Cluster>

      <Cluster gap="2" align="center">
        <span style={{ opacity: 0.7, 'font-size': '0.8rem' }}>Grid</span>
        <Select
          id="editor-grid-size"
          value={String(state().gridSize)}
          onChange={(ev) => {
            const next = Number.parseInt(ev.currentTarget.value, 10);
            if ((ALLOWED_GRID_SIZES as readonly number[]).includes(next)) {
              props.actions.setGridSize(next as GridSize);
            }
          }}
          options={ALLOWED_GRID_SIZES.map((s) => ({
            value: String(s),
            label: `${s} × ${s}`,
          }))}
        />
      </Cluster>

      <Cluster gap="2" align="center">
        <Toggle
          checked={state().showGrid}
          onChange={(ev) => props.actions.setShowGrid(ev.currentTarget.checked)}
          label="Grid lines"
        />
      </Cluster>

      <Cluster gap="2" align="center" style={{ 'margin-left': 'auto' }}>
        <button type="button" onClick={props.onImportClick} style={toolbarButtonStyle()}>
          Import .tmj
        </button>
        <button type="button" onClick={props.onExport} style={toolbarButtonStyle()}>
          Export .tmj
        </button>
        <button
          type="button"
          onClick={props.onResetRequest}
          style={toolbarButtonStyle('destructive')}
        >
          Reset
        </button>
      </Cluster>

      <Show when={state().selectedTileId === 0}>
        <span
          style={{
            'font-size': '0.8rem',
            opacity: 0.7,
            'flex-basis': '100%',
            'margin-top': '0.25rem',
          }}
        >
          Select a tile from the palette to begin painting.
        </span>
      </Show>
    </div>
  );
};

function toolbarButtonStyle(variant?: 'destructive'): Record<string, string> {
  const isDestructive = variant === 'destructive';
  return {
    padding: '0.4rem 0.75rem',
    'border-radius': '4px',
    border: '1px solid var(--br-color-border, #3a3328)',
    background: isDestructive ? 'var(--br-color-danger-bg, #4a1818)' : 'transparent',
    color: 'var(--br-color-ink, #e8e2d2)',
    cursor: 'pointer',
    'font-size': '0.85rem',
  };
}
