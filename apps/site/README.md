# @br/site — Project Virtue marketing website

The public-facing site for Britannia Reborn / Project Virtue. Drives signups,
hosts the dev journal, and shows shard status.

## Stack

- **Solid.js 1.9** + **@solidjs/router 0.16** (file-component routes, SPA mode)
- **Vite 5** for dev, build, and preview
- **TypeScript 5.6 strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` ON)
- **Biome** for lint + format
- **Vitest** for unit tests
- Workspace deps: `@br/ui`, `@br/types`, `@br/mocks`, `@br/icons`

## Framework decision: plain Vite SPA (deliberate fallback from Solid Start SSG)

Phase 4 of the execution plan asked for **Solid Start SSG** with a fallback
to "vite-based SPA with prerender" if Solid Start proved a poor fit.

We evaluated `@solidjs/start@1.3.2` and chose to fall back deliberately:

- Solid Start's runtime dep (Vinxi + Nitro + h3 + tinyglobby + radix3 + ...)
  is significantly heavier than the rest of the monorepo's Vite-only setup
  and would diverge `apps/site` from `apps/web`'s build / typecheck / test
  contract (`tsc -b && vite build`, vitest jsdom, biome).
- Vinxi has its own tsconfig assumptions that conflict with the monorepo's
  project-references graph.
- A static marketing site of 8 pages does not need a meta-framework — the
  trade-off in operational complexity isn't justified for our scope.

**What we ship instead:**

- Single `vite build` output to `dist/` with the SPA entry from `index.html`.
- `@solidjs/router`'s built-in static-router fallback (`isServer` switches the
  Router to `StaticRouter` automatically) is left in place so a future
  prerender step can be bolted on without rewriting routes — see "Future SSG"
  below.
- Vercel/Netlify-style SPA fallback (`/(.*)` → `/index.html`) handles deep
  links cleanly until prerender is added.

The trade-offs we accept:
- First page render is JS-driven; crawlers without JS see only the static
  meta tags in `index.html` and the empty `<div id="root">`. Modern Google /
  Bing render JS, but specialty crawlers (LinkedIn previewer, Slack
  unfurler, etc.) read the static OG tags from `index.html`.
- `sitemap.xml` is a static file that lists every page known at build time;
  per-post OG images are not generated (single OG image per build).

### Future SSG

When SSG becomes a hard requirement (e.g. for SEO competition or for a
Lighthouse SEO score lock above 95), we have two cheap upgrade paths:

1. **Per-route `renderToStringAsync` step** — add a `scripts/prerender.ts`
   that imports `App` for SSR, walks the route table, and writes
   `dist/<route>/index.html` files. About a half-day of work; no router
   changes required.
2. **Migrate to Solid Start later** — once Vinxi stabilises and our other
   apps adopt it, fold the routes/components into `@solidjs/start`'s
   convention.

## Scripts

```bash
pnpm --filter @br/site dev        # vite dev on :5174
pnpm --filter @br/site build      # tsc + vite build → dist/
pnpm --filter @br/site preview    # serve the built dist on :4174
pnpm --filter @br/site typecheck  # tsc --noEmit
pnpm --filter @br/site lint       # biome check
pnpm --filter @br/site test       # vitest --passWithNoTests
```

## Routes

| Path | Page | Notes |
| ---- | ---- | ----- |
| `/` | Home | Hero, trailer placeholder, feature grid, newsletter strip |
| `/about` | About | Lore intro, creators, philosophy |
| `/features` | Features | Six pillars (virtue, world, UGC, GM, voice, crossplay) |
| `/worlds` | Worlds | Shard list (mocked from `@br/mocks` shards/list + status) |
| `/worlds/map` | World Map | Interactive SVG map (zoom / pan / region detail) |
| `/journal` | Journal | Dev blog index with tag filter |
| `/journal/:slug` | Journal post | Mocked posts in `src/data/journal-posts.ts` |
| `/media` | Media gallery | Filter by kind, lightbox, press kit stub |
| `/join` | Join a World | Email + shard preference form |

## What's mocked vs. real

| Feature | Status | Real swap path |
| ------- | ------ | -------------- |
| Shard list / status | `@br/mocks` fixtures (`loadShards`, `loadShardStatus`) | Phase 2 backend wires `MockClient` → real `ShardService` |
| Newsletter signup | `console.info` + simulated 600 ms latency | Wire to a hosted form provider (ConvertKit / Beehiiv) |
| Join-a-world signup | Same as above; tracks `join_signup` analytics event | Same |
| Analytics | Plausible-shaped no-op (`src/lib/analytics.ts`) | Replace `track()` body with real Plausible POST |
| Cookie consent | localStorage-backed (`br.consent.v1`) | None — already production-shaped per Doc #38 |
| Press kit download | Stub link to `/press-kit.pdf` | Drop the real PDF in `public/` |
| Media gallery images | SVG placeholders in `public/media/` | Drop in optimized webp/avif from `_conceptart` pipeline |

## Compliance

Cookie / privacy banner per Doc #38 (GDPR baseline). Analytics is **default
OFF** (`hasAnalyticsConsent()` returns false until the visitor accepts).
Decline persists so we don't re-prompt; the footer's "Reset cookie
preferences" link clears the record.

## Deploy

Default target: **Vercel** (see `vercel.json`). The SPA fallback rewrite is
configured. To deploy:

```bash
vercel link
vercel --prod
```

**Netlify alternative** — equivalent config (drop into `netlify.toml`):

```toml
[build]
  command = "pnpm --filter @br/site build"
  publish = "apps/site/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Lighthouse goal

Target ≥ 95 across the board. Implementation choices that support this:
- All `<img>` tags use `loading="lazy"` + `decoding="async"` + explicit dimensions.
- Hero background is an inline-SVG-shaped `<div>` (no LCP-blocking JS).
- Logo/sigil is inline SVG (no extra request).
- Color contrast passes WCAG AA against the dark background (sigil-200/300
  on dungeon-600/700, parchment-50/100 for body type).
- Skip link, semantic landmarks (`<header>`, `<main>`, `<footer>`,
  `<nav aria-label>`), focus-visible outlines.
- Reduced-motion media query disables animations.
- Cookie banner does not block first paint (it appears after onMount).

A real Lighthouse run can be done after deploy.
