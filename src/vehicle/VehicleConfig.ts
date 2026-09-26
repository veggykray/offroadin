import type { VehicleSurfaceOverrides } from '../track/SurfaceManager';

/**
 * All tuning numbers for one vehicle. The physics chassis is defined here and is
 * completely independent of the visual model.
 *
 * Axis convention (local chassis space): +Z forward, +Y up, +X left.
 */
export interface VehicleConfig {
  id: string;
  displayName: string;
  /** Placeholder colours (used until a GLB model is supplied). */
  color: number;
  accent: number;

  // ---- Chassis (invisible physics body) ----
  mass: number;
  /** Half extents of the chassis box collider (m). */
  halfExtents: { x: number; y: number; z: number };
  /** Centre of mass height relative to the collider centre (negative = lower, more stable). */
  comY: number;
  /** Multiplier on the box inertia: >1 = lazier rotation (more "weight"). */
  inertiaScale: number;

  // ---- Suspension (raycast) ----
  wheelRadius: number;
  /** Wheel mount half track width (x) and axle positions (z) in chassis space. */
  wheelX: number;
  wheelZFront: number;
  wheelZRear: number;
  /** Mount height of the suspension top in chassis space. */
  wheelMountY: number;
  suspRest: number;
  suspStiffness: number;
  suspDamping: number;

  // ---- Drive ----
  engineForce: number; // N at standstill
  topSpeed: number; // m/s
  reverseTopSpeed: number;
  brakeDecel: number; // m/s²
  coastDecel: number; // m/s² engine braking with no input
  airDrag: number; // decel = airDrag * v²

  // ---- Steering ----
  /** Max yaw rate (rad/s) at low / at top speed. */
  steerRateLow: number;
  steerRateHigh: number;
  /** Speed (m/s) below which steering fades to allow no pivoting on the spot. */
  steerMinSpeed: number;
  /** 0..1 how quickly the chassis reaches the requested yaw rate each step. */
  steerResponse: number;
  /** How much faster than the grip limit the chassis may rotate (1 = never drifts). */
  oversteer: number;
  /** Largest slide angle (rad) the car will build up on its own while steering. */
  maxSlipAngle: number;
  /** Seconds for keyboard steering to go from 0 to full lock. */
  steerRampTime: number;

  // ---- Grip ----
  /** Maximum sideways acceleration tyres can produce (m/s²). Above this, the car slides. */
  maxLateralAccel: number;
  /** Fraction of lateral velocity removed per step when within grip. */
  lateralStiffness: number;
  downforce: number; // extra down accel = downforce * v²
  /** Sideways slide speed (m/s) above which tyres start to trip the car into a roll. */
  tripSpeed: number;
  /** Lever arm (m) of the tripping force below the centre of mass. Bigger = rolls over more easily. */
  tripHeight: number;

  // ---- Air ----
  airSteer: number; // yaw rate available in air
  airSelfRight: number; // gentle assist to land wheels-down

  // ---- Nitro ----
  nitroForceMult: number;
  nitroTopSpeedMult: number;
  nitroDuration: number;
  nitroStartCharges: number;
  nitroMaxCharges: number;

  surfaceModifiers: VehicleSurfaceOverrides;

  /** Optional GLB/GLTF visual model. */
  model?: VehicleModelConfig;
}

export interface VehicleModelConfig {
  /** File name inside the top-level `models/` folder (e.g. `cindercrest.glb`), or an absolute URL. */
  url: string;
  /** Rotate the model about Y so its nose points along +Z (radians). */
  rotationY?: number;
  /** Uniform scale. 'fit' = scale so model length matches chassis length (never distorts). */
  scale?: number | 'fit';
  /** Extra offset after fitting (chassis space, metres). */
  offset?: { x: number; y: number; z: number };
  /** Names of nodes that should spin like wheels (optional). Front ones also steer. */
  wheelNodes?: { frontLeft?: string; frontRight?: string; rearLeft?: string; rearRight?: string };
}

/** Shared baseline — all four racers use these stats in the first prototype. */
export const BASE_VEHICLE: Omit<VehicleConfig, 'id' | 'displayName' | 'color' | 'accent'> = {
  mass: 1200,
  halfExtents: { x: 1.15, y: 0.5, z: 2.2 },
  comY: -0.35,
  inertiaScale: 1.25,

  wheelRadius: 0.55,
  wheelX: 1.05,
  wheelZFront: 1.45,
  wheelZRear: -1.45,
  wheelMountY: -0.1,
  suspRest: 0.55,
  suspStiffness: 48000,
  suspDamping: 4200,

  engineForce: 15500,
  topSpeed: 31,
  reverseTopSpeed: 9,
  brakeDecel: 24,
  coastDecel: 2.2,
  airDrag: 0.0016,

  steerRateLow: 2.5,
  steerRateHigh: 1.35,
  steerMinSpeed: 4,
  steerResponse: 0.2,
  oversteer: 1.45,
  maxSlipAngle: 0.38,
  steerRampTime: 0.16,

  maxLateralAccel: 19,
  lateralStiffness: 0.35,
  downforce: 0.006,
  tripSpeed: 9,
  tripHeight: 1.8,

  airSteer: 0.9,
  airSelfRight: 2.2,

  nitroForceMult: 1.7,
  nitroTopSpeedMult: 1.25,
  nitroDuration: 1.7,
  nitroStartCharges: 2,
  nitroMaxCharges: 3,

  surfaceModifiers: {},
};

/**
 * The four Prehistoric World racers from the reference sheets.
 * Drop `models/<id>.glb` into the project and it will be used automatically.
 */
export const VEHICLES: Record<string, VehicleConfig> = {
  cindercrest: {
    ...BASE_VEHICLE,
    id: 'cindercrest',
    displayName: 'Cindercrest',
    color: 0x3a2a22,
    accent: 0xff6a1a,
    model: { url: 'cindercrest.glb', scale: 'fit' },
  },
  saberspring: {
    ...BASE_VEHICLE,
    id: 'saberspring',
    displayName: 'Saberspring',
    color: 0xb3352b,
    accent: 0xf1e6c8,
    model: { url: 'saberspring.glb', scale: 'fit' },
  },
  shellfort: {
    ...BASE_VEHICLE,
    id: 'shellfort',
    displayName: 'Shellfort',
    color: 0x7a6a4a,
    accent: 0xc0392b,
    model: { url: 'shellfort.glb', scale: 'fit' },
  },
  tuskroller: {
    ...BASE_VEHICLE,
    id: 'tuskroller',
    displayName: 'Tuskroller',
    color: 0x6b4226,
    accent: 0xe8dcc0,
    model: { url: 'tuskroller.glb', scale: 'fit' },
  },
};
