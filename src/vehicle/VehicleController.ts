import * as THREE from 'three';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { surfaceModifiers, type SurfaceModifiers } from '../track/SurfaceManager';
import type { Vehicle } from './Vehicle';

/**
 * What a driver (human or AI) asks the car to do this step.
 * steer: -1 = full left, +1 = full right.
 */
export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
  nitro: boolean;
}

export const NO_INPUT: DriveInput = { throttle: 0, brake: 0, steer: 0, nitro: false };

export type VehicleEvent =
  | { type: 'landing'; quality: 'clean' | 'rough' | 'hard'; impact: number }
  | { type: 'nitro' }
  | { type: 'bump'; strength: number };

/** Landing impact thresholds (m/s into the ground). Tuned against the Track 1 jump. */
export const LANDING = {
  minAirTime: 0.35,
  rough: 14.2,
  hard: 16.2,
  cleanBoost: 1.5,
};

const _fwdG = new THREE.Vector3();
const _rightG = new THREE.Vector3();
const _mount = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _imp = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Arcade drive model.
 *
 * Physical parts (Rapier does the integration and collisions):
 *   - raycast spring/damper suspension applied at each wheel mount → pitch, roll,
 *     terrain following, airtime and landings are real.
 * Arcade parts (velocity-level control, stable and tunable):
 *   - engine / brake / drag along the ground-projected forward axis,
 *   - lateral grip capped at `maxLateralAccel` → beyond it the car slides,
 *   - steering sets a target yaw rate that shrinks with speed, reached smoothly,
 *   - limited air control + a gentle self-righting assist,
 *   - landing quality (clean / rough / hard) affects speed and stability.
 */
