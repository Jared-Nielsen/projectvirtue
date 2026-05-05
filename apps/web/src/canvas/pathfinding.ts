// Client-side A* pathfinding.
//
// PRODUCTION NOTE: Per Doc #23 (Pathfinding & Spatial Systems) the
// authoritative pathfinder runs on the server. The server is the only
// component allowed to validate movement against fog-of-war, dynamic
// obstacles, hostile-zone restrictions, and per-tile traversal costs that
// depend on entity capabilities. This client A* is a *prediction-only*
// placeholder so click-to-move feels responsive in the demo. When the real
// MovementService lands, the client still runs A* to lay down a predicted
// path for instant feedback, but the server result wins on conflict (rollback
// or snap).
//
// Implementation: standard 4-connected A* on a binary walkable grid with
// Manhattan heuristic. Diagonals are intentionally disabled — the iso tile
// renderer treats N/E/S/W as the canonical movement axes; diagonals can be
// expressed as two cardinal hops, which keeps the path costs uniform and
// avoids corner-cutting through impassable tiles. Worst-case complexity is
// O(N log N) for an N-cell grid; the binary heap below is sufficient for
// the 32x24 prototype map.

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface Walkable {
  readonly width: number;
  readonly height: number;
  /** Returns true if (x, y) can be traversed. Off-grid coords MUST return false. */
  isWalkable(x: number, y: number): boolean;
}

interface Node {
  readonly x: number;
  readonly y: number;
  readonly g: number;
  readonly f: number;
  readonly parent: Node | null;
}

/** Min-heap keyed by Node.f. */
class NodeHeap {
  private readonly data: Node[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: Node): void {
    this.data.push(node);
    this.siftUp(this.data.length - 1);
  }

  pop(): Node | undefined {
    const len = this.data.length;
    if (len === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (len > 1 && last !== undefined) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(i: number): void {
    let idx = i;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      const a = this.data[idx];
      const b = this.data[parent];
      if (a === undefined || b === undefined || a.f >= b.f) break;
      this.data[idx] = b;
      this.data[parent] = a;
      idx = parent;
    }
  }

  private siftDown(i: number): void {
    let idx = i;
    const n = this.data.length;
    for (;;) {
      const l = idx * 2 + 1;
      const r = l + 1;
      let smallest = idx;
      const sNode = this.data[smallest];
      const lNode = l < n ? this.data[l] : undefined;
      const rNode = r < n ? this.data[r] : undefined;
      if (lNode !== undefined && sNode !== undefined && lNode.f < sNode.f) smallest = l;
      const sNode2 = this.data[smallest];
      if (rNode !== undefined && sNode2 !== undefined && rNode.f < sNode2.f) smallest = r;
      if (smallest === idx) break;
      const a = this.data[idx];
      const b = this.data[smallest];
      if (a === undefined || b === undefined) break;
      this.data[idx] = b;
      this.data[smallest] = a;
      idx = smallest;
    }
  }
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Finds a walkable path from `start` to `goal`. Returns `null` when no path
 * exists. The returned path *includes* both endpoints, ordered start → goal.
 */
export function findPath(
  grid: Walkable,
  start: GridPoint,
  goal: GridPoint,
  maxIterations = 10_000,
): readonly GridPoint[] | null {
  if (!grid.isWalkable(start.x, start.y) || !grid.isWalkable(goal.x, goal.y)) {
    return null;
  }
  if (start.x === goal.x && start.y === goal.y) {
    return [{ x: start.x, y: start.y }];
  }

  const open = new NodeHeap();
  const seen = new Map<number, number>(); // packedKey -> bestG
  const key = (x: number, y: number): number => y * grid.width + x;

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    f: manhattan(start.x, start.y, goal.x, goal.y),
    parent: null,
  };
  open.push(startNode);
  seen.set(key(start.x, start.y), 0);

  let iter = 0;
  while (open.size > 0 && iter < maxIterations) {
    iter++;
    const current = open.pop();
    if (!current) break;
    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(current);
    }
    const currentG = current.g;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (!grid.isWalkable(nx, ny)) continue;
      const tentativeG = currentG + 1;
      const k = key(nx, ny);
      const prevG = seen.get(k);
      if (prevG !== undefined && prevG <= tentativeG) continue;
      seen.set(k, tentativeG);
      const f = tentativeG + manhattan(nx, ny, goal.x, goal.y);
      open.push({ x: nx, y: ny, g: tentativeG, f, parent: current });
    }
  }

  return null;
}

function reconstruct(end: Node): GridPoint[] {
  const out: GridPoint[] = [];
  let cur: Node | null = end;
  while (cur) {
    out.push({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  out.reverse();
  return out;
}

/** Convenience: build a Walkable view over a row-major boolean grid. */
export function walkableFromGrid(grid: readonly (readonly boolean[])[]): Walkable {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  return {
    width,
    height,
    isWalkable(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const row = grid[y];
      if (!row) return false;
      return row[x] === true;
    },
  };
}
