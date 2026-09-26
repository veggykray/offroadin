import type { SurfaceId } from './SurfaceManager';

/**
 * ============================================================================
 *  TRACK DATA — edit this file to change the course.
 * ============================================================================
 *
 * A track is a set of PATHS (roads) described by named NODES. Everything else
 * (bridge, jump, mud, pickups, checkpoints, grid) is placed RELATIVE TO A NAMED NODE,
 * so edits stay local and readable:
 *
 *   "Move the bridge 10 m left"  → move nodes `bridgeNorth` / `bridgeSouth` (x -= 10)
 *   "Make this corner 20% tighter" → pull the corner's apex node towards the inside
 *   "Raise this crest"             → increase `y` of `hillTop` (or a `crest` feature's height)
 *   "Widen this straight"          → increase `width` on its nodes
 *
 * Coordinates are metres. x = east (screen right), z = south (towards the camera),
 * y = elevation. The race camera looks north.
 *
 * Direction: nodes are listed in the FORWARD race direction. Reverse layouts later can
 * reuse the same paths (see `Track` — progress/checkpoints take a direction).
 */

export type EdgeStyle =
  /** Raised earth bank (default) — soft barrier that scrubs speed. */
  | 'berm'
  /** No bank — road edge simply meets the surrounding ground (drop-offs, gorge approaches). */
  | 'open';

export interface TrackNode {
  name: string;
  x: number;
  z: number;
  /** Road surface elevation (m). */
  y: number;
  /** Full road width (m). Interpolated smoothly to the next node. */
  width: number;
  /** Surface from this node until the next node that sets one. */
  surface?: SurfaceId;
  /** Edge style from this node onward (until changed). */
  edge?: EdgeStyle;
  /** Cross-slope in degrees; positive raises the LEFT edge (bank a right-hander). */
  bank?: number;
  /** The segment from this node to the next is a bridge deck (no ground under it). */
  bridge?: boolean;
}

export interface PathDef {
  id: string;
  closed: boolean;
  nodes: TrackNode[];
  /** For branch paths: which node on the main path they leave from / rejoin at. */
  branchFrom?: string;
  rejoinAt?: string;
}

/** Elevation profile added on top of a path's road height (jumps, crests). */
export interface ElevationFeature {
  kind: 'kicker' | 'crest';
  path: string;
  /** Node the feature is anchored to, plus an offset along the path (m). */
  at: string;
  offset?: number;
  /** kicker: ramp up over `length`, then a sharp lip. crest: smooth hump of `length`. */
  length: number;
  height: number;
  /** kicker only: length of the drop behind the lip (m). */
  lipLength?: number;
}

/** A patch of different surface laid on top of the road (mud puddle etc). */
export interface SurfacePatch {
  surface: SurfaceId;
  path: string;
  at: string;
  offset?: number;
  /** Lateral offset from centreline (m, + = left of travel). */
  lateral: number;
  /** Ellipse extents along/across the path (m). */
  length: number;
  width: number;
  /** Visual/physical depression (m). */
  depth?: number;
}

/** A river: water surface level + depth profile along its own path. */
export interface RiverDef {
  nodes: Array<{ name: string; x: number; z: number; level: number; width: number; depth: number; bankWidth: number }>;
}

export interface LakeDef {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  level: number;
  depth: number;
}

export interface PickupDef {
  kind: 'nitro';
  path: string;
  at: string;
  offset?: number;
  lateral: number;
}

export interface DecorDef {
  kind: 'boulder' | 'pillar' | 'fern' | 'marker' | 'arch' | 'bones';
  path?: string;
  at?: string;
  offset?: number;
  lateral?: number;
  x?: number;
  z?: number;
  scale?: number;
  /** Physical obstacle? (boulders/pillars on the racing surface) */
  solid?: boolean;
  color?: number;
}

export interface TrackDef {
  name: string;
  world: string;
  laps: number;
  /** Terrain rectangle (m). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  terrainResolution: number;
  /** Earth bank shape. */
  berm: { height: number; width: number };
  paths: PathDef[];
  features: ElevationFeature[];
  patches: SurfacePatch[];
  rivers: RiverDef[];
  lakes: LakeDef[];
  /** Ordered checkpoint gates on the main path (first = start/finish line). */
  checkpoints: string[];
  /** Start grid: node on the main path, distance past it, lateral slot offsets (m, + = left). */
  grid: { at: string; offset: number; slots: number[] };
  pickups: PickupDef[];
  decor: DecorDef[];
  /** Falling below road height by this much in a gorge triggers recovery. */
  fallDepth: number;
}

// ============================================================================
//  TRACK 1 — "Cinder Gorge" (Prehistoric World, greybox)
// ============================================================================

