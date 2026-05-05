// Lore-quote rotation logic for the loading-screen variants.
//
// The mock manifest at `/v1/loading-screens` (sourced from
// `@br/mocks/loadingscreens/index.json`) gives us each variant with its own
// `quotes[]`. The canonical schema does not yet carry per-quote tags; we
// therefore derive variant affinity at runtime via a keyword heuristic so
// e.g. nautical quotes from any variant can play during the marine screen.
//
// FUTURE SCHEMA (do not modify the mock yet — owned by Wave 2 / Agent 2):
// add `quotes[].tags?: readonly LoadingVariant[]` so curators can pin a
// quote to a variant explicitly. When that lands, replace `tagsForQuote`
// with `quote.tags` and keep `pickQuote` as the single entry point.

import type { LoadingScreen, LoadingScreenManifest, LoadingVariant } from '@br/types';

export interface QuoteWithVariant {
  readonly text: string;
  readonly attribution: string;
  readonly source: LoadingVariant;
}

/** Per-variant keywords used to score quote affinity at runtime. */
const VARIANT_KEYWORDS: Readonly<Record<LoadingVariant, readonly string[]>> = {
  marine: ['sea', 'ship', 'tide', 'voyage', 'compass', 'wind', 'isle', 'sail', 'salt', 'port'],
  dungeon: ['torch', 'dungeon', 'dark', 'depths', 'goblin', 'cave', 'shadow', 'tomb', 'crypt'],
  'paladin-castle': [
    'honor',
    'oath',
    'shrine',
    'castle',
    'keep',
    'paladin',
    'virtue',
    'duty',
    'banner',
    'knight',
  ],
  default: ['codex', 'eight', 'virtues', 'avatar', 'avermere'],
};

/** Heuristic — return the variants this quote is thematically aligned with. */
export function tagsForQuote(text: string, attribution: string): readonly LoadingVariant[] {
  const haystack = `${text} ${attribution}`.toLowerCase();
  const matched: LoadingVariant[] = [];
  for (const [variant, keywords] of Object.entries(VARIANT_KEYWORDS) as readonly [
    LoadingVariant,
    readonly string[],
  ][]) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      matched.push(variant);
    }
  }
  return matched;
}

/** Flatten the manifest into a single weighted quote pool. */
export function flattenQuotes(manifest: LoadingScreenManifest): readonly QuoteWithVariant[] {
  const out: QuoteWithVariant[] = [];
  for (const variant of manifest.variants) {
    for (const quote of variant.quotes) {
      out.push({ text: quote.text, attribution: quote.attribution, source: variant.variant });
    }
  }
  return out;
}

/**
 * Pick a quote for the given variant. Algorithm:
 *  1. Prefer quotes whose `source` matches the variant.
 *  2. Otherwise prefer quotes whose keywords match the variant.
 *  3. Otherwise fall back to the full pool.
 *
 * The `rng` parameter is injected so unit tests can pin determinism.
 */
export function pickQuote(
  manifest: LoadingScreenManifest,
  variant: LoadingVariant,
  rng: () => number = Math.random,
): QuoteWithVariant | null {
  const pool = flattenQuotes(manifest);
  if (pool.length === 0) return null;

  const sameVariant = pool.filter((q) => q.source === variant);
  const tagged = pool.filter(
    (q) => q.source !== variant && tagsForQuote(q.text, q.attribution).includes(variant),
  );

  const tier = sameVariant.length > 0 ? sameVariant : tagged.length > 0 ? tagged : pool;
  const idx = Math.floor(rng() * tier.length);
  return tier[idx] ?? null;
}

/** Resolve a route's `:variant` param to a manifest entry, with default fallback. */
export function pickVariant(
  manifest: LoadingScreenManifest,
  requested: string | undefined,
): LoadingScreen | null {
  const validVariants: readonly LoadingVariant[] = [
    'marine',
    'dungeon',
    'paladin-castle',
    'default',
  ];
  const target: LoadingVariant = (validVariants as readonly string[]).includes(requested ?? '')
    ? (requested as LoadingVariant)
    : manifest.default;
  const exact = manifest.variants.find((v) => v.variant === target);
  if (exact) return exact;
  return manifest.variants[0] ?? null;
}
