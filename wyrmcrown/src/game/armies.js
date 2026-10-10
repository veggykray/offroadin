/* WYRMCROWN — INDEPENDENT ARMIES AND COMMANDERS (foundation).
 *
 * An ARMY is a record, not a crowd: who owns it, who leads it, how many of each
 * troop type it holds (Conquest troop types, conquest/data/troops.js, so leadership,
 * wages and combat numbers are the existing ones), how hurt they are, its morale,
 * where it is and what it has been told to do. It is the one truth about the army.
 *
 *   near the dragon   the army takes the field: its soldiers are ordinary AS.Troop
 *                     units (spawned through AS.Conquest.Battle.spawn, as the Wide
 *                     Realm campaign's army is) and fight with the real combat code.
 *                     Their deaths are the army's losses.
 *   far away          the soldiers are packed back into the record (exact counts and
 *                     health) and the army moves as one point along its planned route
 *                     at its march speed, in fixed steps (STEP) so the result does not
 *                     depend on the frame rate. A fight there is settled by the
 *                     auto-resolve (src/game/autoresolve.js) against the actual enemy
 *                     soldiers, whose losses are taken out of the field.
 *   underground       always a record: the dragon cannot follow. Encounters there are
 *                     settled by auto-resolve (or, later, a playable battle) on the
 *                     same record.
 *
 * Orders: follow (the dragon), hold, defend (a place), march (to a point or a route
 * node), attack (a place), retreat (to the nearest friendly settlement), enter (a
 * ground-only passage). Routes come from src/game/routes.js: the navigation grid for
 * ordinary ground (mountains, sea, rivers obeyed), explicit links for tunnels, with
 * data-driven permissions. Nothing ever teleports: switching between following and
 * independent orders changes the order on the same record.
 *
 * COMMANDERS (data/commanders.js) lead armies. One commander, one army; an army with
 * no commander may hold, defend where it stands, follow the dragon or fall back, but
 * not set out on an expedition. Commanders meet their army on the ground (they must
 * be near it) and can be wounded out of the fight (incapacitated, recovers at home)
 * or captured. `fate` records the outcome in a shape a later ransom / rescue system
 * can use: { kind: 'captured'|'incapacitated'|'killed', by, where, at, recoverAt,
 * ransom: null, rescue: null }.
 *
 * ENCOUNTERS are records too: { id, kind, at, node, a: armyId, b: {group|troops},
 * terrain, status: 'pending'|'done', autoAt, method, result }. resolve(g, id, 'auto')
 * settles one now; 'retreat' withdraws the army; a future 'battle' method must produce
 * the same result shape (autoresolve.js) and apply it with applyResult().
 *
 * State: g.armies. serialize(g) / restore(g, data) keep everything in plain JSON. */
