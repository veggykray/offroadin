/**
 * Canvas2D painting helpers for procedurally produced art: material tiles, soft sprites and
 * colour utilities. Everything here runs once at start-up (or on terrain changes) and feeds
 * Three.js textures; nothing is drawn per frame with Canvas2D.
 */
import { Rng } from '../core/rng';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
export function ctx2d(c: HTMLCanvasElement): Ctx { return c.getContext('2d')!; }

/** Parse #rrggbb to [r,g,b]. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Lighten (k>0) or darken (k<0) a colour by a fraction. */
export function shade(col: string, k: number): string {
  const [r, g, b] = rgb(col);
  return k >= 0 ? hex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : hex(r * (1 + k), g * (1 + k), b * (1 + k));
}
export function rgba(col: string, a: number): string { const [r, g, b] = rgb(col); return `rgba(${r},${g},${b},${a})`; }

/** Rounded rectangle path. */
export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + rad, y); c.lineTo(x + w - rad, y); c.quadraticCurveTo(x + w, y, x + w, y + rad);
  c.lineTo(x + w, y + h - rad); c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); c.lineTo(x + rad, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rad); c.lineTo(x, y + rad); c.quadraticCurveTo(x, y, x + rad, y); c.closePath();
}

/** Filled + outlined shape helper: fill with a vertical two-tone gradient, then dark outline. */
export function shadedPath(c: Ctx, path: () => void, base: string, light = 0.18, dark = -0.22, outline = '#1d1613', lw = 2.5, y0 = 0, y1 = 100): void {
  path();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(base, light)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, dark));
  c.fillStyle = g; c.fill();
  if (lw > 0) { c.lineWidth = lw; c.strokeStyle = outline; c.lineJoin = 'round'; c.stroke(); }
}

export interface Tile { canvas: HTMLCanvasElement; pattern: (c: Ctx) => CanvasPattern }

/** Seamless material tiles (256px) used to fill terrain cells. */
export function makeTiles(seed = 7): Record<'soil' | 'rock' | 'timber' | 'moss', Tile> {
  const rng = new Rng(seed);
  const tile = (paint: (c: Ctx, s: number) => void): Tile => {
    const s = 256; const canvas = makeCanvas(s, s); const c = ctx2d(canvas); paint(c, s);
    return { canvas, pattern: (dst) => dst.createPattern(canvas, 'repeat')! };
  };
  const speckle = (c: Ctx, s: number, n: number, col: string, r0: number, r1: number, a: number) => {
    c.fillStyle = col; c.globalAlpha = a;
    for (let i = 0; i < n; i++) { const x = rng.range(0, s), y = rng.range(0, s), r = rng.range(r0, r1); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); for (const [dx, dy] of [[-s, 0], [s, 0], [0, -s], [0, s]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, Math.PI * 2); c.fill(); } }
    c.globalAlpha = 1;
  };
  const soil = tile((c, s) => {
    c.fillStyle = '#6e4a2c'; c.fillRect(0, 0, s, s);
    speckle(c, s, 900, '#5a3a21', 2, 9, 0.5);
    speckle(c, s, 500, '#8a6239', 2, 7, 0.45);
    speckle(c, s, 160, '#3f2a18', 1, 3, 0.6);  // dark grit
    speckle(c, s, 90, '#a88a66', 1, 3, 0.35);  // pale pebbles
    speckle(c, s, 40, '#8a8a7a', 2, 5, 0.3);   // small stones
  });
  const rock = tile((c, s) => {
    c.fillStyle = '#6f7378'; c.fillRect(0, 0, s, s);
    speckle(c, s, 600, '#5e6268', 4, 16, 0.5);
    speckle(c, s, 400, '#848890', 3, 12, 0.4);
    // cracks
    c.strokeStyle = 'rgba(35,38,44,0.55)'; c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = rng.range(0, s), y = rng.range(0, s);
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rng.range(-22, 22); y += rng.range(-14, 14); c.lineTo(x, y); }
      c.stroke();
    }
    speckle(c, s, 70, '#9aa06a', 2, 6, 0.28); // lichen
  });
  const timber = tile((c, s) => {
    c.fillStyle = '#8f6230'; c.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      c.fillStyle = (y / 32) % 2 ? '#9a6b36' : '#85592b'; c.fillRect(0, y, s, 32);
      c.fillStyle = 'rgba(40,24,10,0.55)'; c.fillRect(0, y, s, 3);
      c.fillStyle = 'rgba(255,220,160,0.14)'; c.fillRect(0, y + 3, s, 2);
      c.strokeStyle = 'rgba(60,36,14,0.35)'; c.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const yy = y + 8 + rng.range(0, 20); c.beginPath(); c.moveTo(0, yy); c.bezierCurveTo(s * 0.3, yy + rng.range(-3, 3), s * 0.7, yy + rng.range(-3, 3), s, yy); c.stroke(); }
      // nails
      c.fillStyle = '#3a2a1a'; for (let x = 20; x < s; x += 64) { c.beginPath(); c.arc(x + rng.range(-4, 4), y + 16, 2.2, 0, Math.PI * 2); c.fill(); }
    }
  });
  const moss = tile((c, s) => {
    c.fillStyle = '#6f7d2e'; c.fillRect(0, 0, s, s);
    speckle(c, s, 700, '#59682a', 3, 10, 0.5);
    speckle(c, s, 400, '#8c9a3a', 2, 7, 0.45);
    speckle(c, s, 120, '#b9b24a', 1, 3, 0.4);
  });
  return { soil, rock, timber, moss };
}

/** Radial soft disc (white, alpha falloff) for glows, smoke and sparks. */
export function softDisc(size = 128, inner = 0.0, power = 1.6): HTMLCanvasElement {
  const c = makeCanvas(size, size), x = ctx2d(c);
  const img = x.createImageData(size, size); const d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (i + 0.5) / size - 0.5, dy = (j + 0.5) / size - 0.5; const r = Math.hypot(dx, dy) * 2;
    const a = r < inner ? 1 : Math.max(0, 1 - (r - inner) / (1 - inner));
    const k = (j * size + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.round(255 * Math.pow(a, power));
  }
  x.putImageData(img, 0, 0); return c;
}
/** Ring sprite for shockwaves. */
export function ringSprite(size = 128, thickness = 0.12): HTMLCanvasElement {
  const c = makeCanvas(size, size), x = ctx2d(c);
  x.strokeStyle = '#fff'; x.lineWidth = size * thickness; x.beginPath(); x.arc(size / 2, size / 2, size / 2 - size * thickness, 0, Math.PI * 2); x.stroke();
  return c;
}
/** Square debris chunk with a bevel. */
export function chunkSprite(size = 32): HTMLCanvasElement {
  const c = makeCanvas(size, size), x = ctx2d(c);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(size * 0.15, size * 0.05); x.lineTo(size * 0.95, size * 0.2); x.lineTo(size * 0.85, size * 0.95); x.lineTo(size * 0.05, size * 0.8); x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.moveTo(size * 0.05, size * 0.8); x.lineTo(size * 0.85, size * 0.95); x.lineTo(size * 0.95, size * 0.2); x.lineTo(size * 0.6, size * 0.6); x.closePath(); x.fill();
  return c;
}
