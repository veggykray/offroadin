/* WYRMCROWN — CONQUEST world generator: a seeded archipelago.
 *
 * Graph first, geography second. A campaign is built as a progression graph
 * whose shape every seed shares —
 *
 *   start zone ─bridge(s)─ early zone ─bridge|fort─ frontier ─road|bridge─ castle zone
 *        ─castle─ harbour zone ═══sea═══ outer islands ═══sea═══ Dragon Lord islands
 *
 * — and whose details every seed changes: the home landmass's style (one big
 * island split by rivers, a chain of islands joined by bridges, a long narrow
 * land, or scattered isles), how many sites each zone holds and of which kinds,
 * who occupies them (bandits, monsters, independents, remnants of the other
 * realms, the Dragon Lords' vassals), which troops they field and offer for
 * hire, how many outer islands there are and how the sea routes join them, and
 * the whole layout's orientation. Then the graph is laid out in space (zones
 * along a path, islands as clusters of blobs, rivers where a bridge crosses
 * land) and named.
 *
 * Gates are nodes: the only ways from one zone into the next pass through its
 * gate sites (bridges, the frontier fort, the castle), and a hostile site has to
 * be beaten before it can be passed, so progression cannot be skipped. Sea
 * routes need a ship. Dragon Lord islands are joined to the outer islands only,
 * never to the home harbour, so the main stronghold always lies beyond the sea.
 *
 * validate() checks every guarantee (see the list there). generate() rebuilds
 * from a derived sub-seed until a world passes; worlds that cannot be fixed are
 * reported, never returned as valid. The same seed always gives the same world.
 *
 * The world is STATIC data: it is regenerated from the seed on load and never
 * saved. What changes in play (owners, garrisons, stock, discovery) lives in
 * the campaign state (core/campaign.js, core/world.js). */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data, U = AS.U;
  const MAX_ATTEMPTS = 16;

  /* ---------------- names ---------------- */
  const SYL_A = ['Ash', 'Bram', 'Cor', 'Dun', 'Elm', 'Fen', 'Gar', 'Hol', 'Ivr', 'Kel', 'Lor', 'Mar', 'Nor', 'Oak', 'Pell', 'Quen', 'Rav', 'Sel', 'Thorn', 'Ul', 'Var', 'Wen', 'Yar', 'Zed', 'Brin', 'Cald', 'Drak', 'Ember', 'Frost', 'Gloam', 'Hearth', 'Iron', 'Kings', 'Lark', 'Mist', 'Night', 'Raven', 'Salt', 'Storm', 'Wolf'];
  const SYL_B = ['ford', 'ton', 'wick', 'mere', 'dale', 'holm', 'by', 'wood', 'stead', 'reach', 'moor', 'fell', 'crag', 'haven', 'brook', 'gate', 'hollow', 'march', 'shaw', 'ley'];
  function namer(rng) {
    const used = new Set();
    const base = () => { for (let i = 0; i < 60; i++) { const n = rng.pick(SYL_A) + rng.pick(SYL_B); if (!used.has(n)) { used.add(n); return n; } } return rng.pick(SYL_A) + rng.int(2, 99); };
    return (kind, extra) => {
      const b = base();
      switch (kind) {
        case 'farm': return b + ' Farm';
        case 'tower': return b + ' Watch';
        case 'village': return b;
        case 'bridge': return b + ' Bridge';
        case 'mine': return b + ' Mine';
        case 'fort': return 'Fort ' + b;
        case 'castle': return b + ' Castle';
        case 'harbour': return b + ' Harbour';
        case 'landing': return b + ' Cove';
        case 'stronghold': return b + ' Hold';
        case 'ruins': return 'Ruins of ' + b;
        case 'lair': return (D.lairs[extra] ? D.lairs[extra].name : 'Lair') + ' of ' + b;
        case 'lordhold': return 'Dragonspire of ' + b;
        case 'island': return rng.chance(0.5) ? 'Isle of ' + b : b + ' Isles';
        default: return b;
      }
    };
  }

  /* ---------------- armies ---------------- */
  const TIER_MAX_LEAD = { 0: 14, 1: 25, 2: 60, 3: 80, 4: 80, 5: 140, 6: 999, 7: 999 };
  const strength = (stacks) => { let n = 0; for (const [id, c] of stacks || []) { const t = D.troops[id]; if (t) n += t.leadership * c; } return n; };
  const units = (stacks) => { let n = 0; for (const s of stacks || []) n += s[1]; return n; };
  // troop types an occupier fields at a tier
  function pool(owner, tier, kind, lair) {
    const T = D.troopList, maxL = TIER_MAX_LEAD[tier];
    const ok = (t) => t.leadership <= maxL && t.gen !== null;
    if (kind === 'lair' && lair && D.lairs[lair]) return D.lairs[lair].troops.map((id) => D.troops[id]).filter((t) => t && (t.leadership <= maxL || tier >= 5));
    if (owner === 'neutral') return T.filter((t) => t.allegiance === 'neutral' && ok(t) && (tier >= 5 || !['giant'].includes(t.tag)));
    if (owner === 'independent') return T.filter((t) => ok(t) && (t.id === 'n_bandit' || t.id === 'n_wolf' || t.id === 'n_ogre' || t.id === 'n_troll' || t.id === 'n_hillgiant' || (t.allegiance === 'human' && t.id !== 'h_siege')));
    // a realm: its own troops and the neutral creatures that would serve it
    return T.filter((t) => ok(t) && (t.allegiance === owner || (t.allegiance === 'neutral' && t.tag && D.allegiances[owner].neutralCost[t.tag] !== null && D.allegiances[owner].neutralCost[t.tag] !== undefined && tier >= 3 && t.tag !== 'beast')));
  }
  function army(rng, owner, tier, kind, lair, hi) {
    const [lo, hiB] = D.world.budget[tier];
    const B = hi ? U.lerp(lo, hiB, 0.55 + rng.next() * 0.45) : U.lerp(lo, hiB, rng.next() * 0.8);
    let types = pool(owner, tier, kind, lair);
    if (!types.length) types = pool('neutral', tier, kind, null);
    const bias = tier <= 1 ? 0.3 : tier <= 3 ? 0.7 : 1.1;   // later tiers favour heavier troops (fewer, stronger units)
    const count = {}; let sum = 0, n = 0;
    for (let guard = 0; guard < 200 && sum < B && n < D.world.maxUnits; guard++) {
      const fit = types.filter((t) => sum + t.leadership <= B * 1.12 || n === 0);
      if (!fit.length) break;
      let tot = 0; const w = fit.map((t) => { const v = Math.pow(t.leadership, bias); tot += v; return v; });
      let r = rng.next() * tot, pick = fit[0];
      for (let i = 0; i < fit.length; i++) { r -= w[i]; if (r <= 0) { pick = fit[i]; break; } }
      count[pick.id] = (count[pick.id] || 0) + 1; sum += pick.leadership; n++;
    }
    return Object.keys(count).sort().map((id) => [id, count[id]]);
  }
  // what a recruitment site offers a player of this allegiance, and how many of each
  function offer(allegiance, rkind, tier) {
    const T = D.troopList, any = D.recruitSites[rkind] && D.recruitSites[rkind].owner === 'any';
    const K = { 0: 50, 1: 60, 2: 90, 3: 160, 4: 120, 5: 260, 6: 300, 7: 300 }[tier];
    const out = {};
    for (const t of T) {
      if (!t.sites.includes(rkind)) continue;
      if (any ? t.allegiance !== allegiance : t.allegiance !== 'neutral') continue;
      if (!C.Rules.recruitTerms(allegiance, t.id).ok) continue;
      if (D.lairs[rkind] && !D.lairs[rkind].troops.includes(t.id)) continue;
      out[t.id] = Math.max(1, Math.min(12, Math.round(K / t.leadership)));
    }
    return out;
  }
  // the first recruitment kind in the list that offers this allegiance anything
  function recruitKind(allegiance, kinds, tier) {
    for (const k of kinds) if (Object.keys(offer(allegiance, k, tier)).length) return k;
    return null;
  }

  /* ---------------- geometry helpers ---------------- */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function scatter(rng, n, cx, cy, r, minD, avoid) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      let best = null, bd = -1;
      for (let k = 0; k < 40; k++) {
        const a = rng.next() * U.TAU, rr = Math.sqrt(rng.next()) * r;
        const p = { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
        let md = 1e9; for (const q of pts.concat(avoid || [])) md = Math.min(md, dist(p, q));
        if (md >= minD) { best = p; break; }
        if (md > bd) { bd = md; best = p; }
      }
      pts.push(best);
    }
    return pts;
  }
  // minimum spanning tree (Prim) over a list of nodes: [[i, j], …]
  function mst(nodes) {
    const n = nodes.length, inT = new Array(n).fill(false), out = [];
    if (!n) return out;
    inT[0] = true;
    for (let k = 1; k < n; k++) {
      let bi = -1, bj = -1, bd = 1e18;
      for (let i = 0; i < n; i++) if (inT[i]) for (let j = 0; j < n; j++) if (!inT[j]) { const d = dist(nodes[i], nodes[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
      inT[bj] = true; out.push([bi, bj]);
    }
    return out;
  }

  /* ---------------- the build ---------------- */
  function build(sub, seed, o) {
    const rng = new U.RNG(sub ^ 0x2545f491);
    const name = namer(rng);
    const alleg = o.allegiance, lords = o.lords;
    const W = D.world.size.w, H = D.world.size.h;
    const style = rng.pick(['mainland', 'chain', 'long', 'isles']);
    const realms = D.realmKeys.filter((k) => k !== alleg);
    const lordKeys = lords.map((l) => l.allegiance);
    const sites = [], routes = [], islands = [], rivers = [];
    let sid = 0;
    const add = (o2) => { const s = Object.assign({ id: 's' + (sid++), recruit: null, garrison: [], income: 0, reward: null }, o2); sites.push(s); return s; };
    const link = (a, b, type) => { if (a !== b && !routes.some((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) routes.push({ a: a.id, b: b.id, type }); };

    // ---- the home landmass: five zones along a path, in a local frame (x grows toward the sea and the Lords)
    const zplan = [
      { tier: 0, n: rng.int(3, 4) }, { tier: 1, n: rng.int(3, 4) }, { tier: 2, n: rng.int(3, 5) }, { tier: 3, n: rng.int(2, 3) }, { tier: 4, n: rng.int(1, 2) },
    ];
    // what joins zone i to zone i+1
    const gates = [
      { kind: 'bridge', n: rng.chance(0.55) ? 2 : 1 },
      rng.chance(0.5) ? { kind: 'bridge', n: 1 } : { kind: 'fort', n: 1 },
      rng.chance(0.5) ? { kind: 'road', n: 1 } : { kind: 'bridge', n: 1 },
      { kind: 'castle', n: 1 },
    ];
    // which boundaries are a strait between islands (else a river on one island)
    const strait = gates.map((gt) => {
      if (gt.kind !== 'bridge') return false;
      if (style === 'mainland' || style === 'long') return false;
      if (style === 'isles') return true;
      return rng.chance(0.6);
    });
    let x = 0, y = 0, heading = rng.range(-0.5, 0.5);
    const zones = [];
    for (let i = 0; i < zplan.length; i++) {
      const zr = 96 + zplan[i].n * 10;
      zones.push(Object.assign({ x, y, r: zr }, zplan[i]));
      if (i === zplan.length - 1) break;
      const step = strait[i] ? 380 : style === 'mainland' ? 205 : style === 'long' ? 225 : 240;
      const turn = style === 'mainland' ? rng.range(0.4, 0.9) * (i % 2 ? -1 : 1) : style === 'long' ? rng.range(-0.15, 0.15) : rng.range(-0.6, 0.6);
      heading += turn;
      if (Math.cos(heading) < 0.25) heading = Math.sign(heading || 1) * 1.3; // keep moving toward the sea overall
      x += Math.cos(heading) * step; y += Math.sin(heading) * step;
    }
    // islands of the home landmass
    let isl = 0; const zIsland = [0];
    for (let i = 0; i < strait.length; i++) zIsland.push(strait[i] ? ++isl : isl);
    for (let k = 0; k <= isl; k++) islands.push({ id: 'i' + k, kind: 'home', name: name('island'), blobs: [], tier: k === 0 ? 0 : zones[zIsland.indexOf(k)].tier });
    zones.forEach((z, i) => {
      const I = islands[zIsland[i]];
      I.blobs.push({ x: z.x, y: z.y, r: z.r + 34 });
      if (i > 0 && !strait[i - 1]) { const p = zones[i - 1]; I.blobs.push({ x: (p.x + z.x) / 2, y: (p.y + z.y) / 2, r: (p.r + z.r) / 2 + 26 }); }
    });

    // ---- occupiers: who holds each home zone
    const occupier = (tier) => {
      const r = rng.next();
      if (tier === 0) return r < 0.6 ? 'neutral' : 'independent';
      if (r < 0.3) return 'independent';
      if (r < 0.5) return 'neutral';
      if (r < 0.75 && lordKeys.length) return rng.pick(lordKeys); // a Dragon Lord's vassals reach this far
      return rng.pick(realms);                                    // remnants of another realm
    };

    // ---- sites of the home zones
    const zoneSites = zones.map(() => []);
    const homeKinds = {
      0: ['farm', 'tower', 'lair', 'farm', 'ruins'],
      1: ['village', 'farm', 'lair', 'tower', 'ruins', 'mine'],
      2: ['mine', 'village', 'lair', 'fort', 'farm', 'ruins', 'tower'],
      3: ['village', 'mine', 'farm', 'fort'],
      4: ['farm', 'tower', 'village'],
    };
    zones.forEach((z, zi) => {
      const occ = occupier(z.tier);
      const kinds = [];
      if (zi === 0) kinds.push('start', 'farm');
      if (zi === 1) kinds.push('village');
      if (zi === 2) kinds.push(rng.chance(0.5) ? 'mine' : 'fort');
      if (zi === 3) kinds.push('castle');
      if (zi === 4) kinds.push('harbour');
      const extra = homeKinds[z.tier].slice();
      while (kinds.length < z.n) kinds.push(extra.splice(rng.int(0, extra.length - 1), 1)[0] || 'farm');
      const pts = scatter(rng, kinds.length, z.x, z.y, z.r * 0.8, 72);
      // the start sits on the far side from the next zone; the gate sites on the near side
      kinds.forEach((k, i) => {
        const p = pts[i];
        let s;
        if (k === 'start') {
          s = add({ kind: 'village', start: true, tier: 0, owner: 'player', x: p.x, y: p.y, name: name('village') });
          s.recruit = 'village'; s.stock = offer(alleg, 'village', 0);
        } else {
          const lair = k === 'lair' ? rng.pick(Object.keys(D.lairs).filter((q) => D.lairs[q].tier <= z.tier)) : null;
          const owner = k === 'lair' || k === 'ruins' ? 'neutral' : (k === 'castle' && lordKeys.length && rng.chance(0.6)) ? rng.pick(lordKeys) : occ;
          s = add({ kind: k, tier: z.tier, owner, x: p.x, y: p.y, name: name(k, lair), lair });
          // a few villages beyond the start welcome the player: hire there, but they are not yours
          if (k === 'village' && z.tier >= 1 && z.tier <= 2 && rng.chance(0.3)) { s.owner = 'free'; }
          const gateish = k === 'castle' || k === 'harbour' || k === 'fort';
          s.garrison = s.owner === 'free' ? [] : army(rng, owner, z.tier, k, lair, gateish);
          // recruitment
          if (k === 'lair') { s.recruit = lair; s.stock = offer(alleg, lair, z.tier); }
          else if (k === 'village') { s.recruit = 'village'; s.stock = offer(alleg, 'village', z.tier); }
          else if (k === 'fort') { s.recruit = recruitKind(alleg, ['barracks', 'archery_range'], z.tier); }
          else if (k === 'castle') { s.recruit = recruitKind(alleg, ['knight_barracks', 'stables', 'archery_range', 'barracks'], z.tier); }
          else if (k === 'tower' && rng.chance(0.5)) { s.recruit = recruitKind(alleg, ['archery_range'], z.tier); }
          else if (k === 'mine' && z.tier >= 2 && rng.chance(0.35)) { s.recruit = recruitKind(alleg, ['stables', 'workshop'], z.tier); }
          if (s.recruit && !s.stock) s.stock = offer(alleg, s.recruit, z.tier);
        }
        s.zone = zi; s.island = islands[zIsland[zi]].id;
        zoneSites[zi].push(s);
      });
      // roads inside the zone: a spanning tree and, sometimes, a loop
      const ss = zoneSites[zi];
      for (const [i, j] of mst(ss)) link(ss[i], ss[j], 'road');
      if (ss.length >= 3 && rng.chance(0.6)) {
        let best = null, bd = 1e9;
        for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) if (!routes.some((r) => (r.a === ss[i].id && r.b === ss[j].id) || (r.a === ss[j].id && r.b === ss[i].id))) { const d = dist(ss[i], ss[j]); if (d < bd) { bd = d; best = [ss[i], ss[j]]; } }
        if (best) link(best[0], best[1], 'road');
      }
      // the start always opens onto its farm and has a second way out
      if (zi === 0) {
        const st = ss.find((q) => q.start), farm = ss.find((q) => q.kind === 'farm');
        link(st, farm, 'road');
        const other = ss.filter((q) => q !== st && q !== farm).sort((a, b) => dist(a, st) - dist(b, st))[0];
        if (other) link(st, other, 'road');
      }
    });
    // the castle is the only way into the harbour zone: move it to the zone's edge facing the harbour
    const castle = zoneSites[3].find((s) => s.kind === 'castle');
    // ---- gates between zones
    for (let i = 0; i < gates.length; i++) {
      const A = zones[i], B = zones[i + 1], gt = gates[i];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ang = Math.atan2(B.y - A.y, B.x - A.x);
      const nearest = (list, p) => list.reduce((b, s) => (!b || dist(s, p) < dist(b, p) ? s : b), null);
      if (gt.kind === 'castle') {
        // castle sits between the castle zone and the harbour zone
        castle.x = U.lerp(A.x, B.x, 0.42); castle.y = U.lerp(A.y, B.y, 0.42);
        for (const s of zoneSites[3]) if (s !== castle && dist(s, castle) < 50) { s.x -= Math.cos(ang) * 50; s.y -= Math.sin(ang) * 50; }
        // castle zone roads were built before the move: keep them, then the only link onward
        link(castle, nearest(zoneSites[4], castle), 'road');
        continue;
      }
      if (gt.kind === 'road') { link(nearest(zoneSites[i], B), nearest(zoneSites[i + 1], A), 'road'); continue; }
      for (let k = 0; k < gt.n; k++) {
        const off = gt.n > 1 ? (k ? 1 : -1) * 70 : rng.range(-25, 25);
        const p = { x: mx + Math.cos(ang + Math.PI / 2) * off, y: my + Math.sin(ang + Math.PI / 2) * off };
        const tier = gt.kind === 'fort' ? 2 : B.tier;
        const occ = rng.chance(0.5) ? 'independent' : rng.pick(realms);
        const s = add({ kind: gt.kind, tier, owner: occ, x: p.x, y: p.y, name: name(gt.kind), gate: true });
        s.garrison = army(rng, occ, tier, gt.kind, null, true);
        if (gt.kind === 'fort') s.recruit = recruitKind(alleg, ['barracks', 'archery_range'], tier), s.stock = s.recruit ? offer(alleg, s.recruit, tier) : null;
        s.zone = i + 0.5; s.island = islands[zIsland[i + 1]].id;
        link(s, nearest(zoneSites[i], p), gt.kind === 'bridge' ? 'bridge' : 'road');
        link(s, nearest(zoneSites[i + 1], p), gt.kind === 'bridge' ? 'bridge' : 'road');
        if (gt.kind === 'bridge' && !strait[i]) {
          // a river runs across the land here; the bridge crosses it
          const L = (A.r + B.r) * 1.15, nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
          if (k === 0) rivers.push({ pts: [[mx - nx * L - Math.cos(ang) * 20, my - ny * L - Math.sin(ang) * 20], [mx + rng.range(-12, 12), my + rng.range(-12, 12)], [mx + nx * L + Math.cos(ang) * 20, my + ny * L + Math.sin(ang) * 20]] });
        }
        if (gt.kind === 'fort') { const I = islands[zIsland[i]]; I.blobs.push({ x: p.x, y: p.y, r: 60 }); }
      }
    }
    const harbour = zoneSites[4].find((s) => s.kind === 'harbour');
    const start = zoneSites[0].find((s) => s.start);
    // the harbour sits on the coast, facing the sea
    harbour.x += Math.cos(heading) * 30; harbour.y += Math.sin(heading) * 30;

    // ---- outer islands
    const nOuter = Math.min(5, rng.int(2, 4) + (lords.length > 1 ? 1 : 0));
    const last = zones[zones.length - 1];
    const outer = [];
    for (let k = 0; k < nOuter; k++) {
      const spread = nOuter > 1 ? (k / (nOuter - 1) - 0.5) : 0;
      const a = heading + spread * 2.4 + rng.range(-0.2, 0.2);
      const d = rng.range(420, 560) + (k % 2) * 110;
      const n = rng.int(3, 4);
      outer.push({ c: { x: last.x + Math.cos(a) * d, y: last.y + Math.sin(a) * d }, r: 100 + n * 10, n });
    }
    const lordC = lords.map((L, k) => {
      const spread = lords.length > 1 ? (k / (lords.length - 1) - 0.5) : rng.range(-0.25, 0.25);
      const a = heading + spread * 1.8, d = rng.range(1050, 1200) + (k === 0 ? 140 : 0);
      return { c: { x: last.x + Math.cos(a) * d, y: last.y + Math.sin(a) * d }, r: 140 };
    });
    // keep the islands apart from each other and from the home landmass
    const isl2 = outer.concat(lordC);
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < isl2.length; i++) {
        const A = isl2[i];
        for (let j = i + 1; j < isl2.length; j++) {
          const B = isl2[j], d = dist(A.c, B.c), m = A.r + B.r + 110;
          if (d < m) { const dx = (B.c.x - A.c.x) / (d || 1), dy = (B.c.y - A.c.y) / (d || 1), push = (m - d) / 2; A.c.x -= dx * push; A.c.y -= dy * push; B.c.x += dx * push; B.c.y += dy * push; }
        }
        for (const z of zones) {
          const d = dist(A.c, z), m = A.r + z.r + 150;
          if (d < m) { const dx = (A.c.x - z.x) / (d || 1), dy = (A.c.y - z.y) / (d || 1); A.c.x += dx * (m - d); A.c.y += dy * (m - d); }
        }
      }
    }
    for (const O of outer) {
      const I = { id: 'i' + islands.length, kind: 'outer', name: name('island'), blobs: [{ x: O.c.x, y: O.c.y, r: O.r + 34 }], tier: 5 };
      if (rng.chance(0.5)) I.blobs.push({ x: O.c.x + rng.range(-50, 50), y: O.c.y + rng.range(-50, 50), r: O.r * 0.7 });
      islands.push(I); O.I = I;
    }
    const outerKinds = ['stronghold', 'lair', 'lair', 'mine', 'village', 'fort', 'ruins'];
    let strongholds = 0;
    outer.forEach((O, k) => {
      const kinds = ['landing'];
      if (k === 0 || (strongholds < 2 && rng.chance(0.5))) { kinds.push('stronghold'); strongholds++; }
      const ex = outerKinds.filter((q) => q !== 'stronghold');
      while (kinds.length < O.n) kinds.push(ex.splice(rng.int(0, ex.length - 1), 1)[0]);
      const occ = rng.chance(0.4) ? 'independent' : rng.pick(realms);
      const pts = scatter(rng, kinds.length, O.c.x, O.c.y, O.r * 0.75, 70);
      // the landing faces home
      const toHome = Math.atan2(last.y - O.c.y, last.x - O.c.x);
      pts[0] = { x: O.c.x + Math.cos(toHome) * O.r * 0.8, y: O.c.y + Math.sin(toHome) * O.r * 0.8 };
      const list = kinds.map((kd, i) => {
        const lair = kd === 'lair' ? rng.pick(Object.keys(D.lairs).filter((q) => D.lairs[q].tier >= 2 && D.lairs[q].tier <= 6)) : null;
        const owner = kd === 'lair' || kd === 'ruins' ? 'neutral' : kd === 'landing' ? (rng.chance(0.5) ? 'neutral' : occ) : occ;
        const s = add({ kind: kd, tier: 5, owner, x: pts[i].x, y: pts[i].y, name: name(kd, lair), lair, zone: 10 + k, island: O.I.id });
        s.garrison = army(rng, owner, kd === 'landing' ? 4 : 5, kd, lair, kd === 'stronghold');
        if (kd === 'stronghold') { s.garrison = army(rng, owner, 6, kd, null, false); s.recruit = recruitKind(alleg, ['knight_barracks', 'stables', 'workshop', 'archery_range', 'barracks'], 5); }
        if (kd === 'lair') s.recruit = lair;
        if (kd === 'village') s.recruit = 'village';
        if (kd === 'fort') s.recruit = recruitKind(alleg, ['barracks', 'archery_range'], 5);
        if (s.recruit) s.stock = offer(alleg, s.recruit, 5);
        return s;
      });
      for (const [i, j] of mst(list)) link(list[i], list[j], 'road');
      O.landing = list[0]; O.sites = list;
    });

    // ---- the Dragon Lords' islands (beyond the outer islands)
    const lordIsles = [];
    lords.forEach((L, k) => {
      const c = lordC[k].c, r = lordC[k].r;
      const I = { id: 'i' + islands.length, kind: 'lord', lord: L.id, name: name('island'), blobs: [{ x: c.x, y: c.y, r: r + 40 }, { x: c.x + rng.range(-60, 60), y: c.y + rng.range(-60, 60), r: r * 0.8 }], tier: 6 };
      islands.push(I);
      const kinds = ['landing', 'fort', rng.chance(0.5) ? 'village' : 'mine', 'lordhold'];
      const pts = scatter(rng, kinds.length, c.x, c.y, r * 0.7, 72);
      const toHome = Math.atan2(last.y - c.y, last.x - c.x);
      pts[0] = { x: c.x + Math.cos(toHome) * r * 0.85, y: c.y + Math.sin(toHome) * r * 0.85 };
      pts[3] = { x: c.x - Math.cos(toHome) * r * 0.45, y: c.y - Math.sin(toHome) * r * 0.45 };
      const list = kinds.map((kd, i) => {
        const tier = kd === 'lordhold' ? 7 : 6;
        const s = add({ kind: kd, tier, owner: L.allegiance, x: pts[i].x, y: pts[i].y, name: kd === 'lordhold' ? name('lordhold') : name(kd), zone: 20 + k, island: I.id, lord: L.id });
        s.garrison = army(rng, L.allegiance, tier, kd, null, kd !== 'village');
        if (kd === 'lordhold') { s.final = k === 0; s.recruit = null; }
        if (kd === 'fort') { s.recruit = recruitKind(alleg, ['knight_barracks', 'barracks'], 6); if (s.recruit) s.stock = offer(alleg, s.recruit, 6); }
        return s;
      });
      // the fortress is reached through the island's fort or its second holding, never straight from the landing
      link(list[0], list[1], 'road'); link(list[0], list[2], 'road'); link(list[1], list[3], 'road'); link(list[2], list[3], 'road');
      lordIsles.push({ I, landing: list[0], hold: list[3], L });
    });

    // ---- sea routes: home harbour → nearest outer landings; outer landings chained; Lord islands from the outer landings only
    const byD = (p, list) => list.slice().sort((a, b) => dist(a, p) - dist(b, p));
    const landings = outer.map((O) => O.landing);
    for (const s of byD(harbour, landings).slice(0, Math.min(2, landings.length))) link(harbour, s, 'sea');
    for (const [i, j] of mst(landings)) link(landings[i], landings[j], 'sea');
    for (const LI of lordIsles) for (const s of byD(LI.landing, landings).slice(0, rng.chance(0.5) ? 2 : 1)) link(LI.landing, s, 'sea');

    // ---- rewards and incomes
    for (const s of sites) {
      const K = D.territories[s.kind] || D.territories.village;
      s.income = K.income;
      if (s.start) continue;
      const tg = D.world.reward.gold[s.tier];
      s.reward = { gold: Math.round(U.lerp(tg[0], tg[1], rng.next()) / 5) * 5, leadership: D.world.reward.leadership[s.tier] + (s.kind === 'stronghold' || s.kind === 'lordhold' ? D.world.reward.stronghold : 0) };
    }

    // ---- spread out sites that ended up crowded (gates between zones, the moved castle)
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
        const a = sites[i], b = sites[j], d = dist(a, b);
        if (d < 60) { const dx = (b.x - a.x) / (d || 1), dy = (b.y - a.y) / (d || 1), push = (60 - d) / 2 + 0.5; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; moved = true; }
      }
      if (!moved) break;
    }

    // ---- fit the local frame into the map, turned to a random orientation
    const rot = rng.next() * U.TAU, cs = Math.cos(rot), sn = Math.sin(rot);
    const pts = [];
    for (const s of sites) pts.push(s);
    for (const I of islands) for (const b of I.blobs) pts.push(b);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const tr = (p) => { const X = p.x * cs - p.y * sn, Y = p.x * sn + p.y * cs; p.x = X; p.y = Y; };
    for (const p of pts) tr(p);
    for (const R of rivers) for (const q of R.pts) { const X = q[0] * cs - q[1] * sn, Y = q[0] * sn + q[1] * cs; q[0] = X; q[1] = Y; }
    for (const I of islands) for (const b of I.blobs) { x0 = Math.min(x0, b.x - b.r); y0 = Math.min(y0, b.y - b.r); x1 = Math.max(x1, b.x + b.r); y1 = Math.max(y1, b.y + b.r); }
    const M = 60, k = Math.min((W - M * 2) / (x1 - x0), (H - M * 2) / (y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const fit = (p) => { p.x = Math.round((p.x - x0) * k + ox); p.y = Math.round((p.y - y0) * k + oy); };
    for (const p of pts) fit(p);
    for (const I of islands) for (const b of I.blobs) b.r = Math.round(b.r * k);
    for (const R of rivers) for (const q of R.pts) { q[0] = Math.round((q[0] - x0) * k + ox); q[1] = Math.round((q[1] - y0) * k + oy); }

    return {
      gen: D.world.GEN_VERSION, seed, sub, style, w: W, h: H, scale: +k.toFixed(3),
      islands, sites, routes, rivers,
      start: start.id, castle: castle.id, harbour: harbour.id,
      final: lordIsles[0].hold.id,
      lords: lordIsles.map((LI) => ({ id: LI.L.id, allegiance: LI.L.allegiance, island: LI.I.id, stronghold: LI.hold.id, primary: LI === lordIsles[0] })),
      gates: { bridges: sites.filter((s) => s.kind === 'bridge').map((s) => s.id), firstBridges: sites.filter((s) => s.kind === 'bridge' && s.zone === 0.5).map((s) => s.id) },
    };
  }

  /* ---------------- graph queries ---------------- */
  function index(w) {
    if (w._ix) return w._ix;
    const byId = {}, adj = {};
    for (const s of w.sites) { byId[s.id] = s; adj[s.id] = []; }
    for (const r of w.routes) { if (adj[r.a]) adj[r.a].push({ to: r.b, type: r.type }); if (adj[r.b]) adj[r.b].push({ to: r.a, type: r.type }); }
    Object.defineProperty(w, '_ix', { value: { byId, adj }, enumerable: false, configurable: true });
    return w._ix;
  }
  // ids reachable from `from`; opt.sea: sea routes allowed; opt.without: a Set of node ids that cannot be entered
  function reach(w, from, opt) {
    opt = opt || {};
    const { adj } = index(w), seen = new Set([from]), q = [from];
    while (q.length) {
      const c = q.shift();
      for (const e of adj[c] || []) {
        if (seen.has(e.to)) continue;
        if (e.type === 'sea' && !opt.sea) continue;
        if (opt.without && opt.without.has(e.to)) continue;
        seen.add(e.to); q.push(e.to);
      }
    }
    return seen;
  }

  /* ---------------- validation: every guarantee, checked ---------------- */
  function validate(w, o) {
    const P = [];
    const { byId, adj } = index(w);
    const ids = new Set();
    for (const s of w.sites) { if (ids.has(s.id)) P.push('duplicate id ' + s.id); ids.add(s.id); }
    for (const r of w.routes) if (!byId[r.a] || !byId[r.b]) P.push('route to nowhere');
    const start = byId[w.start];
    // 1. start
    if (!start || start.owner !== 'player') { P.push('no start'); return P; }
    // 2. starter recruitment at the start (the player's own allegiance)
    if (!start.recruit || !start.stock || !Object.keys(start.stock).length) P.push('no starter recruitment');
    // 3. starter income within one move, lightly held
    const lightMax = D.world.budget[0][1];
    const nb = adj[start.id].map((e) => byId[e.to]);
    if (!nb.some((s) => s.income > 0 && s.tier === 0 && strength(s.garrison) <= lightMax)) P.push('no starter income');
    // 4. not trapped: two ways out, at least one of them weak
    if (nb.length < 2) P.push('start has one exit');
    if (!nb.some((s) => strength(s.garrison) <= lightMax)) P.push('start trapped behind strong sites');
    // 5. bridge progression: the first bridges are the only way into the early zone
    const fb = new Set(w.gates.firstBridges);
    if (!fb.size) P.push('no first bridge');
    const zone1 = w.sites.filter((s) => s.zone === 1);
    const noBridges = reach(w, start.id, { without: fb });
    if (zone1.some((s) => noBridges.has(s.id))) P.push('early zone reachable without a bridge');
    const land = reach(w, start.id);
    if (!zone1.every((s) => land.has(s.id))) P.push('early zone unreachable');
    // 6. castle progression: the castle is the only way to the harbour
    if (!byId[w.castle] || byId[w.castle].kind !== 'castle') P.push('no castle');
    if (reach(w, start.id, { without: new Set([w.castle]) }).has(w.harbour)) P.push('harbour reachable without the castle');
    if (!land.has(w.castle)) P.push('castle unreachable');
    // 7. harbour reachable by land
    if (!byId[w.harbour] || !land.has(w.harbour)) P.push('harbour unreachable by land');
    // 8. a ship can be had: the harbour is a kind ships are sold at, and it pays its way
    if (!D.world.ship.needs.includes(byId[w.harbour] && byId[w.harbour].kind)) P.push('harbour cannot sell a ship');
    if (!(D.world.ship.cost > 0 && Number.isFinite(D.world.ship.cost))) P.push('bad ship cost');
    // 9. a sea route from the harbour
    if (!adj[w.harbour].some((e) => e.type === 'sea')) P.push('no sea route from the harbour');
    // 10–11. the Lords: reachable by sea, never by land
    const all = reach(w, start.id, { sea: true });
    for (const L of w.lords) {
      if (!byId[L.stronghold] || byId[L.stronghold].kind !== 'lordhold') P.push('lord without fortress');
      else if (!all.has(L.stronghold)) P.push('fortress unreachable');
      if (land.has(L.stronghold)) P.push('fortress reachable without sea');
    }
    if (!byId[w.final] || !byId[w.final].final) P.push('no final stronghold');
    if (w.lords.filter((L) => L.primary).length !== 1) P.push('not exactly one primary lord');
    // 12–13. nothing isolated
    for (const s of w.sites) if (!all.has(s.id)) { P.push('isolated ' + s.kind); break; }
    // 14. owners
    for (const s of w.sites) if (!(s.owner === 'player' || s.owner === 'free' || D.allegiances[s.owner])) { P.push('bad owner ' + s.owner); break; }
    for (const s of w.sites) if (s.lord) { const L = w.lords.find((q) => q.id === s.lord); if (!L || s.owner !== L.allegiance) { P.push('lord land held by another'); break; } }
    if (w.sites.some((s) => s.owner === o.allegiance)) P.push('a site belongs to the player\'s own realm');
    // 15–16. armies and stock
    for (const s of w.sites) {
      for (const st of s.garrison) if (!D.troops[st[0]] || !(Number.isInteger(st[1]) && st[1] > 0)) { P.push('bad garrison at ' + s.id); break; }
      if (units(s.garrison) > D.world.maxUnits) P.push('oversized garrison at ' + s.id);
      if (s.owner !== 'player' && s.owner !== 'free' && !s.garrison.length) P.push('unguarded hostile ' + s.kind);
      if (s.stock) for (const id in s.stock) if (!D.troops[id] || !(s.stock[id] > 0)) { P.push('bad stock at ' + s.id); break; }
      if (s.recruit && !D.recruitSites[s.recruit]) P.push('bad recruitment kind');
    }
    // the threat grows with the tiers (averages)
    const avg = (t) => { const L = w.sites.filter((s) => s.tier === t && s.garrison.length); return L.length ? L.reduce((n, s) => n + strength(s.garrison), 0) / L.length : null; };
    const order = [0, 1, 2, 3, 5, 6, 7].map(avg).filter((v) => v !== null);
    for (let i = 1; i < order.length; i++) if (order[i] < order[i - 1] * 0.9) { P.push('threat does not grow'); break; }
    // 17. models of every troop that appears (in the browser, where the models are loaded)
    if (AS.Models) for (const s of w.sites) for (const st of s.garrison) { const t = D.troops[st[0]]; if (t.gen && !AS.Models[t.gen]) { P.push('missing model ' + t.gen); break; } }
    // size and readability
    if (w.sites.length < 20 || w.sites.length > 48) P.push('site count ' + w.sites.length);
    for (let i = 0; i < w.sites.length; i++) for (let j = i + 1; j < w.sites.length; j++) if (dist(w.sites[i], w.sites[j]) < 22) { P.push('sites overlap'); i = 1e9; break; }
    for (const s of w.sites) if (s.x < 10 || s.y < 10 || s.x > w.w - 10 || s.y > w.h - 10) { P.push('site off the map'); break; }
    return P;
  }

  const Gen = {
    MAX_ATTEMPTS, strength, units, index, reach, validate, offer,
    /* the world for a seed: o = { allegiance, lords: [{ id, allegiance }] } (the campaign's) */
    generate(seed, o) {
      seed >>>= 0;
      let w = null, P = null, attempt = 0;
      for (; attempt < MAX_ATTEMPTS; attempt++) {
        const sub = attempt ? (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0 : seed;
        try { w = build(sub, seed, o); P = validate(w, o); } catch (e) { w = null; P = ['generator error: ' + e.message]; }
        if (!P.length) break;
      }
      if (!w) w = { sites: [], routes: [], islands: [], lords: [] };
      Object.defineProperty(w, 'attempts', { value: attempt + (P.length ? 0 : 1), enumerable: false });
      Object.defineProperty(w, 'problems', { value: P, enumerable: false });
      return w;
    },
  };
  C.WorldGen = Gen;
})(window.AS);
