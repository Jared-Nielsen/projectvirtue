# @br/types

Shared TypeScript types for Project Virtue. **This is the eventual protobuf
codegen target** (see Doc #22 §4.5).

## Status

Hand-written for Phase 2 of the frontend scaffold. The wire protocol is not
yet frozen; types here reflect the *intent* of the future `/shared/proto`
definitions and may shift before the W5–W6 protocol freeze.

## Parity expectations

- Field names + casing + nullability must align with the eventual `.proto`.
- TS uses `camelCase`; the protobuf-JSON canonical mapping handles
  conversion from `snake_case` source automatically.
- Branded ID types (`CharacterId`, `ShardId`, …) are nominal at the TS level
  and erase to `string` on the wire.
- `readonly` is used liberally — wire-derived state should not be mutated by
  view code.

## When codegen lands

The plan (Doc #22 §4.5):

1. `.proto` files added under `/shared/proto`.
2. `ts-proto` (or equivalent) codegens TS bindings to a generated tree.
3. The generated tree replaces this `src/` directory; `@br/types` then
   re-exports from it.
4. Any consumer that depended on a hand-written field that is missing or
   shaped differently in codegen output gets a typecheck error and is fixed
   at the call site.

## Runtime validation

Not present in this package. When Zod/Valibot is chosen, schemas land
alongside the types (e.g. `auth.schema.ts`) and `/packages/mocks` validates
JSON payloads at the boundary. Until then, JSON files are typechecked by
construction at the consumer (the `MockClient` casts the loaded data to the
right type).
