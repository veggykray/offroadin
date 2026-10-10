/* WYRMCROWN — the advisor: the current aim shown on the HUD.
 * There are no scripted missions in a realm match; instead the advisor reads
 * the situation every second and names the most pressing thing to do, with a
 * marker in the world: defend the town, eat, heal, spend gold, seize land,
 * claim a power-up, or break a rival whose ward has fallen. The first minute
 * teaches the controls. */
'use strict';
(function (AS) {
  const U = AS.U;
  const TIPS = [
    { t: 0, title: 'FLIGHT', text: 'W beats your wings, S flares to brake, A/D bank. Hold SPACE to fly low — add W for a fast power dive, or S to slow right down. Hold Z to climb high, X to come down.' },
    { t: 9, title: 'WIZARD & DRAGON', text: 'Left mouse casts bolts where you aim. Right mouse (or F) breathes fire — your dragon turns its head toward the cursor.' },
    { t: 19, title: 'FOOD', text: 'Your dragon tires as it flies. Fly low and not too fast over an animal and tap E to eat it (hold E to carry it home).' },
    { t: 30, title: 'THE LAND', text: 'Neutral mines, villages and towers dot the realm. Defeat their guardians, then circle low to claim them.' },
    { t: 42, title: 'YOUR TOWN', text: 'Gold carts roll home from what you hold. Return home and press T to build walls, towers, troops and upgrades.' },
  ];
  const Advisor = {
    current(g) {
      if (g.time - (this.t || -9) < 1 && this.last && this.lastG === g) return this.last;
      this.t = g.time; this.lastG = g;
      this.last = this.compute(g);
      return this.last;
    },
    compute(g) {
      const p = g.player, F = g.playerFaction;
      if (p.down > 0) return null;
      if (g.time < 54) { let tip = TIPS[0]; for (const q of TIPS) if (g.time >= q.t) tip = q; return { title: tip.title, text: tip.text, icon: 'star', col: '#bfe0ff' }; }
      if (g.time - F.attackedT < 12) return { title: 'TO ARMS!', text: F.def.short + ' is under attack' + (F.lastAttacker ? ' by ' + F.lastAttacker.def.short : '') + '! Fly home and drive them off.', icon: 'flame', col: '#ff7a5a', target: { x: F.townPos.x, y: F.townPos.y, label: 'HOME' } };
      if (p.energy < p.maxEnergy * 0.25) {
        const prey = this.nearestPrey(g, p);
        return { title: 'HUNGER', text: 'Your dragon is ' + (p.energy <= 0 ? 'starving and weakening' : 'hungry') + '. Double-click an animal to swoop on it and eat it.', icon: 'meat', col: '#f0a23a', target: prey ? { x: prey.x, y: prey.y, label: 'PREY' } : null };
      }
      if (p.hp < p.maxHp * 0.3) return { title: 'WOUNDED', text: 'Badly hurt. Rest at your roost to heal — or claim an Elixir of Life.', icon: 'heart', col: '#ff8a7a', target: { x: F.roost.x, y: F.roost.y, label: 'ROOST' } };
      // a rival laid bare
      for (const R of g.factionList) {
        if (R === F || R.eliminated || !R.keep || !R.keep.alive) continue;
        if (g.bc && !g.isExplored(R.townPos.x, R.townPos.y)) continue; // (the campaign's Dragon Lord has to be found first)
        if (R.wardStrength() <= 1 && (!R.dragon || R.dragon.down > 0 || R.wardStrength() === 0)) return { title: 'STRIKE NOW', text: R.def.short + '\'s ward is broken! Storm its stronghold before it recovers.', icon: 'castle', col: '#ffd24a', target: { x: R.keep.x, y: R.keep.y, label: R.def.short.toUpperCase() } };
      }
      const cheapest = this.cheapestBuy(F);
      const atHome = Math.hypot(p.x - F.townPos.x, p.y - F.townPos.y) < 520;
      if (cheapest && F.gold >= cheapest + 60) {
        if (atHome) return { title: 'YOUR COURT', text: 'You have ' + Math.floor(F.gold) + ' gold. Press T to hold court and strengthen your realm.', icon: 'coin', col: '#f2c14e' };
        if (F.gold >= 420) return { title: 'GOLD TO SPEND', text: Math.floor(F.gold) + ' gold waits in your treasury. Fly home and press T to build.', icon: 'coin', col: '#f2c14e', target: { x: F.townPos.x, y: F.townPos.y, label: 'HOME' } };
      }
      const orb = g.pickups.find((q) => q.alive && q.def && Math.hypot(q.x - p.x, q.y - p.y) < 1300);
      if (orb) return { title: 'MAGIC STIRS', text: orb.def.name + ' glows at a rune circle nearby — fly low through it.', icon: 'pw_' + orb.kind, col: orb.def.col, target: { x: orb.x, y: orb.y, label: orb.def.name.toUpperCase() } };
      const site = this.bestSite(g, p, F);
      if (site && (F.sitesOwned < 4 || g.time < 600 || g.bc)) {
        const verb = site.owner ? 'Seize ' + site.name + ' from ' + g.factions[site.owner].def.short : site.guarded() ? 'Clear the guardians of ' + site.name + ', then circle low to claim it' : 'Circle low over ' + site.name + ' to claim it';
        return { title: 'SEIZE THE LAND', text: verb + ' — ' + site.def.desc, icon: 'flag', col: '#ffe6a0', target: { x: site.x, y: site.y, label: site.name.toUpperCase() } };
      }
      // late game: pick the weakest rival and take it apart
      const R = this.weakestRival(g, F);
      if (R && g.bc && !g.isExplored(R.townPos.x, R.townPos.y)) return { title: 'THE DRAGON LORD', text: 'A Dragon Lord rules the Isle of Ravens beyond the eastern sea and never leaves it. Fly out and find his stronghold.', icon: 'skull', col: R.def.color };
      if (R) {
        const ward = R.buildings.find((b) => b.kind === 'wardstone' && b.alive);
        if (ward) return { title: 'BREAK ' + R.def.short.toUpperCase(), text: 'Topple ' + R.def.short + '\'s wardstones and drive off ' + (R.dragon ? R.dragon.name : 'its dragon') + ' to break the ward on its stronghold.', icon: 'ward', col: R.def.color, target: { x: ward.x, y: ward.y, label: 'WARDSTONE' } };
        return { title: 'BREAK ' + R.def.short.toUpperCase(), text: 'Its wardstones are down. Drive off ' + (R.dragon ? R.dragon.name : 'its dragon') + ', then burn the stronghold.', icon: 'castle', col: R.def.color, target: { x: R.keep.x, y: R.keep.y, label: R.def.short.toUpperCase() } };
      }
      return null;
    },
    nearestPrey(g, p) {
      let best = null, bd = 2400 * 2400;
      for (const o of g.life.animals) { if (o.dead || o.carried) continue; const d = (o.x - p.x) * (o.x - p.x) + (o.y - p.y) * (o.y - p.y); if (d < bd) { bd = d; best = o; } }
      return best;
    },
    cheapestBuy(F) {
      let best = null;
      for (const tab in AS.Data.court) for (const id of AS.Data.court[tab]) {
        const why = F.blocker(id); if (why && why !== 'Not enough gold') continue;
        const c = F.price(id); if (c !== null && (best === null || c < best)) best = c;
      }
      return best;
    },
    bestSite(g, p, F) {
      let best = null, bs = -1e9;
      for (const s of g.sites) {
        if (s.owner === F.key || (s.def.treasure && s.looted) || s.def.landmark) continue;
        const d = Math.hypot(s.x - p.x, s.y - p.y), dt = Math.hypot(s.x - F.townPos.x, s.y - F.townPos.y);
        let v = (s.def.income ? 3 : 1.5) + (s.rich ? 2 : 0) + (s.kind === 'castle' ? 2 : 0) - (s.guarded() ? 1.2 : 0) - (s.owner ? 1 : 0);
        v -= d / 1500 + dt / 2500;
        if (v > bs) { bs = v; best = s; }
      }
      return best;
    },
    weakestRival(g, F) {
      let best = null, bs = 1e9;
      for (const R of g.factionList) { if (R === F || R.eliminated || !R.keep) continue; const sc = R.wardStrength() * 2 + R.keep.hp / R.keep.maxHp * 3 + R.sitesOwned * 0.5; if (sc < bs) { bs = sc; best = R; } }
      return best;
    },
  };
  AS.Advisor = Advisor;
})(window.AS);
