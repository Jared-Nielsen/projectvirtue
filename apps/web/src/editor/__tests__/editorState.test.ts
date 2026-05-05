import { describe, expect, it } from 'vitest';
import {
  applyPaint,
  applyResize,
  createEditorStore,
  isInBounds,
  makeInitialState,
} from '../state/editorState';

describe('editorState — initial state', () => {
  it('builds an empty 16×16 grid with both layers zeroed', () => {
    const state = makeInitialState();
    expect(state.gridSize).toBe(16);
    expect(state.ground).toHaveLength(256);
    expect(state.decor).toHaveLength(256);
    expect(state.ground.every((v) => v === 0)).toBe(true);
    expect(state.decor.every((v) => v === 0)).toBe(true);
    expect(state.tool).toBe('paint');
    expect(state.layer).toBe('ground');
    expect(state.selectedTileId).toBe(0);
  });

  it('honours the size override', () => {
    const state = makeInitialState(10);
    expect(state.gridSize).toBe(10);
    expect(state.ground).toHaveLength(100);
  });
});

describe('editorState — paint / erase', () => {
  it('paint writes the tile id at the cell index', () => {
    const a = makeInitialState(10);
    const b = applyPaint(a, 'ground', 3, 4, 7);
    expect(b.ground[4 * 10 + 3]).toBe(7);
    expect(b.decor[4 * 10 + 3]).toBe(0);
    expect(a.ground[4 * 10 + 3]).toBe(0); // immutable input
  });

  it('paint to decor leaves ground untouched', () => {
    const a = makeInitialState(10);
    const b = applyPaint(a, 'decor', 1, 1, 5);
    expect(b.decor[11]).toBe(5);
    expect(b.ground[11]).toBe(0);
  });

  it('out-of-bounds paint is a no-op', () => {
    const a = makeInitialState(10);
    expect(applyPaint(a, 'ground', -1, 0, 7)).toBe(a);
    expect(applyPaint(a, 'ground', 10, 0, 7)).toBe(a);
    expect(applyPaint(a, 'ground', 0, 10, 7)).toBe(a);
  });

  it('paint with same tile id is a no-op (returns same reference)', () => {
    const a = applyPaint(makeInitialState(10), 'ground', 1, 1, 7);
    expect(applyPaint(a, 'ground', 1, 1, 7)).toBe(a);
  });

  it('erase writes 0 to the cell', () => {
    const a = applyPaint(makeInitialState(10), 'ground', 2, 2, 9);
    const b = applyPaint(a, 'ground', 2, 2, 0);
    expect(b.ground[2 * 10 + 2]).toBe(0);
  });
});

describe('editorState — resize', () => {
  it('preserves the overlap when shrinking', () => {
    let a = makeInitialState(16);
    a = applyPaint(a, 'ground', 0, 0, 11);
    a = applyPaint(a, 'ground', 9, 9, 22);
    a = applyPaint(a, 'ground', 12, 12, 33); // outside the new bounds
    const b = applyResize(a, 10);
    expect(b.gridSize).toBe(10);
    expect(b.ground).toHaveLength(100);
    expect(b.ground[0]).toBe(11);
    expect(b.ground[9 * 10 + 9]).toBe(22);
    // 33 was truncated by the shrink.
    expect(b.ground.includes(33)).toBe(false);
  });

  it('preserves contents when growing', () => {
    let a = makeInitialState(10);
    a = applyPaint(a, 'ground', 5, 5, 7);
    const b = applyResize(a, 24);
    expect(b.gridSize).toBe(24);
    expect(b.ground).toHaveLength(576);
    expect(b.ground[5 * 24 + 5]).toBe(7);
  });

  it('returns same reference when size is unchanged', () => {
    const a = makeInitialState(16);
    expect(applyResize(a, 16)).toBe(a);
  });
});

describe('editorState — store API', () => {
  it('paint() honours the active layer + selectedTileId', () => {
    const [state, actions] = createEditorStore();
    actions.setSelectedTileId(13);
    actions.setLayer('decor');
    actions.paint(2, 3);
    expect(state().decor[3 * 16 + 2]).toBe(13);
    expect(state().ground[3 * 16 + 2]).toBe(0);
  });

  it('paint() with no selection is a no-op', () => {
    const [state, actions] = createEditorStore();
    actions.paint(0, 0);
    expect(state().ground.every((v) => v === 0)).toBe(true);
  });

  it('switching layers does not lose the other layer data', () => {
    const [state, actions] = createEditorStore();
    actions.setSelectedTileId(5);
    actions.setLayer('ground');
    actions.paint(0, 0);
    actions.setLayer('decor');
    actions.paint(0, 1);
    expect(state().ground[0]).toBe(5);
    expect(state().decor[16]).toBe(5);
    actions.setLayer('ground');
    expect(state().layer).toBe('ground');
    expect(state().ground[0]).toBe(5);
    expect(state().decor[16]).toBe(5);
  });

  it('erase() ignores selectedTileId and always writes 0', () => {
    const [state, actions] = createEditorStore();
    actions.setSelectedTileId(7);
    actions.paint(1, 1);
    expect(state().ground[1 * 16 + 1]).toBe(7);
    actions.erase(1, 1);
    expect(state().ground[1 * 16 + 1]).toBe(0);
  });

  it('reset() restores empty state with default grid size', () => {
    const [state, actions] = createEditorStore();
    actions.setSelectedTileId(7);
    actions.paint(1, 1);
    actions.setGridSize(24);
    actions.reset();
    expect(state().gridSize).toBe(16);
    expect(state().ground.every((v) => v === 0)).toBe(true);
    expect(state().decor.every((v) => v === 0)).toBe(true);
    expect(state().selectedTileId).toBe(0);
  });

  it('setGridSize() resizes both layers in place', () => {
    const [state, actions] = createEditorStore();
    actions.setSelectedTileId(8);
    actions.paint(0, 0);
    actions.setGridSize(10);
    expect(state().gridSize).toBe(10);
    expect(state().ground[0]).toBe(8);
    expect(state().ground).toHaveLength(100);
  });
});

describe('isInBounds', () => {
  it('clamps as expected', () => {
    expect(isInBounds(10, 0, 0)).toBe(true);
    expect(isInBounds(10, 9, 9)).toBe(true);
    expect(isInBounds(10, 10, 0)).toBe(false);
    expect(isInBounds(10, 0, 10)).toBe(false);
    expect(isInBounds(10, -1, 0)).toBe(false);
  });
});
