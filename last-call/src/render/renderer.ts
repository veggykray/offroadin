import type { Game, Fx } from '../game/game';
import type { Unit, UnitKind } from '../game/units';
import { Mat } from '../world/terrain';
import type { Camera } from './camera';

const C = {
  sky1: '#141a27', sky2: '#2d3a52', hillsFar: '#1f2a3d', hillsNear: '#28344a',
  stable: '#6a6d76', stableEdge: '#a0a4ad', soil: '#7a5633', soilEdge: '#b07f4f', timber: '#a97a3c', timberEdge: '#e0b06a',
  ally: '#5ad26a', enemy: '#ff4d4d', gold: '#f2c94c',
};

export interface RenderOptions { debug: boolean; mouseWorld: { x: number; y: number } | null; time: number }

type Ctx = CanvasRenderingContext2D;

export class Renderer {
  private ctx: Ctx;
  private terrainCanvas = document.createElement('canvas');
  private tctx: Ctx;
  private terrainVersion = -1;
  private readonly PX = 4;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.tctx = this.terrainCanvas.getContext('2d')!;
  }

  render(g: Game, cam: Camera, o: RenderOptions): void {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, cam, W, H);
    this.drawTerrain(g, cam);
    cam.applyTo(ctx);
    this.drawDecor(ctx, g, o.time);
    this.drawGoal(ctx, g, cam, o.time);
    for (const b of g.barrels) if (b.alive) this.drawBarrel(ctx, b.x, b.y, b.w, b.h);
    this.drawSpear(ctx, g, cam, o.time);
    this.drawJackal(ctx, g, o.time);
    for (const u of g.units) if (!u.alive) this.drawDowned(ctx, cam, u);
    for (const u of g.units) if (u.alive) this.drawUnit(ctx, g, u, o.time);
    for (const p of g.projectiles) this.drawProjectile(ctx, p.x, p.y, p.angle, p.spec.kind, p.color);
    for (const f of g.fx) this.drawFx(ctx, cam, f);
    this.drawPreview(ctx, g, cam, o.time);
    for (const u of g.units) if (u.alive) this.drawBars(ctx, cam, g, u, o.time);
    for (const l of g.level.labels) this.text(ctx, cam, l.x, l.y, l.text, 11, 'rgba(255,255,255,0.35)');
    if (o.debug) this.drawDebug(ctx, cam, g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- background / terrain ------------------------------------------------------------
  private drawBackground(ctx: Ctx, cam: Camera, W: number, H: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.sky1); grad.addColorStop(1, C.sky2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // Two cheap parallax hill bands.
    for (const [k, color, base, amp] of [[0.08, C.hillsFar, 0.62, 0.05], [0.16, C.hillsNear, 0.72, 0.04]] as [number, string, number, number][]) {
      ctx.fillStyle = color; ctx.beginPath();
      const off = (cam.x - cam.levelW / 2) * cam.zoom * k;
      ctx.moveTo(0, H);
      for (let i = 0; i <= 24; i++) {
        const sx = (i / 24) * W;
        const u = (sx + off) / W * 6;
        ctx.lineTo(sx, H * (base - amp * (0.5 + 0.5 * Math.sin(u * 1.7) + 0.3 * Math.sin(u * 4.3 + 1))));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    // Distant village skyline (rooftops + chimneys), weak parallax. Cheap and unobtrusive.
    const off = (cam.x - cam.levelW / 2) * cam.zoom * 0.12;
    const base = H * 0.57;
    ctx.fillStyle = '#1a2233'; ctx.beginPath(); ctx.moveTo(-50, H);
    for (let i = 0; i < 40; i++) {
      const x0 = -50 + i * (W + 100) / 40 - (off % ((W + 100) / 40));
      const w = (W + 100) / 40, hh = 18 + ((i * 37) % 5) * 9;
      ctx.lineTo(x0, base); ctx.lineTo(x0 + w * 0.5, base - hh); ctx.lineTo(x0 + w, base);
    }
    ctx.lineTo(W + 50, H); ctx.closePath(); ctx.fill();
  }

  private rebuildTerrain(g: Game): void {
    const t = g.terrain, PX = this.PX;
    this.terrainCanvas.width = t.cols * PX; this.terrainCanvas.height = t.rows * PX;
    const c = this.tctx;
    c.clearRect(0, 0, this.terrainCanvas.width, this.terrainCanvas.height);
    const fill = [ '', C.stable, C.soil, C.timber ], edge = ['', C.stableEdge, C.soilEdge, C.timberEdge];
    for (let cy = 0; cy < t.rows; cy++) {
      const py = (t.rows - 1 - cy) * PX;
      let cx = 0;
      while (cx < t.cols) {
        const m = t.get(cx, cy);
        let run = 1; while (cx + run < t.cols && t.get(cx + run, cy) === m) run++;
        if (m !== Mat.Air) {
          c.fillStyle = fill[m]; c.fillRect(cx * PX, py, run * PX, PX);
          if (m === Mat.Timber) { c.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < run; i++) if ((cx + i + cy) % 4 === 0) c.fillRect((cx + i) * PX, py, PX, 1); }
          if (m === Mat.Soil) { c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < run; i++) if (((cx + i) * 7 + cy * 13) % 5 === 0) c.fillRect((cx + i) * PX + 1, py + 1, 2, 2); }
          if (m === Mat.Stable) { c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < run; i++) if (((cx + i) * 3 + cy) % 6 === 0) c.fillRect((cx + i) * PX, py, PX, 1); }
          // Surface highlight where air sits above: makes walkable tops legible from far away.
          for (let i = 0; i < run; i++) if (t.get(cx + i, cy + 1) === Mat.Air) { c.fillStyle = edge[m]; c.fillRect((cx + i) * PX, py, PX, 1); }
        }
        cx += run;
      }
    }
    this.terrainVersion = t.version;
  }

  private drawTerrain(g: Game, cam: Camera): void {
    if (g.terrain.version !== this.terrainVersion) this.rebuildTerrain(g);
    const ctx = this.ctx;
    const tl = cam.worldToScreen(0, g.terrain.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrainCanvas, tl.x, tl.y, g.terrain.width * cam.zoom, g.terrain.height * cam.zoom);
    ctx.imageSmoothingEnabled = true;
  }

  private drawDecor(ctx: Ctx, g: Game, time: number): void {
    // Ruined arch under the stone crossing (visual only; the deck is the collidable part).
    ctx.strokeStyle = 'rgba(160,164,173,0.35)'; ctx.lineWidth = 0.5; ctx.beginPath();
    ctx.moveTo(60, 2); ctx.quadraticCurveTo(70, 18, 80, 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,164,173,0.18)'; ctx.lineWidth = 0.25; ctx.beginPath();
    ctx.moveTo(61.5, 2); ctx.quadraticCurveTo(70, 15.5, 78.5, 2); ctx.stroke();
    // Bell in the ruined tower.
    ctx.fillStyle = '#8a7a4a'; ctx.beginPath(); ctx.moveTo(2.5, 29); ctx.lineTo(1.7, 27.3); ctx.lineTo(3.3, 27.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,164,173,0.5)'; ctx.fillRect(2.4, 29, 0.2, 1.2);
    // Lantern glow in the tavern (subtle).
    ctx.fillStyle = `rgba(255,200,120,${0.05 + 0.02 * Math.sin(time * 3)})`; ctx.beginPath(); ctx.arc(6, 14.5, 3.2, 0, Math.PI * 2); ctx.fill();
  }

  private drawGoal(ctx: Ctx, g: Game, cam: Camera, time: number): void {
    const z = g.level.goal;
    ctx.fillStyle = `rgba(242,201,76,${0.12 + 0.05 * Math.sin(time * 2)})`;
    ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    ctx.strokeStyle = 'rgba(242,201,76,0.6)'; ctx.lineWidth = 0.12; ctx.setLineDash([0.5, 0.4]);
    ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.setLineDash([]);
    const fx = (z.x0 + z.x1) / 2;
    ctx.fillStyle = '#d9d2b8'; ctx.fillRect(fx - 0.08, z.y0, 0.16, 4.5);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(fx + 0.08, z.y0 + 4.5); ctx.lineTo(fx + 2.2 + 0.15 * Math.sin(time * 4), z.y0 + 3.9); ctx.lineTo(fx + 0.08, z.y0 + 3.3); ctx.closePath(); ctx.fill();
    this.text(ctx, cam, fx, z.y0 + 5.6, 'REACH THIS PLATFORM', 11, 'rgba(242,201,76,0.9)');
  }

  private drawBarrel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = '#7d3b2a'; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(x - w / 2, y + h * 0.3, w, 0.1); ctx.fillRect(x - w / 2, y + h * 0.7, w, 0.1);
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 0.08; ctx.beginPath();
    ctx.moveTo(x - 0.25, y + h / 2 - 0.25); ctx.lineTo(x + 0.25, y + h / 2 + 0.25); ctx.moveTo(x + 0.25, y + h / 2 - 0.25); ctx.lineTo(x - 0.25, y + h / 2 + 0.25); ctx.stroke();
  }

  // ---- units -----------------------------------------------------------------------------
  private drawUnit(ctx: Ctx, g: Game, u: Unit, time: number): void {
    const b = u.body;
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(u.facing, 1);
    const aiming = g.selectedId === u.id && g.mode !== 'none' && g.ability(u, g.mode)?.mode === 'aim';
    const aimAngle = aiming ? (u.facing > 0 ? g.aim.angle : Math.PI - g.aim.angle) : 0.3;
    switch (u.kind) {
      case 'beast': drawBeast(ctx, u, time); break;
      case 'giant': drawGiant(ctx, u); break;
      case 'inventor': drawInventor(ctx, u, aimAngle, time); break;
      case 'spear': drawSpearman(ctx, u, g.spear.state === 'held'); break;
      case 'duelist': drawDuelist(ctx, u); break;
      case 'raider': drawRaider(ctx, u); break;
      case 'archer': drawArcher(ctx, u); break;
    }
    if (u.anim.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${u.anim.hitFlash * 1.6})`; ctx.fillRect(-b.w / 2, 0, b.w, b.h); }
    ctx.restore();
    // Facing tick for the selected hero.
    if (g.selectedId === u.id && g.phase === 'player') {
      ctx.fillStyle = C.gold; const bob = 0.15 * Math.sin(time * 5);
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h + 1.3 + bob); ctx.lineTo(b.x - 0.45, b.y + b.h + 2.0 + bob); ctx.lineTo(b.x + 0.45, b.y + b.h + 2.0 + bob); ctx.closePath(); ctx.fill();
    }
  }

  private drawDowned(ctx: Ctx, cam: Camera, u: Unit): void {
    const b = u.body;
    ctx.strokeStyle = u.team === 'hero' ? 'rgba(200,200,200,0.5)' : 'rgba(255,100,100,0.4)'; ctx.lineWidth = 0.15;
    ctx.beginPath(); ctx.moveTo(b.x - 0.6, b.y + 0.2); ctx.lineTo(b.x + 0.6, b.y + 1.0); ctx.moveTo(b.x + 0.6, b.y + 0.2); ctx.lineTo(b.x - 0.6, b.y + 1.0); ctx.stroke();
    this.text(ctx, cam, b.x, b.y + 1.6, `${u.def.name} (down)`, 10, 'rgba(255,255,255,0.45)');
  }

  private drawJackal(ctx: Ctx, g: Game, time: number): void {
    const j = g.jackal; const b = j.body;
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(j.facing, 1);
    const run = j.state === 'running' ? Math.sin(time * 30) * 0.2 : 0;
    ctx.fillStyle = '#6e5a4a';
    ctx.fillRect(-0.8, 0.35, 1.6, 0.42);                       // long low body
    ctx.fillRect(0.6, 0.5, 0.5, 0.35); ctx.fillRect(0.95, 0.5, 0.45, 0.18); // head + snout
    ctx.fillStyle = '#3a2e26';                                 // leathery spines along the back
    for (let i = 0; i < 5; i++) { const sx = -0.7 + i * 0.32; ctx.beginPath(); ctx.moveTo(sx, 0.77); ctx.lineTo(sx + 0.1, 1.05); ctx.lineTo(sx + 0.2, 0.77); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#5a4738'; ctx.lineWidth = 0.1; ctx.beginPath();            // legs
    for (const lx of [-0.6, -0.35, 0.35, 0.6]) { const d = Math.sign(lx) * run; ctx.moveTo(lx, 0.4); ctx.lineTo(lx + d, 0); }
    ctx.stroke();
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(0.85, 0.72, 0.1, 0.08);  // eye
    ctx.fillStyle = '#6e5a4a'; ctx.beginPath(); ctx.moveTo(-0.8, 0.6); ctx.lineTo(-1.3, 0.9); ctx.lineTo(-0.8, 0.45); ctx.fill(); // tail
    ctx.restore();
  }

  private drawSpear(ctx: Ctx, g: Game, cam: Camera, time: number): void {
    const s = g.spear;
    if (s.state === 'held') return;
    const b = s.body;
    ctx.save(); ctx.translate(b.x, b.y + 0.25);
    ctx.rotate(s.state === 'flying' ? s.angle : -1.1);
    ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(-1.3, 0); ctx.lineTo(1.1, 0); ctx.stroke();
    ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(1.1, -0.18); ctx.lineTo(1.6, 0); ctx.lineTo(1.1, 0.18); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (s.state === 'resting') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.strokeStyle = `rgba(159,227,255,${0.4 + 0.4 * pulse})`; ctx.lineWidth = 0.1; ctx.setLineDash([0.3, 0.3]);
      ctx.beginPath(); ctx.arc(b.x, b.y + 0.4, 1.2 + 0.2 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y + 2); ctx.lineTo(b.x, b.y + 4.5); ctx.stroke();
      this.text(ctx, cam, b.x, b.y + 5.2, 'SPEAR — walk Vesk here', 11, '#9fe3ff');
    }
  }

  private drawProjectile(ctx: Ctx, x: number, y: number, angle: number, kind: string, color: string): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (kind === 'spear') { /* drawn by drawSpear */ }
    else if (kind === 'bullet') { ctx.fillStyle = color; ctx.fillRect(-0.5, -0.06, 0.9, 0.12); }
    else if (kind === 'arrow') { ctx.strokeStyle = color; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(-0.9, 0); ctx.lineTo(0.3, 0); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0.3, -0.12); ctx.lineTo(0.6, 0); ctx.lineTo(0.3, 0.12); ctx.fill(); }
    else if (kind === 'shell') { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 0.32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(-0.45, 0, 0.14, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === 'hatchet') { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-0.4, -0.05, 0.8, 0.1); ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0.2, -0.25, 0.3, 0.5); }
    else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, kind === 'gadget' ? 0.25 : 0.18, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  private drawFx(ctx: Ctx, cam: Camera, f: Fx): void {
    const a = Math.max(0, f.life / f.max);
    switch (f.kind) {
      case 'debris': ctx.fillStyle = f.color; ctx.globalAlpha = a; ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size); ctx.globalAlpha = 1; break;
      case 'spark': ctx.fillStyle = f.color; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'smoke': ctx.fillStyle = f.color; ctx.globalAlpha = a * 0.45; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1.4 - a * 0.6), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'ring': ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1.3 - a), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
      case 'flash': ctx.fillStyle = f.color; ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.6 + 0.4 * a), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'line': ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = f.size; ctx.setLineDash([0.6, 0.4]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2!, f.y2!); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; break;
      case 'text': this.text(ctx, cam, f.x, f.y, f.text!, 13, f.color, a); break;
    }
  }

  // ---- previews -------------------------------------------------------------------------
  private drawPreview(ctx: Ctx, g: Game, cam: Camera, time: number): void {
    const u = g.selected; const p = g.preview;
    if (!u || g.mode === 'none') return;
    const ab = g.ability(u, g.mode)!;
    // Hover highlight for target abilities.
    if (ab.mode === 'target') {
      for (const e of g.livingEnemies()) {
        const sel = e.id === g.aim.targetId;
        ctx.strokeStyle = sel ? (p?.ok ? 'rgba(90,210,106,0.9)' : 'rgba(255,90,90,0.9)') : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = sel ? 0.18 : 0.08; ctx.setLineDash(sel ? [] : [0.4, 0.3]);
        ctx.strokeRect(e.body.x - e.body.w / 2 - 0.4, e.body.y - 0.2, e.body.w + 0.8, e.body.h + 0.6);
        ctx.setLineDash([]);
      }
    }
    if (!p) return;
    if (p.points) {
      for (let i = 0; i < p.points.length; i++) {
        const q = p.points[i]; const a = 0.9 - 0.6 * (i / p.points.length);
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(q.x, q.y, 0.13, 0, Math.PI * 2); ctx.fill();
      }
      if (p.impact) {
        ctx.strokeStyle = 'rgba(255,120,80,0.95)'; ctx.lineWidth = 0.12; ctx.beginPath();
        ctx.moveTo(p.impact.x - 0.5, p.impact.y - 0.5); ctx.lineTo(p.impact.x + 0.5, p.impact.y + 0.5); ctx.moveTo(p.impact.x + 0.5, p.impact.y - 0.5); ctx.lineTo(p.impact.x - 0.5, p.impact.y + 0.5); ctx.stroke();
        if (p.splash) { ctx.strokeStyle = 'rgba(255,170,80,0.7)'; ctx.setLineDash([0.5, 0.4]); ctx.beginPath(); ctx.arc(p.impact.x, p.impact.y, p.splash, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      }
      // Power bar near the muzzle.
      const m = g.muzzle(u);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(m.x - 1.5, m.y + 2.6, 3, 0.4);
      ctx.fillStyle = C.gold; ctx.fillRect(m.x - 1.5, m.y + 2.6, 3 * g.aim.power, 0.4);
    }
    if (p.path && p.path.length > 1) {
      ctx.strokeStyle = p.ok ? 'rgba(90,210,106,0.8)' : 'rgba(255,90,90,0.7)'; ctx.lineWidth = 0.16; ctx.setLineDash([0.5, 0.35]);
      ctx.beginPath(); ctx.moveTo(p.path[0].x, p.path[0].y + 0.3);
      for (const q of p.path) ctx.lineTo(q.x, q.y + 0.3);
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (p.end && p.ok) {
      ctx.strokeStyle = 'rgba(90,210,106,0.7)'; ctx.lineWidth = 0.1; ctx.setLineDash([0.3, 0.3]);
      ctx.strokeRect(p.end.x - u.body.w / 2, p.end.y, u.body.w, u.body.h); ctx.setLineDash([]);
    }
    if (p.landing) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.strokeStyle = p.ok ? `rgba(90,210,106,${0.5 + 0.5 * pulse})` : 'rgba(255,90,90,0.8)'; ctx.lineWidth = 0.12;
      ctx.beginPath(); ctx.ellipse(p.landing.x, p.landing.y + 0.1, 1.0, 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.hitRect) {
      const r = p.hitRect; ctx.fillStyle = 'rgba(255,200,80,0.18)'; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      ctx.strokeStyle = 'rgba(255,200,80,0.6)'; ctx.lineWidth = 0.08; ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    }
  }

  // ---- bars & text -------------------------------------------------------------------------
  private drawBars(ctx: Ctx, cam: Camera, g: Game, u: Unit, time: number): void {
    const b = u.body;
    const top = cam.worldToScreen(b.x, b.y + b.h + 0.5);
    const w = Math.max(44, b.w * cam.zoom), h = 6;
    const x = top.x - w / 2, y = top.y - h;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const frac = u.hp / u.maxHp;
    if (u.team === 'hero') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = frac > 0.5 ? C.ally : frac > 0.25 ? '#e0c04a' : '#e06a4a'; ctx.fillRect(x, y, w * frac, h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      // move / action pips
      const sel = g.selectedId === u.id;
      ctx.fillStyle = u.moveLeft > 0 ? '#7fd4ff' : 'rgba(255,255,255,0.2)'; ctx.fillRect(x + w + 5, y, 5, h);
      ctx.fillStyle = !u.acted ? '#ffd36b' : 'rgba(255,255,255,0.2)'; ctx.fillRect(x + w + 12, y, 5, h);
      ctx.font = `${sel ? 'bold ' : ''}11px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = sel ? '#fff' : 'rgba(255,255,255,0.8)';
      ctx.fillText(u.def.name, top.x, y - 4);
    } else {
      // Enemy bars: red, dark bevel, diamond marker — visibly different from ally bars.
      ctx.fillStyle = 'rgba(40,0,0,0.75)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = C.enemy; ctx.fillRect(x, y, w * frac, h);
      ctx.strokeStyle = '#2a0000'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      ctx.fillStyle = C.enemy; ctx.beginPath(); ctx.moveTo(x - 9, y + h / 2); ctx.lineTo(x - 5, y - 1); ctx.lineTo(x - 1, y + h / 2); ctx.lineTo(x - 5, y + h + 1); ctx.closePath(); ctx.fill();
      ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb0b0';
      ctx.fillText(u.def.name.toUpperCase(), top.x, y - 4);
      if (g.phase === 'enemy' && u.intent) { ctx.fillStyle = 'rgba(255,200,200,0.9)'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(u.intent, top.x, y - 17 + Math.sin(time * 3)); }
    }
    ctx.restore();
  }

  private text(ctx: Ctx, cam: Camera, wx: number, wy: number, str: string, px: number, color: string, alpha = 1): void {
    const p = cam.worldToScreen(wx, wy);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha;
    ctx.font = `${px}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(str, p.x, p.y);
    ctx.restore();
  }

  private drawDebug(ctx: Ctx, cam: Camera, g: Game): void {
    ctx.lineWidth = 0.06;
    for (const u of g.units) {
      if (!u.alive) continue;
      const b = u.body;
      ctx.strokeStyle = b.grounded ? 'rgba(0,255,255,0.8)' : 'rgba(255,0,255,0.8)';
      ctx.strokeRect(b.x - b.w / 2, b.y, b.w, b.h);
      const span = Math.max(b.w, b.footSpan);
      ctx.strokeStyle = 'rgba(255,255,0,0.7)'; ctx.beginPath(); ctx.moveTo(b.x - span / 2, b.y - 0.1); ctx.lineTo(b.x + span / 2, b.y - 0.1); ctx.stroke();
      this.text(ctx, cam, b.x, b.y - 0.9, `${b.x.toFixed(1)},${b.y.toFixed(2)}${u.team === 'hero' ? ` mv${u.moveLeft.toFixed(1)}` : ''}`, 10, '#0ff');
    }
    const j = g.jackal.body; ctx.strokeStyle = 'rgba(255,160,0,0.8)'; ctx.strokeRect(j.x - j.w / 2, j.y, j.w, j.h);
    const s = g.spear.body; ctx.strokeStyle = 'rgba(159,227,255,0.9)'; ctx.strokeRect(s.x - s.w / 2, s.y, s.w, s.h);
    // Destructible cells outline (coarse): draw grid lines every 4 units for spatial reference.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.04; ctx.beginPath();
    for (let x = 0; x <= g.terrain.width; x += 4) { ctx.moveTo(x, 0); ctx.lineTo(x, g.terrain.height); }
    for (let y = 0; y <= g.terrain.height; y += 4) { ctx.moveTo(0, y); ctx.lineTo(g.terrain.width, y); }
    ctx.stroke();
    for (let x = 0; x <= g.terrain.width; x += 10) this.text(ctx, cam, x, 0.6, String(x), 10, 'rgba(255,255,255,0.5)');
  }
}

// ---- character silhouettes (local coords: feet at origin, facing +x) --------------------------
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w: number): void { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function tri(ctx: Ctx, pts: number[], color: string): void { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.closePath(); ctx.fill(); }
const SKIN = '#e9c39b', DARK = '#2b2b33';

function legs(ctx: Ctx, u: Unit, spread: number, h: number, w: number, color: string): void {
  const s = Math.sin(u.anim.walkPhase) * 0.25;
  rect(ctx, -spread - w / 2 + s, 0, w, h, color); rect(ctx, spread - w / 2 - s, 0, w, h, color);
}

export function drawBeast(ctx: Ctx, u: Unit, time: number): void {
  legs(ctx, u, 0.22, 1.25, 0.3, '#3d4a2a');
  rect(ctx, -0.55, 1.15, 1.1, 1.25, u.def.color);               // scruffy coat
  line(ctx, -0.55, 1.5, -0.8, 1.2, '#6f8f3a', 0.12);             // ragged hem
  ctx.save(); ctx.translate(0.05, 2.7); ctx.rotate(-0.22);       // dazed, tilted head
  circle(ctx, 0, 0, 0.36, SKIN);
  for (let i = 0; i < 5; i++) line(ctx, -0.3 + i * 0.15, 0.3, -0.4 + i * 0.17, 0.62 + (i % 2) * 0.1, '#5a4330', 0.09); // scruffy hair
  circle(ctx, 0.14, 0.02, 0.05, DARK); circle(ctx, -0.1, 0.08, 0.05, DARK);
  ctx.restore();
  // bird-like creature perched on the back shoulder (visual only)
  const flap = Math.sin(time * 6) * 0.08;
  tri(ctx, [-0.6, 2.45, -0.95, 2.75 + flap, -0.5, 2.75], '#d8b24a');
  circle(ctx, -0.5, 2.78, 0.12, '#d8b24a'); tri(ctx, [-0.38, 2.78, -0.26, 2.74, -0.38, 2.7], '#333');
  // hatchet in hand
  line(ctx, 0.5, 1.7, 0.9, 2.2, '#8a6a3a', 0.1); rect(ctx, 0.8, 2.1, 0.3, 0.35, '#d8d8d8');
}

export function drawGiant(ctx: Ctx, u: Unit): void {
  legs(ctx, u, 0.5, 2.1, 0.7, '#6b4a2a');
  rect(ctx, -1.05, 2.0, 2.1, 2.5, u.def.color);                 // broad armored torso
  rect(ctx, -1.05, 2.0, 2.1, 0.3, '#8a5a24'); rect(ctx, -0.2, 2.0, 0.4, 2.5, '#d9a24a'); // belt + ornate seam
  circle(ctx, 0.1, 4.95, 0.45, SKIN); rect(ctx, -0.35, 5.25, 0.9, 0.3, '#5a3a24'); // head + braid
  circle(ctx, 0.25, 5.0, 0.05, DARK);
  // huge shield (back arm)
  circle(ctx, -1.0, 2.9, 1.15, '#4a5a7a'); circle(ctx, -1.0, 2.9, 0.9, '#6a7a9a'); circle(ctx, -1.0, 2.9, 0.3, '#d9a24a');
  // ornate armored fist (front arm), swings forward on attack
  const sw = u.anim.swing > 0 ? Math.sin((0.4 - u.anim.swing) / 0.4 * Math.PI) * 1.1 : 0;
  rect(ctx, 0.95 + sw, 2.3, 0.95, 0.95, '#9a7a3a'); ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 0.1; ctx.strokeRect(1.0 + sw, 2.35, 0.85, 0.85);
  for (let i = 0; i < 3; i++) rect(ctx, 1.05 + sw + i * 0.28, 3.1, 0.2, 0.15, '#ffd36b');
}

/** The walker has exactly six articulated legs: two rows (far/near) of three. There are no wheels. */
export const INVENTOR_LEGS = 6;

export function drawInventor(ctx: Ctx, u: Unit, aimAngle: number, time: number): void {
  const phase = u.anim.walkPhase;
  const sides: [number, string][] = [[Math.PI, '#4a4458'], [0, '#7a7090']];
  const perSide = INVENTOR_LEGS / 2;
  for (const [off, color] of sides) {
    for (let i = 0; i < perSide; i++) {
      const hipX = -0.75 + i * 0.75;
      const ph = phase + i * 2.094 + off;
      const footX = hipX + 0.45 * Math.sin(ph);
      const lift = Math.max(0, Math.sin(ph + Math.PI / 2)) * 0.28;
      const kneeX = (hipX + footX) / 2 + (off === 0 ? 0.35 : -0.35), kneeY = 1.35;
      line(ctx, hipX, 1.0, kneeX, kneeY, color, 0.13);
      line(ctx, kneeX, kneeY, footX, lift, color, 0.11);
      circle(ctx, kneeX, kneeY, 0.08, '#2a2634');
    }
  }
  rect(ctx, -1.0, 0.95, 2.0, 0.9, '#5c5470'); rect(ctx, -0.9, 1.05, 1.8, 0.2, '#8f84a8'); // walker chassis
  circle(ctx, 0.75, 1.4, 0.18, '#c9a7ff'); circle(ctx, 0.4, 1.4, 0.1, '#ffd36b');        // fake-magic gadgets
  // cannon on top, follows the aim
  ctx.save(); ctx.translate(0.2, 1.95); ctx.rotate(aimAngle);
  rect(ctx, -0.3, -0.16, 1.7, 0.32, '#2b2b33'); rect(ctx, 1.25, -0.2, 0.2, 0.4, '#555');
  ctx.restore();
  // tiny person with an enormous head, perched at the back
  rect(ctx, -0.75, 1.85, 0.4, 0.5, '#7c5cc4');
  circle(ctx, -0.55, 2.85, 0.56, SKIN);
  circle(ctx, -0.35, 2.9, 0.1, '#fff'); circle(ctx, -0.33, 2.9, 0.05, DARK); line(ctx, -0.95, 2.95, -0.6, 2.95, '#b58f6a', 0.06);
  tri(ctx, [-1.1, 3.25, -0.0, 3.25, -0.4, 4.2 + Math.sin(time * 2) * 0.03], '#4a3a8a');          // fake wizard hat
  circle(ctx, -0.4, 4.15, 0.08, '#ffd36b');
}

export function drawSpearman(ctx: Ctx, u: Unit, spearHeld: boolean): void {
  legs(ctx, u, 0.15, 1.35, 0.22, '#2d5a66');
  rect(ctx, -0.35, 1.3, 0.7, 1.25, u.def.color);                 // slender torso
  circle(ctx, 0, 2.9, 0.36, '#a7c8d0');                          // head
  circle(ctx, 0.12, 2.95, 0.15, '#fff'); circle(ctx, 0.15, 2.95, 0.08, DARK);   // very large eyes
  circle(ctx, -0.16, 2.93, 0.13, '#fff'); circle(ctx, -0.14, 2.93, 0.07, DARK);
  rect(ctx, 0.3, 2.74, 0.32, 0.17, '#7d9aa3'); rect(ctx, 0.55, 2.78, 0.1, 0.1, DARK); // armadillo-like snout
  tri(ctx, [-0.25, 3.15, -0.45, 3.95, 0.0, 3.25], '#7d9aa3'); tri(ctx, [0.05, 3.2, 0.2, 3.9, 0.3, 3.2], '#7d9aa3'); // bat ears
  if (spearHeld) { line(ctx, -0.3, 0.9, 0.55, 3.7, '#9fe3ff', 0.1); tri(ctx, [0.5, 3.6, 0.72, 4.2, 0.65, 3.55], '#e8f8ff'); }
  else { line(ctx, 0.4, 1.9, 0.4, 2.3, '#8a6a3a', 0.08); line(ctx, 0.4, 2.3, 0.25, 2.55, '#8a6a3a', 0.06); line(ctx, 0.4, 2.3, 0.55, 2.55, '#8a6a3a', 0.06); }
}

export function drawDuelist(ctx: Ctx, u: Unit): void {
  legs(ctx, u, 0.18, 1.35, 0.26, '#3a2a3a');
  rect(ctx, -0.4, 1.3, 0.8, 1.25, u.def.color); rect(ctx, -0.4, 1.3, 0.8, 0.12, '#ffd36b');   // doublet + belt
  circle(ctx, 0, 2.9, 0.34, SKIN); circle(ctx, 0.12, 2.95, 0.05, DARK);
  rect(ctx, -0.5, 3.12, 1.0, 0.1, '#2b2b33'); rect(ctx, -0.3, 3.2, 0.6, 0.3, '#2b2b33');     // hat
  line(ctx, 0.1, 3.5, -0.5, 3.95, '#ff7b7b', 0.08);                                           // feather
  const lunge = u.anim.swing > 0 ? Math.sin((0.35 - u.anim.swing) / 0.35 * Math.PI) * 0.6 : 0;
  line(ctx, 0.35 + lunge, 1.7, 1.55 + lunge, 1.95, '#e8e8f0', 0.07);                           // rapier
  rect(ctx, -0.55, 1.95, 0.35, 0.18, '#444'); rect(ctx, -0.5, 1.75, 0.12, 0.22, '#8a6a3a');    // pistol
}

export function drawRaider(ctx: Ctx, u: Unit): void {
  legs(ctx, u, 0.22, 1.3, 0.3, '#4a1e1e');
  rect(ctx, -0.55, 1.25, 1.1, 1.3, u.def.color); rect(ctx, -0.55, 1.25, 1.1, 0.15, '#2a0a0a');
  circle(ctx, 0, 2.9, 0.36, '#c98a6a'); rect(ctx, -0.4, 2.95, 0.8, 0.3, '#333');              // helmet band
  tri(ctx, [-0.3, 3.2, -0.5, 3.8, -0.1, 3.25], '#ddd'); tri(ctx, [0.1, 3.25, 0.5, 3.8, 0.3, 3.2], '#ddd'); // horns
  const sw = u.anim.swing > 0 ? Math.sin((0.4 - u.anim.swing) / 0.4 * Math.PI) * 0.9 : 0;
  line(ctx, 0.5, 1.9, 1.2 + sw, 2.4 - sw * 0.5, '#cfcfcf', 0.12);                              // crude blade
}

export function drawArcher(ctx: Ctx, u: Unit): void {
  legs(ctx, u, 0.2, 1.3, 0.26, '#3a1a33');
  rect(ctx, -0.5, 1.25, 1.0, 1.3, u.def.color); rect(ctx, -0.5, 2.3, 1.0, 0.25, '#4a2a44');
  circle(ctx, 0, 2.9, 0.34, '#c98a6a'); rect(ctx, -0.4, 3.05, 0.8, 0.25, '#4a2a44');
  ctx.strokeStyle = '#d8c080'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(0.55, 2.1, 0.9, -1.2, 1.2); ctx.stroke(); // bow
  line(ctx, 0.55 + Math.cos(-1.2) * 0.9, 2.1 + Math.sin(-1.2) * 0.9, 0.55 + Math.cos(1.2) * 0.9, 2.1 + Math.sin(1.2) * 0.9, '#eee', 0.04);
}

export function drawByKind(ctx: Ctx, kind: UnitKind, u: Unit, time: number): void {
  switch (kind) {
    case 'beast': drawBeast(ctx, u, time); break;
    case 'giant': drawGiant(ctx, u); break;
    case 'inventor': drawInventor(ctx, u, 0.3, time); break;
    case 'spear': drawSpearman(ctx, u, true); break;
    case 'duelist': drawDuelist(ctx, u); break;
    case 'raider': drawRaider(ctx, u); break;
    case 'archer': drawArcher(ctx, u); break;
  }
}
