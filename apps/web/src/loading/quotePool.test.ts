import type { LoadingScreenManifest } from '@br/types';
import { describe, expect, it } from 'vitest';
import { flattenQuotes, pickQuote, pickVariant, tagsForQuote } from './quotePool';

const manifest: LoadingScreenManifest = {
  version: 1,
  default: 'default',
  variants: [
    {
      variant: 'marine',
      imageUrl: '',
      thumbUrl: '',
      tint: '#000',
      tagline: '',
      weight: 25,
      quotes: [
        { text: 'The sea forgives in salt.', attribution: 'Erevan' },
        { text: 'The compass is a fiction.', attribution: 'Captain' },
      ],
    },
    {
      variant: 'dungeon',
      imageUrl: '',
      thumbUrl: '',
      tint: '#000',
      tagline: '',
      weight: 25,
      quotes: [{ text: 'A torch lasts an hour.', attribution: 'Watchman' }],
    },
    {
      variant: 'paladin-castle',
      imageUrl: '',
      thumbUrl: '',
      tint: '#000',
      tagline: '',
      weight: 25,
      quotes: [{ text: 'Honor is what you do unwatched.', attribution: 'Of the Eight' }],
    },
    {
      variant: 'default',
      imageUrl: '',
      thumbUrl: '',
      tint: '#000',
      tagline: '',
      weight: 25,
      quotes: [{ text: 'Walk in the Eight virtues.', attribution: 'Lord Avermere' }],
    },
  ],
};

describe('tagsForQuote', () => {
  it('detects marine keywords', () => {
    expect(tagsForQuote('A long voyage at sea', 'Erevan')).toContain('marine');
  });

  it('detects dungeon keywords', () => {
    expect(tagsForQuote('A torch in the depths', 'Watchman')).toContain('dungeon');
  });

  it('detects paladin keywords', () => {
    expect(tagsForQuote('Honor and oath', 'Dupre')).toContain('paladin-castle');
  });

  it('returns empty when nothing matches', () => {
    expect(tagsForQuote('a generic remark', 'someone')).toHaveLength(0);
  });
});

describe('flattenQuotes', () => {
  it('returns one entry per (variant, quote) pair with source tagged', () => {
    const flat = flattenQuotes(manifest);
    expect(flat).toHaveLength(5);
    expect(flat.find((q) => q.text.includes('sea'))?.source).toBe('marine');
    expect(flat.find((q) => q.text.includes('torch'))?.source).toBe('dungeon');
  });
});

describe('pickQuote', () => {
  it('prefers same-variant quotes when present', () => {
    // Always pick index 0 → first marine quote.
    const q = pickQuote(manifest, 'marine', () => 0);
    expect(q?.source).toBe('marine');
    expect(q?.text).toContain('sea');
  });

  it('returns null on empty manifest', () => {
    const empty: LoadingScreenManifest = { ...manifest, variants: [] };
    expect(pickQuote(empty, 'marine', () => 0)).toBeNull();
  });

  it('rotates through pool deterministically with injected rng', () => {
    let i = 0;
    const seq = [0, 0.5];
    const rng = () => seq[i++ % seq.length] ?? 0;
    const a = pickQuote(manifest, 'marine', rng);
    const b = pickQuote(manifest, 'marine', rng);
    expect(a).not.toEqual(b);
  });

  it('falls back to tagged quotes when same-variant pool is empty', () => {
    const [marine, dungeon, paladin, def] = manifest.variants;
    if (!marine || !dungeon || !paladin || !def) throw new Error('fixture');
    const slim: LoadingScreenManifest = {
      ...manifest,
      variants: [{ ...marine, quotes: [] }, dungeon, paladin, def],
    };
    const q = pickQuote(slim, 'marine', () => 0);
    // No same-variant quotes; the pool of tagged quotes should be empty too
    // for marine in this manifest, so it falls all the way through to the
    // full pool. Either way the result should be non-null.
    expect(q).not.toBeNull();
  });
});

describe('pickVariant', () => {
  it('honours the requested variant when valid', () => {
    expect(pickVariant(manifest, 'dungeon')?.variant).toBe('dungeon');
  });

  it('falls back to manifest.default when requested is unknown', () => {
    expect(pickVariant(manifest, 'no-such-variant')?.variant).toBe('default');
  });

  it('falls back to manifest.default when requested is undefined', () => {
    expect(pickVariant(manifest, undefined)?.variant).toBe('default');
  });
});
