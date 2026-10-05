/* ALIEN STRIKE — hover inspection cards.
 * Rest the mouse on anything in the world (a structure, unit, boss, landmark, cargo,
 * pickup, survivor group, prop or rock formation) for about two seconds and a small
 * card appears beside it for a few seconds: its name, whose side it is on, what it
 * is or does, its health, and whether it belongs to an objective. Drawn from
 * AS.HUD.draw; it only reads the mouse position and never consumes input, so
 * aiming and firing are unaffected. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const DWELL = 2.0, SHOW = 5.5, GRACE = 0.3, ARM = 1.0;

  const SIDE = {
    hostile: { t: 'HOSTILE', col: '#ff6a4a', rgb: '255,106,74' },
    friendly: { t: 'FRIENDLY', col: '#7dff9a', rgb: '125,255,154' },
    neutral: { t: 'NEUTRAL', col: '#b9c6ce', rgb: '185,198,206' },
  };
  const ROLE = {
    turret: 'Defence turret — fires on your craft in range', sam: 'Missile battery — radar extends its range', radar: 'Radar — guides missile batteries onto you',
    comms: 'Calls enemy reinforcements', power: 'Powers nearby defences', shieldgen: 'Projects a shield over nearby targets', spawner: 'Produces enemy units',
    target: 'Strategic target', depot: 'Supply store — destroy it to release supplies', pad: 'Repair, refuel, rearm, drop-off', console: 'Hold E nearby to operate it',
    bunker: 'Sealed bunker — opens once unlocked', pen: 'Holds prisoners — destroy it to free them', iceblock: 'Survivors frozen inside — shoot it open',
    friendly: 'Allied installation — protect it', scenery: 'Inert structure',
  };
  const KIND = {
    flak: 'Anti-air flak — airbursts shred aircraft', pylon: 'Arc pylon — chain lightning at close range', aagun: 'Heavy cannon — deadly to aircraft',
    turret_organic: 'Living turret — spits bio rounds', lancertower: 'Crystal spire — fires piercing lances', fueldepot: 'Fuel store — destroy it to spill fuel cells',
    ammodepot: 'Munitions store — destroy it to spill ammo', derrick: 'Strip-mines the planet for the Choir', refinery: 'Processes ore for the Choir war machine', reactor: 'Powers the Choir base',
    growth: 'Hive growth — burns easily', sonar: 'Submerged emitter — scan it to expose it', resonator: 'Resonator spire — feeds a shield lattice',
    pheromone: 'Pheromone node — shields the hive', coolant: 'Coolant pump — keeps a core from overheating', sporeroot: 'Spore root — feeds a root shield',
    coupling: 'Power coupling — feeds a grid shield', shieldpylon: 'Sanctum pylon — seals the core', weaponcore: 'Heart of the planetary lance',
    station: 'Friendly outpost', dome: 'Colonists shelter here — protect it', heatstation: 'Thermal station — keeps survivors warm',
    crashedship: 'Allied wreck — protect it', wreckship: 'Wreckage of a colony survey ship', choirwreck: 'Wreckage of a Choir ship, locked in ice', obelisk: 'Ancient Choir standing stone',
    specimen: 'Native organism — harmless', platform: 'Raised colony platform', vent: 'Opening to the tunnels below', crusher: 'Heavy machinery — inert',
    relay: 'Hold E nearby to hack it', thumper: 'Hold E to lure a burrowing beast up here, stunned', valve: 'Hold E nearby to turn it',
    rod: 'Hold E nearby to raise it', switch: 'Hold E nearby to throw the switch', charge_site: 'Hold E nearby to set a charge',
    bunker: 'Hold E to open it once it is unlocked',
  };
  const AI = {
    pack: 'Fast pack hunter', burrower: 'Burrows and ambushes from below', infantry: 'Choir foot soldier', drone: 'Armed patrol drone',
    tank: 'Armoured hover tank', sam: 'Mobile missile launcher — locks on', strafer: 'Fast raider — makes strafing runs', artillery: 'Long-range artillery — lobs shells',
    repair: 'Repairs damaged Choir units', swarm: 'Swarming flyer', skirmish: 'Ranged spitter — keeps its distance', ambush: 'Hides, then strikes up close',
    bomber: 'Bomber — drops payloads below', turretcreature: 'Rooted creature — fires lances', walker: 'Heavy walker', submerger: 'Surfaces from the water to attack',
    interceptor: 'Fast interceptor — hunts aircraft', floater: 'Floating gun platform', mine: 'Drifting mine — explodes on contact', gunship: 'Heavily armed gunship',
    allytank: 'Allied tank — fights alongside you', allyair: 'Allied gunship — fights alongside you',
  };
  const LANDMARK = {
    crashColony: ['Crashed Colony Ship', 'Wreck of a colony transport'], crashChoir: ['Downed Choir Vessel', 'Wreck of a Choir warship'],
    skeletonBeast: ['Titan Skeleton', 'Remains of a giant native beast'], skeletonWorm: ['Fossil Wyrm', 'Remains of a colossal burrower'],
    colonyRuins: ['Colony Ruins', 'Abandoned colony buildings'], convoyHulk: ['Wrecked Convoy', 'Burnt-out colony haulers'],
    industrialStacks: ['Refinery Stacks', 'Abandoned colony industry'], drownedTower: ['Drowned Tower', 'A colony tower lost to the sea'],
    giantGear: ['Giant Gear', 'A fallen part of the machine world'], monolith: ['Choir Monolith', 'Ancient Choir standing stone'],
    choirTower: ['Choir Spire', 'Ancient Choir tower'], crystalCluster: ['Crystal Cluster', 'Natural crystal formation'], giantShrooms: ['Giant Fungi', 'Native fungal growth'],
  };
  const OBST = { spire: 'Rock Spire', tree: 'Giant Tree', column: 'Stone Column', bigShroom: 'Giant Mushroom', gearTower: 'Gear Tower' };
  const PROP = { crate: 'Supply Crate', barrel: 'Fuel Barrel', container: 'Cargo Container', fence: 'Fence', mast: 'Antenna Mast', pipe: 'Pipeline', wreck: 'Vehicle Wreck', lamp: 'Lamp Post', plant: 'Native Plant', crystals: 'Crystals', shroom: 'Fungus', gearbit: 'Machine Debris', coral: 'Coral' };
  const PICK = {
    fuel: 'Refuels the craft', ammo: 'Restocks your guns and missiles', missiles: 'Restocks missiles', repair: 'Repair kit, or hull repair when kits are full',
    shield: 'Overcharges your shields', special: 'One special weapon charge', tech: 'Alien tech — fabricate new weapons', salvage: 'Salvage — spend it in the hangar', intel: 'Mission intel',
  };
  const title = (t) => String(t || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const plural = (n) => /s$/.test(n) ? n : n + 's';

  /* ---------- what is it? ---------- */
  function objectiveFor(g, e) {
    const id = e.id;
    for (const o of g.script.objs) {
      if (o.state !== 'active' || !o.revealed) continue;
      if (id && ((o.targets && o.targets.includes(id)) || (o.items && o.items.includes(id)) || (o.groups && o.groups.includes(id)) || o.target === id || o.to === id)) return { o, hint: false };
      if (id && o.hint && o.hint.includes(id)) return { o, hint: true };
      if (e.isUnit && o.convoy && g.convoyUnits(o.convoy).includes(e)) return { o, hint: false };
    }
    if (id) for (const gr of g.groups) if (gr.caged === id && gr.remaining > 0) { const r = objectiveFor(g, gr); if (r) return { o: r.o, hint: true }; }
    return null;
  }
  function describe(g, e, type) {
    const r = { name: '', side: SIDE.neutral, desc: '', status: '', statusCol: '#c58aff', hp: false };
    if (type === 'unit') {
      const d = e.def || {};
      r.name = e.boss ? (e.bossName || d.name) : d.name || title(e.kind);
      r.side = e.team === 'player' ? SIDE.friendly : SIDE.hostile;
      r.desc = e.boss ? 'Boss — learn its pattern and its weak point' : d.ai === 'convoy' ? (e.team === 'player' ? 'Friendly convoy — escort it' : 'Enemy convoy vehicle') : AI[d.ai] || (d.cls === 'air' ? 'Hostile aircraft' : 'Hostile unit');
      if (e.boss && e.statusText) { const st = e.statusText(); if (st) { r.status = st; r.statusCol = e.isShielded && e.isShielded() ? '#c58aff' : '#ffc35a'; } }
      else if (e.isShielded && e.isShielded()) r.status = 'SHIELDED';
      else if (e.stun > 0) { r.status = 'STUNNED'; r.statusCol = '#9fd0ff'; }
      r.hp = !e.invuln;
    } else if (type === 'struct') {
      const d = e.def || {};
      r.name = (e.label && e.label !== d.name ? e.label : d.name) || title(e.kind);
      const team = e.team;
      r.side = e.role === 'pad' || team === 'player' ? SIDE.friendly : (team === 'neutral' || e.role === 'scenery' || e.role === 'depot' || e.role === 'iceblock') ? SIDE.neutral : SIDE.hostile;
      r.desc = KIND[e.kind] || ROLE[e.role] || 'Structure';
      if ((e.role === 'pen' || e.role === 'iceblock') && e.id) {
        let n = 0; for (const gr of g.groups) if (gr.caged === e.id) n += gr.remaining;
        if (n) r.desc = (e.role === 'iceblock' ? n + ' survivor' + (n === 1 ? '' : 's') + ' frozen inside — shoot it open' : 'Holds ' + n + ' prisoner' + (n === 1 ? '' : 's') + ' — destroy it to free them');
      }
      if (e.role === 'spawner' && d.spawn && d.spawn.types) r.desc = 'Produces ' + d.spawn.types.map((k) => plural((AS.Data.enemies[k] || {}).name || title(k))).join(', ');
      if (e.role === 'pad') {
        const pd = e.pad || {}, sv = [];
        if (pd.repair) sv.push('Repair'); if (pd.refuel) sv.push('Refuel'); if (pd.rearm) sv.push('Rearm'); if (pd.dropoff) sv.push('Drop-off');
        r.name = pd.lz || e.id === 'lz' ? 'Landing Zone' : d.name;
        r.desc = (pd.lz || e.id === 'lz' ? 'Extraction point · ' : '') + (sv.length ? sv.join(', ') : 'Landing only');
      }
      if (e.isShielded && e.isShielded()) r.status = 'SHIELDED — find its generator';
      else if (e.powered === false && e.team === 'enemy') { r.status = 'OFFLINE — power cut'; r.statusCol = '#9fd0ff'; }
      else if (e.stun > 0) { r.status = 'STUNNED'; r.statusCol = '#9fd0ff'; }
      else if (e.role === 'console' || e.role === 'bunker') {
        if (e.locked) { r.status = 'LOCKED'; r.statusCol = '#ffc35a'; }
        else if (e.activated) { r.status = e.kind === 'thumper' ? 'RECHARGING' : 'ACTIVATED'; r.statusCol = '#7dff9a'; }
        else { r.status = 'READY — HOLD E'; r.statusCol = '#7fe8ff'; }
      }
      r.hp = !e.invuln && e.maxHp > 1;
    } else if (type === 'landmark') {
      const L = LANDMARK[e.kind] || [title(e.kind), 'Landmark'];
      r.name = L[0]; r.desc = L[1];
    } else if (type === 'dropship') {
      r.name = 'Dropship'; r.side = SIDE.friendly; r.desc = 'Your carrier — land on the LZ beside it to extract';
    } else if (type === 'obstacle') {
      r.name = OBST[e.kind] || title(e.kind); r.desc = 'Tall terrain — blocks your flight path';
    } else if (type === 'prop') {
      r.name = PROP[e.kind] || title(e.kind);
      r.desc = e.kind === 'barrel' ? 'Explosive — damages everything nearby' : 'Breakable — sometimes hides supplies';
      r.hp = true;
    } else if (type === 'pickup') {
      r.name = e.info ? e.info.label : title(e.kind); r.side = SIDE.friendly; r.desc = (PICK[e.kind] || 'Supplies') + ' · fly over it';
    } else if (type === 'cargo') {
      r.name = e.label || 'Cargo';
      r.desc = 'Cargo — hold E above it to recover' + (e.deliver && e.deliver !== 'pad' ? ', then place it' : ', then land at a pad');
      if (e.locked) { const b = g.byId.get(e.locked); if (b && b.locked) { r.status = 'SEALED IN — OPEN THE VAULT FIRST'; r.statusCol = '#ffc35a'; } }
    } else if (type === 'group') {
      r.name = e.label || 'Survivors'; r.side = SIDE.friendly;
      const n = e.remaining;
      r.desc = n + ' survivor' + (n === 1 ? '' : 's') + ' waiting — hold E above them to lift';
      if (e.caged) { const c = g.byId.get(e.caged); if (c && c.alive) { r.status = 'TRAPPED — FREE THEM FIRST'; r.statusCol = '#ffc35a'; } }
    }
    r.name = String(r.name || '').toUpperCase();
    return r;
  }

  /* ---------- where is it on screen? ---------- */
  // opaque bounds of a single-frame sheet as fractions of its box (measured once, cached on the sheet)
  let scratch = null;
  function tight(sh) {
    if (sh.__tight !== undefined) return sh.__tight;
    sh.__tight = null;
    try {
      const img = sh.frames && sh.frames[0] && sh.frames[0][0];
      const iw = img && img.width, ih = img && img.height;
      if (!iw || !ih) return null;
      const k = Math.min(1, 128 / Math.max(iw, ih)), w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
      if (!scratch) { scratch = document.createElement('canvas'); scratch.width = scratch.height = 128; scratch.c = scratch.getContext('2d', { willReadFrequently: true }); }
      const c = scratch.c;
      c.clearRect(0, 0, 128, 128); c.drawImage(img, 0, 0, w, h);
      const d = c.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= x0 && y1 >= y0) sh.__tight = { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h };
    } catch (e) { sh.__tight = null; }
    return sh.__tight;
  }
  function sheetBox(R, cam, ws, sh, x, y, z, ix, it, ib) {
    const q = R.worldToScreen(x - sh.ax, y - z - sh.ay, cam);
    const w = sh.w * ws, h = sh.h * ws;
    const t = tight(sh);
    if (t) {
      // shave a little off the opaque bounds so thin spikes and outlines do not catch the cursor
      const tw = (t.x1 - t.x0) * w, th = (t.y1 - t.y0) * h;
      return { x0: q.x + t.x0 * w + tw * ix * 0.5, x1: q.x + t.x1 * w - tw * ix * 0.5, y0: q.y + t.y0 * h + th * it * 0.5, y1: q.y + t.y1 * h - th * ib * 0.5 };
    }
    return { x0: q.x + w * ix, x1: q.x + w * (1 - ix), y0: q.y + h * it, y1: q.y + h * (1 - ib) };
  }
  function circleBox(c, r) { return { x0: c.x - r, x1: c.x + r, y0: c.y - r, y1: c.y + r, circle: true, cx: c.x, cy: c.y, r }; }
  function inside(b, mx, my) {
    if (b.circle) return (mx - b.cx) * (mx - b.cx) + (my - b.cy) * (my - b.cy) <= b.r * b.r;
    return mx >= b.x0 && mx <= b.x1 && my >= b.y0 && my <= b.y1;
  }

  const Inspect = {
    cur: null, dwell: 0, shown: null, showT: 0, alpha: 0, lostT: 0, spent: null, debug: false,
    reset() { this.cur = null; this.dwell = 0; this.shown = null; this.showT = 0; this.alpha = 0; this.lostT = 0; this.spent = null; this.dsEnt = null; },
    isShowing(e) { return !!(this.shown && this.shown.e === e && this.alpha > 0.25); },
    // HUD panels the card must not cover
    avoidRects(W, H, s) {
      const HUD = AS.HUD, out = [
        { x0: 0, y0: 0, x1: 250 * s, y1: 84 * s }, // craft status
        { x0: 0, y0: H - 176 * s, x1: 176 * s, y1: H }, // radar
        { x0: W - 220 * s, y0: H - 120 * s, x1: W, y1: H }, // weapons
      ];
      for (const r of [HUD.cardRect, HUD.panelRect]) if (r) out.push({ x0: r.x - 8 * s, y0: r.y - 8 * s, x1: r.x + r.w + 8 * s, y1: r.y + r.h + 8 * s });
      return out;
    },
    alive(it) {
      const e = it.e;
      switch (it.type) {
        case 'group': return e.remaining > 0;
        case 'cargo': return !e.aboard && !e.delivered;
        case 'unit': return e.alive && !e.burrowed && !e.submerged && !e.hidden && !e.removed;
        case 'struct': return e.alive && !e.ruin;
        case 'prop': return e.alive && !e.removed;
        default: return e.alive !== false;
      }
    },
    // every inspectable thing whose hit area contains the mouse; the smallest one wins
    pick(g, mx, my, W, H, all) {
      const R = AS.Renderer, cam = g.camera, ws = R.worldScale(cam), s = AS.HUD.layoutS || 1;
      const pad = 160 * s;
      const onScr = (q) => q.x > -pad && q.y > -pad && q.x < W + pad && q.y < H + pad;
      let best = null, bestA = 1e18;
      const out = all ? [] : null;
      const test = (e, type, b) => {
        if (!b) return;
        if (out) out.push({ e, type, b });
        if (!inside(b, mx, my)) return;
        const a = b.circle ? Math.PI * b.r * b.r : (b.x1 - b.x0) * (b.y1 - b.y0);
        if (a < bestA) { bestA = a; best = { e, type, b }; }
      };
      const p = g.player;
      for (const u of g.units) {
        if (!u.alive || u.burrowed || u.submerged || u.hidden || u === p) continue;
        const c = R.worldToScreen(u.x, u.py, cam);
        if (!onScr(c)) continue;
        test(u, 'unit', circleBox(c, Math.max(11 * s, u.r * ws * 1.2)));
      }
      for (const st of g.structures) {
        if (!st.alive || st.ruin) continue;
        if (st.hidden && !g.revealHidden) continue;
        if (st.submerged && !st.scanned) continue;
        const c = R.worldToScreen(st.x, st.y, cam);
        if (!onScr(c)) continue;
        const sh = st.sheet;
        let b;
        if (sh) {
          b = sheetBox(R, cam, ws, sh, st.x, st.y, 0, 0.1, 0.08, 0.04);
          // never smaller than the footprint around the visual centre
          const cc = R.worldToScreen(st.x, st.py, cam), rr = st.r * ws;
          b = { x0: Math.min(b.x0, cc.x - rr), x1: Math.max(b.x1, cc.x + rr), y0: Math.min(b.y0, cc.y - rr * 0.8), y1: Math.max(b.y1, cc.y + rr * 0.6) };
          if (st.def && st.def.flat) b = { x0: c.x - rr, x1: c.x + rr, y0: c.y - rr * 0.7, y1: c.y + rr * 0.7 };
        } else b = circleBox(R.worldToScreen(st.x, st.py, cam), Math.max(12 * s, st.r * ws));
        test(st, 'struct', b);
      }
      for (const c of g.cargo) {
        if (c.aboard || c.delivered || (c.hidden && !g.revealHidden)) continue;
        const q = R.worldToScreen(c.x, c.y - (c.z || 0) - 6, cam);
        if (onScr(q)) test(c, 'cargo', circleBox(q, Math.max(11 * s, 14 * ws)));
      }
      const lvl = p && p.s ? p.s.scanLevel : 0;
      for (const q of g.pickups) {
        if (!q.alive || (q.hidden && lvl < 2 && !g.revealHidden)) continue;
        const c = R.worldToScreen(q.x, q.y - 7, cam);
        if (onScr(c)) test(q, 'pickup', circleBox(c, Math.max(10 * s, 11 * ws)));
      }
      for (const gr of g.groups) {
        if (!(gr.remaining > 0)) continue;
        if (gr.caged) { const cage = g.byId.get(gr.caged); if (cage && cage.alive) continue; } // the pen / ice block speaks for them
        const c = R.worldToScreen(gr.x, gr.y - 8, cam);
        if (onScr(c)) test(gr, 'group', circleBox(c, Math.max(16 * s, 30 * ws)));
      }
      for (const pr of g.props || []) {
        if (!pr.alive || pr.removed) continue;
        const c = R.worldToScreen(pr.x, pr.y - 5, cam);
        if (onScr(c)) test(pr, 'prop', circleBox(c, Math.max(8 * s, (pr.r + 4) * ws)));
      }
      // the carrier parked beside the LZ
      if (g.dropship && g.dropship.frames && g.extraction && g.state !== 'extracting') {
        const dx = g.dsOff ? g.dsOff[0] : 50, dy = g.dsOff ? g.dsOff[1] : -34;
        const ds = { kind: 'dropship', x: g.extraction.x + dx, y: g.extraction.y + dy, alive: true };
        const c = R.worldToScreen(ds.x, ds.y, cam);
        if (onScr(c)) test(this.dsEnt && this.dsEnt.x === ds.x && this.dsEnt.y === ds.y ? this.dsEnt : (this.dsEnt = ds), 'dropship', sheetBox(R, cam, ws, g.dropship, ds.x, ds.y, g.dropshipGrounded ? 0 : 16, 0.1, 0.08, 0.06));
      }
      for (const lm of g.landmarks || []) {
        if (!lm.sheet) continue;
        const c = R.worldToScreen(lm.x, lm.y, cam);
        if (!(c.x > -W && c.y > -H && c.x < W * 2 && c.y < H * 2)) continue;
        test(lm, 'landmark', sheetBox(R, cam, ws, lm.sheet, lm.x, lm.y, 0, 0.16, 0.12, 0.08));
      }
      for (const ob of g.obstacles || []) {
        if (!ob.sheet) continue;
        const c = R.worldToScreen(ob.x, ob.y, cam);
        if (!onScr(c)) continue;
        test(ob, 'obstacle', sheetBox(R, cam, ws, ob.sheet, ob.x, ob.y, 0, 0.2, 0.06, 0.04));
      }
      return all ? out : best;
    },
    update(g, W, H, dt) {
      const I = AS.Input, R = AS.Renderer, p = g.player;
      const usable = I.mouse.inside !== false && !(I.usingPad && I.padAim && I.padAim.active) && p && p.alive && !(p.dying > 0);
      const mx = I.mouse.x * R.dpr, my = I.mouse.y * R.dpr;
      const hit = usable ? this.pick(g, mx, my, W, H) : null;
      const e = hit ? hit.e : null;
      if (e !== (this.cur && this.cur.e)) { this.cur = hit; this.dwell = 0; if (e !== this.spent) this.spent = null; }
      else if (hit) this.cur = hit;
      const firing = I.mouse.l || I.mouse.r;
      if (this.cur && !firing) this.dwell += dt;
      if (this.cur && this.dwell >= DWELL && this.cur.e !== this.spent && (!this.shown || this.shown.e !== this.cur.e)) {
        this.shown = { e: this.cur.e, type: this.cur.type, b: this.cur.b, obj: objectiveFor(g, this.cur.e) };
        this.showT = SHOW; this.lostT = 0; this.alpha = 0;
      }
      if (this.shown) {
        const sh = this.shown;
        if (this.cur && this.cur.e === sh.e) { sh.b = this.cur.b; this.lostT = 0; } else this.lostT += dt;
        this.showT -= dt;
        const dead = !this.alive(sh);
        const want = dead || this.lostT > GRACE || this.showT <= 0 ? 0 : 1;
        this.alpha = U.approach(this.alpha, want, dt * (want ? 7 : 5));
        if (!want && this.alpha <= 0) { if (this.showT <= 0 && !dead) this.spent = sh.e; this.shown = null; }
      }
    },
    draw(ctx, g, s, W, H, dt) {
      this.update(g, W, H, dt);
      const HUD = AS.HUD, F = HUD.F, M = HUD.M;
      if (this.debug) {
        ctx.save(); ctx.lineWidth = 1;
        for (const it of this.pick(g, -9999, -9999, W, H, true)) {
          const b = it.b; ctx.strokeStyle = it.type === 'unit' ? '#f44' : it.type === 'struct' ? '#ff0' : it.type === 'landmark' ? '#0ff' : '#f0f';
          if (b.circle) { ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, TAU); ctx.stroke(); } else ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        }
        ctx.restore();
      }
      // arming cue: faint corner brackets while the cursor rests on something
      const c = this.cur;
      if (c && (!this.shown || this.shown.e !== c.e) && c.e !== this.spent && this.dwell > ARM) {
        const k = U.clamp((this.dwell - ARM) / (DWELL - ARM), 0, 1);
        const side = describeSide(g, c);
        brackets(ctx, c.b, s, side, 0.15 + 0.35 * k, 1.25 - 0.25 * k);
      }
      const sh = this.shown;
      if (!sh || this.alpha <= 0.01) return;
      const info = describe(g, sh.e, sh.type);
      const a = this.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      brackets(ctx, sh.b, s, info.side, 0.9, 1);
      // card layout
      const pad = 12 * s, lh = 18 * s;
      const fN = F(Math.round(15 * s), '700'), fD = F(Math.round(12.5 * s), '500'), fT = F(Math.round(10 * s), '700'), fS = F(Math.round(11 * s), '700');
      ctx.font = fT; const tagW = ctx.measureText(info.side.t).width + 12 * s;
      ctx.font = fN; const nameW = ctx.measureText(info.name).width;
      ctx.font = fD;
      const maxW = 300 * s;
      const lines = wrap(ctx, info.desc, maxW - pad * 2, 2);
      let w = Math.max(tagW + 8 * s + nameW, ...lines.map((l) => ctx.measureText(l).width), 180 * s) + pad * 2;
      const obj = sh.obj && sh.obj.o.state === 'active' ? sh.obj : null;
      let objTxt = '';
      if (obj) {
        const cat = HUD.CAT[obj.o.cat] || HUD.CAT.secondary;
        objTxt = (obj.hint ? 'KEY TO ' : '') + cat.name + ' OBJECTIVE';
        ctx.font = fS; w = Math.max(w, ctx.measureText(objTxt).width + pad * 2 + 16 * s);
      }
      if (info.status) { ctx.font = fS; w = Math.max(w, ctx.measureText(info.status).width + pad * 2); }
      w = Math.min(w, maxW + 40 * s);
      const hpFrac = info.hp && sh.e.maxHp > 0 ? U.clamp(sh.e.hp / sh.e.maxHp, 0, 1) : null;
      const shFrac = info.hp && sh.e.maxShield > 0 ? U.clamp(sh.e.shield / sh.e.maxShield, 0, 1) : null;
      let h = pad + 20 * s + lines.length * lh + (info.status ? 17 * s : 0) + (hpFrac !== null ? 14 * s : 0) + (shFrac !== null ? 6 * s : 0) + (obj ? 20 * s : 0) + pad - 4 * s;
      const b = sh.b;
      const mx = AS.Input.mouse.x * AS.Renderer.dpr, my = AS.Input.mouse.y * AS.Renderer.dpr;
      const big = b.x1 - b.x0 > 170 * s || b.y1 - b.y0 > 150 * s;
      // anchor: the target's bounds, or a small box around the cursor for big set pieces
      const A = big ? { x0: mx - 16 * s, x1: mx + 16 * s, y0: my - 16 * s, y1: my + 16 * s } : { x0: Math.min(b.x0, mx - 14 * s), x1: Math.max(b.x1, mx + 14 * s), y0: b.y0, y1: b.y1 };
      const gap = 14 * s, avoid = this.avoidRects(W, H, s);
      const cands = [
        { x: A.x1 + gap, y: A.y0 - 4 * s, side: 'r' }, { x: A.x0 - gap - w, y: A.y0 - 4 * s, side: 'l' },
        { x: (A.x0 + A.x1) / 2 - w / 2, y: A.y1 + gap, side: 'b' }, { x: (A.x0 + A.x1) / 2 - w / 2, y: A.y0 - gap - h, side: 't' },
      ];
      let pick = null;
      for (const c of cands) {
        const cx = U.clamp(c.x, 12 * s, W - w - 12 * s), cy = U.clamp(c.y, 12 * s, H - h - 12 * s);
        const r = { x0: cx, y0: cy, x1: cx + w, y1: cy + h };
        const bad = avoid.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0) || (r.x0 < mx && r.x1 > mx && r.y0 < my && r.y1 > my);
        if (!bad) { pick = { x: cx, y: cy, side: c.side }; break; }
      }
      if (!pick) pick = { x: U.clamp(cands[0].x, 12 * s, W - w - 12 * s), y: U.clamp(cands[0].y, 12 * s, H - h - 12 * s), side: 'r' };
      const x = pick.x, y = pick.y;
      // leader line from the card to the nearest bracket corner
      if (!big) {
        const lx = pick.side === 'l' ? x + w : pick.side === 'r' ? x : U.clamp((b.x0 + b.x1) / 2, x + 10 * s, x + w - 10 * s);
        const ly = pick.side === 'b' ? y : pick.side === 't' ? y + h : y + 16 * s;
        const tx = pick.side === 'l' ? b.x0 : pick.side === 'r' ? b.x1 : (b.x0 + b.x1) / 2, ty = pick.side === 'b' ? b.y1 : pick.side === 't' ? b.y0 : b.y0 + Math.min(16 * s, (b.y1 - b.y0) * 0.3);
        ctx.strokeStyle = 'rgba(' + info.side.rgb + ',0.55)'; ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.stroke();
      }
      HUD.glass(ctx, x, y, w, h, 6 * s, { col: info.side.col, rgb: info.side.rgb }, 0);
      // tag + name
      let yy = y + pad + 9 * s;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      HUD.rrect(ctx, x + pad, yy - 8 * s, tagW, 16 * s, 3 * s); ctx.fillStyle = 'rgba(' + info.side.rgb + ',0.2)'; ctx.fill();
      ctx.strokeStyle = 'rgba(' + info.side.rgb + ',0.75)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = fT; ctx.fillStyle = info.side.col; ctx.fillText(info.side.t, x + pad + 6 * s, yy + 0.5 * s);
      ctx.font = fN; ctx.fillStyle = '#f2f8fa'; ctx.fillText(HUD.fitText(ctx, info.name, w - pad * 2 - tagW - 8 * s), x + pad + tagW + 8 * s, yy + 0.5 * s);
      yy += 20 * s;
      ctx.font = fD; ctx.fillStyle = 'rgba(214,232,240,0.9)';
      for (const l of lines) { ctx.fillText(l, x + pad, yy + 0.5 * s); yy += lh; }
      if (info.status) { ctx.font = fS; ctx.fillStyle = info.statusCol; ctx.fillText(HUD.fitText(ctx, info.status, w - pad * 2), x + pad, yy + 0.5 * s); yy += 17 * s; }
      if (hpFrac !== null) {
        const bw = w - pad * 2 - 42 * s;
        const col = info.side === SIDE.friendly ? '#7dff9a' : info.side === SIDE.hostile ? '#ff5a3a' : '#b9c6ce';
        HUD.bar(ctx, x + pad, yy - 2.5 * s, bw, 5 * s, hpFrac, col);
        ctx.font = M(Math.round(10.5 * s)); ctx.fillStyle = 'rgba(214,232,240,0.85)'; ctx.textAlign = 'right';
        ctx.fillText(Math.ceil(hpFrac * 100) + '%', x + w - pad, yy + 0.5 * s); ctx.textAlign = 'left';
        yy += 6 * s;
        if (shFrac !== null) { HUD.bar(ctx, x + pad, yy, bw, 3 * s, shFrac, '#9a7aff'); yy += 6 * s; }
        yy += 8 * s;
      }
      if (obj) {
        const cat = HUD.CAT[obj.o.cat] || HUD.CAT.secondary;
        ctx.fillStyle = 'rgba(' + cat.rgb + ',0.18)'; ctx.fillRect(x + pad, yy - 6 * s, w - pad * 2, 1);
        yy += 6 * s;
        HUD.glyph(ctx, cat.glyph, x + pad + 4 * s, yy, 4.6 * s, cat.col, 0);
        ctx.font = fS; ctx.fillStyle = cat.col; ctx.fillText(objTxt, x + pad + 13 * s, yy + 0.5 * s);
      }
      ctx.restore();
    },
  };
  function describeSide(g, c) {
    if (c.type === 'unit') return c.e.team === 'player' ? SIDE.friendly : SIDE.hostile;
    if (c.type === 'struct') return describe(g, c.e, 'struct').side;
    if (c.type === 'group' || c.type === 'pickup' || c.type === 'dropship') return SIDE.friendly;
    return SIDE.neutral;
  }
  function brackets(ctx, b, s, side, alpha, grow) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const hw = (b.x1 - b.x0) / 2 * grow + 3 * s, hh = (b.y1 - b.y0) / 2 * grow + 3 * s;
    const L = Math.min(10 * s, hw * 0.6, hh * 0.6);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * alpha;
    ctx.lineCap = 'round';
    for (const [w, col] of [[3.6 * s, 'rgba(4,8,12,0.6)'], [1.6 * s, side.col]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const px = cx + sx * hw, py = cy + sy * hh;
        ctx.moveTo(px, py - sy * L); ctx.lineTo(px, py); ctx.lineTo(px - sx * L, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = ga;
  }
  function wrap(ctx, txt, maxW, maxLines) {
    const words = String(txt || '').split(' '), lines = [];
    let line = '';
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; if (lines.length >= maxLines) break; }
      else line = t;
    }
    if (line && lines.length < maxLines) lines.push(line);
    else if (line && lines.length >= maxLines) lines[maxLines - 1] = AS.HUD.fitText(ctx, lines[maxLines - 1] + ' ' + line, maxW);
    return lines.length ? lines : [''];
  }
  AS.Inspect = Inspect;
})(window.AS);
