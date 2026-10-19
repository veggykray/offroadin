/**
 * Test-slice configuration for P2 "The First Rise" (0B Refuge Sluice, 0D Root Elevator,
 * 1A Reed Quay arrival terrace). This is the ONLY place that knows the concrete layout of the
 * slice. The immutable chapter source lives in design/chapter_one_v3_1/ and is not imported.
 *
 * Identifiers used here match the canonical V3.1 records: L01, L02, CV-01, MR-01, E02, V02,
 * P2_BRIDGE_READY, P2_BRIDGE_SAFE, P2_LIFT_STRONG, P2_ASCENDED.
 *
 * World units ≈ metres. +x east, +z south, +y up. Floor 1 sits FLOOR1_Y above floor 0 and
 * the V02 shaft is vertically aligned (0D(1,1) -> 1A(1,1)).
 */
import type { V2 } from '../sim/vec';

export const FLOOR1_Y = 8;
export type FloorId = 0 | 1;

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Circle { x: number; z: number; r: number }

/** Test-only starting state: initialised after P1's rescue. P1 itself is not implemented. */
export const START_STATE = {
  flags: ['START', 'P1_LATCH_OPEN', 'P1_RESCUED'] as const,
  dog: { x: -13.5, z: 2.2, floor: 0 as FloorId, facing: 0 },
  cat: { x: -14.6, z: 0.2, floor: 0 as FloorId, facing: 0.3 },
  white: { x: -12.2, z: 4.0, floor: 0 as FloorId, facing: -0.4 },
  selected: 'dog' as const,
};

/** Actor footprint radii used for route clearance. */
export const ACTOR = {
  dog: { radius: 0.62, speed: 3.1, turnRate: 6.0, stride: 1.45, shoulderHeight: 0.88 },
  cat: { radius: 0.26, speed: 3.0, turnRate: 9.0, stride: 0.62, shoulderHeight: 0.27 },
  white: { radius: 0.28, speed: 2.6, turnRate: 7.0, stride: 0.55, shoulderHeight: 0.75 },
} as const;

/** Walkable platform slabs. */
export const PLATFORMS: { id: string; floor: FloorId; rect: Rect }[] = [
  { id: '0B', floor: 0, rect: { x0: -17.5, z0: -6.5, x1: -3, z1: 7 } },
  { id: '0D', floor: 0, rect: { x0: 3, z0: -7, x1: 15.5, z1: 7 } },
  { id: '1A', floor: 1, rect: { x0: 3, z0: -8, x1: 17.5, z1: 5 } },
];

/** Static obstacles (walls, pillars, props) subtracted from the walkable area. */
export const OBSTACLES: { id: string; floor: FloorId; rect?: Rect; circle?: Circle }[] = [
  // 0B — north sluice wall, with the reed seep opening at x≈-8
  { id: '0B.wallN.w', floor: 0, rect: { x0: -17.5, z0: -6.5, x1: -9.2, z1: -5.4 } },
  { id: '0B.wallN.e', floor: 0, rect: { x0: -6.8, z0: -6.5, x1: -3, z1: -5.4 } },
  { id: '0B.seep', floor: 0, rect: { x0: -9.2, z0: -6.5, x1: -6.8, z1: -4.9 } },
  // 0B — a partial wall creating a corridor near the start
  { id: '0B.wallW', floor: 0, rect: { x0: -11.4, z0: -5.4, x1: -10.6, z1: -1.6 } },
  // 0B — root arch piers (characters walk through the opening between them)
  { id: '0B.arch.p1', floor: 0, rect: { x0: -5.9, z0: 1.0, x1: -5.1, z1: 1.8 } },
  { id: '0B.arch.p2', floor: 0, rect: { x0: -5.9, z0: 4.6, x1: -5.1, z1: 5.4 } },
  // 0B — CV-01 diverter body, broken cistern at the south edge, porcelain bowls
  { id: 'CV-01', floor: 0, circle: { x: -8, z: -1.0, r: 0.95 } },
  { id: '0B.cistern', floor: 0, rect: { x0: -9.4, z0: 5.2, x1: -6.6, z1: 7 } },
  { id: '0B.bowls', floor: 0, circle: { x: -15.5, z: -3.6, r: 0.8 } },
  // 0D — receiver basin, lift root ring (with a west opening), shelter walls
  { id: '0D.receiver', floor: 0, circle: { x: 4.6, z: -3.4, r: 0.9 } },
  { id: '0D.ringN', floor: 0, rect: { x0: 9.2, z0: -2.9, x1: 13.0, z1: -2.1 } },
  { id: '0D.ringS', floor: 0, rect: { x0: 9.2, z0: 2.1, x1: 13.0, z1: 2.9 } },
  { id: '0D.ringE', floor: 0, rect: { x0: 12.6, z0: -2.9, x1: 13.4, z1: 2.9 } },
  { id: '0D.shelterS', floor: 0, rect: { x0: 4.4, z0: 6.3, x1: 8.6, z1: 7 } },
  { id: '0D.shelterE', floor: 0, rect: { x0: 8.2, z0: 3.6, x1: 8.9, z1: 7 } },
  { id: '0D.gateE03', floor: 0, rect: { x0: 13.4, z0: 4.5, x1: 15.5, z1: 7 } },
  // 1A — same ring footprint continues up; indicator pillar, regulator, attendant bench, houses
  { id: '1A.ringN', floor: 1, rect: { x0: 9.2, z0: -2.9, x1: 13.0, z1: -2.1 } },
  { id: '1A.ringS', floor: 1, rect: { x0: 9.2, z0: 2.1, x1: 13.0, z1: 2.9 } },
  { id: '1A.ringE', floor: 1, rect: { x0: 12.6, z0: -2.9, x1: 13.4, z1: 2.9 } },
  { id: '1A.indicator', floor: 1, circle: { x: 11, z: -4.2, r: 0.6 } },
  { id: 'MR-01', floor: 1, circle: { x: 14.6, z: -4.4, r: 0.9 } },
  { id: '1A.bench', floor: 1, rect: { x0: 5.2, z0: -6.2, x1: 7.6, z1: -5.2 } },
  { id: '1A.houses', floor: 1, rect: { x0: 3, z0: -8, x1: 17.5, z1: -6.6 } },
  { id: '1A.reeds', floor: 1, rect: { x0: 15.4, z0: -2, x1: 17.5, z1: 5 } },
  { id: '1A.skiff', floor: 1, rect: { x0: 5.4, z0: 3.2, x1: 8.4, z1: 5 } },
];

