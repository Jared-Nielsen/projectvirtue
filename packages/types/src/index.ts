/**
 * @br/types — shared TypeScript types for Britannia Reborn.
 *
 * This package is the **eventual protobuf codegen target**. Every type here is
 * hand-written for the Phase 2 mock layer, but each file is structured to
 * mirror the eventual `/shared/proto` definitions described in Doc #22 §4.5
 * (Wire Protocol as Source of Truth). When `ts-proto` codegen lands the
 * hand-written sources in this directory are deleted and the codegen target
 * replaces them.
 *
 * Conventions
 * - Branded string types for IDs (nominal in TS, plain string on the wire).
 * - `readonly` everywhere for arrays/objects — these are wire-derived.
 * - Field names + casing + nullability match the eventual `.proto` (camelCase
 *   in TS; protobuf JSON mapping converts from snake_case automatically).
 * - No runtime validation in this package. TODO(zod): when validation lands,
 *   the schemas live alongside (e.g. `auth.schema.ts`) and are imported by
 *   /packages/mocks at the boundary.
 */

export * from './common';
export * from './auth';
export * from './account';
export * from './shard';
export * from './world';
export * from './character';
export * from './inventory';
export * from './quest';
export * from './book';
export * from './dialog';
export * from './combat';
export * from './economy';
export * from './social';
export * from './voice';
export * from './options';
export * from './levelup';
export * from './loading';
export * from './discord';
export * from './gm';
export * from './telemetry';
