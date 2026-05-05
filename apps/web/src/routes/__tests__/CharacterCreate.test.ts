import { describe, expect, it } from 'vitest';
import {
  STAT_KEYS,
  STEPS,
  bonusFor,
  rollStats,
  virtueStarterBonus,
} from '../characterCreate.helpers';

describe('characterCreate.helpers', () => {
  describe('virtueStarterBonus', () => {
    it('returns all-zero stats for balance', () => {
      const b = virtueStarterBonus('balance');
      for (const k of STAT_KEYS) expect(b[k]).toBe(0);
    });

    it('courage lifts strength, dexterity, and constitution by +1 each', () => {
      const b = virtueStarterBonus('courage');
      expect(b.strength).toBe(1);
      expect(b.dexterity).toBe(1);
      expect(b.constitution).toBe(1);
      expect(b.intelligence).toBe(0);
      expect(b.wisdom).toBe(0);
      expect(b.charisma).toBe(0);
    });

    it('humility lifts wisdom but tempers charisma', () => {
      const b = virtueStarterBonus('humility');
      expect(b.wisdom).toBeGreaterThan(0);
      expect(b.charisma).toBeLessThan(0);
    });

    it('honor lifts strength most heavily', () => {
      const b = virtueStarterBonus('honor');
      // strength is the dominant axis, exceeds all others
      const others = (['dexterity', 'intelligence', 'wisdom', 'charisma'] as const).map(
        (k) => b[k],
      );
      for (const o of others) expect(b.strength).toBeGreaterThan(o);
    });
  });

  describe('rollStats', () => {
    it('returns deterministic stats for the same seed', () => {
      const a = rollStats(7);
      const b = rollStats(7);
      for (const k of STAT_KEYS) expect(a[k]).toBe(b[k]);
    });

    it('produces values in the [-2, +2] range', () => {
      for (let seed = 0; seed < 32; seed++) {
        const r = rollStats(seed);
        for (const k of STAT_KEYS) {
          expect(r[k]).toBeGreaterThanOrEqual(-2);
          expect(r[k]).toBeLessThanOrEqual(2);
        }
      }
    });

    it('changes when the seed changes', () => {
      const a = rollStats(1);
      const b = rollStats(2);
      const equal = STAT_KEYS.every((k) => a[k] === b[k]);
      expect(equal).toBe(false);
    });
  });

  describe('bonusFor', () => {
    it('renders +0 when neither roll nor virtue contribute', () => {
      // intentionally pass a fully-zero rolled stats so the only delta comes
      // from the virtue lookup.
      const zero = {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
        constitution: 0,
        wisdom: 0,
        charisma: 0,
      };
      expect(bonusFor('strength', 'balance', zero)).toBe('+0');
    });

    it('formats the roll component when virtue is silent', () => {
      const rolled = { ...rollStats(0), dexterity: 1 };
      const out = bonusFor('dexterity', 'balance', rolled);
      expect(out).toContain('roll +1');
    });

    it('formats both components when both apply', () => {
      const rolled = { ...rollStats(0), strength: -1 };
      const out = bonusFor('strength', 'honor', rolled);
      expect(out).toContain('roll -1');
      expect(out).toContain('honor +2');
    });
  });

  describe('STEPS', () => {
    it('has exactly 7 ordered steps', () => {
      expect(STEPS.map((s) => s.id)).toEqual([
        'race',
        'class',
        'name',
        'virtue',
        'stats',
        'portrait',
        'review',
      ]);
    });
  });
});
