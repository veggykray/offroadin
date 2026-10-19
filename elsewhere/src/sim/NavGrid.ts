import type { Circle, FloorId, Rect } from '../config/p2Slice';
import { PLATFORMS, OBSTACLES } from '../config/p2Slice';
import { dist, type V2 } from './vec';

/**
 * Per-floor walkability grid with a clearance field, so each actor only uses cells that have
 * at least its own radius of free space around them (actor-sized route clearance).
 * Dynamic regions (bridge, lift float, shaft hole) are toggled and the clearance is rebuilt.
 */
export const CELL = 0.25;
const X0 = -20, Z0 = -11, X1 = 20, Z1 = 11;
const W = Math.round((X1 - X0) / CELL);
const H = Math.round((Z1 - Z0) / CELL);

export interface DynamicRegion { id: string; floor: FloorId; rect?: Rect; circle?: Circle; walkable: boolean; enabled: boolean }

export class NavGrid {
  readonly floor: FloorId;
  /** 1 = walkable base cell */
  private base = new Uint8Array(W * H);
  private walk = new Uint8Array(W * H);
  /** clearance in world units (distance to the nearest blocked cell centre) */
  private clearance = new Float32Array(W * H);
  private dynamics: DynamicRegion[] = [];
  private dirty = true;

  constructor(floor: FloorId) {
    this.floor = floor;
    for (const p of PLATFORMS) if (p.floor === floor) this.fillRect(this.base, p.rect, 1);
    for (const o of OBSTACLES) {
      if (o.floor !== floor) continue;
      if (o.rect) this.fillRect(this.base, o.rect, 0);
      if (o.circle) this.fillCircle(this.base, o.circle, 0);
    }
  }

  addDynamic(r: DynamicRegion): void { this.dynamics.push(r); this.dirty = true; }
  setDynamic(id: string, enabled: boolean): void {
    const d = this.dynamics.find((x) => x.id === id);
    if (d && d.enabled !== enabled) { d.enabled = enabled; this.dirty = true; }
  }
  isDynamicEnabled(id: string): boolean { return this.dynamics.find((x) => x.id === id)?.enabled ?? false; }

