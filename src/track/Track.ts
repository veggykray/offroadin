import * as THREE from 'three';
import type { EdgeStyle, PathDef, TrackDef, ElevationFeature, RiverDef } from './TrackData';
import type { SurfaceId } from './SurfaceManager';

/** One sample along a path, every ~1 m. */
export interface PathSample {
  s: number;
  x: number;
  y: number; // road height (includes jumps/crests)
  z: number;
  /** Unit tangent (horizontal) in travel direction. */
  tx: number;
  tz: number;
  /** Unit normal pointing to the LEFT of travel. */
  lx: number;
  lz: number;
  halfWidth: number;
  surface: SurfaceId;
  edge: EdgeStyle;
  bank: number; // radians, + raises left edge
  bridge: boolean;
  /** Signed curvature (1/m), + = turning left. */
  curvature: number;
}

const SAMPLE_SPACING = 1;

/** A sampled road centreline built from named nodes. */
export class TrackPath {
  readonly samples: PathSample[] = [];
  readonly length: number;
  readonly nodeS = new Map<string, number>();

  constructor(readonly def: PathDef, features: ElevationFeature[]) {
    const nodes = def.nodes;
    const pts = nodes.map((n) => new THREE.Vector3(n.x, n.y, n.z));
    const curve = new THREE.CatmullRomCurve3(pts, def.closed, 'centripetal', 0.5);
    const M = 20000;
    const lengths = curve.getLengths(M);
    this.length = lengths[M];
    const segs = def.closed ? nodes.length : nodes.length - 1;
    nodes.forEach((n, i) => this.nodeS.set(n.name, lengths[Math.round((i / segs) * M)]));

    const count = Math.max(2, Math.round(this.length / SAMPLE_SPACING));
    const nodeSList = nodes.map((n) => this.nodeS.get(n.name)!);

    // Step-wise properties (surface / edge / bridge) and interpolated ones (width / bank).
    let surface: SurfaceId = nodes[0].surface ?? 'dirt';
    let edge: EdgeStyle = nodes[0].edge ?? 'berm';
    const nodeSurface: SurfaceId[] = [];
    const nodeEdge: EdgeStyle[] = [];
    for (const n of nodes) {
      if (n.surface) surface = n.surface;
      if (n.edge) edge = n.edge;
      nodeSurface.push(surface);
      nodeEdge.push(edge);
    }

    const tmp = new THREE.Vector3();
    const n = count + (def.closed ? 0 : 1);
    for (let i = 0; i < n; i++) {
      const u = i / count;
      curve.getPointAt(Math.min(u, 1), tmp);
      const s = u * this.length;
      // Which node segment are we in?
      let k = 0;
      for (let j = 0; j < nodeSList.length; j++) if (nodeSList[j] <= s + 1e-6) k = j;
      const a = nodes[k];
      const bIdx = k + 1 < nodes.length ? k + 1 : def.closed ? 0 : k;
      const b = nodes[bIdx];
      const sa = nodeSList[k];
      const sb = bIdx === 0 && def.closed ? this.length : nodeSList[bIdx];
      const t = sb > sa ? smooth((s - sa) / (sb - sa)) : 0;
      const bankA = ((a.bank ?? prevBank(nodes, k)) * Math.PI) / 180;
      const bankB = ((b.bank ?? (a.bank ?? prevBank(nodes, k))) * Math.PI) / 180;
      this.samples.push({
        s,
        x: tmp.x,
        y: tmp.y + featureHeight(features, def.id, this, s),
        z: tmp.z,
        tx: 0,
        tz: 0,
        lx: 0,
        lz: 0,
        halfWidth: (a.width + (b.width - a.width) * t) / 2,
        surface: nodeSurface[k],
        edge: nodeEdge[k],
        bank: bankA + (bankB - bankA) * t,
        bridge: !!a.bridge,
        curvature: 0,
      });
    }
    // Tangents, normals, curvature.
    const N = this.samples.length;
    for (let i = 0; i < N; i++) {
      const p = this.samples[this.wrap(i - 1)];
      const q = this.samples[this.wrap(i + 1)];
      let dx = q.x - p.x, dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const smp = this.samples[i];
      smp.tx = dx;
      smp.tz = dz;
      // Left of travel: forward (tx,tz) rotated +90° about +Y (seen from above, x east / z south).
      smp.lx = dz;
      smp.lz = -dx;
    }
    for (let i = 0; i < N; i++) {
      const p = this.samples[this.wrap(i - 3)];
      const q = this.samples[this.wrap(i + 3)];
      const a1 = Math.atan2(p.tx, p.tz);
      const a2 = Math.atan2(q.tx, q.tz);
      let da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const ds = this.def.closed || (i > 3 && i < N - 4) ? 6 * SAMPLE_SPACING : 1e9;
      this.samples[i].curvature = da / ds;
    }
  }

