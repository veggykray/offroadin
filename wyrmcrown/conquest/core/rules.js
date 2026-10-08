/* WYRMCROWN — CONQUEST rules: leadership, wages, recruitment and income.
 * Pure functions over the campaign state (core/campaign.js) and the static
 * data — no game loop, no rendering, no side effects except where a function
 * is explicitly a mutation (recruit). Everything here is unit-tested by
 * wyrmcrown/tools/test_conquest.mjs.
 *
 * Army size is limited twice over: by leadership (each troop type occupies a
 * fixed number of points) and by gold (recruiting costs gold, and every troop
 * draws a wage each campaign day). */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data;
  const CFG = {
    dayLength: 180,        // seconds of real-time play per campaign day (wages and income tick daily)
    baseLeadership: 60,    // a fresh campaign's leadership
    startGold: 250,        // "little gold and no army"
  };
  const Rules = {
    CFG,
    troop(id) { return D.troops[id] || null; },
    /* leadership points the army occupies */
    leadershipUsed(army) {
      let n = 0;
      for (const s of army.stacks) { const t = D.troops[s.troop]; if (t) n += t.leadership * s.count; }
      return n;
    },
    leadershipFree(state) { return state.hero.leadership - this.leadershipUsed(state.army); },
    /* gold the army draws each campaign day */
    wagesPerDay(army) {
      let n = 0;
      for (const s of army.stacks) { const t = D.troops[s.troop]; if (t) n += t.wage * s.count; }
      return n;
    },
    /* gold the player's holdings pay each campaign day */
    incomePerDay(state) {
      let n = 0;
      for (const id in state.territories) {
        const h = state.territories[id];
        if (h.owner === 'player') { const k = D.territories[h.kind]; if (k) n += k.income; }
      }
      return n;
    },
    /* can a player of this allegiance recruit this troop type at all, and at what cost per head?
     * Own realm: yes, full price. Opposing realm: never. Neutral: by the allegiance's
     * neutralCost for the troop's tag (null = refused). */
    recruitTerms(allegiance, troopId) {
      const t = D.troops[troopId], A = D.allegiances[allegiance];
      if (!t) return { ok: false, reason: 'Unknown troop type' };
      if (!A) return { ok: false, reason: 'Unknown allegiance' };
      if (t.allegiance === allegiance) return { ok: true, cost: t.cost };
      if (t.allegiance !== 'neutral') return { ok: false, reason: 'Only ' + D.allegianceName(t.allegiance) + ' recruits ' + t.name + 's' };
      const k = t.tag && A.neutralCost[t.tag] !== undefined ? A.neutralCost[t.tag] : 1;
      if (k === null) return { ok: false, reason: t.name + 's will not serve ' + D.allegianceName(allegiance) };
      return { ok: true, cost: Math.round(t.cost * k) };
    },
    /* the full check before recruiting n of a type from a site: allegiance, what the site
     * offers and has in stock, leadership, and gold */
    canRecruit(state, troopId, n, site) {
      n = Math.max(1, n | 0);
      const terms = this.recruitTerms(state.hero.allegiance, troopId);
      if (!terms.ok) return terms;
      const t = D.troops[troopId];
      if (site) {
        if (!t.sites.includes(site.kind)) return { ok: false, reason: 'Not recruited here' };
        const stock = site.stock && site.stock[troopId] !== undefined ? site.stock[troopId] : 0;
        if (stock < n) return { ok: false, reason: stock ? 'Only ' + stock + ' available' : 'None available' };
      }
      if (this.leadershipFree(state) < t.leadership * n) return { ok: false, reason: 'Not enough leadership' };
      const cost = terms.cost * n;
      if (state.economy.gold < cost) return { ok: false, reason: 'Not enough gold' };
      return { ok: true, cost };
    },
    /* mutation: recruit n of a type into the army (after canRecruit) */
    recruit(state, troopId, n, site) {
      const chk = this.canRecruit(state, troopId, n, site);
      if (!chk.ok) return chk;
      state.economy.gold -= chk.cost;
      if (site && site.stock) site.stock[troopId] -= n;
      const st = state.army.stacks.find((s) => s.troop === troopId);
      if (st) st.count += n; else state.army.stacks.push({ troop: troopId, count: n });
      return chk;
    },
    /* mutation: one campaign day passes — income in, wages out. Unpaid troops
     * desert, the costliest first, until the wages can be met. */
    endOfDay(state) {
      const E = state.economy;
      E.day += 1;
      E.gold += this.incomePerDay(state);
      let wages = this.wagesPerDay(state.army);
      const deserted = [];
      while (wages > E.gold && state.army.stacks.length) {
        let worst = null;
        for (const s of state.army.stacks) { const t = D.troops[s.troop]; if (t && t.wage > 0 && (!worst || t.wage > D.troops[worst.troop].wage)) worst = s; }
        if (!worst) break;
        worst.count -= 1; deserted.push(worst.troop);
        if (worst.count <= 0) state.army.stacks.splice(state.army.stacks.indexOf(worst), 1);
        wages = this.wagesPerDay(state.army);
      }
      E.gold -= wages;
      return { wages, deserted };
    },
  };
  C.Rules = Rules;
})(window.AS);
