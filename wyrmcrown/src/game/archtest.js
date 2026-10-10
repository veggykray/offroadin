/* WYRMCROWN — ARCHITECTURE COMPATIBILITY TEST (maps/archtest.js). Opened with
 * index.html?world=arch or from the title menu.
 *
 * Six of Astra's revision-3 architectural assemblies, loaded from their unchanged
 * sources (src/gfx/arch_p1/modules.js + models.js, AS.Models.p1_*), stand on the
 * Mountain Test's real terrain through the ordinary engine: each is an
 * AS.Building whose sheet comes from AS.Forge (recipe → worker or page), drawn,
 * sorted, shadowed and lit like every other building. Nothing here changes the
 * dragon, the camera, the terrain or any rule; the region is the Mountain Test's.
 *
 *   ` then 1–6   fly to the six structures (castle, merchant house, citadel,
 *                tree dwelling, dwarven gate, vaulted hall)
 *   ` then 7–9   the human, elven and dwarven pairs from the flight ceiling
 *   ` then 0     unload the six (sheets evicted from the Forge cache), press
 *                again to place them back (sheets forged again)
 *
 * Each structure gets three of the player's troops at its door for scale. The
 * developer panel (F3) shows the p1 sheets, frames and memory. window.__arch is
 * the page API the browser test (tools/test_archtest.mjs) drives. */
