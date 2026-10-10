/* WYRMCROWN — HUGE WORLD TEST: a generated continent, ~35 km across, built
 * around the dragon as it flies (map.stream, src/game/stream.js).
 *
 * The land is not evenly random: it is cut into PROVINCES (Voronoi cells over
 * the continent), each with a theme that decides its ground, its geography, who
 * lives there, what threatens it and what is hidden in it:
 *
 *   heartland   fertile farmland: market towns, walled towns, castles, abbeys,
 *               villages, farmsteads and roadside inns; low rolling hills
 *   shire       gentle green hill-country of the hill-folk: burrows, orchards,
 *               hedged lanes, farmsteads
 *   oldforest   the elves' ancient wood: dense forest with glades, elf villages,
 *               groves, forest temples and the beasts of the deep wood
 *   pinewood    dark pine forest: woodcutters, wolves, outlaw camps, old ruins
 *   highlands   mountain ranges: dwarf holds dug into the mountain feet, mines,
 *               caves, watchtowers on the passes; trolls, ogres and giants
 *   frost       the snowy north: Hrimgard's stone towns and castles, frost lairs
 *   moor        bare heather moorland: standing stones, barrows (dungeons), outlaws
 *   marsh       bog and fen: pools, reeds and dead trees; sunken dungeons, ogres
 *   badlands    broken ochre crags: outlaw strongholds, giant bones, monster dens
 *   blight      Morgrave's corrupted land: grim towns and castles, crypts, the dead
 *
 * On top of that: rivers run from the high ground to the sea (harbours at their
 * mouths); a road network joins the major places (towns, castles, holds,
 * harbours) with minor roads out to villages, farms, inns and abbeys, and
 * bridges where roads cross rivers; castles guard river crossings; remote
 * dungeons, camps and lairs lie off the roads. Danger rises with distance from
 * the player's castle in the south-west (safe heartland → frontier → wild).
 * Landmarks (statues, bones, standing stones, frozen ships, crypts…) reward
 * whoever flies out to find them. Everything comes from the seed. */