  get closed(): boolean {
    return this.def.closed;
  }

  wrap(i: number): number {
    const N = this.samples.length;
    if (this.def.closed) return ((i % N) + N) % N;
    return Math.max(0, Math.min(N - 1, i));
  }

  wrapS(s: number): number {
    if (!this.def.closed) return Math.max(0, Math.min(this.length, s));
    return ((s % this.length) + this.length) % this.length;
  }

  /** Sample index nearest to arc length s. */
  indexAt(s: number): number {
    return this.wrap(Math.round(this.wrapS(s) / (this.length / (this.def.closed ? this.samples.length : this.samples.length - 1))));
  }

  sampleAt(s: number): PathSample {
    return this.samples[this.indexAt(s)];
  }

  node(name: string): number {
    const s = this.nodeS.get(name);
    if (s === undefined) throw new Error(`Unknown node "${name}" on path "${this.def.id}"`);
    return s;
  }

  /** World position of (s, lateral) on the path (+lateral = left). */
  pointAt(s: number, lateral: number, out = new THREE.Vector3()): THREE.Vector3 {
    const p = this.sampleAt(s);
    return out.set(p.x + p.lx * lateral, p.y + Math.tan(p.bank) * lateral, p.z + p.lz * lateral);
  }

  /** Local nearest search around a hint (for trackers). Returns sample index. */
  nearestIndexNear(x: number, z: number, hintIndex: number, window: number): number {
    let best = hintIndex, bestD = Infinity;
    for (let k = -window; k <= window; k++) {
      const i = this.wrap(hintIndex + k);
      const p = this.samples[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}

function prevBank(nodes: PathDef['nodes'], k: number): number {
  for (let j = k; j >= 0; j--) if (nodes[j].bank !== undefined) return nodes[j].bank!;
  return 0;
}

function smooth(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function featureHeight(features: ElevationFeature[], pathId: string, path: TrackPath, s: number): number {
  let h = 0;
  for (const f of features) {
    if (f.path !== pathId) continue;
    const s0 = path.node(f.at) + (f.offset ?? 0);
    const d = s - s0;
    if (f.kind === 'kicker') {
      const lip = f.lipLength ?? 2;
      if (d >= -f.length && d <= 0) h += f.height * Math.pow((d + f.length) / f.length, 1.6);
      else if (d > 0 && d < lip) h += f.height * (1 - d / lip);
    } else if (f.kind === 'crest') {
      const half = f.length / 2;
      if (Math.abs(d) < half) h += f.height * 0.5 * (1 + Math.cos((Math.PI * d) / half));
    }
  }
  return h;
}

/** Result of asking "which road am I on / near?" */
export interface RoadQuery {
  path: TrackPath;
  index: number;
  sample: PathSample;
  /** Signed lateral distance from the centreline (+ = left of travel). */
  lateral: number;
  /** Distance past the road edge (≤ 0 = on the road). */
  outside: number;
}

/** A continuous driving line through the course (safe loop, or with the shortcut). */
export interface RoutePoint {
  x: number;
  y: number;
  z: number;
  halfWidth: number;
  /** Main-path-equivalent progress (m) for race position. */
  progress: number;
  pathId: string;
  s: number;
  curvature: number;
  tx: number;
  tz: number;
  lx: number;
  lz: number;
  bridge: boolean;
  surface: SurfaceId;
}

export interface Route {
  id: 'safe' | 'shortcut';
  points: RoutePoint[];
  length: number;
}

export interface Gate {
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  halfWidth: number;
  s: number;
}

/**
 * Runtime track: sampled paths plus all spatial queries gameplay needs
 * (which road, surface, water, progress, routes, checkpoints, grid).
 */
export class Track {
  readonly paths = new Map<string, TrackPath>();
  readonly main: TrackPath;
  readonly shortcut?: TrackPath;
  readonly splitS: number = 0;
  readonly rejoinS: number = 0;
  readonly routes: Route[] = [];
  readonly gates: Gate[] = [];
  /** Heightfield (filled by TrackBuilder) for placing props. */
  heightSampler: ((x: number, z: number) => number) | null = null;

  private grid = new Map<number, Array<[TrackPath, number]>>();
  private readonly cell = 8;
  private riverSamples: Array<{ x: number; z: number; tx: number; tz: number; level: number; half: number; depth: number; bank: number }> = [];

  constructor(readonly def: TrackDef) {
    for (const p of def.paths) this.paths.set(p.id, new TrackPath(p, def.features));
    this.main = this.paths.get('main')!;
    for (const p of this.paths.values()) {
      if (p.def.branchFrom && p.def.rejoinAt) {
        (this as { shortcut?: TrackPath }).shortcut = p;
        (this as { splitS: number }).splitS = this.main.node(p.def.branchFrom);
        (this as { rejoinS: number }).rejoinS = this.main.node(p.def.rejoinAt);
      }
    }
    for (const p of this.paths.values()) {
      p.samples.forEach((smp, i) => {
        const key = this.key(Math.floor(smp.x / this.cell), Math.floor(smp.z / this.cell));
        let arr = this.grid.get(key);
        if (!arr) this.grid.set(key, (arr = []));
        arr.push([p, i]);
      });
    }
    for (const r of def.rivers) this.sampleRiver(r);
    this.buildRoutes();
    this.buildGates();
  }

  private key(cx: number, cz: number): number {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  get lapLength(): number {
    return this.main.length;
  }

  /** Nearest road across all paths. Prefers a road you are ON over one you are merely near. */
  queryRoad(x: number, z: number, radius = 40): RoadQuery | null {
    const r = Math.ceil(radius / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    const bestPer = new Map<TrackPath, [number, number]>();
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const arr = this.grid.get(this.key(cx + i, cz + j));
        if (!arr) continue;
        for (const [p, idx] of arr) {
          const smp = p.samples[idx];
          const d = (smp.x - x) ** 2 + (smp.z - z) ** 2;
          const cur = bestPer.get(p);
          if (!cur || d < cur[1]) bestPer.set(p, [idx, d]);
        }
      }
    }
    let best: RoadQuery | null = null;
    for (const [p, [idx, d2]] of bestPer) {
      if (d2 > radius * radius) continue;
      const smp = p.samples[idx];
      const lateral = (x - smp.x) * smp.lx + (z - smp.z) * smp.lz;
      let outside = Math.abs(lateral) - smp.halfWidth;
      if (!p.closed) {
        // Beyond the open ends of a branch path, distance is measured from the end cap.
        const along = (x - smp.x) * smp.tx + (z - smp.z) * smp.tz;
        const last = p.samples.length - 1;
        if ((idx === 0 && along < -0.5) || (idx === last && along > 0.5)) outside = Math.max(outside, Math.abs(along) + 2);
      }
      const q: RoadQuery = { path: p, index: idx, sample: smp, lateral, outside };
      if (!best) best = q;
      else if (q.outside <= 0 && best.outside <= 0) {
        if (Math.abs(q.lateral) / q.sample.halfWidth < Math.abs(best.lateral) / best.sample.halfWidth) best = q;
      } else if (q.outside < best.outside) best = q;
    }
    return best;
  }

  /** Nearest sample on one specific path (uses the spatial grid). */
  nearestOnPath(path: TrackPath, x: number, z: number, radius = 30): { index: number; dist2: number } | null {
    const r = Math.ceil(radius / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = -1, bd = Infinity;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const arr = this.grid.get(this.key(cx + i, cz + j));
        if (!arr) continue;
        for (const [p, idx] of arr) {
          if (p !== path) continue;
          const smp = p.samples[idx];
          const d = (smp.x - x) ** 2 + (smp.z - z) ** 2;
          if (d < bd) {
            bd = d;
            best = idx;
          }
        }
      }
    }
    return best < 0 ? null : { index: best, dist2: bd };
  }

  /** Road height with banking at a lateral offset. */
  roadHeight(q: RoadQuery): number {
    return q.sample.y + Math.tan(q.sample.bank) * q.lateral;
  }

  // ---------------------------------------------------------------- water

  private sampleRiver(r: RiverDef): void {
    const pts = r.nodes.map((n) => new THREE.Vector3(n.x, 0, n.z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const count = Math.ceil(len);
    const lengths = curve.getLengths(4000);
    const nodeS = r.nodes.map((_, i) => lengths[Math.round((i / (r.nodes.length - 1)) * 4000)]);
    const tmp = new THREE.Vector3(), tan = new THREE.Vector3();
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      const s = u * len;
      curve.getPointAt(u, tmp);
      curve.getTangentAt(u, tan);
      let k = 0;
      for (let j = 0; j < nodeS.length; j++) if (nodeS[j] <= s + 1e-6) k = j;
      const a = r.nodes[k], b = r.nodes[Math.min(k + 1, r.nodes.length - 1)];
      const t = nodeS[k + 1] !== undefined ? smooth((s - nodeS[k]) / (nodeS[k + 1] - nodeS[k])) : 0;
      const lerp = (p: number, q: number) => p + (q - p) * t;
      const tl = Math.hypot(tan.x, tan.z) || 1;
      this.riverSamples.push({
        x: tmp.x,
        z: tmp.z,
        tx: tan.x / tl,
        tz: tan.z / tl,
        level: lerp(a.level, b.level),
        half: lerp(a.width, b.width) / 2,
        depth: lerp(a.depth, b.depth),
        bank: lerp(a.bankWidth, b.bankWidth),
      });
    }
  }

  get riverPoints() {
    return this.riverSamples;
  }

  /** Nearest river sample and lateral distance. */
  riverQuery(x: number, z: number) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.riverSamples.length; i += 1) {
      const r = this.riverSamples[i];
      const d = (r.x - x) ** 2 + (r.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return null;
    const r = this.riverSamples[best];
    const endpoint = best === 0 || best === this.riverSamples.length - 1;
    const lat = endpoint ? Math.sqrt(bd) : Math.abs((x - r.x) * r.tz - (z - r.z) * r.tx);
    return { r, dist: lat, along: Math.sqrt(bd) };
  }

  /** Water surface level at (x,z), or null if no water body here. */
  waterLevelAt(x: number, z: number): number | null {
    for (const l of this.def.lakes) {
      const u = (x - l.x) / l.radiusX, v = (z - l.z) / l.radiusZ;
      if (u * u + v * v < 1.1) return l.level;
    }
    const q = this.riverQuery(x, z);
    if (q && q.dist < q.r.half + q.r.bank && q.along < q.r.half + q.r.bank + 4) return q.r.level;
    return null;
  }

  // ---------------------------------------------------------------- surfaces

  /** Surface under a ground contact point. */
  surfaceAt(x: number, y: number, z: number): SurfaceId {
    const level = this.waterLevelAt(x, z);
    if (level !== null && y < level - 0.02) return 'water';
    const q = this.queryRoad(x, z, 30);
    if (!q) return 'grass';
    const patch = this.patchAt(x, z, q);
    if (patch) return patch;
    if (q.outside <= 0.25) return q.sample.surface === 'wood' ? 'dirt' : q.sample.surface;
    if (q.sample.edge === 'berm' && q.outside < this.def.berm.width) return 'berm';
    return 'grass';
  }

  patchAt(x: number, z: number, q?: RoadQuery | null): SurfaceId | null {
    for (const p of this.def.patches) {
      const path = this.paths.get(p.path)!;
      const c = path.pointAt(path.node(p.at) + (p.offset ?? 0), p.lateral);
      const smp = path.sampleAt(path.node(p.at) + (p.offset ?? 0));
      const dx = x - c.x, dz = z - c.z;
      const along = dx * smp.tx + dz * smp.tz;
      const across = dx * smp.lx + dz * smp.lz;
      const e = (along / (p.length / 2)) ** 2 + (across / (p.width / 2)) ** 2;
      if (e < 1) return p.surface;
    }
    void q;
    return null;
  }

  /** 0..1 depth factor of a patch at a point (for terrain carving). */
  patchDepthAt(x: number, z: number): number {
    let d = 0;
    for (const p of this.def.patches) {
      const path = this.paths.get(p.path)!;
      const c = path.pointAt(path.node(p.at) + (p.offset ?? 0), p.lateral);
      const smp = path.sampleAt(path.node(p.at) + (p.offset ?? 0));
      const dx = x - c.x, dz = z - c.z;
      const along = dx * smp.tx + dz * smp.tz;
      const across = dx * smp.lx + dz * smp.lz;
      const e = (along / (p.length / 2)) ** 2 + (across / (p.width / 2)) ** 2;
      if (e < 1) d = Math.max(d, (p.depth ?? 0.2) * (1 - e));
    }
    return d;
  }

  // ---------------------------------------------------------------- progress

  /** Convert (path, s) to main-path-equivalent progress. */
  progressOf(pathId: string, s: number): number {
    if (this.shortcut && pathId === this.shortcut.def.id) {
      return this.splitS + (s / this.shortcut.length) * (this.rejoinS - this.splitS);
    }
    return s;
  }

  private buildRoutes(): void {
    const toPoint = (p: TrackPath, smp: PathSample): RoutePoint => ({
      x: smp.x,
      y: smp.y,
      z: smp.z,
      halfWidth: smp.halfWidth,
      progress: this.progressOf(p.def.id, smp.s),
      pathId: p.def.id,
      s: smp.s,
      curvature: smp.curvature,
      tx: smp.tx,
      tz: smp.tz,
      lx: smp.lx,
      lz: smp.lz,
      bridge: smp.bridge,
      surface: smp.surface,
    });
    const safe = this.main.samples.map((s) => toPoint(this.main, s));
    this.routes.push({ id: 'safe', points: safe, length: this.main.length });
    if (this.shortcut) {
      const pts: RoutePoint[] = [];
      for (const s of this.main.samples) if (s.s < this.splitS) pts.push(toPoint(this.main, s));
      for (const s of this.shortcut.samples) pts.push(toPoint(this.shortcut, s));
      for (const s of this.main.samples) if (s.s > this.rejoinS) pts.push(toPoint(this.main, s));
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        len += Math.hypot(b.x - a.x, b.z - a.z);
      }
      this.routes.push({ id: 'shortcut', points: pts, length: len });
    }
  }

  private buildGates(): void {
    this.def.checkpoints.forEach((name, index) => {
      const s = this.main.node(name);
      const smp = this.main.sampleAt(s);
      this.gates.push({ index, name, x: smp.x, y: smp.y, z: smp.z, tx: smp.tx, tz: smp.tz, halfWidth: smp.halfWidth + 8, s });
    });
  }

  /** Grid slot transforms (position + yaw) for the start. */
  gridSlots(): Array<{ position: THREE.Vector3; yaw: number }> {
    const g = this.def.grid;
    const s = this.main.node(g.at) + g.offset;
    const smp = this.main.sampleAt(s);
    return g.slots.map((lat) => ({ position: this.main.pointAt(s, lat), yaw: Math.atan2(smp.tx, smp.tz) }));
  }

  /** Ground height lookup (heightfield when built, road otherwise). */
  groundHeight(x: number, z: number): number {
    if (this.heightSampler) return this.heightSampler(x, z);
    const q = this.queryRoad(x, z);
    return q ? this.roadHeight(q) : 0;
  }
}