export function stepVehicle(v: Vehicle, input: DriveInput, dt: number = FIXED_DT): VehicleEvent[] {
  const events: VehicleEvent[] = [];
  const cfg = v.cfg;
  const body = v.body;
  const m = cfg.mass;
  const n = v.groundNormal;
  const grounded = v.groundedWheels > 0;
  const driveFactor = Math.min(1, v.groundedWheels / 2);
  const frozen = v.frozen;

  const throttle = frozen ? 0 : clamp01(input.throttle);
  const brake = frozen ? 0 : clamp01(input.brake);

  // ---- Steering input smoothing (keyboard → analogue feel) ----
  const target = frozen ? 0 : clamp(input.steer, -1, 1);
  const returning = Math.abs(target) < Math.abs(v.steer) || Math.sign(target) !== Math.sign(v.steer);
  const rate = (dt / cfg.steerRampTime) * (returning ? 1.8 : 1);
  v.steer += clamp(target - v.steer, -rate, rate);

  // ---- Nitro trigger ----
  if (input.nitro && !frozen && v.nitroTime <= 0 && v.nitroCharges > 0) {
    v.nitroCharges--;
    v.nitroTime = cfg.nitroDuration;
    events.push({ type: 'nitro' });
  }
  const nitro = v.nitroTime > 0;

  // ---- 1. Suspension (real forces at the wheel mounts) ----
  for (const w of v.wheels) {
    if (!w.hit) continue;
    const x = w.compression;
    const compRate = clamp((w.compression - w.prevCompression) / dt, -6, 6);
    let F = cfg.suspStiffness * x + cfg.suspDamping * compRate;
    // Progressive bump stop for the last part of the travel.
    const stop = cfg.suspRest * 0.8;
    if (x > stop) F += (x - stop) * cfg.suspStiffness * 5;
    if (F <= 0) continue;
    const J = F * dt;
    v.localToWorld(w.local, _mount);
    body.applyImpulseAtPoint({ x: v.up.x * J, y: v.up.y * J, z: v.up.z * J }, _mount, true);
  }

  // Ground frame: forward/right projected onto the averaged contact plane.
  _fwdG.copy(v.fwd).addScaledVector(n, -v.fwd.dot(n));
  if (_fwdG.lengthSq() < 1e-4) _fwdG.copy(v.fwd);
  _fwdG.normalize();
  _rightG.crossVectors(_fwdG, n).normalize();
  const vF = v.vel.dot(_fwdG);
  const vR = v.vel.dot(_rightG);

  const mods = averagedModifiers(v);
  const baseTop = cfg.topSpeed * mods.topSpeed;
  const top = baseTop * (nitro ? cfg.nitroTopSpeedMult : 1);

  _imp.set(0, 0, 0);

  if (grounded) {
    // ---- 2. Longitudinal: engine, brakes, reverse, drag ----
    let accel = 0;
    if (throttle > 0) {
      if (vF < -1) {
        accel += cfg.brakeDecel * throttle * mods.grip; // pressing forward while rolling back = brake
      } else {
        const ratio = Math.max(0, vF) / top;
        const curve = ratio < 1 ? Math.pow(1 - ratio, 0.55) : 0;
        const force = cfg.engineForce * mods.accel * v.catchUp * (nitro ? cfg.nitroForceMult : 1);
        accel += (force / m) * curve * throttle;
      }
    }
    if (nitro) accel += 5 * mods.accel; // nitro always shoves, even without throttle
    if (brake > 0) {
      if (vF > 1) {
        accel -= cfg.brakeDecel * brake * Math.max(0.5, mods.grip);
      } else {
        const ratio = Math.max(0, -vF) / cfg.reverseTopSpeed;
        const curve = ratio < 1 ? 1 - ratio : 0;
        accel -= ((cfg.engineForce * 0.6) / m) * curve * brake;
      }
    }
    if ((throttle === 0 && brake === 0 && !nitro) || frozen) {
      const decel = frozen ? 30 : cfg.coastDecel;
      accel -= Math.sign(vF) * Math.min(Math.abs(vF) / dt, decel);
    }
    accel -= cfg.airDrag * vF * Math.abs(vF);
    accel -= mods.drag * vF;
    if (vF > top) accel -= (vF - top) * 1.5; // bleed off overspeed (after nitro / downhill / into mud)
    // Sliding sideways scrubs speed.
    if (Math.abs(vR) > 3) accel -= Math.sign(vF) * Math.min(Math.abs(vF), (Math.abs(vR) - 3) * 0.35);
    _imp.addScaledVector(_fwdG, accel * driveFactor * dt);

    // ---- 3. Lateral grip (capped → controlled slides) ----
    const stagger = v.staggerTime > 0 ? 0.3 : 1;
    const maxDv = cfg.maxLateralAccel * mods.grip * stagger * driveFactor * dt;
    const dv = clamp(-vR * cfg.lateralStiffness, -maxDv, maxDv);
    _imp.addScaledVector(_rightG, dv);

    // ---- Downforce keeps the car planted over small bumps ----
    const v2 = v.vel.lengthSq();
    _imp.addScaledVector(n, -cfg.downforce * v2 * driveFactor * dt);
  } else if (nitro) {
    // A little thrust in the air: enough to stretch a jump, not enough to fly.
    _imp.addScaledVector(v.fwd, 0.35 * 5 * dt);
  }
  // Apply all linear velocity changes at the centre of mass.
  body.applyImpulse({ x: _imp.x * m, y: _imp.y * m, z: _imp.z * m }, true);

  // ---- 4. Steering: target yaw rate, reduced with speed ----
  const I = v.inertia;
  if (grounded) {
    const speedAbs = Math.abs(vF);
    const lowF = clamp01(speedAbs / cfg.steerMinSpeed);
    const hiT = clamp01((speedAbs - 8) / (cfg.topSpeed - 8));
    let maxRate = lerp(cfg.steerRateLow, cfg.steerRateHigh, hiT);
    // The chassis may rotate somewhat faster than the tyres can bend the path
    // (→ the car drifts), but once the slide angle reaches `maxSlipAngle` it only
    // rotates as fast as grip allows, so drifts are held instead of becoming spins.
    const gripRate = (cfg.maxLateralAccel * mods.grip) / Math.max(speedAbs, 1);
    const slipAngle = Math.atan2(vR, Math.max(Math.abs(vF), 0.5));
    const dir = vF >= -0.5 ? 1 : -1;
    let targetYaw = -v.steer * maxRate * lowF * dir;
    const slidingSameWay = Math.sign(targetYaw) === Math.sign(slipAngle) && dir > 0;
    const slipT = slidingSameWay ? clamp01(Math.abs(slipAngle) / cfg.maxSlipAngle) : 0;
    maxRate = Math.min(maxRate, gripRate * lerp(cfg.oversteer, 1, slipT));
    targetYaw = clamp(targetYaw, -maxRate * lowF, maxRate * lowF);
    const curYaw = v.angVel.dot(n);
    const resp = cfg.steerResponse * (v.staggerTime > 0 ? 0.06 : 1) * driveFactor;
    const dYaw = (targetYaw - curYaw) * resp;
    body.applyTorqueImpulse({ x: n.x * I.y * dYaw, y: n.y * I.y * dYaw, z: n.z * I.y * dYaw }, true);

    // Roll / pitch damping keeps normal driving composed; big hits can still flip.
    const roll = v.angVel.dot(v.fwd);
    const pitch = v.angVel.dot(v.right);
    const rd = -roll * 0.06, pd = -pitch * 0.03;
    body.applyTorqueImpulse(
      {
        x: v.fwd.x * I.z * rd + v.right.x * I.x * pd,
        y: v.fwd.y * I.z * rd + v.right.y * I.x * pd,
        z: v.fwd.z * I.z * rd + v.right.z * I.x * pd,
      },
      true,
    );

    // ---- Rough surfaces jolt the chassis ----
    if (mods.bumpiness > 0 && speedAbs > 5 && v.random() < 7 * dt) {
      const s = mods.bumpiness * Math.min(1, speedAbs / 25);
      const r1 = (v.random() * 2 - 1) * s * 1.6;
      const r2 = (v.random() * 2 - 1) * s * 0.8;
      body.applyTorqueImpulse(
        {
          x: v.fwd.x * I.z * r1 + v.right.x * I.x * r2,
          y: v.fwd.y * I.z * r1 + v.right.y * I.x * r2,
          z: v.fwd.z * I.z * r1 + v.right.z * I.x * r2,
        },
        true,
      );
      const kick = (v.random() * 2 - 1) * s * 1.2 * m;
      body.applyImpulse({ x: _rightG.x * kick, y: _rightG.y * kick, z: _rightG.z * kick }, true);
      events.push({ type: 'bump', strength: s });
    }

    // ---- Landing classification ----
    if (v.airTime > LANDING.minAirTime) {
      const impact = Math.max(0, -v.vel.dot(n));
      const horiz = Math.hypot(v.vel.x, v.vel.z);
      const align = horiz > 3 ? (v.vel.x * _fwdG.x + v.vel.z * _fwdG.z) / (horiz * Math.hypot(_fwdG.x, _fwdG.z) || 1) : 1;
      let quality: 'clean' | 'rough' | 'hard';
      if (impact > LANDING.hard || align < 0.6) quality = 'hard';
      else if (impact > LANDING.rough || align < 0.85) quality = 'rough';
      else quality = 'clean';
      if (quality === 'hard') {
        scaleForward(v, _fwdG, 0.72);
        v.staggerTime = Math.max(v.staggerTime, 0.7);
      } else if (quality === 'rough') {
        scaleForward(v, _fwdG, 0.9);
        v.staggerTime = Math.max(v.staggerTime, 0.25);
      } else if (v.airTime > 0.5) {
        const b = LANDING.cleanBoost * m;
        body.applyImpulse({ x: _fwdG.x * b, y: _fwdG.y * b, z: _fwdG.z * b }, true);
      }
      v.lastLanding = { quality, time: 0 };
      events.push({ type: 'landing', quality, impact });
    }
    v.airTime = 0;
  } else {
    // ---- 5. Air: limited yaw control + gentle self-righting ----
    v.airTime += dt;
    const curYaw = v.angVel.dot(WORLD_UP);
    const dYaw = (-v.steer * cfg.airSteer - curYaw) * 0.04;
    _axis.crossVectors(v.up, WORLD_UP);
    const k = cfg.airSelfRight * dt * (v.up.y > -0.2 ? 1 : 0.4);
    body.applyTorqueImpulse(
      {
        x: _axis.x * I.x * k,
        y: WORLD_UP.y * I.y * dYaw + _axis.y * I.y * k,
        z: _axis.z * I.z * k,
      },
      true,
    );
  }

  if (v.lastLanding) v.lastLanding.time += dt;

  // Visual wheel spin.
  for (const w of v.wheels) w.spin += (vF * dt) / cfg.wheelRadius;

  return events;
}