'use strict';
(function (AS) {
  const U = AS.U, H = AS.Maps.H, TAU = Math.PI * 2;

  // ground colour multipliers and tree kinds (realm_terrain.js: tints, flora) per theme
  const THEME = {
    heartland: { biome: 'human', tint: [1.04, 1.06, 0.94], k: 0.6, flora: 0, forest: [2, 700, 1500, 0.8] },
    shire: { biome: 'human', tint: [1.0, 1.12, 0.86], k: 0.8, flora: 5, forest: [3, 500, 1000, 0.7] },
    oldforest: { biome: 'elf', tint: [0.9, 1.04, 0.92], k: 0.6, flora: 0, forest: [9, 2200, 4200, 1] },
    pinewood: { biome: 'neutral', tint: [0.78, 0.92, 0.86], k: 0.9, flora: 1, forest: [8, 1800, 3600, 0.95] },
    highlands: { biome: 'neutral', tint: [0.98, 0.94, 0.86], k: 0.7, flora: 1, forest: [3, 700, 1500, 0.8] },
    frost: { biome: 'ice', tint: [1, 1, 1], k: 0, flora: 0, forest: [4, 900, 2000, 0.85] },
    moor: { biome: 'neutral', tint: [1.12, 0.86, 1.02], k: 0.95, flora: 3, forest: [1, 400, 800, 0.5] },
    marsh: { biome: 'neutral', tint: [0.82, 0.88, 0.62], k: 0.95, flora: 2, forest: [3, 500, 1200, 0.6] },
    badlands: { biome: 'neutral', tint: [1.3, 0.98, 0.66], k: 1, flora: 4, forest: [0, 0, 0, 0] },
    blight: { biome: 'undead', tint: [1, 1, 1], k: 0, flora: 0, forest: [3, 800, 1800, 0.8] },
  };
  // who guards what, by theme and by danger tier (0 safe … 3 wild)
  const BEASTS = {
    heartland: [['bandit'], ['wolf'], ['bandit', 'wolf']],
    shire: [['wolf'], ['wolf', 'bear']],
    oldforest: [['spindlelurker'], ['greatbeetle'], ['treeshambler', 'spindlelurker'], ['wolf', 'greatbeetle']],
    pinewood: [['wolf'], ['bear', 'wolf'], ['bandit'], ['moorhound', 'wolf']],
    highlands: [['troll'], ['ogre', 'bandit'], ['giant', 'troll'], ['bear', 'ogre']],
    frost: [['snowstalker'], ['icecrawler', 'snowstalker'], ['troll', 'snowstalker'], ['giant']],
    moor: [['moorhound'], ['bandit'], ['moorhound', 'bandit']],
    marsh: [['ogre'], ['carrioncrawler'], ['plagueboar', 'ogre'], ['troll']],
    badlands: [['bandit'], ['ogre', 'bandit'], ['plagueboar'], ['troll', 'ogre']],
    blight: [['skeleton'], ['gravehound', 'skeleton'], ['carrioncrawler', 'skeleton']],
  };
  const BIG = { troll: 1, ogre: 1, giant: 1, treeshambler: 1, bear: 1 };
  // landmarks worth flying out to find, by theme
  const MARKS = {
    heartland: ['lm_colossus_statue', 'lm_stonecircle', 'lm_statue_forgotten', 'lm_ruined_tower', 'lm_broken_statue'],
    shire: ['lm_stonecircle', 'lm_great_tree', 'lm_wayshrine'],
    oldforest: ['lm_forest_temple', 'lm_colossal_stump', 'lm_moss_ruin', 'lm_giant_mushroom', 'lm_statue_forgotten'],
    pinewood: ['lm_ruined_tower', 'lm_camp_deserted', 'lm_dragon_skeleton', 'lm_carved_stone'],
    highlands: ['lm_dragon_skeleton', 'lm_carved_stone', 'lm_ruined_tower', 'lm_brazier_huge'],
    frost: ['lm_frozen_ship', 'lm_frozen_waterfall', 'lm_ice_formation', 'lm_totem_ice', 'lm_longhouse_ruin'],
    moor: ['lm_stonecircle', 'lm_carved_stone', 'lm_ruined_tower', 'lm_old_foundation'],
    marsh: ['lm_sinkhole', 'lm_dead_colossal_tree', 'lm_obelisk_dark', 'lm_plague_cart'],
    badlands: ['lm_giant_skull', 'lm_dragon_skeleton', 'lm_wagon_wreck', 'lm_colossus_statue'],
    blight: ['lm_mausoleum', 'lm_bone_totem', 'lm_obelisk_dark', 'lm_gallows', 'lm_giant_skull'],
  };
  const MARK_NAME = {
    lm_colossus_statue: 'Colossus of', lm_stonecircle: 'Stones of', lm_statue_forgotten: 'The Forgotten King of', lm_ruined_tower: 'The Broken Tower of', lm_broken_statue: 'The Fallen Hero of',
    lm_great_tree: 'The Old Tree of', lm_wayshrine: 'The Shrine of', lm_forest_temple: 'The Green Temple of', lm_colossal_stump: 'The Stump of', lm_moss_ruin: 'The Mossy Hall of',
    lm_giant_mushroom: 'The Toadstool Ring of', lm_camp_deserted: 'The Lost Camp of', lm_dragon_skeleton: 'The Wyrm-bones of', lm_carved_stone: 'The Runestone of', lm_brazier_huge: 'The Beacon of',
    lm_frozen_ship: 'The Ice-locked Ship of', lm_frozen_waterfall: 'The Frozen Falls of', lm_ice_formation: 'The Ice Spires of', lm_totem_ice: 'The Totem of', lm_longhouse_ruin: 'The Burnt Hall of',
    lm_old_foundation: 'The Old Walls of', lm_sinkhole: 'The Drowning Pit of', lm_dead_colossal_tree: 'The Dead Giant of', lm_obelisk_dark: 'The Black Needle of', lm_plague_cart: 'The Plague-cart of',
    lm_giant_skull: 'The Titan Skull of', lm_wagon_wreck: 'The Ambush at', lm_mausoleum: 'The Tomb of', lm_bone_totem: 'The Bone Idol of', lm_gallows: 'The Gibbet of',
  };

  function generate(seed) {
    const rng = new U.RNG(seed * 2654435761 + 11), W = 160000, C = W / 2;
    /* ---------------- the land ---------------- */
    const islands = [];
    islands.push({ x: C, y: C, r: 20000 });
    for (let i = 0; i < 150; i++) {
      const a = rng.range(0, TAU), d = 60000 * Math.sqrt(rng.next()), r = rng.range(8000, 15000) * (1 - d / 150000);
      const x = C + Math.cos(a) * d * 1.05, y = C + Math.sin(a) * d * 0.95;
      if (Math.hypot(x - C, y - C) + r > W * 0.45) continue;
      islands.push({ x, y, r });
    }
    const mainland = islands.length;
    for (let i = 0, made = 0; i < 80 && made < 7; i++) {
      const a = rng.range(0, TAU), d = rng.range(W * 0.36, W * 0.44), r = rng.range(2600, 5200);
      const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
      if (islands.slice(0, mainland).some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 2500)) continue;
      islands.push({ x, y, r }); made++;
    }
    const landK = (x, y, k) => islands.some((b) => Math.hypot(b.x - x, b.y - y) < b.r * k);
    const land = (x, y) => landK(x, y, 0.72);
    const randLand = (k, box) => { for (let i = 0; i < 600; i++) { const x = box ? rng.range(box[0], box[2]) : rng.range(4000, W - 4000), y = box ? rng.range(box[1], box[3]) : rng.range(4000, W - 4000); if (landK(x, y, k || 0.72)) return [x, y]; } return null; };

    /* ---------------- provinces ---------------- */
    const prov = [];
    for (let tries = 0; tries < 4000 && prov.length < 44; tries++) {
      const q = randLand(0.8); if (!q) continue;
      if (prov.some((p) => Math.hypot(p.x - q[0], p.y - q[1]) < 13500)) continue;
      prov.push({ x: q[0], y: q[1], i: prov.length });
    }
    const provAt = (x, y) => { let b = prov[0], bd = 1e18; for (const p of prov) { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd) { bd = d; b = p; } } return b; };
    // the player's castle province: the south-western heartland
    let home = prov[0];
    for (const p of prov) if ((p.x - 30000) * (p.x - 30000) + (p.y - 125000) * (p.y - 125000) < (home.x - 30000) * (home.x - 30000) + (home.y - 125000) * (home.y - 125000)) home = p;
    // themes: by quarter of the continent, with neighbours and chance mixing it up
    for (const p of prov) {
      const dx = (p.x - C) / 60000, dy = (p.y - C) / 60000, r = rng.next();
      let t;
      if (Math.hypot(dx, dy) < 0.32) t = r < 0.5 ? 'heartland' : r < 0.75 ? 'moor' : 'highlands';
      else if (dx < 0 && dy > 0) t = r < 0.5 ? 'heartland' : r < 0.75 ? 'shire' : r < 0.88 ? 'moor' : 'marsh';
      else if (dx < 0) t = r < 0.45 ? 'oldforest' : r < 0.75 ? 'pinewood' : r < 0.88 ? 'shire' : 'highlands';
      else if (dy < 0) t = r < 0.4 ? 'frost' : r < 0.75 ? 'highlands' : r < 0.88 ? 'pinewood' : 'moor';
      else t = r < 0.35 ? 'blight' : r < 0.6 ? 'badlands' : r < 0.82 ? 'marsh' : 'highlands';
      p.theme = t;
    }
    home.theme = 'heartland';
    // every theme at least once, away from home
    const order = Object.keys(THEME);
    for (const t of order) if (!prov.some((p) => p.theme === t)) { const cand = prov.filter((p) => p !== home && Math.hypot(p.x - home.x, p.y - home.y) > 20000).sort(() => rng.next() - 0.5); if (cand.length) cand[0].theme = t; }
    // a shire and an old forest within reach of home (the tour should not take an hour)
    const nearHome = prov.filter((p) => p !== home).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
    if (!nearHome.slice(0, 4).some((p) => p.theme === 'shire')) nearHome[0].theme = 'shire';
    if (!nearHome.slice(0, 6).some((p) => p.theme === 'oldforest')) nearHome.slice(1, 6).find((p) => p.theme !== 'shire').theme = 'oldforest';
    if (!nearHome.slice(0, 7).some((p) => p.theme === 'highlands')) nearHome.slice(2, 7).find((p) => p.theme !== 'shire' && p.theme !== 'oldforest').theme = 'highlands';
    // danger rises with distance from home
    for (const p of prov) { const d = Math.hypot(p.x - home.x, p.y - home.y); p.tier = d < 16000 ? 0 : d < 40000 ? 1 : d < 75000 ? 2 : 3; if (p.theme === 'blight' || p.theme === 'badlands') p.tier = Math.max(p.tier, 2); }

    /* ---------------- ground: regions, tints, trees ---------------- */
    const regions = [], tints = [], flora = [];
    for (const p of prov) {
      const T = THEME[p.theme];
      regions.push({ biome: T.biome, x: p.x, y: p.y, r: 9000 });
      if (T.k) tints.push({ x: p.x, y: p.y, r: 11000, col: T.tint, k: T.k });
      if (T.flora) flora.push({ x: p.x, y: p.y, r: 9500, kind: T.flora });
    }
    for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; regions.push({ biome: 'neutral', x: C + Math.cos(a) * W * 0.47, y: C + Math.sin(a) * W * 0.47, r: 9000 }); }

    /* ---------------- geography ---------------- */
    const mountains = [], forests = [], lakes = [{ x: C, y: C, r: W }];
    const inProv = (p, x, y) => provAt(x, y) === p;
    for (const p of prov) {
      const t = p.theme;
      // ranges: great ones in the highlands and the north, broken crags in the badlands, low hills elsewhere
      const R = t === 'highlands' ? [3, 4, 2600, [700, 950], [1.15, 1.45]] : t === 'frost' ? [2, 4, 2400, [600, 850], [1.0, 1.3]]
        : t === 'badlands' ? [6, 2, 1400, [300, 460], [0.55, 0.8]] : t === 'moor' ? [3, 3, 1800, [420, 560], [0.32, 0.45]]
        : t === 'heartland' || t === 'shire' ? [2, 3, 1700, [380, 520], [0.22, 0.32]] : t === 'blight' ? [2, 3, 2000, [380, 600], [0.5, 0.8]] : [1, 3, 1800, [380, 520], [0.3, 0.45]];
      for (let i = 0; i < R[0]; i++) {
        let x = p.x + rng.range(-5000, 5000), y = p.y + rng.range(-5000, 5000);
        if (!land(x, y)) continue;
        const pts = [[x, y]]; let a = rng.range(0, TAU);
        for (let s = 0, n = R[1] + rng.int(0, 2); s < n; s++) { a += rng.range(-0.5, 0.5); x += Math.cos(a) * R[2]; y += Math.sin(a) * R[2]; if (!land(x, y)) break; pts.push([x, y]); }
        if (pts.length > 1) mountains.push({ w: rng.range(R[3][0], R[3][1]), h: rng.range(R[4][0], R[4][1]), pts, prov: p.i, big: t === 'highlands' || t === 'frost' });
      }
      // forests
      const F = THEME[t].forest;
      for (let i = 0; i < F[0]; i++) { const x = p.x + rng.range(-6500, 6500), y = p.y + rng.range(-6500, 6500); if (land(x, y) && inProv(p, x, y)) forests.push({ x, y, r: rng.range(F[1], F[2]), d: F[3] * rng.range(0.85, 1) }); }
      // pools and tarns
      const nL = t === 'marsh' ? 22 : t === 'highlands' || t === 'frost' ? 2 : t === 'heartland' ? 1 : 0;
      for (let i = 0; i < nL; i++) { const x = p.x + rng.range(-6000, 6000), y = p.y + rng.range(-6000, 6000); if (landK(x, y, 0.6) && inProv(p, x, y)) lakes.push({ x, y, r: t === 'marsh' ? rng.range(110, 380) : rng.range(300, 650), after: true }); }
    }
    const nearRidge = (x, y, m, bigOnly) => mountains.some((r) => (!bigOnly || r.big) && r.pts.some((p, i) => i < r.pts.length - 1 && U.segDist(x, y, p[0], p[1], r.pts[i + 1][0], r.pts[i + 1][1]) < r.w + m));
    const nearLake = (x, y, m) => lakes.slice(1).some((l) => Math.hypot(l.x - x, l.y - y) < l.r * 1.25 + m);
    // rivers: from the high ground down to the sea
    const rivers = [], mouths = [];
    const starts = mountains.filter((m) => m.big).map((m) => m.pts[(m.pts.length / 2) | 0]).concat(prov.filter((p) => p.theme === 'moor' || p.theme === 'oldforest').map((p) => [p.x, p.y]));
    for (let i = 0; i < 16 && starts.length; i++) {
      const s0 = starts.splice(rng.int(0, starts.length - 1), 1)[0];
      let x = s0[0] + rng.range(-1500, 1500), y = s0[1] + rng.range(-1500, 1500);
      if (!land(x, y)) continue;
      const pts = [[x, y]];
      let a = Math.atan2(y - C, x - C) + rng.range(-0.7, 0.7), ok = false;
      for (let s = 0; s < 70; s++) {
        a += rng.range(-0.35, 0.35); x += Math.cos(a) * 1500; y += Math.sin(a) * 1500;
        if (nearRidge(x, y, 200, true)) { a += rng.next() < 0.5 ? 0.9 : -0.9; x -= Math.cos(a) * 600; y -= Math.sin(a) * 600; }
        pts.push([x, y]);
        if (!landK(x, y, 0.98)) { mouths.push({ x: pts[pts.length - 2][0], y: pts[pts.length - 2][1], a }); pts.push([x + Math.cos(a) * 2500, y + Math.sin(a) * 2500]); ok = true; break; }
      }
      if (ok && pts.length > 6) rivers.push({ w: rng.range(90, 150), pts }); else if (ok) mouths.pop();
    }
    const nearRiver = (x, y, m) => rivers.some((r) => r.pts.some((p, i) => i < r.pts.length - 1 && U.segDist(x, y, p[0], p[1], r.pts[i + 1][0], r.pts[i + 1][1]) < m));

    /* ---------------- places ---------------- */
    const castle = (() => { for (let i = 0; i < 300; i++) { const q = randLand(0.6, [home.x - 5000, home.y - 5000, home.x + 5000, home.y + 5000]); if (q && !nearRiver(q[0], q[1], 1200) && !nearRidge(q[0], q[1], 900) && !nearLake(q[0], q[1], 600)) return q; } return [home.x, home.y]; })();
    const sites = [], SPACE = { town: 2200, walledtown: 2600, stronghold: 2600, abbey: 1600, elfvillage: 1800, dwarfhold: 2400, shire: 2000, harbour: 1800, village: 1400, farmstead: 900, inn: 900 };
    const NAMES = {
      human: [['Ash', 'Bram', 'Thorn', 'Wick', 'Elm', 'Oak', 'Mill', 'Brook', 'Kings', 'Wolver', 'Ald', 'Hart', 'Fen', 'Bright', 'Cold', 'Red', 'Long', 'Mar'], ['bury', 'ford', 'ham', 'ton', 'field', 'stead', 'wick', 'by', 'well', 'bridge', 'cester', 'dale', 'holt', 'worth']],
      ice: [['Frost', 'Rime', 'Skal', 'Hrim', 'Ulf', 'Ygg', 'Sval', 'Kald', 'Isen', 'Bjorn'], ['heim', 'gard', 'vik', 'holm', 'fell', 'stad', 'berg', 'hald']],
      undead: [['Grim', 'Mor', 'Gloom', 'Ash', 'Raven', 'Bone', 'Dusk', 'Black', 'Wither', 'Dread'], ['moor', 'hollow', 'gate', 'barrow', 'mere', 'fen', 'reach', 'cairn']],
      elf: [['Silver', 'Star', 'Moon', 'Glimmer', 'Dawn', 'Willow', 'Ithil', 'Lorien', 'Elen', 'Fair'], ['glade', 'shade', 'bough', 'whisper', 'mere', 'leaf', 'brook', 'wood']],
      dwarf: [['Iron', 'Stone', 'Deep', 'Khaz', 'Barak', 'Gold', 'Anvil', 'Grim', 'Thrum', 'Dur'], ['hold', 'delve', 'hammer', 'forge', 'gate', 'deep', 'mount', 'hall']],
      hobbit: [['Bramble', 'Thistle', 'Under', 'Green', 'Buckle', 'Puddle', 'Mossy', 'Honey', 'Tuck', 'Sunny'], ['bottom', 'burrow', 'hill', 'bank', 'combe', 'hollow', 'dell', 'meadow']],
      wild: [['Raven', 'Wolf', 'Dead', 'Grey', 'Black', 'Lost', 'Weeping', 'Hollow', 'Shadow', 'Cold', 'Crow', 'Witch', 'Gallow', 'Grim', 'Thorn', 'Storm', 'Bleak', 'Mourn', 'Hag', 'Blood', 'Ash', 'Murk', 'Wyrm', 'Troll', 'Fang', 'Doom', 'Wraith', 'Ghoul', 'Iron', 'Red'],
        ['crag', 'mire', 'hollow', 'wood', 'tor', 'pit', 'deep', 'barrow', 'scar', 'fell', 'moss', 'fen', 'hold', 'cairn', 'gully', 'ridge', 'dell', 'combe', 'heath', 'knoll', 'reach', 'wold', 'mere', 'chase']],
    };
    const used = new Set();
    const nameOf = (cul) => {
      const N = NAMES[cul] || NAMES.human;
      for (let i = 0; i < 60; i++) { const n = rng.pick(N[0]) + rng.pick(N[1]); if (!used.has(n)) { used.add(n); return n; } }
      // (all the short names taken: an older, longer one)
      for (let i = 0; i < 200; i++) { const m = rng.pick(['Upper ', 'Lower ', 'Great ', 'Little ', 'Old ', 'High ', 'East ', 'West ', 'North ', 'South ', 'Far ', 'Deep ']) + rng.pick(N[0]) + rng.pick(N[1]); if (!used.has(m)) { used.add(m); return m; } }
      return rng.pick(N[0]) + rng.pick(N[1]);
    };
    const SUFFIX = { town: '', walledtown: '', stronghold: ' Castle', abbey: ' Abbey', elfvillage: '', dwarfhold: '', shire: '', harbour: ' Harbour', village: '', farmstead: ' Farm', inn: ' Inn', fort: ' Fort', goldmine: ' Mine', watchtower: ' Watch', ruins: ' Ruins', cave: ' Cave', dungeon: ' Deeps', banditcamp: ' Camp', nest: ' Eyrie', wizardtower: ' Tower', shrine: ' Shrine', magicwell: ' Well', grove: ' Grove', tradepost: ' Market' };
    const CUL = { heartland: 'human', shire: 'hobbit', oldforest: 'elf', pinewood: 'human', highlands: 'dwarf', frost: 'ice', moor: 'human', marsh: 'wild', badlands: 'wild', blight: 'undead' };
    const guardFor = (p, k, strength) => {
      const fam = rng.pick(BEASTS[p.theme]), t = p.tier + (strength || 0);
      return fam.map((role, i) => [role, Math.max(1, Math.round((BIG[role] ? 1 + t * 0.6 : 3 + t * 1.6) * (i ? 0.6 : 1) * rng.range(0.8, 1.2)))]);
    };
    const clearOf = (x, y, k) => {
      if (!(k === 'harbour' ? landK(x, y, 0.97) : land(x, y)) || nearRiver(x, y, k === 'harbour' ? 160 : 450) || nearLake(x, y, 250)) return false;
      if (k !== 'dwarfhold' && nearRidge(x, y, k === 'abbey' || k === 'watchtower' ? 150 : 500)) return false;
      if (Math.hypot(x - castle[0], y - castle[1]) < 2400) return false;
      const sp = SPACE[k] || 700;
      for (const s of sites) { const d = Math.hypot(s.x - x, s.y - y), need = Math.max(sp, SPACE[s.k] || 700); if (d < need) return false; }
      return true;
    };
    const add = (p, k, x, y, o) => {
      o = o || {};
      const cul = o.cul || (k === 'elfvillage' ? 'elf' : k === 'dwarfhold' ? 'dwarf' : k === 'shire' ? 'hobbit' : ['ruins', 'cave', 'dungeon', 'banditcamp', 'nest', 'landmark'].includes(k) ? 'wild' : (CUL[p.theme] === 'hobbit' || CUL[p.theme] === 'dwarf' || CUL[p.theme] === 'elf' || CUL[p.theme] === 'wild' ? 'human' : CUL[p.theme]));
      const s = { id: 's' + sites.length, k, name: o.name || nameOf(cul) + (SUFFIX[k] || ''), x: Math.round(x), y: Math.round(y), prov: p.i, theme: p.theme };
      if (o.culture) s.culture = o.culture;
      if (o.gen) s.gen = o.gen;
      if (o.guard) s.guard = o.guard;
      if (o.gate !== undefined) s.gate = o.gate;
      sites.push(s);
      return s;
    };
    // try to place a kind somewhere in a province (or near a point), with a test of its own
    const place = (p, k, n, o) => {
      o = o || {};
      let made = 0;
      for (let tries = 0; tries < 60 * n && made < n; tries++) {
        const R = o.r || 7000, cx = o.at ? o.at[0] : p.x, cy = o.at ? o.at[1] : p.y;
        const x = cx + rng.range(-R, R), y = cy + rng.range(-R, R);
        if (!o.at && !inProv(p, x, y)) continue;
        if (!clearOf(x, y, k)) continue;
        if (o.ok && !o.ok(x, y)) continue;
        add(p, k, x, y, typeof o.opts === 'function' ? o.opts(x, y) : o.opts);
        made++;
      }
      return made;
    };
    const hold = (k, chance) => (p) => (rng.next() < chance ? guardFor(p, k) : undefined);
    const forestAt = (x, y) => forests.some((f) => Math.hypot(f.x - x, f.y - y) < f.r * 0.7);
    // province by province, by theme
    for (const p of prov) {
      const t = p.theme, g = (k, s) => guardFor(p, k, s);
      const settled = { culture: CUL[t] === 'ice' ? 'ice' : CUL[t] === 'undead' ? 'undead' : t === 'heartland' && p.tier === 0 ? 'human' : undefined };
      if (t === 'heartland') {
        place(p, 'town', 1, { r: 3000, opts: () => settled });
        if (rng.next() < 0.55 || p === home) place(p, 'walledtown', 1, { opts: () => Object.assign({ guard: p.tier ? g('walledtown', 0) : undefined }, settled) });
        if (rng.next() < 0.6) place(p, 'stronghold', 1, { opts: () => Object.assign({ guard: g('stronghold', 1) }, settled) });
        place(p, 'abbey', 1, { opts: () => settled });
        place(p, 'village', 3, { opts: () => ({ guard: rng.next() < 0.3 ? g('village') : undefined }) });
        place(p, 'farmstead', 6);
        place(p, 'goldmine', 1, { opts: () => ({ guard: g('goldmine') }) });
        place(p, 'watchtower', 1);
        place(p, 'ruins', rng.int(0, 1), { opts: () => ({ guard: g('ruins') }) });
      } else if (t === 'shire') {
        place(p, 'shire', 2, { opts: () => ({ guard: rng.next() < 0.25 ? g('shire') : undefined }) });
        place(p, 'farmstead', 4); place(p, 'village', 1); place(p, 'inn', 1); if (rng.next() < 0.4) place(p, 'abbey', 1);
        place(p, 'grove', rng.int(0, 1));
      } else if (t === 'oldforest') {
        place(p, 'elfvillage', 2, { ok: forestAt, opts: () => ({ guard: rng.next() < 0.3 ? g('elfvillage') : undefined }) });
        place(p, 'grove', 2, { opts: () => ({ guard: g('grove') }) }); place(p, 'shrine', 1); place(p, 'wizardtower', 1, { opts: () => ({ guard: g('wizardtower') }) });
        place(p, 'cave', 2, { opts: () => ({ guard: g('cave', 1) }) }); place(p, 'ruins', 1, { opts: () => ({ guard: g('ruins') }) }); place(p, 'magicwell', 1);
      } else if (t === 'pinewood') {
        place(p, 'banditcamp', 2, { opts: () => ({ guard: g('banditcamp', 1) }) }); place(p, 'village', 1); place(p, 'ruins', 1, { opts: () => ({ guard: g('ruins') }) });
        place(p, 'cave', 1, { opts: () => ({ guard: g('cave', 1) }) }); place(p, 'watchtower', 1); place(p, 'dungeon', 1, { opts: () => ({ guard: g('dungeon', 1) }) });
      } else if (t === 'highlands' || t === 'frost') {
        // holds dug into the feet of the great ranges, the mountain behind them (north)
        const ranges = mountains.filter((m) => m.prov === p.i && m.big);
        let holds = 0;
        for (const m of ranges) {
          if (holds >= (t === 'highlands' ? 2 : 1)) break;
          for (let tries = 0; tries < 20; tries++) {
            const i = rng.int(0, m.pts.length - 2), a = m.pts[i], b = m.pts[i + 1], q = rng.range(0.2, 0.8), x0 = a[0] + (b[0] - a[0]) * q, y0 = a[1] + (b[1] - a[1]) * q;
            const x = x0, y = y0 + m.w * 0.9 + 220;
            if (clearOf(x, y, 'dwarfhold') && !nearRidge(x, y, -m.w * 0.35)) { add(p, 'dwarfhold', x, y, { guard: rng.next() < 0.35 ? g('dwarfhold', 1) : undefined }); holds++; break; }
          }
        }
        if (t === 'frost') { place(p, 'town', 1, { opts: () => ({ culture: 'ice' }) }); if (rng.next() < 0.4) place(p, 'abbey', 1, { opts: () => ({ culture: 'ice' }) }); if (rng.next() < 0.5) place(p, 'stronghold', 1, { opts: () => ({ culture: 'ice', guard: g('stronghold', 1) }) }); place(p, 'village', 2, { opts: () => ({ culture: 'ice' }) }); }
        place(p, 'goldmine', 2, { opts: () => ({ guard: g('goldmine') }) }); place(p, 'cave', 2, { opts: () => ({ guard: g('cave', 1) }) });
        place(p, 'watchtower', 1); place(p, 'fort', 1, { opts: () => ({ guard: g('fort', 1) }) }); place(p, 'nest', rng.int(0, 1));
      } else if (t === 'moor') {
        place(p, 'dungeon', 1, { opts: () => ({ guard: g('dungeon', 1), name: nameOf('wild') + ' Barrow' }) });
        place(p, 'banditcamp', 1, { opts: () => ({ guard: g('banditcamp', 1) }) }); place(p, 'ruins', 1, { opts: () => ({ guard: g('ruins') }) });
        place(p, 'village', 1); place(p, 'watchtower', 1); place(p, 'shrine', 1); if (rng.next() < 0.5) place(p, 'abbey', 1);
      } else if (t === 'marsh') {
        place(p, 'dungeon', 1, { opts: () => ({ guard: g('dungeon', 1), name: nameOf('wild') + ' Sunken Crypt' }) }); place(p, 'ruins', 2, { opts: () => ({ guard: g('ruins') }) });
        place(p, 'cave', 1, { opts: () => ({ guard: g('cave', 1) }) }); place(p, 'wizardtower', 1, { opts: () => ({ guard: g('wizardtower'), name: nameOf('wild') + ' Witch-tower' }) }); place(p, 'village', 1);
      } else if (t === 'badlands') {
        place(p, 'banditcamp', 2, { opts: () => ({ guard: g('banditcamp', 1) }) }); place(p, 'fort', 1, { opts: () => ({ guard: g('fort', 1), name: nameOf('wild') + ' Outlaw Keep' }) });
        place(p, 'cave', 2, { opts: () => ({ guard: g('cave', 1) }) }); place(p, 'dungeon', 1, { opts: () => ({ guard: g('dungeon', 1) }) }); place(p, 'nest', 1); place(p, 'goldmine', 1, { opts: () => ({ guard: g('goldmine') }) });
      } else if (t === 'blight') {
        place(p, 'town', 1, { opts: () => ({ culture: 'undead', guard: g('town', 0) }) }); place(p, 'stronghold', 1, { opts: () => ({ culture: 'undead', guard: g('stronghold', 1) }) });
        place(p, 'dungeon', 2, { opts: () => ({ guard: g('dungeon', 1), name: nameOf('undead') + ' Crypt' }) }); place(p, 'ruins', 2, { opts: () => ({ guard: g('ruins') }) });
      }
      // landmarks: one to three per province, worth the flight
      const marks = MARKS[t];
      for (let i = 0, n = rng.int(1, 3); i < n; i++) {
        const gen = rng.pick(marks);
        place(p, 'landmark', 1, { opts: () => ({ gen, name: (MARK_NAME[gen] || 'The Wonder of') + ' ' + nameOf('wild'), guard: rng.next() < 0.3 ? g('landmark') : undefined }) });
      }
    }
    // harbours at the river mouths (the river is the deep water beside the quays)
    for (const m of mouths) {
      const p = provAt(m.x, m.y);
      for (const side of [1, -1]) {
        const x = m.x - Math.sin(m.a) * 330 * side - Math.cos(m.a) * 300, y = m.y + Math.cos(m.a) * 330 * side - Math.sin(m.a) * 300;
        if (landK(x, y, 0.95) && clearOf(x, y, 'harbour')) { add(p, 'harbour', x, y, { culture: CUL[p.theme] === 'ice' ? 'ice' : CUL[p.theme] === 'undead' ? 'undead' : 'human' }); break; }
      }
    }

    /* ---------------- roads ---------------- */
    const MAJOR = { town: 1, walledtown: 1, stronghold: 1, dwarfhold: 1, harbour: 1, elfvillage: 1, shire: 1 };
    const MINOR = { village: 1, farmstead: 1, inn: 1, abbey: 1, goldmine: 1, fort: 1, watchtower: 1, shrine: 1, tradepost: 1 };
    const gateOf = { x: castle[0] + Math.cos(-0.6) * 520, y: castle[1] + Math.sin(-0.6) * 520 };
    const majors = [gateOf].concat(sites.filter((s) => MAJOR[s.k]));
    // no road straight over the sea, a lake or a mountain range (a hold at the foot of a range
    // is reached from its open side: the first and last 700 units are not checked for ridges)
    const seaBetween = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y); for (let t = 0; t < L; t += 500) { const x = a.x + (b.x - a.x) * t / L, y = a.y + (b.y - a.y) * t / L; if (!landK(x, y, 0.85) || (t > 700 && t < L - 700 && nearRidge(x, y, -100, true)) || nearLake(x, y, 0)) return true; } return false; };
    const edges = [];
    const has = (a, b) => edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
    // the major network: a spanning tree over the roads that can be built (shortest first,
    // joining separate networks), then the networks still apart on one land are joined by a
    // road that bends round what is between them; then each major place to its two nearest
    const up = majors.map((n, i) => i), root = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
      const pairs = [];
      for (let i = 0; i < majors.length; i++) for (let j = i + 1; j < majors.length; j++) { const d = Math.hypot(majors[i].x - majors[j].x, majors[i].y - majors[j].y); if (d < 26000) pairs.push([d, i, j]); }
      pairs.sort((p, q) => p[0] - q[0]);
      for (const [, i, j] of pairs) if (root(i) !== root(j) && !seaBetween(majors[i], majors[j])) { up[root(i)] = root(j); edges.push([majors[i], majors[j]]); }
      // (round the obstacle: a search over a coarse grid of open land, 1 km a cell)
      const GS = 1000, GN = W / GS, open = new Uint8Array(GN * GN);
      for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const x = (i + 0.5) * GS, y = (j + 0.5) * GS; open[j * GN + i] = landK(x, y, 0.85) && !nearRidge(x, y, 0, true) && !nearLake(x, y, 0) ? 1 : 0; }
      const detour = (A, B) => {
        const s0 = Math.floor(A.y / GS) * GN + Math.floor(A.x / GS), s1 = Math.floor(B.y / GS) * GN + Math.floor(B.x / GS);
        const cost = new Map([[s0, 0]]), from = new Map(), heap = [[0, s0]], bx = Math.floor(B.x / GS), by = Math.floor(B.y / GS);
        let it = 0;
        while (heap.length && it++ < 6000) {
          heap.sort((p, q) => q[0] - p[0]);
          const [, k] = heap.pop();
          if (k === s1) break;
          const ci = k % GN, cj = (k / GN) | 0, c = cost.get(k);
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ni = ci + di, nj = cj + dj, nk = nj * GN + ni;
            if ((!di && !dj) || ni < 0 || nj < 0 || ni >= GN || nj >= GN || (!open[nk] && nk !== s1)) continue;
            const nc = c + (di && dj ? 1.414 : 1);
            if (nc < (cost.has(nk) ? cost.get(nk) : 1e9)) { cost.set(nk, nc); from.set(nk, k); heap.push([nc + Math.hypot(ni - bx, nj - by), nk]); }
          }
        }
        if (!from.has(s1)) return null;
        const cells = []; for (let k = from.get(s1); k !== s0 && k !== undefined; k = from.get(k)) cells.push(k);
        cells.reverse();
        // waypoints every few cells, kept only where the straight run to them would be blocked
        const pts = [A]; let last = A;
        for (let q = 2; q < cells.length; q += 2) {
          const k = cells[q], P = { x: (k % GN + 0.5) * GS, y: (((k / GN) | 0) + 0.5) * GS, k: 'way' };
          const nx = cells[Math.min(cells.length - 1, q + 2)], Q = { x: (nx % GN + 0.5) * GS, y: (((nx / GN) | 0) + 0.5) * GS };
          if (seaBetween(last, Q)) { pts.push(P); last = P; }
        }
        if (seaBetween(last, B) && cells.length) { const k = cells[cells.length - 1], P = { x: (k % GN + 0.5) * GS, y: (((k / GN) | 0) + 0.5) * GS, k: 'way' }; if (P !== last) { pts.push(P); } }
        pts.push(B);
        return pts;
      };
      for (const [d, i, j] of pairs) {
        if (root(i) === root(j) || d > 24000) continue;
        const pts = detour(majors[i], majors[j]);
        if (!pts) continue;
        up[root(i)] = root(j);
        for (let q = 0; q < pts.length - 1; q++) edges.push([pts[q], pts[q + 1]]);
      }
      // (and the shortcuts a traveller would expect: each major place to its three nearest,
      // bending round what is between them when that is not too far about)
      const linkedP = new Set();
      for (const a of majors) { const near = majors.filter((b) => b !== a).map((b) => [Math.hypot(b.x - a.x, b.y - a.y), b]).sort((p, q) => p[0] - q[0]).slice(0, 3);
        for (const [d, b] of near) { const key = Math.min(a.x, b.x) + ',' + Math.max(a.x, b.x); if (d > 16000 || has(a, b) || linkedP.has(key)) continue; linkedP.add(key);
          if (!seaBetween(a, b)) { edges.push([a, b]); continue; }
          const pts = detour(a, b); if (!pts) continue;
          let L = 0; for (let q = 1; q < pts.length; q++) L += Math.hypot(pts[q].x - pts[q - 1].x, pts[q].y - pts[q - 1].y);
          if (L < d * 1.7) for (let q = 0; q < pts.length - 1; q++) edges.push([pts[q], pts[q + 1]]); } }
    // minor roads: each minor place to the nearest major place or minor already linked
    const linked = majors.slice();
    for (const s of sites.filter((q) => MINOR[q.k]).sort((a, b) => Math.hypot(a.x - gateOf.x, a.y - gateOf.y) - Math.hypot(b.x - gateOf.x, b.y - gateOf.y))) {
      const cand = linked.map((b) => [Math.hypot(b.x - s.x, b.y - s.y), b]).sort((p, q) => p[0] - q[0]);
      const near = cand.find(([d, b]) => d < 9000 && !seaBetween(s, b));
      if (near) { edges.push([s, near[1]]); linked.push(s); continue; }
      // (nothing straight: a road that bends round the river bend, lake or ridge in the way)
      for (const [d, b] of cand.slice(0, 3)) { if (d > 12000) break; const pts = detour(s, b); if (pts) { for (let q = 0; q < pts.length - 1; q++) edges.push([pts[q], pts[q + 1]]); linked.push(s); break; } }
    }
    // old roads trailing off into some ruins
    for (const s of sites.filter((q) => q.k === 'ruins' && rng.next() < 0.5)) { const near = linked.map((b) => [Math.hypot(b.x - s.x, b.y - s.y), b]).sort((p, q) => p[0] - q[0])[0]; if (near && near[0] < 7000 && !seaBetween(s, near[1])) edges.push([s, near[1]]); }
    const roads = [], bridges = [];
    const segX = (a, b, c, d) => { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return null; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null; };
    const crossings = [];
    // (the same Catmull-Rom smoothing the terrain gives rivers and roads: realm_terrain.js smoothLine)
    const smooth = (P, step) => { if (P.length < 3) return P.map((q) => [q[0], q[1]]); const out = [], at = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
      for (let i = 0; i < P.length - 1; i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
        for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
      out.push([P[P.length - 1][0], P[P.length - 1][1]]); return out; };
    const RS = rivers.map((r) => { const P = smooth(r.pts, 60); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } return { hw: r.w / 2, P, bb: [x0 - 600, y0 - 600, x1 + 600, y1 + 600] }; });
    // nearest river centre line: distance beyond the bank, and the way out
    // (river pieces by 1 km square, to look up only the ones nearby)
    const RH = new Map();
    RS.forEach((r, ri) => { for (let i = 0; i < r.P.length - 1; i++) { const a = r.P[i], b = r.P[i + 1]; for (let cy = Math.floor((Math.min(a[1], b[1]) - 300) / 1000); cy <= Math.floor((Math.max(a[1], b[1]) + 300) / 1000); cy++) for (let cx = Math.floor((Math.min(a[0], b[0]) - 300) / 1000); cx <= Math.floor((Math.max(a[0], b[0]) + 300) / 1000); cx++) { const k = cx * 4096 + cy; let l = RH.get(k); if (!l) RH.set(k, l = []); l.push(ri, i); } } });
    const riverAt = (x, y) => { let best = 1e9, nx = 0, ny = 0; const l = RH.get(Math.floor(x / 1000) * 4096 + Math.floor(y / 1000));
      if (l) for (let q = 0; q < l.length; q += 2) { const r = RS[l[q]], i = l[q + 1], a = r.P[i], b = r.P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)), px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py);
        if (d - r.hw < best) { best = d - r.hw; nx = d > 1e-6 ? (x - px) / d : -dy / Math.sqrt(L2); ny = d > 1e-6 ? (y - py) / d : dx / Math.sqrt(L2); } }
      return [best, nx, ny]; };
    const fitRoad = (L) => {
      // the crossings: where the line goes from one bank to the other
      const along = [0]; for (let i = 1; i < L.length; i++) along.push(along[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
      const X = [];
      for (let i = 0; i < L.length - 1; i++) { const l = RH.get(Math.floor(L[i][0] / 1000) * 4096 + Math.floor(L[i][1] / 1000)); if (l) for (let q = 0; q < l.length; q += 2) { const P = RS[l[q]].P, k = l[q + 1], t = segX(L[i], L[i + 1], P[k], P[k + 1]); if (t !== null) X.push([along[i] + (along[i + 1] - along[i]) * t, Math.atan2(P[k + 1][1] - P[k][1], P[k + 1][0] - P[k][0])]); } }
      X.sort((p, q) => p[0] - q[0]);
      const cr = X.filter((v, i) => !i || v[0] - X[i - 1][0] > 700);
      const posAt = (s) => { let i = 1; while (i < L.length - 1 && along[i] < s) i++; const t = (s - along[i - 1]) / Math.max(1e-6, along[i] - along[i - 1]); return [L[i - 1][0] + (L[i][0] - L[i - 1][0]) * t, L[i - 1][1] + (L[i][1] - L[i - 1][1]) * t]; };
      const SPAN = 340, out = [];
      // (each bridge crosses square to the river, however the road came to it)
      const end = along[along.length - 1];
      const fix = cr.map(([s, ra]) => {
        const c = posAt(s), p = posAt(s - 200), q = posAt(s + 200), rd = Math.atan2(q[1] - p[1], q[0] - p[0]);
        let an = ra + Math.PI / 2; if (Math.cos(an - rd) < 0) an += Math.PI;
        if (!bridges.some((o) => Math.hypot(o.x - c[0], o.y - c[1]) < 160)) bridges.push({ x: Math.round(c[0]), y: Math.round(c[1]), a: an });
        return { s, c, ux: Math.cos(an), uy: Math.sin(an) }; });
      for (let i = 0; i < L.length; i++) {
        let [x, y] = L[i];
        const f = fix.find((o) => Math.abs(along[i] - o.s) < SPAN);
        if (i === 0 || i === L.length - 1) { /* (the ends stay on their places) */ }
        else if (f) { const t = along[i] - f.s; x = f.c[0] + f.ux * t; y = f.c[1] + f.uy * t; }
        else if (along[i] > 150 && along[i] < end - 150) { const [d, nx, ny] = riverAt(x, y); if (d < 80) { x += nx * (90 - d); y += ny * (90 - d); } }
        out.push([x, y]);
      }
      return out;
    };
    edges.forEach(([A, B], n) => {
      const a = [A.x, A.y], b = [B.x, B.y], cross = [];
      for (const r of rivers) for (let q = 0; q < r.pts.length - 1; q++) { const t = segX(a, b, r.pts[q], r.pts[q + 1]); if (t !== null) cross.push(t); }
      cross.sort((p, q) => p - q);
      const way = [a];
      for (const t of cross) { const bx = a[0] + (b[0] - a[0]) * t, by = a[1] + (b[1] - a[1]) * t; way.push([bx, by]); if (MAJOR[A.k] || MAJOR[B.k]) crossings.push([bx, by, Math.atan2(b[1] - a[1], b[0] - a[0])]); }
      way.push(b);
      const pts = [];
      for (let q = 0; q < way.length - 1; q++) {
        const L = Math.hypot(way[q + 1][0] - way[q][0], way[q + 1][1] - way[q][1]);
        const r = L > 900 ? H.road(way[q], way[q + 1], 120, seed + n * 31 + q).pts : [way[q], way[q + 1]];
        pts.push(...(q ? r.slice(1) : r));
      }
      // the road as the game draws it (smoothed), kept off the river banks, straight over each
      // crossing, with a bridge at every one
      const line = fitRoad(smooth(pts, 70));
      pts.length = 0; pts.push(...line);
      roads.push({ pts });
      // a roadside inn halfway along the longer stretches
      if ((MAJOR[A.k] || A === gateOf) && MAJOR[B.k] && Math.hypot(b[0] - a[0], b[1] - a[1]) > 9000 && rng.next() < 0.6) {
        const mid = pts[(pts.length / 2) | 0], p = provAt(mid[0], mid[1]), ix = mid[0] + 90, iy = mid[1] + 110;
        if (clearOf(ix, iy, 'inn')) add(p, 'inn', ix, iy);
      }
    });
    // castles guard the river crossings of the major roads
    for (const [x, y, a] of crossings) {
      if (rng.next() > 0.45) continue;
      const p = provAt(x, y);
      for (const side of [1, -1]) {
        const cx = x - Math.sin(a) * 900 * side, cy = y + Math.cos(a) * 900 * side;
        if (clearOf(cx, cy, 'stronghold')) { add(p, 'stronghold', cx, cy, { culture: CUL[p.theme] === 'ice' ? 'ice' : CUL[p.theme] === 'undead' ? 'undead' : 'human', guard: guardFor(p, 'stronghold', 1) }); break; }
      }
    }

    /* ---------------- warbands, herds, runes ---------------- */
    const encounters = [];
    for (const p of prov) {
      if (p === home) continue;
      const n = p.tier >= 2 ? 3 : p.tier === 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const q = randLand(0.7, [p.x - 6000, p.y - 6000, p.x + 6000, p.y + 6000]); if (!q || !inProv(p, q[0], q[1])) continue;
        const fam = rng.pick(BEASTS[p.theme]), t = p.tier;
        const troops = fam.map((role, k) => [role, Math.max(1, Math.round((BIG[role] ? 1 + t : 5 + t * 3) * (k ? 0.5 : 1)))]);
        const e = { id: 'w' + encounters.length, name: (p.theme === 'blight' ? 'The Restless Dead' : p.theme === 'highlands' || p.theme === 'frost' ? 'Mountain raiders' : fam[0] === 'bandit' ? 'Outlaw band' : 'Hunting pack') + ' of ' + nameOf('wild'), x: q[0], y: q[1], troops };
        // outlaws prowl between two places on the roads
        if (fam[0] === 'bandit' || p.theme === 'blight') { const near = sites.filter((s) => s.prov === p.i).slice(0, 2); if (near.length === 2) e.patrol = [[near[0].x + 200, near[0].y + 200], [near[1].x + 200, near[1].y + 200]]; }
        encounters.push(e);
      }
    }
    const HERDS = { heartland: ['deer', 'horse', 'boar'], shire: ['deer', 'horse'], oldforest: ['deer', 'boar'], pinewood: ['boar', 'deer'], highlands: ['goat'], frost: ['goat', 'deer'], moor: ['horse', 'goat'], marsh: ['boar'], badlands: ['goat'], blight: ['boar'] };
    const wild = [];
    for (const p of prov) for (let i = 0; i < 5; i++) { const q = randLand(0.7, [p.x - 6000, p.y - 6000, p.x + 6000, p.y + 6000]); if (q && inProv(p, q[0], q[1])) wild.push({ k: rng.pick(HERDS[p.theme]), x: q[0], y: q[1], n: rng.int(3, 6) }); }
    const runes = [];
    for (let i = 0; i < 90; i++) { const q = randLand(0.7); if (q) runes.push(q); }

    return {
      id: 'hugeworld', name: 'The Great Continent (Huge World Test)', w: W, h: W, seed: seed % 997, index: 1,
      stream: true, riversCut: true, largeWorld: true, sandbox: true, highFlight: true, prefetchAll: true, simR: 3400, tacScale: 128, relief: { hmax: 620, m1: 1.4 },
      blurb: 'A generated continent about 160 km across, built around the dragon as it flies.',
      difficulty: 'Test',
      provinces: prov.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), theme: p.theme, tier: p.tier })),
      regions, tints, flora, factions: { human: { town: { x: castle[0], y: castle[1] }, gate: -0.6 } },
      lakes, islands, rivers, mountains, forests, roads, bridges, sites, encounters, wild, runes,
    };
  }
  AS.Maps.generateHuge = generate;
  AS.Maps.HUGE_THEMES = THEME;
  // made when first asked for, then kept
  Object.defineProperty(AS.Maps.byId, 'hugeworld', { configurable: true, enumerable: false, get() { const m = generate(+(AS.App && AS.App.params && AS.App.params.get('seed')) || 4242); Object.defineProperty(AS.Maps.byId, 'hugeworld', { value: m, configurable: true, enumerable: false }); return m; } });
})(window.AS);
