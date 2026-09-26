/**
 * Surface types and their gameplay effect.
 *
 * Surfaces are detected from real wheel contacts (the point a suspension ray hits),
 * never from invisible walls. Each vehicle can later add its own multipliers via
 * `VehicleConfig.surfaceModifiers` (e.g. Tuskroller shrugs off mud, Saberspring hates it).
 */

export type SurfaceId =
  | 'dirt'
  | 'rough'
  | 'mud'
  | 'water'
  | 'wood'
  | 'grass'
  | 'berm'
  | 'rock';

export interface SurfaceProps {
  label: string;
  /** Multiplier on engine force. */
  accel: number;
  /** Multiplier on top speed. */
  topSpeed: number;
  /** Multiplier on lateral grip. */
  grip: number;
  /** Extra deceleration proportional to speed (1/s). Makes mud/water "bog". */
  drag: number;
  /** 0..1 random chassis jolts at speed (on top of any physical bumps). */
  bumpiness: number;
  /** Which particle the wheels kick up. */
  particle: 'dust' | 'splash' | 'mud' | 'none' | 'chips';
  /** Base colour for the greybox terrain. */
  color: number;
}

export const SURFACES: Record<SurfaceId, SurfaceProps> = {
  dirt: { label: 'Dirt', accel: 1, topSpeed: 1, grip: 1, drag: 0, bumpiness: 0, particle: 'dust', color: 0xc79a62 },
  rough: { label: 'Rough rock', accel: 0.85, topSpeed: 0.84, grip: 0.8, drag: 0.02, bumpiness: 0.55, particle: 'chips', color: 0x8d8173 },
  mud: { label: 'Mud', accel: 0.55, topSpeed: 0.58, grip: 0.68, drag: 0.35, bumpiness: 0.1, particle: 'mud', color: 0x5b3f26 },
  water: { label: 'Water', accel: 0.62, topSpeed: 0.66, grip: 0.8, drag: 0.25, bumpiness: 0.05, particle: 'splash', color: 0x6d8fa0 },
  wood: { label: 'Log bridge', accel: 1, topSpeed: 1, grip: 0.92, drag: 0, bumpiness: 0.45, particle: 'none', color: 0x8a5a2b },
  grass: { label: 'Off-track', accel: 0.72, topSpeed: 0.7, grip: 0.78, drag: 0.08, bumpiness: 0.25, particle: 'dust', color: 0x6f8a3c },
  berm: { label: 'Bank', accel: 0.8, topSpeed: 0.8, grip: 0.85, drag: 0.04, bumpiness: 0.15, particle: 'dust', color: 0x9c6b40 },
  rock: { label: 'Rock', accel: 0.8, topSpeed: 0.8, grip: 0.85, drag: 0.02, bumpiness: 0.2, particle: 'chips', color: 0x7d7a74 },
};

export interface SurfaceModifiers {
  accel: number;
  topSpeed: number;
  grip: number;
  drag: number;
  bumpiness: number;
}

export type VehicleSurfaceOverrides = Partial<Record<SurfaceId, Partial<SurfaceModifiers>>>;

/** Combine the base surface with any per-vehicle overrides (multiplicative). */
export function surfaceModifiers(id: SurfaceId, overrides?: VehicleSurfaceOverrides): SurfaceModifiers {
  const s = SURFACES[id];
  const o = overrides?.[id];
  return {
    accel: s.accel * (o?.accel ?? 1),
    topSpeed: s.topSpeed * (o?.topSpeed ?? 1),
    grip: s.grip * (o?.grip ?? 1),
    drag: s.drag * (o?.drag ?? 1),
    bumpiness: s.bumpiness * (o?.bumpiness ?? 1),
  };
}
