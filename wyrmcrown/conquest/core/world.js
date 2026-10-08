/* WYRMCROWN — CONQUEST world rules: the campaign map in play.
 *
 * The generated world (core/worldgen.js) is static and rebuilt from the seed;
 * this module joins it to what the campaign state records as having changed:
 *
 *   state.army.at              where the army is (a site id)
 *   state.territories[id]      { kind, owner, island } for every site
 *   state.sites[id]            { kind (recruitment kind or null), stock, restockDay, garrison }
 *   state.world.explored       ids of the sites discovered so far
 *   state.economy              gold, day, hour  (the campaign clock — no wall-clock time)
 *   state.objectives           Dragon Lords (primary first) and the minor strongholds
 *   state.log                  the last few campaign events (shown on the map)
 *
 * Rules:
 *  - The army moves one route at a time from where it is. Land routes are always
 *    open; sea routes need the ship. Moving onto a hostile site (anyone else's,
 *    with a garrison) is an attack: a local battle decides it. An unguarded site
 *    is claimed by walking in. Free villages welcome the army (hire there) but
 *    stay free.
 *  - Every action takes campaign hours (data/world.js); at each midnight the day
 *    ends: holdings pay, troops are paid, unpaid troops desert (costliest first,
 *    the Phase 1 rule) and recruitment stock refills on schedule. All of it is
 *    reported in the log; nothing happens off-screen.
 *  - Where the army stands, it sees: the site and every site one route away
 *    (sea routes too, from a coast), and the whole of the start zone at the start.
 *  - Taking a site pays its reward once (gold, leadership), adds its income and
 *    opens its recruitment; taking a Dragon Lord's fortress fells that Lord;
 *    felling the primary Lord wins the campaign.
 *
 * Pure functions over (state, world); the only mutations are the explicit
 * actions (move, recruit, buyShip, capture, applyBattle, advance, rest). */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data;
  const Wcfg = () => D.world;
  const cache = { key: null, w: null };

  // 'Footman' → 'Footmen', 'Wolf' → 'Wolves', 'Risen' stays
  const plural = (name, n) => n === 1 ? name : /man$/.test(name) ? name.replace(/man$/, 'men') : /f$/.test(name) ? name.replace(/f$/, 'ves') : /(s|en)$/.test(name) ? name : name + 's';
  const World = {
    plural,
    many(n, id) { return n + ' ' + plural(D.troops[id].name, n); },
    /* the generated world for a campaign (memoised; regenerated from the seed) */
    of(state) {
      const key = state.seed + ':' + state.hero.allegiance + ':' + state.objectives.lords.map((l) => l.id).join(',') + ':' + (state.world.gen || 1);
      if (cache.key !== key) { cache.key = key; cache.w = C.WorldGen.generate(state.seed, { allegiance: state.hero.allegiance, lords: state.objectives.lords }); }
      return cache.w;
    },
    forget() { cache.key = null; cache.w = null; },
    /* fill a campaign record's world fields from its seed (a new campaign, or a Phase 1 save being upgraded) */
    init(state) {
      const w = this.of(state);
      if (w.problems.length) throw new Error('world for seed ' + state.seed + ' failed validation: ' + w.problems.join('; '));
      state.world = { generated: true, gen: w.gen, w: w.w, h: w.h, islands: [], explored: [], progress: 0, style: w.style };
      state.territories = {}; state.sites = {};
      for (const s of w.sites) {
        state.territories[s.id] = { kind: s.kind, owner: s.owner, island: s.island };
        state.sites[s.id] = { kind: s.recruit || null, stock: s.stock ? Object.assign({}, s.stock) : null, restockDay: 0, garrison: s.garrison.map((g) => g.slice()) };
      }
      for (const L of state.objectives.lords) { const wl = w.lords.find((q) => q.id === L.id); L.stronghold = wl.stronghold; L.primary = !!wl.primary; L.island = wl.island; }
      state.objectives.minor = {};
      for (const s of w.sites) if (s.kind === 'stronghold') state.objectives.minor[s.id] = { allegiance: s.owner, captured: false };
      state.army.at = w.start;
      state.army.ship = state.army.ship || { owned: false, at: null };
      state.economy.hour = state.economy.hour !== undefined ? state.economy.hour : Wcfg().dayStart;
      state.log = state.log || [];
      // the start zone is home ground: known from the outset
      for (const s of w.sites) if (s.zone === 0) this.reveal(state, s.id);
      this.look(state, w.start);
      this.note(state, 'You set out from ' + w.sites.find((s) => s.id === w.start).name + '.');
      return state;
    },

    /* ---------------- reading the map ---------------- */
    site(state, id) {
      const w = this.of(state), s = C.WorldGen.index(w).byId[id];
      if (!s) return null;
      const t = state.territories[id] || {}, d = state.sites[id] || {};
      return Object.assign({}, s, { owner: t.owner, garrison: d.garrison || [], stock: d.stock, restockDay: d.restockDay, recruitKind: d.kind });
    },
    neighbours(state, id) { return C.WorldGen.index(this.of(state)).adj[id] || []; },
    known(state, id) { return state.world.explored.includes(id); },
    strength(stacks) { return C.WorldGen.strength(stacks); },
    hostile(state, id) {
      const t = state.territories[id], d = state.sites[id];
      return !!t && t.owner !== 'player' && t.owner !== 'free' && !!d && d.garrison.length > 0;
    },
    ownedBy(state, id, who) { return state.territories[id] && state.territories[id].owner === who; },
    reveal(state, id) { if (!state.world.explored.includes(id)) state.world.explored.push(id); },
    // the army sees its site and everything one route away (sea routes from a coast)
    look(state, id) {
      this.reveal(state, id);
      for (const e of this.neighbours(state, id)) this.reveal(state, e.to);
    },
    /* the army's own strength (leadership points) */
    armyStrength(state) { return C.Rules.leadershipUsed(state.army); },
    /* a rough reading of a garrison against the army: what the briefing shows */
    threat(state, id) {
      const g = this.strength((state.sites[id] || {}).garrison), a = this.armyStrength(state) + 60; // the dragon counts for a small army
      const r = g / Math.max(1, a);
      return r < 0.45 ? 'light' : r < 0.9 ? 'moderate' : r < 1.6 ? 'strong' : r < 3 ? 'very strong' : 'deadly';
    },

    /* ---------------- the clock ---------------- */
    timeLabel(state) { const h = state.economy.hour | 0; return 'Day ' + state.economy.day + ', ' + String(h).padStart(2, '0') + ':00'; },
    /* pass hours; each midnight ends a day (income, wages, desertion, restock). Returns the day reports. */
    advance(state, hours) {
      const out = [];
      let h = (state.economy.hour || 0) + hours;
      while (h >= 24) { h -= 24; out.push(this.endDay(state)); }
      state.economy.hour = h;
      return out;
    },
    rest(state) { return this.advance(state, 24 - state.economy.hour + Wcfg().dayStart); },
    endDay(state) {
      const income = C.Rules.incomePerDay(state);
      const r = C.Rules.endOfDay(state);
      const rep = { day: state.economy.day, income, wages: r.wages, net: income - r.wages, deserted: r.deserted, restocked: [] };
      // recruitment stock refills on each site's schedule
      const w = this.of(state);
      for (const s of w.sites) {
        const d = state.sites[s.id];
        if (!d || !d.kind || !s.stock) continue;
        if (state.economy.day >= (d.restockDay || 0)) {
          const full = Object.keys(s.stock).every((k) => (d.stock && d.stock[k]) >= s.stock[k]);
          if (!full) { d.stock = Object.assign({}, s.stock); if (this.known(state, s.id)) rep.restocked.push(s.id); }
          d.restockDay = state.economy.day + ((D.recruitSites[d.kind] && D.recruitSites[d.kind].restock) || 3);
        }
      }
      let msg = 'Day ' + rep.day + ' ends: income +' + income + ', wages −' + r.wages + ' (net ' + (rep.net >= 0 ? '+' : '') + rep.net + ').';
      if (r.deserted.length) {
        const c = {}; for (const id of r.deserted) c[id] = (c[id] || 0) + 1;
        msg += ' Unpaid, ' + Object.keys(c).map((id) => this.many(c[id], id)).join(', ') + ' deserted.';
      }
      this.note(state, msg, r.deserted.length ? 'bad' : null);
      return rep;
    },
    note(state, text, tone) {
      state.log = state.log || [];
      state.log.push({ d: state.economy.day, h: state.economy.hour | 0, t: text, k: tone || null });
      while (state.log.length > Wcfg().log) state.log.shift();
    },

    /* ---------------- movement ---------------- */
    route(state, to) {
      const from = state.army.at;
      const e = this.neighbours(state, from).find((q) => q.to === to);
      return e || null;
    },
    canMove(state, to) {
      if (to === state.army.at) return { ok: false, reason: 'You are here' };
      const e = this.route(state, to);
      if (!e) return { ok: false, reason: 'No route from here' };
      if (!this.known(state, to)) return { ok: false, reason: 'Unexplored' };
      if (e.type === 'sea' && !state.army.ship.owned) return { ok: false, reason: 'Needs a ship', sea: true };
      return { ok: true, type: e.type, hours: Wcfg().hours[e.type] || 6, battle: this.hostile(state, to) };
    },
    /* move the army one route. A hostile destination returns { battle: true } and
     * does NOT move: the caller launches the battle and then calls applyBattle. */
    move(state, to) {
      const m = this.canMove(state, to);
      if (!m.ok) return m;
      if (m.battle) return Object.assign({ battle: true }, m);
      const reports = this.advance(state, m.hours);
      state.army.at = to;
      if (m.type === 'sea') state.army.ship.at = to;
      const t = state.territories[to], s = this.site(state, to);
      let captured = null;
      if (t.owner !== 'player' && t.owner !== 'free') { reports.push(...this.advance(state, Wcfg().hours.claim)); captured = this.capture(state, to, 'claimed'); }
      else this.note(state, 'The army reaches ' + s.name + '.');
      this.look(state, to);
      this.progress(state);
      return { ok: true, moved: true, reports, captured };
    },

    /* ---------------- holdings ---------------- */
    capture(state, id, how) {
      const s = this.site(state, id), t = state.territories[id], d = state.sites[id];
      const prev = t.owner;
      t.owner = 'player'; d.garrison = [];
      const rw = s.reward || { gold: 0, leadership: 0 };
      const claimed = !!(state.flags.taken && state.flags.taken[id]);
      state.flags.taken = state.flags.taken || {};
      let msg = s.name + (how === 'claimed' ? ' is claimed' : ' falls to you') + '.';
      if (!claimed) {
        state.flags.taken[id] = state.economy.day;
        state.economy.gold += rw.gold; state.hero.leadership += rw.leadership; state.hero.renown += Math.round(rw.leadership / 2);
        msg += ' +' + rw.gold + ' gold' + (rw.leadership ? ', +' + rw.leadership + ' leadership' : '') + '.';
        state.stats.captured++;
      }
      if (s.income) msg += ' It pays ' + s.income + ' gold a day.';
      if (d.kind && d.stock) msg += ' Recruits: ' + Object.keys(d.stock).map((k) => D.troops[k].name).join(', ') + '.';
      if (state.objectives.minor[id]) state.objectives.minor[id].captured = true;
      const L = state.objectives.lords.find((q) => q.stronghold === id);
      if (L && !L.defeated) { L.defeated = true; msg += ' The Dragon Lord of ' + D.allegianceName(L.allegiance) + ' is overthrown!'; }
      this.note(state, msg, 'good');
      if (s.kind === 'harbour' && !state.army.ship.owned) this.note(state, 'A shipwright at ' + s.name + ' will build you a ship for ' + Wcfg().ship.cost + ' gold.', 'good');
      if (this.isWon(state) && !state.flags.won) { state.flags.won = state.economy.day; this.note(state, 'CAMPAIGN VICTORY — the main Dragon Lord\'s fortress has fallen.', 'good'); }
      this.progress(state);
      return { id, prev, reward: claimed ? null : rw };
    },
    /* where recruiting is possible: the army is there, and it is yours or a free village */
    recruitSite(state, id) {
      id = id || state.army.at;
      const t = state.territories[id], d = state.sites[id];
      if (!t || !d || !d.kind || !d.stock) return null;
      if (t.owner !== 'player' && t.owner !== 'free') return null;
      return d;
    },
    recruit(state, troopId, n) {
      const d = this.recruitSite(state);
      if (!d) return { ok: false, reason: state.sites[state.army.at] && state.sites[state.army.at].kind ? 'Take this place first' : 'Nobody to hire here' };
      const r = C.Rules.recruit(state, troopId, n, d);
      if (r.ok) {
        state.stats.recruited += n;
        this.advance(state, Wcfg().hours.recruit);
        this.note(state, 'Hired ' + this.many(n, troopId) + ' for ' + r.cost + ' gold.');
      }
      return r;
    },
    /* the ship: at a harbour you hold, for gold */
    shipTerms(state) {
      const cfg = Wcfg().ship, at = state.army.at, t = state.territories[at];
      if (state.army.ship.owned) return { ok: false, reason: 'You have a ship', owned: true };
      if (!t || !cfg.needs.includes(t.kind)) return { ok: false, reason: 'Ships are built at a harbour' };
      if (t.owner !== 'player') return { ok: false, reason: 'Take the harbour first' };
      if (state.economy.gold < cfg.cost) return { ok: false, reason: 'Needs ' + cfg.cost + ' gold', cost: cfg.cost };
      return { ok: true, cost: cfg.cost };
    },
    buyShip(state) {
      const r = this.shipTerms(state);
      if (!r.ok) return r;
      state.economy.gold -= r.cost;
      state.army.ship = { owned: true, at: state.army.at };
      state.flags.ship = state.economy.day;
      this.advance(state, 6);
      this.note(state, 'Your ship is launched. The sea routes are open.', 'good');
      for (const e of this.neighbours(state, state.army.at)) this.reveal(state, e.to);
      this.progress(state);
      return r;
    },

    /* ---------------- battles ---------------- */
    /* apply a local battle's result. result = { won, survivors: {troopId: n},
     * enemy: {troopId: n}, hours, retreat, dragonDown } */
    applyBattle(state, id, result) {
      const s = this.site(state, id);
      state.stats.battles++;
      // the army is what survived
      const before = state.army.stacks.map((q) => q.slice ? q.slice() : Object.assign({}, q));
      const surv = result.survivors || {};
      state.army.stacks = Object.keys(surv).filter((k) => surv[k] > 0 && D.troops[k]).sort().map((k) => ({ troop: k, count: surv[k] | 0 }));
      const lost = {};
      for (const b of before) { const n = b.count - (surv[b.troop] || 0); if (n > 0) lost[b.troop] = n; }
      const lostTxt = Object.keys(lost).length ? ' Lost: ' + Object.keys(lost).map((k) => this.many(lost[k], k)).join(', ') + '.' : ' No losses.';
      const reports = this.advance(state, result.hours || Wcfg().hours.battle);
      let captured = null;
      if (result.won) {
        state.stats.won++;
        state.army.at = id;
        this.note(state, 'Victory at ' + s.name + '.' + lostTxt, 'good');
        captured = this.capture(state, id, 'won');
        this.look(state, id);
      } else {
        // the defenders who lived hold the site still; the army stays where it marched from
        const en = result.enemy || {};
        const g = Object.keys(en).filter((k) => en[k] > 0 && D.troops[k]).sort().map((k) => [k, en[k] | 0]);
        state.sites[id].garrison = g;
        this.note(state, (result.retreat ? 'The army withdrew from ' : 'Defeat at ') + s.name + '.' + lostTxt + (g.length ? '' : ' Its defenders are all dead: march in to claim it.'), 'bad');
      }
      this.progress(state);
      return { reports, captured, lost };
    },

    /* ---------------- progress and victory ---------------- */
    isWon(state) {
      const P = state.objectives.lords.find((l) => l.primary) || state.objectives.lords[0];
      return !!P && P.defeated;
    },
    progress(state) {
      const w = this.of(state), own = (id) => state.territories[id] && state.territories[id].owner === 'player';
      let p = 0;
      if (w.gates.firstBridges.some(own)) p = 1;
      if (w.sites.some((s) => s.tier === 2 && own(s.id))) p = Math.max(p, 2);
      if (own(w.castle)) p = Math.max(p, 3);
      if (own(w.harbour) || state.army.ship.owned) p = Math.max(p, 4);
      if (w.sites.some((s) => s.tier >= 5 && own(s.id))) p = Math.max(p, 5);
      if (w.sites.some((s) => s.lord && this.known(state, s.id))) p = Math.max(p, 6);
      state.world.progress = Math.max(state.world.progress || 0, p);
      return state.world.progress;
    },
    // the gold the holdings bring in each day, and what the army costs
    ledger(state) { const inc = C.Rules.incomePerDay(state), wag = C.Rules.wagesPerDay(state.army); return { income: inc, wages: wag, net: inc - wag }; },
  };
  C.World = World;
})(window.AS);
