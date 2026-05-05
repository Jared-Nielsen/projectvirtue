import { describe, expect, it } from 'vitest';
import { cueForPath } from './useRouteSound';

describe('cueForPath', () => {
  it('returns menu-enter for landing/login', () => {
    expect(cueForPath('/')).toBe('menu-enter');
    expect(cueForPath('/login')).toBe('menu-enter');
  });

  it('returns menu-back for /home and /character*', () => {
    expect(cueForPath('/home')).toBe('menu-back');
    expect(cueForPath('/character')).toBe('menu-back');
    expect(cueForPath('/character/create')).toBe('menu-back');
  });

  it('returns loading-veil for /loading/:variant', () => {
    expect(cueForPath('/loading/marine')).toBe('loading-veil');
    expect(cueForPath('/loading/dungeon')).toBe('loading-veil');
  });

  it('returns modal-open for play overlays', () => {
    expect(cueForPath('/play/inventory')).toBe('modal-open');
    expect(cueForPath('/play/journal')).toBe('modal-open');
    expect(cueForPath('/play/options')).toBe('modal-open');
    expect(cueForPath('/play/dialog/lord-british')).toBe('modal-open');
    expect(cueForPath('/play/loot/chest-1')).toBe('modal-open');
    expect(cueForPath('/play/levelup')).toBe('modal-open');
    expect(cueForPath('/play/book/the-virtues')).toBe('modal-open');
  });

  it('returns play-enter for the bare /play route', () => {
    expect(cueForPath('/play')).toBe('play-enter');
    expect(cueForPath('/play/combat')).toBe('play-enter');
  });

  it('returns silence for unknown paths', () => {
    expect(cueForPath('/nonsense')).toBe('silence');
  });
});
