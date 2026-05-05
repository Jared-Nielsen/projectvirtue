# @br/site — Project Virtue marketing website

The public-facing site for Project Virtue. Drives signups, hosts the dev journal,
and shows shard status.

## Stack

- **Astro 5.18** with `output: 'static'` — pure HTML per route, near-zero JS on
  non-interactive pages, perfect for SEO.
- **`@astrojs/solid-js`** for hydrated islands (interactive pieces only).
- **`@astrojs/sitemap`** to autogenerate `sitemap-index.xml` at build time.
- **TypeScript 5.6 strict** (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `useUnknownInCatchVariables` ON).
- **Solid.js 1.9** as the islands runtime.
- **Biome 1.9** for lint + format.
- **Vitest 2** for unit tests of `src/lib/`.
- Workspace deps: `@br/ui`, `@br/types`, `@br/mocks`, `@br/icons`.

## Framework decision: Astro 5 static + Solid islands

Phase 4 of the original execution plan asked for SSG. We initially landed on a
plain Vite + Solid SPA with a Netlify SPA fallback redirect, deferring SSG. We
have now replaced that with Astro because:

- **SEO is a hard requirement.** Astro emits a real `<html>` document per
  route with all `<head>` meta, full body content, and the JSON-LD payload —
  crawlers (Google, Bing, LinkedIn, Slack) read everything without executing
  JS. The Vite SPA shipped only static `<head>` meta and an empty
  `<div id="root">` — JS-driven Google rendering covers most of the gap, but
  not all crawlers, and we wanted a Lighthouse SEO lock above 95.
- **Near-zero JS on non-interactive pages.** A request to `/about` or
  `/features` ships HTML + CSS only; no Solid runtime, no router shim. The
  homepage, About, Features, Worlds, Worlds/Map (frame), Journal, individual
  Journal posts, Media (static fallback), and 404 pages have nothing to
  hydrate by default.
- **Solid is preserved for interactive pieces** as `@astrojs/solid-js`
  islands hydrated `client:visible` or `client:idle`.
- **One static deploy artefact.** `astro build` produces `dist/` with
  per-route HTML files. Netlify serves directly — no SPA fallback redirect,
  so 404s are real 404s.

## Architecture

```
apps/site/
├── astro.config.mjs                  # solid + sitemap integrations, site URL
├── netlify.toml                      # publish = apps/site/dist (no SPA fallback)
├── tsconfig.json                     # extends astro/tsconfigs/strict
├── public/                           # robots.txt, favicon, og-image, hero-vista, media SVGs
├── src/
│   ├── content/                      # content collections
│   │   ├── config.ts                 # journal collection schema
│   │   └── journal/*.md              # 5 journal posts (frontmatter + Markdown body)
│   ├── data/                         # static TS data (features, media, world-regions)
│   ├── layouts/BaseLayout.astro      # full <head> SEO + skip link + header/footer/cookie
│   ├── pages/                        # one .astro per route; Astro handles routing
│   │   ├── index.astro                  # /
│   │   ├── about.astro                  # /about
│   │   ├── features.astro               # /features
│   │   ├── worlds/index.astro           # /worlds
│   │   ├── worlds/map.astro             # /worlds/map
│   │   ├── journal/index.astro          # /journal
│   │   ├── journal/[slug].astro         # /journal/<slug> via getStaticPaths()
│   │   ├── media.astro                  # /media
│   │   ├── join.astro                   # /join
│   │   └── 404.astro                    # /404
│   ├── components/                   # static .astro components (zero JS)
│   │   ├── Header.astro              # desktop nav + tiny inline menu-toggle script
│   │   ├── Footer.astro              # links + reset-consent inline script
│   │   ├── Logo.astro                # inline SVG sigil
│   │   ├── FeatureCard.astro
│   │   ├── JournalPostCard.astro
│   │   ├── MediaGalleryItem.astro
│   │   └── ShardCard.astro
│   ├── islands/                      # Solid components hydrated client-side
│   │   ├── CookieBanner.tsx          # client:idle (after first paint)
│   │   ├── NewsletterForm.tsx        # client:visible
│   │   ├── JoinForm.tsx              # client:visible
│   │   ├── WorldMap.tsx              # client:visible (zoom/pan SVG)
│   │   ├── MediaGallery.tsx          # client:visible (filter pills + lightbox)
│   │   └── JournalFilter.tsx         # client:visible (CSS-attribute-driven filter)
│   ├── lib/
│   │   ├── analytics.ts              # Plausible-shaped no-op (consent-gated)
│   │   ├── consent.ts                # localStorage-backed GDPR record
│   │   ├── consent.test.ts           # vitest jsdom unit test
│   │   └── mock-client.ts            # synchronous fixtures.* loader from @br/mocks
│   └── styles/global.css             # global tokens + .container, .cta, .skip-link, etc.
```