'use strict';
(function (AS) {
  const U = AS.U;
  const STEP = 0.25;          // seconds per step of the off-field simulation
  const FIELD_R = 1700;       // armies within this of the dragon (or on screen) take the field
  const PACK_R = 2300;        // and are packed away again beyond this, when not fighting
  const ENGAGE_R = 300;       // an off-field army meets enemies this close
  const DEFEND_R = 420;       // a defending army meets them this close
  const MEET_R = 600;         // a commander must be this close to take up an army
  const RECOVER = 120;        // seconds for an incapacitated commander to recover
  const PENDING = 15;         // seconds before an unattended underground encounter is auto-resolved
  const NEED_CMDR = { march: 1, attack: 1, enter: 1 };
  /* Without a commander an army still moves and fights NEAR HOME: a march or an attack
   * whose goal is within LOCAL_R of the army's home, over ground (no tunnel, no sea), is a
   * local tactical order. Anything further is an expedition and needs a king or champion.
   * An uncommanded army facing OUTMATCH times its strength falls back on its own. */
  const LOCAL_R = 1600, OUTMATCH = 2.2;

  const Armies = {
    STEP, FIELD_R, PACK_R, ENGAGE_R, DEFEND_R, MEET_R, RECOVER, PENDING, LOCAL_R, OUTMATCH,
    // is (x, y) close enough to the army's home for an order without a commander?
    isLocal(a, q) { return !!q && Math.hypot(q.x - a.home.x, q.y - a.home.y) <= this.localR(); },
    localR() { return AS.Command ? AS.Command.CFG.LOCAL_R : this.LOCAL_R; }, // (one setting: Command Mode's CFG.LOCAL_R)

    /* ================= setup ================= */
    init(g) {
      g.armies = { list: [], byId: {}, cmdrs: {}, groups: {}, encounters: [], flags: {}, seq: 1, clock: 0, acc: 0, log: [], remarkT: {} };
      return g.armies;
    },
    troop(id) { return AS.Conquest.Data.troops[id]; },
    // a commander enters play: available at a place, or straight at the head of an army
    addCommander(g, id, owner, x, y) {
      const def = AS.Data.commanders[id]; if (!def) return null;
      const c = { id, owner, status: 'available', armyId: null, x, y, fate: null };
      g.armies.cmdrs[id] = c;
      return c;
    },
    cmdrDef(c) { return c ? AS.Data.commanders[c.id] : null; },
    create(g, o) {
      const A = g.armies;
      const a = {
        id: o.id || 'army' + A.seq++, name: o.name || 'Army', owner: o.owner || g.playerKey, cmdr: null,
        stacks: Object.assign({}, o.stacks || {}), wounds: Object.assign({}, o.wounds || {}), morale: o.morale === undefined ? 80 : o.morale,
        x: o.x, y: o.y, layer: 'surface', node: null, home: o.home || { x: o.x, y: o.y },
        order: { type: 'hold', x: o.x, y: o.y }, plan: null, status: 'holding', transport: o.transport || [],
        units: null, cmdrUnit: null, lastEnc: null, born: A.clock,
      };
      A.list.push(a); A.byId[a.id] = a;
      if (o.cmdr) { const r = this.assign(g, o.cmdr, a.id, { anywhere: true, quiet: true }); if (!r.ok) console.warn(r.reason); }
      if (o.order) this.order(g, a.id, o.order, { quiet: true });
      return a;
    },

    /* ================= counting ================= */
    // the army's troops right now (from the soldiers on the field, or the record)
    stacksOf(a) {
      if (!a.units) return a.stacks;
      const s = {};
      for (const u of a.units) if (u.alive && !u.removed) s[u.ctype] = (s[u.ctype] || 0) + 1;
      return s;
    },
    count(a) { let n = 0; const s = this.stacksOf(a); for (const k in s) n += s[k]; return n; },
    leadUsed(a, stacks) { let n = 0; const s = stacks || this.stacksOf(a); for (const k in s) n += (this.troop(k) ? this.troop(k).leadership : 10) * s[k]; return n; },
    leadCap(g, a) { const c = a.cmdr && g.armies.cmdrs[a.cmdr]; return c ? this.cmdrDef(c).leadership : Infinity; },
    // march speed: the slowest soldier, the commander's marching skill
    speedOf(g, a) {
      let v = 1e9;
      for (const k in this.stacksOf(a)) { const t = this.troop(k), B = t && AS.Data.troops[t.base]; if (B) v = Math.min(v, B.speed * ((t.mul && t.mul.speed) || 1)); }
      if (v > 1e8) v = 45;
      const c = a.cmdr && g.armies.cmdrs[a.cmdr], tr = c && this.cmdrDef(c).traits;
      return v * 0.92 * ((tr && tr.march) || 1);
    },
    pos(a) {
      if (!a.units) return { x: a.x, y: a.y };
      let x = 0, y = 0, n = 0;
      for (const u of a.units) if (u.alive && !u.removed) { x += u.x; y += u.y; n++; }
      return n ? { x: x / n, y: y / n } : { x: a.x, y: a.y };
    },
    // everything the realm holds for this side: the town and the places it owns
    friendlyPlaces(g, owner) {
      const out = [];
      const F = g.factions[owner];
      if (F && F.townPos) out.push({ id: 'home', name: (F.def && F.def.short) || 'home', x: F.townPos.x, y: F.townPos.y + 150 });
      for (const s of g.sites) if (s.owner === owner) out.push({ id: s.id, name: s.name, x: s.x, y: s.y + 40 });
      return out;
    },
    nearestFriendly(g, a) {
      const p = this.pos(a); let best = null, bd = 1e18;
      for (const q of this.friendlyPlaces(g, a.owner)) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd && AS.Routes.sameLand(g, p.x, p.y, q.x, q.y)) { bd = d; best = q; } }
      return best;
    },

    /* ================= commanders ================= */
    assign(g, cmdrId, armyId, o) {
      o = o || {};
      const A = g.armies, c = A.cmdrs[cmdrId], a = A.byId[armyId];
      if (!c || !a) return { ok: false, reason: 'unknown commander or army' };
      if (c.owner !== a.owner) return { ok: false, reason: this.cmdrDef(c).name + ' does not serve this side' };
      if (c.status !== 'available' || c.armyId) return { ok: false, reason: this.cmdrDef(c).name + (c.armyId ? ' already leads ' + A.byId[c.armyId].name : ' is ' + c.status) };
      if (a.cmdr) return { ok: false, reason: a.name + ' already has a commander (' + this.cmdrDef(A.cmdrs[a.cmdr]).name + ')' };
      if (a.layer !== 'surface') return { ok: false, reason: a.name + ' is underground' };
      const p = this.pos(a);
      if (!o.anywhere && Math.hypot(p.x - c.x, p.y - c.y) > MEET_R) return { ok: false, reason: this.cmdrDef(c).name + ' is too far away — bring the army to them' };
      const need = this.leadUsed(a), cap = this.cmdrDef(c).leadership;
      if (need > cap) return { ok: false, reason: this.cmdrDef(c).name + ' can lead ' + cap + ' leadership; ' + a.name + ' needs ' + need };
      c.status = 'leading'; c.armyId = a.id; a.cmdr = c.id; c.fate = null;
      if (a.units) this.spawnCommander(g, a);
      if (!o.quiet) { this.remark(g, c.id, 'assigned', true); this.note(g, this.cmdrDef(c).name + ' takes command of ' + a.name); }
      return { ok: true };
    },
    // the commander leaves the army and waits where it stands (an army must be at a friendly place)
    unassign(g, armyId, o) {
      o = o || {};
      const A = g.armies, a = A.byId[armyId]; if (!a || !a.cmdr) return { ok: false, reason: 'no commander' };
      const p = this.pos(a);
      if (!o.force && !this.friendlyPlaces(g, a.owner).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < MEET_R)) return { ok: false, reason: 'a commander can only be left at a friendly settlement' };
      const c = A.cmdrs[a.cmdr];
      this.dropCommander(g, a);
      c.status = 'available'; c.x = p.x; c.y = p.y;
      // without a commander the army stays put
      if (NEED_CMDR[a.order.type]) this.order(g, a.id, { type: 'defend' }, { quiet: true });
      return { ok: true };
    },
    dropCommander(g, a) {
      const c = a.cmdr && g.armies.cmdrs[a.cmdr];
      if (a.cmdrUnit) { a.cmdrUnit.onDeath = null; a.cmdrUnit.alive = false; a.cmdrUnit.removed = true; a.cmdrUnit = null; }
      if (c) { c.armyId = null; }
      a.cmdr = null;
    },
    // a commander is beaten: captured or wounded out of the fight
    defeatCommander(g, a, kind, by, where) {
      const A = g.armies, c = a.cmdr && A.cmdrs[a.cmdr]; if (!c) return;
      const p = this.pos(a), def = this.cmdrDef(c);
      this.remark(g, c.id, 'down', true);
      this.dropCommander(g, a);
      c.status = kind;
      c.fate = { kind, by: by || null, where: where || (a.layer === 'under' ? a.node : { x: Math.round(p.x), y: Math.round(p.y) }), at: +A.clock.toFixed(1), recoverAt: kind === 'incapacitated' ? +(A.clock + RECOVER).toFixed(1) : null, ransom: null, rescue: null };
      // the wounded are carried home; the captured stay with their captors
      if (kind === 'incapacitated') { const F = g.factions[c.owner], h = F && F.townPos; if (h) { c.x = h.x; c.y = h.y + 150; } }
      this.note(g, def.name + (kind === 'captured' ? ' has been CAPTURED' + (by ? ' by ' + by : '') : ' is wounded and carried from the field'), true);
      if (a.alive !== false && this.count(a) > 0 && NEED_CMDR[a.order.type]) this.order(g, a.id, { type: 'defend' }, { quiet: true, keep: true });
    },
    // the commander unit on the field fell
    commanderFell(g, a) {
      a.cmdrUnit = null;
      const live = this.count(a);
      this.defeatCommander(g, a, live > 0 ? 'incapacitated' : 'captured', live > 0 ? null : 'the enemy');
    },
    remark(g, cmdrId, ev, force) {
      const A = g.armies, c = A.cmdrs[cmdrId], def = c && this.cmdrDef(c);
      const lines = def && def.remarks && def.remarks[ev];
      if (!lines || !lines.length) return null;
      if (!force && A.clock < (A.remarkT[cmdrId] || 0)) return null;
      A.remarkT[cmdrId] = A.clock + 14;
      const line = lines[(Math.floor(A.clock * 7) + ev.length) % lines.length];
      if (g.news) g.news(def.name + ': ' + line, c.owner);
      A.lastRemark = { who: def.name, ev, line, at: A.clock };
      return line;
    },
    note(g, text, important) {
      const A = g.armies;
      A.log.push({ t: +A.clock.toFixed(1), text });
      if (A.log.length > 40) A.log.shift();
      if (g.news && important !== false) g.news(text, g.playerKey, !!important);
    },

    /* ================= orders ================= */
    // → { ok, reason, notes }
    order(g, armyId, o, opt) {
      opt = opt || {};
      const A = g.armies, a = A.byId[armyId];
      if (!a || a.status === 'destroyed') return { ok: false, reason: 'no such army' };
      const t = o.type;
      if (a.enc && !opt.keep) return { ok: false, reason: a.name + ' is fighting — resolve the encounter first' };
      const p = this.pos(a);
      const far = a.name + ' has no commander: it can move and fight near home (within ' + Math.round(this.localR() / 4) + ' m), but an expedition needs a king or champion';
      if (!a.cmdr && (NEED_CMDR[t] || t === 'defend' || t === 'local')) {
        const s = o.siteId && g.byId.get(o.siteId), q = s ? { x: s.x, y: s.y } : o.x !== undefined ? o : null;
        if (t === 'enter') return { ok: false, reason: a.name + ' has no commander: going underground needs a king or champion' };
        if (q ? !this.isLocal(a, q) : NEED_CMDR[t]) return { ok: false, reason: far };
      }
      if (a.layer === 'under' && t !== 'march' && t !== 'retreat' && t !== 'hold' && t !== 'defend') return { ok: false, reason: a.name + ' is underground' };
      let target = null, plan = null;
      if (t === 'follow') {
        if (a.layer === 'under') return { ok: false, reason: 'the dragon cannot be followed underground' };
      } else if (t === 'hold' || t === 'local' || (t === 'defend' && o.x === undefined && !o.siteId)) {
        target = a.layer === 'under' ? { node: a.node } : { x: p.x, y: p.y };
      } else {
        if (t === 'retreat') {
          if (a.layer === 'under') target = { node: a.lastSurface || a.node };
          else { const q = this.nearestFriendly(g, a); if (!q) return { ok: false, reason: 'nowhere to fall back to' }; target = { x: q.x, y: q.y, name: q.name }; }
        } else if (t === 'enter') {
          // a ground-only passage: to its mouth, through it, out of its far end
          a.speed = this.speedOf(g, a);
          plan = AS.Routes.passagePlan(g, Object.assign({}, a, { x: p.x, y: p.y }), o.passage);
          if (!plan.ok) return { ok: false, reason: plan.reason };
          const P = AS.Routes.passage(g, o.passage);
          target = { node: plan.exit, name: (AS.Routes.node(g, plan.exit) || {}).name, passage: P.name };
        } else if (o.siteId) { const s = g.byId.get(o.siteId); if (!s) return { ok: false, reason: 'no such place' }; target = { x: s.x, y: s.y + (t === 'attack' ? 0 : 60), siteId: s.id, name: s.name }; }
        else if (o.node) target = { node: o.node };
        else target = { x: o.x, y: o.y };
        if (!plan) {
          a.speed = this.speedOf(g, a);
          plan = AS.Routes.plan(g, Object.assign({}, a, { x: p.x, y: p.y }), target);
          if (!plan.ok) return { ok: false, reason: plan.reason };
          if (!a.cmdr && plan.legs.some((L) => L.kind === 'link')) return { ok: false, reason: far };
        }
      }
      // the order stands
      a.order = Object.assign({ type: t }, target || {}, o.siteId ? { siteId: o.siteId } : {});
      a.plan = plan ? { legs: plan.legs, li: 0, pi: 1, lt: 0 } : null;
      a.status = t === 'follow' ? 'following' : t === 'hold' ? 'holding' : t === 'local' ? 'commanded' : t === 'defend' && !plan ? 'defending' : 'moving';
      a.followAt = null;
      if (t === 'retreat') a.morale = Math.max(a.morale, 15);
      if (a.units && t !== 'local') this.fieldOrders(g, a); // ('local': the soldiers take their orders one by one, src/game/command.js)
      if (!opt.quiet) {
        if (a.cmdr) this.remark(g, a.cmdr, t === 'enter' ? 'enter' : t, true);
        this.note(g, a.name + ': ' + this.describeOrder(g, a), false);
      }
      return { ok: true, notes: plan ? plan.notes : [] };
    },
    describeOrder(g, a) {
      const o = a.order, nm = o.name || (o.siteId && g.byId.get(o.siteId) && g.byId.get(o.siteId).name) || (o.node && (AS.Routes.node(g, o.node) || {}).name);
      switch (o.type) {
        case 'follow': return 'following the dragon';
        case 'hold': return 'holding its ground';
        case 'defend': return 'defending ' + (nm || 'its position');
        case 'march': return 'marching to ' + (nm || 'a point');
        case 'attack': return 'attacking ' + (nm || 'a point');
        case 'retreat': return 'falling back to ' + (nm || 'safety');
        case 'enter': return 'taking ' + (o.passage || 'the passage') + ' to ' + (nm || 'the far side');
        case 'local': return 'under your direct command';
      }
      return o.type;
    },

    /* ================= the field: soldiers near the dragon ================= */
    materialize(g, a) {
      if (a.units || a.layer !== 'surface' || a.status === 'destroyed') return;
      const F = g.factions[a.owner], pal = F ? F.def.pal : AS.Data.pal.neutral;
      const units = []; let i = 0;
      for (const k in a.stacks) for (let n = 0; n < a.stacks[k]; n++) {
        const an = i * 2.399, r = 18 + Math.sqrt(i) * 15; i++;
        let px = a.x + Math.cos(an) * r, py = a.y + Math.sin(an) * r * 0.8;
        if (!g.terrain.groundPassable(px, py)) { px = a.x; py = a.y; }
        const u = AS.Conquest.Battle.spawn(g, k, a.owner, px, py, pal);
        u.hp = u.maxHp * U.clamp(a.wounds[k] === undefined ? 1 : a.wounds[k], 0.05, 1);
        u.armyId = a.id; u.state = 'march'; u.path = null; u.dest = { x: px, y: py, r: 30 }; u.home = { x: px, y: py, r: 200 };
        if (F) F.troops.push(u);
        units.push(u);
      }
      a.units = units; a.fieldN = units.length;
      if (a.cmdr) this.spawnCommander(g, a);
      this.fieldOrders(g, a);
    },
    spawnCommander(g, a) {
      const c = g.armies.cmdrs[a.cmdr], def = this.cmdrDef(c), F = g.factions[a.owner];
      if (a.cmdrUnit || !a.units) return;
      const p = this.pos(a);
      const u = new AS.Troop(g, def.field.base, a.owner, p.x, p.y + 10, { gen: def.field.gen, hpMul: def.field.hp, pal: F ? F.def.pal : undefined });
      u.cmdrOf = a.id; u.cmdrName = def.name; u.crest = def.field.crest; u.drawScale = def.field.scale;
      u.state = 'march'; u.path = null; u.dest = { x: p.x, y: p.y, r: 30 };
      u.onDeath = () => this.commanderFell(g, a);
      g.troops.push(u); if (F) F.troops.push(u);
      a.cmdrUnit = u;
    },
    // pack the soldiers back into the record (exact counts, their health)
    dematerialize(g, a) {
      if (!a.units) return;
      const p = this.pos(a), st = {}, hp = {}, max = {};
      for (const u of a.units) {
        if (!u.alive || u.removed) continue;
        st[u.ctype] = (st[u.ctype] || 0) + 1; hp[u.ctype] = (hp[u.ctype] || 0) + u.hp; max[u.ctype] = (max[u.ctype] || 0) + u.maxHp;
        u.onDeath = null; u.alive = false; u.removed = true;
      }
      if (a.cmdrUnit) { a.cmdrUnit.onDeath = null; a.cmdrUnit.alive = false; a.cmdrUnit.removed = true; a.cmdrUnit = null; }
      a.stacks = st; a.wounds = {};
      for (const k in st) a.wounds[k] = +(hp[k] / max[k]).toFixed(3);
      a.x = p.x; a.y = p.y;
      a.units = null;
      // carry on along the route from the nearest point ahead
      const L = a.plan && a.plan.legs[a.plan.li];
      if (L && L.kind === 'walk') a.plan.pi = this.nearestAhead(L.pts, p.x, p.y);
    },
    nearestAhead(pts, x, y) {
      let best = 1, bd = 1e18;
      for (let i = 1; i < pts.length; i++) { const d = U.segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); if (d < bd) { bd = d; best = i; } }
      return best;
    },
    // tell the soldiers on the field what the army is doing
    fieldOrders(g, a) {
      const live = a.units.filter((u) => u.alive && !u.removed);
      if (a.cmdrUnit) live.push(a.cmdrUnit);
      const p = this.pos(a), o = a.order, L = a.plan && a.plan.legs[a.plan.li];
      const form = (cx, cy, i, spread) => { const an = i * 2.399, r = (spread || 20) + Math.sqrt(i) * 16; return [cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.8]; };
      live.forEach((u, i) => { u.noFight = o.type === 'retreat'; u.focus = null; u.disengage = false; u.leash = null; u.assault = null; }); // (an army order replaces any Command Mode order)
      if (L && L.kind === 'walk') {
        const pts = [[p.x, p.y]].concat(L.pts.slice(Math.max(1, a.plan.pi)));
        const end = pts[pts.length - 1];
        live.forEach((u, i) => { const f = form(end[0], end[1], i); u.state = 'march'; u.path = pts; u.pi = 1; u.dest = { x: f[0], y: f[1], r: 34, siege: false }; u.recall = false; });
        return;
      }
      const at = o.type === 'defend' || o.type === 'attack' || o.type === 'hold' ? (o.x !== undefined ? { x: o.x, y: o.y } : p) : p;
      live.forEach((u, i) => {
        const f = form(at.x, at.y, i);
        if (o.type === 'defend') { u.state = 'guard'; u.home = { x: f[0], y: f[1], r: 120 }; u.path = null; u.dest = null; }
        else { u.state = 'march'; u.path = AS.Nav.path(g, u.x, u.y, f[0], f[1]); u.pi = 1; u.dest = { x: f[0], y: f[1], r: 30, siege: o.type === 'attack' }; }
      });
    },

    /* ================= the frame ================= */
    update(g, dt) {
      const A = g.armies; if (!A) return;
      A.acc += dt;
      let steps = 0;
      while (A.acc >= STEP && steps < 40) { A.acc -= STEP; steps++; this.step(g, STEP); }
      // field soldiers: losses, morale, arrival, packing away
      for (const a of A.list) if (a.units) this.fieldTick(g, a, dt);
    },
    // one fixed step of the world of armies (deterministic: the same steps give the same result)
    step(g, h) {
      const A = g.armies;
      A.clock += h;
      const p = g.player, cam = g.camera;
      for (const a of A.list) {
        if (a.status === 'destroyed') continue;
        // the field or the record?
        if (a.layer === 'surface' && p) {
          const q = this.pos(a), d = Math.hypot(q.x - p.x, q.y - p.y);
          const seen = cam && q.x > cam.x - 150 && q.x < cam.x + cam.w + 150 && q.y > cam.y - 150 && q.y < cam.y + cam.h + 250;
          if (!a.units && (d < FIELD_R || seen) && !a.enc && !a.inLink) this.materialize(g, a);
          else if (a.units && d > PACK_R && !seen && !this.fighting(a)) this.dematerialize(g, a);
        }
        if (!a.units) this.recordStep(g, a, h);
        // a commander standing about near the dragon says something now and then
        if (a.cmdr && a.units && !a.enc && (a.status === 'holding' || a.status === 'defending')) {
          if (a.idleAt === undefined) a.idleAt = A.clock + 60;
          else if (A.clock >= a.idleAt) { a.idleAt = A.clock + 75; this.remark(g, a.cmdr, 'idle'); }
        }
        // morale returns when nobody is fighting
        if (!a.enc && !(a.units && this.fighting(a))) a.morale = Math.min(100, a.morale + h * 1.5);
      }
      // commanders recovering from wounds
      for (const id in A.cmdrs) { const c = A.cmdrs[id]; if (c.status === 'incapacitated' && c.fate && A.clock >= c.fate.recoverAt) { c.status = 'available'; this.note(g, this.cmdrDef(c).name + ' has recovered and waits at home'); } }
      // pending encounters nobody attends to are settled
      for (const e of A.encounters) if (e.status === 'pending' && A.clock >= e.autoAt) this.resolve(g, e.id, 'auto');
    },
    fighting(a) { if (!a.units) return false; for (const u of a.units) if (u.alive && u.target && u.target.alive && !u.target.isDragon) return true; return false; },

    // an army moving as a record
    recordStep(g, a, h) {
      if (a.enc) return;
      const o = a.order;
      if (o.type === 'follow') return this.followRecord(g, a, h);
      if (a.layer === 'surface') {
        // enemies in the way
        const foes = this.foesNear(g, a, a.x, a.y, o.type === 'defend' || o.type === 'hold' ? DEFEND_R : ENGAGE_R);
        if (foes.length && o.type !== 'retreat') return this.fieldEncounter(g, a, foes);
      }
      const P = a.plan; if (!P) return;
      const L = P.legs[P.li];
      if (!L) return this.arrive(g, a);
      if (L.kind === 'walk') {
        let budget = this.speedOf(g, a) * h * (g.terrain.roadDist && g.terrain.roadDist(a.x, a.y) < 40 ? 1.15 : 1);
        while (budget > 0 && P.pi < L.pts.length) {
          const wp = L.pts[P.pi], dx = wp[0] - a.x, dy = wp[1] - a.y, d = Math.hypot(dx, dy);
          if (d <= budget) { a.x = wp[0]; a.y = wp[1]; budget -= d; P.pi++; }
          else { a.x += dx / d * budget; a.y += dy / d * budget; budget = 0; }
        }
        if (P.pi >= L.pts.length) this.nextLeg(g, a);
      } else {
        // through an explicit connection: time, not ground
        if (P.lt === 0) this.enterLink(g, a, L);
        P.lt += h;
        if (P.lt >= L.travel) this.leaveLink(g, a, L);
      }
    },
    nextLeg(g, a) { const P = a.plan; P.li++; P.pi = 1; P.lt = 0; if (!P.legs[P.li]) this.arrive(g, a); else if (a.units) this.fieldOrders(g, a); },
    enterLink(g, a, L) {
      const P = a.plan;
      P.lt = 1e-6;
      if (a.units) this.dematerialize(g, a);
      if (L.under && a.layer === 'surface') {
        // into the ground: the soldiers file into the entrance and the dragon is left behind
        a.lastSurface = L.from; a.layer = 'under';
        if (a.cmdr) this.remark(g, a.cmdr, 'enter');
        this.note(g, a.name + ' goes underground at ' + ((AS.Routes.node(g, L.from) || {}).name || 'the entrance'), false);
      }
      a.node = L.from; a.inLink = L.link;
      const n = AS.Routes.node(g, L.from); if (n && n.x !== undefined && a.layer === 'surface') { a.x = n.x; a.y = n.y; }
    },
    leaveLink(g, a, L) {
      const n = AS.Routes.node(g, L.to);
      a.node = L.to; a.inLink = null;
      const surf = n && (n.layer || 'surface') === 'surface';
      if (surf) {
        if (a.layer === 'under') this.note(g, a.name + ' comes up at ' + n.name, false);
        a.layer = 'surface'; a.x = n.x; a.y = n.y;
      } else a.mx = n && n.mx;
      // something waiting here?
      if (!surf) { const G = this.groupAt(g, L.to, a.owner); if (G) { this.underEncounter(g, a, G); return; } }
      if (surf) a.node = null;
      this.nextLeg(g, a);
    },
    groupAt(g, node, owner) { for (const id in g.armies.groups) { const G = g.armies.groups[id]; if (G.node === node && !G.defeated && G.team !== owner && AS.AutoResolve.count(G.stacks) > 0) return G; } return null; },
    // the end of the route
    arrive(g, a) {
      const o = a.order;
      a.plan = null;
      if (o.type === 'attack' && a.layer === 'surface') {
        const foes = a.units ? [] : this.foesNear(g, a, o.x, o.y, 600);
        if (foes.length) { this.fieldEncounter(g, a, foes, { attack: true }); return; }
        const s = o.siteId && g.byId.get(o.siteId);
        if (s && !a.units && !(s.guarded && s.guarded()) && s.owner !== a.owner && s.setOwner) { s.setOwner(a.owner); this.note(g, a.name + ' takes ' + s.name, true); }
        a.order = { type: 'defend', x: o.x, y: o.y + 60, siteId: o.siteId, name: o.name };
      } else if (o.type === 'retreat') a.order = { type: 'defend', x: a.x, y: a.y, name: o.name };
      else if (o.type === 'defend') a.order = Object.assign({}, o);
      else a.order = { type: a.layer === 'under' ? 'hold' : 'hold', x: a.x, y: a.y, node: a.layer === 'under' ? a.node : undefined, name: o.name };
      a.status = a.order.type === 'defend' ? 'defending' : 'holding';
      this.note(g, a.name + ' has arrived' + (o.name ? ' at ' + o.name : '') + ' and is ' + this.describeOrder(g, a), false);
      if (a.units) this.fieldOrders(g, a);
    },
    // following the dragon as a record: a walking route to where it is, renewed as it moves
    followRecord(g, a, h) {
      const p = g.player; if (!p || p.down > 0) return;
      const foes = this.foesNear(g, a, a.x, a.y, ENGAGE_R);
      if (foes.length) return this.fieldEncounter(g, a, foes);
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < 300) return;
      const stale = !a.plan || !a.followAt || Math.hypot(a.followAt.x - p.x, a.followAt.y - p.y) > 400 || g.armies.clock - a.followAt.t > 6;
      if (stale) {
        if (a.blockT && g.armies.clock < a.blockT) return;
        const w = AS.Routes.walk(g, a.x, a.y, p.x, p.y);
        a.followAt = { x: p.x, y: p.y, t: g.armies.clock };
        if (!w) { a.blockT = g.armies.clock + 6; a.plan = null; a.status = 'blocked'; return; }
        a.plan = { legs: [{ kind: 'walk', pts: w }], li: 0, pi: 1, lt: 0 }; a.status = 'following';
      }
      const P = a.plan, L = P.legs[0];
      let budget = this.speedOf(g, a) * h;
      while (budget > 0 && P.pi < L.pts.length) {
        const wp = L.pts[P.pi], dx = wp[0] - a.x, dy = wp[1] - a.y, dd = Math.hypot(dx, dy);
        if (dd <= budget) { a.x = wp[0]; a.y = wp[1]; budget -= dd; P.pi++; } else { a.x += dx / dd * budget; a.y += dy / dd * budget; budget = 0; }
      }
    },
    // the soldiers on the field, every frame
    fieldTick(g, a, dt) {
      const live = a.units.filter((u) => u.alive && !u.removed);
      // losses wear down morale; an army that breaks falls back
      const lost = a.fieldN - live.length;
      if (lost > 0) { a.morale -= lost / Math.max(1, a.fieldN) * 60; a.fieldN = live.length; }
      if (!live.length) { this.destroyed(g, a, 'the enemy'); return; }
      if (a.morale < AS.AutoResolve.BREAK && a.order.type !== 'retreat' && this.fighting(a)) {
        this.note(g, a.name + ' breaks and falls back!', true);
        if (a.cmdr) this.remark(g, a.cmdr, 'retreat', true);
        this.order(g, a.id, { type: 'retreat' }, { quiet: true, keep: true });
        return;
      }
      a.tickT = (a.tickT || 0) - dt;
      if (a.tickT > 0) return;
      a.tickT = 0.5;
      const p = this.pos(a); a.x = p.x; a.y = p.y;
      // with no commander to steady them, soldiers badly outmatched fall back home and regroup
      const safe = !a.cmdr && a.order.type !== 'retreat' && this.nearestFriendly(g, a);
      if (safe && Math.hypot(safe.x - p.x, safe.y - p.y) > 400 && AS.Command && AS.Command.outmatched(g, live, a.owner, this.OUTMATCH)) {
        this.note(g, a.name + ' is outmatched and falls back to regroup', true);
        this.order(g, a.id, { type: 'retreat' }, { quiet: true, keep: true });
        return;
      }
      // the commander keeps with the army
      const cu = a.cmdrUnit;
      if (cu && cu.alive && !cu.target && Math.hypot(cu.x - p.x, cu.y - p.y) > 90) { cu.state = 'march'; cu.path = AS.Nav.path(g, cu.x, cu.y, p.x, p.y + 20); cu.pi = 1; cu.dest = { x: p.x, y: p.y + 20, r: 40 }; }
      const o = a.order;
      if (o.type === 'follow') return this.followField(g, a, live, p);
      const P = a.plan, L = P && P.legs[P.li];
      if (!P) return;
      if (!L) return this.arrive(g, a);
      if (L.kind === 'walk') {
        // the route's progress follows the soldiers
        P.pi = Math.max(P.pi, this.nearestAhead(L.pts, p.x, p.y));
        const end = L.pts[L.pts.length - 1];
        const near = live.filter((u) => Math.hypot(u.x - end[0], u.y - end[1]) < 160).length;
        if (Math.hypot(p.x - end[0], p.y - end[1]) < 140 || near >= live.length * 0.75) { P.pi = L.pts.length; this.nextLeg(g, a); }
      } else { this.dematerialize(g, a); this.enterLink(g, a, L); } // an explicit link (a tunnel, a crossing): the record travels it
    },
    followField(g, a, live, p) {
      const pl = g.player; if (!pl || pl.down > 0) return;
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (d < 320) return;
      const F = a.followAt;
      if (F && Math.hypot(F.x - pl.x, F.y - pl.y) < (d > 2500 ? 900 : 260) && g.time - F.t < (d > 2500 ? 15 : 8)) return;
      if (a.blockT && g.time < a.blockT) return;
      a.followAt = { x: pl.x, y: pl.y, t: g.time };
      const w = AS.Routes.walk(g, p.x, p.y, pl.x, pl.y);
      if (!w) { a.blockT = g.time + 6; a.status = 'blocked'; if (g.time - (a.warnT || -99) > 20) { a.warnT = g.time; g.msg(a.name.toUpperCase() + ' CANNOT FOLLOW YOU THERE', '#ffb08a', 3); } return; }
      a.status = 'following';
      const all = a.cmdrUnit ? live.concat([a.cmdrUnit]) : live;
      all.forEach((u, i) => { const an = i * 2.399, r = 24 + Math.sqrt(i) * 17; u.state = 'march'; u.path = w; u.pi = 1; u.dest = { x: pl.x + Math.cos(an) * r, y: pl.y + Math.sin(an) * r * 0.8, r: 36 }; });
    },
    foesNear(g, a, x, y, r) {
      const out = [];
      for (const e of g.near(x, y, r)) if (e.isTroop && e.alive && !e.removed && e.role !== 'cart' && g.hostile(a.owner, e.team)) out.push(e);
      return out;
    },

    /* ================= encounters ================= */
    // an army off the field meets enemy soldiers on the surface: settled at once
    fieldEncounter(g, a, foes, opt) {
      opt = opt || {};
      const A = g.armies, c0 = foes[0];
      // everyone hostile close to the first contact joins in
      const all = this.foesNear(g, a, c0.x, c0.y, 450);
      let terrain = 'open', site = null;
      for (const u of all) if (u.site && u.site.guards) { site = u.site; break; }
      const choke = (g.map.routes && g.map.routes.links || []).find((l) => l.chokepoint && site && l.chokepoint === site.id);
      if (choke) terrain = 'pass'; else if (site && ['fort', 'castle', 'stronghold', 'walledtown'].includes(site.kind)) terrain = 'fort';
      const e = { id: 'enc' + A.seq++, kind: choke ? 'chokepoint' : opt.attack ? 'assault' : 'field', at: { x: Math.round(a.x), y: Math.round(a.y) }, a: a.id,
        b: { type: 'troops', name: site ? site.name + ' defenders' : 'enemy soldiers', team: c0.team, units: all }, terrain, status: 'pending', autoAt: A.clock, created: A.clock,
        attacker: a.order.type === 'defend' || a.order.type === 'hold' ? 'B' : 'A', siege: terrain === 'fort' };
      A.encounters.push(e); a.enc = e.id;
      return this.resolve(g, e.id, 'auto');
    },
    // an army meets an enemy group in the ground: it waits for a decision (or the timer)
    underEncounter(g, a, G) {
      const A = g.armies, n = AS.Routes.node(g, G.node);
      const e = { id: 'enc' + A.seq++, kind: 'underground', node: G.node, a: a.id, b: { type: 'group', id: G.id, name: G.name, team: G.team }, terrain: (n && n.terrain) || 'tunnel',
        status: 'pending', autoAt: A.clock + PENDING, created: A.clock, attacker: 'A' };
      A.encounters.push(e); a.enc = e.id; a.status = 'engaged';
      this.note(g, a.name + ' meets ' + G.name + ' in ' + ((n && n.name) || 'the dark') + ' — auto-resolve or retreat (K)', true);
      return e;
    },
    sideOf(g, a) {
      const c = a.cmdr && g.armies.cmdrs[a.cmdr];
      return { name: a.name, stacks: Object.assign({}, this.stacksOf(a)), wounds: Object.assign({}, a.wounds), morale: a.morale, cmdr: c ? this.cmdrDef(c) : null, defending: a.order.type === 'defend' || a.order.type === 'hold' };
    },
    // settle a pending encounter: method 'auto' (fight it out) or 'retreat' (withdraw)
    resolve(g, encId, method) {
      const A = g.armies, e = A.encounters.find((q) => q.id === encId);
      if (!e || e.status !== 'pending') return null;
      const a = A.byId[e.a];
      if (a.units) this.dematerialize(g, a);
      const side = this.sideOf(g, a);
      let B;
      if (e.b.type === 'group') {
        const G = A.groups[e.b.id];
        B = { name: G.name, stacks: Object.assign({}, G.stacks), wounds: Object.assign({}, G.wounds || {}), morale: G.morale === undefined ? 80 : G.morale, cmdr: null, defending: true };
      } else {
        const st = {}, hp = {}, mx = {};
        for (const u of e.b.units) if (u.alive && !u.removed) { const k = u.ctype || u.role; st[k] = (st[k] || 0) + 1; hp[k] = (hp[k] || 0) + u.hp; mx[k] = (mx[k] || 0) + u.maxHp; }
        const w = {}; for (const k in st) w[k] = hp[k] / mx[k];
        B = { name: e.b.name, stacks: st, wounds: w, morale: 80, cmdr: null, defending: e.attacker === 'A' };
        side.defending = e.attacker === 'B';
      }
      const seed = (U.hash2(Math.round(A.clock * 4), A.seq, 991) * 1e9) >>> 0;
      const res = AS.AutoResolve.resolve(side, B, { terrain: e.terrain, seed, attacker: e.attacker, siege: !!e.siege, retreat: method === 'retreat' ? 'A' : null });
      res.method = method === 'retreat' ? 'retreat' : 'auto';
      return this.applyResult(g, e, res);
    },
    // apply a result (auto-resolve now; a playable battle later) to the real armies
    applyResult(g, e, res) {
      const A = g.armies, a = A.byId[e.a];
      e.status = 'done'; e.result = res; e.method = res.method; e.doneAt = A.clock;
      a.enc = null;
      // our army: exactly the survivors, their wounds, their spirit
      a.stacks = Object.assign({}, res.A.after); a.wounds = Object.assign({}, res.A.wounds); a.morale = Math.max(5, res.A.morale);
      a.lastEnc = { id: e.id, vs: e.b.name, kind: e.kind, won: res.winner === 'A', lost: AS.AutoResolve.count(res.A.lost), killed: AS.AutoResolve.count(res.B.lost), at: +A.clock.toFixed(1), terrain: res.terrain, method: res.method };
      // the enemy: a group record, or the real soldiers (the fallen are taken off the field)
      if (e.b.type === 'group') {
        const G = A.groups[e.b.id];
        G.stacks = Object.assign({}, res.B.after); G.wounds = Object.assign({}, res.B.wounds); G.morale = Math.max(30, res.B.morale);
        if (!AS.AutoResolve.count(G.stacks)) { G.defeated = true; this.note(g, G.name + ' are destroyed', true); }
      } else {
        const by = {};
        for (const u of e.b.units) if (u.alive && !u.removed) (by[u.ctype || u.role] = by[u.ctype || u.role] || []).push(u);
        for (const k in by) {
          const list = by[k].sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp), keep = res.B.after[k] || 0;
          for (let i = 0; i < list.length - keep; i++) { const u = list[i]; u.alive = false; u.removed = true; if (u.site && u.site.onGuardKilled) u.site.onGuardKilled(u, null); }
          for (const u of list.slice(list.length - keep)) u.hp = Math.max(1, u.maxHp * (res.B.wounds[k] || 1));
        }
      }
      const won = res.winner === 'A';
      this.note(g, a.name + (won ? ' defeats ' : ' is beaten by ') + e.b.name + ': lost ' + a.lastEnc.lost + ', killed ' + a.lastEnc.killed, true);
      // the commander's fate
      if (res.cmdr.A && a.cmdr) this.defeatCommander(g, a, res.cmdr.A.kind, e.b.name, e.node);
      else if (a.cmdr) this.remark(g, a.cmdr, won ? 'won' : 'lost', true);
      if (!this.count(a)) { this.destroyed(g, a, e.b.name); return e; }
      if (won) {
        a.status = a.plan ? 'moving' : a.status === 'engaged' ? 'holding' : a.status;
        // carry on: underground, through the place just won
        if (e.kind === 'underground' && a.plan) { a.node = e.node; this.nextLeg(g, a); }
        else if (a.order.type === 'attack' && !a.plan) this.arrive(g, a);
      } else {
        // beaten: back the way it came
        if (a.layer === 'under') this.retreatUnder(g, a);
        else this.order(g, a.id, { type: 'retreat' }, { quiet: true, keep: true });
      }
      return e;
    },
    // underground, the only way out is back to the entrance it came in by
    retreatUnder(g, a) {
      const P = a.plan, legs = [];
      if (P) for (let i = Math.min(P.li, P.legs.length - 1); i >= 0; i--) { const L = P.legs[i]; if (L.kind === 'link') { legs.push(Object.assign({}, L, { from: L.to, to: L.from })); if (L.from === a.lastSurface) break; } }
      if (!legs.length) return;
      a.plan = { legs, li: 0, pi: 1, lt: 0 };
      a.order = { type: 'retreat', node: a.lastSurface, name: (AS.Routes.node(g, a.lastSurface) || {}).name };
      a.status = 'moving';
      if (a.cmdr) this.remark(g, a.cmdr, 'retreat', true);
    },
    destroyed(g, a, by) {
      if (a.cmdr) this.defeatCommander(g, a, 'captured', by);
      if (a.units) { for (const u of a.units) { u.onDeath = null; } a.units = null; }
      a.stacks = {}; a.wounds = {}; a.status = 'destroyed'; a.plan = null; a.enc = null;
      this.note(g, a.name + ' has been destroyed', true);
    },

    /* ================= splitting and joining ================= */
    // pack both armies, move troops between the records, put them back
    transfer(g, fromId, toId, troopId, n) {
      const A = g.armies, a = A.byId[fromId], b = A.byId[toId];
      if (!a || !b || a === b) return { ok: false, reason: 'pick two armies' };
      if (a.enc || b.enc) return { ok: false, reason: 'not while fighting' };
      if (a.layer !== 'surface' || b.layer !== 'surface') return { ok: false, reason: 'both armies must be above ground' };
      const pa = this.pos(a), pb = this.pos(b);
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 500) return { ok: false, reason: 'the armies must stand together' };
      if (this.fighting(a) || this.fighting(b)) return { ok: false, reason: 'not while fighting' };
      const fa = !!a.units, fb = !!b.units;
      this.dematerialize(g, a); this.dematerialize(g, b);
      const have = a.stacks[troopId] || 0; n = Math.min(n, have);
      if (n <= 0) { if (fa) this.materialize(g, a); if (fb) this.materialize(g, b); return { ok: false, reason: 'none to move' }; }
      const after = Object.assign({}, b.stacks); after[troopId] = (after[troopId] || 0) + n;
      if (this.leadUsed(b, after) > this.leadCap(g, b)) { if (fa) this.materialize(g, a); if (fb) this.materialize(g, b); return { ok: false, reason: 'more than ' + b.name + '\'s commander can lead' }; }
      const wa = a.wounds[troopId] === undefined ? 1 : a.wounds[troopId], wb = b.wounds[troopId] === undefined ? 1 : b.wounds[troopId], nb = b.stacks[troopId] || 0;
      b.wounds[troopId] = +((wa * n + wb * nb) / (n + nb)).toFixed(3);
      b.stacks = after; a.stacks[troopId] = have - n; if (!a.stacks[troopId]) { delete a.stacks[troopId]; delete a.wounds[troopId]; }
      if (fa) this.materialize(g, a); if (fb) this.materialize(g, b);
      if (!this.count(a)) { if (a.cmdr) { const c = A.cmdrs[a.cmdr]; this.dropCommander(g, a); c.status = 'available'; c.x = pa.x; c.y = pa.y; } a.status = 'disbanded'; A.list.splice(A.list.indexOf(a), 1); delete A.byId[a.id]; }
      return { ok: true };
    },
    // a new army from part of another (no commander yet)
    split(g, fromId, stacks, name) {
      const A = g.armies, a = A.byId[fromId];
      if (!a || a.enc || a.layer !== 'surface' || this.fighting(a)) return { ok: false, reason: 'not now' };
      const p = this.pos(a);
      const b = this.create(g, { name: name || a.name + ' (detached)', owner: a.owner, stacks: {}, x: p.x + 60, y: p.y + 40 });
      for (const k in stacks) { const r = this.transfer(g, a.id, b.id, k, stacks[k]); if (!r.ok) return r; }
      return { ok: true, army: b };
    },

    /* ================= saving ================= */
    serialize(g) {
      const A = g.armies, out = { v: 1, clock: A.clock, acc: A.acc, seq: A.seq, flags: Object.assign({}, A.flags), armies: [], cmdrs: {}, groups: JSON.parse(JSON.stringify(A.groups)), encounters: [], log: A.log.slice(-12) };
      for (const a of A.list) {
        let stacks = a.stacks, wounds = a.wounds, x = a.x, y = a.y;
        if (a.units) {
          // the field as it stands, without packing it away
          const st = {}, hp = {}, mx = {}; let cx = 0, cy = 0, n = 0;
          for (const u of a.units) if (u.alive && !u.removed) { st[u.ctype] = (st[u.ctype] || 0) + 1; hp[u.ctype] = (hp[u.ctype] || 0) + u.hp; mx[u.ctype] = (mx[u.ctype] || 0) + u.maxHp; cx += u.x; cy += u.y; n++; }
          stacks = st; wounds = {}; for (const k in st) wounds[k] = +(hp[k] / mx[k]).toFixed(3);
          if (n) { x = cx / n; y = cy / n; }
        }
        out.armies.push({ id: a.id, name: a.name, owner: a.owner, cmdr: a.cmdr, stacks, wounds, morale: a.morale, x, y, /* (exact: the same record steps on to the same place) */ layer: a.layer, node: a.node, lastSurface: a.lastSurface || null,
          home: a.home, order: a.order, plan: a.plan, status: a.status, transport: a.transport, lastEnc: a.lastEnc, inLink: a.inLink || null });
      }
      for (const id in A.cmdrs) out.cmdrs[id] = Object.assign({}, A.cmdrs[id]);
      for (const e of A.encounters) if (e.status === 'pending' && e.b.type === 'group') out.encounters.push({ id: e.id, kind: e.kind, node: e.node, a: e.a, b: e.b, terrain: e.terrain, autoAt: e.autoAt, created: e.created, attacker: e.attacker, status: e.status });
      return out;
    },
    restore(g, s) {
      const A = this.init(g);
      A.clock = s.clock || 0; A.acc = s.acc || 0; A.seq = s.seq || 1; A.flags = s.flags || {}; A.groups = s.groups || {}; A.log = s.log || [];
      for (const id in s.cmdrs || {}) A.cmdrs[id] = Object.assign({}, s.cmdrs[id]);
      for (const r of s.armies || []) {
        const a = Object.assign({ units: null, cmdrUnit: null, enc: null }, JSON.parse(JSON.stringify(r)));
        // re-plan a walk from where the army stands, so the soldiers are not sent back
        A.list.push(a); A.byId[a.id] = a;
      }
      for (const e of s.encounters || []) { A.encounters.push(Object.assign({}, e)); const a = A.byId[e.a]; if (a) a.enc = e.id; }
      return A;
    },

    /* ================= for screens ================= */
    summary(g, a) {
      const st = this.stacksOf(a), parts = [];
      for (const k in st) if (st[k]) parts.push(st[k] + ' ' + (this.troop(k) ? this.troop(k).name : k));
      const c = a.cmdr && g.armies.cmdrs[a.cmdr];
      return { id: a.id, name: a.name, cmdr: c ? this.cmdrDef(c).name : null, count: this.count(a), troops: parts.join(', ') || 'no troops', morale: Math.round(a.morale), lead: this.leadUsed(a), cap: this.leadCap(g, a),
        layer: a.layer, where: a.layer === 'under' ? ((AS.Routes.node(g, a.node) || {}).name || 'underground') : Math.round(this.pos(a).x) + ', ' + Math.round(this.pos(a).y), order: this.describeOrder(g, a), status: a.status, field: !!a.units, enc: a.enc, last: a.lastEnc };
    },
  };
  AS.Armies = Armies;
})(window.AS);