export const TRACK1: TrackDef = {
  name: 'Cinder Gorge',
  world: 'Prehistoric',
  laps: 4,
  bounds: { minX: -150, maxX: 130, minZ: -105, maxZ: 105 },
  terrainResolution: 1,
  berm: { height: 1.7, width: 4.5 },

  paths: [
    {
      id: 'main',
      closed: true,
      nodes: [
        // ---- START / FINISH: wide straight, four abreast ----
        { name: 'finish', x: -30, z: 58, y: 0, width: 27, surface: 'dirt', edge: 'berm' },
        { name: 'straightMid', x: 4, z: 58, y: 0, width: 26 },
        { name: 'straightEnd', x: 32, z: 57, y: 0, width: 22 },
        // ---- FIRST CORNER: narrows hard, left-hander. Inside (left) is shorter. ----
        { name: 'corner1Entry', x: 53, z: 52, y: 0, width: 15 },
        { name: 'corner1Apex', x: 66, z: 40, y: 0.3, width: 12.5 },
        { name: 'corner1Exit', x: 71, z: 24, y: 0.6, width: 15 },
        // ---- ROUGH TERRAIN: rock-strewn, bumpy, slower ----
        { name: 'roughStart', x: 72, z: 10, y: 1.0, width: 17, surface: 'rough' },
        { name: 'roughMid', x: 67, z: -5, y: 1.8, width: 18 },
        { name: 'roughEnd', x: 72, z: -20, y: 3.0, width: 16 },
        // ---- ELEVATION: climb to the plateau; crest at the top ----
        { name: 'climb', x: 79, z: -35, y: 5.8, width: 15, surface: 'dirt' },
        { name: 'hillTop', x: 77, z: -51, y: 8.4, width: 16 },
        // ---- FAST SWEEPER: long banked left-hander along the plateau ----
        { name: 'sweeperEntry', x: 64, z: -65, y: 8.6, width: 18, bank: -5 },
        { name: 'sweeperMid', x: 44, z: -74, y: 8.4, width: 19, bank: -5 },
        { name: 'sweeperExit', x: 22, z: -75, y: 8.2, width: 17, bank: 0 },
        // ---- JUMP: kicker at the plateau edge, long landing slope down ----
        { name: 'jumpLip', x: 5, z: -73, y: 8.0, width: 15 },
        { name: 'jumpLanding', x: -23, z: -68, y: 2.6, width: 17 },
        // ---- ROUTE SPLIT: safe route continues west; shortcut branches south ----
        { name: 'split', x: -41, z: -63, y: 1.4, width: 24 },
        // ---- SAFE ROUTE: longer, wide, easy — dips through a shallow ford ----
        { name: 'safeNW', x: -68, z: -66, y: 1.0, width: 18 },
        { name: 'safeWest', x: -97, z: -50, y: 0.0, width: 18 },
        { name: 'fordNorth', x: -108, z: -30, y: -1.9, width: 18 },
        { name: 'ford', x: -109, z: -15, y: -2.95, width: 18 },
        { name: 'fordSouth', x: -104, z: 1, y: -1.5, width: 18 },
        { name: 'safeExit', x: -93, z: 15, y: -0.4, width: 19 },
        { name: 'safeMerge', x: -80, z: 22, y: 0, width: 22 },
        // ---- REJOIN: the shortcut arrives from the north already heading the same way ----
        { name: 'rejoin', x: -70, z: 30, y: 0.2, width: 24 },
        // ---- TECHNICAL: right-hander with mud on the inside, then a left hairpin ----
        { name: 'chicaneA', x: -61, z: 40, y: 0.6, width: 15 },
        { name: 'chicaneB', x: -77, z: 54, y: 1.0, width: 13 },
        { name: 'hairpin', x: -86, z: 71, y: 0.6, width: 15 },
        // ---- FINAL FAST SECTION: sweeping downhill run onto the straight ----
        { name: 'finalBend', x: -68, z: 78, y: 0.3, width: 19 },
        { name: 'finalRun', x: -49, z: 66, y: 0, width: 23 },
      ],
    },
    {
      // ---- RISK ROUTE: shorter, narrow, crosses the gorge on a thin log bridge ----
      id: 'shortcut',
      closed: false,
      branchFrom: 'split',
      rejoinAt: 'rejoin',
      // One long left-hand sweep: rocky approach → narrow curved log bridge over the
      // gorge → merges into the main road already pointing the right way.
      nodes: [
        { name: 'scStart', x: -41, z: -63, y: 1.4, width: 14, surface: 'dirt', edge: 'berm' },
        { name: 'scA', x: -53.8, z: -57.5, y: 1.6, width: 11 },
        { name: 'scB', x: -66.1, z: -47.3, y: 1.9, width: 9, surface: 'rough' },
        { name: 'bridgeApproach', x: -71.9, z: -39.2, y: 2.1, width: 7, edge: 'open' },
        { name: 'bridgeNorth', x: -74.6, z: -33.9, y: 2.2, width: 5.2, surface: 'wood', bridge: true },
        { name: 'bridgeSouth', x: -81.5, z: -8.8, y: 2.2, width: 5.2, surface: 'dirt', edge: 'open' },
        { name: 'scExit', x: -81.9, z: -0.9, y: 1.8, width: 8, edge: 'berm' },
        { name: 'scC', x: -80.0, z: 11.0, y: 1.0, width: 11 },
        { name: 'scD', x: -74.3, z: 23.7, y: 0.4, width: 13 },
        { name: 'scEnd', x: -70, z: 30, y: 0.2, width: 16 },
      ],
    },
  ],

  features: [
    // Crest at the top of the climb — light at speed, a hop if you're flat out.
    { kind: 'crest', path: 'main', at: 'hillTop', offset: -4, length: 16, height: 1.2 },
    // Main jump: ramp up to a lip at the plateau edge; landing is the slope beyond.
    { kind: 'kicker', path: 'main', at: 'jumpLip', offset: 0, length: 8, height: 1.5, lipLength: 2.5 },
    // Rolling bumps on the safe route so it isn't completely dull.
    { kind: 'crest', path: 'main', at: 'safeNW', offset: 8, length: 12, height: 0.8 },
  ],

  patches: [
    // Mud puddle on the inside of the chicane — cut through it or drive around it.
    { surface: 'mud', path: 'main', at: 'chicaneA', offset: 4, lateral: -4, length: 16, width: 8, depth: 0.25 },
    // Mud on the outside of the hairpin exit punishes running wide.
    { surface: 'mud', path: 'main', at: 'hairpin', offset: 10, lateral: -6, length: 12, width: 6, depth: 0.2 },
  ],

  rivers: [
    {
      // Flows from the infield lake west through the gorge (under the bridge) and the ford.
      nodes: [
        { name: 'lakeMouth', x: -2, z: -14, level: -2.3, width: 10, depth: 1.5, bankWidth: 8 },
        { name: 'gorgeEast', x: -40, z: -25, level: -2.4, width: 12, depth: 3.5, bankWidth: 4 },
        { name: 'underBridge', x: -78.5, z: -21.5, level: -2.45, width: 13, depth: 5, bankWidth: 2 },
        { name: 'gorgeWest', x: -93, z: -18, level: -2.55, width: 14, depth: 2, bankWidth: 6 },
        { name: 'fordCrossing', x: -109, z: -15, level: -2.6, width: 20, depth: 0.5, bankWidth: 12 },
        { name: 'outflow', x: -160, z: -12, level: -2.7, width: 14, depth: 1.5, bankWidth: 8 },
      ],
    },
  ],

  lakes: [{ x: 12, z: -6, radiusX: 26, radiusZ: 20, level: -2.3, depth: 3 }],

  checkpoints: ['finish', 'corner1Exit', 'roughEnd', 'hillTop', 'sweeperExit', 'jumpLanding', 'chicaneA', 'hairpin'],

  // Grid just past the line. Slot offsets: + = left = inside of corner 1.
  grid: { at: 'finish', offset: 7, slots: [7.5, 2.5, -2.5, -7.5] },

  pickups: [
    { kind: 'nitro', path: 'main', at: 'straightMid', offset: 6, lateral: 8 },
    { kind: 'nitro', path: 'main', at: 'sweeperMid', offset: 0, lateral: 4 },
    // Reward for taking the risk route.
    { kind: 'nitro', path: 'shortcut', at: 'scExit', offset: 2, lateral: 0 },
    { kind: 'nitro', path: 'main', at: 'fordSouth', offset: 4, lateral: 5 },
  ],

  decor: [
    // Shortcut entrance: bone arch so the risk route reads instantly.
    { kind: 'arch', path: 'shortcut', at: 'scB', offset: -3, lateral: 0, scale: 1 },
    // Rough section rocks (solid, at the edges).
    { kind: 'boulder', path: 'main', at: 'roughStart', offset: 4, lateral: 7.5, scale: 1.4, solid: true },
    { kind: 'boulder', path: 'main', at: 'roughMid', offset: -3, lateral: -8, scale: 1.6, solid: true },
    { kind: 'boulder', path: 'main', at: 'roughMid', offset: 9, lateral: 1.5, scale: 1.0, solid: true },
    { kind: 'boulder', path: 'main', at: 'roughEnd', offset: -2, lateral: 7, scale: 1.3, solid: true },
    // Corner markers (outside of the turns).
    { kind: 'marker', path: 'main', at: 'corner1Apex', offset: -4, lateral: -9 },
    { kind: 'marker', path: 'main', at: 'hairpin', offset: 0, lateral: -10.5 },
    { kind: 'marker', path: 'main', at: 'chicaneA', offset: 0, lateral: 9.5 },
    { kind: 'marker', path: 'main', at: 'split', offset: -6, lateral: -3 },
    // Scenery: rock pillars and ferns off track (elevation cues).
    { kind: 'pillar', x: 20, z: 30, scale: 2.2 },
    { kind: 'pillar', x: 40, z: 20, scale: 1.4 },
    { kind: 'pillar', x: -20, z: 25, scale: 1.8 },
    { kind: 'pillar', x: 100, z: -80, scale: 3 },
    { kind: 'pillar', x: -120, z: 60, scale: 2.6 },
    { kind: 'pillar', x: -30, z: -90, scale: 2.8 },
    { kind: 'bones', x: 30, z: 38, scale: 1.3 },
    { kind: 'bones', x: -40, z: 30, scale: 1 },
  ],

  fallDepth: 3.2,
};
