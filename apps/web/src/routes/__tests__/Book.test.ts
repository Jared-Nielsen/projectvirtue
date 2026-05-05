import type { BookPage } from '@br/types';
import { describe, expect, it } from 'vitest';
import { pageWindow, totalSpreads } from '../book.helpers';

const pages = (n: number): readonly BookPage[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    body: `Page ${i + 1}`,
  }));

describe('book.helpers', () => {
  describe('totalSpreads', () => {
    it('returns 1 for an empty book', () => {
      expect(totalSpreads(0)).toBe(1);
    });

    it('returns 1 for a single-page book', () => {
      expect(totalSpreads(1)).toBe(1);
    });

    it('returns 2 for a 3-page book', () => {
      expect(totalSpreads(3)).toBe(2);
    });

    it('returns 4 for a 7-page book', () => {
      expect(totalSpreads(7)).toBe(4);
    });
  });

  describe('pageWindow', () => {
    it('returns the first two pages at spread 0', () => {
      const w = pageWindow(pages(7), 0);
      expect(w.left?.body).toBe('Page 1');
      expect(w.right?.body).toBe('Page 2');
    });

    it('handles odd page counts at the last spread', () => {
      const w = pageWindow(pages(7), 3);
      expect(w.left?.body).toBe('Page 7');
      expect(w.right).toBeUndefined();
    });

    it('returns no pages past the end', () => {
      const w = pageWindow(pages(7), 99);
      expect(w.left).toBeUndefined();
      expect(w.right).toBeUndefined();
    });

    it('returns nothing for an empty book', () => {
      const w = pageWindow([], 0);
      expect(w.left).toBeUndefined();
      expect(w.right).toBeUndefined();
    });
  });
});
