import * as THREE from 'three';
import { makeCanvas, ctx2d, rr, shade, rgba, type Ctx } from '../art/paint';
import { Rng } from '../core/rng';
import type { LevelData } from '../world/level';
import type { Barrel } from '../game/game';

const PX = 40;
const OUT = '#1c1410';

function plane(canvas: HTMLCanvasElement, w: number, h: number, x: number, y: number, z: number, additive = false): THREE.Mesh {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x + w / 2, y + h / 2, z); return m;
}

function timberFrameWall(c: Ctx, x: number, y: number, w: number, h: number, rng: Rng): void {
  c.fillStyle = '#d8c7a6'; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(120,90,60,0.12)'; for (let i = 0; i < 40; i++) c.fillRect(x + rng.range(0, w), y + rng.range(0, h), rng.range(4, 20), rng.range(2, 6));
  c.fillStyle = '#5a3d22';
  const beams = Math.max(2, Math.round(w / 90));
  for (let i = 0; i <= beams; i++) c.fillRect(x + (i / beams) * (w - 10), y, 10, h);
  c.fillRect(x, y, w, 10); c.fillRect(x, y + h - 10, w, 10); c.fillRect(x, y + h / 2 - 5, w, 10);
  for (let i = 0; i < beams; i++) { c.beginPath(); c.moveTo(x + (i / beams) * (w - 10) + 5, y + h / 2); c.lineTo(x + ((i + 1) / beams) * (w - 10) + 5, y + h - 5); c.lineWidth = 9; c.strokeStyle = '#5a3d22'; c.stroke(); }
}
function windowLit(c: Ctx, x: number, y: number, w: number, h: number): void {
  c.fillStyle = '#ffd27a'; rr(c, x, y, w, h, 4); c.fill(); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 4, y + 4, w * 0.35, h * 0.35);
  c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
}
function roof(c: Ctx, x0: number, y0: number, x1: number, peakX: number, peakY: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.moveTo(x0, y0); c.lineTo(peakX, peakY); c.lineTo(x1, y0); c.closePath(); c.fill(); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 3;
  for (let i = 1; i < 7; i++) { const t = i / 7; c.beginPath(); c.moveTo(x0 + (peakX - x0) * t, y0 + (peakY - y0) * t); c.lineTo(x1 + (peakX - x1) * t, y0 + (peakY - y0) * t); c.stroke(); }
}
function lanternIcon(c: Ctx, x: number, y: number, s: number): void {
  c.fillStyle = '#2a2420'; rr(c, x - s * 0.3, y - s * 0.6, s * 0.6, s * 1.1, 3); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = '#ffb347'; rr(c, x - s * 0.2, y - s * 0.45, s * 0.4, s * 0.8, 2); c.fill();
  c.fillStyle = '#2a2420'; rr(c, x - s * 0.15, y - s * 0.85, s * 0.3, s * 0.3, 2); c.fill();
}

/** Static scenery drawn behind/around the collidable terrain: façades, arch, banners, lanterns, goal shrine. */
export class Props {
  readonly group = new THREE.Group();
  private disposables: THREE.Mesh[] = [];
  private lanternGlows: THREE.Mesh[] = [];
  private barrelMeshes: THREE.Mesh[] = [];
  private flag!: THREE.Mesh;

  constructor(level: LevelData) {
    this.tavern();
    this.marketStall();
    this.cottage(44.5, 11, 7.5, 'b');
    this.ruinedArch();
    this.shrine(level);
    for (const [x, y] of [[13, 10], [29.5, 7], [55.5, 11], [84.5, 6]] as [number, number][]) this.lanternPost(x, y);
    for (const [x, y] of [[25, 10], [61, 12], [90, 6]] as [number, number][]) this.banner(x, y);
    for (const b of level.barrels) this.barrel(b.x, b.y);
    for (const [x, y] of [[16.5, 10], [48, 11], [86, 6]] as [number, number][]) this.crate(x, y);
  }

  private add(m: THREE.Mesh): THREE.Mesh { this.group.add(m); this.disposables.push(m); return m; }

