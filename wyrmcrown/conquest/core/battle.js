/* WYRMCROWN — CONQUEST battles: a campaign site fought out in the real-time game.
 *
 * Nothing about combat is duplicated. A battle is the ordinary battle engine
 * (AS.Realm) started with an opt-in configuration, `opts.conquest`:
 *
 *   config(state, siteId)  → the battle's description (pure data: site, defenders,
 *                            the army, the local map) — testable without a browser
 *   mapFor(cfg)            → a local map record in the battle maps' own format: one
 *                            island (a sea all round, made with the terrain's existing
 *                            lake + island shapes), a river and bridge for a bridge
 *                            site, the player's landing camp at one end and the
 *                            objective at the other, herds for the dragon to eat
 *   launch(slot, siteId)   → starts the battle (AS.App.startMatch with the map record)
 *
 * The realm calls back here only because opts.conquest is set:
 *   camp(g, F)   the player's faction gets a landing camp (a roost) instead of a town
 *   setup(g)     the defenders take the field (as the site's guards, or around a Dragon
 *                Lord's town) and the army lands and marches on the objective
 *   update(g)    victory: the site is taken (guards dead, then claimed by circling
 *                low or by troops in the ring, as in the battle mode), a treasure site
 *                is looted, or a Dragon Lord's realm falls. Defeat: the dragon is
 *                driven from the sky (battleLives times), or the army retreats.
 *
 * At the end, result(g) is the payload Conquest applies (core/world.js applyBattle):
 *   { conquest: true, siteId, won, retreat, dragonDown, survivors: {troopId: n},
 *     enemy: {troopId: n}, hours, time }
 * Troop types are tracked per unit (each spawned unit carries its campaign type),
 * so casualties are exact. Normal battles never touch this file. */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data, U = AS.U;
  const REALMS = ['human', 'elf', 'ice', 'undead'];
  const MAX_SPAWN = 120; // units fielded at once; the rest wait in reserve (and survive)
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  const Battle = {
    MAX_SPAWN,
    pending: null, // { slot, siteId, cfg } while a battle runs

    /* ---------------- description ---------------- */
    config(state, siteId) {
      const s = C.World.site(state, siteId), w = C.World.of(state);
      const K = D.territories[s.kind] || {};
      const lord = s.kind === 'lordhold' ? s.owner : null;
      const isl = w.islands.find((i) => i.id === s.island) || {};
      const biome = REALMS.includes(s.owner) ? s.owner : isl.kind === 'home' && s.tier <= 1 ? state.hero.allegiance : 'neutral';
      const cfg = {
        siteId, name: s.name, kind: s.kind, tier: s.tier, owner: s.owner, lord,
        team: REALMS.includes(s.owner) ? s.owner : 'wild',
        battleSite: lord ? null : (K.battleSite || 'fort'),
        garrison: s.garrison.map((g) => g.slice()),
        army: state.army.stacks.map((q) => ({ troop: q.troop, count: q.count })),
        allegiance: state.hero.allegiance,
        biome, campBiome: isl.kind === 'lord' ? s.owner : isl.kind === 'home' && s.tier <= 1 ? state.hero.allegiance : 'neutral',
        seed: (state.seed ^ hashStr(siteId)) >>> 0,
        lives: D.world.battleLives,
        bridge: s.kind === 'bridge',
        coast: s.kind === 'harbour' || s.kind === 'landing',
        art: K.art || null,
      };
      cfg.map = this.mapFor(cfg);
      return cfg;
    },
    mapFor(cfg) {
      const rng = new U.RNG(cfg.seed);
      const S = cfg.lord ? 6400 : 5200, c = S / 2;
      const ang = rng.next() * U.TAU;                       // from the camp toward the objective
      const span = cfg.lord ? 2300 : 1900;
      const camp = { x: Math.round(c - Math.cos(ang) * span / 2), y: Math.round(c - Math.sin(ang) * span / 2) };
      const obj = { x: Math.round(c + Math.cos(ang) * span / 2), y: Math.round(c + Math.sin(ang) * span / 2) };
      // one island with a ragged coast: blobs round the camp, the objective and between
      const islands = [{ x: c, y: c, r: S * 0.3 }, { x: camp.x, y: camp.y, r: S * 0.19 }, { x: obj.x, y: obj.y, r: S * (cfg.coast ? 0.15 : 0.21) }];
      for (let i = 0; i < 3; i++) { const a = rng.next() * U.TAU, d = rng.range(0.15, 0.24) * S; islands.push({ x: Math.round(c + Math.cos(a) * d), y: Math.round(c + Math.sin(a) * d), r: Math.round(S * rng.range(0.1, 0.16)) }); }
      const m = {
        id: 'cq_' + cfg.siteId, name: cfg.name, w: S, h: S, seed: (cfg.seed % 997) + 3, index: 1, conquest: true,
        blurb: 'Conquest battle', difficulty: 'Conquest',
        regions: [{ biome: cfg.biome, x: obj.x, y: obj.y, r: S * 0.5 }, { biome: cfg.campBiome, x: camp.x, y: camp.y, r: S * 0.38 }],
        factions: { [cfg.allegiance]: { town: camp, gate: ang } },
        // the sea: a lake over the whole map, with the island rising out of it
        lakes: [{ x: c, y: c, r: S * 1.4 }], islands,
        rivers: [], mountains: [], forests: [], roads: [{ pts: [[camp.x, camp.y], [Math.round((camp.x + obj.x) / 2 + rng.range(-200, 200)), Math.round((camp.y + obj.y) / 2 + rng.range(-200, 200))], [obj.x, obj.y]] }],
        bridges: [], sites: [], wild: [], runes: [],
        camp, obj,
      };
      if (cfg.lord) m.factions[cfg.lord] = { town: obj, gate: ang + Math.PI };
      else m.sites.push({ id: cfg.siteId, k: cfg.battleSite, name: cfg.name, x: obj.x, y: obj.y, guard: [] });
      if (cfg.bridge) {
        // a river across the island, crossed at the objective
        const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2), L = S * 0.6;
        m.rivers.push({ w: 110, pts: [[Math.round(obj.x - nx * L), Math.round(obj.y - ny * L)], [obj.x, obj.y], [Math.round(obj.x + nx * L), Math.round(obj.y + ny * L)]] });
        m.bridges.push({ site: cfg.siteId, x: obj.x, y: obj.y, a: ang });
      }
      // woods and a ridge away from the camp, the objective and the road
      const clear = (p, r) => Math.hypot(p.x - camp.x, p.y - camp.y) > r && Math.hypot(p.x - obj.x, p.y - obj.y) > r;
      for (let i = 0; i < 6; i++) { const a = rng.next() * U.TAU, d = rng.range(0.08, 0.3) * S, p = { x: Math.round(c + Math.cos(a) * d), y: Math.round(c + Math.sin(a) * d) }; if (clear(p, 700)) m.forests.push({ x: p.x, y: p.y, r: Math.round(rng.range(260, 520)), d: rng.range(0.6, 0.95) }); }
      if (rng.chance(0.6)) { const a = ang + Math.PI / 2 * (rng.chance(0.5) ? 1 : -1), p = { x: c + Math.cos(a) * S * 0.2, y: c + Math.sin(a) * S * 0.2 }; m.mountains.push({ w: 300, h: 0.7, pts: [[Math.round(p.x - Math.cos(ang) * 500), Math.round(p.y - Math.sin(ang) * 500)], [Math.round(p.x + Math.cos(ang) * 500), Math.round(p.y + Math.sin(ang) * 500)]] }); }
      // food for the dragon, and rune circles for power-ups
      const kinds = cfg.biome === 'ice' ? ['goat', 'deer'] : cfg.biome === 'undead' ? ['boar', 'goat'] : ['deer', 'boar'];
      for (let i = 0; i < 3; i++) { const a = ang + Math.PI + rng.range(-1.2, 1.2), d = rng.range(500, 900); m.wild.push({ k: kinds[i % 2], x: Math.round(camp.x + Math.cos(a) * d * 0.6 + Math.cos(ang) * d * 0.5), y: Math.round(camp.y + Math.sin(a) * d * 0.6 + Math.sin(ang) * d * 0.5), n: 4 }); }
      for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4, a = ang + Math.PI / 2, off = (i % 2 ? 1 : -1) * 420; m.runes.push([Math.round(U.lerp(camp.x, obj.x, t) + Math.cos(a) * off), Math.round(U.lerp(camp.y, obj.y, t) + Math.sin(a) * off)]); }
      return m;
    },

    /* ---------------- launching ---------------- */
    launch(slot, siteId) {
      const r = C.Save.load(slot);
      if (!r.state) return { ok: false, reason: r.error };
      const state = r.state;
      const m = C.World.canMove(state, siteId);
      if (!m.ok || !m.battle) return { ok: false, reason: m.reason || 'Nothing to fight there' };
      const cfg = this.config(state, siteId);
      cfg.hours = m.hours + D.world.hours.battle;
      this.pending = { slot, siteId, cfg };
      if (C.UI && C.UI.hide) C.UI.hide();
      AS.App.startMatch(cfg.map, { conquest: cfg, faction: state.hero.allegiance, difficulty: state.settings.difficulty || 'normal', god: !!(AS.App.params && AS.App.params.get('god') === '1') });
      return { ok: true };
    },

    /* ---------------- the realm's callbacks (opts.conquest only) ---------------- */
    // the player's faction: a landing camp — a roost to recover at — instead of a town
    camp(g, F) {
      F.roostB = F.place('roost', F.roost, { instant: true });
      g.terrain.addDecal('plaza', F.townPos.x, F.townPos.y + 6, 110, null, { static: true, fk: F.key, seed: F.townPos.x | 0 });
      F.gold = 0;
    },
    troopOpts(t, pal) {
      const o = { gen: t.gen || undefined, pal };
      if (t.mul && t.mul.hp) o.hpMul = t.mul.hp;
      return o;
    },
    // a unit of a campaign troop type (its base battle troop, scaled by the type's multipliers)
    spawn(g, troopId, team, x, y, pal) {
      const t = D.troops[troopId];
      const u = new AS.Troop(g, t.base, team, x, y, this.troopOpts(t, pal));
      if (t.mul) {
        const d = Object.assign({}, u.tdef);
        if (t.mul.dmg && d.melee) d.melee = Object.assign({}, d.melee, { dmg: d.melee.dmg * t.mul.dmg });
        if (t.mul.dmg && d.ranged) d.ranged = Object.assign({}, d.ranged);
        if (t.mul.range && d.ranged) d.ranged = Object.assign({}, d.ranged, { range: d.ranged.range * t.mul.range });
        if (t.mul.speed) d.speed = d.speed * t.mul.speed;
        u.tdef = d;
      }
      u.ctype = troopId;
      g.troops.push(u);
      return u;
    },
    setup(g) {
      const cfg = g.opts.conquest, m = g.map, P = g.playerFaction;
      const B = g.cq = { cfg, downs: 0, wasDown: false, enemy: [], army: [], reserve: {}, site: null, start: g.time, over: false };
      // the defenders
      const pal = REALMS.includes(cfg.owner) ? AS.Data.factions[cfg.owner].pal : AS.Data.pal.neutral;
      const site = cfg.lord ? null : g.sites.find((s) => s.id === cfg.siteId);
      B.site = site;
      const home = cfg.lord ? g.factions[cfg.lord].townPos : m.obj;
      let n = 0;
      for (const [id, cnt] of cfg.garrison) for (let i = 0; i < cnt; i++) {
        const a = (n++) * 2.399, r = 60 + Math.sqrt(n) * 34;
        const u = this.spawn(g, id, cfg.team, home.x + Math.cos(a) * r, home.y + Math.sin(a) * r * 0.8, pal);
        u.state = 'guard'; u.home = { x: home.x, y: home.y, r: cfg.lord ? 380 : 200 };
        if (site) { u.site = site; site.guards.push(u); }
        if (cfg.lord) g.factions[cfg.lord].troops.push(u);
        B.enemy.push(u);
      }
      // the army lands by the camp and marches on the objective
      let k = 0;
      for (const st of cfg.army) {
        for (let i = 0; i < st.count; i++) {
          if (k >= MAX_SPAWN) { B.reserve[st.troop] = (B.reserve[st.troop] || 0) + 1; continue; }
          const a = (k++) * 2.399, r = 40 + Math.sqrt(k) * 22;
          const u = this.spawn(g, st.troop, P.key, P.townPos.x + Math.cos(a) * r, P.townPos.y + Math.sin(a) * r * 0.8, P.def.pal);
          P.troops.push(u);
          u.marchTo(home.x + U.range(-80, 80), home.y + U.range(-60, 60), { r: 140, siege: !!cfg.lord });
          B.army.push(u);
        }
      }
      g.later(1.5, () => g.msg(cfg.lord ? 'BREAK THE DRAGON LORD\'S STRONGHOLD' : (site && site.def.treasure ? 'DEFEAT THE GUARDIANS, THEN LAND TO CLAIM THE HOARD' : 'DEFEAT THE DEFENDERS, THEN CIRCLE LOW TO CLAIM ' + cfg.name.toUpperCase()), '#ffe7a8', 5));
      if (cfg.lives === 1) g.later(6.5, () => g.msg('IF YOUR DRAGON IS DRIVEN FROM THE SKY, THE ARMY WITHDRAWS', '#ffb08a', 4));
    },
    update(g) {
      const B = g.cq;
      if (!B || g.state !== 'play') return;
      const p = g.player;
      // the dragon driven from the sky
      const down = p && p.down > 0;
      if (down && !B.wasDown) B.downs++;
      B.wasDown = down;
      if (B.downs >= B.cfg.lives) return this.end(g, false, 'Your dragon was driven from the sky. The army withdraws.');
      // the objective
      if (B.cfg.lord) {
        const L = g.factions[B.cfg.lord];
        if (L && L.eliminated) return this.end(g, true, 'The Dragon Lord\'s stronghold has fallen!');
      } else if (B.site) {
        if (B.site.owner === g.playerKey) return this.end(g, true, B.cfg.name + ' is yours.');
        if (B.site.def.treasure && B.site.looted) return this.end(g, true, B.cfg.name + ' is cleared and its hoard taken.');
      }
    },
    end(g, won, text, retreat) {
      if (g.state !== 'play') return;
      if (AS.Factions && AS.Factions.endMatch) AS.Factions.endMatch(g, won, text);
      g.result = Object.assign(g.result || {}, this.result(g, won, retreat));
    },
    retreat() {
      const g = AS.game;
      if (!g || !g.cq) return;
      AS.App.resume && AS.App.resume();
      this.end(g, false, 'The army withdraws.', true);
      g.endT = 0.1;
    },
    /* the payload Conquest applies: exact survivors per campaign troop type */
    result(g, won, retreat) {
      const B = g.cq, survivors = Object.assign({}, B.reserve), enemy = {};
      for (const u of B.army) if (u.alive && !u.removed) survivors[u.ctype] = (survivors[u.ctype] || 0) + 1;
      for (const u of B.enemy) if (u.alive && !u.removed) enemy[u.ctype] = (enemy[u.ctype] || 0) + 1;
      return { conquest: true, siteId: B.cfg.siteId, won: !!won, retreat: !!retreat, dragonDown: B.downs > 0, survivors, enemy, hours: B.cfg.hours, time: g.time };
    },
    /* the battle is over: the campaign takes the result, then the campaign map returns */
    onEnd(res) {
      const P = this.pending;
      this.pending = null;
      if (AS.App) AS.App.endGame();
      if (!P) { if (C.UI) C.UI.open(); return; }
      const r = C.Save.load(P.slot);
      if (!r.state) { if (C.UI) C.UI.open(null, 'The campaign could not be read after the battle: ' + r.error); return; }
      const out = C.World.applyBattle(r.state, P.siteId, res);
      const sv = C.Save.save(P.slot, r.state);
      if (C.UI) C.UI.open(P.slot, null, { battle: res, applied: out, saved: sv.ok });
    },
  };
  C.Battle = Battle;
})(window.AS);
