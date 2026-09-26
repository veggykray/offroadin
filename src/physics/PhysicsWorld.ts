import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };

/** Arcade gravity: stronger than real life so jumps feel punchy rather than floaty. */
export const GRAVITY = 20;
/** Fixed physics step. Rendering interpolates between steps. */
export const FIXED_DT = 1 / 60;

/** Collision group bits. */
export const GROUP = {
  TERRAIN: 0x0001,
  VEHICLE: 0x0002,
  /** Vehicles that just respawned: collide with the world but not with other cars. */
  GHOST: 0x0004,
  QUERY: 0x0008,
} as const;

/** Pack Rapier interaction groups: membership in the high 16 bits, filter in the low. */
export function groups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export const TERRAIN_GROUPS = groups(GROUP.TERRAIN, 0xffff);
export const VEHICLE_GROUPS = groups(GROUP.VEHICLE, GROUP.TERRAIN | GROUP.VEHICLE | GROUP.QUERY);
export const GHOST_GROUPS = groups(GROUP.GHOST, GROUP.TERRAIN | GROUP.QUERY);
/** Wheel rays only see terrain (not other cars). */
export const WHEEL_RAY_GROUPS = groups(GROUP.QUERY, GROUP.TERRAIN);

export type ColliderTag =
  | { kind: 'terrain' }
  | { kind: 'bridge'; surface: string }
  | { kind: 'static'; surface: string }
  | { kind: 'vehicle'; index: number };

let initialised = false;
export async function initPhysics(): Promise<void> {
  if (initialised) return;
  await RAPIER.init();
  initialised = true;
}

export interface RayHit {
  distance: number;
  nx: number;
  ny: number;
  nz: number;
  collider: RAPIER.Collider;
}

/** Thin wrapper over a Rapier world with tagging of colliders for gameplay lookups. */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly events: RAPIER.EventQueue;
  private tags = new Map<number, ColliderTag>();
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
  }

  tag(collider: RAPIER.Collider, tag: ColliderTag): void {
    this.tags.set(collider.handle, tag);
  }

  tagOf(collider: RAPIER.Collider): ColliderTag | undefined {
    return this.tags.get(collider.handle);
  }

  step(): void {
    this.world.step(this.events);
  }

  /** Ray cast against terrain only. */
  castTerrainRay(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number,
  ): RayHit | null {
    this.ray.origin = { x: ox, y: oy, z: oz };
    this.ray.dir = { x: dx, y: dy, z: dz };
    const hit = this.world.castRayAndGetNormal(this.ray, maxDist, true, undefined, WHEEL_RAY_GROUPS);
    if (!hit) return null;
    return { distance: hit.timeOfImpact, nx: hit.normal.x, ny: hit.normal.y, nz: hit.normal.z, collider: hit.collider };
  }

  dispose(): void {
    this.events.free();
    this.world.free();
  }
}