'use strict';
(function (AS) {
  const U = AS.U;
  const PRE = 'bld:p1_'; // the Forge cache keys of every p1 sheet (Building.sheetFor)

  // a site-like building whose sheet is the p1 recipe in its culture's colours from the start
  // (Settlements.put builds one sheet in neutral colours first, then swaps it)
  let spec = null;
  const Base = AS.Building;
  class ArchStructure extends Base {
    resolveSheet() {
      const s = this._arch || spec;
      const m = Base.meta(s.id) || { dirs: 1, anims: 1 };
      this.sheet = Base.sheetFor(s.id, s.pal, { v: 0 }, m.dirs, m.anims);
      this.dirs = this.sheet.dirs;
    }
  }

  const ArchTest = {
    setup(g) {
      const m = g.map, A = m.archTest;
      g.arch = { list: [], loaded: false, log: [], dupes: [], t0: performance.now() };
      for (const s of A.structures) {
        const d = { key: s.key, id: s.id, name: s.name, culture: s.culture, env: s.env, heading: s.heading || 0 };
        if (!AS.Models[s.id]) { d.missing = true; g.arch.list.push(d); continue; }
        d.model = AS.Models[s.id](AS.Settlements.pal(s.culture), { v: 0 });
        d.info = d.model._arch;
        d.gx = s.x; d.gy = s.cliff ? this.againstCliff(g, s.x, d.info) : s.y;
        d.fit = this.fit(g, d);
        d.x = d.gx; d.y = d.gy - d.fit.anchor; // (projected: the ground point drawn at the anchor height)
        g.arch.list.push(d);
      }
      this.place(g, true);
      this.tests(g);
      // the developer panel: the p1 sheets beside the usual sprite lines
      const prev = g.perfLines;
      g.perfLines = () => (prev ? prev() : []).concat(this.perfLines(g));
      if (typeof window !== 'undefined') window.__arch = { g, A: this, state: () => this.state(g), toggle: () => this.toggle(g), dupes: (n) => this.dupes(g, n) };
    },
    /* the gate's ground y: its back (the cliff collar socket, local y −57) at the foot of the Wall's
     * sheer face. Walking north from the valley, the face starts where the ground first climbs
     * more than 1 unit per unit (the talus below it climbs far less). */
    againstCliff(g, x, info) {
      const R = g.terrain.R, col = (info.sockets || []).find((k) => k.id === 'cliff_collar');
      const back = col ? -col.position[1] : 57;
      let foot = null;
      for (let y = 4450; y > 3900; y -= 5) { if (R.h(x, y - 10) - R.h(x, y) > 10) { foot = y; break; } }
      if (foot === null) foot = 4180;
      return foot + back - 4; // the collar touching the face, so no gap shows behind the shoulders
    },
    /* how the flat base meets the ground. A sprite has one ground height: the structure stands at
     * the LOWEST of the support contacts its recipe declares (so no side floats above falling
     * ground; on a slope the uphill side runs into the hill). The spread is what the slope asks. */
    fit(g, d) {
      const R = g.terrain.R, hs = [];
      for (const c of d.info.contacts || []) hs.push(R.h(d.gx + c[0], d.gy + c[1]));
      const e0 = R.h(d.gx, d.gy), eA = hs.length ? Math.min(e0, ...hs) : e0;
      const rel = hs.map((h) => h - eA);
      const sock = (d.info.sockets || []).find((k) => k.id === 'site_access');
      const acc = sock ? R.h(d.gx + sock.position[0], d.gy + sock.position[1]) - eA : null;
      const blocked = (d.info.contacts || []).some((c) => { const q = [d.gx + c[0], d.gy + c[1]]; return !g.terrain.groundPassable(q[0], q[1] - R.h(q[0], q[1])); });
      return { anchor: +eA.toFixed(1), centre: +(e0 - eA).toFixed(1), contacts: hs.length, max: rel.length ? +Math.max(...rel).toFixed(1) : 0, access: acc === null ? null : +acc.toFixed(1), impassable: blocked };
    },
    /* put the six into the world (first: also their scale troops and tree clearings) */
    place(g, first) {
      const t0 = performance.now();
      for (const d of g.arch.list) {
        if (d.missing) continue;
        spec = { id: d.id, pal: AS.Settlements.pal(d.culture) };
        const B = new ArchStructure(g, 'site', null, d.x, d.y, { gen: d.id, team: 'neutral', instant: true, shoots: false, angle: d.heading, v: 0 });
        B._arch = spec; spec = null;
        B.invuln = true; B.targetable = false; B.burnable = false; B.palOverride = B._arch.pal;
        const i = g.solids.indexOf(B); if (i >= 0) g.solids.splice(i, 1); B.solid = false; // (collision is not part of this test)
        g.buildings.push(B); d.b = B;
        if (first) {
          // trees keep off each solid footprint the recipe declares (not one big circle)
          for (const s of d.info.solids || []) {
            const r = s.type === 'circle' ? s.r : s.type === 'ellipse' ? Math.max(s.rx, s.ry) : Math.hypot(s.w, s.d) / 2;
            const q = [d.gx + s.x, d.gy + s.y];
            g.terrain.clearAreas.push({ x: q[0], y: q[1] - g.terrain.R.h(q[0], q[1]), r: r + 4 });
          }
          this.troops(g, d);
        }
      }
      g.arch.loaded = true;
      g.arch.log.push({ ev: first ? 'placed' : 'reloaded', ms: +(performance.now() - t0).toFixed(1) });
    },
    // three of the player's troops at the door, for scale (they stand guard there)
    troops(g, d) {
      const R = g.terrain.R, sock = (d.info.sockets || []).find((k) => k.id === 'site_access');
      const ax = d.gx + (sock ? sock.position[0] : 0), ay = d.gy + (sock ? sock.position[1] : 40) + 14;
      d.troops = [];
      ['soldier', 'archer', 'elite'].forEach((role, i) => {
        const gx = ax + (i - 1) * 14, q = [gx, ay - R.h(gx, ay)];
        const u = new AS.Troop(g, role, g.playerKey, q[0], q[1], { state: 'guard', home: { x: q[0], y: q[1], r: 6 } });
        u.angle = Math.PI / 2; g.troops.push(u); d.troops.push(u);
      });
    },
    unload(g) {
      const t0 = performance.now(), before = AS.Forge.memory ? this.mem() : null;
      for (const d of g.arch.list) if (d.b) { const i = g.buildings.indexOf(d.b); if (i >= 0) g.buildings.splice(i, 1); d.b.removed = true; d.b = null; }
      for (const B of g.arch.dupes) { const i = g.buildings.indexOf(B); if (i >= 0) g.buildings.splice(i, 1); }
      g.arch.dupes = [];
      AS.Forge.clearCache(PRE);
      g.arch.loaded = false;
      g.arch.log.push({ ev: 'unloaded', ms: +(performance.now() - t0).toFixed(1), before, after: this.mem() });
    },
    toggle(g) {
      if (g.arch.loaded) { this.unload(g); g.msg('UNLOADED — the six structures and their sheets are gone (` 0 places them back)', '#ffe7a8', 5); }
      else { this.place(g, false); g.msg('RELOADED — the six structures are back; their sheets forge again', '#ffe7a8', 5); }
    },
    // n more copies of the merchant house beside the first: do they share its one sheet?
    dupes(g, n) {
      const d = g.arch.list.find((q) => q.id === 'p1_h01'); if (!d || !d.b) return null;
      const R = g.terrain.R, before = this.mem();
      for (let i = 0; i < n; i++) {
        const gx = d.gx + 110 + (i % 4) * 80, gy = d.gy + 100 + Math.floor(i / 4) * 80, q = [gx, gy - R.h(gx, gy)];
        spec = { id: d.id, pal: AS.Settlements.pal(d.culture) };
        const B = new ArchStructure(g, 'site', null, q[0], q[1], { gen: d.id, team: 'neutral', instant: true, shoots: false });
        B._arch = spec; spec = null; B.invuln = true; B.targetable = false; B.burnable = false;
        g.buildings.push(B); g.arch.dupes.push(B);
      }
      return { shared: g.arch.dupes.every((B) => B.sheet === d.b.sheet), keys: [...AS.Forge.cache.keys()].filter((k) => k.startsWith(PRE + 'h01')).length, before };
    },
    /* the inspection shortcuts, as Mountain Test scenarios (` then 1–0 → A–J) */
    tests(g) {
      const L = g.arch.list, by = (k) => L.find((d) => d.key === k), T = {};
      for (const d of L) {
        if (d.missing) continue;
        const depth = d.info && d.model ? d.model.r : 80;
        T[d.key] = { name: d.name, x: d.gx, y: d.gy + depth * 2.2 + 120, alt: g.terrain.R.h(d.gx, d.gy) + Math.max(110, d.model.h * 1.1), a: -Math.PI / 2, arch: d.key };
      }
      const high = (name, a, b) => { const p = by(a), q = by(b); return p && q ? { name, x: (p.gx + q.gx) / 2, y: (p.gy + q.gy) / 2 + 420, alt: g.mtn.ceil, a: -Math.PI / 2 } : null; };
      T.G = high('Human pair from the ceiling', 'A', 'B');
      T.H = high('Elven pair from the ceiling', 'C', 'D');
      T.I = high('Dwarven pair from the ceiling', 'E', 'F');
      const a = by('A'); T.J = { name: 'Unload / reload', x: a.gx, y: a.gy + 520, alt: g.terrain.R.h(a.gx, a.gy) + 260, a: -Math.PI / 2 };
      for (const k in T) if (!T[k]) delete T[k];
      g.map.tests = T;
    },
    // from AS.Mountain.startTest, after the dragon is placed
    onTest(g, k) {
      const say = (s) => g.msg(s, '#cfe8ff', 7);
      const d = g.arch.list.find((q) => q.key === k);
      if (d) say(d.name + ' (' + d.id + ') · ' + d.env + ' · fly over it, Z / X change height');
      else if (k === 'J') this.toggle(g);
      else say('Seen from the flight ceiling: hold X to come down');
    },
    mem() {
      let n = 0, bytes = 0, sheets = 0;
      for (const [k, sh] of AS.Forge.cache) {
        if (!k.startsWith(PRE) || !sh.frames) continue;
        sheets++;
        const add = (row) => { for (let i = 0; i < row.length; i++) { const dsc = Object.getOwnPropertyDescriptor(row, i); if (dsc && !dsc.get && row[i] && row[i].width) { n++; bytes += row[i].width * row[i].height * 4; } } };
        for (const r of sh.frames) add(r); add(sh.shadows);
      }
      return { sheets, images: n, mb: +(bytes / 1048576).toFixed(2) };
    },
    perfLines(g) {
      const M = this.mem();
      return [['architecture test: ' + g.arch.list.filter((d) => d.b).length + '/6 placed · p1 sheets ' + M.sheets + ' · images ' + M.images + ' (' + M.mb + ' MB)', '#e8d8a8']];
    },
    state(g) {
      return {
        loaded: g.arch.loaded, mem: this.mem(), log: g.arch.log,
        list: g.arch.list.map((d) => ({ key: d.key, id: d.id, missing: !!d.missing, env: d.env, x: d.x, y: d.y, gx: d.gx, gy: d.gy, fit: d.fit, r: d.model && d.model.r, h: d.model && d.model.h,
          parts: d.model && d.model.parts.length, sheet: d.b ? { w: d.b.sheet.w, h: d.b.sheet.h, ax: d.b.sheet.ax, ay: d.b.sheet.ay, dirs: d.b.sheet.dirs, res: d.b.sheet.res, key: d.b.sheet.key, left: d.b.sheet.left, cost: d.b.sheet.cost } : null,
          viewR: d.b && d.b.viewR, hc: d.b && d.b.hc })),
      };
    },
  };
  AS.ArchTest = ArchTest;
})(window.AS);
