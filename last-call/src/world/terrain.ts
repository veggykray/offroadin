/**
 * Destructible terrain as a fixed grid of material cells (0.25 world units per cell).
 * STABLE cells (stone) can never be removed. SOIL and TIMBER are destructible with
 * persistent damage. Collision queries are axis-aligned rectangle vs grid, so terrain
 * destruction immediately changes physics, not just visuals.
 */
export const Mat = { Air: 0, Stable: 1, Soil: 2, Timber: 3 } as const;
export type Mat = (typeof Mat)[keyof typeof Mat];
export const MAT_NAMES = ['air', 'stable', 'soil', 'timber'] as const;

const EPS = 1e-6;

export interface RemovedCell { x: number; y: number; mat: number }

export class Terrain {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Uint8Array;
  /** Incremented on every change so renderers can cache. */
  version = 0;
  removedCells = 0;

  constructor(readonly width: number, readonly height: number, readonly cellSize = 0.25) {
    this.cols = Math.round(width / cellSize);
    this.rows = Math.round(height / cellSize);
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  /** Material of a grid cell. Outside left/right/bottom counts as stable rock; above the top is air. */
  get(cx: number, cy: number): number {
    if (cy >= this.rows) return Mat.Air;
    if (cx < 0 || cx >= this.cols || cy < 0) return Mat.Stable;
    return this.cells[cy * this.cols + cx];
  }
  set(cx: number, cy: number, m: number): void {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
    this.cells[cy * this.cols + cx] = m;
  }
  matAt(x: number, y: number): number { return this.get(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)); }
  solidAt(x: number, y: number): boolean { return this.matAt(x, y) !== Mat.Air; }

  /** Fill all cells whose centres lie in [x0,x1) x [y0,y1) (world units). */
  fillRect(x0: number, y0: number, x1: number, y1: number, m: number): void {
    const cs = this.cellSize;
    const cx0 = Math.round(x0 / cs), cx1 = Math.round(x1 / cs);
    const cy0 = Math.round(y0 / cs), cy1 = Math.round(y1 / cs);
    for (let cy = cy0; cy < cy1; cy++) for (let cx = cx0; cx < cx1; cx++) this.set(cx, cy, m);
    this.version++;
  }

  private cellRange(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
    const cs = this.cellSize;
    return [
      Math.floor(x0 / cs + EPS), Math.floor(y0 / cs + EPS),
      Math.ceil(x1 / cs - EPS) - 1, Math.ceil(y1 / cs - EPS) - 1,
    ];
  }

  /** True when any solid cell intersects the open rectangle. */
  rectSolid(x0: number, y0: number, x1: number, y1: number): boolean {
    const [cx0, cy0, cx1, cy1] = this.cellRange(x0, y0, x1, y1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (this.get(cx, cy) !== Mat.Air) return true;
    return false;
  }

  /** True when any solid cell in the rectangle is NOT one of the listed materials (e.g. anything but timber). */
  rectSolidExcept(x0: number, y0: number, x1: number, y1: number, allowed: number[]): boolean {
    const [cx0, cy0, cx1, cy1] = this.cellRange(x0, y0, x1, y1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = this.get(cx, cy);
      if (m !== Mat.Air && !allowed.includes(m)) return true;
    }
    return false;
  }

  /** Remove destructible cells inside a circle. Stable cells are untouched. Timber breaks a little more easily. */
  carveCircle(x: number, y: number, r: number, timberBonus = 1.2): RemovedCell[] {
    const cs = this.cellSize;
    const removed: RemovedCell[] = [];
    const rr = r * timberBonus;
    const cx0 = Math.floor((x - rr) / cs), cx1 = Math.ceil((x + rr) / cs);
    const cy0 = Math.floor((y - rr) / cs), cy1 = Math.ceil((y + rr) / cs);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = this.get(cx, cy);
      if (m !== Mat.Soil && m !== Mat.Timber) continue;
      const px = (cx + 0.5) * cs, py = (cy + 0.5) * cs;
      const d = Math.hypot(px - x, py - y);
      const limit = m === Mat.Timber ? rr : r;
      if (d <= limit) { this.set(cx, cy, Mat.Air); removed.push({ x: px, y: py, mat: m }); }
    }
    if (removed.length) { this.version++; this.removedCells += removed.length; }
    return removed;
  }

  /** Remove destructible cells of the given materials inside a rectangle. */
  carveRect(x0: number, y0: number, x1: number, y1: number, mats: number[]): RemovedCell[] {
    const cs = this.cellSize;
    const removed: RemovedCell[] = [];
    const [cx0, cy0, cx1, cy1] = this.cellRange(x0, y0, x1, y1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = this.get(cx, cy);
      if (m === Mat.Air || m === Mat.Stable || !mats.includes(m)) continue;
      this.set(cx, cy, Mat.Air);
      removed.push({ x: (cx + 0.5) * cs, y: (cy + 0.5) * cs, mat: m });
    }
    if (removed.length) { this.version++; this.removedCells += removed.length; }
    return removed;
  }

  /** Top y of the first solid cell at or below (x, yFrom), searching down at most maxDrop units. */
  surfaceBelow(x: number, yFrom: number, maxDrop: number): number | null {
    const cs = this.cellSize;
    const cx = Math.floor(x / cs);
    let cy = Math.floor((yFrom - EPS) / cs);
    const cyMin = Math.floor((yFrom - maxDrop) / cs);
    for (; cy >= cyMin; cy--) if (this.get(cx, cy) !== Mat.Air) return (cy + 1) * cs;
    return null;
  }

  /** Copy for side-effect-free simulations (e.g. charge previews). */
  clone(): Terrain {
    const c = new Terrain(this.width, this.height, this.cellSize);
    c.cells.set(this.cells); c.version = this.version; c.removedCells = this.removedCells;
    return c;
  }

  countMat(m: number): number { let n = 0; for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === m) n++; return n; }

  /** Raycast a straight segment against solid cells (for line of sight). Returns the first blocked point or null. */
  segmentHit(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / (this.cellSize * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (this.solidAt(x, y)) return { x, y };
    }
    return null;
  }
}
