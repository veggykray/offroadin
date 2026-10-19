export interface V2 { x: number; z: number }
export const v2 = (x: number, z: number): V2 => ({ x, z });
export const dist = (a: V2, b: V2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Shortest signed angle difference (radians). */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const approach = (cur: number, target: number, maxStep: number): number =>
  Math.abs(target - cur) <= maxStep ? target : cur + Math.sign(target - cur) * maxStep;
