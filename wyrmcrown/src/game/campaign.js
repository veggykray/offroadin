/* WYRMCROWN — the campaign: ten realms conquered in order.
 * Results are kept in the profile (wins, best time, plays); winning a realm
 * opens the next one in the atlas. Later realms are harder: each map carries
 * a tier (its place in the atlas) that strengthens the rival lords a little
 * (their income, the toughness of their towns and dragons, their aim) on top
 * of the chosen difficulty. */
'use strict';
(function (AS) {
  const Campaign = {
    // scale a difficulty record by the map's place in the campaign
    difficultyFor(map, key) {
      const base = AS.Data.difficulty[key || 'normal'] || AS.Data.difficulty.normal;
      const tier = Math.max(0, (map.index || 1) - 1);
      return Object.assign({}, base, {
        tier,
        aiIncome: base.aiIncome * (1 + tier * 0.04),
        aiHp: base.aiHp * (1 + tier * 0.03),
        ai: base.ai * (1 + tier * 0.02),
      });
    },
    unlocked(id) {
      if (AS.Settings && AS.Settings.testMode) return true;
      if (AS.App && AS.App.params && AS.App.params.get('allRealms') === '1') return true;
      const P = AS.Save.profile || AS.Save.loadProfile() || AS.Save.newProfile();
      return (P.unlockedMaps || ['sundered']).includes(id) || AS.Maps.list[0].id === id;
    },
    applyResult(res) {
      if (!res || !res.map) return;
      const P = AS.Save.profile || AS.Save.loadProfile() || AS.Save.newProfile();
      const id = res.map.id, rec = P.maps[id] || (P.maps[id] = { won: false, best: null, plays: 0 });
      rec.plays++;
      P.stats.played++;
      P.stats.playTime += Math.round(res.time || 0);
      if (res.stats) { P.stats.goldEarned += Math.round(res.stats.goldEarned || 0); P.stats.eaten += res.stats.eaten || 0; P.stats.dragonsDowned += res.stats.downed || 0; }
      if (res.won) {
        P.stats.wins++;
        rec.won = true;
        rec.best = rec.best ? Math.min(rec.best, Math.round(res.time)) : Math.round(res.time);
        const i = AS.Maps.list.findIndex((m) => m.id === id), next = AS.Maps.list[i + 1];
        P.unlockedMaps = P.unlockedMaps || ['sundered'];
        if (next && !P.unlockedMaps.includes(next.id)) { P.unlockedMaps.push(next.id); res.unlocked = next; }
      } else P.stats.losses++;
      AS.Save.saveProfile();
    },
  };
  AS.Campaign = Campaign;
})(window.AS);
