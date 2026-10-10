/* WYRMCROWN — ARMY COMMAND TEST: the development scenario for independent armies
 * and commanders (maps/armytest.js). Opened with index.html?world=army or from the
 * title menu ("Army Command Test").
 *
 *   two armies     Red Company at the castle (no commander) and the Hollowford
 *                  Guard defending Hollowford under King Osric
 *   two commanders King Osric (leading) and Brannoc Deepdelver (waiting at the castle)
 *   the world      the Greyspine wall, its guarded pass, the ground-only Delverway
 *                  under it with the Gloomvault Horde inside, Blackthorn Fort beyond
 *   a raid         at RAID seconds Blackthorn sends raiders against Hollowford
 *
 * K opens the command panel (UI/armycmd.js): assign commanders, give orders,
 * settle underground encounters, save and load. A strip at the top right lists the
 * armies; arrows at the screen edge point to armies out of sight.
 * Saves go to localStorage (KEY). This file is the scenario only: every rule is in
 * src/game/armies.js, routes.js and autoresolve.js. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const KEY = 'wyrmcrown.armytest.v1';

  const ArmyTest = {
    KEY,
    start(save) { AS.App.startMatch('armytest', { faction: 'human', armyTest: { save: save || null }, god: AS.App.params && AS.App.params.get('god') === '1' }); },
    // called by the realm once its towns and sites exist (realm.load)
    setup(g) {
      const M = g.map.armyTest, sv = g.opts.armyTest && g.opts.armyTest.save;
      g.at = { raidSent: false, raid: [], t: 0 };
      const hf = g.byId.get('hollowford'); if (hf) hf.setOwner(g.playerKey, true);
      // the tunnel mouths are ways down, not treasure
      for (const id of ['delversdoor', 'hollowstair']) { const s = g.byId.get(id); if (s) { s.looted = true; s.respawnT = 1e9; if (s.chest) s.chest.hidden = true; } }
      if (sv) return this.restore(g, sv);
      const A = AS.Armies.init(g);
      for (const c of M.commanders) {
        const n = c.at ? AS.Routes.node(g, c.at) : null;
        AS.Armies.addCommander(g, c.id, g.playerKey, n ? n.x : c.x, n ? n.y : c.y);
      }
      for (const a of M.armies) AS.Armies.create(g, Object.assign({ owner: g.playerKey }, a));
      for (const G of M.groups) A.groups[G.id] = Object.assign({ wounds: {}, defeated: false }, JSON.parse(JSON.stringify(G)));
      g.later(2, () => g.msg('ARMY COMMAND TEST — PRESS K FOR THE COMMAND PANEL', '#ffe7a8', 5));
      g.later(7.5, () => g.news('Brannoc Deepdelver waits at the castle beside Red Company. King Osric holds Hollowford. Raiders from Blackthorn Fort are expected.', g.playerKey, true));
    },
    update(g, dt) {
      const T = g.at; if (!T) return;
      T.t += dt;
      const R = g.map.armyTest.raid;
      if (!T.raidSent && g.armies.clock >= R.at) this.sendRaid(g);
      // the realm's dragon at the tunnel mouth: only armies may go down
      const p = g.player;
      for (const id of ['delversdoor', 'hollowstair']) {
        const s = g.byId.get(id); if (!s || !p || p.down > 0) continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) < 160 && p.z < 70 && g.time > (T.mouthMsgT || 0)) { T.mouthMsgT = g.time + 8; g.msg('THE DRAGON CANNOT ENTER — ONLY ARMIES GO UNDERGROUND', '#cfe8ff', 2.5); }
      }
    },
    sendRaid(g) {
      const T = g.at, R = g.map.armyTest.raid; if (T.raidSent) return;
      T.raidSent = true;
      let i = 0;
      for (const [role, n] of R.troops) for (let k = 0; k < n; k++) {
        const a = (i++) * 2.399, r = 20 + Math.sqrt(i) * 16;
        const u = new AS.Troop(g, role, 'wild', R.from[0] + Math.cos(a) * r, R.from[1] + Math.sin(a) * r * 0.8);
        u.raider = true; g.troops.push(u); T.raid.push(u);
        u.marchTo(R.to[0] + U.range(-60, 60), R.to[1] + U.range(-40, 40), { r: 140, siege: true });
      }
      AS.Armies.note(g, 'Raiders march out of Blackthorn Fort towards Hollowford!', true);
    },

    /* ---------------- saving ---------------- */
    snapshot(g) {
      const p = g.player;
      return {
        v: 1, savedAt: Date.now(), armies: AS.Armies.serialize(g), time: +g.time.toFixed(1),
        sites: g.sites.map((s) => ({ id: s.id, o: s.owner || null, guards: s.guards.filter((u) => u.alive && !u.removed).map((u) => [u.role, Math.round(u.x), Math.round(u.y), +(u.hp / u.maxHp).toFixed(3)]) })),
        raid: { sent: g.at.raidSent, units: g.at.raid.filter((u) => u.alive && !u.removed).map((u) => [u.role, Math.round(u.x), Math.round(u.y), +(u.hp / u.maxHp).toFixed(3)]) },
        dragon: p && p.down <= 0 ? [Math.round(p.x), Math.round(p.y)] : null,
      };
    },
    save(g) { try { localStorage.setItem(KEY, JSON.stringify(this.snapshot(g))); return true; } catch (e) { return false; } },
    load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    restore(g, sv) {
      AS.Armies.restore(g, sv.armies);
      // places: owners, and the guards still standing (with their wounds)
      for (const r of sv.sites || []) {
        const s = g.byId.get(r.id); if (!s) continue;
        if (r.o && r.o !== s.owner) s.setOwner(r.o, true);
        const left = (r.guards || []).slice();
        for (const u of s.guards) {
          const i = left.findIndex((q) => q[0] === u.role);
          if (i < 0) { u.alive = false; u.removed = true; continue; }
          const q = left.splice(i, 1)[0]; u.x = q[1]; u.y = q[2]; u.hp = u.maxHp * q[3];
        }
      }
      // raiders on the road
      g.at.raidSent = !!(sv.raid && sv.raid.sent);
      const R = g.map.armyTest.raid;
      for (const q of (sv.raid && sv.raid.units) || []) {
        const u = new AS.Troop(g, q[0], 'wild', q[1], q[2]); u.hp = u.maxHp * q[3]; u.raider = true;
        g.troops.push(u); g.at.raid.push(u);
        u.marchTo(R.to[0], R.to[1], { r: 140, siege: true });
      }
      if (sv.dragon) { const p = g.player; p.x = sv.dragon[0]; p.y = sv.dragon[1]; p.z = 110; for (const n of p.nodes) { n.x = p.x; n.y = p.y; n.z = p.z; } p.layoutRig(0, true); }
      g.later(1.5, () => g.msg('ARMY COMMAND TEST — SAVE LOADED', '#bfe8a0', 3));
    },

    /* ---------------- the HUD: the armies at a glance ---------------- */
    drawHUD(ctx, g, W, H, s) {
      const A = g.armies; if (!A) return;
      const R = AS.Renderer, cam = g.camera, p = g.player;
      ctx.save();
      ctx.textBaseline = 'middle';
      // the list, on the right under the advisor's note
      const list = A.list.filter((a) => a.status !== 'destroyed' && a.status !== 'disbanded');
      const x0 = W - 330 * s, y0 = 200 * s, lh = 30 * s; // (right, under the advisor's note)
      ctx.fillStyle = 'rgba(14,9,5,0.72)';
      ctx.fillRect(x0, y0, 316 * s, (list.length * 2 + 1) * lh / 2 + 22 * s);
      ctx.font = 'bold ' + Math.round(12 * s) + 'px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe7a8';
      ctx.fillText('ARMIES · K — COMMAND', x0 + 10 * s, y0 + 12 * s);
      list.forEach((a, i) => {
        const S = AS.Armies.summary(g, a), y = y0 + 30 * s + i * lh;
        ctx.font = 'bold ' + Math.round(12 * s) + 'px Georgia, serif'; ctx.fillStyle = a.enc ? '#ff9a6a' : a.layer === 'under' ? '#c8b0ff' : '#f0e2c0';
        ctx.fillText(S.name + ' — ' + S.count + (S.cmdr ? ' · ' + S.cmdr : ' · no commander'), x0 + 10 * s, y);
        ctx.font = Math.round(11 * s) + 'px Georgia, serif'; ctx.fillStyle = '#c8b898';
        ctx.fillText((a.enc ? 'ENGAGED · ' : '') + (a.layer === 'under' ? 'underground · ' : '') + S.order + ' · morale ' + S.morale, x0 + 10 * s, y + 13 * s);
      });
      // armies out of sight: an arrow at the screen edge (with distance); armies in the
      // ground: shown at their place on the war map position, dashed
      const dpr = R.dpr || 1;
      for (const a of list) {
        const q = AS.Armies.pos(a), wx = a.layer === 'under' ? (AS.Routes.node(g, a.node) || {}).mx || q.x : q.x, wy = a.layer === 'under' ? (AS.Routes.node(g, a.node) || {}).my || q.y : q.y;
        const sc = R.worldToScreen(wx, wy, cam), sx = sc.x, sy = sc.y;
        const inside = sx > 30 * s && sx < W - 30 * s && sy > 30 * s && sy < H - 30 * s;
        if (inside && a.units) continue; // its soldiers are right there
        const ex = U.clamp(sx, 40 * s, W - 40 * s), ey = U.clamp(sy, 170 * s, H - 50 * s); // (clear of the flasks and the gold)
        const ang = Math.atan2(sy - H / 2, sx - W / 2);
        ctx.save(); ctx.translate(ex, ey);
        ctx.fillStyle = a.enc ? '#ff7a4a' : a.layer === 'under' ? '#b89aff' : '#ffe28c';
        if (!inside) { ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(-6 * s, -8 * s); ctx.lineTo(-6 * s, 8 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, TAU); ctx.fill(); }
        ctx.font = 'bold ' + Math.round(11 * s) + 'px Georgia, serif'; ctx.textAlign = ex < 160 * s ? 'left' : ex > W - 160 * s ? 'right' : 'center'; ctx.fillStyle = '#fff4d8';
        const d = p ? Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 4) : 0; // (1 unit ≈ 0.25 m)
        ctx.fillText(a.name + ' (' + AS.Armies.count(a) + ')' + (a.layer === 'under' ? ' ▼' : '') + ' ' + d + ' m', ctx.textAlign === 'left' ? -10 * s : ctx.textAlign === 'right' ? 10 * s : 0, -16 * s);
        ctx.restore();
      }
      ctx.restore();
    },
  };
  AS.ArmyTest = ArmyTest;
})(window.AS);
