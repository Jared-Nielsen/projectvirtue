// StatusBar — slim footer with grid size, painted-cell counts, and
// the active layer + tool. Read-only summary; no controls.

import type { Component } from 'solid-js';
import type { EditorState } from '../state/editorState';

export interface StatusBarProps {
  readonly state: () => EditorState;
}

export const StatusBar: Component<StatusBarProps> = (props) => {
  const groundCount = (): number => props.state().ground.filter((id) => id > 0).length;
  const decorCount = (): number => props.state().decor.filter((id) => id > 0).length;
  const total = (): number => {
    const s = props.state().gridSize;
    return s * s;
  };

  return (
    <footer
      style={{
        display: 'flex',
        gap: 'var(--br-space-4, 1rem)',
        padding: 'var(--br-space-2, 0.5rem) var(--br-space-3, 0.75rem)',
        'border-top': '1px solid var(--br-color-border, #3a3328)',
        background: 'var(--br-color-surface-raised, #1c1812)',
        'font-size': '0.8rem',
        'font-variant-numeric': 'tabular-nums',
        opacity: 0.85,
      }}
    >
      <span>
        Grid {props.state().gridSize}×{props.state().gridSize}
      </span>
      <span>Layer {props.state().layer}</span>
      <span>Tool {props.state().tool}</span>
      <span>
        Ground {groundCount()}/{total()}
      </span>
      <span>
        Decor {decorCount()}/{total()}
      </span>
      <span style={{ 'margin-left': 'auto', opacity: 0.65 }}>Mythenor / Highmere library kit</span>
    </footer>
  );
};
