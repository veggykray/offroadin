/* ALIEN STRIKE — campaign progression: unlocks, rewards, upgrades, fabrication. */
'use strict';
(function (AS) {
  const Campaign = {
    profile() { return AS.Save.profile || AS.Save.loadProfile() || AS.Save.newProfile(); },
    order() { return AS.Levels.ordered().map((m) => m.id); },
    isUnlocked(id) { const p = this.profile(); return p.unlockedMissions.includes(id); },
    isDone(id) { const p = this.profile(); return !!(p.missions[id] && p.missions[id].completed); },
    nextMission() {
      const p = this.profile();
      for (const id of this.order()) if (p.unlockedMissions.includes(id) && !this.isDone(id)) return id;
      const done = this.order().filter((id) => p.unlockedMissions.includes(id));
      return done[done.length - 1] || this.order()[0];
    },
    worldUnlocked(w) { return AS.Levels.worldMissions(w).some((m) => this.isUnlocked(m.id)); },
    progressPct() { const all = this.order(); const done = all.filter((id) => this.isDone(id)).length; return Math.round(done / all.length * 100); },

    applyResult(res) {
      const p = this.profile();
      const m = res.mission;
      const rec = p.missions[m.id] || (p.missions[m.id] = { completed: false, best: null, objectives: {}, attempts: 0 });
      rec.attempts++;
      const r = { salvage: 0, tech: 0, unlocks: [], lines: [], newMission: null, firstClear: false };
      const st = res.stats;
      if (res.success) {
        r.firstClear = !rec.completed;
        const base = (m.rewards && m.rewards.salvage) || 400;
        r.lines.push(['Mission payment', base * (r.firstClear ? 1 : 0.5) | 0]);
        r.salvage += base * (r.firstClear ? 1 : 0.5) | 0;
        r.lines.push(['Salvage recovered', st.salvage]); r.salvage += st.salvage;
        if (st.bonusSalvage) { r.lines.push(['Rescues, deliveries & bonuses', st.bonusSalvage]); r.salvage += st.bonusSalvage; }
        let opt = 0, hid = 0;
        for (const o of res.objectives) {
          if (o.state !== 'done') continue;
          if (o.cat === 'secondary' && !rec.objectives[o.id]) opt++;
          if (o.cat === 'hidden' && !rec.objectives[o.id]) hid++;
          rec.objectives[o.id] = true;
        }
        if (opt) { r.lines.push(['Optional objectives (' + opt + ')', opt * 150]); r.salvage += opt * 150; }
        if (hid) { r.lines.push(['Hidden objectives (' + hid + ')', hid * 250]); r.salvage += hid * 250; r.tech += hid; }
        const techBase = r.firstClear ? ((m.rewards && m.rewards.tech) || 1) : 0;
        r.tech += techBase + st.tech;
        if (r.firstClear && m.rewards && m.rewards.unlock) for (const w of m.rewards.unlock) if (!p.unlockedWeapons.includes(w)) { p.unlockedWeapons.push(w); r.unlocks.push(w); }
        rec.completed = true;
        if (!rec.best || res.time < rec.best) rec.best = res.time;
        // unlock the next mission
        const ord = this.order(); const i = ord.indexOf(m.id);
        if (i >= 0 && i + 1 < ord.length && !p.unlockedMissions.includes(ord[i + 1])) { p.unlockedMissions.push(ord[i + 1]); r.newMission = ord[i + 1]; }
        p.stats.missions++;
      } else {
        // partial recovery: half of what was physically collected
        const part = Math.floor(st.salvage * 0.5);
        if (part) { r.lines.push(['Salvage recovered (partial)', part]); r.salvage += part; }
        r.tech += st.tech;
        p.stats.deaths++;
      }
      p.salvage += r.salvage; p.tech += r.tech;
      p.stats.kills += st.kills; p.stats.rescued += st.rescued; p.stats.salvageEarned += r.salvage; p.stats.playTime += res.time;
      p.repairKits = res.kitsLeft;
      p.lastMission = m.id;
      AS.Save.saveProfile();
      return r;
    },

    /* ---------- hangar economy ---------- */
    upgradeLevel(id) { return this.profile().upgrades[id] || 0; },
    upgradeCost(u) { const lv = this.upgradeLevel(u.id); if (lv >= u.max) return null; return { salvage: u.cost[lv], tech: u.tech[lv] || 0 }; },
    canAfford(c) { const p = this.profile(); return c && p.salvage >= c.salvage && p.tech >= c.tech; },
    buyUpgrade(id) {
      const u = AS.Data.upgrades.find((x) => x.id === id);
      const c = u && this.upgradeCost(u);
      if (!c || !this.canAfford(c)) return false;
      const p = this.profile();
      p.salvage -= c.salvage; p.tech -= c.tech;
      p.upgrades[id] = (p.upgrades[id] || 0) + 1;
      AS.Save.saveProfile();
      return true;
    },
    fabricate(wid) {
      const w = AS.Data.weapons[wid]; const p = this.profile();
      if (!w || !p.unlockedWeapons.includes(wid) || p.ownedWeapons.includes(wid)) return false;
      const c = w.fab || { salvage: 0, tech: 0 };
      if (!this.canAfford(c)) return false;
      p.salvage -= c.salvage; p.tech -= c.tech; p.ownedWeapons.push(wid);
      AS.Save.saveProfile();
      return true;
    },
    equip(wid) {
      const w = AS.Data.weapons[wid]; const p = this.profile();
      if (!w || !p.ownedWeapons.includes(wid)) return false;
      p.loadout[w.slot] = wid; AS.Save.saveProfile(); return true;
    },
    buyKit() {
      const p = this.profile(); const cap = AS.Stats.compute(p).kitCap;
      if (p.repairKits >= cap || p.salvage < AS.Data.repairKitCost) return false;
      p.salvage -= AS.Data.repairKitCost; p.repairKits++; AS.Save.saveProfile(); return true;
    },
  };
  AS.Campaign = Campaign;
})(window.AS);
