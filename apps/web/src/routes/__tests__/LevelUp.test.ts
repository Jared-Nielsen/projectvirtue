import { describe, expect, it } from 'vitest';
import { applyDelta, totalAllocated, zeroStatAllocation } from '../levelUp.helpers';

describe('levelUp.helpers', () => {
  describe('zeroStatAllocation', () => {
    it('returns a fully-zeroed allocation', () => {
      const a = zeroStatAllocation();
      expect(totalAllocated(a)).toBe(0);
    });
  });

  describe('applyDelta', () => {
    it('increments a stat when budget allows', () => {
      const a = zeroStatAllocation();
      const next = applyDelta(a, 'strength', 1, 3);
      expect(next.strength).toBe(1);
      expect(totalAllocated(next)).toBe(1);
    });

    it('refuses to exceed the budget', () => {
      let a = zeroStatAllocation();
      a = applyDelta(a, 'strength', 1, 2);
      a = applyDelta(a, 'strength', 1, 2);
      // Third increment would breach the budget — should be a no-op
      const blocked = applyDelta(a, 'wisdom', 1, 2);
      expect(blocked).toBe(a);
      expect(totalAllocated(blocked)).toBe(2);
    });

    it('refuses to drop below zero', () => {
      const a = zeroStatAllocation();
      const blocked = applyDelta(a, 'strength', -1, 3);
      expect(blocked).toBe(a);
    });

    it('decrements when value is positive', () => {
      let a = zeroStatAllocation();
      a = applyDelta(a, 'strength', 1, 3);
      a = applyDelta(a, 'strength', -1, 3);
      expect(a.strength).toBe(0);
    });

    it('preserves existing values when patching another key', () => {
      let a = zeroStatAllocation();
      a = applyDelta(a, 'strength', 1, 3);
      a = applyDelta(a, 'wisdom', 1, 3);
      expect(a.strength).toBe(1);
      expect(a.wisdom).toBe(1);
    });
  });
});
