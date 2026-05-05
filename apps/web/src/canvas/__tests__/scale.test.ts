import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SCALE_MODE,
  SCALE_MODES,
  getActiveScaleMode,
  getScaleMode,
  isoMetricsFor,
} from '../scale';

describe('scale mode registry', () => {
  it('exposes both presets keyed by id', () => {
    expect(SCALE_MODES['kenney-miniature']).toBeDefined();
    expect(SCALE_MODES['ultima-vii']).toBeDefined();
    expect(SCALE_MODES['kenney-miniature'].id).toBe('kenney-miniature');
    expect(SCALE_MODES['ultima-vii'].id).toBe('ultima-vii');
  });

  it('default is kenney-miniature while we develop against the Kenney art', () => {
    expect(DEFAULT_SCALE_MODE).toBe('kenney-miniature');
  });

  it('kenney mode renders chunkier than ultima-vii (larger tile pixels)', () => {
    const kenney = SCALE_MODES['kenney-miniature'];
    const u7 = SCALE_MODES['ultima-vii'];
    expect(kenney.tile.w).toBeGreaterThan(u7.tile.w);
    expect(kenney.tile.h).toBeGreaterThan(u7.tile.h);
  });

  it('keeps the iso 2:1 aspect ratio in every preset', () => {
    for (const mode of Object.values(SCALE_MODES)) {
      expect(mode.tile.w).toBe(mode.tile.h * 2);
    }
  });
});

describe('getScaleMode()', () => {
  it('returns the requested mode when valid', () => {
    expect(getScaleMode('ultima-vii').id).toBe('ultima-vii');
    expect(getScaleMode('kenney-miniature').id).toBe('kenney-miniature');
  });

  it('falls back to the default when given undefined or null', () => {
    expect(getScaleMode().id).toBe(DEFAULT_SCALE_MODE);
    expect(getScaleMode(null).id).toBe(DEFAULT_SCALE_MODE);
  });
});

describe('isoMetricsFor()', () => {
  it('projects ScaleMode.tile into the IsoMetrics shape that tiles.ts consumes', () => {
    expect(isoMetricsFor(SCALE_MODES['kenney-miniature'])).toEqual({ tileW: 128, tileH: 64 });
    expect(isoMetricsFor(SCALE_MODES['ultima-vii'])).toEqual({ tileW: 64, tileH: 32 });
  });
});

describe('getActiveScaleMode() override resolution', () => {
  const realLocation = window.location;
  const realStorage = window.localStorage;

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
  });

  it('returns default when no override exists', () => {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, search: '' },
      configurable: true,
    });
    expect(getActiveScaleMode().id).toBe(DEFAULT_SCALE_MODE);
  });

  it('honours ?scale=ultima-vii on the URL', () => {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, search: '?scale=ultima-vii' },
      configurable: true,
    });
    expect(getActiveScaleMode().id).toBe('ultima-vii');
  });

  it('honours pv.canvas.scaleMode in localStorage when no URL override is present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, search: '' },
      configurable: true,
    });
    window.localStorage.setItem('pv.canvas.scaleMode', 'ultima-vii');
    expect(getActiveScaleMode().id).toBe('ultima-vii');
  });

  it('URL override beats localStorage', () => {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, search: '?scale=kenney-miniature' },
      configurable: true,
    });
    window.localStorage.setItem('pv.canvas.scaleMode', 'ultima-vii');
    expect(getActiveScaleMode().id).toBe('kenney-miniature');
  });

  it('ignores unknown scale ids and returns default', () => {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, search: '?scale=hexagon-tiles-experimental' },
      configurable: true,
    });
    expect(getActiveScaleMode().id).toBe(DEFAULT_SCALE_MODE);
  });
});
