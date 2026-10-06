/* WYRMCROWN — console helpers for testing and screenshots (also used by the
 * automated test suite): AS.Debug.tp(x, y), hold(true) keeps the player's
 * dragon hovering in place, gold(n), see(fk) jumps to a faction's town. */
'use strict';
(function (AS) {
  const Debug = {
    tp(x, y, z) {
      const g = AS.game, p = g.player;
      p.x = x; p.y = y; if (z !== undefined) p.z = z;
      for (const n of p.nodes) { n.x = x; n.y = y; n.z = p.z; }
      p.layoutRig(0, true);
      g.camera.snap(x, y - p.z);
      return [x, y];
    },
    hold(on) {
      const g = AS.game, p = g.player;
      if (!on) { if (this._pilot) p.pilot = this._pilot; this._pilot = null; return false; }
      if (!this._pilot) this._pilot = p.pilot;
      const hx = p.x, hy = p.y, hz = p.z;
      p.pilot = { read(d, inp) { inp.throttle = -1; inp.turn = 0; inp.dive = false; inp.fire = false; inp.breath = false; d.x = hx; d.y = hy; d.z = hz; d.speed = 40; } };
      return true;
    },
    gold(n) { AS.game.playerFaction.gold += n; return AS.game.playerFaction.gold; },
    see(fk) { const F = AS.game.factions[fk]; return this.tp(F.townPos.x, F.townPos.y + 60); },
    site(id) { const s = AS.game.byId.get(id); return s ? this.tp(s.x, s.y + 40) : null; },
    info() { const g = AS.game; return g.factionList.map((F) => ({ k: F.key, gold: Math.round(F.gold), b: F.buildings.filter((b) => b.alive).length, t: F.troopCount(), sites: F.sitesOwned, ward: F.wardStrength(), elim: F.eliminated })); },
  };
  AS.Debug = Debug;
})(window.AS);
