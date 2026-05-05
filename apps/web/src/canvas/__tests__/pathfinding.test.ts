import { describe, expect, it } from 'vitest';
import { findPath, walkableFromGrid } from '../pathfinding';

const T = true;
const F = false;

describe('pathfinding A*', () => {
  it('returns a single-cell path when start === goal', () => {
    const grid = walkableFromGrid([
      [T, T, T],
      [T, T, T],
    ]);
    const path = findPath(grid, { x: 1, y: 0 }, { x: 1, y: 0 });
    expect(path).toEqual([{ x: 1, y: 0 }]);
  });

  it('finds the straight-line path on an open grid', () => {
    const grid = walkableFromGrid([
      [T, T, T, T, T],
      [T, T, T, T, T],
      [T, T, T, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.[path.length - 1]).toEqual({ x: 4, y: 0 });
    // Manhattan distance is 4 → path length 5 (inclusive).
    expect(path?.length).toBe(5);
  });

  it('routes around an impassable wall', () => {
    // Wall blocks column 2 except for the bottom row.
    const grid = walkableFromGrid([
      [T, T, F, T, T],
      [T, T, F, T, T],
      [T, T, T, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    if (!path) throw new Error('unreachable');
    // Must travel down to y=2 to skirt the wall.
    expect(path.some((p) => p.y === 2)).toBe(true);
    // Cannot pass through the wall.
    expect(path.some((p) => p.y < 2 && p.x === 2)).toBe(false);
    // Endpoints correct.
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it('returns null when goal is unreachable', () => {
    const grid = walkableFromGrid([
      [T, T, F, T, T],
      [T, T, F, T, T],
      [T, T, F, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).toBeNull();
  });

  it('returns null when start is on an unwalkable tile', () => {
    const grid = walkableFromGrid([
      [F, T, T],
      [T, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 1 });
    expect(path).toBeNull();
  });

  it('returns null when goal is on an unwalkable tile', () => {
    const grid = walkableFromGrid([
      [T, T, F],
      [T, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toBeNull();
  });

  it('rejects out-of-bounds coordinates', () => {
    const grid = walkableFromGrid([
      [T, T],
      [T, T],
    ]);
    expect(findPath(grid, { x: -1, y: 0 }, { x: 1, y: 1 })).toBeNull();
    expect(findPath(grid, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeNull();
  });

  it('only steps in cardinal directions (no diagonals)', () => {
    const grid = walkableFromGrid([
      [T, T, T],
      [T, T, T],
      [T, T, T],
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).not.toBeNull();
    if (!path) throw new Error('unreachable');
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (!a || !b) throw new Error('path entry missing');
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      // Cardinal step only.
      expect(dx + dy).toBe(1);
    }
  });

  it('respects the iteration cap when given a pathological grid', () => {
    const grid = walkableFromGrid([
      [T, T, T],
      [T, T, T],
      [T, T, T],
    ]);
    // Cap below the minimum required to reach the goal — should bail out.
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 }, 1);
    expect(path).toBeNull();
  });
});
