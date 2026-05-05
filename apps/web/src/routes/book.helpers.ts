// Pure helpers for the Book reader. Pages render two-up; this file just
// computes the spread window and total count so the test can validate
// boundary behavior (single-page books, odd page counts, etc.).

import type { BookPage } from '@br/types';

/** Total spread (two-page) count for a given page count. */
export function totalSpreads(pageCount: number): number {
  if (pageCount <= 0) return 1;
  return Math.ceil(pageCount / 2);
}

export interface SpreadWindow {
  readonly left: BookPage | undefined;
  readonly right: BookPage | undefined;
}

/** Pages visible at a given spread index (0-based). */
export function pageWindow(pages: readonly BookPage[], spread: number): SpreadWindow {
  const li = spread * 2;
  const ri = li + 1;
  const left = li >= 0 && li < pages.length ? pages[li] : undefined;
  const right = ri >= 0 && ri < pages.length ? pages[ri] : undefined;
  return { left, right };
}
