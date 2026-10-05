/* ALIEN STRIKE — retrieval beam.
 * The Vesper's signature tool: a column of energy projected from the ventral
 * emitter under the cargo bay that locks onto an object on the ground and lifts
 * it aboard. Hold the interact key while a target is inside the acquisition
 * radius; the lock builds over the target's retrieval time while the craft holds
 * station. Drifting or moving fast weakens the lock (slower, then decaying);
 * leaving the hold radius breaks it, and progress bleeds away rather than
 * resetting, so the player can correct and resume.
 *
 * Anything can be retrieved if it implements this duck-typed contract:
 *   canRetrieve(pl)            → true when it may be lifted right now
 *   retrieveBlocked(pl)        → optional reason string (e.g. 'BAY FULL') or null
 *   retrievePos()              → { x, y, z } ground position + current height
 *   retrieveTime               → seconds of steady lock needed
 *   retrieveCol, retrieveLabel → beam colour and prompt label
 *   onBeamStart(pl), onBeamProgress(pl, k, stability), onBeamBreak(pl), onRetrieved(pl)
 * Today survivors (AS.SurvivorGroup people) and cargo use it; salvage, artefacts
 * or disabled drones can join by implementing the same methods and being listed
 * in Retrieval.candidates(). */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const ACQUIRE = 52, HOLD = 76, ASCEND = 0.32;

  class Retrieval {
    constructor(player) {
      this.p = player; this.g = player.g;
      this.candidate = null; this.target = null; this.blocked = null;
      this.active = false; this.state = 'idle'; // idle | connect | lock | ascend
      this.progress = new Map();                 // target → 0..1 (persists through brief breaks)
      this.stability = 1; this.intensity = 0; this.extend = 0; this.t = 0;
      this.breakT = 0; this.cooldown = 0; this.ascendT = 0; this.flash = 0;
      this.retrieved = 0; this.lastMark = 0;
    }

    /* every retrievable object currently in the world */
    candidates(out) {
      const g = this.g;
      out.length = 0;
      for (const gr of g.groups) for (const q of gr.people) if (q.alive && !q.aboard && q.canRetrieve) out.push(q);
      for (const c of g.cargo) if (!c.aboard && !c.delivered && c.canRetrieve) out.push(c);
      return out;
    }
    // ground point straight under the ventral emitter
    groundPoint() {
      const p = this.p, b = p.model.beamPt || [0, 0];
      return p.local(b[0], b[1]);
    }

    update(dt) {
      const p = this.p, g = this.g, I = AS.Input;
      this.t += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.breakT = Math.max(0, this.breakT - dt);
      this.flash = Math.max(0, this.flash - dt * 3);
      // bleed progress on anything not being held
      for (const [k, v] of this.progress) {
        if (k === this.target && this.active) continue;
        const nv = v - dt * 0.5;
        if (nv <= 0 || !k.alive || k.aboard || k.delivered) this.progress.delete(k); else this.progress.set(k, nv);
      }
      if (!p.alive || p.dying > 0) { this.stop(false); this.candidate = null; return; }
      const gp = this.groundPoint();

      // ---- ascend: the lock is complete, the object rides the beam up into the bay
      if (this.state === 'ascend') {
        this.ascendT += dt;
        const t = this.target;
        if (t && t.retrieveLift) t.retrieveLift(Math.min(1, this.ascendT / ASCEND), gp, p);
        if (this.ascendT >= ASCEND) {
          this.state = 'idle'; this.active = false;
          if (t) { this.progress.delete(t); t.onRetrieved(p); }
          this.retrieved++;
          this.flash = 1;
          AS.Audio.stopLoop('retrieve');
          AS.Audio.sfx('retrieve_done');
          AS.FX.retrieveBurst && AS.FX.retrieveBurst(gp.x, gp.y, p.z, t && t.retrieveCol);
          AS.HUD && AS.HUD.used && AS.HUD.used('beam');
          this.target = null; this.cooldown = 0.22;
        }
        this.intensity = U.damp(this.intensity, 1, 8, dt);
        return;
      }

      // ---- acquisition: nearest retrievable under the emitter
      const list = this.candidates(this._list || (this._list = []));
      let best = null, bd = ACQUIRE;
      if (p.speed < 260) {
        for (const c of list) {
          if (!c.canRetrieve(p)) continue;
          const q = c.retrievePos();
          const d = Math.hypot(q.x - gp.x, (q.y - gp.y) * 1.15);
          if (d < bd) { bd = d; best = c; }
        }
      }
      this.candidate = this.active ? this.target : best;
      this.blocked = best && best.retrieveBlocked ? best.retrieveBlocked(p) : null;
      const holding = I.down('interact');

      if (!this.active) {
        this.intensity = U.damp(this.intensity, 0, 6, dt);
        this.extend = Math.max(0, this.extend - dt * 6);
        if (holding && best && this.cooldown <= 0) {
          if (this.blocked) {
            if (I.hit('interact')) { AS.Audio.sfx('denied'); p.warnOnce(best.kind === 'cargo' ? 'cargofull' : 'bayfull', best.kind === 'cargo' ? 'cargo_full' : 'rescue_full', 6); }
          } else this.start(best);
        }
        return;
      }

      // ---- active lock
      const t = this.target;
      if (!holding || !t || !t.canRetrieve(p)) { this.stop(false); return; }
      const q = t.retrievePos();
      const d = Math.hypot(q.x - gp.x, (q.y - gp.y) * 1.15);
      const sp = p.speed;
      if (d > HOLD || sp > 300) { this.stop(true); return; }
      const sDist = d <= 28 ? 1 : 1 - (d - 28) / (HOLD - 28);
      const sSpeed = sp <= 70 ? 1 : 1 - Math.min(1, (sp - 70) / 170) * 0.85;
      const stab = Math.max(0, Math.min(sDist, sSpeed));
      this.stability = U.damp(this.stability, stab, 10, dt);
      this.extend = Math.min(1, this.extend + dt / 0.16);
      if (this.state === 'connect' && this.extend >= 1) this.state = 'lock';
      let k = this.progress.get(t) || 0;
      if (this.state === 'lock') {
        const rate = U.clamp((this.stability - 0.2) / 0.5, 0, 1);
        if (rate > 0) k += dt / (t.retrieveTime || 1.6) * rate;
        else k = Math.max(0, k - dt * 0.25);
      }
      k = Math.min(1, k);
      this.progress.set(t, k);
      t.onBeamProgress && t.onBeamProgress(p, k, this.stability);
      this.intensity = U.damp(this.intensity, 0.35 + k * 0.65, 8, dt);
      // audio: hum rises with the lock, a pulse marks each third
      AS.Audio.loopParam && AS.Audio.loopParam('retrieve', 0.8 + k * 0.9 + (1 - this.stability) * Math.sin(this.t * 40) * 0.08, 0.6 + k * 0.6);
      const mark = Math.floor(k * 3);
      if (mark > this.lastMark && mark < 3) AS.Audio.sfx('retrieve_pulse', { rate: 1 + mark * 0.18 });
      this.lastMark = mark;
      // energy motes climbing the column
      if (Math.random() < 0.3 + k * 0.9) {
        const lift = Math.random();
        AS.Particles.spawn({ x: U.lerp(q.x, gp.x, lift) + U.range(-3, 3), y: U.lerp(q.y, gp.y, lift), z: (q.z || 0) + lift * (p.z - (q.z || 0)), vz: 40 + k * 50, vx: U.range(-4, 4), shape: AS.Particles.GLOW, col: this.stability > 0.5 ? (t.retrieveCol || '#9ff6ff') : '#ffc87a', size: 1.6 + k, size2: 0.4, life: 0.35, add: true });
      }
      if (Math.random() < 3 * dt) AS.Particles.spawn({ x: q.x, y: q.y, z: 0, shape: AS.Particles.RING, col: t.retrieveCol || '#9ff6ff', size: 3, size2: 16, life: 0.6, alpha: 0.6, add: true, layer: 0 });
      AS.Renderer.light(q.x, q.y - 4, 24 + k * 22, t.retrieveCol || '#9ff6ff', 0.3 + k * 0.4);
      AS.Renderer.light(gp.x, gp.y - p.z, 14 + k * 10, '#bff8ff', 0.3 + k * 0.3);
      if (k >= 1) {
        this.state = 'ascend'; this.ascendT = 0;
        t.retrieveLift && t.retrieveLift(0, gp, p);
      }
    }

    start(t) {
      this.target = t; this.active = true; this.state = 'connect'; this.extend = 0; this.stability = 1;
      this.lastMark = Math.floor((this.progress.get(t) || 0) * 3);
      if (!this.progress.has(t)) this.progress.set(t, 0);
      t.onBeamStart && t.onBeamStart(this.p);
      AS.Audio.sfx('retrieve_on');
      AS.Audio.startLoop('retrieve', 'retrieve_loop', 0.7);
    }
    stop(broken) {
      if (!this.active) return;
      const t = this.target;
      this.active = false; this.state = 'idle';
      AS.Audio.stopLoop('retrieve');
      if (t && t.onBeamBreak) t.onBeamBreak(this.p);
      if (broken) {
        this.breakT = 0.9; this.cooldown = 0.35;
        AS.Audio.sfx('retrieve_break');
        if (t) { const q = t.retrievePos(); AS.FX.sparks(q.x, q.y, 6, 6, '#ffc87a'); }
      }
      this.target = null;
    }

    /* ---------- world rendering: the beam column, rings and ground light ---------- */
    drawBeam(ctx, ox, oy, layer) {
      const t = this.target;
      if (!t || (!this.active && this.state !== 'ascend') || this.intensity < 0.02) return;
      const p = this.p, gp = this.groundPoint(), q = t.retrievePos();
      const I = this.intensity, st = this.state === 'ascend' ? 1 : this.stability;
      const col = U.C.mix(U.C.hex(t.retrieveCol || '#9ff6ff'), U.C.hex('#ffb060'), U.clamp(1 - st, 0, 1) * 0.8);
      const css = (a, k) => U.C.str(k ? U.C.shade(col, k) : col, a);
      const flick = st < 0.5 ? 0.6 + Math.random() * 0.4 : 1;
      // screen-space ends of the column (world units, camera-relative)
      const topX = gp.x - ox, topY = gp.y - p.z + 2 - oy;
      const botX = q.x - ox, botY = q.y - oy;
      const ex = this.extend;
      const bx = U.lerp(topX, botX, ex), by = U.lerp(topY, botY, ex);
      ctx.save();
      if (layer === 'under') {
        // tint first (keeps the beam's colour on bright ground), then add light on top
        ctx.globalAlpha = 0.32 * I * flick;
        const tg = ctx.createRadialGradient(botX, botY, 0, botX, botY, 22);
        tg.addColorStop(0, css(0.9, -0.1)); tg.addColorStop(1, css(0, -0.1));
        ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(botX, botY, 22, 14, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        // ground pool of light and scanning rings around the target
        ctx.globalAlpha = 0.4 * I * flick;
        const gr = ctx.createRadialGradient(botX, botY, 0, botX, botY, 26);
        gr.addColorStop(0, css(0.9, 0.3)); gr.addColorStop(0.45, css(0.38)); gr.addColorStop(1, css(0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(botX, botY, 26, 16, 0, 0, TAU); ctx.fill();
        for (let k = 0; k < 3; k++) {
          const ph = (this.t * 1.2 + k / 3) % 1;
          ctx.globalAlpha = (1 - ph) * 0.75 * I; ctx.strokeStyle = css(1, 0.25); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(botX, botY, 5 + ph * 24, (5 + ph * 24) * 0.6, 0, 0, TAU); ctx.stroke();
        }
        // the column: tapered, softly wavering, brighter core
        const wT = 2.6, wB = 7 + 7 * I;
        const N = 9;
        const edge = (side) => {
          const pts = [];
          for (let i = 0; i <= N; i++) {
            const f = i / N;
            const x = U.lerp(topX, bx, f), y = U.lerp(topY, by, f);
            const w = U.lerp(wT, wB, f) * (0.5 + 0.5 * ex);
            const wob = Math.sin(this.t * 13 + f * 9) * (0.35 + (1 - st) * 1.4);
            pts.push([x + side * (w + wob), y]);
          }
          return pts;
        };
        const L = edge(-1), Rr = edge(1).reverse();
        const colPath = () => { ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const pt of L) ctx.lineTo(pt[0], pt[1]); for (const pt of Rr) ctx.lineTo(pt[0], pt[1]); ctx.closePath(); };
        ctx.globalCompositeOperation = 'source-over';
        const cg = ctx.createLinearGradient(0, topY, 0, by);
        cg.addColorStop(0, css(0.55, -0.05)); cg.addColorStop(1, css(0.28, -0.15));
        ctx.globalAlpha = (0.5 + 0.5 * I) * flick; ctx.fillStyle = cg; colPath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, topY, 0, by);
        lg.addColorStop(0, css(0.8, 0.5)); lg.addColorStop(0.5, css(0.4, 0.15)); lg.addColorStop(1, css(0.22));
        ctx.globalAlpha = (0.45 + 0.4 * I) * flick;
        ctx.fillStyle = lg; colPath(); ctx.fill();
        ctx.globalAlpha = (0.35 + 0.6 * I) * flick;
        ctx.strokeStyle = 'rgba(240,255,255,0.9)'; ctx.lineWidth = 0.6 + I * 0.9;
        ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(bx, by); ctx.stroke();
        // rings riding up the column
        if (ex >= 1) for (let k = 0; k < 3; k++) {
          const ph = (this.t * (0.9 + I * 0.9) + k / 3) % 1;
          const x = U.lerp(botX, topX, ph), y = U.lerp(botY, topY, ph);
          const r = U.lerp(wB, wT, ph) * 1.25;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.75 * I; ctx.strokeStyle = css(1, 0.35); ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, TAU); ctx.stroke();
        }
        // underside glow of the emitter
        ctx.globalAlpha = 0.6 * I;
        ctx.drawImage(AS.Forge.glow(U.C.str(col), 32), topX - 9, topY - 7, 18, 14);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        // envelope around the lifted object
        const tz = q.z || 0;
        ctx.globalAlpha = (0.35 + 0.5 * I) * flick;
        ctx.drawImage(AS.Forge.glow(U.C.str(col), 32), botX - 11, botY - tz - 18, 22, 24);
        if (this.flash > 0) { ctx.globalAlpha = this.flash; ctx.drawImage(AS.Forge.glow('#ffffff', 32), topX - 14, topY - 10, 28, 20); }
      }
      ctx.restore();
    }

    /* ---------- HUD: a quiet indicator by the target, lock ring while active ---------- */
    drawHUD(ctx, g, s) {
      const R = AS.Renderer, cam = g.camera, ws = R.worldScale(cam), HUD = AS.HUD;
      const t = this.active || this.state === 'ascend' ? this.target : this.candidate;
      if (!t) {
        if (this.breakT > 0) {
          const c = R.worldToScreen(this.p.x, this.p.py, cam);
          ctx.globalAlpha = Math.min(1, this.breakT * 2); ctx.font = HUD.F(Math.round(10 * s), '700'); ctx.fillStyle = '#ffb060';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('BEAM LOST — HOLD POSITION', c.x, c.y + 30 * ws); ctx.globalAlpha = 1;
        }
        return;
      }
      const q = t.retrievePos();
      const c = R.worldToScreen(q.x, q.y - 5 - (q.z || 0), cam);
      const r = 11 * ws;
      if (!this.active && this.state !== 'ascend') {
        const pulse = 1 + Math.sin(this.t * 6) * 0.08;
        ctx.strokeStyle = this.blocked ? 'rgba(255,195,90,0.9)' : 'rgba(159,246,255,0.9)'; ctx.lineWidth = 1.4 * s;
        ctx.setLineDash([3 * s, 3 * s]); ctx.beginPath(); ctx.arc(c.x, c.y, r * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        const x = c.x + r + 8 * s;
        let w = 0;
        if (!this.blocked) w = HUD.keycap(ctx, x, c.y, 'E', s, '#9ff6ff') + 5 * s;
        ctx.font = HUD.F(Math.round(10 * s), '700'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = this.blocked ? '#ffc35a' : '#e8fbff';
        ctx.fillText(this.blocked || t.retrieveLabel || 'RETRIEVE', x + w, c.y + 0.5 * s);
        return;
      }
      const k = this.state === 'ascend' ? 1 : (this.progress.get(t) || 0);
      const st = this.stability;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = st < 0.45 ? '#ffb060' : '#9ff6ff'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      if (st < 0.45 && this.state !== 'ascend') {
        ctx.font = HUD.F(Math.round(9 * s), '700'); ctx.fillStyle = '#ffb060'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('HOLD STEADY', c.x, c.y - r - 4 * s);
      }
    }
  }
  Retrieval.ACQUIRE = ACQUIRE; Retrieval.HOLD = HOLD;
  AS.Retrieval = Retrieval;
})(window.AS);
