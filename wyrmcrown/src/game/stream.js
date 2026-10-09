/* WYRMCROWN — STREAMING for very large maps (map.stream).
 * A battle map is built whole when it loads. A streamed map — tens of kilometres
 * across — is built around the dragon as it flies, and packed away again behind:
 *
 *   ground grids   the terrain's lookup tiles (2 km) under and ahead of the
 *                  dragon are built a few at a time (gfx/realm_terrain.js)
 *   places         villages, mines, forts… keep their state always (owner,
 *                  control, income, guardians left) but their buildings, guards,
 *                  villagers and herds exist only near the dragon (game/sites.js)
 *   areas          4 km squares: scenery, beast lairs, wild herds, small creatures,
 *                  bird flocks and the road surfaces, made when the dragon comes
 *                  near and removed when it is far; an area made again is the same
 *   war map        painted block by block as land comes into view
 *   bridges        built when near
 *
 * The walking grid and long routes (by road) are in game/nav.js; enemy warbands
 * stream in game/largeworld.js. A campaign army (realm.wakePts) holds the world
 * open around it too. */
'use strict';
(function (AS) {
  const CELL = 4096;
  const CELL_LOAD = 5800, CELL_UNLOAD = 8600;     // distance from a centre to the nearest point of an area
  const SITE_LOAD = 5400, SITE_UNLOAD = 8000;     // distance from a centre to a place
  const TAC_R = 11000;                             // war-map blocks painted within this of the dragon

  const Stream = {
    CELL,
    setup(g) {
      const m = g.map, T = g.terrain;
      const S = g.stream = {
        cells: new Map(), loaded: new Set(), sitesLoaded: new Set(), tick: 0, tacDone: new Set(),
        bridges: (m.bridges || []).filter((b) => !b.site).map((b) => ({ b, B: null })),
        siteCells: new Map(), roadRuns: new Map(),
        stats: { cellsMade: 0, cellsDropped: 0, sitesBuilt: 0, sitesPacked: 0, tacBlocks: 0, slowest: 0 },
      };
      for (const s of g.sites) { const k = this.key(Math.floor(s.x / CELL), Math.floor(s.y / CELL)); let a = S.siteCells.get(k); if (!a) { a = []; S.siteCells.set(k, a); } a.push(s); }
      // the roads, cut into runs per area (each area lays its own stretch of road surface)
      for (const pts of T.roadLines || []) {
        let run = [pts[0]], ck = this.key(Math.floor(pts[0][0] / CELL), Math.floor(pts[0][1] / CELL));
        const flush = () => { if (run.length > 1) { let a = S.roadRuns.get(ck); if (!a) { a = []; S.roadRuns.set(ck, a); } a.push(run); } };
        for (let i = 1; i < pts.length; i++) {
          const k = this.key(Math.floor(pts[i][0] / CELL), Math.floor(pts[i][1] / CELL));
          run.push(pts[i]);
          if (k !== ck) { flush(); run = [pts[i - 1], pts[i]]; ck = k; }
        }
        flush();
      }
      if (AS.Scenery) AS.Scenery.initStream(g);
    },
    key(cx, cy) { return cx * 65536 + cy; },
    cell(g, cx, cy) {
      const S = g.stream, k = this.key(cx, cy);
      let C = S.cells.get(k);
      if (!C) { C = { cx, cy, x0: cx * CELL, y0: cy * CELL, x1: (cx + 1) * CELL, y1: (cy + 1) * CELL, live: false }; S.cells.set(k, C); }
      return C;
    },
    // the points the world is built around: the dragon, where it is heading, and any army
    centres(g) {
      const p = g.player, out = this._c || (this._c = []);
      out.length = 0;
      out.push({ x: p.x, y: p.y }, { x: p.x + (p.vx || 0) * 3, y: p.y + (p.vy || 0) * 3 });
      if (g.wakePts) for (const q of g.wakePts) out.push(q);
      return out;
    },
    boxDist(C, x, y) { const dx = Math.max(C.x0 - x, 0, x - C.x1), dy = Math.max(C.y0 - y, 0, y - C.y1); return Math.hypot(dx, dy); },
    nearest(list, x, y, f) { let d = 1e18; for (const q of list) d = Math.min(d, f(q, x, y)); return d; },

    /* ---------------- per frame ---------------- */
    update(g, dt, start) {
      const S = g.stream, T = g.terrain, p = g.player, t0 = performance.now();
      // ground grids: the terrain workers build them well ahead of the dragon; right under it
      // (gameplay asks the terrain about these places now) a missing one is built here, one a frame
      const ax = p.x + (p.vx || 0) * 6, ay = p.y + (p.vy || 0) * 6;
      if (!start) T.requestTiles(Math.min(p.x, ax) - 7000, Math.min(p.y, ay) - 7000, Math.max(p.x, ax) + 7000, Math.max(p.y, ay) + 7000, p.x + (p.vx || 0) * 1.5, p.y + (p.vy || 0) * 1.5);
      T.warmTiles(p.x - 1600, p.y - 1600, p.x + 1600, p.y + 1600, start ? undefined : 0);
      // and under the player's own troops on the march far from the dragon (warbands, carts)
      if (!start && (S.troopT = (S.troopT || 0) - dt) <= 0) {
        S.troopT = 1;
        let n = 0;
        for (const u of g.troops) {
          if (n >= 10 || u.team !== g.playerKey || !u.alive || (u.state !== 'march' && u.state !== 'haul')) continue;
          if (Math.abs(u.x - p.x) < 3000 && Math.abs(u.y - p.y) < 3000) continue;
          T.requestTiles(u.x - 2200, u.y - 2200, u.x + 2200, u.y + 2200, u.x, u.y); n++;
        }
      }
      // the war map, block by block, nearest first
      this.paintTac(g, start ? 400 : 1.2);
      S.tick -= dt;
      if (S.tick > 0 && !start) return this.note(S, t0);
      S.tick = 0.25;
      const cs = this.centres(g);
      // areas
      const cx0 = Math.floor((Math.min(...cs.map((q) => q.x)) - CELL_LOAD) / CELL), cx1 = Math.floor((Math.max(...cs.map((q) => q.x)) + CELL_LOAD) / CELL);
      const cy0 = Math.floor((Math.min(...cs.map((q) => q.y)) - CELL_LOAD) / CELL), cy1 = Math.floor((Math.max(...cs.map((q) => q.y)) + CELL_LOAD) / CELL);
      let budget = start ? 1e9 : 1; // areas made per tick (each one takes a few milliseconds)
      const want = [];
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * CELL >= g.map.w || cy * CELL >= g.map.h) continue;
        const C = this.cell(g, cx, cy);
        if (C.live) continue;
        const d = this.nearest(cs, 0, 0, (q) => this.boxDist(C, q.x, q.y));
        if (d < CELL_LOAD) want.push([d, C]);
      }
      want.sort((a, b) => a[0] - b[0]);
      for (const [, C] of want) {
        if (budget <= 0) break;
        // its ground tiles first (from the workers; after a few seconds' wait, here, one a frame), then the area itself
        if (!start) {
          T.requestTiles(C.x0 - 128, C.y0 - 128, C.x1 + 128, C.y1 + 128);
          C.waitT = C.waitT || g.time;
          if (!T.warmTiles(C.x0 - 128, C.y0 - 128, C.x1 + 128, C.y1 + 128, g.time - C.waitT > 4 ? 0 : -1)) break;
        } else T.warmTiles(C.x0 - 128, C.y0 - 128, C.x1 + 128, C.y1 + 128);
        C.waitT = 0;
        this.makeCell(g, C); budget--;
      }
      for (const k of [...S.loaded]) {
        const C = S.cells.get(k);
        if (this.nearest(cs, 0, 0, (q) => this.boxDist(C, q.x, q.y)) > CELL_UNLOAD) this.dropCell(g, C);
      }
      // places
      let sb = start ? 1e9 : 2;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        for (const s of S.siteCells.get(this.key(cx, cy)) || []) {
          if (s.loaded || sb <= 0) continue;
          if (this.nearest(cs, s.x, s.y, (q, x, y) => Math.hypot(q.x - x, q.y - y)) < SITE_LOAD) {
            if (!start) { T.requestTiles(s.x - 600, s.y - 600, s.x + 600, s.y + 600); s.waitT = s.waitT || g.time; if (!T.warmTiles(s.x - 600, s.y - 600, s.x + 600, s.y + 600, g.time - s.waitT > 4 ? 0 : -1)) continue; }
            else T.warmTiles(s.x - 600, s.y - 600, s.x + 600, s.y + 600);
            s.waitT = 0;
            s.load(); S.sitesLoaded.add(s); S.stats.sitesBuilt++; sb--;
          }
        }
      }
      for (const s of [...S.sitesLoaded]) {
        if (this.nearest(cs, s.x, s.y, (q, x, y) => Math.hypot(q.x - x, q.y - y)) > SITE_UNLOAD && !s.guards.some((u) => u.alive && u.target)) { s.unload(); S.sitesLoaded.delete(s); S.stats.sitesPacked++; }
      }
      this.discover(g);
      // bridges
      for (const r of S.bridges) {
        const d = this.nearest(cs, r.b.x, r.b.y, (q, x, y) => Math.hypot(q.x - x, q.y - y));
        if (!r.B && d < SITE_LOAD) r.B = AS.Sites.bridge(g, r.b, null);
        else if (r.B && d > SITE_UNLOAD) { r.B.alive = false; r.B.removed = true; r.B = null; }
      }
      this.note(S, t0);
    },
    /* the first time the dragon comes near a place it is DISCOVERED (a landmark: fly low over it,
     * and the finder is rewarded). The HUD points to places nearby not yet found. */
    discover(g) {
      const p = g.player, S = g.stream;
      if (p.down > 0) return;
      for (const s of S.sitesLoaded) {
        if (s.found) continue;
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (s.def.landmark ? d > 260 || p.z > 110 : d > Math.max(420, s.capR * 1.6)) continue;
        s.found = true; S.found = (S.found || 0) + 1;
        const kind = s.def.landmark ? 'a landmark' : s.def.name.toLowerCase();
        if (s.def.landmark) {
          const gold = 60 + 30 * Math.min(4, (s.spec.guard ? 2 : 0) + Math.round(Math.hypot(s.x - g.playerFaction.townPos.x, s.y - g.playerFaction.townPos.y) / 25000));
          g.playerFaction.addGold(gold, s.x, s.y, 'loot');
          g.msg('DISCOVERED: ' + s.name.toUpperCase() + ' · FINDER\'S REWARD ' + gold + ' GOLD', '#ffe8a0', 4);
          AS.Audio.sfx('gold_big', { x: s.x, y: s.y });
        } else g.msg('DISCOVERED: ' + s.name.toUpperCase() + ' — ' + kind.toUpperCase(), '#e8dcc0', 3);
        g.news('Discovered ' + s.name + (s.def.landmark ? '' : ' (' + kind + ')') + '.', g.playerKey, false);
      }
    },
    note(S, t0) { const ms = performance.now() - t0; S.lastMs = ms; if (ms > S.stats.slowest) S.stats.slowest = ms; },
    makeCell(g, C) {
      const S = g.stream, T = g.terrain;
      if (!C.roads) {
        C.roads = true;
        for (const run of S.roadRuns.get(this.key(C.cx, C.cy)) || []) {
          // one surface per region along the run, as the whole-map road layer does
          let part = [run[0]], cur = AS.Roads.surface(T, run[0]);
          const flush = (col) => { if (part.length > 1) T.addDecal('road', part[0][0], part[0][1], 28, col, { static: true, pts: part.slice(), w: 28, seed: 7 }); };
          for (let i = 1; i < run.length; i++) { const s = AS.Roads.surface(T, run[i]); part.push(run[i]); if (s !== cur) { flush(cur); part = [run[i]]; cur = s; } }
          flush(cur);
        }
      }
      if (AS.Scenery) AS.Scenery.loadCell(g, C);
      if (AS.Life) AS.Life.loadCell(g, C);
      C.live = true; S.loaded.add(this.key(C.cx, C.cy)); S.stats.cellsMade++;
    },
    dropCell(g, C) {
      const S = g.stream;
      if (AS.Scenery) AS.Scenery.unloadCell(g, C);
      if (AS.Life) AS.Life.unloadCell(g, C);
      C.live = false; S.loaded.delete(this.key(C.cx, C.cy)); S.stats.cellsDropped++;
    },
    // paint war-map blocks near the dragon, nearest first, within a time budget
    paintTac(g, budgetMs) {
      const S = g.stream, T = g.terrain, cv = g.tacMap, p = g.player, B = AS.RealmTerrain.MAPB;
      if (!cv || !T.paintMapBlock) return;
      const t0 = performance.now();
      if (!S.tacList || S.tacFrom === undefined || Math.hypot(p.x - S.tacFrom.x, p.y - S.tacFrom.y) > B) {
        // the blocks to paint, nearest first (refreshed when the dragon has moved a block)
        S.tacFrom = { x: p.x, y: p.y };
        const r = Math.ceil(TAC_R / B), bx = Math.floor(p.x / B), by = Math.floor(p.y / B), list = [];
        for (let j = by - r; j <= by + r; j++) for (let i = bx - r; i <= bx + r; i++) {
          if (i < 0 || j < 0 || i * B >= g.map.w || j * B >= g.map.h || S.tacDone.has(this.key(i, j))) continue;
          const d = Math.hypot((i + 0.5) * B - p.x, (j + 0.5) * B - p.y);
          if (d < TAC_R) list.push([d, i, j]);
        }
        S.tacList = list.sort((a, b) => a[0] - b[0]);
      }
      while (S.tacList.length && performance.now() - t0 < budgetMs) {
        const [, i, j] = S.tacList[0], k = this.key(i, j);
        S.tacList.shift();
        if (S.tacDone.has(k)) continue;
        // only where the ground's lookup tile is already built (the war map never builds tiles itself)
        if (!T.hasTile(i, j)) continue;
        T.paintMapBlock(cv, i, j); S.tacDone.add(k); S.stats.tacBlocks++;
      }
    },
  };
  AS.Stream = Stream;
})(window.AS);
