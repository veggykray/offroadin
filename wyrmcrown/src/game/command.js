/* WYRMCROWN — COMMAND MODE: direct control of your soldiers on the ground.
 *
 * C (or the COMMAND button) switches between flying the dragon and commanding.
 * While commanding, the dragon hangs in the air where it is, W A S D (or the
 * arrows) pan the view instead of flying, the mouse no longer casts or breathes, and:
 *   drag a box            select the soldiers under it (any mix of types)
 *   click a soldier       select it; SHIFT-click adds or removes one
 *   double-click          every soldier of that type near it
 *   left-click ground     the selection moves there
 *   left-click an enemy   the selection attacks it, at once
 *   left-click a place    the selection assaults it (its guards, then stands in its ring)
 *   right-click           a small menu: hold, defend, follow, retreat, move, return home…
 *
 * There is no second army system here. Orders go to what already owns the soldiers:
 *   an army record (src/game/armies.js): a whole army selected and sent somewhere is an
 *       ordinary army order (march / attack), so it keeps going when the dragon leaves and
 *       obeys routes; part of an army, or an attack on one enemy, puts the army under
 *       'local' orders and the soldiers take them one by one (the record stays the truth:
 *       counts, owner, commander);
 *   the Wide Realm campaign army (bigcampaign.js): set to hold, then ordered soldier by soldier;
 *   loose soldiers (a town's garrison, the guards of a place you hold): ordered soldier by
 *       soldier, and they go home again when they have stood idle a while.
 *
 * COMMANDERS. Soldiers need no king or champion to defend themselves, obey a nearby order,
 * help friends in a fight or fall back when outmatched. They do need one to go far: an
 * order whose goal is more than LOCAL_R from their home (an army's home, a garrison's town)
 * is refused without a commander, and so is any tunnel (Armies.order checks the same rule).
 *
 * Uncommanded soldiers of the player, every half second (tick): idle guards and garrisons
 * join a fight a friend nearby is in (within HELP_R, leashed to home), soldiers under a
 * local order chase no further than PURSUIT_R from where they were sent, and loose soldiers
 * badly outmatched (OUTMATCH times their strength) fall back home; uncommanded armies do the
 * same through Armies.fieldTick. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const CFG = {
    LOCAL_R: 1600,    // how far from home soldiers without a commander may be sent
    PURSUIT_R: 480,   // how far a soldier chases a foe from where it was told to be
    HELP_R: 460,      // idle soldiers join a friend's fight this close
    OUTMATCH: 2.2,    // enemies this many times stronger send uncommanded soldiers home
    STRENGTH_R: 380,  // the circle the strengths are weighed in
    RETURN_T: 120,    // loose soldiers stand where they were sent this long, then go home
    SAME_R: 560,      // a double-click selects soldiers of the type this close
    DRAG_PX: 8,       // a press that moves less than this is a click, not a box
    DBL_T: 0.38,      // seconds between the clicks of a double-click
    PAN: 900,         // how fast W A S D move the view while commanding (units a second)
  };

  const Command = {
    CFG,
    state(g) { return g.cmd || (g.cmd = { on: false, sel: [], drag: null, marks: [], last: null, menu: null, tickT: 0, warnT: {} }); },
    on(g) { return !!(g && g.cmd && g.cmd.on); },
    toggle(g) { this.set(g, !this.on(g)); },
    set(g, on) {
      const C = this.state(g);
      if (C.on === on) return;
      C.on = on; C.drag = null;
      this.closeMenu();
      // the view stays put (the movement keys pan it) until you fly again
      const cam = g.camera;
      C.view = on ? { x: cam.x + cam.w / 2, y: cam.y + cam.h / 2 } : null;
      if (on) g.msg('COMMAND MODE — DRAG TO SELECT · CLICK GROUND TO MOVE · CLICK A FOE TO ATTACK · C TO FLY', '#bfe8a8', 3.5);
      else { g.msg('BACK TO THE DRAGON', '#ffe7a8', 1.6); }
      AS.Audio.sfx('ui_click');
      this.button(g);
    },

    /* ---------------- who is who ---------------- */
    friendly(g, u) { return u && u.isTroop && u.alive && !u.removed && u.team === g.playerKey && u.role !== 'cart' && !u.dormant; },
    enemy(g, u) { return u && u.alive && !u.removed && u.targetable !== false && (u.isTroop || u.isBuilding) && u.team && g.hostile(g.playerKey, u.team) && !u.isDragon; },
    typeOf(u) { return u.ctype || u.role; },
    army(g, u) { const A = g.armies, id = u.armyId || u.cmdrOf; return A && id ? A.byId[id] : null; },
    // the selection by company: { key, kind: 'army'|'bc'|'loose', a, units }
    companies(g, units) {
      const m = new Map();
      for (const u of units) {
        const a = this.army(g, u), key = a ? 'army:' + a.id : u.bcArmy ? 'bc' : 'loose';
        if (!m.has(key)) m.set(key, { key, kind: a ? 'army' : u.bcArmy ? 'bc' : 'loose', a, units: [] });
        m.get(key).units.push(u);
      }
      return [...m.values()];
    },
    // the strength of soldiers (health times hitting power): for "outmatched"
    power(u) {
      const s = AS.AutoResolve && AS.AutoResolve.stats(u.ctype || u.role);
      if (!s) return u.hp;
      const d = (s.melee ? s.melee.blow * s.melee.rate * s.melee.splash : 0) + (s.shot ? s.shot.blow * s.shot.rate : 0);
      return u.hp * (0.5 + d / 8);
    },
    outmatched(g, units, owner, ratio) {
      let x = 0, y = 0, n = 0;
      for (const u of units) if (u.alive && !u.removed) { x += u.x; y += u.y; n++; }
      if (!n) return false;
      x /= n; y /= n;
      let foe = 0, own = 0;
      for (const e of g.near(x, y, CFG.STRENGTH_R)) {
        if (!e.isTroop || !e.alive || e.removed || e.role === 'cart') continue;
        if (e.team === owner) own += this.power(e);
        else if (g.hostile(owner, e.team)) foe += this.power(e);
      }
      return foe > 0 && foe > own * (ratio || CFG.OUTMATCH);
    },
    // where a loose soldier belongs, and may be sent around without a commander
    homeOf(g, u) { return u.tac ? u.tac.home : u.home; },

    /* ---------------- picking under the cursor ---------------- */
    world(g, sx, sy) { return AS.Renderer.screenToWorld(sx, sy, g.camera); },
    tol(g, px) { const R = AS.Renderer; return px * (R.dpr || 1) / R.worldScale(g.camera); }, // CSS pixels → world units
    pickUnit(g, w, pred) {
      let best = null, bd = 1e9;
      const slack = this.tol(g, 12);
      for (const e of g.near(w.x, w.y + 20, 110)) {
        if (!pred(e)) continue;
        // the figure stands from its feet up to its head: a click anywhere on it counts
        const top = e.y - (e.hc || 8) * 1.8, cy = U.clamp(w.y, top, e.y);
        const d = Math.hypot(e.x - w.x, cy - w.y);
        if (d < (e.hitR || e.r || 8) * 0.8 + slack && d < bd) { bd = d; best = e; }
      }
      return best;
    },
    // a place you can assault: guarded, or held by an enemy
    pickPlace(g, w) {
      let best = null, bd = 1e9;
      for (const s of g.sites) {
        const d = Math.hypot(s.x - w.x, s.y - w.y), r = (s.def && (s.def.capR || s.def.r)) || 90;
        if (d < Math.max(70, r) && d < bd) { bd = d; best = s; }
      }
      return best;
    },
    hostilePlace(g, s) { return !!s && s.owner !== g.playerKey && ((s.guarded && s.guarded()) || (s.owner && g.hostile(g.playerKey, s.owner))); },
    // what a click at (sx, sy) lands on
    under(g, sx, sy) {
      const w = this.world(g, sx, sy);
      const own = this.pickUnit(g, w, (e) => this.friendly(g, e));
      const foe = this.pickUnit(g, w, (e) => this.enemy(g, e));
      const site = this.pickPlace(g, w);
      return { w, own, foe, site: this.hostilePlace(g, site) ? site : null, place: site };
    },

    /* ---------------- selection ---------------- */
    select(g, units, add) {
      const C = this.state(g);
      if (!add) { for (const u of C.sel) u.selected = false; C.sel = []; }
      for (const u of units) if (!u.selected && this.friendly(g, u)) { u.selected = true; C.sel.push(u); }
    },
    deselect(g, u) { const C = this.state(g); u.selected = false; C.sel = C.sel.filter((v) => v !== u); },
    clear(g) { this.select(g, [], false); },
    boxSelect(g, x0, y0, x1, y1, add) {
      const a = this.world(g, Math.min(x0, x1), Math.min(y0, y1)), b = this.world(g, Math.max(x0, x1), Math.max(y0, y1));
      const out = [];
      for (const e of g.near((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) / 2 + 40)) {
        if (!this.friendly(g, e)) continue;
        const ey = e.y - (e.hc || 8) * 0.5;
        if (e.x >= a.x - e.r && e.x <= b.x + e.r && ey >= a.y - e.r && ey <= b.y + e.r) out.push(e);
      }
      this.select(g, out, add);
      return out.length;
    },
    selectSame(g, u) {
      const k = this.typeOf(u), cam = g.camera, out = [];
      for (const e of g.near(u.x, u.y, CFG.SAME_R)) if (this.friendly(g, e) && this.typeOf(e) === k && e.x > cam.x && e.x < cam.x + cam.w && e.y > cam.y && e.y < cam.y + cam.h + 60) out.push(e);
      this.select(g, out, false);
      return out.length;
    },
    live(g) {
      const C = this.state(g);
      if (C.sel.some((u) => !this.friendly(g, u))) { for (const u of C.sel) if (!this.friendly(g, u)) u.selected = false; C.sel = C.sel.filter((u) => this.friendly(g, u)); }
      return C.sel;
    },

    /* ---------------- the mouse, each frame in Command Mode ---------------- */
    input(g, dt) {
      const C = this.state(g), I = AS.Input, m = I.mouse;
      this.live(g);
      if (!C.on || g.uiBlocking) { C.drag = null; return; }
      const shift = I.keys.has('ShiftLeft') || I.keys.has('ShiftRight');
      // W A S D (or the arrows) pan the view
      if (C.view) {
        const sp = CFG.PAN / Math.max(0.3, g.camera.zoom || 1);
        C.view.x = U.clamp(C.view.x + ((I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0)) * sp * dt, 0, g.map.w);
        C.view.y = U.clamp(C.view.y + ((I.down('back') ? 1 : 0) - (I.down('forward') ? 1 : 0)) * sp * dt, 0, g.map.h);
      }
      if (m.lPressed) { if (C.menu) this.closeMenu(); C.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, shift }; }
      if (C.drag && m.l) { C.drag.x1 = m.x; C.drag.y1 = m.y; }
      if (C.drag && (m.lReleased || !m.l)) {
        const D = C.drag; C.drag = null;
        if (Math.hypot(D.x1 - D.x0, D.y1 - D.y0) > CFG.DRAG_PX) this.boxSelect(g, D.x0, D.y0, D.x1, D.y1, D.shift);
        else this.click(g, D.x0, D.y0, D.shift);
      }
      if (m.rPressed) this.openMenu(g, m.x, m.y);
    },
    click(g, sx, sy, shift) {
      const C = this.state(g), now = performance.now() / 1000;
      const dbl = C.last && now - C.last.t < CFG.DBL_T && Math.hypot(sx - C.last.x, sy - C.last.y) < 12;
      C.last = { t: now, x: sx, y: sy };
      const H = this.under(g, sx, sy), sel = this.live(g);
      if (H.own) {
        if (dbl && !shift) { C.last = null; return this.selectSame(g, H.own); }
        if (shift) { if (H.own.selected) this.deselect(g, H.own); else this.select(g, [H.own], true); }
        else this.select(g, [H.own], false);
        return;
      }
      if (!sel.length) { if (H.foe || H.site) this.hint(g, 'SELECT YOUR SOLDIERS FIRST: DRAG A BOX AROUND THEM'); return; }
      if (H.foe) return this.issue(g, 'attack', { e: H.foe });
      if (H.site) return this.issue(g, 'assault', { site: H.site, x: H.site.x, y: H.site.y });
      this.issue(g, 'move', { x: H.w.x, y: H.w.y });
    },
    hint(g, text) { const C = this.state(g); if (g.time - (C.warnT[text] || -9) > 2) { C.warnT[text] = g.time; g.msg(text, '#ffe7a8', 2.4); } },
    refuse(g, text) { this.hint(g, text.toUpperCase()); AS.Audio.sfx('denied'); },
    mark(g, kind, x, y, e) { const C = this.state(g); C.marks.push({ kind, x, y, e, t: g.time }); if (C.marks.length > 12) C.marks.shift(); },

    /* ---------------- orders ---------------- */
    // kind: move {x,y} · attack {e} · assault {site} · hold · defend {x,y} · follow · retreat · home
    issue(g, kind, o, units) {
      o = o || {};
      units = (units || this.live(g)).slice();
      if (!units.length) return { ok: false, reason: 'nothing selected' };
      const goal = kind === 'attack' ? { x: o.e.x, y: o.e.y } : o.x !== undefined ? { x: o.x, y: o.y } : null;
      const reasons = [];
      let done = 0;
      for (const co of this.companies(g, units)) {
        const r = co.kind === 'army' ? this.armyOrder(g, co, kind, o, goal) : co.kind === 'bc' ? this.bcOrder(g, co, kind, o, goal) : this.looseOrder(g, co, kind, o, goal);
        if (r.ok) done += r.n || co.units.length; else reasons.push(r.reason);
      }
      if (done) {
        if (kind === 'attack') this.mark(g, 'attack', o.e.x, o.e.y, o.e);
        else if (kind === 'assault') this.mark(g, 'attack', o.site.x, o.site.y, null);
        else if (goal) this.mark(g, kind === 'defend' ? 'defend' : 'move', goal.x, goal.y);
        AS.Audio.sfx('ui_click', { vol: 0.5 });
      }
      if (reasons.length) this.refuse(g, reasons[0]);
      return { ok: done > 0, n: done, reasons };
    },
    reach(g, units, q) {
      const c = this.centre(units);
      return !c || AS.Routes.sameLand(g, c.x, c.y, q.x, q.y);
    },
    centre(units) { let x = 0, y = 0, n = 0; for (const u of units) if (u.alive) { x += u.x; y += u.y; n++; } return n ? { x: x / n, y: y / n } : null; },

    // an army record's soldiers
    armyOrder(g, co, kind, o, goal) {
      const M = AS.Armies, a = co.a;
      const field = (a.units || []).filter((u) => u.alive && !u.removed);
      const whole = field.length > 0 && field.every((u) => u.selected);
      const soldiers = co.units.filter((u) => !u.cmdrOf);
      if (kind === 'follow' || kind === 'hold' || kind === 'retreat' || kind === 'home') {
        const r = M.order(g, a.id, { type: kind === 'home' ? 'retreat' : kind });
        return r.ok ? { ok: true, n: field.length } : r;
      }
      if (goal && !a.cmdr && !M.isLocal(a, goal)) return { ok: false, reason: a.name + ' has no commander: it fights near home, but going that far needs a king or champion' };
      if (goal && !this.reach(g, field, goal)) return { ok: false, reason: a.name + ' cannot get there over the ground' };
      if (kind === 'defend') { const r = M.order(g, a.id, { type: 'defend', x: goal.x, y: goal.y }); return r.ok ? { ok: true, n: field.length } : r; }
      // a whole army sent somewhere: a standing army order (it carries on if the dragon leaves)
      if (whole && kind === 'move') { const r = M.order(g, a.id, { type: 'march', x: goal.x, y: goal.y }); return r.ok ? { ok: true, n: field.length } : r; }
      if (whole && kind === 'assault') {
        const r = M.order(g, a.id, { type: 'attack', siteId: o.site.id });
        if (r.ok) this.focusGuards(g, field, o.site);
        return r.ok ? { ok: true, n: field.length } : r;
      }
      // part of an army, or one enemy: the army is under local orders, soldier by soldier
      const moving = !!a.plan || a.order.type === 'follow';
      const r = M.order(g, a.id, { type: 'local' }, { keep: true, quiet: true });
      if (!r.ok) return r;
      // the soldiers not selected stop where they are rather than walk on alone
      if (moving) for (const u of field) if (!u.selected) { u.state = 'march'; u.path = null; u.dest = { x: u.x, y: u.y, r: 26 }; }
      this.unitOrder(g, soldiers.length ? soldiers : co.units, kind, o, goal);
      return { ok: true, n: soldiers.length };
    },
    // the Wide Realm campaign's army (the dragon leads it)
    bcOrder(g, co, kind, o, goal) {
      const S = g.bc;
      if (kind === 'follow') { S.mode = 'follow'; S.order = null; return { ok: true }; }
      S.mode = 'hold'; S.order = null;
      if (kind === 'hold') { AS.BigCampaign.holdHere(g); return { ok: true }; }
      if (kind === 'retreat' || kind === 'home') { const h = g.playerFaction.townPos; return AS.BigCampaign.orderTo(g, h.x, h.y + 150) ? { ok: true } : { ok: false, reason: 'the army cannot get home over the ground' }; }
      if (goal && !this.reach(g, co.units, goal)) return { ok: false, reason: 'they cannot get there over the ground' };
      this.unitOrder(g, co.units, kind, o, goal);
      return { ok: true };
    },
    // loose soldiers: a garrison, the guards of a place you hold
    looseOrder(g, co, kind, o, goal) {
      if (kind === 'follow') return { ok: false, reason: 'garrison soldiers stay near home: put them in an army with a commander to follow the dragon' };
      if (kind === 'retreat' || kind === 'home') { for (const u of co.units) this.sendHome(g, u); return { ok: true }; }
      let units = co.units;
      if (kind === 'hold') goal = null;
      if (goal) {
        units = units.filter((u) => { const h = this.homeOf(g, u); return Math.hypot(goal.x - h.x, goal.y - h.y) <= CFG.LOCAL_R; });
        if (!units.length) return { ok: false, reason: 'soldiers without a commander will not go that far from home: that needs a king or champion' };
        if (!this.reach(g, units, goal)) return { ok: false, reason: 'they cannot get there over the ground' };
      }
      for (const u of units) if (!u.tac) u.tac = { home: Object.assign({}, u.home), state0: u.state, site: u.site || null };
      this.unitOrder(g, units, kind, o, goal);
      return { ok: true, n: units.length };
    },
    // the soldiers themselves
    unitOrder(g, units, kind, o, goal) {
      const form = (cx, cy, i) => { const an = i * 2.399, r = 16 + Math.sqrt(i) * 15; return [cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.8]; };
      const c = this.centre(units);
      if (kind === 'hold') { units.forEach((u) => { u.state = 'march'; u.path = null; u.focus = null; u.disengage = false; u.dest = { x: u.x, y: u.y, r: 26 }; u.leash = { x: u.x, y: u.y, r: CFG.PURSUIT_R }; this.stand(u); }); return; }
      if (kind === 'defend') { units.forEach((u, i) => { const f = form(goal.x, goal.y, i); u.state = 'guard'; u.home = { x: f[0], y: f[1], r: 120 }; u.path = null; u.dest = null; u.focus = null; u.disengage = false; u.leash = null; this.stand(u); }); return; }
      if (kind === 'attack') {
        const e = o.e;
        units.forEach((u) => { u.focus = e; u.target = e; u.disengage = false; u.noFight = false; u.state = 'march'; u.path = null; u.dest = { x: e.x, y: e.y, r: 60 }; u.leash = null; this.stand(u); });
        return;
      }
      // move / assault: one shared road from the middle of the group
      const path = c ? AS.Nav.path(g, c.x, c.y, goal.x, goal.y) : null;
      units.forEach((u, i) => {
        const f = form(goal.x, goal.y, i);
        u.state = 'march'; u.path = path; u.pi = 1; u.recall = false; u.noFight = false;
        u.dest = { x: f[0], y: f[1], r: 30, siege: kind === 'assault' };
        u.focus = null; u.target = null; u.disengage = kind === 'move'; // (a move is a move: they stop to fight when they get there)
        u.leash = { x: goal.x, y: goal.y, r: kind === 'assault' ? CFG.PURSUIT_R + 300 : CFG.PURSUIT_R };
        this.stand(u);
      });
      if (kind === 'assault') this.focusGuards(g, units, o.site);
    },
    stand(u) { if (u.tac) { u.tac.idle = 0; u.tac.returning = false; } },
    focusGuards(g, units, site) {
      for (const u of units) { const e = this.nearestGuard(site, u); if (e) { u.focus = e; u.disengage = false; } u.assault = site; }
    },
    nearestGuard(site, u) {
      let best = null, bd = 1e9;
      for (const e of site.guards || []) if (e.alive && !e.removed) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
      return best;
    },
    sendHome(g, u) {
      if (!u.tac) return;
      const h = u.tac.home;
      u.state = 'march'; u.focus = null; u.target = null; u.disengage = true; u.leash = null; u.assault = null;
      u.path = AS.Nav.path(g, u.x, u.y, h.x, h.y); u.pi = 1; u.dest = { x: h.x, y: h.y, r: 60 };
      u.tac.returning = true;
    },

    /* ---------------- the soldiers' own sense, every half second ---------------- */
    tick(g, dt) {
      const C = this.state(g);
      C.tickT -= dt;
      if (C.tickT > 0) return;
      C.tickT = 0.5;
      const pk = g.playerKey;
      let fled = 0;
      for (const u of g.troops) {
        if (u.team !== pk || !u.alive || u.removed || u.role === 'cart' || u.dormant) continue;
        // the focus of an attack order: gone, so look for the next guard of the place
        if (u.focus && (!u.focus.alive || u.focus.removed)) { u.focus = null; if (u.assault) { const e = this.nearestGuard(u.assault, u); if (e && Math.hypot(e.x - u.x, e.y - u.y) < 900) u.focus = e; else u.assault = null; } }
        // a move is done: from here on they fight
        if (u.disengage && (!u.path || u.pi >= u.path.length) && (!u.dest || Math.hypot(u.x - u.dest.x, u.y - u.dest.y) < 90)) u.disengage = false;
        // loose soldiers sent out: home again when the order is long done, or when beaten
        const T = u.tac;
        if (T) {
          if (T.returning) {
            if (Math.hypot(u.x - T.home.x, u.y - T.home.y) < 120) { u.state = T.state0 === 'patrol' ? 'garrison' : T.state0; u.home = T.home; u.tac = null; u.leash = null; u.disengage = false; u.path = null; }
            continue;
          }
          if (!u.target && !u.focus && (!u.path || u.pi >= u.path.length)) T.idle = (T.idle || 0) + 0.5; else T.idle = 0;
          if (T.idle > CFG.RETURN_T) { this.sendHome(g, u); continue; }
          if (u.target && this.outmatched(g, [u], pk, CFG.OUTMATCH)) { this.sendHome(g, u); fled++; continue; }
        }
        // idle soldiers on watch help a friend in a fight nearby (not too far from their post)
        if (!u.target && !u.disengage && !u.noFight && (u.state === 'guard' || u.state === 'garrison' || (u.state === 'march' && (!u.path || u.pi >= u.path.length)))) {
          const post = u.state === 'march' ? (u.leash || u.dest || u) : u.home, reach = u.state === 'garrison' ? 600 : u.state === 'guard' ? 420 : CFG.PURSUIT_R;
          for (const f of g.near(u.x, u.y, CFG.HELP_R)) {
            if (f === u || f.team !== pk || !f.isTroop || !f.alive) continue;
            const t = f.target;
            if (t && t.alive && !t.removed && !t.isDragon && t.isTroop && Math.hypot(t.x - post.x, t.y - post.y) < reach) { u.target = t; u.provoked = 6; break; }
          }
        }
      }
      if (fled) this.hint(g, 'OUTMATCHED SOLDIERS FALL BACK HOME TO REGROUP');
    },

    /* ---------------- the right-click menu ---------------- */
    openMenu(g, sx, sy) {
      const C = this.state(g), H = this.under(g, sx, sy), sel = this.live(g);
      const items = [];
      const go = (label, fn, hint) => items.push({ label, fn, hint });
      if (sel.length) {
        if (H.foe) go('Attack ' + this.nameOf(H.foe), () => this.issue(g, 'attack', { e: H.foe }));
        if (H.site) go('Assault ' + H.site.name, () => this.issue(g, 'assault', { site: H.site, x: H.site.x, y: H.site.y }));
        go('Move here', () => this.issue(g, 'move', { x: H.w.x, y: H.w.y }));
        go('Hold', () => this.issue(g, 'hold', {}), 'stand where they are');
        go('Defend here', () => this.issue(g, 'defend', { x: H.w.x, y: H.w.y }), 'guard this spot');
        if (H.place && H.place.owner === g.playerKey) go('Defend ' + H.place.name, () => this.issue(g, 'defend', { x: H.place.x, y: H.place.y + 60 }));
        const cos = this.companies(g, sel);
        if (cos.some((c) => c.kind !== 'loose')) go('Follow the dragon', () => this.issue(g, 'follow', {}));
        go('Retreat', () => this.issue(g, 'retreat', {}), 'fall back to safety');
        if (cos.some((c) => c.kind === 'loose')) go('Return home', () => this.issue(g, 'home', {}));
        const one = cos.length === 1 && cos[0].a;
        if (one) go('Select all of ' + one.name, () => this.select(g, one.units || [], false));
        go('Clear selection', () => this.clear(g));
      } else {
        if (H.own) {
          go('Select this ' + this.nameOf(H.own), () => this.select(g, [H.own], false));
          go('Select all ' + this.nameOf(H.own) + 's nearby', () => this.selectSame(g, H.own));
          const a = this.army(g, H.own); if (a) go('Select all of ' + a.name, () => this.select(g, a.units || [], false));
        }
        go('Select every soldier on screen', () => { const cam = g.camera, out = []; for (const u of g.troops) if (this.friendly(g, u) && u.x > cam.x && u.x < cam.x + cam.w && u.y > cam.y && u.y < cam.y + cam.h) out.push(u); this.select(g, out, false); });
      }
      if (g.armies && AS.ArmyPanel) go('Army panel (K)', () => AS.ArmyPanel.open(g));
      go('Back to the dragon (C)', () => this.set(g, false));
      this.showMenu(g, sx, sy, items);
    },
    nameOf(u) {
      const c = u.ctype && AS.Conquest && AS.Conquest.Data && AS.Conquest.Data.troops[u.ctype];
      if (u.cmdrName) return u.cmdrName;
      return (c && c.name) || (u.tdef && u.tdef.name) || u.role;
    },
    showMenu(g, sx, sy, items) {
      this.closeMenu();
      const C = this.state(g), ui = document.getElementById('ui') || document.body;
      const el = document.createElement('div');
      el.id = 'cmdmenu';
      for (const it of items) {
        const b = document.createElement('button');
        b.textContent = it.label; if (it.hint) b.title = it.hint;
        b.addEventListener('mousedown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); this.closeMenu(); it.fn(); });
        el.appendChild(b);
      }
      ui.appendChild(el);
      const W = window.innerWidth, H = window.innerHeight, r = el.getBoundingClientRect();
      el.style.left = Math.min(sx + 4, W - r.width - 8) + 'px';
      el.style.top = Math.min(sy + 4, H - r.height - 8) + 'px';
      C.menu = { el, x: sx, y: sy, items: items.map((i) => i.label) };
    },
    closeMenu() {
      const el = document.getElementById('cmdmenu');
      if (el) el.remove();
      const g = AS.game; if (g && g.cmd) g.cmd.menu = null;
    },
    // pick a menu line by its label (tests, and keyboard players later)
    menuPick(g, label) {
      const el = document.getElementById('cmdmenu'); if (!el) return false;
      for (const b of el.querySelectorAll('button')) if (b.textContent.startsWith(label)) { b.click(); return true; }
      return false;
    },

    /* ---------------- the button ---------------- */
    button(g) {
      let b = document.getElementById('cmdbtn');
      const show = !!g && AS.App.state === 'play' && !AS.App.overlay && !!g.player && !(g.opts && g.opts.demo);
      if (!show && document.getElementById('cmdmenu')) this.closeMenu();
      if (!b) {
        if (!show) return;
        b = document.createElement('button');
        b.id = 'cmdbtn';
        b.addEventListener('mousedown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); if (AS.game) this.toggle(AS.game); });
        (document.getElementById('ui') || document.body).appendChild(b);
      }
      const on = this.on(g);
      const txt = on ? '⚔ COMMANDING · C TO FLY' : '⚔ COMMAND (C)';
      if (b.textContent !== txt) b.textContent = txt;
      b.classList.toggle('on', on);
      const vis = show ? '' : 'none';
      if (b.style.display !== vis) b.style.display = vis;
    },

    /* ---------------- drawing (HUD space) ---------------- */
    draw(ctx, g, W, H, s) {
      const C = g.cmd; if (!C) return;
      const R = AS.Renderer, cam = g.camera, dpr = R.dpr || 1;
      ctx.save();
      // the targets of attack orders: a red ring that tightens
      const focused = new Set();
      for (const u of C.sel) if (u.focus && u.focus.alive) focused.add(u.focus);
      for (const e of focused) {
        const q = R.worldToScreen(e.x, e.y - (e.hc || 8) * 0.5, cam), r = ((e.hitR || e.r || 8) * R.worldScale(cam) + 10 * s) * (1 + 0.12 * Math.sin(g.time * 8));
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 2 * s;
        for (let i = 0; i < 4; i++) { const a0 = g.time * 2 + i * TAU / 4; ctx.beginPath(); ctx.arc(q.x, q.y, r, a0, a0 + 0.95); ctx.stroke(); }
        ctx.font = 'bold ' + Math.round(11 * s) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText('ATTACK', q.x + 1, q.y - r - 9 * s + 1); ctx.fillStyle = '#ffb08a'; ctx.fillText('ATTACK', q.x, q.y - r - 9 * s);
      }
      // where an order was given: a ring that closes on the spot
      for (const k of C.marks) {
        const age = g.time - k.t; if (age > 1.2) continue;
        const x = k.e && k.e.alive ? k.e.x : k.x, y = k.e && k.e.alive ? k.e.y : k.y;
        const q = R.worldToScreen(x, y, cam), r = (30 - age * 18) * s, col = k.kind === 'attack' ? '#ff6a4a' : k.kind === 'defend' ? '#8ac8ff' : '#9cf07a';
        ctx.globalAlpha = 1 - age / 1.2;
        ctx.strokeStyle = col; ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(4 * s, r), Math.max(3 * s, r * 0.6), 0, 0, TAU); ctx.stroke();
        if (k.kind === 'attack') { ctx.beginPath(); ctx.moveTo(q.x - 7 * s, q.y - 7 * s); ctx.lineTo(q.x + 7 * s, q.y + 7 * s); ctx.moveTo(q.x + 7 * s, q.y - 7 * s); ctx.lineTo(q.x - 7 * s, q.y + 7 * s); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (!C.on) { ctx.restore(); return; }
      // the box being dragged
      if (C.drag && Math.hypot(C.drag.x1 - C.drag.x0, C.drag.y1 - C.drag.y0) > CFG.DRAG_PX) {
        const x = Math.min(C.drag.x0, C.drag.x1) * dpr, y = Math.min(C.drag.y0, C.drag.y1) * dpr, w = Math.abs(C.drag.x1 - C.drag.x0) * dpr, h = Math.abs(C.drag.y1 - C.drag.y0) * dpr;
        ctx.fillStyle = 'rgba(150,240,120,0.12)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#9cf07a'; ctx.lineWidth = 1.5 * s; ctx.setLineDash([6 * s, 4 * s]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      }
      // what is under the cursor
      const m = AS.Input.mouse;
      if (!C.drag && !C.menu && C.sel.length) {
        const Hh = this.under(g, m.x, m.y);
        const lab = Hh.own ? null : Hh.foe ? 'ATTACK ' + this.nameOf(Hh.foe).toUpperCase() : Hh.site ? 'ASSAULT ' + Hh.site.name.toUpperCase() : 'MOVE';
        if (lab) {
          ctx.font = 'bold ' + Math.round(11 * s) + 'px Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(lab, m.x * dpr + 15 * s, m.y * dpr + 17 * s);
          ctx.fillStyle = Hh.foe || Hh.site ? '#ff9a7a' : '#bff0a8'; ctx.fillText(lab, m.x * dpr + 14 * s, m.y * dpr + 16 * s);
        }
      }
      // the panel: what is selected, and the controls
      const sel = C.sel, cos = this.companies(g, sel), bits = [];
      const counts = {}; for (const u of sel) { const n = this.nameOf(u); counts[n] = (counts[n] || 0) + 1; }
      for (const k in counts) bits.push(counts[k] + ' ' + k);
      const who = cos.map((c) => c.kind === 'army' ? c.a.name + (c.a.cmdr ? '' : ' (no commander)') : c.kind === 'bc' ? 'your army' : 'garrison').join(', ');
      const lines = [
        ['COMMAND MODE', '#bfe8a8', true],
        [sel.length ? sel.length + ' selected: ' + bits.join(', ') : 'Nothing selected: drag a box around your soldiers', '#f0e2c0'],
      ];
      if (sel.length) lines.push([who, '#c8b898']);
      lines.push(['Click ground: move · click a foe: attack · right-click: more · WASD: look · C: fly', '#a89878']);
      const pw = 470 * s, lh = 17 * s, px = W / 2 - pw / 2, py = H - (lines.length * lh + 16 * s) - 64 * s;
      ctx.fillStyle = 'rgba(14,9,5,0.78)'; ctx.fillRect(px, py, pw, lines.length * lh + 14 * s);
      ctx.strokeStyle = 'rgba(160,230,130,0.6)'; ctx.lineWidth = 1.2 * s; ctx.strokeRect(px, py, pw, lines.length * lh + 14 * s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach(([t, col, b], i) => {
        ctx.font = (b ? 'bold ' : '') + Math.round((b ? 13 : 11.5) * s) + 'px Georgia, serif';
        let txt = t; while (ctx.measureText(txt).width > pw - 16 * s && txt.length > 8) txt = txt.slice(0, -4) + '…';
        ctx.fillStyle = col; ctx.fillText(txt, W / 2, py + 14 * s + i * lh);
      });
      ctx.restore();
    },
  };
  AS.Command = Command;
})(window.AS);
