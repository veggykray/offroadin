/* WYRMCROWN — HUGE WORLD TEST: a generated continent for testing the game at
 * the scale of an 8-10 minute crossing (map.stream: built around the dragon as it
 * flies, src/game/stream.js).
 *
 * 160,000 units square (≈ 40 km at 0.25 m a unit); the continent is ≈ 140,000
 * across, with islands off its coasts. At full sprint (≈ 330 units a second) the
 * dragon needs about 7 minutes to cross the land, at a steady beat (≈ 240) nearly
 * 10. Everything is generated from the seed: coastline, the four realms and the
 * heartland, rivers to the sea, mountain ranges, forests, ~300 places, a road
 * network joining them (with bridges where roads cross rivers), warbands, herds
 * and rune circles. The generator is plain data-making (no terrain needed), so it
 * can grow into the campaign's world generator. */
'use strict';
(function (AS) {
  const U = AS.U, H = AS.Maps.H;
  function generate(seed) {
    const rng = new U.RNG(seed * 2654435761 + 11), W = 160000, C = W / 2;
    const islands = [];
    // the continent: many overlapping blobs over a broad disc (the outer ones make the coast ragged)
    islands.push({ x: C, y: C, r: 20000 });
    for (let i = 0; i < 150; i++) {
      const a = rng.range(0, Math.PI * 2), d = 60000 * Math.sqrt(rng.next()), r = rng.range(8000, 15000) * (1 - d / 150000);
      const x = C + Math.cos(a) * d * 1.05, y = C + Math.sin(a) * d * 0.95;
      if (Math.hypot(x - C, y - C) + r > W * 0.45) continue;
      islands.push({ x, y, r });
    }
    const mainland = islands.length;
    // islands off the coast
    for (let i = 0, made = 0; i < 80 && made < 7; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(W * 0.36, W * 0.44), r = rng.range(2600, 5200);
      const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
      if (islands.slice(0, mainland).some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 2500)) continue;
      islands.push({ x, y, r }); made++;
    }
    // land test without the terrain: well inside some blob
    const landK = (x, y, k) => islands.some((b) => Math.hypot(b.x - x, b.y - y) < b.r * k);
    const land = (x, y) => landK(x, y, 0.72);
    const randLand = (k) => { for (let i = 0; i < 400; i++) { const x = rng.range(4000, W - 4000), y = rng.range(4000, W - 4000); if (landK(x, y, k || 0.72)) return [x, y]; } return [C, C]; };
    // realms: the four quarters and a heartland, broken up by many region seeds
    const regions = [];
    for (let i = 0; i < 46; i++) {
      const [x, y] = randLand(0.9), dx = x - C, dy = y - C, cen = Math.hypot(dx, dy) < 22000;
      const biome = cen || rng.chance(0.12) ? 'neutral' : dx < 0 ? (dy > 0 ? 'human' : 'elf') : (dy > 0 ? 'undead' : 'ice');
      regions.push({ biome, x, y, r: rng.range(7000, 12000) });
    }
    // the sea stays liquid: neutral regions round the coast so ice never freezes a walkway to the islands
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; regions.push({ biome: 'neutral', x: C + Math.cos(a) * W * 0.47, y: C + Math.sin(a) * W * 0.47, r: 9000 }); }
    // rivers: from the uplands out to the sea
    const rivers = [];
    for (let i = 0; i < 11; i++) {
      let [x, y] = randLand(0.5); const pts = [[x, y]];
      let a = Math.atan2(y - C, x - C) + rng.range(-0.6, 0.6);
      for (let s = 0; s < 60; s++) {
        a += rng.range(-0.35, 0.35); x += Math.cos(a) * 1500; y += Math.sin(a) * 1500;
        pts.push([x, y]);
        if (!landK(x, y, 0.98)) { pts.push([x + Math.cos(a) * 2500, y + Math.sin(a) * 2500]); break; }
      }
      if (pts.length > 5) rivers.push({ w: rng.range(80, 140), pts });
    }
    const nearRiver = (x, y, m) => rivers.some((r) => r.pts.some((p, i) => i < r.pts.length - 1 && U.segDist(x, y, p[0], p[1], r.pts[i + 1][0], r.pts[i + 1][1]) < m));
    // mountain ranges
    const mountains = [];
    for (let i = 0; i < 18; i++) {
      let [x, y] = randLand(0.6); const pts = [[x, y]]; let a = rng.range(0, Math.PI * 2);
      for (let s = 0, n = rng.int(3, 7); s < n; s++) { a += rng.range(-0.5, 0.5); x += Math.cos(a) * 2600; y += Math.sin(a) * 2600; if (!land(x, y)) break; pts.push([x, y]); }
      if (pts.length > 1) mountains.push({ w: rng.range(380, 700), h: rng.range(0.7, 1.25), pts });
    }
    const nearRidge = (x, y, m) => mountains.some((r) => r.pts.some((p, i) => i < r.pts.length - 1 && U.segDist(x, y, p[0], p[1], r.pts[i + 1][0], r.pts[i + 1][1]) < r.w + m));
    // forests
    const forests = [];
    for (let i = 0; i < 150; i++) { const [x, y] = randLand(0.8); forests.push({ x, y, r: rng.range(700, 3200), d: rng.range(0.7, 1) }); }
    // the player's castle in the south-west, then the places on a jittered grid
    let castle = null;
    for (let i = 0; i < 400 && !castle; i++) { const x = rng.range(20000, 60000), y = rng.range(100000, 140000); if (landK(x, y, 0.6) && !nearRiver(x, y, 900) && !nearRidge(x, y, 900)) castle = [x, y]; }
    castle = castle || randLand(0.5);
    const KINDS = [['village', 30], ['goldmine', 11], ['watchtower', 9], ['shrine', 5], ['magicwell', 4], ['grove', 4], ['wizardtower', 4], ['ruins', 7], ['cave', 7], ['fort', 7], ['castle', 3], ['nest', 2], ['tradepost', 4]];
    const tot = KINDS.reduce((n, k) => n + k[1], 0);
    const pickKind = () => { let t = rng.next() * tot; for (const [k, w] of KINDS) { t -= w; if (t <= 0) return k; } return 'village'; };
    const POOLS = {
      0: [[['bandit', 3]], [['wolf', 4]], [['bandit', 2], ['wolf', 2]]],
      1: [[['bandit', 5]], [['wolf', 5], ['bear', 1]], [['ogre', 1], ['bandit', 3]]],
      2: [[['ogre', 2], ['bandit', 4]], [['troll', 1], ['wolf', 4]], [['ogre', 1], ['bear', 2], ['bandit', 3]]],
      3: [[['troll', 2], ['ogre', 2], ['giant', 1]], [['giant', 1], ['ogre', 3]], [['troll', 3], ['bandit', 6]]],
    };
    const SYL = ['Ash', 'Bram', 'Cor', 'Dun', 'Elm', 'Fen', 'Gar', 'Hol', 'Kel', 'Lor', 'Mar', 'Nor', 'Oak', 'Pell', 'Rav', 'Sel', 'Thorn', 'Var', 'Wen', 'Yar', 'Brin', 'Cald', 'Ember', 'Frost', 'Gloam', 'Iron', 'Lark', 'Mist', 'Salt', 'Storm', 'Wolf', 'Raven'];
    const END = ['ford', 'holm', 'wick', 'mere', 'stead', 'gate', 'by', 'ton', 'dale', 'moor', 'hollow', 'reach', 'watch', 'crag', 'well', 'brook'];
    const used = new Set();
    const name = () => { for (;;) { const n = rng.pick(SYL) + rng.pick(END); if (!used.has(n)) { used.add(n); return n; } } };
    const sites = [], STEP = 6400;
    for (let gy = STEP / 2; gy < W; gy += STEP) for (let gx = STEP / 2; gx < W; gx += STEP) {
      const x = gx + rng.range(-STEP * 0.35, STEP * 0.35), y = gy + rng.range(-STEP * 0.35, STEP * 0.35);
      if (!land(x, y) || nearRiver(x, y, 700) || nearRidge(x, y, 700) || Math.hypot(x - castle[0], y - castle[1]) < 2600) continue;
      const k = pickKind(), d = Math.hypot(x - castle[0], y - castle[1]);
      let tier = d < 14000 ? 0 : d < 40000 ? 1 : d < 80000 ? 2 : 3;
      if (k === 'fort') tier = Math.max(tier, 2); if (k === 'castle') tier = 3;
      const guarded = !(k === 'village' && tier === 0 && rng.chance(0.6)) && !(k === 'watchtower' && rng.chance(0.5)) && !(k === 'shrine' && rng.chance(0.5));
      const s = { id: 's' + sites.length, k, name: name() + (k === 'fort' ? ' Fort' : k === 'castle' ? ' Castle' : k === 'goldmine' ? ' Mine' : ''), x: Math.round(x), y: Math.round(y) };
      if (guarded) s.guard = rng.pick(POOLS[tier]).map((q) => q.slice());
      sites.push(s);
    }
    // roads: each place joined to its nearest neighbours (a spanning tree plus some loops),
    // never across the sea; where a road crosses a river it does so on a bridge
    // (the castle's roads start at its gate, not inside its walls)
    const nodes = [{ x: castle[0] + Math.cos(-0.6) * 520, y: castle[1] + Math.sin(-0.6) * 520 }].concat(sites);
    const seaBetween = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y); for (let t = 0; t < L; t += 600) { const x = a.x + (b.x - a.x) * t / L, y = a.y + (b.y - a.y) * t / L; if (!landK(x, y, 0.85)) return true; } return false; };
    const edges = [], inTree = new Set([0]), best = nodes.map((n, i) => (i ? [Math.hypot(n.x - nodes[0].x, n.y - nodes[0].y), 0] : [0, -1]));
    // Prim's tree (edges over sea or longer than 14 km are left out: the islands stay roadless)
    for (let it = 1; it < nodes.length; it++) {
      let bi = -1, bd = 1e18;
      for (let i = 0; i < nodes.length; i++) if (!inTree.has(i) && best[i][0] < bd) { bd = best[i][0]; bi = i; }
      if (bi < 0) break;
      inTree.add(bi);
      if (bd < 14000 && !seaBetween(nodes[bi], nodes[best[bi][1]])) edges.push([bi, best[bi][1]]);
      for (let i = 0; i < nodes.length; i++) if (!inTree.has(i)) { const d = Math.hypot(nodes[i].x - nodes[bi].x, nodes[i].y - nodes[bi].y); if (d < best[i][0]) best[i] = [d, bi]; }
    }
    // and each place to its three nearest neighbours, so journeys do not wander far round
    const has = (i, j) => edges.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i));
    for (let i = 0; i < nodes.length; i++) {
      const near = nodes.map((n, j) => [Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y), j]).filter((q) => q[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 3);
      for (const [d, j] of near) if (d < 10000 && !has(i, j) && !seaBetween(nodes[i], nodes[j])) edges.push([i, j]);
    }
    const roads = [], bridges = [];
    const segX = (a, b, c, d) => { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return null; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null; };
    edges.forEach(([i, j], n) => {
      const a = [nodes[i].x, nodes[i].y], b = [nodes[j].x, nodes[j].y], cross = [];
      for (const r of rivers) for (let q = 0; q < r.pts.length - 1; q++) { const t = segX(a, b, r.pts[q], r.pts[q + 1]); if (t !== null) cross.push(t); }
      cross.sort((p, q) => p - q);
      const way = [a];
      for (const t of cross) { const bx = a[0] + (b[0] - a[0]) * t, by = a[1] + (b[1] - a[1]) * t; way.push([bx, by]); bridges.push({ x: Math.round(bx), y: Math.round(by), a: Math.atan2(b[1] - a[1], b[0] - a[0]) }); }
      way.push(b);
      const pts = [];
      for (let q = 0; q < way.length - 1; q++) {
        const L = Math.hypot(way[q + 1][0] - way[q][0], way[q + 1][1] - way[q][1]);
        // (the road runs straight for the last stretch onto each bridge, so its deck lines up)
        const r = L > 900 ? H.road(way[q], way[q + 1], 120, seed + n * 31 + q).pts : [way[q], way[q + 1]];
        pts.push(...(q ? r.slice(1) : r));
      }
      roads.push({ pts });
    });
    // warbands, herds and rune circles
    const encounters = [];
    for (let i = 0; i < 70; i++) {
      const [x, y] = randLand(0.7), d = Math.hypot(x - castle[0], y - castle[1]);
      if (d < 6000) continue;
      const tier = d < 30000 ? 0 : d < 70000 ? 1 : 2;
      const troops = [[['bandit', 8], ['wolf', 3]], [['ogre', 2], ['bandit', 6]], [['troll', 2], ['skeleton', 10], ['ogre', 1]]][tier];
      const e = { id: 'w' + i, name: ['Bandit warband', 'Ogre war party', 'The Grave Host'][tier] + ' ' + (i + 1), x, y, troops: troops.map((q) => q.slice()) };
      if (rng.chance(0.35)) { const [px, py] = [x + rng.range(-5000, 5000), y + rng.range(-5000, 5000)]; if (land(px, py)) e.patrol = [[x, y], [px, py]]; }
      encounters.push(e);
    }
    const WILD = { human: ['deer', 'boar', 'horse'], elf: ['deer', 'boar'], ice: ['goat', 'deer'], undead: ['boar'], neutral: ['deer', 'horse', 'boar'] };
    const biomeAt = (x, y) => { let b = 'neutral', bd = 1e9; for (const r of regions) { const d = Math.hypot(x - r.x, y - r.y) / r.r; if (d < bd) { bd = d; b = r.biome; } } return b; };
    const wild = [];
    for (let i = 0; i < 220; i++) { const [x, y] = randLand(0.7); wild.push({ k: rng.pick(WILD[biomeAt(x, y)]), x, y, n: rng.int(3, 6) }); }
    const runes = [];
    for (let i = 0; i < 90; i++) runes.push(randLand(0.7));
    return {
      id: 'hugeworld', name: 'The Great Continent (Huge World Test)', w: W, h: W, seed: seed % 997, index: 1,
      stream: true, largeWorld: true, sandbox: true, highFlight: true, prefetchAll: true, simR: 3400, tacScale: 128,
      blurb: 'A generated continent about 35 km across, built around the dragon as it flies. A technical test of the game at the scale of an 8-10 minute crossing.',
      difficulty: 'Test',
      regions, factions: { human: { town: { x: castle[0], y: castle[1] }, gate: -0.6 } },
      lakes: [{ x: C, y: C, r: W }], islands, rivers, mountains, forests, roads, bridges, sites, encounters, wild, runes,
    };
  }
  AS.Maps.generateHuge = generate;
  // made when first asked for (a few hundred milliseconds), then kept
  Object.defineProperty(AS.Maps.byId, 'hugeworld', { configurable: true, enumerable: false, get() { const m = generate(+(AS.App && AS.App.params && AS.App.params.get('seed')) || 4242); Object.defineProperty(AS.Maps.byId, 'hugeworld', { value: m, configurable: true, enumerable: false }); return m; } });
})(window.AS);
