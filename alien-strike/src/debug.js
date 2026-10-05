/* ALIEN STRIKE — debug / automation hooks (window.AS.Debug). Not exposed in the UI;
 * used by tools/test_game.mjs and handy from the browser console. */
'use strict';
(function (AS) {
  const D = {
    g() { return AS.game; },
    tp(x, y) { const p = AS.game.player; p.x = x; p.y = y; p.vx = p.vy = 0; AS.game.camera.snap(x, y - p.z); },
    god(on) { AS.game.godMode = on !== false; },
    state() {
      const g = AS.game; if (!g) return { state: AS.App.state };
      const p = g.player;
      return { app: AS.App.state, gs: g.state, t: +g.time.toFixed(2), x: Math.round(p.x), y: Math.round(p.y), sp: Math.round(p.speed), hull: +p.hull.toFixed(1), shield: +p.shield.toFixed(1), fuel: +p.fuel.toFixed(2), ammo: Object.assign({}, p.ammo), kits: p.kits, pas: p.passengers.length, cargo: p.cargo.length, alive: p.alive, dying: p.dying, emergency: p.emergency, units: g.units.length, kills: g.stats.kills, objs: g.script.objs.map((o) => o.id + ':' + o.state + ':' + o.progress), extraction: g.extraction.active };
    },
    nearest(filter) {
      const g = AS.game, p = g.player; let best = null, bd = 1e9;
      for (const u of g.units) { if (!u.alive || u.team !== 'enemy' || (filter && !filter(u))) continue; const d = Math.hypot(u.x - p.x, u.y - p.y); if (d < bd) { bd = d; best = u; } }
      return best;
    },
    // screen (CSS px) position of a world entity's projected centre
    screenOf(e) {
      const g = AS.game, R = AS.Renderer;
      const q = R.worldToScreen(e.x, e.py !== undefined ? e.py : e.y, g.camera);
      return { x: q.x / R.dpr, y: q.y / R.dpr };
    },
    killAll(team) { for (const u of AS.game.units) if (u.alive && u.team === (team || 'enemy') && !u.boss) { u.invuln = false; u.takeDamage(1e6, 'ap', null); } },
    destroy(id) { const e = AS.game.byId.get(id); if (e && e.alive) { e.invuln = false; e.targetable = true; if (e.isShielded) e.shieldedBy = []; e.takeDamage(1e7, 'ap', AS.game.player); } return !!e; },
    completeAll(cat) { const s = AS.game.script; for (const o of s.objs) if ((!cat || o.cat === cat) && o.state !== 'done') { if (o.state === 'locked') o.state = 'active'; s.setDone(o, true); } s.evaluate(); },
    deliverAll() {
      const g = AS.game, p = g.player;
      for (const gr of g.groups) { gr.caged = null; for (const q of gr.people) if (q.alive && !q.aboard) { q.aboard = true; g.emit('delivered', { kind: 'person', group: gr.id }); g.stats.rescued++; } }
      for (const c of g.cargo) if (!c.delivered) { c.delivered = true; g.emit('delivered', { kind: 'cargo', id: c.id }, c.deliver); }
    },
    toExtraction() { const e = AS.game.extraction; this.tp(e.x, e.y); },
    setFuel(f) { AS.game.player.fuel = f; },
    hurt(n, type) { return AS.game.player.takeDamage(n, type || 'kinetic', null, 0); },
    finishNow(success) { const g = AS.game; if (success) { g.state = 'extracting'; g.endT = 0.01; } else g.fail('debug', 0.01); },
    profile() { return AS.Save.profile; },
  };
  AS.Debug = D;
})(window.AS);