/** Lift shaft (V02) — the float disc docks at floor 0 or floor 1 at this xz. */
export const LIFT = {
  id: 'V02',
  circuit: 'L02',
  centre: { x: 11, z: 0 } as V2,
  floatRadius: 1.55,
  /** Interior of the ring; walkable only when the float is docked at that floor. */
  interior: { x: 11, z: 0, r: 1.65 } as Circle,
  boardStand: { x: 7.9, z: 0 } as V2,
  weakSeconds: 5.0,
  strongSeconds: 3.6,
  rejectSeconds: 1.8,
};

/** Cyan bridge E02 (L01 receiver construct) spanning the gap between 0B and 0D. */
export const BRIDGE = {
  id: 'E02',
  circuit: 'L01',
  rect: { x0: -3.2, z0: -2.2, x1: 3.2, z1: 0.2 } as Rect,
  z: -1.0,
  width: 2.4,
};

/** Cyan channel polylines on 0B (carved grooves) and the conduit to the 0D receiver. */
export const CHANNELS = {
  seep: { x: -8, z: -5.2 } as V2,
  junction: { x: -8, z: -1.0 } as V2,
  /** source -> junction */
  feed: [{ x: -8, z: -5.0 }, { x: -8, z: -2.0 }] as V2[],
  /** junction -> broken cistern (default spill route) */
  spill: [{ x: -8, z: 0 }, { x: -8, z: 5.3 }] as V2[],
  /** junction -> 0B east edge -> conduit under the gap -> receiver basin on 0D */
  bridgeRoute: [{ x: -7, z: -1.0 }, { x: -4.2, z: -1.0 }, { x: -3.4, z: -2.4 }, { x: 3.2, z: -3.4 }, { x: 4.2, z: -3.4 }] as V2[],
  receiver: { x: 4.6, z: -3.4 } as V2,
};

/** Interactables (world-space). standPoint is where the acting animal walks to. */
export interface InteractableDef {
  id: string;
  floor: FloorId;
  pos: V2;
  standPoint: V2;
  /** Which actors may use it. */
  actors: ('dog' | 'cat')[];
  /** Screen hit radius padding in world units for picking (≥ 48 CSS px is enforced in screen space). */
  pickRadius: number;
}
export const INTERACTABLES: Record<string, InteractableDef> = {
  seep: { id: 'seep', floor: 0, pos: { x: -8, z: -5.4 }, standPoint: { x: -8, z: -3.6 }, actors: ['dog'], pickRadius: 1.3 },
  'CV-01': { id: 'CV-01', floor: 0, pos: { x: -8, z: -1.0 }, standPoint: { x: -9.9, z: -1.0 }, actors: ['dog', 'cat'], pickRadius: 1.3 },
  liftBase: { id: 'liftBase', floor: 0, pos: { x: 11, z: 0 }, standPoint: LIFT.boardStand, actors: ['dog', 'cat'], pickRadius: 1.9 },
  liftTop: { id: 'liftTop', floor: 1, pos: { x: 11, z: 0 }, standPoint: LIFT.boardStand, actors: ['dog', 'cat'], pickRadius: 1.9 },
  indicator: { id: 'indicator', floor: 1, pos: { x: 11, z: -4.2 }, standPoint: { x: 9.6, z: -4.4 }, actors: ['cat', 'dog'], pickRadius: 1.2 },
  'MR-01': { id: 'MR-01', floor: 1, pos: { x: 14.6, z: -4.4 }, standPoint: { x: 13.3, z: -3.6 }, actors: ['cat', 'dog'], pickRadius: 1.4 },
};

/** White's explicit safe shelter on 0D and the point where he balks at the lift. */
export const WHITE = {
  shelter: { x: 6.4, z: 5.2 } as V2,
  balkRadius: 4.6,
  balkPoint: { x: 6.3, z: 1.6 } as V2,
  followDistance: 1.7,
  sitBesideOffset: 1.25,
};

/** Non-interactive lift attendant at 1A. */
export const ATTENDANT = { pos: { x: 6.4, z: -4.6 } as V2, facing: Math.PI };

/** Deterministic liquid timings (seconds). */
export const TIMING = {
  scrape: 1.7,
  feedFill: 1.3,
  branchFill: 1.6,
  conduitFill: 1.4,
  receiverFill: 1.2,
  bridgeForm: 1.9,
  drain: 1.2,
  sit: 2.2,
  relax: 1.4,
};

export const FLAG_IDS = ['P2_BRIDGE_READY', 'P2_BRIDGE_SAFE', 'P2_LIFT_STRONG', 'P2_ASCENDED'] as const;
export type FlagId = (typeof FLAG_IDS)[number];
