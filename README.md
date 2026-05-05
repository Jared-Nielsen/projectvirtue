# Britannia Reborn — Frontend Monorepo

UO-inspired MMORPG. Frontend-only repo (Solid + Vite + PixiJS). Backend is mocked
with static JSON via a future `MockClient`. See `_docs/Brittania Reborn_ 40-*` for
the canonical engineering plan and `_todo/todobatch2.txt` for the phased TODO list.

## Layout

```
apps/
  web/     game client (Solid + PixiJS)
  site/    marketing site (Solid)
packages/
  ui/      shared design system + Histoire workshop
  types/   shared TS types (eventual protobuf codegen target)
  mocks/   static JSON + MockClient
  icons/   icon set
tools/     build / codegen scripts
```

## Prerequisites

- Node **24** (see `.nvmrc` / `.node-version`)
- pnpm **10** (enable via `corepack enable && corepack prepare pnpm@10 --activate`)

## Commands

| Command            | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm install`     | Install all workspace deps                                            |
| `pnpm dev`         | Run dev servers for both apps in parallel                             |
| `pnpm build`       | Build every package + app                                             |
| `pnpm typecheck`   | Run `tsc --noEmit` across the workspace                               |
| `pnpm lint`        | Biome check (lint + format diff)                                      |
| `pnpm lint:fix`    | Biome check with autofix                                              |
| `pnpm format`      | Biome formatter write                                                 |
| `pnpm test`        | Vitest run mode across packages with tests                            |
| `pnpm preview`     | Vite preview for built apps                                           |
| `pnpm --filter @br/ui storybook` | Run Storybook 8 component workshop for `@br/ui`         |
| `pnpm --filter @br/ui build-storybook` | Build static Storybook to `packages/ui/storybook-static` |

Per-package commands work with pnpm filters, e.g. `pnpm --filter @br/web dev`.

## Phase status

Phases 0 (foundations) and 1 (design system + tokens) are complete. The
shared design system lives in `packages/ui` with Storybook 8 + storybook-solidjs
as the component workshop. Apps consume tokens via:

```ts
import { tokens, setTheme } from '@br/ui';
import '@br/ui/tokens.css'; // CSS custom properties on :root
```

Subsequent phases (2 onward) are tracked in `_todo/todobatch2.txt`.

## Roadmap

See `_todo/todobatch2.txt` for the full Phase 0–8 plan and agent split. The
canonical engineering plan lives in `_docs/Brittania Reborn_ 40-Implementation
Scaffolding & 12-Week Engineering Plan.md`.