## Key SEO decisions

1. **Static-by-default.** `output: 'static'` produces pure HTML per route.
2. **`<head>` SEO** in `BaseLayout.astro`: title, description, canonical,
   `og:type/title/description/image/url`, `og:locale`, `og:site_name`,
   `twitter:card/title/description/image`, theme-color, favicon, viewport,
   language. Per-page values via `Astro.props`.
3. **JSON-LD** emitted by `BaseLayout.astro` when a `jsonLd` prop is passed.
   The homepage emits `@type: WebSite`; each journal post emits
   `@type: BlogPosting`.
4. **Sitemap** autogenerated by `@astrojs/sitemap` at `/sitemap-index.xml`,
   referenced by `public/robots.txt`. The previous static `public/sitemap.xml`
   has been removed.
5. **Real 404.html** at the top of `dist/`. The old SPA fallback redirect
   has been removed from `netlify.toml`.
6. **Shard data** for the `/worlds` page is loaded at build time from
   `@br/mocks` fixtures — included in the SSR'd HTML, no JS shipped.

## Solid-island vs static-Astro split

| Component | Mode | Why |
| --- | --- | --- |
| Header (desktop nav + active link) | Static .astro | Just links and CSS |
| Header mobile menu toggle | Inline `<script>` | Tiny progressive enhancement |
| Footer + reset-consent button | Static .astro + inline `<script>` | One DOM event |
| Logo / FeatureCard / JournalPostCard / MediaGalleryItem / ShardCard | Static .astro | Render-only |
| CookieBanner | Solid `client:idle` | localStorage gate, dismiss state |
| NewsletterForm | Solid `client:visible` | Form state + submission |
| JoinForm | Solid `client:visible` | Multi-field form state |
| WorldMap | Solid `client:visible` | Zoom/pan/select interaction |
| MediaGallery | Solid `client:visible` | Filter pills + lightbox modal |
| JournalFilter | Solid `client:visible` | Sets a `data-filter` attr; CSS does the rest |

## Scripts

```bash
pnpm --filter @br/site dev        # astro dev on :5174
pnpm --filter @br/site build      # astro build → dist/
pnpm --filter @br/site preview    # serve the built dist on :4174
pnpm --filter @br/site typecheck  # astro check (TS + .astro template typecheck)
pnpm --filter @br/site lint       # biome check
pnpm --filter @br/site test       # vitest --run on src/lib/
```

## Routes

| Path | Page | Notes |
| ---- | ---- | ----- |
| `/` | Home | Hero, trailer placeholder, feature grid, newsletter strip |
| `/about` | About | Lore intro, creators, philosophy |
| `/features` | Features | Six pillars (virtue, world, UGC, GM, voice, crossplay) |
| `/worlds` | Worlds | Shard list (build-time from `@br/mocks`) |
| `/worlds/map` | World Map | Interactive SVG map (zoom / pan / region detail) |
| `/journal` | Journal | Dev blog index with category filter |
| `/journal/:slug` | Journal post | Markdown content collection in `src/content/journal/` |
| `/media` | Media gallery | Filter by kind, lightbox, press kit stub |
| `/join` | Join a World | Email + shard preference form |

## What's mocked vs. real

| Feature | Status | Real swap path |
| ------- | ------ | -------------- |
| Shard list / status | `@br/mocks` fixtures (build-time) | Phase 2 backend wires `MockClient` → real `ShardService`. Either re-build to pick up new shards, or move the page to ISR / `output: 'server'`. |
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

Target: **Netlify** (`https://virtu3.com`, see `netlify.toml`). Build
command, publish dir, security headers, and long-cache asset rules are
configured. To deploy:

```bash
netlify link            # one-time: associate this dir with a Netlify site
netlify deploy --prod   # publish the latest local build
```

CI runs `pnpm --filter @br/site build` and Netlify picks up the `apps/site/dist`
output. The `netlify.toml` keys to:

- `base = "."` — repo root, so pnpm workspaces resolve from one place.
- `publish = "apps/site/dist"` — Astro's static output dir.
- `NODE_VERSION = "24"` + `PNPM_VERSION = "10"` so Netlify's build image
  matches `.nvmrc` / `package.json` engines.

## Lighthouse goal

Target ≥ 95 across the board. Astro static output gets us most of the way:

- All `<img>` tags use `loading="lazy"` + `decoding="async"` + explicit dimensions.
- Hero background is a CSS-image-shaped `<div>` (no LCP-blocking JS).
- Logo/sigil is inline SVG (no extra request).
- Color contrast passes WCAG AA against the dark background.
- Skip link, semantic landmarks, focus-visible outlines.
- Reduced-motion media query disables animations.
- Cookie banner does not block first paint (`client:idle`).