/** Multiply the forward component of velocity (landing penalties). */
function scaleForward(v: Vehicle, fwdG: THREE.Vector3, factor: number) {
  const vF = v.vel.dot(fwdG);
  const dv = vF * (factor - 1) * v.cfg.mass;
  v.body.applyImpulse({ x: fwdG.x * dv, y: fwdG.y * dv, z: fwdG.z * dv }, true);
}

const _mods: SurfaceModifiers = { accel: 1, topSpeed: 1, grip: 1, drag: 0, bumpiness: 0 };
function averagedModifiers(v: Vehicle): SurfaceModifiers {
  let c = 0;
  _mods.accel = _mods.topSpeed = _mods.grip = _mods.drag = _mods.bumpiness = 0;
  for (const w of v.wheels) {
    if (!w.hit) continue;
    const m = surfaceModifiers(w.surface, v.cfg.surfaceModifiers);
    _mods.accel += m.accel;
    _mods.topSpeed += m.topSpeed;
    _mods.grip += m.grip;
    _mods.drag += m.drag;
    _mods.bumpiness += m.bumpiness;
    c++;
  }
  if (c === 0) return surfaceModifiers(v.surface, v.cfg.surfaceModifiers);
  _mods.accel /= c;
  _mods.topSpeed /= c;
  _mods.grip /= c;
  _mods.drag /= c;
  _mods.bumpiness /= c;
  return _mods;
}

function clamp(x: number, a: number, b: number) {
  return x < a ? a : x > b ? b : x;
}
function clamp01(x: number) {
  return clamp(x, 0, 1);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
