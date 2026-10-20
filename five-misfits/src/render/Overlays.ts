import * as THREE from 'three';
import type { Game } from '../game/game';
import type { Unit } from '../game/units';
import { softDisc, ringSprite, makeCanvas, ctx2d } from '../art/paint';

const MAXI = 256;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color(), Z = new THREE.Vector3(0, 0, 1);

class Inst {
  mesh: THREE.InstancedMesh; n = 0;
  constructor(parent: THREE.Group, canvas: HTMLCanvasElement, z: number, additive = false) {
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAXI);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.position.z = z; this.mesh.frustumCulled = false; this.mesh.renderOrder = 80;
    parent.add(this.mesh);
  }
  begin(): void { this.n = 0; }
  add(x: number, y: number, sx: number, sy: number, rot: number, color: string | THREE.Color, alpha: number): void {
    if (this.n >= MAXI) return;
    tmpP.set(x, y, 0); tmpQ.setFromAxisAngle(Z, rot); tmpS.set(sx, sy, 1); tmpM.compose(tmpP, tmpQ, tmpS);
    this.mesh.setMatrixAt(this.n, tmpM); tmpC.set(color as THREE.ColorRepresentation).multiplyScalar(alpha); this.mesh.setColorAt(this.n, tmpC); this.n++;
  }
  end(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  dispose(): void { this.mesh.geometry.dispose(); const m = this.mesh.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); }
}

class Lines {
  private pool: THREE.Line[] = []; private used = 0;
  constructor(private parent: THREE.Group, private dashed: boolean) {}
  begin(): void { this.used = 0; }
  draw(points: { x: number; y: number }[], color: string, alpha: number, z = 3.2): void {
    if (points.length < 2) return;
    let l = this.pool[this.used];
    if (!l) {
      const mat = this.dashed ? new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, dashSize: 0.5, gapSize: 0.35 }) : new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true });
      l = new THREE.Line(new THREE.BufferGeometry(), mat); l.renderOrder = 85; l.frustumCulled = false; this.parent.add(l); this.pool.push(l);
    }
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = z; });
    l.geometry.dispose(); l.geometry = new THREE.BufferGeometry(); l.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (this.dashed) l.computeLineDistances();
    const m = l.material as THREE.LineBasicMaterial; m.color.set(color); m.opacity = alpha; l.visible = true; this.used++;
  }
  end(): void { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
  dispose(): void { for (const l of this.pool) { l.geometry.dispose(); (l.material as THREE.Material).dispose(); } }
}

class Labels {
  private cache = new Map<string, THREE.CanvasTexture>(); private pool: THREE.Sprite[] = []; private used = 0;
  constructor(private parent: THREE.Group) {}
  begin(): void { this.used = 0; }
  draw(text: string, x: number, y: number, color: string, worldH: number, alpha = 1, bold = true): void {
    const key = `${text}|${color}|${bold}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const c = makeCanvas(512, 64), g = ctx2d(c);
      g.font = `${bold ? 'bold ' : ''}30px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeText(text, 256, 32); g.fillStyle = color; g.fillText(text, 256, 32);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; this.cache.set(key, tex);
    }
    let s = this.pool[this.used];
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.renderOrder = 90; this.parent.add(s); this.pool.push(s); }
    const m = s.material as THREE.SpriteMaterial; m.map = tex; m.opacity = alpha; m.needsUpdate = true;
    s.position.set(x, y, 3.5); s.scale.set(worldH * 8, worldH, 1); s.visible = true; this.used++;
  }
  end(): void { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
  dispose(): void { for (const t of this.cache.values()) t.dispose(); for (const s of this.pool) (s.material as THREE.Material).dispose(); }
}

/** Aim previews, target brackets, telegraph lines, health bars, names, spear marker and goal label. */
export class Overlays {
  readonly group = new THREE.Group();
  private dots: Inst; private rings: Inst; private quads: Inst; private glows: Inst;
  private dashed: Lines; private solid: Lines; private labels: Labels;
  private whiteTex: HTMLCanvasElement;