  private fillRect(a: Uint8Array, r: Rect, v: number): void {
    const cx0 = Math.max(0, Math.floor((r.x0 - X0) / CELL)), cx1 = Math.min(W - 1, Math.ceil((r.x1 - X0) / CELL) - 1);
    const cz0 = Math.max(0, Math.floor((r.z0 - Z0) / CELL)), cz1 = Math.min(H - 1, Math.ceil((r.z1 - Z0) / CELL) - 1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) a[z * W + x] = v;
  }
  private fillCircle(a: Uint8Array, c: Circle, v: number): void {
    const cx0 = Math.max(0, Math.floor((c.x - c.r - X0) / CELL)), cx1 = Math.min(W - 1, Math.ceil((c.x + c.r - X0) / CELL));
    const cz0 = Math.max(0, Math.floor((c.z - c.r - Z0) / CELL)), cz1 = Math.min(H - 1, Math.ceil((c.z + c.r - Z0) / CELL));
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      const wx = X0 + (x + 0.5) * CELL, wz = Z0 + (z + 0.5) * CELL;
      if (Math.hypot(wx - c.x, wz - c.z) <= c.r) a[z * W + x] = v;
    }
  }

  rebuild(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.walk.set(this.base);
    for (const d of this.dynamics) {
      if (!d.enabled) continue;
      if (d.rect) this.fillRect(this.walk, d.rect, d.walkable ? 1 : 0);
      if (d.circle) this.fillCircle(this.walk, d.circle, d.walkable ? 1 : 0);
    }
    // Multi-source BFS distance transform (chamfer 1 / sqrt2) from blocked cells.
    const INF = 1e9;
    const dmap = this.clearance;
    dmap.fill(INF);
    const qx = new Int32Array(W * H), qz = new Int32Array(W * H);
    let qh = 0, qt = 0;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (!this.walk[i]) { dmap[i] = 0; qx[qt] = x; qz[qt] = z; qt++; }
    }
    // Dijkstra-lite with two passes of chamfer is simpler: forward/backward raster scan.
    const c1 = CELL, c2 = CELL * Math.SQRT2;
    for (let pass = 0; pass < 2; pass++) {
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const i = z * W + x; let v = dmap[i];
        if (x > 0) v = Math.min(v, dmap[i - 1] + c1);
        if (z > 0) { v = Math.min(v, dmap[i - W] + c1); if (x > 0) v = Math.min(v, dmap[i - W - 1] + c2); if (x < W - 1) v = Math.min(v, dmap[i - W + 1] + c2); }
        dmap[i] = v;
      }
      for (let z = H - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
        const i = z * W + x; let v = dmap[i];
        if (x < W - 1) v = Math.min(v, dmap[i + 1] + c1);
        if (z < H - 1) { v = Math.min(v, dmap[i + W] + c1); if (x > 0) v = Math.min(v, dmap[i + W - 1] + c2); if (x < W - 1) v = Math.min(v, dmap[i + W + 1] + c2); }
        dmap[i] = v;
      }
    }
    void qh;
  }

  cellOf(p: V2): { cx: number; cz: number } {
    return { cx: Math.floor((p.x - X0) / CELL), cz: Math.floor((p.z - Z0) / CELL) };
  }
  centre(cx: number, cz: number): V2 { return { x: X0 + (cx + 0.5) * CELL, z: Z0 + (cz + 0.5) * CELL }; }
  inBounds(cx: number, cz: number): boolean { return cx >= 0 && cz >= 0 && cx < W && cz < H; }

  /** True when a point has at least `radius` of free space around it. */
  isFree(p: V2, radius: number): boolean {
    this.rebuild();
    const { cx, cz } = this.cellOf(p);
    if (!this.inBounds(cx, cz)) return false;
    const i = cz * W + cx;
    return this.walk[i] === 1 && this.clearance[i] >= radius - CELL * 0.5;
  }
  /** Raw walkability of the cell under a point (no clearance). */
  isWalkable(p: V2): boolean {
    this.rebuild();
    const { cx, cz } = this.cellOf(p);
    return this.inBounds(cx, cz) && this.walk[cz * W + cx] === 1;
  }
  clearanceAt(p: V2): number {
    this.rebuild();
    const { cx, cz } = this.cellOf(p);
    return this.inBounds(cx, cz) ? this.clearance[cz * W + cx] : 0;
  }

  /** Nearest free point to p for the given radius (spiral search), or null. */
  nearestFree(p: V2, radius: number, maxR = 3): V2 | null {
    if (this.isFree(p, radius)) return p;
    const { cx, cz } = this.cellOf(p);
    const n = Math.ceil(maxR / CELL);
    let best: V2 | null = null, bestD = Infinity;
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      const x = cx + dx, z = cz + dz;
      if (!this.inBounds(x, z)) continue;
      const q = this.centre(x, z);
      const d = dist(p, q);
      if (d < bestD && this.isFree(q, radius)) { best = q; bestD = d; }
    }
    return best;
  }

  segmentFree(a: V2, b: V2, radius: number): boolean {
    const d = dist(a, b); const n = Math.max(1, Math.ceil(d / (CELL * 0.5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!this.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, radius)) return false;
    }
    return true;
  }

  /** A* on the 8-connected grid for an actor of `radius`; returns a smoothed polyline or null. */
  findPath(from: V2, to: V2, radius: number): V2[] | null {
    this.rebuild();
    const start = this.nearestFree(from, radius, 2.5);
    const goal = this.nearestFree(to, radius, 2.5);
    if (!start || !goal) return null;
    const s = this.cellOf(start), g = this.cellOf(goal);
    const sI = s.cz * W + s.cx, gI = g.cz * W + g.cx;
    if (sI === gI) return [start, goal];
    const gScore = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const heap: number[] = []; const fScore = new Float32Array(W * H).fill(Infinity);
    const h = (i: number): number => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - g.cx), dz = Math.abs(z - g.cz); return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CELL; };
    const push = (i: number): void => { heap.push(i); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (fScore[heap[p]] <= fScore[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = (): number => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && fScore[heap[l]] < fScore[heap[m]]) m = l; if (r < heap.length && fScore[heap[r]] < fScore[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    gScore[sI] = 0; fScore[sI] = h(sI); push(sI);
    const free = (x: number, z: number): boolean => this.inBounds(x, z) && this.walk[z * W + x] === 1 && this.clearance[z * W + x] >= radius - CELL * 0.5;
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (cur === gI) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue; // no corner cutting
        const ni = nz * W + nx;
        // Prefer cells with more clearance so routes hug the middle of corridors.
        const penalty = Math.max(0, radius + 0.35 - this.clearance[ni]) * 1.2;
        const ng = gScore[cur] + (dx && dz ? CELL * Math.SQRT2 : CELL) + penalty * CELL;
        if (ng < gScore[ni]) { gScore[ni] = ng; fScore[ni] = ng + h(ni); came[ni] = cur; push(ni); }
      }
    }
    if (!found) return null;
    const cells: V2[] = [];
    for (let i = gI; i !== -1; i = came[i]) cells.push(this.centre(i % W, (i / W) | 0));
    cells.reverse();
    cells[0] = start; cells[cells.length - 1] = goal;
    // Greedy line-of-sight smoothing.
    const out: V2[] = [cells[0]];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.segmentFree(cells[i], cells[j], radius)) j--;
      out.push(cells[j]); i = j;
    }
    return out;
  }

  /** Debug: list of walkable cell centres (for the plain-geometry dev view). */
  debugCells(): { p: V2; clearance: number }[] {
    this.rebuild();
    const r: { p: V2; clearance: number }[] = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const i = z * W + x; if (this.walk[i]) r.push({ p: this.centre(x, z), clearance: this.clearance[i] }); }
    return r;
  }
}
