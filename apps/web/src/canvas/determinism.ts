// Determinism harness placeholder.
//
// Per Doc #41 §3 the *authoritative* simulation eventually moves to a Rust
// service. The web client today does best-effort visuals and predicts
// click-to-move locally with an A* mock; in the eventual architecture:
//
//   - Server runs a fixed-step (e.g. 30 Hz) deterministic ECS in Rust.
//   - Server emits compact state diffs / replay frames over WebTransport
//     using a binary codec (MessagePack today, Protobuf in the wave-5 plan
//     per Doc #30 / Doc #40).
//   - Client interpolates render frames between server snapshots and
//     reconciles when its prediction diverges (rollback or snap, depending
//     on how loud the divergence is).
//   - Replays are recorded as the same diff stream + initial state hash;
//     deterministic Rust playback yields bit-identical state for testing.
//
// The hooks below stand in for that interface. They are intentionally no-ops
// today — wiring real prediction without a server would be premature and
// would constrain how the Rust integration shapes the API. Calling these
// functions has no observable effect; they exist so future code review
// against the design docs has a stable surface to upgrade.
//
// References:
//   - Doc #41 — Engine & Stack ADR §3 (server authority is non-negotiable)
//   - Doc #23 — Pathfinding & Spatial Systems (server is the source of truth
//     for path validation; the client A* in pathfinding.ts is a placeholder)
//   - Doc #30 — Replay format (MessagePack now, Protobuf wave-5)

export interface DeterminismFrame {
  /** Server tick this frame represents. 0 in the placeholder. */
  readonly tick: number;
  /** Hash of the simulation state. Empty in the placeholder. */
  readonly stateHash: string;
}

/** Submit the local prediction for reconciliation. No-op until server lands. */
export function submitPrediction(_frame: DeterminismFrame): void {
  // Intentionally empty — see file header.
}

/** Apply a server snapshot to local state. No-op until server lands. */
export function applySnapshot(_frame: DeterminismFrame): void {
  // Intentionally empty — see file header.
}

/** True once the deterministic simulation is on the wire. Always false today. */
export function isAuthoritative(): boolean {
  return false;
}

/**
 * Simulation tick rate. Locked here so client interpolation matches the
 * eventual server cadence. Update this to whatever the Rust service ships.
 */
export const SIMULATION_TICK_HZ = 30 as const;