  constructor() {
    this.whiteTex = makeCanvas(4, 4); ctx2d(this.whiteTex).fillStyle = '#fff'; ctx2d(this.whiteTex).fillRect(0, 0, 4, 4);
    this.dots = new Inst(this.group, softDisc(32, 0.5, 1), 3.1);
    this.rings = new Inst(this.group, ringSprite(128, 0.08), 3.1);
    this.quads = new Inst(this.group, this.whiteTex, 3.0);
    this.glows = new Inst(this.group, softDisc(64, 0, 1.2), 3.05, true);
    this.dashed = new Lines(this.group, true); this.solid = new Lines(this.group, false);
    this.labels = new Labels(this.group);
  }

  /** @param pxPerUnit camera zoom so bars keep a constant on-screen size */
  sync(g: Game, time: number, pxPerUnit: number): void {
    this.dots.begin(); this.rings.begin(); this.quads.begin(); this.glows.begin(); this.dashed.begin(); this.solid.begin(); this.labels.begin();
    const s = 1 / pxPerUnit; // world units per pixel
    this.previews(g, time, s);
    this.telegraphs(g);
    for (const u of g.units) if (u.alive) this.bar(g, u, time, s);
    for (const u of g.units) if (!u.alive) this.labels.draw(`${u.def.name} · down`, u.body.x, u.body.y + 1.6, 'rgba(230,230,230,0.7)', 20 * s, 0.7, false);
    this.spearMarker(g, time, s);
    const z = g.level.goal; this.labels.draw('REACH THE SHRINE', (z.x0 + z.x1) / 2, z.y0 + 7.2, '#f2c94c', 20 * s, 0.9);
    this.dots.end(); this.rings.end(); this.quads.end(); this.glows.end(); this.dashed.end(); this.solid.end(); this.labels.end();
  }