  private tavern(): void {
    // Façade behind the heroes: stone base, timber-frame upper floor, crooked roof over the stone slab, sign.
    const w = 12.5, h = 13; const c = makeCanvas(w * PX, h * PX), g = ctx2d(c); const rng = new Rng(2);
    const W = c.width, H = c.height;
    // upper storey (x 1.5..11.5 world, y 10..17 -> canvas rows)
    const u = (yy: number) => H - (yy - 9.5) * PX;
    g.fillStyle = '#7c7066'; g.fillRect(0, u(10), W, H - u(10));  // stone understorey (mostly hidden by terrain)
    timberFrameWall(g, 1 * PX, u(17), 10.5 * PX, 7 * PX, rng);
    windowLit(g, 2.6 * PX, u(15.2), 1.4 * PX, 1.8 * PX); windowLit(g, 6.2 * PX, u(15.2), 1.4 * PX, 1.8 * PX);
    // door (open, dark, a step)
    g.fillStyle = '#2a1e16'; rr(g, 9.0 * PX, u(13.4), 1.6 * PX, 3.4 * PX, 10); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,180,100,0.35)'; rr(g, 9.1 * PX, u(13.3), 1.4 * PX, 3.2 * PX, 10); g.fill();
    // roof above the slab (slab is terrain at y 17-18); shingles + a leaning chimney
    roof(g, 0, u(18.2), 11.8 * PX, 5.5 * PX, u(22.5), '#6b3b30');
    g.fillStyle = '#5a5047'; rr(g, 8.6 * PX, u(21.5), 0.9 * PX, 2.6 * PX, 4); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    // hanging sign with a lantern
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(10.2 * PX, u(16.8)); g.lineTo(12.3 * PX, u(16.8)); g.stroke();
    g.fillStyle = '#4a2f1a'; rr(g, 11.0 * PX, u(16.6), 1.4 * PX, 1.1 * PX, 6); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    lanternIcon(g, 11.7 * PX, u(16.0), 0.6 * PX);
    this.add(plane(c, w, h, 0, 9.5, -2));
  }

  private marketStall(): void {
    // Awning over the timber stall block (x 34..38.5, y 7..10): striped canvas on poles.
    const w = 6, h = 3.2; const c = makeCanvas(w * PX, h * PX), g = ctx2d(c); const H = c.height;
    g.fillStyle = '#5a3d22'; g.fillRect(0.5 * PX, 0.8 * PX, 0.25 * PX, H - 0.8 * PX); g.fillRect(5.25 * PX, 0.8 * PX, 0.25 * PX, H - 0.8 * PX);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c94a3a' : '#e9dcc3'; g.beginPath(); g.moveTo(i * 0.75 * PX, 0.9 * PX); g.lineTo((i + 1) * 0.75 * PX, 0.9 * PX); g.lineTo((i + 1) * 0.75 * PX - 6, 0.3 * PX); g.lineTo(i * 0.75 * PX + 6, 0.3 * PX); g.closePath(); g.fill(); }
    g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(0.1 * PX, 0.3 * PX, 5.8 * PX, 0.6 * PX);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c94a3a' : '#e9dcc3'; g.beginPath(); g.moveTo(i * 0.75 * PX, 0.9 * PX); g.lineTo((i + 0.5) * 0.75 * PX, 1.3 * PX); g.lineTo((i + 1) * 0.75 * PX, 0.9 * PX); g.fill(); }
    this.add(plane(c, w, h, 33.25, 9.6, -1));
  }

  private cottage(x: number, groundY: number, w: number, _seed: string): void {
    const h = 8; const c = makeCanvas(w * PX, h * PX), g = ctx2d(c); const rng = new Rng(4); const H = c.height;
    const lean = 0.3 * PX;
    g.save(); g.transform(1, 0, -0.04, 1, 0, 0);
    timberFrameWall(g, 0.6 * PX + lean, H - 4.6 * PX, (w - 1.2) * PX, 4.6 * PX, rng);
    g.restore();
    windowLit(g, 1.6 * PX, H - 3.6 * PX, 1.1 * PX, 1.4 * PX); windowLit(g, 4.4 * PX, H - 3.6 * PX, 1.1 * PX, 1.4 * PX);
    g.fillStyle = '#2a1e16'; rr(g, 3.0 * PX, H - 2.6 * PX, 1.2 * PX, 2.6 * PX, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    roof(g, 0, H - 4.6 * PX, w * PX, (w / 2 + 0.3) * PX, H - 7.8 * PX, '#5a4a3a');
    g.fillStyle = '#5a5047'; rr(g, (w - 1.8) * PX, H - 7.2 * PX, 0.7 * PX, 2.2 * PX, 3); g.fill(); g.stroke();
    this.add(plane(c, w, h, x, groundY, -3));
  }

  private ruinedArch(): void {
    // Stone arch of the broken crossing: masonry ring under the deck, piers at both banks. Non-collidable.
    const w = 26, h = 11; const c = makeCanvas(w * PX, h * PX), g = ctx2d(c); const H = c.height, W = c.width;
    g.lineWidth = 2.5 * PX; g.strokeStyle = '#6a6e76'; g.beginPath(); g.moveTo(2.5 * PX, H); g.quadraticCurveTo(W / 2, -0.6 * H, W - 2.5 * PX, H); g.stroke();
    g.lineWidth = 2.5 * PX + 8; g.strokeStyle = OUT; g.globalCompositeOperation = 'destination-over'; g.beginPath(); g.moveTo(2.5 * PX, H); g.quadraticCurveTo(W / 2, -0.6 * H, W - 2.5 * PX, H); g.stroke(); g.globalCompositeOperation = 'source-over';
    // masonry joints
    g.strokeStyle = 'rgba(30,30,36,0.6)'; g.lineWidth = 3;
    for (let i = 0; i <= 18; i++) { const t = i / 18; const x = 2.5 * PX + (W - 5 * PX) * t; const y = (1 - t) * (1 - t) * H + 2 * (1 - t) * t * (-0.6 * H) + t * t * H; const nx = -(2 * (1 - t) * (W / 2 - 2.5 * PX) + 2 * t * (W - 2.5 * PX - W / 2)); const ny = 2 * (1 - t) * (-0.6 * H - H) + 2 * t * (H + 0.6 * H); const l = Math.hypot(nx, ny); g.beginPath(); g.moveTo(x - ny / l * 1.2 * PX, y + nx / l * 1.2 * PX); g.lineTo(x + ny / l * 1.2 * PX, y - nx / l * 1.2 * PX); g.stroke(); }
    // moss drips
    g.fillStyle = 'rgba(120,140,60,0.55)'; for (let i = 0; i < 14; i++) { const x = 4 * PX + i * 1.3 * PX; g.beginPath(); g.ellipse(x, 1.2 * PX + (i % 3) * 10, 10, 18 + (i % 4) * 6, 0, 0, Math.PI * 2); g.fill(); }
    const m = this.add(plane(c, w, h, 57, 1.5, -4)); (m.material as THREE.MeshBasicMaterial).opacity = 0.9;
  }

  private shrine(level: LevelData): void {
    // The destination: a small roadside shrine with a bell (the tower that should have no bell is elsewhere; this one is honest).
    const z = level.goal; const w = 6, h = 7; const c = makeCanvas(w * PX, h * PX), g = ctx2d(c); const H = c.height;
    g.fillStyle = '#7c7f86'; rr(g, 1.2 * PX, H - 4.2 * PX, 0.7 * PX, 4.2 * PX, 4); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    rr(g, 4.1 * PX, H - 4.2 * PX, 0.7 * PX, 4.2 * PX, 4); g.fill(); g.stroke();
    roof(g, 0.4 * PX, H - 4.4 * PX, 5.6 * PX, 3 * PX, H - 6.6 * PX, '#5a4a3a');
    g.fillStyle = '#c9962f'; g.beginPath(); g.moveTo(3 * PX, H - 4.3 * PX); g.lineTo(2.5 * PX, H - 3.2 * PX); g.lineTo(3.5 * PX, H - 3.2 * PX); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e6dcc4'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(1.6 * PX + i * 0.6 * PX, H - 0.5 * PX, 6, 0, Math.PI * 2); g.fill(); }
    this.add(plane(c, w, h, (z.x0 + z.x1) / 2 - 3, z.y0, -1));
    // waving banner-flag marker
    const fc = makeCanvas(2 * PX, 1.4 * PX), fg = ctx2d(fc); fg.fillStyle = '#f2c94c'; fg.beginPath(); fg.moveTo(0, 0); fg.lineTo(2 * PX, 0.7 * PX); fg.lineTo(0, 1.4 * PX); fg.closePath(); fg.fill(); fg.lineWidth = 4; fg.strokeStyle = OUT; fg.stroke();
    this.flag = this.add(plane(fc, 2, 1.4, (z.x0 + z.x1) / 2 + 0.1, z.y0 + 5.6, 0.2));
  }

  private lanternPost(x: number, y: number): void {
    const c = makeCanvas(1.2 * PX, 3.2 * PX), g = ctx2d(c); const H = c.height;
    g.fillStyle = '#3a2a1a'; rr(g, 0.5 * PX, 0.6 * PX, 0.2 * PX, H - 0.6 * PX, 3); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillRect(0.3 * PX, 0.55 * PX, 0.6 * PX, 0.12 * PX);
    lanternIcon(g, 0.6 * PX, 1.2 * PX, 0.7 * PX);
    this.add(plane(c, 1.2, 3.2, x - 0.6, y, -0.5));
    const gc = makeCanvas(64, 64), gg = ctx2d(gc); const gr = gg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,110,0.55)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64);
    const glow = this.add(plane(gc, 3.5, 3.5, x - 1.75, y + 1.0, -0.4, true)); this.lanternGlows.push(glow);
  }

  private banner(x: number, y: number): void {
    const c = makeCanvas(1.6 * PX, 4.5 * PX), g = ctx2d(c); const H = c.height;
    g.fillStyle = '#3a2a1a'; g.fillRect(0.7 * PX, 0, 0.14 * PX, H);
    g.fillStyle = '#8a2a2a'; g.beginPath(); g.moveTo(0.1 * PX, 0.2 * PX); g.lineTo(1.5 * PX, 0.2 * PX); g.lineTo(1.5 * PX, 3.2 * PX); g.lineTo(0.8 * PX, 2.7 * PX); g.lineTo(0.1 * PX, 3.2 * PX); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#e6dcc4'; g.lineWidth = 4; g.beginPath(); g.moveTo(0.8 * PX, 0.6 * PX); g.lineTo(0.8 * PX, 2.3 * PX); g.moveTo(0.4 * PX, 1.1 * PX); g.lineTo(1.2 * PX, 1.1 * PX); g.moveTo(0.45 * PX, 1.9 * PX); g.lineTo(1.15 * PX, 1.6 * PX); g.stroke();
    this.add(plane(c, 1.6, 4.5, x - 0.8, y, -0.6));
  }

  private barrel(x: number, y: number): void {
    const c = makeCanvas(1.2 * PX, 1.7 * PX), g = ctx2d(c); const W = c.width, H = c.height;
    g.fillStyle = shade('#7d3b2a', 0.05); rr(g, 4, 4, W - 8, H - 8, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#2a2420'; g.fillRect(4, H * 0.28, W - 8, 6); g.fillRect(4, H * 0.66, W - 8, 6);
    g.strokeStyle = '#ffb347'; g.lineWidth = 5; g.beginPath(); g.moveTo(W * 0.3, H * 0.4); g.lineTo(W * 0.7, H * 0.6); g.moveTo(W * 0.7, H * 0.4); g.lineTo(W * 0.3, H * 0.6); g.stroke();
    const m = this.add(plane(c, 1.2, 1.7, x - 0.6, y - 0.05, 0.1)); this.barrelMeshes.push(m);
  }

  private crate(x: number, y: number): void {
    const c = makeCanvas(1.2 * PX, 1.0 * PX), g = ctx2d(c); const W = c.width, H = c.height;
    g.fillStyle = '#a97a3c'; rr(g, 3, 3, W - 6, H - 6, 4); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(60,36,14,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(3, 3); g.lineTo(W - 3, H - 3); g.moveTo(W - 3, 3); g.lineTo(3, H - 3); g.stroke();
    this.add(plane(c, 1.2, 1.0, x - 0.6, y, -0.7));
  }

  update(time: number, barrels: Barrel[]): void {
    for (let i = 0; i < this.lanternGlows.length; i++) { const k = 0.9 + 0.1 * Math.sin(time * 5 + i * 1.7); this.lanternGlows[i].scale.set(k, k, 1); }
    barrels.forEach((b, i) => { if (this.barrelMeshes[i]) this.barrelMeshes[i].visible = b.alive; });
    if (this.flag) this.flag.scale.x = 0.9 + 0.1 * Math.sin(time * 4);
  }

  dispose(): void { for (const m of this.disposables) { m.geometry.dispose(); const mat = m.material as THREE.MeshBasicMaterial; mat.map?.dispose(); mat.dispose(); } }
}
