export interface Vec2 { x: number; y: number }

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const sign = (v: number): number => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const DEG = Math.PI / 180;

/** Rectangle overlap test on half-open rects [x0,x1) x [y0,y1). */
export function rectsOverlap(ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number): boolean {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

export function pointInRect(px: number, py: number, x0: number, y0: number, x1: number, y1: number): boolean {
  return px >= x0 && px < x1 && py >= y0 && py < y1;
}