  private previews(g: Game, time: number, s: number): void {
    const u = g.selected, p = g.preview;
    if (!u || g.mode === 'none' || g.phase !== 'player') return;
    const ab = g.ability(u, g.mode)!;
    if (ab.mode === 'target') {
      for (const e of g.livingEnemies()) {
        const sel = e.id === g.aim.targetId;
        const col = sel ? (p?.ok ? '#5ad26a' : '#ff5a5a') : '#ffffff';
        const b = e.body, x0 = b.x - b.w / 2 - 0.5, x1 = b.x + b.w / 2 + 0.5, y0 = b.y - 0.3, y1 = b.y + b.h + 0.4, k = 0.6;
        const pts = [[x0, y0 + k, x0, y0, x0 + k, y0], [x1 - k, y0, x1, y0, x1, y0 + k], [x1, y1 - k, x1, y1, x1 - k, y1], [x0 + k, y1, x0, y1, x0, y1 - k]];
        for (const q of pts) this.solid.draw([{ x: q[0], y: q[1] }, { x: q[2], y: q[3] }, { x: q[4], y: q[5] }], col, sel ? 0.95 : 0.35);
      }
    }
    if (!p) return;
    if (p.points) {
      p.points.forEach((q, i) => this.dots.add(q.x, q.y, 0.32, 0.32, 0, '#ffffff', 0.95 - 0.6 * (i / p.points!.length)));
      if (p.impact) {
        const i = p.impact;
        this.solid.draw([{ x: i.x - 0.6, y: i.y - 0.6 }, { x: i.x + 0.6, y: i.y + 0.6 }], '#ff7a50', 1); this.solid.draw([{ x: i.x + 0.6, y: i.y - 0.6 }, { x: i.x - 0.6, y: i.y + 0.6 }], '#ff7a50', 1);
        if (p.splash) { this.rings.add(i.x, i.y, p.splash * 2, p.splash * 2, time, '#ffb060', 0.85); this.glows.add(i.x, i.y, p.splash * 2.2, p.splash * 2.2, 0, '#ff8040', 0.25); }
      }
      const m = g.muzzle(u);
      this.quads.add(m.x, m.y + 2.9, 3.2, 0.42, 0, '#000000', 0.55);
      this.quads.add(m.x - 1.5 + 1.5 * g.aim.power, m.y + 2.9, 3 * g.aim.power, 0.3, 0, '#f2c94c', 0.95);
    }
    if (p.path && p.path.length > 1) this.dashed.draw(p.path.map((q) => ({ x: q.x, y: q.y + 0.3 })), p.ok ? '#5ad26a' : '#ff5a5a', 0.9);
    if (p.end && p.ok) {
      const b = u.body; const x0 = p.end.x - b.w / 2, x1 = p.end.x + b.w / 2, y0 = p.end.y, y1 = p.end.y + b.h;
      this.dashed.draw([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }], '#5ad26a', 0.7);
    }
    if (p.landing) { const k = 0.5 + 0.5 * Math.sin(time * 6); this.rings.add(p.landing.x, p.landing.y + 0.1, 2.2, 0.7, 0, p.ok ? '#5ad26a' : '#ff5a5a', 0.5 + 0.5 * k); }
    if (p.hitRect) { const r = p.hitRect; this.quads.add((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1], 0, '#ffc850', 0.22); }
    void s;
  }

  private telegraphs(g: Game): void {
    for (const f of g.fx) if (f.kind === 'line') this.dashed.draw([{ x: f.x, y: f.y }, { x: f.x2!, y: f.y2! }], f.color.startsWith('rgba(255,1') ? '#ff6a6a' : '#fff4d0', Math.max(0, f.life / f.max));
  }

  private bar(g: Game, u: Unit, time: number, s: number): void {
    const b = u.body; const cx = b.x, y = b.y + b.h + 0.55 + 10 * s;
    const w = Math.max(46 * s, b.w * 0.9), h = 7 * s;
    const frac = u.hp / u.maxHp;
    if (u.team === 'hero') {
      this.quads.add(cx, y, w + 4 * s, h + 4 * s, 0, '#0a0c10', 0.75);
      this.quads.add(cx, y, w + 2 * s, h + 2 * s, 0, '#e9dcc3', 0.9);
      this.quads.add(cx, y, w, h, 0, '#223', 1);
      this.quads.add(cx - w / 2 + (w * frac) / 2, y, w * frac, h, 0, frac > 0.5 ? '#5ad26a' : frac > 0.25 ? '#e0c04a' : '#e06a4a', 1);
      // move / action pips
      this.quads.add(cx + w / 2 + 7 * s, y, 5 * s, h, 0, u.moveLeft > 0 ? '#7fd4ff' : '#555', 1);
      this.quads.add(cx + w / 2 + 14 * s, y, 5 * s, h, 0, !u.acted ? '#ffd36b' : '#555', 1);
      this.labels.draw(u.def.name, cx, y + 14 * s, g.selectedId === u.id ? '#fff8e0' : '#e0dcd0', 18 * s, 1, g.selectedId === u.id);
      if (g.selectedId === u.id && g.phase === 'player') { const bob = Math.sin(time * 5) * 0.15; this.quads.add(cx, y + 30 * s + bob, 10 * s, 10 * s, Math.PI / 4, '#f2c94c', 1); }
    } else {
      this.quads.add(cx, y, w + 6 * s, h + 6 * s, 0, '#2a0808', 0.85);
      this.quads.add(cx, y, w, h, 0, '#3a1010', 1);
      this.quads.add(cx - w / 2 + (w * frac) / 2, y, w * frac, h, 0, '#ff4d4d', 1);
      this.quads.add(cx - w / 2 - 8 * s, y, 7 * s, 7 * s, Math.PI / 4, '#ff4d4d', 1);
      this.labels.draw(u.def.name.toUpperCase(), cx, y + 14 * s, '#ffb8b8', 16 * s, 1);
      if (g.phase === 'enemy' && u.intent) this.labels.draw(u.intent, cx, y + 30 * s, '#ffd0d0', 16 * s, 0.95, false);
    }
  }

  private spearMarker(g: Game, time: number, s: number): void {
    const sp = g.spear; if (sp.state !== 'resting') return;
    const k = 0.5 + 0.5 * Math.sin(time * 4);
    this.rings.add(sp.body.x, sp.body.y + 0.4, 2.6 + 0.4 * k, 2.6 + 0.4 * k, 0, '#9fe3ff', 0.5 + 0.4 * k);
    this.dashed.draw([{ x: sp.body.x, y: sp.body.y + 2 }, { x: sp.body.x, y: sp.body.y + 4.6 }], '#9fe3ff', 0.8);
    this.labels.draw('SPEAR — walk Vesk here', sp.body.x, sp.body.y + 5.3, '#9fe3ff', 18 * s);
  }

  dispose(): void { this.dots.dispose(); this.rings.dispose(); this.quads.dispose(); this.glows.dispose(); this.dashed.dispose(); this.solid.dispose(); this.labels.dispose(); }
}
