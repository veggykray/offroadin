/* WYRMCROWN — LARGE WORLD TEST: entity streaming, activity levels and the
 * benchmark runner for maps flagged `largeWorld` (maps/largeworld.js).
 *
 * The terrain already streams: 256-unit chunks are shaded by background
 * workers around the camera, cached (LRU) and dropped when far, with stand-ins
 * if the dragon outruns them (gfx/realm_terrain.js). This module adds the same
 * idea for armies:
 *
 *   dormant   an enemy force is only data (its troop list) — no entities at all
 *   spawned   within SPAWN_R of the dragon it takes the field as real troops
 *             (the battle game's own AS.Troop, combat and AI); patrols march
 *   asleep    a spawned troop farther than map.simR from the dragon is skipped by
 *             the realm's update loop (no AI, no movement) until it is near again
 *   active    within simR: full combat AI; drawn and animated when on screen
 *
 * A force left behind (beyond DESPAWN_R, not fighting) is packed back into data
 * with its survivors, so the world remembers losses. Nothing is teleported and
 * nothing loads: the dragon simply flies on.
 *
 * Benchmarks: ?world=large&bench=A … I (or bench=all for A–G and I), &pop=25|50|100|200
 * for the crowd test (E). The results appear on screen and in window.__lwBench. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const SPAWN_R = 4200, DESPAWN_R = 6500;

  const LW = {
    SPAWN_R, DESPAWN_R,
    setup(g) {
      const m = g.map;
      g.lw = {
        groups: (m.encounters || []).map((e) => ({ def: e, left: e.troops.map((t) => t.slice()), troops: null, wp: 0, seen: false, defeated: false })),
        t: 0, counts: { active: 0, asleep: 0, visible: 0, spawnedGroups: 0, total: 0 }, crowd: [], bench: null,
      };
      g.msg('THE WIDE REALM — FLY WHERE YOU WILL', '#ffe7a8', 4);
      const P = AS.App && AS.App.params;
      const b = P && P.get('bench');
      if (b) g.later(2.5, () => this.bench(g, b.toUpperCase(), +(P.get('pop') || 0)));
    },
    dist(g, x, y) { const p = g.player; return Math.hypot(x - p.x, y - p.y); },
    spawn(g, G) {
      G.troops = [];
      const d = G.def; let n = 0;
      for (const [role, c] of G.left) for (let i = 0; i < c; i++) {
        const a = (n++) * 2.399, r = 50 + Math.sqrt(n) * 30;
        const u = new AS.Troop(g, role, 'wild', d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.8, { state: 'guard' });
        u.home = { x: d.x, y: d.y, r: 260 }; u.lwGroup = G;
        g.troops.push(u); G.troops.push(u);
      }
      if (d.patrol) this.march(G);
    },
    march(G) {
      const wp = G.def.patrol[G.wp % G.def.patrol.length];
      for (const u of G.troops) if (u.alive) u.marchTo(wp[0] + U.range(-60, 60), wp[1] + U.range(-60, 60), { r: 160 });
    },
    despawn(g, G) {
      const c = {};
      for (const u of G.troops) if (u.alive && !u.removed) { c[u.role] = (c[u.role] || 0) + 1; u.alive = false; u.removed = true; }
      G.left = Object.keys(c).map((k) => [k, c[k]]);
      G.troops = null;
    },
    update(g, dt) {
      const L = g.lw; if (!L) return;
      L.t += dt;
      if (L.bench) this.benchTick(g, dt);
      L.tick = (L.tick || 0) - dt;
      if (L.tick > 0) return;
      L.tick = 0.5;
      // stream the forces in and out
      let spawned = 0;
      for (const G of L.groups) {
        if (G.defeated) continue;
        const d = this.dist(g, G.def.x, G.def.y);
        if (!G.troops && d < SPAWN_R) this.spawn(g, G);
        if (G.troops) {
          const alive = G.troops.filter((u) => u.alive);
          if (!alive.length) { G.defeated = true; G.troops = null; g.msg(G.def.name.toUpperCase() + ' DEFEATED', '#ffe08a', 3); continue; }
          spawned++;
          // the centre follows a patrol
          const cx = alive.reduce((s, u) => s + u.x, 0) / alive.length, cy = alive.reduce((s, u) => s + u.y, 0) / alive.length;
          if (!G.seen && this.dist(g, cx, cy) < 1300) { G.seen = true; g.msg('ENEMY SIGHTED: ' + G.def.name.toUpperCase(), '#ff9a6a', 3); }
          if (G.def.patrol) {
            const wp = G.def.patrol[G.wp % G.def.patrol.length];
            if (Math.hypot(cx - wp[0], cy - wp[1]) < 260 && !alive.some((u) => u.target)) { G.wp++; this.march(G); }
          }
          const fighting = alive.some((u) => u.target);
          if (this.dist(g, cx, cy) > DESPAWN_R && !fighting) { G.def.x = cx; G.def.y = cy; this.despawn(g, G); spawned--; }
        }
      }
      // activity counts (for the F3 panel)
      const cam = g.camera, C = L.counts;
      C.active = 0; C.asleep = 0; C.visible = 0; C.total = 0;
      for (const t of g.troops) {
        if (!t.alive) continue;
        C.total++;
        if (t.dormant) C.asleep++; else C.active++;
        if (t.x > cam.x - 40 && t.x < cam.x + cam.w + 40 && t.y > cam.y - 40 && t.y < cam.y + cam.h + 160) C.visible++;
      }
      C.spawnedGroups = spawned; C.groups = L.groups.filter((q) => !q.defeated).length;
    },
    // the crowd test: n hostile troops around a point (replacing the previous crowd)
    crowd(g, n, x, y) {
      const L = g.lw;
      for (const u of L.crowd) if (u.alive) { u.alive = false; u.removed = true; }
      L.crowd = [];
      const roles = ['bandit', 'skeleton', 'wolf', 'bandit', 'skeleton', 'ogre'];
      for (let i = 0; i < n; i++) {
        const a = i * 2.399, r = 120 + Math.sqrt(i) * 34;
        const u = new AS.Troop(g, roles[i % roles.length], 'wild', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { state: 'guard' });
        u.home = { x, y, r: 320 };
        g.troops.push(u); L.crowd.push(u);
      }
    },

    /* ---------------- benchmarks ---------------- */
    TESTS: {
      A: { name: 'Open countryside', secs: 40, start: [9600, 18600], route: [[12600, 17000], [13800, 18800], [10800, 20400], [9200, 17200]] },
      B: { name: 'Dense forest', secs: 40, start: [6800, 8600], circle: [8600, 8200, 1900] },
      C: { name: 'Large village', secs: 30, start: [9300, 15400], circle: [9300, 16000, 520], low: true },
      D: { name: 'Around the castle', secs: 30, start: [6400, 17400], circle: [6400, 18200, 700] },
      E: { name: 'Engaging enemies', secs: 30, start: [11300, 15600], hover: [11300, 14700], crowd: true },
      F: { name: 'Fast across many chunks', secs: 45, start: [4600, 15200], route: [[20800, 11600]], sprint: true },
      G: { name: 'Reversing direction', secs: 40, start: [9000, 17600], shuttle: [[9000, 17600], [12000, 17600]], flip: 4 },
      I: { name: 'High flight (H) across the island', secs: 40, start: [4600, 16400], route: [[20600, 11200], [13800, 21400]], sprint: true, high: true },
      H: { name: 'Extended flight', secs: 240, start: [6400, 17000], route: [[9300, 16000], [8200, 10200], [13400, 9700], [18800, 8400], [20600, 11400], [16800, 15200], [16300, 19700], [11800, 22400], [7800, 19900], [6400, 17000]], sprint: true },
    },
    bench(g, code, pop) {
      const list = code === 'ALL' ? 'ABCDEFGI'.split('') : code.split('').filter((c) => this.TESTS[c]);
      if (!list.length) return;
      g.godMode = true; // a benchmark measures, it does not die
      g.lw.benchQueue = list; g.lw.benchPop = pop || 100; g.lw.benchResults = [];
      this.nextBench(g);
    },
    nextBench(g) {
      const L = g.lw, code = L.benchQueue.shift();
      if (!code) return this.benchDone(g);
      const T = this.TESTS[code], p = g.player;
      AS.Debug.tp(T.start[0], T.start[1], T.low ? 60 : 120);
      if (T.crowd) this.crowd(g, L.benchPop, T.hover[0], T.hover[1] - 200);
      g.highFlight = !!T.high;
      const prev = p.pilot;
      L.bench = { code, T, t: 0, warm: 3, slow: [], gaps: [], last: performance.now(), wi: 0, flipT: 0, prev, maxChunks: 0, sync0: g.terrain.syncN || 0, stand0: g.terrain.standN || 0, maxTroops: 0, maxActive: 0, maxVisible: 0 };
      const B = L.bench;
      // the slowest frames of the test, with what the main thread spent them on
      AS.Prof.onSlow = (ms, parts, forged, tsync, tstand) => {
        if (B.t < B.warm) return;
        B.slow.push({ ms: Math.round(ms), why: parts.map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ') + (forged ? ' · sprites forged ' + forged : '') + (tstand ? ' · ground stand-ins ' + tstand : '') });
        B.slow.sort((a, b) => b.ms - a.ms); B.slow.length = Math.min(B.slow.length, 3);
      };
      p.pilot = {
        read: (d, inp) => {
          let tx, ty;
          if (T.circle) { const a = Math.atan2(d.y - T.circle[1], d.x - T.circle[0]) + 0.5; tx = T.circle[0] + Math.cos(a) * T.circle[2]; ty = T.circle[1] + Math.sin(a) * T.circle[2]; }
          else if (T.hover) { tx = T.hover[0]; ty = T.hover[1]; }
          else if (T.shuttle) { const q = T.shuttle[B.wi % 2]; tx = q[0]; ty = q[1]; }
          else { const q = T.route[B.wi % T.route.length]; tx = q[0]; ty = q[1]; if (Math.hypot(d.x - tx, d.y - ty) < 300) B.wi++; }
          inp.steer = { x: tx, y: ty + d.z }; inp.throttle = T.hover && Math.hypot(d.x - tx, d.y - ty) < 300 ? 0 : 1; inp.sprint = !!T.sprint;
          inp.turn = 0; inp.dive = !!T.low; inp.aimX = tx; inp.aimY = ty;
          if (T.crowd) { const f = g.nearestFoe(d.team, d.x, d.y, 600); if (f) { inp.aimX = f.x; inp.aimY = f.y; inp.breath = true; inp.fire = true; } }
        },
      };
      g.msg('BENCHMARK ' + code + ': ' + T.name.toUpperCase(), '#9fe0ff', 3);
    },
    benchTick(g, dt) {
      const B = g.lw.bench, now = performance.now();
      const gap = now - B.last; B.last = now;
      B.t += dt;
      if (B.T.shuttle) { B.flipT += dt; if (B.flipT > B.T.flip) { B.flipT = 0; B.wi++; } }
      if (B.t < B.warm) return;
      B.gaps.push(gap);
      // a long gap between frames while the game itself did little: the time went outside the game
      // (the browser's memory clean-up, the graphics driver, another program)
      const work = AS.Prof.lastWork || 0;
      if (gap > 50 && work < 33.4 && (B.slow.length < 3 || gap > B.slow[B.slow.length - 1].ms)) {
        B.slow.push({ ms: Math.round(gap), why: 'outside the game: it worked ' + work.toFixed(0) + ' ms of that frame (browser memory clean-up or graphics driver)' });
        B.slow.sort((a, b) => b.ms - a.ms); B.slow.length = Math.min(B.slow.length, 3);
      }
      const C = g.lw.counts;
      B.maxChunks = Math.max(B.maxChunks, g.terrain.cache.size); B.maxTroops = Math.max(B.maxTroops, C.total); B.maxActive = Math.max(B.maxActive, C.active); B.maxVisible = Math.max(B.maxVisible, C.visible);
      if (B.t >= B.warm + B.T.secs) {
        const s = B.gaps.slice().sort((a, b) => a - b), q = (k) => +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(1);
        const avg = s.reduce((a, b) => a + b, 0) / s.length;
        const r = { test: B.code, name: B.T.name, frames: s.length, fps: +(1000 / avg).toFixed(1), avg: +avg.toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), worst: +s[s.length - 1].toFixed(1),
          over33: s.filter((v) => v > 33.4).length, over50: s.filter((v) => v > 50).length,
          chunks: B.maxChunks, builtOnSpot: (g.terrain.syncN || 0) - B.sync0, terrainStandIns: (g.terrain.standN || 0) - B.stand0,
          troops: B.maxTroops, activeAI: B.maxActive, visible: B.maxVisible, pop: B.T.crowd ? g.lw.benchPop : null,
          slowest: B.slow.map((q) => q.ms + ' ms: ' + (q.why || 'not on the main thread (graphics / browser)')),
          heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
          spriteMB: AS.Forge.memory ? Math.round(AS.Forge.memory().bytes / 1048576) : null, gpu: AS.Perf && AS.Perf.gpu ? AS.Perf.gpu() : null };
        g.lw.benchResults.push(r);
        console.log('LWBENCH ' + JSON.stringify(r));
        AS.Prof.onSlow = null; g.highFlight = false;
        if (B.T.crowd) this.crowd(g, 0, 0, 0);
        g.player.pilot = B.prev;
        g.lw.bench = null;
        this.nextBench(g);
      }
    },
    benchDone(g) {
      const R = g.lw.benchResults;
      window.__lwBench = R;
      const el = document.createElement('div');
      el.id = 'lw-bench';
      el.style.cssText = 'position:fixed;left:50%;top:40px;transform:translateX(-50%);z-index:50;background:rgba(10,8,6,.94);color:#f0e2c0;border:1px solid #c8963a;border-radius:8px;padding:14px 18px;font:13px monospace;white-space:pre;max-height:80vh;overflow:auto';
      const row = (r) => (r.test + ' ' + r.name).padEnd(30) + String(r.fps).padStart(6) + String(r.avg).padStart(7) + String(r.p95).padStart(7) + String(r.p99).padStart(7) + String(r.worst).padStart(8) + String(r.over33).padStart(6) + String(r.chunks).padStart(7) + String(r.builtOnSpot).padStart(6) + String(r.activeAI + '/' + r.troops).padStart(10) + String(r.visible).padStart(6) + String(r.heapMB === null ? '—' : r.heapMB).padStart(6);
      el.textContent = 'LARGE WORLD BENCHMARK  (' + (R[0] && R[0].gpu || 'renderer unknown') + ')\n\n' +
        'test'.padEnd(30) + '   fps  avg ms   p95    p99   worst  >33ms chunks spot  AI/troops  view  heap\n' + R.map(row).join('\n') +
        '\n\nSlowest frames (what the game was busy with):\n' + R.map((r) => r.slowest.length ? r.test + '  ' + r.slowest.join('\n   ') : r.test + '  none over 33 ms').join('\n') +
        '\n\nPhotograph this table (or copy window.__lwBench from the console) and send it back.\nPress Esc to keep flying.';
      document.body.appendChild(el);
      const off = (e) => { if (e.key === 'Escape') { el.remove(); window.removeEventListener('keydown', off); } };
      window.addEventListener('keydown', off);
      g.godMode = !!(AS.App.params && AS.App.params.get('god') === '1');
    },
  };
  AS.LargeWorld = LW;
})(window.AS);
