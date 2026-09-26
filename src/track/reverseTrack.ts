import type { EdgeStyle, PathDef, TrackDef, TrackNode } from './TrackData';
import type { SurfaceId } from './SurfaceManager';

/**
 * Derive the REVERSE layout of a track purely from its data.
 *
 * Nothing in the race logic knows about direction: a reversed track is just another
 * TrackDef where
 *   - node order is reversed (the finish node stays first on the main loop),
 *   - per-segment properties (surface / edge / bridge) move to the node that now
 *     starts that segment,
 *   - left/right flip (bank angles, lateral offsets of pickups/patches/decor, grid slots),
 *   - offsets along the path flip sign,
 *   - checkpoints run the other way, and branch/rejoin swap.
 *
 * Directional features (the kicker jump) keep their anchor node but now launch in the
 * new direction — a designer may want to tweak them for the reverse layout.
 */
export function reverseTrackDef(def: TrackDef): TrackDef {
  const out: TrackDef = structuredClone(def);
  out.name = `${def.name} (Reverse)`;
  out.paths = def.paths.map(reversePath);
  const flip = <T extends { offset?: number; lateral?: number }>(o: T): T => ({
    ...o,
    offset: o.offset !== undefined ? -o.offset : undefined,
    lateral: o.lateral !== undefined ? -o.lateral : undefined,
  });
  out.features = def.features.map((f) => ({ ...f, offset: f.offset !== undefined ? -f.offset : undefined }));
  out.patches = def.patches.map(flip);
  out.pickups = def.pickups.map(flip);
  out.decor = def.decor.map((d) => (d.path ? flip(d) : { ...d }));
  out.checkpoints = [def.checkpoints[0], ...def.checkpoints.slice(1).reverse()];
  out.grid = { ...def.grid, slots: def.grid.slots.map((s) => -s) };
  return out;
}

function reversePath(p: PathDef): PathDef {
  const n = p.nodes;
  // Resolve step-wise properties so every segment's values are explicit.
  const seg: Array<{ surface: SurfaceId; edge: EdgeStyle; bridge: boolean }> = [];
  let surface: SurfaceId = n[0].surface ?? 'dirt';
  let edge: EdgeStyle = n[0].edge ?? 'berm';
  let bank = n[0].bank ?? 0;
  const banks: number[] = [];
  for (const node of n) {
    if (node.surface) surface = node.surface;
    if (node.edge) edge = node.edge;
    if (node.bank !== undefined) bank = node.bank;
    seg.push({ surface, edge, bridge: !!node.bridge });
    banks.push(bank);
  }
  const N = n.length;
  const order: number[] = p.closed ? [0, ...Array.from({ length: N - 1 }, (_, i) => N - 1 - i)] : Array.from({ length: N }, (_, i) => N - 1 - i);
  const nodes: TrackNode[] = order.map((k) => {
    // In reverse, node k starts the segment that originally ran (k-1) → k.
    const prev = p.closed ? (k - 1 + N) % N : k - 1;
    const props = prev >= 0 ? seg[prev] : seg[k];
    return {
      name: n[k].name,
      x: n[k].x,
      z: n[k].z,
      y: n[k].y,
      width: n[k].width,
      surface: props.surface,
      edge: props.edge,
      bridge: props.bridge || undefined,
      bank: -banks[k],
    };
  });
  return {
    ...p,
    nodes,
    branchFrom: p.rejoinAt,
    rejoinAt: p.branchFrom,
  };
}
