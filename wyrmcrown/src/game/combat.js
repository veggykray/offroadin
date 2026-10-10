/* WYRMCROWN — combat: the wizard's staff, the dragon's breath, ranged weapons
 * of the realm and multi-faction hit resolution.
 * Projectiles use the shared pool (alien-strike/src/game/projectiles.js); this
 * module supplies the projHit / projExpire / projBurst hooks and custom
 * projectile styles, and replaces the engine's area-effect module (AS.Fields)
 * with the realm's: burning ground, frost, entangling roots, necrotic mist and
 * catapult impacts.
 * Direct fire travels in projected screen space like ALIEN STRIKE's, so what you
 * see is what you hit: a bolt at a dragon high above hits the dragon, a bolt
 * at a soldier hits the soldier. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;
  const P = () => AS.Particles;

  /* The four riders' spells. All four are balanced on damage per second, both at full rate
   * (rate × dmg ≈ 44) and when mana runs short (mana cost is 0.4 per point of damage a hit
   * deals, and mana returns at 14 a second: ≈ 35 a second for everyone):
   *   arcane    Aldric's golden spheres   — medium speed, medium rate, medium damage
   *   verdant   Ilythiel's white arrows   — fastest, quickest to fire, lightest blows
   *   frost     Ymra's ice shards         — slow and heavy: the biggest single hit
   *   necrotic  Malkhar's poison orbs     — slowest; a light blow, then poison (Poison.ORB)
   * armorK weighs a target's armour in proportion to the size of the blow, so small rapid
   * hits are not blunted more than big slow ones (the orb's is weighted for its poison too,
   * which seeps past armour). */
  const BOLT = {
    arcane: { kind: 'sphere', col: '#ffcc3a', core: '#fffbe6', glow: '#ffb020', speed: 620, dmg: 11, rate: 4, mana: 4.4, r: 5, armorK: 1 },
    verdant: { kind: 'arrow', col: '#eef8ff', core: '#ffffff', glow: '#bfffe4', speed: 960, dmg: 5.5, rate: 8, mana: 2.2, r: 3, armorK: 0.5 },
    frost: { kind: 'shard', col: '#bfe6ff', core: '#ffffff', glow: '#8fd0ff', speed: 430, dmg: 27.5, rate: 1.6, mana: 11, r: 7, armorK: 2.5, slow: 0.8 },
    necrotic: { kind: 'orb', col: '#b45aff', core: '#f2dcff', glow: '#8a2aff', speed: 340, dmg: 8, rate: 2.5, mana: 7, r: 6, armorK: 1.6, poison: true },
  };

  /* ---------------- poison: a genuine timed damage effect ----------------
   * Rules (one state per target, whoever applied it):
   *  - a poison orb adds a stack: 2.4 damage a second for 4 s (9.6 in all). At most 12 stacks (a
 *    rider at full rate keeps about 10 going);
   *    a hit at the cap refreshes the oldest stack instead of adding one.
   *  - plague breath (and its mist on the ground) sets a breath poison of a fixed strength,
   *    refreshed while the stream touches and lasting 3 s after (no stacking: the stronger wins).
   *  - ticks every 0.25 s; poison seeps past armour; damage is credited to whoever applied it
   *    (kills included); it ends when it runs out, when the target dies or a dragon is driven
   *    off, and its wisps stop with it. */
  const Poison = {
    ORB: { dps: 2.4, dur: 4, max: 12 },
    map: new Map(), g: null, acc: 0,
    st(e) { let s = this.map.get(e); if (!s) { s = { orb: [], orbSrc: null, brT: 0, brDps: 0, brSrc: null }; this.map.set(e, s); } return s; },
    ok(e) { return e && e.alive && !e.removed && !(e.isDragon && e.down > 0) && typeof e.takeDamage === 'function'; },
    orb(g, e, src) {
      if (!this.ok(e)) return;
      const s = this.st(e), O = this.ORB, end = g.time + O.dur;
      if (s.orb.length < O.max) s.orb.push(end);
      else { let k = 0; for (let i = 1; i < s.orb.length; i++) if (s.orb[i] < s.orb[k]) k = i; s.orb[k] = end; }
      s.orbSrc = src;
    },
    breath(g, e, dps, dur, src) {
      if (!this.ok(e) || dps <= 0) return;
      const s = this.st(e);
      if (s.brT < g.time || dps >= s.brDps) { s.brDps = dps; s.brSrc = src; }
      s.brT = Math.max(s.brT, g.time + dur);
    },
    active(e) { const s = this.map.get(e); return !!s && (s.orb.length > 0 || s.brT > (e.g ? e.g.time : 0)); },
    update(g, dt) {
      if (this.g !== g) { this.map.clear(); this.g = g; }
      if (!this.map.size) return;
      this.acc += dt;
      const tick = this.acc >= 0.25, T = this.acc;
      if (tick) this.acc = 0;
      const now = g.time, Pp = P();
      for (const [e, s] of this.map) {
        if (!this.ok(e)) { this.map.delete(e); continue; }
        let n = 0; for (let i = 0; i < s.orb.length; i++) if (s.orb[i] > now) s.orb[n++] = s.orb[i];
        s.orb.length = n;
        const br = s.brT > now ? s.brDps : 0;
        if (!n && !br) { this.map.delete(e); continue; }
        // violet wisps curling up off the poisoned (fewer for weak poison, none once it ends)
        const k = Math.min(1, (n * this.ORB.dps + br) / 16);
        if (Math.random() < (0.12 + 0.4 * k) * Pp.density) {
          const z = (e.z || 0) + (e.hc || 8) * (0.4 + Math.random() * 0.6), rr = (e.r || 8) * 0.6;
          Pp.spawn({ x: e.x + U.range(-rr, rr), y: e.y + U.range(-3, 3), z, vx: U.range(-6, 6), vz: 12 + Math.random() * 12, shape: Pp.SMOKE, col: '#7a3aa8', col2: '#24102e', size: 1.5, size2: 5 + k * 3, life: 0.8, alpha: 0.45 });
          if (Math.random() < 0.35) Pp.spawn({ x: e.x + U.range(-rr, rr), y: e.y, z, vz: 18, shape: Pp.GLOW, col: '#d08aff', size: 1.4, size2: 0.3, life: 0.6, add: true });
        }
        if (!tick) continue;
        if (n) e.takeDamage(n * this.ORB.dps * T, 'poison', s.orbSrc, { silent: true });
        if (br && this.ok(e)) e.takeDamage(br * T, 'poison', s.brSrc, { silent: true });
        if (!this.ok(e)) this.map.delete(e);
      }
    },
  };

  /* ---------------- the four breaths: particles, the stream drawn over them, and what a touch looks like ----------------
   * fire      Pyrrhax: a roaring furnace — white-hot core, rolling orange flame, dark red edges,
   *           licking tongues, embers and rising smoke
   * verdant   Verdanthe: a long, elegant emerald stream — a bright core ribbon wound with two
   *           twisting tongues, pale wisps, no heavy cloud
   * frost     Skaldfrost: a glacier exhaling — a dense blue-white vapour cloud, needle streaks,
   *           glittering shards, mist rolling along the ground
   * necrotic  Vorthrax: death breathing — dark violet flame, bright violet highlights, spectral
   *           smoke and curling tendrils, a few sickly motes
   * All particles come from the shared pool (alien-strike/src/gfx/particles.js) and are scaled
   * by the particle density setting; the stream overlays are a handful of paths per dragon. */
  const vzOf = (bi, life) => ((bi.tz || 0) - bi.mz) / (life * 1.3) * (0.6 + Math.random() * 0.5);
  const BreathFX = {
    fire: {
      emit(d, bi, B, Pp, rate, ca, sa) {
        const n = Math.round((d.isPlayer ? 9 : 6) * rate), s = d.scale;
        for (let i = 0; i < n; i++) {
          const spr = (Math.random() - 0.5) * bi.half * 1.6, sp = (300 + Math.random() * 180) * bi.range;
          const a = bi.a + spr, life = 0.28 + Math.random() * 0.22, vz = vzOf(bi, life);
          const vx = Math.cos(a) * sp + d.vx * 0.7, vy = Math.sin(a) * sp + d.vy * 0.7;
          Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx, vy, vz, shape: Pp.SMOKE, col: B.cols[1], col2: B.cols[3], size: 2.5 * s, size2: (11 + Math.random() * 8) * s, life, alpha: 0.95, drag: 1.6, keep: d.isPlayer });
          if (Math.random() < 0.6) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 1.05, vy: vy * 1.05, vz: vz * 0.9, shape: Pp.GLOW, col: B.cols[0], col2: B.cols[2], size: 4 * s, size2: 14 * s, life: life * 0.8, add: true, drag: 1.4 });
          // dark red edges of the flame
          if (Math.random() < 0.3) { const a2 = bi.a + spr * 1.35; Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: Math.cos(a2) * sp * 0.9 + d.vx * 0.7, vy: Math.sin(a2) * sp * 0.9 + d.vy * 0.7, vz, shape: Pp.SMOKE, col: '#d8400e', col2: '#2a0804', size: 3 * s, size2: 13 * s, life: life * 1.1, alpha: 0.6, drag: 1.7 }); }
          // licking tongues: flares stretched along the stream
          if (Math.random() < 0.3) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 0.95, vy: vy * 0.95, vz, shape: Pp.FLARE, rot: a + (Math.random() - 0.5) * 0.3, col: B.cols[1], size: 6 * s, size2: 20 * s, asp: 0.28, life: 0.16 + Math.random() * 0.08, add: true, drag: 1.5 });
        }
        if (Math.random() < 0.5) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: ca * 420 + d.vx, vy: sa * 420 + d.vy, vz: -60, grav: 240, shape: Pp.STREAK, col: '#ffffff', col2: B.cols[2], size: 1, life: 0.4, add: true, len: 0.03 });
        // embers whirling off the stream, smoke rolling up behind it, sparks where it meets the ground
        if (Math.random() < 0.7 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 2, t = 0.3 + Math.random() * 0.6; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: Math.max(4, bi.mz * (1 - t)) + 6, vx: Math.cos(a2) * 60 + U.range(-30, 30), vy: Math.sin(a2) * 60 + U.range(-30, 30), vz: 30 + Math.random() * 50, shape: Pp.CIRCLE, col: B.cols[0], col2: B.cols[2], size: 1.3, size2: 0.3, life: 0.6 + Math.random() * 0.5, add: true, drag: 1 }); }
        if (Math.random() < 0.3 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 1.6, t = 0.55 + Math.random() * 0.4; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: 10, vx: Math.cos(a2) * 20, vy: Math.sin(a2) * 20, vz: 22 + Math.random() * 14, shape: Pp.SMOKE, col: '#4a3a34', col2: '#1a1412', size: 3, size2: 12 + Math.random() * 8, life: 1.2 + Math.random() * 0.8, alpha: 0.5, drag: 0.8 }); }
        groundSparks(bi, Pp, rate, '#ffffff', B.cols[1]);
      },
      touch(e, B, Pp) {
        const z = (e.z || 0) + (e.hc || 8) * 0.6;
        Pp.spawn({ x: e.x, y: e.y, z, shape: Pp.GLOW, col: '#ffe8a0', col2: '#ff5010', size: 5, size2: 16, life: 0.22, add: true });
        Pp.spawn({ x: e.x + U.range(-4, 4), y: e.y, z, vz: 26, shape: Pp.SMOKE, col: '#ffc040', col2: '#8a1a06', size: 3, size2: 10, life: 0.35, alpha: 0.9, drag: 2 });
        for (let k = 0; k < 3; k++) { const q = Math.random() * TAU; Pp.spawn({ x: e.x, y: e.y, z, vx: Math.cos(q) * 50, vy: Math.sin(q) * 40, vz: 40 + Math.random() * 50, grav: 120, shape: Pp.CIRCLE, col: '#fff0b0', col2: '#ff4a10', size: 1.3, size2: 0.3, life: 0.5, add: true }); }
      },
      draw(ctx, G, B, bi) {
        // two flickering lobes (a wide soft plume and a hot narrow core), then billows rolling out
        lobes(ctx, G, [[0.3, B.cols[0], 0.35, B.cols[1], 0.28, B.cols[2], 0.45], [0.12, '#ffffff', 0.85, B.cols[0], 0.45, B.cols[1], 0.55]]);
        const W1 = G.L * 0.3;
        for (let i = 0; i < 9; i++) {
          const f = (i / 9 + G.t * 2.4) % 1, wob = Math.sin(G.t * 13 + i * 2.1) * W1 * 0.4 * f;
          const px = G.mx + (G.ex - G.mx) * f + G.nx * wob, py = G.my + (G.ey - G.my) * f + G.ny * wob;
          const r = (G.w0 + (W1 * 1.15 - G.w0) * f) * (0.75 + 0.3 * Math.sin(G.t * 17 + i));
          ctx.globalAlpha = 0.42 * (1 - f * 0.75);
          ctx.drawImage(AS.Forge.glow(f < 0.3 ? B.cols[0] : B.cols[1], 64), px - r, py - r, r * 2, r * 2);
        }
      },
    },
    verdant: {
      emit(d, bi, B, Pp, rate) {
        const n = Math.round((d.isPlayer ? 8 : 5) * rate), s = d.scale;
        for (let i = 0; i < n; i++) {
          const spr = (Math.random() - 0.5) * bi.half * 1.3, sp = (380 + Math.random() * 160) * bi.range;
          const a = bi.a + spr, life = 0.3 + Math.random() * 0.18, vz = vzOf(bi, life);
          const vx = Math.cos(a) * sp + d.vx * 0.7, vy = Math.sin(a) * sp + d.vy * 0.7;
          Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx, vy, vz, shape: Pp.GLOW, col: B.cols[0], col2: B.cols[2], size: 2.5 * s, size2: 9 * s, life, add: true, drag: 1.1, keep: d.isPlayer });
          if (Math.random() < 0.5) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 0.97, vy: vy * 0.97, vz, shape: Pp.SMOKE, col: '#7affb4', col2: '#06582e', size: 2 * s, size2: (7 + Math.random() * 4) * s, life: life * 1.05, alpha: 0.42, drag: 1.2 });
          if (Math.random() < 0.35) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 1.1, vy: vy * 1.1, vz, shape: Pp.STREAK, col: '#e6fff0', col2: '#30d880', size: 1, life: life * 0.8, add: true, len: 0.06, drag: 0.8 });
        }
        // pale motes drifting up off the stream
        if (Math.random() < 0.5 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 1.6, t = 0.2 + Math.random() * 0.75; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: Math.max(4, bi.mz * (1 - t)) + 4, vx: U.range(-12, 12), vy: U.range(-12, 12), vz: 18 + Math.random() * 20, shape: Pp.CIRCLE, col: '#e8fff0', col2: '#20c070', size: 1.1, size2: 0.3, life: 0.7 + Math.random() * 0.4, add: true, drag: 1 }); }
        groundSparks(bi, Pp, rate * 0.6, '#f0fff4', B.cols[1]);
      },
      touch(e, B, Pp) {
        const z = (e.z || 0) + (e.hc || 8) * 0.6;
        Pp.spawn({ x: e.x, y: e.y, z, shape: Pp.GLOW, col: '#eafff0', col2: '#12c060', size: 4, size2: 13, life: 0.2, add: true });
        for (let k = 0; k < 3; k++) Pp.spawn({ x: e.x + U.range(-5, 5), y: e.y, z, vx: U.range(-14, 14), vz: 40 + Math.random() * 30, shape: Pp.STREAK, col: '#e6fff0', col2: '#20c070', size: 1, life: 0.35, add: true, len: 0.08, drag: 1.5 });
        Pp.spawn({ x: e.x, y: e.y, z, vz: 10, shape: Pp.CIRCLE, col: '#9affc8', col2: '#0a7a3a', size: 1.4, size2: 0.3, life: 0.5, add: true });
      },
      draw(ctx, G, B) {
        // the core ribbon: a long bright line, wound with two twisting flame tongues
        const N = 18, amp0 = 2, amp1 = G.L * 0.075, t = G.t;
        const pt = (f, off) => [G.mx + (G.ex - G.mx) * f + G.nx * off, G.my + (G.ey - G.my) * f + G.ny * off];
        const sway = (f) => Math.sin(f * 5 - t * 6) * G.L * 0.012 * f;
        for (const [lw, col, al] of [[G.L * 0.1, B.cols[2], 0.22], [G.L * 0.045, B.cols[1], 0.5], [2.2, B.cols[0], 0.9]]) {
          const grd = ctx.createLinearGradient(G.mx, G.my, G.ex, G.ey);
          grd.addColorStop(0, C.str(col, 1)); grd.addColorStop(0.75, C.str(col, 0.6)); grd.addColorStop(1, C.str(col, 0));
          ctx.globalAlpha = al; ctx.strokeStyle = grd; ctx.lineWidth = Math.max(1, lw * (0.9 + 0.1 * Math.sin(t * 21))); ctx.lineCap = 'round';
          ctx.beginPath(); for (let i = 0; i <= N; i++) { const f = i / N, p = pt(f, sway(f)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
        }
        for (let k = 0; k < 2; k++) {
          const grd = ctx.createLinearGradient(G.mx, G.my, G.ex, G.ey);
          grd.addColorStop(0, C.str(B.cols[0], 0.9)); grd.addColorStop(0.5, C.str(B.cols[1], 0.7)); grd.addColorStop(1, C.str(B.cols[2], 0));
          ctx.globalAlpha = 0.75; ctx.strokeStyle = grd; ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i <= N * 2; i++) { const f = i / (N * 2), off = sway(f) + Math.sin(f * TAU * 2.4 - t * 15 + k * Math.PI) * (amp0 + amp1 * f), p = pt(f, off); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        const r = 6 + G.L * 0.05; ctx.globalAlpha = 0.5; ctx.drawImage(AS.Forge.glow(B.cols[1], 64), G.ex - r, G.ey - r, r * 2, r * 2);
      },
    },
    frost: {
      emit(d, bi, B, Pp, rate) {
        const n = Math.round((d.isPlayer ? 10 : 6) * rate), s = d.scale;
        for (let i = 0; i < n; i++) {
          const spr = (Math.random() - 0.5) * bi.half * 1.7, sp = (240 + Math.random() * 150) * bi.range * 1.25;
          const a = bi.a + spr, life = 0.42 + Math.random() * 0.28, vz = vzOf(bi, life);
          const vx = Math.cos(a) * sp + d.vx * 0.6, vy = Math.sin(a) * sp + d.vy * 0.6;
          // the freezing cloud itself: pale vapour, not glowing flame
          Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx, vy, vz, shape: Pp.SMOKE, col: '#e8f4ff', col2: '#4f82b8', size: 3 * s, size2: (13 + Math.random() * 11) * s, life, alpha: 0.72, drag: 2, keep: d.isPlayer });
          // needles of ice shot through it
          if (Math.random() < 0.45) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 1.5, vy: vy * 1.5, vz: vz * 1.2, shape: Pp.STREAK, col: '#ffffff', col2: '#8fd4ff', size: 1, life: life * 0.5, add: true, len: 0.022, drag: 0.6 });
          if (Math.random() < 0.22) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 1.1, vy: vy * 1.1, vz, shape: Pp.SHARD, col: Math.random() < 0.5 ? '#ffffff' : '#cfeeff', size: 1.6 + Math.random() * 1.6, life: life * 0.9, drag: 1.3, vr: U.range(-16, 16) });
          if (i < 2) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 0.6, vy: vy * 0.6, vz, shape: Pp.GLOW, col: '#ffffff', col2: '#8ccfff', size: 3 * s, size2: 9 * s, life: 0.15, add: true });
        }
        // mist rolling along the ground where it lands, and frozen glitter hanging in the air
        if ((bi.tz || 0) < 30 && bi.mz < 90 && Math.random() < 0.45 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 2, t = 0.7 + Math.random() * 0.35; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: 1, vx: Math.cos(a2 + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)) * 26, vy: Math.sin(a2) * 18, vz: 3, shape: Pp.SMOKE, col: '#f4faff', col2: '#b4cce4', size: 6, size2: 20 + Math.random() * 8, life: 1.2 + Math.random() * 0.5, alpha: 0.4, drag: 1, layer: 0 }); }
        if (Math.random() < 0.5 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 1.8, t = 0.2 + Math.random() * 0.8; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: Math.max(3, bi.mz * (1 - t)) + 6, vz: 6, shape: Pp.GLOW, col: '#ffffff', size: 1.8, size2: 0.2, life: 0.4 + Math.random() * 0.4, add: true }); }
      },
      touch(e, B, Pp) {
        const z = (e.z || 0) + (e.hc || 8) * 0.6;
        Pp.spawn({ x: e.x, y: e.y, z, vz: 8, shape: Pp.SMOKE, col: '#ffffff', col2: '#a8c8e8', size: 4, size2: 13, life: 0.6, alpha: 0.6, drag: 2 });
        Pp.spawn({ x: e.x, y: e.y, z, shape: Pp.GLOW, col: '#e8f8ff', col2: '#8ccfff', size: 4, size2: 12, life: 0.18, add: true });
        for (let k = 0; k < 4; k++) { const q = Math.random() * TAU, sp = 40 + Math.random() * 60; Pp.spawn({ x: e.x, y: e.y, z, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp * 0.7, vz: 30 + Math.random() * 60, grav: 260, bounce: 0.3, shape: Pp.SHARD, col: k % 2 ? '#ffffff' : '#bfe6ff', size: 1.6 + Math.random() * 1.6, life: 0.7, vr: U.range(-18, 18) }); }
      },
      draw(ctx, G, B) {
        // a billowing blue-white cloud of freezing air (drawn normally, not added as light: it
        // whitens and hides a little, like real vapour), then sharp crystalline streaks
        ctx.globalCompositeOperation = 'source-over';
        const W = G.L * 0.36, haze = AS.Forge.glow('#7aaee0', 64), core = AS.Forge.glow('#e8f6ff', 64);
        for (let i = 0; i < 9; i++) {
          const f = (i / 9 + G.t * 1.6) % 1, wob = Math.sin(G.t * 7 + i * 2.3) * W * 0.35 * f;
          const px = G.mx + (G.ex - G.mx) * f + G.nx * wob, py = G.my + (G.ey - G.my) * f + G.ny * wob, r = G.w0 + W * 1.25 * Math.pow(f, 0.8) * (0.85 + 0.2 * Math.sin(i * 1.7 + G.t * 3));
          ctx.globalAlpha = 0.7 * (1 - f * 0.6); ctx.drawImage(f < 0.3 ? core : haze, px - r, py - r * 0.85, r * 2, r * 1.7);
        }
        ctx.globalCompositeOperation = 'lighter';
        const rng = new U.RNG(Math.floor(G.t * 12) * 131 + 7);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        // jagged crystal flecks: short broken lines, re-cut a dozen times a second
        const ux = (G.ex - G.mx) / G.len, uy = (G.ey - G.my) / G.len;
        for (let i = 0; i < 6; i++) {
          const side = (rng.next() - 0.5) * 1.5, f = 0.15 + rng.next() * 0.8, seg = G.L * (0.035 + rng.next() * 0.04);
          let x = G.mx + (G.ex - G.mx) * f + G.nx * W * side * f, y = G.my + (G.ey - G.my) * f + G.ny * W * side * f;
          ctx.globalAlpha = 0.45 + rng.next() * 0.4; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < 3; k++) { const j = (rng.next() - 0.5) * 1.1; x += (ux * Math.cos(j) - uy * Math.sin(j)) * seg; y += (uy * Math.cos(j) + ux * Math.sin(j)) * seg; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        const r = 8 + G.L * 0.05; ctx.globalAlpha = 0.35; ctx.drawImage(AS.Forge.glow('#cfeeff', 64), G.mx - r, G.my - r, r * 2, r * 2);
      },
    },
    necrotic: {
      emit(d, bi, B, Pp, rate) {
        const n = Math.round((d.isPlayer ? 8 : 5) * rate), s = d.scale;
        for (let i = 0; i < n; i++) {
          const spr = (Math.random() - 0.5) * bi.half * 1.6, sp = (280 + Math.random() * 170) * bi.range;
          const a = bi.a + spr, life = 0.32 + Math.random() * 0.24, vz = vzOf(bi, life);
          const vx = Math.cos(a) * sp + d.vx * 0.7, vy = Math.sin(a) * sp + d.vy * 0.7;
          // dark violet flame (drawn normally: it darkens what it covers, unlike Pyrrhax's light)
          Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx, vy, vz, shape: Pp.SMOKE, col: '#6a22a6', col2: '#14061e', size: 2.5 * s, size2: (10 + Math.random() * 7) * s, life, alpha: 0.82, drag: 1.6, keep: d.isPlayer });
          if (Math.random() < 0.45) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 1.04, vy: vy * 1.04, vz, shape: Pp.GLOW, col: '#dca0ff', col2: '#5a1490', size: 3 * s, size2: 10 * s, life: life * 0.8, add: true, drag: 1.4 });
          if (Math.random() < 0.28) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 0.95, vy: vy * 0.95, vz, shape: Pp.FLARE, rot: a + (Math.random() - 0.5) * 0.4, col: '#a24ae8', size: 5 * s, size2: 15 * s, asp: 0.24, life: 0.14 + Math.random() * 0.06, add: true, drag: 1.5 });
          // spectral smoke lagging and rising off the stream
          if (Math.random() < 0.22) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: vx * 0.55, vy: vy * 0.55, vz: vz * 0.5 + 18, shape: Pp.SMOKE, col: '#c4aee0', col2: '#2a1a3a', size: 3 * s, size2: 16 * s, life: life * 2.2, alpha: 0.3, drag: 1.1 });
        }
        // sickly luminous motes
        if (Math.random() < 0.45 * rate) { const a2 = bi.a + (Math.random() - 0.5) * bi.half * 1.8, t = 0.2 + Math.random() * 0.8, sick = Math.random() < 0.18; Pp.spawn({ x: bi.mx + Math.cos(a2) * bi.L * t, y: bi.my + Math.sin(a2) * bi.L * t, z: Math.max(4, bi.mz * (1 - t)) + 6, vx: U.range(-10, 10), vy: U.range(-10, 10), vz: 14 + Math.random() * 16, shape: Pp.CIRCLE, col: sick ? '#dcff9a' : '#f0d8ff', col2: sick ? '#5a7a1a' : '#6a1aa0', size: 1.1, size2: 0.3, life: 0.8 + Math.random() * 0.4, add: true, drag: 1 }); }
        groundSparks(bi, Pp, rate * 0.5, '#f0d8ff', '#a24ae8');
      },
      touch(e, B, Pp) {
        const z = (e.z || 0) + (e.hc || 8) * 0.6;
        Pp.spawn({ x: e.x, y: e.y, z, shape: Pp.GLOW, col: '#e0b0ff', col2: '#5a1490', size: 4, size2: 14, life: 0.25, add: true });
        for (let k = 0; k < 2; k++) { const q = Math.random() * TAU; Pp.spawn({ x: e.x, y: e.y, z, vx: Math.cos(q) * 22, vy: Math.sin(q) * 16, vz: 14, shape: Pp.SMOKE, col: '#5a1a8a', col2: '#12041a', size: 2, size2: 9, life: 0.8, alpha: 0.55, drag: 1.5 }); }
      },
      draw(ctx, G, B) {
        // a dark veil under a narrow violet core, and tendrils curling off the stream
        ctx.globalCompositeOperation = 'source-over';
        lobes(ctx, G, [[0.28, '#3a0e5a', 0.35, '#24083a', 0.28, '#14061e', 0.45]]);
        ctx.globalCompositeOperation = 'lighter';
        lobes(ctx, G, [[0.11, '#f0d0ff', 0.7, '#c46aff', 0.42, '#6a1aa0', 0.5]]);
        const W = G.L * 0.24, dx = (G.ex - G.mx) / G.len, dy = (G.ey - G.my) / G.len;
        ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const f = (i / 6 + G.t * 0.55) % 1, side = i % 2 ? 1 : -1, x0 = G.mx + (G.ex - G.mx) * f, y0 = G.my + (G.ey - G.my) * f, w = W * (0.3 + f);
          const curl = Math.sin(G.t * 4 + i) * 0.3;
          ctx.globalAlpha = 0.55 * (1 - f) * Math.min(1, f * 6);
          ctx.strokeStyle = i % 3 ? '#c27aff' : '#e8c8ff';
          ctx.beginPath(); ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(x0 + dx * w * 0.7 + G.nx * side * w * 0.2, y0 + dy * w * 0.7 + G.ny * side * w * 0.2,
            x0 + G.nx * side * w * (1.1 + curl) + dx * w * 0.5, y0 + G.ny * side * w * (1.1 + curl) + dy * w * 0.5,
            x0 + G.nx * side * w * 0.7 - dx * w * 0.1, y0 + G.ny * side * w * 0.7 - dy * w * 0.1);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      },
    },
  };
  // a flame-shaped plume from the jaws: its edges ripple and flicker (no straight-sided cone);
  // spec: [width k, col0, a0, col1, a1, col2, alpha]
  function lobes(ctx, G, specs) {
    const N = 12, dx = G.ex - G.mx, dy = G.ey - G.my, t = G.t;
    for (const [wk, c0, a0, c1, a1, c2, al] of specs) {
      const w1 = G.L * wk;
      const grd = ctx.createLinearGradient(G.mx, G.my, G.ex, G.ey);
      grd.addColorStop(0, C.str(c0, a0)); grd.addColorStop(0.3, C.str(c1, a1)); grd.addColorStop(0.7, C.str(c2, a1 * 0.5)); grd.addColorStop(1, C.str(c2, 0));
      ctx.globalAlpha = al; ctx.fillStyle = grd; ctx.beginPath();
      for (let side = 1; side >= -1; side -= 2) for (let i = 0; i <= N; i++) {
        const f = side > 0 ? i / N : 1 - i / N;
        const w = G.w0 + (w1 - G.w0) * Math.pow(f, 0.7) * (0.78 + 0.22 * Math.sin(f * 11 - t * 24 + wk * 30 + side * 1.7)) * (f > 0.85 ? 1 - (f - 0.85) * 2.5 : 1);
        const bend = Math.sin(f * 3.2 + t * 9 + wk * 10) * w1 * 0.22 * f;
        const x = G.mx + dx * f + G.nx * (bend + side * w), y = G.my + dy * f + G.ny * (bend + side * w);
        (side > 0 && i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  function groundSparks(bi, Pp, rate, c0, c1) {
    if ((bi.tz || 0) < 30 && bi.mz < 80 && Math.random() < 0.5 * rate) {
      const a2 = bi.a + (Math.random() - 0.5) * bi.half * 1.4, t = 0.8 + Math.random() * 0.25, gx = bi.mx + Math.cos(a2) * bi.L * t, gy = bi.my + Math.sin(a2) * bi.L * t;
      for (let k = 0; k < 2; k++) { const q = Math.random() * TAU, sp = 40 + Math.random() * 90; Pp.spawn({ x: gx, y: gy, z: 2, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: 40 + Math.random() * 90, grav: 260, shape: Pp.STREAK, col: c0, col2: c1, size: 1, life: 0.3 + Math.random() * 0.3, add: true, len: 0.025 }); }
    }
  }

  /* ---------------- the four spells: body, trail, impact, cast flash ---------------- */
  // a lit golden sphere, drawn once
  let sphereImg = null;
  function sphereSprite() {
    if (sphereImg) return sphereImg;
    const S = 48, cv = AS.Forge.canvas(S, S), c = cv.getContext('2d');
    const gr = c.createRadialGradient(S * 0.4, S * 0.38, 1, S / 2, S / 2, S / 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#fff4b8'); gr.addColorStop(0.58, '#ffc82a'); gr.addColorStop(0.86, '#c47a0e'); gr.addColorStop(1, 'rgba(150,80,10,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, TAU); c.fill();
    return (sphereImg = cv);
  }
  const H = 30; // spawn height for effects at a projectile's (screen-space) point
  const BoltFX = {
    sphere: {
      draw(ctx, p, sx, sy, bk) {
        const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), R = 5.2 + Math.sin(p.age * 25) * 0.35;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = bk.glow; ctx.lineCap = 'round';
        ctx.lineWidth = R * 1.5; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * 22, sy - sa * 22); ctx.stroke();
        ctx.lineWidth = R; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * 11, sy - sa * 11); ctx.stroke(); ctx.lineCap = 'butt';
        ctx.globalAlpha = 0.85; const cw = R * 3.4; ctx.drawImage(AS.Forge.glow(bk.glow, 64), sx - cw, sy - cw, cw * 2, cw * 2);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(sphereSprite(), sx - R, sy - R, R * 2, R * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(AS.Forge.glow('#ffffff', 32), sx - R * 0.9, sy - R * 0.9, R * 1.8, R * 1.8);
        // a slow-turning four-point glint
        const q = p.age * 3, L = R * 2.3; ctx.strokeStyle = '#fffbe6'; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(sx - Math.cos(q) * L, sy - Math.sin(q) * L); ctx.lineTo(sx + Math.cos(q) * L, sy + Math.sin(q) * L);
        ctx.moveTo(sx - Math.cos(q + 1.57) * L * 0.6, sy - Math.sin(q + 1.57) * L * 0.6); ctx.lineTo(sx + Math.cos(q + 1.57) * L * 0.6, sy + Math.sin(q + 1.57) * L * 0.6); ctx.stroke();
        AS.Renderer.light(p.x, p.y, 30, bk.glow, 0.4);
      },
      trail(p, bk, Pp) {
        p.trailT = 0.03;
        Pp.spawn({ x: p.x + U.range(-2, 2), y: p.y + H + U.range(-2, 2), z: H, vx: U.range(-10, 10), vy: U.range(-10, 10), shape: Pp.GLOW, col: '#ffe680', col2: bk.glow, size: 2.4, size2: 0.4, life: 0.28, add: true });
        if (Math.random() < 0.3) { const q = Math.random() * TAU; Pp.spawn({ x: p.x, y: p.y + H, z: H, vx: Math.cos(q) * 50, vy: Math.sin(q) * 50, shape: Pp.STREAK, col: '#ffffff', col2: bk.col, size: 1, life: 0.2, add: true, len: 0.03 }); }
      },
      impact(x, y, a, bk, Pp, k) {
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: '#ffffff', size: 4 * k, size2: 14 * k, life: 0.1, add: true });
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: bk.col, col2: bk.glow, size: 6 * k, size2: 22 * k, life: 0.28, add: true });
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.RING, col: '#ffe680', size: 3 * k, size2: 20 * k, life: 0.3, add: true });
        for (let i = 0; i < 8; i++) { const q = Math.random() * TAU, sp = (60 + Math.random() * 90) * k; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: Math.random() * 40, shape: Pp.CIRCLE, col: '#fff3b0', col2: '#ff9a10', size: 1.5, size2: 0.3, life: 0.3 + Math.random() * 0.2, add: true, drag: 4 }); }
        for (let i = 0; i < 3; i++) { const q = a + U.range(-1, 1), sp = 90 + Math.random() * 90; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: 30 + Math.random() * 40, grav: 220, shape: Pp.STREAK, col: '#ffffff', col2: bk.col, size: 1, life: 0.25, add: true, len: 0.025 }); }
      },
    },
    arrow: {
      draw(ctx, p, sx, sy, bk) {
        const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, L = 28;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        // a streak of concentrated light: soft outer shaft, bright inner line
        for (let k = 0; k < 3; k++) { // (fading in three steps toward the tail)
          const f0 = k / 3, f1 = (k + 1) / 3, x0 = sx - ca * L * f0, y0 = sy - sa * L * f0, x1 = sx - ca * L * f1, y1 = sy - sa * L * f1;
          ctx.strokeStyle = bk.glow; ctx.lineWidth = 5; ctx.globalAlpha = 0.3 * (1 - f0); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - f0 * 0.9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        // spectral fletching
        const fx = sx - ca * L * 0.62, fy = sy - sa * L * 0.62; ctx.strokeStyle = bk.glow; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.6;
        ctx.beginPath(); for (const sd of [1, -1]) { ctx.moveTo(fx, fy); ctx.lineTo(fx - ca * 5 + nx * 3 * sd, fy - sa * 5 + ny * 3 * sd); } ctx.stroke();
        ctx.lineCap = 'butt';
        // the arrowhead: a silver-white blade with a hot point
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(190,230,255,0.9)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(sx + ca * 5, sy + sa * 5); ctx.lineTo(sx - ca * 3.5 + nx * 3.2, sy - sa * 3.5 + ny * 3.2); ctx.lineTo(sx - ca * 1.5, sy - sa * 1.5); ctx.lineTo(sx - ca * 3.5 - nx * 3.2, sy - sa * 3.5 - ny * 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(AS.Forge.glow('#ffffff', 32), sx - 5, sy - 5, 10, 10);
        AS.Renderer.light(p.x, p.y, 20, bk.glow, 0.3);
      },
      trail(p, bk, Pp) {
        p.trailT = 0.025;
        Pp.spawn({ x: p.x, y: p.y + H, z: H, vx: p.vx * 0.12, vy: p.vy * 0.12, shape: Pp.STREAK, col: '#ffffff', col2: bk.glow, size: 1, life: 0.16, add: true, len: 0.12 });
        if (Math.random() < 0.3) Pp.spawn({ x: p.x + U.range(-2, 2), y: p.y + H + U.range(-2, 2), z: H, shape: Pp.GLOW, col: bk.glow, size: 1.6, size2: 0.2, life: 0.25, add: true });
      },
      impact(x, y, a, bk, Pp, k) {
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: '#ffffff', size: 3 * k, size2: 9 * k, life: 0.08, add: true });
        for (let i = 0; i < 4; i++) Pp.spawn({ x, y: y + H, z: H, shape: Pp.FLARE, rot: a + i * Math.PI / 2, col: '#ffffff', size: 10 * k, size2: 3 * k, asp: 0.12, life: 0.1, add: true });
        for (let i = 0; i < 5; i++) { const q = a + U.range(-0.7, 0.7), sp = 120 + Math.random() * 90; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: 10 + Math.random() * 30, shape: Pp.STREAK, col: '#ffffff', col2: bk.glow, size: 1, life: 0.15, add: true, len: 0.03 }); }
      },
    },
    shard: {
      draw(ctx, p, sx, sy, bk) {
        const a = Math.atan2(p.vy, p.vx), spin = p.age * 12 + ((p.extra && p.extra.seed) || 0), c = Math.cos(spin), w = 0.35 + 0.65 * Math.abs(c), up = c > 0;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
        ctx.drawImage(AS.Forge.glow(bk.glow, 64), sx - 20, sy - 20, 40, 40);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(a + Math.sin(p.age * 3) * 0.12); ctx.scale(1.55, 1.55);
        const tip = [12, 0], us = [3, -4.8 * w], ur = [-7, -3.2 * w], tail = [-11, 0], lr = [-7, 3.2 * w], ls = [3, 4.8 * w];
        const face = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); };
        face([tip, us, ur, tail], up ? '#eef9ff' : '#7fb8e4');
        face([tip, ls, lr, tail], up ? '#5d9ad0' : '#d4eeff');
        face([tip, us, [1, 0]], up ? '#ffffff' : '#a8d4f4');
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); [tip, us, ur, tail, lr, ls].forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.restore();
        AS.Renderer.light(p.x, p.y, 26, bk.glow, 0.3);
      },
      trail(p, bk, Pp) {
        p.trailT = 0.035;
        Pp.spawn({ x: p.x + U.range(-3, 3), y: p.y + H + U.range(-3, 3), z: H, shape: Pp.GLOW, col: '#ffffff', size: 1.8, size2: 0.2, life: 0.3, add: true });
        if (Math.random() < 0.45) Pp.spawn({ x: p.x, y: p.y + H, z: H, vx: U.range(-8, 8), vy: U.range(-8, 8), shape: Pp.SMOKE, col: '#f2faff', col2: '#a8c8e0', size: 1.5, size2: 5.5, life: 0.5, alpha: 0.35 });
        if (Math.random() < 0.12) Pp.spawn({ x: p.x, y: p.y + H, z: H, vx: U.range(-20, 20), vy: U.range(-20, 20), vz: 10, grav: 160, shape: Pp.SHARD, col: '#e8f8ff', size: 1.4, life: 0.45, vr: U.range(-14, 14) });
      },
      impact(x, y, a, bk, Pp, k) {
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: '#e8f8ff', col2: bk.glow, size: 5 * k, size2: 18 * k, life: 0.18, add: true });
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.RING, col: '#cfefff', size: 4 * k, size2: 22 * k, life: 0.35, add: true });
        Pp.spawn({ x, y: y + H, z: H, vz: 6, shape: Pp.SMOKE, col: '#ffffff', col2: '#b4d0ec', size: 4 * k, size2: 15 * k, life: 0.7, alpha: 0.55, drag: 2 });
        const n = Math.round(12 * k);
        for (let i = 0; i < n; i++) { const q = Math.random() * TAU, sp = (60 + Math.random() * 110) * k; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp + Math.cos(a) * 40, vy: Math.sin(q) * sp * 0.75 + Math.sin(a) * 40, vz: 40 + Math.random() * 90, grav: 300, bounce: 0.3, shape: Pp.SHARD, col: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#cfeeff' : '#8ccfff', size: 2 + Math.random() * 2.5 * k, life: 0.8 + Math.random() * 0.4, vr: U.range(-20, 20) }); }
        for (let i = 0; i < 5; i++) { const q = Math.random() * TAU, sp = 80 + Math.random() * 80; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: 20 + Math.random() * 40, grav: 200, shape: Pp.STREAK, col: '#ffffff', col2: bk.glow, size: 1, life: 0.2, add: true, len: 0.025 }); }
      },
    },
    orb: {
      draw(ctx, p, sx, sy, bk) {
        const a = Math.atan2(p.vy, p.vx), seed = (p.extra && p.extra.seed) || 0, t = p.age;
        // an uneasy, sidelong drift (drawn only: it strikes where it truly is)
        const off = Math.sin(t * 8 + seed) * 2.2, x = sx - Math.sin(a) * off, y = sy + Math.cos(a) * off;
        const R = 6.4;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5;
        ctx.drawImage(AS.Forge.glow('#2a0a40', 64), x - R * 2.6, y - R * 2.6, R * 5.2, R * 5.2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2c0844'; ctx.strokeStyle = '#16041f'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const q = i / 14 * TAU, r = R * (1 + 0.13 * Math.sin(3 * q + t * 6 + seed) + 0.08 * Math.sin(5 * q - t * 9)); const px = x + Math.cos(q) * r, py = y + Math.sin(q) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.9; ctx.drawImage(AS.Forge.glow('#9a3ae0', 64), x - R * 1.05, y - R * 1.1, R * 2.1, R * 2.1);
        const cw = R * (1.0 + 0.3 * Math.sin(t * 12 + seed)); ctx.globalAlpha = 0.85;
        ctx.drawImage(AS.Forge.glow(bk.col, 64), x - cw, y - cw, cw * 2, cw * 2);
        ctx.drawImage(AS.Forge.glow('#ffffff', 32), x - 1.8, y - 1.8, 3.6, 3.6);
        const gq = t * 5 + seed; ctx.globalAlpha = 0.7; ctx.drawImage(AS.Forge.glow('#f0d0ff', 32), x + Math.cos(gq) * R * 0.8 - 1.5, y + Math.sin(gq) * R * 0.8 - 1.5, 3, 3);
        AS.Renderer.light(p.x, p.y, 26, bk.glow, 0.35);
      },
      trail(p, bk, Pp) {
        p.trailT = 0.04;
        Pp.spawn({ x: p.x + U.range(-2, 2), y: p.y + H, z: H, vx: U.range(-6, 6), vz: 10, shape: Pp.SMOKE, col: '#4c1a6c', col2: '#120418', size: 2, size2: 7, life: 0.6, alpha: 0.5, drag: 1 });
        if (Math.random() < 0.4) Pp.spawn({ x: p.x + U.range(-3, 3), y: p.y + H + U.range(-3, 3), z: H, vz: 8, shape: Pp.GLOW, col: '#c47aff', size: 1.8, size2: 0.3, life: 0.35, add: true });
        if (Math.random() < 0.08) Pp.spawn({ x: p.x, y: p.y + H, z: H, vz: 14, shape: Pp.CIRCLE, col: '#dcff9a', col2: '#4a6a1a', size: 1, size2: 0.3, life: 0.6, add: true });
      },
      impact(x, y, a, bk, Pp, k) {
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: '#e8c0ff', size: 4 * k, size2: 12 * k, life: 0.12, add: true });
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.GLOW, col: bk.col, col2: '#3a0a5a', size: 6 * k, size2: 20 * k, life: 0.35, add: true });
        Pp.spawn({ x, y: y + H, z: H, shape: Pp.RING, col: bk.col, size: 3 * k, size2: 18 * k, life: 0.35, add: true });
        for (let i = 0; i < 5; i++) { const q = Math.random() * TAU, sp = (20 + Math.random() * 30) * k; Pp.spawn({ x, y: y + H, z: H, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, vz: 8, shape: Pp.SMOKE, col: '#5a1a8a', col2: '#12041a', size: 2 * k, size2: 9 * k, life: 0.9, alpha: 0.55, drag: 1.4 }); }
        for (let i = 0; i < 4; i++) Pp.spawn({ x: x + U.range(-6, 6), y: y + H, z: H, vz: 20 + Math.random() * 20, shape: Pp.CIRCLE, col: '#f0d0ff', col2: '#6a1aa0', size: 1.2, size2: 0.3, life: 0.6, add: true });
      },
    },
  };

  const Combat = {
    BOLT,
    /* ---------------- the dragon rider's weapons ---------------- */
    dragonWeapons(d, dt) {
      const g = d.g, I = d.input;
      const wasBreathing = d.breathing;
      // wizard bolts
      d.fireCd -= dt;
      const bk = BOLT[d.fdef.rider.bolt] || BOLT.arcane;
      const cost = (bk.mana || 4) * (d.buffs.rapid ? 0.4 : 1);
      if (I.fire && d.fireCd <= 0 && d.mana >= cost && !(d.eatT > 0)) {
        d.fireCd = 1 / ((bk.rate || 5.5) * d.boltRate * (d.buffs.rapid ? 1.9 : 1) * (d.isPlayer ? 1 : g.diff.dragonFire || 1));
        d.mana -= cost;
        this.castBolt(d, bk);
      }
      // breath
      const want = I.breath && d.fireCharge > 4 && d.energy > 0 && !d.carry && d.eatT <= 0;
      if (want) {
        if (!d.breathing) {
          d.breathing = true; d.breathT = 0;
          AS.Audio.sfx('breath_inhale', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.7 });
          AS.Audio.sfx('breath_ignite', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.7 });
          if (d.isPlayer) g.camera.pulseZoom(0.025, 0.5);
        }
        d.breathT += dt;
        d.fireCharge = Math.max(0, d.fireCharge - ((AS.Data.breaths[d.fdef.dragon.breath] || {}).drain || 32) * dt * (d.buffs.inferno ? 0.4 : 1));
        if (d.fireCharge <= 0) { d.breathing = false; d.fireDelay = 1.4; }
        this.aimBreath(d, dt);
        if (d.breathing) this.breath(d, dt);
      } else if (d.breathing) { d.breathing = false; d.fireDelay = 0.7; }
      if (!d.breathing) this.aimBreath(d, dt);
      if (wasBreathing && !d.breathing) AS.Audio.sfx(d.breathT < 0.35 ? 'breath_burst' : 'breath_stop', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.7 });
      this.breathSound(d);
    },
    /* the dragon swings its head toward what it breathes at: the cursor (or a
     * rival dragon near it), up to ~75 degrees either side of its flight;
     * the stream rises to meet a dragon in the air */
    aimBreath(d, dt) {
      const g = d.g, I = d.input;
      let want = 0;
      if (d.breathing) {
        let tgt = I.breathTarget && I.breathTarget.targetable ? I.breathTarget : null;
        if (!tgt) {
          let bd = 95 * 95;
          for (const e of g.dragons) {
            if (e === d || !e.targetable || !g.hostile(d.team, e.team)) continue;
            const dx = e.x - I.aimX, dy = e.y - e.z - I.aimY, dd = dx * dx + dy * dy;
            if (dd < bd) { bd = dd; tgt = e; }
          }
        }
        const tx = tgt ? tgt.x : I.aimX, ty = tgt ? tgt.y : I.aimY;
        d.breathTarget = tgt;
        want = U.clamp(U.wrapAngle(Math.atan2(ty - d.y, tx - d.x) - d.angle), -1.3, 1.3);
      } else d.breathTarget = null;
      d.headYaw = U.damp(d.headYaw || 0, want, d.breathing ? 12 : 5, dt);
    },
    castBolt(d, bk) {
      const g = d.g, I = d.input;
      const st = d.drawState;
      // the staff tip as last drawn — but only if that was just now: a dragon off screen (or
      // driven off) is not drawn, and its old staff position would launch bolts from where
      // it was last seen
      const fresh = st.staffX !== undefined && st.staffAt !== undefined && Math.abs(g.time - st.staffAt) < 0.15;
      const sx = fresh ? st.staffX : d.x, sy = fresh ? st.staffY : d.y - d.z - 16;
      const a = Math.atan2(I.aimY - sy, I.aimX - sx);
      const life = 560 / bk.speed + 0.1; // (every spell reaches as far; slow ones take longer to get there)
      // gentle aim assist: home on the hostile nearest the aim point
      // (a rival's assist is weaker on easier settings, so its bolts can be dodged)
      const aim = d.isPlayer ? 1 : Math.min(1, g.diff.dragonAim || 1);
      let target = null, bd = 70 * 70 * aim * aim;
      const cands = g.grid.query(I.aimX, I.aimY + 40, 120, this._q || (this._q = []));
      for (const e of cands) {
        if (!e.alive || e.targetable === false || !g.hostile(d.team, e.team)) continue;
        const ex = e.x, ey = e.py !== undefined ? e.py : e.y;
        const dd = (ex - I.aimX) * (ex - I.aimX) + (ey - I.aimY) * (ey - I.aimY);
        if (dd < bd) { bd = dd; target = e; }
      }
      cands.length = 0;
      const n = d.boltMulti + (d.buffs.power ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const spread = n > 1 ? (i - (n - 1) / 2) * 0.12 : 0;
        AS.Proj.missile({ team: d.team, x: sx, y: sy, a: a + spread, speed0: bk.speed * 0.85, speed: bk.speed, turn: target ? 3.2 * aim : 0, life,
          dmg: bk.dmg * d.boltDmg * (d.buffs.power ? 1.6 : 1), dtype: 'magic', r: bk.r, col: bk.col, size: 2.2, target: i === 0 ? target : null, tx: I.aimX, ty: I.aimY,
          owner: d, style: 'bolt', extra: { bk, splash: d.buffs.power ? 26 : 0, seed: Math.random() * TAU } });
      }
      d.cast = 1;
      AS.Audio.sfx('bolt_cast', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.6, rate: U.range(0.95, 1.08) * (d.fk === 'ice' ? 0.9 : d.fk === 'elf' ? 1.1 : 1) });
      // the spell leaves the staff tip in its own colours
      P().spawn({ x: sx, y: sy + 30, z: 30, shape: P().GLOW, col: bk.core, col2: bk.glow, size: bk.kind === 'shard' ? 6 : 4, size2: bk.kind === 'shard' ? 16 : 12, life: 0.14, add: true });
      if (bk.kind === 'arrow') P().spawn({ x: sx, y: sy + 30, z: 30, shape: P().FLARE, rot: a, col: '#ffffff', size: 10, size2: 4, asp: 0.15, life: 0.08, add: true });
      else if (bk.kind === 'orb') P().spawn({ x: sx, y: sy + 30, z: 30, vz: 10, shape: P().SMOKE, col: '#5a1a8a', col2: '#12041a', size: 2, size2: 7, life: 0.5, alpha: 0.5 });
      else if (bk.kind === 'shard') for (let k = 0; k < 3; k++) P().spawn({ x: sx, y: sy + 30, z: 30, vx: U.range(-30, 30), vy: U.range(-30, 30), shape: P().STREAK, col: '#ffffff', col2: bk.glow, size: 1, life: 0.15, add: true, len: 0.05 });
      AS.Renderer.flare(sx, sy, 34, bk.glow, 0.5, 0.1);
    },

    /* the breath: a stream from the jaws that falls onto the ground ahead. Its reach and cone
     * come from the breath type (AS.Data.breaths: range, half) — emerald flame reaches furthest
     * in a narrow stream, freezing breath is short and broad. */
    breathInfo(d) {
      const hd = d.nodes[0], s = d.scale, B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
      const a = hd.a;
      const mx = hd.x + Math.cos(a) * 14 * s, my = hd.y + Math.sin(a) * 14 * s, mz = hd.z + 2;
      const hi = U.clamp((mz - 24) / 60, 0, 1); // high breath lands further ahead and weaker
      const L = (150 + hi * 40) * s * (d.buffs.inferno ? 1.25 : 1) * (B.range || 1);
      // aimed at a dragon in the air, the stream climbs or falls to its height; from high up
      // (a held altitude, game/altitude.js) it falls a little way and burns out short of the ground
      const air = d.breathTarget && d.breathTarget.isDragon;
      const high = !air && mz > ((AS.Altitude && AS.Altitude.BREATH_REACH) || 140);
      const tz = air ? d.breathTarget.z : high ? mz - 100 : 0;
      return { a, mx, my, mz, tz, high, L: tz > 30 ? L * 1.15 : L, start: (10 + hi * 50) * s, half: B.half || 0.34, power: tz > 30 ? 0.95 : U.lerp(1, 0.55, hi), range: B.range || 1 };
    },
    breath(d, dt) {
      const g = d.g, B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
      const bi = this.breathInfo(d);
      const ca = Math.cos(bi.a), sa = Math.sin(bi.a);
      d.breathInfoCache = bi;
      // the look: each breath its own (BreathFX below)
      const fx = BreathFX[B.style] || BreathFX.fire;
      fx.emit(d, bi, B, P(), AS.Particles.density, ca, sa);
      // light from the jaws and the landing zone
      AS.Renderer.light(bi.mx, bi.my - bi.mz, 70 * d.scale, B.light, B.style === 'necrotic' ? 0.4 : 0.55);
      if (!bi.high) AS.Renderer.light(bi.mx + ca * bi.L * 0.6, bi.my + sa * bi.L * 0.6, 90 * d.scale * bi.range, B.light, B.style === 'frost' ? 0.3 : 0.4);
      else if (d.isPlayer) g.msg('TOO HIGH — YOUR BREATH BURNS OUT BEFORE THE GROUND (X OR SPACE TO DROP)', '#ffe7a8', 1.2);
      if (d.isPlayer && Math.random() < (B.style === 'frost' ? 0.45 : 0.3)) g.camera.shake(B.style === 'frost' ? 0.06 : 0.04);
      // damage ticks (10 Hz)
      d.breathTick -= dt;
      if (d.breathTick > 0) return;
      d.breathTick = 0.1;
      const boost = d.buffs.inferno ? 1.6 : 1;
      const base = 11 * (B.dps || 1) * d.fireDmg * bi.power * boost;
      const R = bi.L + 40;
      const cx = bi.mx + ca * bi.L * 0.5, cy = bi.my + sa * bi.L * 0.5;
      const list = g.grid.query(cx, cy, R, this._bq || (this._bq = []));
      const dtype = B.effect === 'freeze' ? 'frost' : B.effect === 'wither' ? 'necrotic' : 'fire';
      let sparks = 0;
      for (const e of list) {
        if (!e.alive || e === d || e.targetable === false) continue;
        if (e.team === d.team) continue;
        if (!g.hostile(d.team, e.team) && !(e.team === 'neutral' && e.burnable)) continue;
        if (!this.inCone(bi, e.x, e.y, e.z || 0, e.r || 8)) continue;
        const dmg = base * (e.isBuilding ? 1.5 : 1) * (e.breathMul || 1);
        e.takeDamage(dmg, dtype, d, { armorMul: B.armorK || 1 });
        this.applyEffect(e, B.effect, d, B.poison ? B.poison * d.fireDmg * boost * (e.isBuilding ? 1.5 : 1) : 0);
        if (sparks < 4 && Math.random() < 0.6) { sparks++; fx.touch(e, B, P(), d); }
        if (d.isPlayer && AS.FoeCard) AS.FoeCard.note(g, e);
      }
      list.length = 0;
      if (AS.Life) AS.Life.breathHit(g, d, bi, base, B);
      // the ground catches: scorch, frost, roots or mist
      if (Math.random() < 0.45 && bi.mz < 90) {
        const t = 0.45 + Math.random() * 0.55, off = (Math.random() - 0.5) * bi.half * 1.4;
        const gx = bi.mx + Math.cos(bi.a + off) * bi.L * t, gy = bi.my + Math.sin(bi.a + off) * bi.L * t;
        if (g.terrain.kindFast(gx, gy) === 0) {
          Fields.spawnPatch(g, B.effect, gx, gy, d);
          if (Math.random() < 0.5) g.terrain.addDecal(B.effect === 'freeze' ? 'frostmark' : 'scorch', gx, gy, 10 + Math.random() * 8);
        }
      }
    },
    inCone(bi, x, y, z, r) {
      const dx = x - bi.mx, dy = y - bi.my, dist = Math.hypot(dx, dy);
      if (dist > bi.L + r || dist < bi.start * 0.3 - r) return false;
      const ang = Math.abs(U.wrapAngle(Math.atan2(dy, dx) - bi.a));
      const half = bi.half + Math.atan2(r, Math.max(10, dist));
      if (ang > half) return false;
      // air targets must be near the stream's height at that distance
      const t = U.clamp(dist / bi.L, 0, 1), tz = bi.tz || 0, sz = bi.mz + (tz - bi.mz) * t;
      if (z < 30) return tz > 30 ? sz < 40 : sz < 70 || t > 0.4;
      return Math.abs(z - sz) < 60;
    },
    applyEffect(e, eff, src, poison) {
      if (eff === 'burn') { if (e.ignite) e.ignite(3.5, src); }
      else if (eff === 'freeze') { e.slow = Math.max(e.slow || 0, 2.5); if (e.chill !== undefined) e.chill = Math.min(1, (e.chill || 0) + 0.12); if (e.isBuilding) e.brittle = Math.max(e.brittle || 0, 3); }
      else if (eff === 'entangle') { if (!e.isBuilding && !e.isDragon) e.root = Math.max(e.root || 0, 1.6); else if (e.ignite) e.ignite(2, src); }
      // the necrotic mark (lets the slain rise as skeletons) and its poison: the plague breath's
      // own strength, or a weaker one from the mist it leaves on the ground
      else if (eff === 'wither') { e.wither = Math.max(e.wither || 0, 4); e.witherSrc = src; Poison.breath(src && src.g || AS.game, e, poison || 6, poison ? 3 : 2, src); }
    },
    breathSound(d) {
      const key = 'breath:' + d.fk;
      const B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
      const p = d.g.player;
      if (d.breathing) {
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        const vol = d.isPlayer ? 1 : U.clamp(1 - dist / 900, 0, 1) * 0.8;
        if (vol <= 0.02) { AS.Audio.stopLoop(key); return; }
        if (!AS.Audio.loops[key]) AS.Audio.startLoop(key, B.sfx, vol);
        else AS.Audio.loopParam(key, 1 + Math.sin(d.t * 3) * 0.04, vol);
      } else if (AS.Audio.loops && AS.Audio.loops[key]) AS.Audio.stopLoop(key);
    },

    /* ---------------- realm weapons: towers, archers, siege ---------------- */
    // kind: arrow | ballista | magic | spear | rock (giant) | stone (catapult)
    shoot(src, target, kind, o) {
      o = o || {};
      const g = src.g, team = src.team;
      const sx = o.x !== undefined ? o.x : src.x, sz = o.z !== undefined ? o.z : (src.shotZ || src.hc || 10);
      const sy = (o.y !== undefined ? o.y : src.y) - sz;
      // a dragon flying high is out of reach of all but the longest shots: the range counts in 3D
      // (the Mountain Test checks its own, with line of sight over the terrain)
      if (target.isDragon && target.z > 90 && !g.mtn) {
        const rng = { arrow: 380, spear: 260, ballista: 640, magic: 520, crossbow: 360, stone: 520, rock: 300 }[kind] || 400;
        if (Math.hypot(target.x - sx, target.y - (o.y !== undefined ? o.y : src.y), target.z - sz) > rng * 1.12) return;
      }
      const tpy = target.py !== undefined ? target.py : target.y;
      const d = Math.hypot(target.x - sx, tpy - sy);
      const dmgMul = o.dmgMul || 1;
      if (kind === 'stone' || kind === 'rock') {
        // lobbed: lead the target's ground position
        const T = kind === 'rock' ? 1.0 : U.clamp(d / 260, 1.1, 2.4);
        const lead = target.isDragon ? 0.6 : 0.85;
        const gx = target.x + (target.vx || 0) * T * lead + U.range(-14, 14), gy = target.y + (target.vy || 0) * T * lead + U.range(-14, 14);
        AS.Proj.lob({ team, sx: src.x, sy: src.y, sz, gx, gy, T, arc: kind === 'rock' ? 60 : 150, land: kind, dmg: (kind === 'rock' ? 34 : 46) * dmgMul, dtype: 'impact', radius: kind === 'rock' ? 26 : 44, col: '#8a7a6a', size: kind === 'rock' ? 4 : 5, owner: src, style: 'stone', warn: kind === 'stone', warnCol: '#ffb04a', extra: { airZ: target.isDragon ? target.z : 0, air: !!target.isDragon } });
        if (kind === 'rock' && src.role === 'giant') AS.Audio.sfx('giant_pickup', { x: src.x, y: src.y, vol: 0.35 });
        AS.Audio.sfx(kind === 'rock' ? src.role === 'giant' ? 'giant_throw_effort' : src.role === 'troll' ? 'troll_roar' : 'monster_roar' : 'catapult', { x: src.x, y: src.y, vol: 0.6 });
        if (kind === 'rock' && src.role === 'giant') AS.Audio.sfx('giant_rock_air', { x: src.x, y: src.y, vol: 0.4 });
        return;
      }
      const W = {
        arrow: { speed: 520, dmg: 4.5, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.05, range: 380 },
        spear: { speed: 420, dmg: 7, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.06, range: 260 },
        ballista: { speed: 820, dmg: 42, r: 5, style: 'ballista', dtype: 'pierce', sfx: 'ballista', spread: 0.015, range: 640 },
        magic: { speed: 380, dmg: 14, r: 5, style: 'magic', dtype: 'magic', sfx: 'bolt_cast', spread: 0, range: 520, homing: 2.2 },
        crossbow: { speed: 600, dmg: 7, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.04, range: 360 },
      }[kind] || {};
      // lead the target
      const travel = d / W.speed;
      const lk = target.isDragon ? (kind === 'ballista' ? 0.95 : 0.6) : 0.7;
      const px = target.x + (target.vx || 0) * travel * lk, py = tpy + (target.vy || 0) * travel * lk;
      const a = Math.atan2(py - sy, px - sx) + U.range(-W.spread, W.spread) * (o.inacc || 1);
      const col = o.col || (kind === 'magic' ? (AS.Data.factions[team] ? AS.Data.factions[team].color : '#c08aff') : '#d8c8a0');
      if (W.homing) AS.Proj.missile({ team, x: sx, y: sy, a, speed0: W.speed * 0.6, speed: W.speed, turn: W.homing, life: W.range / W.speed + 0.4, dmg: W.dmg * dmgMul, dtype: W.dtype, r: W.r, col, target, owner: src, style: W.style });
      else AS.Proj.bolt({ team, x: sx, y: sy, a, speed: W.speed, range: Math.min(W.range, d + 80) * 1.15, dmg: W.dmg * dmgMul, dtype: W.dtype, r: W.r, col, owner: src, style: W.style, extra: { kind } });
      AS.Audio.sfx(W.sfx, { x: src.x, y: src.y, vol: kind === 'ballista' ? 0.9 : 0.4, rate: U.range(0.92, 1.1) });
      if (kind === 'ballista') AS.FX.muzzle(sx, sy + sz, sz, a, '#ffe8c0', 0.6);
      // a spell visibly leaves its caster (towers cast from out of sight, too)
      if (kind === 'magic') { P().spawn({ x: sx, y: sy + sz, z: sz, shape: P().GLOW, col, size: 5, size2: 16, life: 0.18, add: true }); AS.Renderer.flare(sx, sy, 40, col, 0.55, 0.14); }
    },

    /* ---------------- hit resolution (engine hooks) ---------------- */
    projHit(g, p) {
      if (p.type === 'lob') return false;
      const team = p.team;
      const cands = g.grid.query(p.x, p.y + 40, 120, this._hq || (this._hq = []));
      for (const e of cands) {
        if (!e.alive || e.targetable === false || e === p.owner) continue;
        if (!g.hostile(team, e.team)) continue;
        if (p.hits && p.hits.has(e)) continue;
        const ey = e.py !== undefined ? e.py : e.y;
        const rr = (e.hitR || e.r || 8) * 0.75 + p.r;
        if (U.segDist(e.x, ey, p.px, p.py, p.x, p.y) < rr) {
          cands.length = 0;
          this.hit(g, p, e);
          return true;
        }
      }
      cands.length = 0;
      // a dragon high above its ground position is drawn (and hit) far from where the grid files it
      for (const e of g.dragons) {
        if (e.z < 100 || !e.alive || e.targetable === false || e === p.owner || !g.hostile(team, e.team) || (p.hits && p.hits.has(e))) continue;
        if (U.segDist(e.x, e.py, p.px, p.py, p.x, p.y) < (e.hitR || e.r || 8) * 0.75 + p.r) { this.hit(g, p, e); return true; }
      }
      if (AS.Life && p.team && AS.Life.projHit(g, p)) return true;
      return false;
    },
    hit(g, p, e) {
      let dmg = p.dmg;
      if (e.isDragon && p.dtype === 'pierce_light') dmg *= 0.8;
      if (e.isBuilding && p.dtype === 'pierce_light') dmg *= 0.25;
      if (e.isBuilding && p.dtype === 'magic') dmg *= 0.7;
      const bk = p.extra && p.extra.bk;
      const dealt = e.takeDamage(dmg, p.dtype, p.owner, bk ? { armorMul: bk.armorK || 1 } : undefined);
      if (p.style === 'bolt') {
        this.boltImpact(p, 1);
        AS.Audio.sfx('bolt_hit', { x: p.x, y: p.y + 40, vol: bk && bk.kind === 'arrow' ? 0.4 : 0.6, rate: bk && bk.kind === 'shard' ? 0.75 : bk && bk.kind === 'orb' ? 0.8 : bk && bk.kind === 'arrow' ? 1.25 : 1 });
        if (bk && bk.slow) e.slow = Math.max(e.slow || 0, bk.slow);
        if (bk && bk.poison) Poison.orb(g, e, p.owner);
        if (p.extra.splash) g.damageArea(e.x, e.y, p.extra.splash, p.dmg * 0.5, 'magic', p.team, p.owner, { exclude: e });
      } else if (p.style === 'ballista') {
        AS.FX.impact(p.x, p.y, 0, '#ffe8c0', Math.atan2(p.vy, p.vx));
        AS.FX.sparks(p.x, p.y + 40, 40, 6, '#ffe0a0');
        AS.Audio.sfx('stone_hit', { x: p.x, y: p.y, vol: 0.5 });
        if (e.isDragon && e.isPlayer) { g.camera.shake(0.4); g.msg('BALLISTA HIT!', '#ff8a5a', 1.2); }
      } else if (p.style === 'magic') {
        AS.FX.impact(p.x, p.y, 0, p.col);
        AS.Audio.sfx('bolt_hit', { x: p.x, y: p.y, vol: 0.4, rate: 0.8 });
      } else {
        AS.Audio.sfx('arrow_hit', { x: p.x, y: p.y, vol: 0.4 });
        if (e.isDragon) AS.FX.sparks(p.x, p.y + 40, 40, 2, '#ffd27a');
      }
      if (AS.FoeCard && p.owner === g.player) AS.FoeCard.note(g, e); // (what you are fighting)
      if (p.owner && p.owner.isDragon && e.onHitBy) e.onHitBy(p.owner);
      if (p.owner && p.owner.isDragon && p.owner.isPlayer && e.isBuilding && e.hpBarT !== undefined) e.hpBarT = 3;
    },
    projExpire(g, p) {
      if (p.style === 'bolt') {
        // the bolt bursts on the ground beneath its end point
        if (p.owner===g.player && p.target && Math.random()<.04 && AS.Voices && AS.Voices.g===g) AS.Voices.event('missed_shot',{cooldown:70});
        AS.FX.groundHit(p.x, p.y + 20, p.col);
        this.boltImpact(p, 0.6);
        if (p.extra && p.extra.splash) g.damageArea(p.x, p.y + 30, p.extra.splash, p.dmg * 0.5, 'magic', p.team, p.owner, {});
      } else if (p.style === 'arrow') {
        if (Math.random() < 0.3) AS.FX.groundHit(p.x, p.y + 10, '#a89878');
      } else if (p.style === 'ballista') AS.FX.dust(p.x, p.y + 10, 3, '#a08a6a', 30);
    },
    projBurst(g, p) { this.projExpire(g, p); },

    /* the breath streams, drawn over their particles: each breath its own (BreathFX.draw) */
    drawBreaths(ctx, ox, oy, g, R) {
      for (const d of g.dragons) {
        if (!d.breathing || !d.breathInfoCache || d.hidden) continue;
        const bi = d.breathInfoCache, B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire, fx = BreathFX[B.style] || BreathFX.fire;
        const ca = Math.cos(bi.a), sa = Math.sin(bi.a);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // glow where the stream lands (or, aimed at a dragon, the end of the stream in the air)
        const air = (bi.tz || 0) > 30, reach = air ? 0.85 : B.style === 'verdant' ? 0.72 : 0.62;
        const gx = bi.mx + ca * bi.L * reach - ox, gy = bi.my + sa * bi.L * reach - oy;
        const endZ = air ? bi.mz + (bi.tz - bi.mz) * reach : 0;
        const gs = B.style === 'verdant' ? 0.7 : 1;
        ctx.globalAlpha = (air ? 0.35 : 0.5) * (B.style === 'frost' ? 0.6 : 1) + Math.random() * 0.1;
        ctx.drawImage(AS.Forge.glow(B.style === 'necrotic' ? B.cols[1] : B.cols[2], 64), gx - bi.L * 0.55 * gs, gy - endZ - bi.L * 0.4 * gs, bi.L * 1.1 * gs, bi.L * 0.8 * gs);
        const mx = bi.mx - ox, my = bi.my - bi.mz - oy, ex = gx, ey = gy - endZ;
        const G = { mx, my, ex, ey, nx: -sa, ny: ca, w0: 3 * d.scale, t: g.time + d.x * 0.01, L: bi.L, len: Math.max(1, Math.hypot(ex - mx, ey - my)) };
        fx.draw(ctx, G, B, bi);
        ctx.restore();
      }
    },
    /* a spell's burst where it strikes (k: 1 a hit, less for a miss bursting on the ground) */
    boltImpact(p, k) {
      const bk = (p.extra && p.extra.bk) || BOLT.arcane, F = BoltFX[bk.kind] || BoltFX.sphere;
      F.impact(p.x, p.y, Math.atan2(p.vy, p.vx), bk, P(), k);
    },
    update(g, dt) { Poison.update(g, dt); },
  };

  /* ---------------- projectile looks ---------------- */
  const S = AS.Proj.styles, TR = AS.Proj.trails;
  S.bolt = (ctx, p, sx, sy) => {
    const bk = (p.extra && p.extra.bk) || BOLT.arcane;
    ctx.save();
    (BoltFX[bk.kind] || BoltFX.sphere).draw(ctx, p, sx, sy, bk);
    ctx.restore();
  };
  TR.bolt = (p) => { const bk = (p.extra && p.extra.bk) || BOLT.arcane; (BoltFX[bk.kind] || BoltFX.sphere).trail(p, bk, P()); };
  S.arrow = (ctx, p, sx, sy) => {
    const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), L = p.extra && p.extra.kind === 'spear' ? 9 : 7;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx + 0.6, sy + 0.8); ctx.lineTo(sx - ca * L + 0.6, sy - sa * L + 0.8); ctx.stroke();
    ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.strokeStyle = '#f4f0e8'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx - ca * (L - 1.5), sy - sa * (L - 1.5)); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.restore();
  };
  TR.arrow = (p) => { p.trailT = 1; };
  S.ballista = (ctx, p, sx, sy) => {
    const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), L = 16;
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff0d0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L * 3, sy - sa * L * 3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(sx + ca * 4, sy + sa * 4); ctx.lineTo(sx - sa * 2.2, sy + ca * 2.2); ctx.lineTo(sx + sa * 2.2, sy - ca * 2.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  TR.ballista = (p) => { p.trailT = 0.03; P().spawn({ x: p.x, y: p.y + 30, z: 30, shape: P().SMOKE, col: '#e8e0d0', size: 1.5, size2: 4, life: 0.35, alpha: 0.35 }); };
  S.magic = (ctx, p, sx, sy) => {
    const w = 6 + Math.sin(p.age * 30) * 1.2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(AS.Forge.glow(p.col, 64), sx - w * 1.6, sy - w * 1.6, w * 3.2, w * 3.2);
    ctx.drawImage(AS.Forge.glow('#ffffff', 32), sx - 2.4, sy - 2.4, 4.8, 4.8);
    ctx.restore();
    AS.Renderer.light(p.x, p.y, 24, p.col, 0.4);
  };
  TR.magic = (p) => { p.trailT = 0.03; P().spawn({ x: p.x, y: p.y + 20, z: 20, shape: P().GLOW, col: p.col, size: 3, size2: 0.5, life: 0.35, add: true }); };
  S.stone = (ctx, p, sx, sy, g, ox, oy) => {
    // ground shadow, then the tumbling boulder
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.gxNow - ox, p.gyNow - oy, p.size + 1.5, (p.size + 1.5) * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.age * 7);
    ctx.fillStyle = '#4a4038'; ctx.beginPath(); ctx.arc(0, 0, p.size + 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9a8c7a'; ctx.beginPath(); ctx.moveTo(-p.size, -1); ctx.lineTo(-p.size * 0.3, -p.size); ctx.lineTo(p.size * 0.8, -p.size * 0.5); ctx.lineTo(p.size * 0.9, p.size * 0.4); ctx.lineTo(-p.size * 0.2, p.size * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8bca8'; ctx.beginPath(); ctx.arc(-p.size * 0.3, -p.size * 0.35, p.size * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  };
  TR.stone = (p) => { p.trailT = 0.05; };

  /* ---------------- area effects (replaces the engine's AS.Fields) ---------------- */
  const Fields = {
    spawnPatch(g, eff, x, y, src) {
      const list = AS.Proj.fields;
      if (list.length > 70) return;
      // merge with a nearby patch of the same kind instead of stacking
      for (const f of list) if (f.type === eff && Math.abs(f.x - x) < 16 && Math.abs(f.y - y) < 16) { f.t = Math.min(f.t, f.life * 0.3); return; }
      AS.Proj.field({ type: eff, x, y, r: 16 + Math.random() * 6, life: eff === 'burn' ? 4.5 : 3.5, team: src.team, src, seed: Math.random() * 100 });
    },
    land(g, p) {
      const x = p.gx, y = p.gy, R = p.radius;
      if (p.land === 'stone' || p.land === 'rock') {
        // a boulder can also strike a low-flying dragon over the landing point
        g.damageArea(x, y, R, p.dmg, 'impact', p.team, p.owner, { groundOnly: !p.extra || !p.extra.air });
        AS.FX.explosion(x, y, 2, R * 0.35, { col: '#fff0d0', col2: '#c8a070', debris: true, debrisCol: '#6a5a4a', dustCol: '#9a8a6a', lightCol: '#ffd0a0' });
        AS.FX.dust(x, y, 10, '#a0907a', 90);
        g.terrain.addDecal('crater', x, y, R * 0.5);
        AS.Audio.sfx(p.land === 'rock' && p.owner?.role === 'giant' ? 'giant_rock_impact' : 'stone_hit', { x, y });
        g.shakeNear(x, y, 0.3);
      }
    },
    update(g, f, dt) {
      f.tick = (f.tick || 0) - dt;
      const k = 1 - f.t / f.life;
      if (Math.random() < 0.5 * AS.Particles.density) {
        const a = Math.random() * TAU, r = Math.random() * f.r * 0.8;
        const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.75;
        if (f.type === 'burn') { AS.FX.fire(x, y, 1, 6 * k + 2); if (Math.random() < 0.25) AS.FX.smoke(x, y, 6, 5, true); }
        else if (f.type === 'freeze') P().spawn({ x, y, z: 1, vz: 6, shape: P().GLOW, col: '#dff6ff', size: 2, size2: 0.4, life: 0.6, add: true });
        else if (f.type === 'entangle') P().spawn({ x, y, z: 1, vz: 10, shape: P().CIRCLE, col: '#8aff9a', col2: '#2a7a3a', size: 1.2, size2: 0.3, life: 0.5, add: true });
        else if (f.type === 'wither') P().spawn({ x, y, z: 2, vz: 8, shape: P().SMOKE, col: '#6a3a8a', col2: '#2a1a3a', size: 3, size2: 8, life: 1, alpha: 0.4 });
      }
      if (f.type === 'burn') AS.Renderer.light(f.x, f.y, 34, '#ff8a3a', 0.3 * k + 0.1);
      if (f.tick > 0) return;
      f.tick = 0.33;
      const list = g.grid.query(f.x, f.y, f.r + 20, []);
      for (const e of list) {
        if (!e.alive || e.isDragon || e.team === f.team || !g.hostile(f.team, e.team)) continue;
        if (Math.hypot(e.x - f.x, e.y - f.y) > f.r + (e.r || 6) * 0.5) continue;
        if (f.type === 'burn') { e.takeDamage(2.4, 'fire', f.src); if (e.ignite && Math.random() < 0.3) e.ignite(2, f.src); }
        else Combat.applyEffect(e, f.type, f.src);
      }
      if (AS.Life) AS.Life.fieldTouch(g, f);
    },
    end() {},
    drawGround(ctx, ox, oy, g) {
      for (const f of AS.Proj.fields) {
        const k = 1 - f.t / f.life, x = f.x - ox, y = f.y - oy;
        if (f.type === 'burn') {
          ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#1a0e08';
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * k;
          ctx.drawImage(AS.Forge.glow('#ff7a2a', 64), x - f.r * 1.2, y - f.r, f.r * 2.4, f.r * 2);
          ctx.globalCompositeOperation = 'source-over';
        } else if (f.type === 'freeze') {
          ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#e8f8ff';
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7 * k;
          ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = f.seed + i * 1.3; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * f.r * 0.9, y + Math.sin(a) * f.r * 0.6); } ctx.stroke();
        } else if (f.type === 'entangle') {
          ctx.globalAlpha = 0.65 * k; ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 1.6;
          ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = f.seed + i * 1.05; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * f.r * 0.5, y + Math.sin(a + 0.6) * f.r * 0.4, x + Math.cos(a) * f.r, y + Math.sin(a) * f.r * 0.7); } ctx.stroke();
        } else if (f.type === 'wither') {
          ctx.globalAlpha = 0.4 * k; ctx.fillStyle = '#3a1a4a';
          ctx.beginPath(); ctx.ellipse(x, y, f.r * 1.1, f.r * 0.8, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
    drawOverlay(ctx, ox, oy, g) {
      // telegraph where catapult stones will land
      for (const f of AS.Proj.fields) {
        if (f.type !== 'warn') continue;
        const k = f.t / f.life;
        ctx.save(); ctx.globalAlpha = 0.3 + k * 0.4; ctx.strokeStyle = f.col || '#ffb04a'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy, f.r * (1 - k * 0.4), f.r * 0.7 * (1 - k * 0.4), 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    },
  };
  // 'warn' telegraph fields carry no gameplay
  const baseUpdate = Fields.update;
  Fields.update = function (g, f, dt) { if (f.type === 'warn') return; baseUpdate.call(Fields, g, f, dt); };

  /* frost decal: pale crystalline splash baked into the ground */
  AS.Decals.painters.frostmark = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#eaf6ff';
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.72, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7;
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = rng.next() * TAU; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 0.8); } ctx.stroke();
    ctx.globalAlpha = 1;
  };

  AS.Combat = Combat;
  AS.Poison = Poison;
  AS.Fields = Fields;
})(window.AS);
