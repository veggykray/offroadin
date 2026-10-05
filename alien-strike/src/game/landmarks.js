/* ALIEN STRIKE — landmarks: large set pieces that make each map memorable
 * (crashed ships, giant skeletons, colony ruins, Choir monoliths, refinery
 * stacks...). Each is one big pre-rendered model at a fixed heading, with
 * baked ground decals (impact craters, skid trenches, plazas), a decor-free
 * footprint, a few collision circles for its tall parts, and ambient effects
 * (smoke columns, fires, beacons, glows).
 *
 * Placement: missions can pin landmarks (AS.Data.landmarkPins[missionId]); the
 * rest are scattered deterministically from the world's landmark set onto flat
 * open ground well away from the start, extraction, objectives and each other.
 * Also lays haul roads along convoy routes and foundation shadows under
 * buildings. Everything here is visual or static: no gameplay data changes. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  /* rotate object-space (dx, dy) by heading a */
  const rot = (dx, dy, a) => [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];

  class Landmark {
    constructor(g, kind, x, y, o) {
      o = o || {};
      const def = AS.Data.landmarks[kind];
      this.g = g; this.kind = kind; this.def = def;
      this.x = x; this.y = y; this.isLandmark = true; this.alive = true;
      // headings are quantised so the same model and heading share one cached render
      const q = def.headings || 8;
      this.angle = o.angle !== undefined ? o.angle : (def.turn === false ? 0 : Math.round((o.rng ? o.rng.next() : Math.random()) * q) / q * TAU);
      this.variant = o.v || 0;
      const pal = Landmarks.palette(g.world, def.pal);
      const key = 'lm:' + kind + ':' + this.variant + ':' + g.world.key + ':' + this.angle.toFixed(3);
      this.sheet = AS.Forge.sheet(key, () => AS.Models[def.gen](pal, Object.assign({ seed: this.variant * 17 + 5 }, def.opt || {}, o.opt || {})), 1, def.anims || 1, { angle: this.angle });
      this.h = this.sheet.model.h || 30;
      this.r = def.r;
      this.fade = 1; this.t = Math.random() * 10; this.emitT = 0;
      this.fx = (def.fx || []).map((f) => { const p = rot(f.dx || 0, f.dy || 0, this.angle); return Object.assign({}, f, { x: x + p[0], y: y + p[1] }); });
    }
    get sortY() { return this.y + (this.def.sortOff || 0); }
    /* tall parts block flight; returns plain circles for g.solids */
    solids() {
      return (this.def.solids || []).map((s) => { const p = rot(s[0], s[1], this.angle); return { x: this.x + p[0], y: this.y + p[1], r: s[2], groundOnly: !!s[3], isObstacle: true, alive: true, landmark: this }; });
    }
    decals() {
      return (this.def.decals || []).map((d) => {
        const p = rot(d.dx || 0, d.dy || 0, this.angle);
        return Object.assign({}, d, { x: this.x + p[0], y: this.y + p[1], ang: (d.ang || 0) + this.angle });
      });
    }
    drawShadow(ctx, ox, oy) {
      const sh = this.sheet, off = 3 + this.h * 0.16;
      ctx.drawImage(sh.shadows[0], this.x - ox - sh.ax + off, this.y - oy - sh.ay + off * 0.55, sh.w, sh.h);
    }
    draw(ctx, ox, oy, R) {
      const g = this.g, sh = this.sheet, dt = Math.min(0.05, g.time - (this.lastT || g.time));
      this.lastT = g.time; this.t += dt;
      // see-through when the craft is tucked behind the tall part of the model
      const p = g.player;
      let want = 1;
      if (p && p.alive && p.y < this.y - 4 && p.y > this.y - sh.ay + 10 && Math.abs(p.x - this.x) < sh.w * 0.32) want = 0.5;
      this.fade = U.approach(this.fade, want, dt * 3);
      const ai = sh.anims > 1 ? Math.floor(this.t * (this.def.fps || 3)) % sh.anims : 0;
      ctx.globalAlpha = this.fade;
      ctx.drawImage(sh.frames[ai][0], this.x - ox - sh.ax, this.y - oy - sh.ay, sh.w, sh.h);
      ctx.globalAlpha = 1;
      this.ambient(dt, R);
    }
    ambient(dt, R) {
      const P = AS.Particles, q = AS.Settings && AS.Settings.quality === 'low' ? 0.4 : 1;
      for (const f of this.fx) {
        const z = f.z || 0;
        switch (f.t) {
          case 'light': R.light(f.x, f.y - z, f.r || 40, f.col || '#ffb060', (f.a || 0.35) * (f.pulse ? 0.75 + Math.sin(this.t * f.pulse) * 0.25 : 1)); break;
          case 'beacon': {
            const on = (this.t * (f.rate || 0.8)) % 1 < 0.18;
            if (on) R.light(f.x, f.y - z, f.r || 26, f.col || '#ff4a3a', f.a || 0.8);
            break;
          }
          case 'smoke':
            if (Math.random() < (f.rate || 3) * dt * q) P.spawn({ x: f.x + U.range(-4, 4), y: f.y + U.range(-3, 3), z, vx: U.range(4, 14), vy: U.range(-4, 2), vz: U.range(18, 30), shape: P.SMOKE, col: f.col || '#3a3430', col2: f.col2 || '#7a726a', size: f.size || 7, size2: (f.size || 7) * 3.2, life: U.range(2.6, 4), drag: 0.4 });
            break;
          case 'fire':
            if (Math.random() < (f.rate || 8) * dt * q) P.spawn({ x: f.x + U.range(-5, 5), y: f.y + U.range(-3, 3), z: z + 1, vx: U.range(-4, 4), vy: U.range(-3, 3), vz: U.range(14, 30), shape: P.GLOW, col: '#ffe08a', col2: '#ff4a0a', size: 4, size2: 1, life: U.range(0.4, 0.8), add: true });
            R.light(f.x, f.y - z - 4, f.r || 34, '#ff8a3a', 0.32 + Math.sin(this.t * 13 + f.x) * 0.06);
            break;
          case 'sparks':
            if (Math.random() < (f.rate || 0.6) * dt * q) { AS.FX.sparks(f.x, f.y, z, 5, f.col || '#ffd27a'); R.light(f.x, f.y - z, 24, f.col || '#ffd27a', 0.5); }
            break;
          case 'motes':
            if (Math.random() < (f.rate || 4) * dt * q) P.spawn({ x: f.x + U.range(-f.spread || -20, f.spread || 20), y: f.y + U.range(-10, 10), z: z + U.range(0, 10), vx: U.range(-3, 3), vy: U.range(-3, 3), vz: U.range(6, 14), shape: P.GLOW, col: f.col || '#c09aff', size: 2, size2: 0.5, life: U.range(1.5, 3), add: true });
            break;
        }
      }
    }
  }

  /* a landmark with no sprite: baked decals plus ambient effects, ticked while on screen */
  class Site extends Landmark {
    constructor(g, kind, x, y, o) {
      o = o || {};
      const def = AS.Data.landmarks[kind];
      // skip Landmark's sprite setup
      const self = Object.create(Site.prototype);
      self.g = g; self.kind = kind; self.def = def; self.x = x; self.y = y; self.alive = true;
      const q = def.headings || 8;
      self.angle = o.angle !== undefined ? o.angle : (def.turn === false ? 0 : Math.round((o.rng ? o.rng.next() : Math.random()) * q) / q * TAU);
      self.r = def.r; self.t = 0; self.h = 0;
      self.fx = (def.fx || []).map((f) => { const p = rot(f.dx || 0, f.dy || 0, self.angle); return Object.assign({}, f, { x: x + p[0], y: y + p[1] }); });
      return self;
    }
    tick(R) {
      const g = this.g, dt = Math.min(0.05, g.time - (this.lastT || g.time));
      this.lastT = g.time; this.t += dt;
      this.ambient(dt, R);
    }
  }

  const Landmarks = {
    palette(world, pal) {
      if (!pal) return world.obstacle && world.obstacle.pal ? world.obstacle.pal : world.propPal;
      if (typeof pal === 'string') return world[pal] || world[pal + 'Pal'] || world.propPal;
      return pal;
    },
    available(kind) {
      const d = AS.Data.landmarks && AS.Data.landmarks[kind];
      if (!d) return false;
      if (d.pieces) return d.pieces.every((p) => Landmarks.available(p.k));
      return !d.gen || !!AS.Models[d.gen];
    },

    /* footprint check: open ground on one terrace level (or open water for water landmarks) */
    siteOK(T, x, y, r, water) {
      const f = new Float32Array(4);
      let level = null;
      for (let i = 0; i < 13; i++) {
        const a = i * 2.4, rr = i === 0 ? 0 : r * (i % 2 ? 0.55 : 1);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8;
        if (px < 60 || py < 60 || px > T.W - 60 || py > T.H - 60) return false;
        T.field(px, py, f);
        const k = T.kindOf(f[0], f[2]);
        if (water ? k !== 1 : k !== 0) return false;
        if (!water) { const l = T.levelOf(f[0]); if (level === null) level = l; else if (l !== level) return false; }
      }
      return true;
    },

    place(g) {
      const L = AS.Data.landmarks;
      if (!L) return;
      g.landmarks = g.landmarks || []; g.sites = g.sites || [];
      const m = g.mission, T = g.terrain, wid = g.world.id;
      const add = (kind, x, y, o) => {
        if (!Landmarks.available(kind)) return null;
        o = o || {};
        const def = L[kind];
        // decal-only sites and compound centres get a lightweight anchor (no sprite)
        const lm = def.gen ? new Landmark(g, kind, x, y, o) : new Site(g, kind, x, y, o);
        if (def.gen) g.landmarks.push(lm); else if (lm.fx.length) g.sites.push(lm);
        for (const s of lm.solids()) g.solids.push(s);
        let n = 0;
        const dust = U.C.hex(g.world.terrain.ramp[Math.min(1, g.world.terrain.ramp.length - 1)]);
        for (const d of lm.decals()) T.addDecal(d.kind, d.x, d.y, d.r, d.col, Object.assign({ dust }, d, { static: true, seed: (x * 7 + y * 13 + n++ * 101) | 0 }));
        T.clearAreas.push({ x, y, r: def.clear !== undefined ? def.clear : lm.r });
        for (const pc of def.pieces || []) {
          const p = rot(pc.dx, pc.dy, lm.angle);
          add(pc.k, x + p[0], y + p[1], { opt: pc.opt, v: pc.v, rng: o.rng, angle: pc.angle });
        }
        return lm;
      };
      // ---- pinned set pieces
      for (const p of (AS.Data.landmarkPins && AS.Data.landmarkPins[m.id]) || []) {
        if (p.flatten) T.addZone({ x: p.x, y: p.y, r: p.flatten });
        add(p.k, p.x, p.y, { angle: p.angle, v: p.v, opt: p.opt });
      }
      // ---- scattered landmarks from the world set
      const set = (AS.Data.landmarkSets && AS.Data.landmarkSets[wid]) || [];
      const pool = set.filter((e) => Landmarks.available(e.k));
      if (pool.length) {
        const rng = new U.RNG(((m.map.seed || 1) * 7919 + 4111) >>> 0);
        const area = (m.map.w * m.map.h) / 1e6;
        const want = Math.round(U.clamp(area / 7.5, 3, 6));
        const keep = [];
        keep.push({ x: m.start.x, y: m.start.y, r: 520 }, { x: m.extraction.x, y: m.extraction.y, r: 460 });
        for (const s of g.structures) keep.push({ x: s.x, y: s.y, r: s.r + 160 });
        for (const gr of g.groups) keep.push({ x: gr.x, y: gr.y, r: 260 });
        for (const c of g.cargo) keep.push({ x: c.x, y: c.y, r: 200 });
        for (const [, z] of g.zones) keep.push({ x: z.x, y: z.y, r: z.r + 120 });
        for (const z of T.zones) keep.push({ x: z.x, y: z.y, r: z.r * 1.2 + 60 });
        for (const lm of g.landmarks) keep.push({ x: lm.x, y: lm.y, r: lm.r + 900 });
        const used = {};
        let placed = 0, tries = 0;
        while (placed < want && tries < 260) {
          tries++;
          // weighted pick; repeats are allowed but discouraged
          let tot = 0; for (const e of pool) tot += (e.w || 1) / (1 + (used[e.k] || 0) * 2);
          let pick = rng.next() * tot, e = pool[0];
          for (const c of pool) { pick -= (c.w || 1) / (1 + (used[c.k] || 0) * 2); if (pick <= 0) { e = c; break; } }
          const def = L[e.k];
          const x = rng.range(300, m.map.w - 300), y = rng.range(300, m.map.h - 300);
          let bad = false;
          for (const k of keep) { const dx = x - k.x, dy = y - k.y, rr = k.r + def.r; if (dx * dx + dy * dy < rr * rr) { bad = true; break; } }
          if (bad || !Landmarks.siteOK(T, x, y, def.r * 1.35, !!def.water)) continue;
          const lm = add(e.k, x, y, { rng, v: rng.int(0, 3) });
          if (!lm) continue;
          keep.push({ x, y, r: lm.r + 900 });
          used[e.k] = (used[e.k] || 0) + 1;
          placed++;
        }
      }
    },

    /* compacted haul roads along convoy and crawler routes */
    roads(g) {
      const T = g.terrain, col = (g.world.terrain.road) || null;
      const ramp = g.world.terrain.ramp;
      const base = col || U.C.mix(ramp[Math.min(1, ramp.length - 1)], '#c8bca8', 0.35);
      const lay = (pts, w) => {
        if (!pts || pts.length < 2) return;
        // round the corners so the road reads as graded rather than ruled
        const sm = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[i - 1], b = pts[i], c = pts[i + 1];
          sm.push([U.lerp(a[0], b[0], 0.75), U.lerp(a[1], b[1], 0.75)], [U.lerp(b[0], c[0], 0.25), U.lerp(b[1], c[1], 0.25)]);
        }
        sm.push(pts[pts.length - 1]);
        T.addDecal('road', sm[0][0], sm[0][1], w, base, { static: true, pts: sm, w, seed: 7 });
        for (let i = 0; i < sm.length - 1; i++) T.clearSegs.push([sm[i][0], sm[i][1], sm[i + 1][0], sm[i + 1][1], w * 0.7]);
      };
      for (const s of g.mission.entities || []) {
        if (s.t === 'convoy' && s.path && !(g.world.terrain.water && g.terrain.isWater(s.x, s.y))) lay([[s.x, s.y]].concat(s.path), 34);
      }
    },

    /* ambient occlusion pads under standing buildings */
    foundations(g) {
      const T = g.terrain;
      for (const s of g.structures) {
        if (s.def.flat || s.r < 12 || s.air) continue;
        if (T.kindFast(s.x, s.y) !== 0) continue;
        T.addDecal('foundation', s.x, s.y + 2, s.r * 1.05, null, { static: true, seed: (s.x * 3 + s.y) | 0, slab: s.def.slab || null });
      }
    },
  };

  AS.Landmark = Landmark;
  AS.Landmarks = Landmarks;
})(window.AS);
