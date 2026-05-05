import { describe, expect, it } from 'vitest';
import { LIBRARY_TILESET_URL, exportTmj } from '../lib/exportTmj';
import { LIBRARY_TILESET_PREFIX, parseTmj } from '../lib/importTmj';
import { applyPaint, makeInitialState } from '../state/editorState';

describe('parseTmj — happy path', () => {
  it('round-trips a populated state through export → parse', () => {
    let s = makeInitialState(16);
    s = applyPaint(s, 'ground', 0, 0, 1);
    s = applyPaint(s, 'ground', 5, 7, 9);
    s = applyPaint(s, 'decor', 1, 1, 5);
    s = applyPaint(s, 'decor', 15, 15, 13);
    const json = JSON.stringify(exportTmj(s));
    const result = parseTmj(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gridSize).toBe(16);
    expect(result.ground[0]).toBe(1);
    expect(result.ground[7 * 16 + 5]).toBe(9);
    expect(result.decor[16 + 1]).toBe(5);
    expect(result.decor[15 * 16 + 15]).toBe(13);
  });

  it('accepts every allowed grid size', () => {
    for (const size of [10, 16, 24] as const) {
      const json = JSON.stringify(exportTmj(makeInitialState(size)));
      const result = parseTmj(json);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.gridSize).toBe(size);
    }
  });

  it('accepts any tileset URL under the library R2 prefix', () => {
    const map = exportTmj(makeInitialState(10), {
      tilesetSource: `${LIBRARY_TILESET_PREFIX}library-v2.tsj`,
    });
    const result = parseTmj(JSON.stringify(map));
    expect(result.ok).toBe(true);
  });
});

describe('parseTmj — failures', () => {
  it('rejects invalid JSON', () => {
    const r = parseTmj('not valid {json');
    expect(r.ok).toBe(false);
  });

  it('rejects a non-map document', () => {
    const r = parseTmj(JSON.stringify({ type: 'tileset' }));
    expect(r.ok).toBe(false);
  });

  it('rejects an orthogonal map', () => {
    const map = { ...exportTmj(makeInitialState(10)), orientation: 'orthogonal' };
    const r = parseTmj(JSON.stringify(map));
    expect(r.ok).toBe(false);
  });

  it('rejects a non-square map', () => {
    const map = exportTmj(makeInitialState(10));
    const broken = { ...map, width: 10, height: 16 };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });

  it('rejects an unsupported grid size (e.g. 32×32)', () => {
    const broken = {
      ...exportTmj(makeInitialState(16)),
      width: 32,
      height: 32,
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          width: 32,
          height: 32,
          data: new Array(32 * 32).fill(0),
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
        },
        {
          type: 'tilelayer',
          id: 2,
          name: 'decor',
          width: 32,
          height: 32,
          data: new Array(32 * 32).fill(0),
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
        },
      ],
    };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });

  it('rejects unknown tileset URLs', () => {
    const map = exportTmj(makeInitialState(10), {
      tilesetSource: 'https://example.com/some/other.tsj',
    });
    const r = parseTmj(JSON.stringify(map));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/library/i);
  });

  it('rejects when ground layer is missing', () => {
    const map = exportTmj(makeInitialState(10));
    const broken = { ...map, layers: [map.layers[1]] };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });

  it('rejects when decor layer is missing', () => {
    const map = exportTmj(makeInitialState(10));
    const broken = { ...map, layers: [map.layers[0]] };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });

  it('rejects layer data with wrong length', () => {
    const map = exportTmj(makeInitialState(10));
    const broken = {
      ...map,
      layers: [{ ...map.layers[0], data: [1, 2, 3] }, map.layers[1]],
    };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });

  it('rejects negative GIDs in layer data', () => {
    const map = exportTmj(makeInitialState(10));
    const data = new Array(100).fill(0);
    data[0] = -1;
    const broken = {
      ...map,
      layers: [{ ...map.layers[0], data }, map.layers[1]],
    };
    const r = parseTmj(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });
});

describe('parseTmj — sanity check on the canonical export URL', () => {
  it('accepts the default LIBRARY_TILESET_URL', () => {
    expect(LIBRARY_TILESET_URL.startsWith(LIBRARY_TILESET_PREFIX)).toBe(true);
  });
});
