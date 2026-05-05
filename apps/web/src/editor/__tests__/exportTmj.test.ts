import { describe, expect, it } from 'vitest';
import {
  LIBRARY_TILESET_URL,
  ORIENTATION,
  RENDER_ORDER,
  TILED_VERSION,
  TMJ_VERSION,
  exportTmj,
} from '../lib/exportTmj';
import { applyPaint, makeInitialState } from '../state/editorState';

describe('exportTmj — header', () => {
  it('emits the canonical Tiled isometric .tmj header', () => {
    const out = exportTmj(makeInitialState(16));
    expect(out.type).toBe('map');
    expect(out.version).toBe(TMJ_VERSION);
    expect(out.tiledversion).toBe(TILED_VERSION);
    expect(out.orientation).toBe(ORIENTATION);
    expect(out.renderorder).toBe(RENDER_ORDER);
    expect(out.width).toBe(16);
    expect(out.height).toBe(16);
    expect(out.tilewidth).toBe(256);
    expect(out.tileheight).toBe(128);
    expect(out.infinite).toBe(false);
  });

  it('references the external library tileset on R2', () => {
    const out = exportTmj(makeInitialState());
    expect(out.tilesets).toHaveLength(1);
    expect(out.tilesets[0]).toEqual({ firstgid: 1, source: LIBRARY_TILESET_URL });
  });

  it('size override applies to header + every layer', () => {
    const out = exportTmj(makeInitialState(10));
    expect(out.width).toBe(10);
    expect(out.height).toBe(10);
    for (const layer of out.layers) {
      expect(layer.width).toBe(10);
      expect(layer.height).toBe(10);
      expect(layer.data).toHaveLength(100);
    }
  });
});

describe('exportTmj — layers', () => {
  it('emits exactly two tilelayers named ground + decor in order', () => {
    const out = exportTmj(makeInitialState());
    expect(out.layers).toHaveLength(2);
    expect(out.layers[0]?.name).toBe('ground');
    expect(out.layers[1]?.name).toBe('decor');
    expect(out.layers[0]?.id).toBe(1);
    expect(out.layers[1]?.id).toBe(2);
  });

  it('writes painted cells into the data array at the correct row-major index', () => {
    let s = makeInitialState(10);
    s = applyPaint(s, 'ground', 0, 0, 11);
    s = applyPaint(s, 'ground', 9, 9, 22);
    s = applyPaint(s, 'decor', 4, 5, 33);
    const out = exportTmj(s);
    const ground = out.layers[0]?.data;
    const decor = out.layers[1]?.data;
    expect(ground?.[0]).toBe(11);
    expect(ground?.[99]).toBe(22);
    expect(decor?.[5 * 10 + 4]).toBe(33);
    // Empties are 0.
    expect(ground?.[1]).toBe(0);
    expect(decor?.[0]).toBe(0);
  });

  it('matches a known fixture exactly (snapshot of the export shape)', () => {
    let s = makeInitialState(10);
    s = applyPaint(s, 'ground', 0, 0, 1);
    s = applyPaint(s, 'decor', 1, 1, 5);
    const out = exportTmj(s);
    expect(out).toMatchObject({
      type: 'map',
      version: '1.10',
      tiledversion: '1.11.0',
      orientation: 'isometric',
      renderorder: 'right-down',
      width: 10,
      height: 10,
      tilewidth: 256,
      tileheight: 128,
      infinite: false,
      nextlayerid: 3,
      nextobjectid: 1,
      tilesets: [{ firstgid: 1, source: LIBRARY_TILESET_URL }],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          width: 10,
          height: 10,
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
        },
        {
          type: 'tilelayer',
          id: 2,
          name: 'decor',
          width: 10,
          height: 10,
        },
      ],
    });
    expect(out.layers[0]?.data[0]).toBe(1);
    expect(out.layers[1]?.data[11]).toBe(5);
  });
});
