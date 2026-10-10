/* WYRMCROWN — THE CAMPAIGN in the Wide Realm (stage 1).
 * The campaign is played in the big continuous world (maps/largeworld.js), in
 * real time, exactly like a battle: no node map, no separate battle screens.
 *
 *   start      your castle in the south-west, little gold, no army in the field
 *   fog        the war map and minimap show only what you have seen
 *   gold       the battle game's own income: taxes at home, carts and couriers
 *              from the villages, farms and mines you hold
 *   the day    a continuous clock (DAY seconds a day). At each dawn the army's
 *              wages are paid; troops nobody can pay desert, the costliest first,
 *              and the places you hold restock their recruits
 *   hiring     fly low over a place you hold (or your castle) and press R. Each
 *              kind of place offers its own troops (Conquest's troop types and
 *              recruitment rules), in limited numbers; the army's size is capped
 *              by leadership, which grows with every place you take
 *   the army   walks after the dragon (V: follow / hold here), fights whatever
 *              it meets and can claim places by standing in them. Far from the
 *              dragon and out of sight it marches faster
 *   the end    a Dragon Lord holds the Isle of Ravens across the sea and never
 *              leaves it. Break his wardstones, drive off his dragon and topple
 *              his keep — the battle game's own rule — and the realm is yours
 *
 * Every new campaign rearranges the guardians and warbands from its seed.
 * Progress is saved automatically (localStorage, three slots).
 * Stage 2 (not here yet): a harbour and ship to carry the army overseas,
 * more islands, minor strongholds that answer the Lord. */
'use strict';
(function (AS) {
  const U = AS.U;
  const KEY = 'wyrmcrown.bigcampaign.slot';
  const DAY = 180;              // seconds of play per campaign day
  const DAWN = 6;               // the clock starts (and each day turns) at 06:00
  const START_GOLD = 250, BASE_LEAD = 60;
  const LORD_TOWN = { x: 25000, y: 6700 }, LORD_GATE = 2.63, LORD_HOME_R = 3400;
  // leadership (renown) for taking a place, and the spoils found there the first time
  const LEAD = { village: 10, goldmine: 15, tradepost: 10, watchtower: 5, bridge: 10, fort: 40, castle: 70, shrine: 5, magicwell: 10, grove: 10, wizardtower: 15, ruins: 10, cave: 10, nest: 10,
    town: 25, walledtown: 50, stronghold: 70, farmstead: 8, shire: 15, elfvillage: 20, abbey: 15, inn: 8, banditcamp: 15, dungeon: 25 };
  const SPOILS = { village: 40, goldmine: 80, fort: 200, castle: 400, bridge: 30, wizardtower: 60, town: 120, walledtown: 300, stronghold: 400, farmstead: 30, shire: 60, elfvillage: 80, abbey: 60, inn: 40 };
  // what each kind of place recruits (Conquest recruitment kinds, conquest/data/sites.js)
  const HIRE = { village: ['village'], fort: ['barracks', 'archery_range'], castle: ['knight_barracks', 'archery_range', 'barracks'], watchtower: ['archery_range'], cave: ['wolf_den'], ruins: ['bandit_camp'], grove: ['enchanted_grove'],
    town: ['village', 'barracks'], walledtown: ['barracks', 'archery_range', 'knight_barracks'], stronghold: ['knight_barracks', 'archery_range', 'barracks'], farmstead: ['village'], shire: ['village'], elfvillage: ['enchanted_grove'], banditcamp: ['bandit_camp'] };
  /* the Wide Realm's places as the campaign has them: some of the Large World's villages
   * and its castle are built as the Huge World's settlements (src/game/settlements.js),
   * and outlaw camps and dungeons (treasure, and sometimes a relic) are added */
  const GRAND = { ashford: 'town', kingsmead: 'walledtown', elmshade: 'elfvillage', saltmere: 'shire', eastfield: 'farmstead', brackenfold: 'farmstead', blackcrag: 'stronghold' };
  const EXTRA = [
    { id: 'aldricabbey', k: 'abbey', name: 'Abbey of Saint Aldric', x: 8200, y: 15000 },
    { id: 'crossedkeys', k: 'inn', name: 'The Crossed Keys', x: 11200, y: 15300 },
    { id: 'wolfsbane', k: 'banditcamp', name: 'Wolfsbane Stockade', x: 10000, y: 17500, guard: 'outlaws' },
    { id: 'redcap', k: 'banditcamp', name: 'Redcap Hollow', x: 17400, y: 13200, guard: 'outlaws' },
    { id: 'greybarrow', k: 'dungeon', name: 'Barrow of the Grey Kings', x: 18400, y: 18900, guard: 'undead' },
    { id: 'deepdelve', k: 'dungeon', name: 'Deepdelve', x: 17200, y: 9400, guard: 'ice' },
    { id: 'thornroot', k: 'dungeon', name: 'Thornroot Hollow', x: 7000, y: 9400, guard: 'beasts' },
  ];
  const DEN = {
    outlaws: [[['bandit', 6]], [['bandit', 5], ['wolf', 2]], [['bandit', 7], ['ogre', 1]]],
    undead: [[['skeleton', 8], ['gravehound', 2]], [['skeleton', 10]], [['skeleton', 6], ['gravehound', 3]]],
    ice: [[['snowstalker', 4], ['troll', 1]], [['snowstalker', 5]], [['troll', 2], ['snowstalker', 2]]],
    beasts: [[['wolf', 5], ['bear', 1]], [['bear', 2], ['wolf', 3]], [['wolf', 6]]],
  };
  // guardians by tier, for rearranging the realm on each new campaign
  const POOLS = {
    0: [[['bandit', 3]], [['wolf', 4]], [['bandit', 2], ['wolf', 2]], [['bear', 1], ['wolf', 2]]],
    1: [[['bandit', 5]], [['wolf', 5], ['bear', 1]], [['ogre', 1], ['bandit', 3]], [['bear', 2], ['wolf', 3]]],
    2: [[['ogre', 2], ['bandit', 4]], [['troll', 1], ['wolf', 4]], [['ogre', 1], ['bear', 2], ['bandit', 3]], [['troll', 1], ['bandit', 5]]],
    3: [[['troll', 2], ['ogre', 2], ['giant', 1]], [['giant', 1], ['ogre', 3]], [['troll', 3], ['bandit', 6]]],
  };
  const LOCAL = { ice: { 1: [['snowstalker', 4]], 2: [['snowstalker', 4], ['troll', 1]] }, undead: { 0: [['skeleton', 5]], 1: [['skeleton', 8]], 2: [['skeleton', 8], ['gravehound', 3]] } };

  const BC = {
    DAY, KEY,
    /* ---------------- saves ---------------- */
    load(slot) { try { const r = localStorage.getItem(KEY + slot); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    clear(slot) { try { localStorage.removeItem(KEY + slot); } catch (e) { /* ignore */ } },
    fresh(faction, seed) {
      const lord = faction === 'undead' ? 'elf' : 'undead';
      return { version: 1, seed: seed >>> 0, faction, lord, fresh: true, clock: 0, day: 1, lead: BASE_LEAD, gold: START_GOLD,
        bought: [], lordBought: [], sites: {}, claimed: {}, enc: {}, stocks: {}, army: { mode: 'follow', stacks: {} }, savedAt: Date.now() };
    },
    // a realm record for this campaign: the Wide Realm, the Dragon Lord's town on the isle,
    // and the guardians and warbands rearranged from the seed
    makeMap(sv) {
      const base = AS.Maps.byId.largeworld, rng = new U.RNG(sv.seed * 2654435761 + 7);
      const C = { x: base.factions.human.town.x, y: base.factions.human.town.y };
      const tierAt = (x, y) => { if (x > 22000) return 3; const d = Math.hypot(x - C.x, y - C.y); return d < 5500 ? 0 : d < 10000 ? 1 : 2; };
      const biomeAt = (x, y) => { let b = 'neutral', best = 1e9; for (const r of base.regions) { const d = Math.hypot(x - r.x, y - r.y) / r.r; if (d < 1 && d < best) { best = d; b = r.biome; } } return b; };
      const pickGuard = (x, y, k) => {
        let t = tierAt(x, y);
        if (k === 'fort' || k === 'walledtown') t = Math.max(t, 2); if (k === 'castle' || k === 'stronghold') t = 3;
        const loc = LOCAL[biomeAt(x, y)], opts = POOLS[t].slice();
        if (loc && loc[t]) opts.push(loc[t], loc[t]);
        return rng.pick(opts).map((q) => q.slice());
      };
      const m = Object.assign({}, base, {
        name: 'The Wide Realm', sandbox: false, campaign: true,
        blurb: 'Win the Wide Realm from your castle in the south-west, place by place, and break the Dragon Lord on the Isle of Ravens.',
        factions: { [sv.faction]: base.factions.human, [sv.lord]: { town: LORD_TOWN, gate: LORD_GATE } },
      });
      // the Lord's isle: its ridge moves north to make room for his town
      m.mountains = base.mountains.map((mt) => (mt.pts[0][0] > 23000 ? Object.assign({}, mt, { pts: [[24100, 4900], [25400, 5100]] }) : mt));
      m.regions = base.regions.map((r) => (r.x > 24000 && r.biome === 'undead' ? Object.assign({}, r, { biome: sv.lord }) : r));
      // the places: the ruined castle becomes the Lord's outer fort on the lesser isle
      const unguarded = [];
      m.sites = base.sites.map((s) => {
        const o = Object.assign({}, s);
        if (s.id === 'ravenhold') Object.assign(o, { k: 'fort', name: 'Ravenhold', x: 25900, y: 8400 });
        if (s.id === 'ravenrest') Object.assign(o, { x: 26300, y: 6100 });
        if (GRAND[s.id]) o.k = GRAND[s.id];
        if (o.guard) o.guard = pickGuard(o.x, o.y, o.k);
        else if ((o.k === 'village' || o.k === 'farmstead') && tierAt(o.x, o.y) === 0 && Math.hypot(o.x - C.x, o.y - C.y) > 2200) unguarded.push(o);
        return o;
      });
      for (const e of EXTRA) m.sites.push(Object.assign({}, e, { guard: e.guard ? rng.pick(DEN[e.guard]).map((q) => q.slice()) : undefined }));
      // one or two of the nearby farms are held by brigands this time
      for (let i = rng.int(1, 2); i > 0 && unguarded.length; i--) { const o = unguarded.splice(rng.int(0, unguarded.length - 1), 1)[0]; o.guard = pickGuard(o.x, o.y, o.k); }
      // warbands: the isle's garrison is the Lord's own now; the others vary in strength
      m.encounters = base.encounters.filter((e) => e.id !== 'e_isle').map((e) => Object.assign({}, e, { troops: e.troops.map(([r, n]) => [r, Math.max(1, Math.round(n * rng.range(0.75, 1.3)))]) }));
      return m;
    },

    /* ---------------- start / continue ---------------- */
    begin(slot, sv) {
      const map = this.makeMap(sv);
      AS.App.startMatch(map, { faction: sv.faction, campaign: { slot, save: sv } });
    },
    // called by the realm once its towns, sites, fog and warbands exist (realm.load)
    setup(g) {
      const o = g.opts.campaign, sv = o.save, F = g.playerFaction, L = g.factions[sv.lord];
      const S = g.bc = { slot: o.slot, sv, army: [], mode: sv.army.mode || 'follow', tick: 0, saveT: 45, owned: new Set(), lead: sv.lead, clock: sv.clock, day: sv.day, lord: L, order: null, warnT: 0 };
      if (L) L.homeR = LORD_HOME_R; // the Dragon Lord never leaves his isle (src/game/ai.js)
      if (sv.fresh) {
        F.gold = START_GOLD;
        if (L) L.gold = 700;
        sv.fresh = false;
      } else this.restore(g, sv);
      for (const s of g.sites) if (s.owner === g.playerKey) S.owned.add(s.id);
      if (!g.map.stream) this.landOf(g, F.townPos.x, F.townPos.y); // (the land map is built during loading, not in play)
      // purchases are remembered from now on (replayed on load)
      F.onBought = (id) => { sv.bought.push(id); };
      if (L) L.onBought = (id) => { sv.lordBought.push(id); };
      g.msg(sv.day === 1 && !sv.clock ? 'THE WIDE REALM — YOUR CAMPAIGN BEGINS' : 'THE WIDE REALM — DAY ' + S.day, '#ffe7a8', 4);
      if (sv.day === 1 && !sv.clock) g.later(4.5, () => g.news('Take the farms and villages near your castle, hire troops there (R), and find the Dragon Lord across the sea.', g.playerKey, true));
    },
    restore(g, sv) {
      const F = g.playerFaction, L = g.bc.lord;
      for (const id of sv.bought || []) F.buy(id, { free: true, instant: true, silent: true });
      if (L) {
        for (const id of sv.lordBought || []) L.buy(id, { free: true, instant: true, silent: true });
        if (sv.lordGold !== undefined) L.gold = sv.lordGold;
        if (sv.lordIdx && L.lord) L.lord.buildIdx = sv.lordIdx;
        if (sv.lordWards !== undefined) { let n = 0; for (const b of L.buildings) if (b.kind === 'wardstone' && b.alive) { if (++n > sv.lordWards) { b.alive = false; b.removed = true; } } }
        if (sv.lordKeep !== undefined && L.keep) L.keep.hp = L.keep.maxHp * sv.lordKeep;
      }
      F.gold = sv.gold;
      // places: owners, fallen guardians, looted hoards
      for (const s of g.sites) {
        const r = sv.sites[s.id]; if (!r) continue;
        if (r.c) for (const u of s.guards) { u.alive = false; u.removed = true; }
        if (r.l) { s.looted = true; s.respawnT = r.l; if (s.chest) s.chest.hidden = true; for (const u of s.guards) { u.alive = false; u.removed = true; } }
        if (r.o && g.factions[r.o]) s.setOwner(r.o, true);
      }
      // warbands: beaten, or what is left of them and where they were
      if (g.lw) for (const G of g.lw.groups) {
        const r = sv.enc[G.def.id]; if (!r) continue;
        if (r.d) G.defeated = true;
        if (r.left) G.left = r.left;
        if (r.x !== undefined) { G.def.x = r.x; G.def.y = r.y; }
        if (r.wp) G.wp = r.wp;
      }
      // what has been explored
      if (sv.fog) this.unpackFog(g, sv.fog);
      // the dragon where it was
      if (sv.pos) {
        const p = g.player, x = sv.pos[0], y = sv.pos[1];
        p.x = x; p.y = y; p.z = 110;
        for (const n of p.nodes) { n.x = x; n.y = y; n.z = p.z; }
        p.layoutRig(0, true);
      }
      // the army, where it stood
      const st = sv.army.stacks || {}, ax = sv.army.x || F.townPos.x, ay = sv.army.y || F.townPos.y + 120;
      for (const id in st) this.spawnUnits(g, id, st[id], ax, ay);
    },
    snapshot(g) {
      const S = g.bc, sv = S.sv, F = g.playerFaction, L = S.lord, p = g.player;
      sv.clock = S.clock; sv.day = S.day; sv.lead = S.lead; sv.gold = Math.round(F.gold);
      if (L) {
        sv.lordGold = Math.round(L.gold); sv.lordIdx = L.lord ? L.lord.buildIdx : 0;
        sv.lordWards = L.buildings.filter((b) => b.kind === 'wardstone' && b.alive).length;
        sv.lordKeep = L.keep && L.keep.alive ? +(L.keep.hp / L.keep.maxHp).toFixed(3) : 0;
      }
      sv.sites = {};
      for (const s of g.sites) {
        const r = {};
        if (s.owner) r.o = s.owner;
        if (s.guards.length && !s.guarded()) r.c = 1;
        if (s.def.treasure && s.looted) r.l = Math.max(1, Math.round(s.respawnT));
        if (r.o || r.c || r.l) sv.sites[s.id] = r;
      }
      sv.enc = {};
      if (g.lw) for (const G of g.lw.groups) {
        let left = G.left;
        if (G.troops) { const c = {}; for (const u of G.troops) if (u.alive && !u.removed) c[u.role] = (c[u.role] || 0) + 1; left = Object.keys(c).map((k) => [k, c[k]]); }
        sv.enc[G.def.id] = G.defeated ? { d: 1 } : { left, x: Math.round(G.def.x), y: Math.round(G.def.y), wp: G.wp };
      }
      const live = S.army.filter((u) => u.alive && !u.removed), c = this.centre(live);
      const stacks = {}; for (const u of live) stacks[u.ctype] = (stacks[u.ctype] || 0) + 1;
      sv.army = { mode: S.mode, stacks, x: c ? Math.round(c.x) : undefined, y: c ? Math.round(c.y) : undefined };
      sv.fog = this.packFog(g);
      sv.pos = p.down > 0 ? null : [Math.round(p.x), Math.round(p.y)];
      sv.savedAt = Date.now();
      return sv;
    },
    save(g) {
      if (!g.bc || g.state !== 'play') return false;
      try { localStorage.setItem(KEY + g.bc.slot, JSON.stringify(this.snapshot(g))); return true; } catch (e) { return false; }
    },
    packFog(g) { // run lengths of the explored grid, alternating unseen / seen
      const E = g.explored, out = []; let v = 0, n = 0;
      for (let i = 0; i < E.length; i++) { if (E[i] === v) n++; else { out.push(n); v = E[i]; n = 1; } }
      out.push(n);
      return out.join('.');
    },
    unpackFog(g, s) {
      const E = g.explored; let i = 0, v = 0;
      for (const t of s.split('.')) { const n = +t; if (v) E.fill(1, i, Math.min(E.length, i + n)); i += n; v ^= 1; }
    },

    /* ---------------- the army ---------------- */
    troop(id) { return AS.Conquest.Data.troops[id]; },
    centre(list) {
      if (!list.length) return null;
      let x = 0, y = 0; for (const u of list) { x += u.x; y += u.y; }
      return { x: x / list.length, y: y / list.length };
    },
    spawnUnits(g, id, n, x, y) {
      const S = g.bc, F = g.playerFaction, out = [];
      if (!this.troop(id)) return out;
      for (let i = 0; i < n; i++) {
        const a = (S.army.length + i) * 2.399, r = 30 + Math.sqrt(S.army.length + i) * 16;
        let px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8;
        if (!g.terrain.groundPassable(px, py)) { px = x; py = y; }
        const u = AS.Conquest.Battle.spawn(g, id, g.playerKey, px, py, F.def.pal);
        u.state = 'march'; u.dest = { x: px, y: py, r: 40 }; u.path = null; u.home = { x: px, y: py, r: 160 }; u.bcArmy = true;
        F.troops.push(u); S.army.push(u); out.push(u);
      }
      return out;
    },
    leadUsed(g) { let n = 0; for (const u of g.bc.army) if (u.alive && !u.removed) n += this.troop(u.ctype).leadership; return n; },
    wages(g) { let n = 0; for (const u of g.bc.army) if (u.alive && !u.removed) n += this.troop(u.ctype).wage; return n; },
    armyCount(g) { let n = 0; for (const u of g.bc.army) if (u.alive && !u.removed) n++; return n; },
    // V: follow the dragon / hold this ground
    toggleMode(g) {
      const S = g.bc;
      if (!this.armyCount(g)) { g.msg('YOU HAVE NO ARMY YET — HIRE TROOPS WITH R AT A PLACE YOU HOLD', '#ffe7a8', 3); AS.Audio.sfx('denied'); return; }
      S.mode = S.mode === 'follow' ? 'hold' : 'follow';
      S.order = null;
      if (S.mode === 'hold') this.holdHere(g);
      g.msg(S.mode === 'follow' ? 'THE ARMY FOLLOWS YOU' : 'THE ARMY HOLDS ITS GROUND', '#ffe7a8', 2.2);
      AS.Audio.sfx('ui_click');
    },
    holdHere(g) {
      const live = g.bc.army.filter((u) => u.alive), c = this.centre(live); if (!c) return;
      live.forEach((u, i) => { const a = i * 2.399, r = 20 + Math.sqrt(i) * 16; u.state = 'march'; u.path = null; u.dest = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.8, r: 30 }; });
    },
    // which stretch of connected land each navigation cell belongs to (a flood fill, once):
    // whether the army can walk somewhere is then a lookup, not a search
    landOf(g, x, y) {
      const N = g.nav;
      if (!N.land) {
        const L = N.land = new Int32Array(N.W * N.H), st = [];
        let id = 0;
        for (let k = 0; k < L.length; k++) {
          if (L[k] || N.cost[k] <= 0) continue;
          L[k] = ++id; st.push(k);
          while (st.length) {
            const c = st.pop(), ci = c % N.W, cj = (c - ci) / N.W;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
              const ni = ci + di, nj = cj + dj;
              if ((!di && !dj) || ni < 0 || nj < 0 || ni >= N.W || nj >= N.H) continue;
              const nk = nj * N.W + ni;
              if (L[nk] || N.cost[nk] <= 0) continue;
              if (di && dj && (N.cost[cj * N.W + ni] <= 0 || N.cost[nj * N.W + ci] <= 0)) continue;
              L[nk] = id; st.push(nk);
            }
          }
        }
      }
      const c = AS.Nav.nearestOpen(g, AS.Nav.cellOf(g, x, y));
      return N.land[c.j * N.W + c.i];
    },
    // march the army to (x, y) along one shared road
    orderTo(g, x, y) {
      const S = g.bc, live = S.army.filter((u) => u.alive), c = this.centre(live);
      if (!c) return true;
      const N = AS.Nav, end = N.nearestOpen(g, N.cellOf(g, x, y));
      const ex = end.i * 64 + 32, ey = end.j * 64 + 32;
      const tx = g.terrain.groundPassable(x, y) ? x : ex, ty = g.terrain.groundPassable(x, y) ? y : ey;
      if (g.nav && g.nav.stream ? !N.reachable(g, c.x, c.y, tx, ty) : this.landOf(g, c.x, c.y) !== this.landOf(g, tx, ty)) return false;
      const path = N.path(g, c.x, c.y, tx, ty);
      live.forEach((u, i) => {
        const a = i * 2.399, r = 24 + Math.sqrt(i) * 17;
        u.state = 'march'; u.path = path; u.pi = 1; u.dest = { x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r * 0.8, r: 36 };
      });
      S.order = { x: tx, y: ty, t: g.time };
      return true;
    },
    updateArmy(g) {
      const S = g.bc, p = g.player, cam = g.camera;
      for (let i = S.army.length - 1; i >= 0; i--) if (!S.army[i].alive || S.army[i].removed) S.army.splice(i, 1);
      const c = this.centre(S.army);
      // the army keeps enemies near it awake (src/game/realm.js) and draws warbands out (largeworld.js)
      g.wakePts = c ? [c] : null;
      if (!c) return;
      // out of sight and far from the dragon, the army marches at three times the pace
      for (const u of S.army) {
        const far = Math.hypot(u.x - p.x, u.y - p.y) > 1300;
        const seen = u.x > cam.x - 100 && u.x < cam.x + cam.w + 100 && u.y > cam.y - 100 && u.y < cam.y + cam.h + 200;
        u.hurry = far && !seen && !u.target ? 3 : 1;
      }
      if (S.mode !== 'follow' || p.down > 0) return;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 320) return;
      const O = S.order;
      // (a long march is re-planned less often: its road stays good while the dragon circles ahead)
      if (O && Math.hypot(O.x - p.x, O.y - p.y) < (d > 2500 ? 900 : 260) && g.time - O.t < (d > 2500 ? 15 : 8)) return;
      if (S.blockT > g.time) return;
      if (!this.orderTo(g, p.x, p.y)) {
        S.blockT = g.time + 6;
        if (g.time - S.warnT > 20) { S.warnT = g.time; g.msg('YOUR ARMY CANNOT FOLLOW YOU ACROSS THE WATER', '#ffb08a', 3); }
      }
    },

    /* ---------------- hiring ---------------- */
    // the place the dragon is hiring at right now (a held place low beneath it, or home)
    hirePlace(g) {
      const p = g.player, F = g.playerFaction;
      if (p.down > 0) return null;
      if (Math.hypot(p.x - F.townPos.x, p.y - F.townPos.y) < 560) {
        const kinds = ['village', 'archery_range'];
        if (F.has('stable')) kinds.push('knight_barracks');
        if (F.has('workshop')) kinds.push('workshop');
        return { id: 'home', name: 'your castle', kinds, x: F.townPos.x, y: F.townPos.y + 140, tier: 0 };
      }
      if (p.z > 95) return null;
      for (const s of g.sites) {
        if (s.owner !== g.playerKey || !HIRE[s.kind]) continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) > Math.max(320, s.capR + 120)) continue;
        const d = Math.hypot(s.x - LORD_TOWN.x, s.y - LORD_TOWN.y), h = Math.hypot(s.x - F.townPos.x, s.y - F.townPos.y);
        return { id: s.id, name: s.name, kinds: HIRE[s.kind], x: s.x, y: s.y + 60, tier: d < 4000 ? 5 : h < 5500 ? 0 : h < 10000 ? 1 : 2 };
      }
      return null;
    },
    // troops on offer at a place, and how many are left (refilled each dawn)
    stock(g, place) {
      const S = g.bc, st = S.sv.stocks;
      if (!st[place.id]) {
        const o = {};
        for (const k of place.kinds) Object.assign(o, AS.Conquest.WorldGen.offer(g.playerKey, k, place.tier));
        st[place.id] = { cap: o, now: Object.assign({}, o) };
      }
      return st[place.id];
    },
    canHire(g, place, id, n) {
      const t = this.troop(id), terms = AS.Conquest.Rules.recruitTerms(g.playerKey, id), st = this.stock(g, place);
      if (!terms.ok) return terms;
      if ((st.now[id] || 0) < n) return { ok: false, reason: st.now[id] ? 'Only ' + st.now[id] + ' left today' : 'None left today' };
      if (this.leadUsed(g) + t.leadership * n > g.bc.lead) return { ok: false, reason: 'Not enough leadership' };
      if (g.playerFaction.gold < terms.cost * n) return { ok: false, reason: 'Not enough gold' };
      return { ok: true, cost: terms.cost * n };
    },
    hire(g, place, id, n) {
      const chk = this.canHire(g, place, id, n);
      if (!chk.ok) return chk;
      const F = g.playerFaction;
      F.gold -= chk.cost; g.stats.goldSpent += chk.cost;
      this.stock(g, place).now[id] -= n;
      if (!this.armyCount(g)) g.bc.vHintT = g.time;
      this.spawnUnits(g, id, n, place.x, place.y);
      if (g.bc.mode === 'hold') this.holdHere(g); else g.bc.order = null;
      AS.Audio.sfx('buy');
      this.save(g);
      return chk;
    },

    /* ---------------- the clock ---------------- */
    hour(g) { return (DAWN + (g.bc.clock % DAY) / DAY * 24) % 24; },
    dawn(g) {
      const S = g.bc, F = g.playerFaction;
      S.day++;
      // wages: unpaid troops desert, the costliest first
      let wages = this.wages(g); const gone = [];
      while (wages > F.gold) {
        let worst = null;
        for (const u of S.army) if (u.alive && !u.removed && this.troop(u.ctype).wage > 0 && (!worst || this.troop(u.ctype).wage > this.troop(worst.ctype).wage)) worst = u;
        if (!worst) break;
        gone.push(this.troop(worst.ctype).name);
        worst.alive = false; worst.removed = true;
        AS.Particles.spawn({ x: worst.x, y: worst.y, z: 6, shape: AS.Particles.SMOKE, col: '#b8a890', size: 6, size2: 16, life: 0.9, alpha: 0.5 });
        S.army.splice(S.army.indexOf(worst), 1);
        wages = this.wages(g);
      }
      F.gold -= wages;
      // recruits return to the places you hold
      for (const id in S.sv.stocks) {
        const st = S.sv.stocks[id];
        if (id !== 'home' && !S.owned.has(id)) continue;
        for (const t in st.cap) st.now[t] = Math.min(st.cap[t], (st.now[t] || 0) + Math.ceil(st.cap[t] / 2));
      }
      g.msg('DAY ' + S.day + ' — WAGES ' + wages + ' GOLD' + (gone.length ? ' · ' + gone.length + ' UNPAID TROOPS DESERTED' : ''), gone.length ? '#ff9a6a' : '#ffe7a8', 4);
      if (gone.length) g.news(gone.length + ' of your troops deserted for want of pay (' + gone.slice(0, 3).join(', ') + (gone.length > 3 ? '…' : '') + ').', g.playerKey, true);
      this.save(g);
    },

    /* ---------------- the frame ---------------- */
    update(g, dt) {
      const S = g.bc; if (!S) return;
      S.clock += dt;
      if (S.clock >= S.day * DAY) this.dawn(g);
      S.tick -= dt;
      if (S.tick > 0) return;
      S.tick = 0.5;
      this.updateArmy(g);
      // places taken and lost
      for (const s of g.sites) {
        const mine = s.owner === g.playerKey;
        if (mine && !S.owned.has(s.id)) {
          S.owned.add(s.id);
          if (!S.sv.claimed[s.id]) {
            S.sv.claimed[s.id] = 1;
            const l = LEAD[s.kind] || 5, gold = SPOILS[s.kind] || 0;
            S.lead += l;
            if (gold) g.playerFaction.addGold(gold, s.x, s.y, 'loot');
            g.later(1.2, () => g.msg('RENOWN: LEADERSHIP +' + l + (HIRE[s.kind] ? ' · PRESS R HERE TO HIRE TROOPS' : ''), '#bfe8a0', 3.5));
          }
          this.save(g);
        } else if (!mine && S.owned.has(s.id)) S.owned.delete(s.id);
      }
      // the end: the battle game's own rule (every rival broken), or our own keep lost
      if (g.state === 'play') AS.Factions.checkVictory(g);
      if (g.state === 'ending' && !S.over) {
        S.over = true;
        const won = g.result && g.result.won;
        if (g.result) {
          g.result.bigCampaign = true;
          g.result.text = won ? 'On day ' + S.day + ' the Dragon Lord\'s stronghold fell. The Wide Realm is yours.' : 'Your castle has fallen on day ' + S.day + '. The campaign is lost.';
        }
        this.clear(S.slot);
        return;
      }
      S.saveT -= 0.5;
      if (S.saveT <= 0) { S.saveT = 45; this.save(g); }
    },
    // for the HUD
    status(g) {
      const S = g.bc, h = this.hour(g);
      return { day: S.day, time: String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'), army: this.armyCount(g), lead: S.lead, used: this.leadUsed(g), wages: this.wages(g), mode: S.mode };
    },
    // a short summary of a save for the campaign menu
    describe(sv) {
      const held = Object.values(sv.sites || {}).filter((r) => r.o === sv.faction).length;
      let n = 0; for (const k in (sv.army && sv.army.stacks) || {}) n += sv.army.stacks[k];
      return 'Day ' + sv.day + ' · ' + held + ' places held · army of ' + n + ' · ' + Math.round(sv.gold) + ' gold';
    },
  };
  AS.BigCampaign = BC;
})(window.AS);
