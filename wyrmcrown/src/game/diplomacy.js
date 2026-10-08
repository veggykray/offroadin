/* WYRMCROWN — truces and alliances between the player and a rival lord.
 * Proposed from the court (Diplomacy tab). A rival weighs the offer by its
 * personality, the balance of power, who else is hurting it, how recently the
 * player hurt it, any past betrayal, and a little chance; it may refuse (and
 * will not hear another offer for a while). While a pact holds, neither side's
 * dragons, troops, towers or spells harm the other (Realm.hostile consults it),
 * and neither raids, besieges or takes the other's land.
 *   truce     four minutes of peace, then the war resumes
 *   alliance  lasts until broken; an allied dragon also comes to defend the
 *             player's town against a common enemy
 * Rivals may betray a pact — the aggressive realm most of all, and any realm that
 * has grown stronger than the player — with a loud warning. Breaking a pact
 * yourself is remembered. Victory still needs every rival broken: allies too. */
'use strict';
(function (AS) {
  const U = AS.U;
  const TRUCE_T = 240, REFUSE_CD = 90, ASK_CD_AFTER_BREAK = 120;
  // by personality (data/factions.js ai.style): readiness to make peace, and to betray it (chance per minute)
  const MOOD = {
    balanced: { peace: 0.55, betray: 0.025 },
    evasive: { peace: 0.5, betray: 0.035 },
    fortress: { peace: 0.62, betray: 0.02 },
    aggressive: { peace: 0.3, betray: 0.07 },
  };
  const Dip = {
    init(g) {
      g.pacts = {};      // rival key -> { kind, since, until }
      g.dipMemo = {};    // rival key -> { refusedUntil, betrayedByPlayer, hurtT }
      g.pact = (a, b) => this.between(g, a, b);
      this.onlyAlliesNoted = false;
    },
    memo(g, fk) { return g.dipMemo[fk] || (g.dipMemo[fk] = { refusedUntil: 0, betrayedByPlayer: 0, hurtT: -999 }); },
    /* the pact (if any) between two teams — only pacts with the player exist */
    between(g, a, b) {
      if (!g.pacts || a === b) return null;
      const pk = g.playerKey;
      if (a === pk) return g.pacts[b] || null;
      if (b === pk) return g.pacts[a] || null;
      return null;
    },
    status(g, fk) { return g.pacts && g.pacts[fk] ? g.pacts[fk].kind : 'war'; },
    mood(g, fk) { return MOOD[(g.factions[fk].def.ai || {}).style] || MOOD.balanced; },
    /* how the rival regards an offer: a score (accept above 0.5) and the main reason */
    weigh(g, fk, kind) {
      const R = g.factions[fk], P = g.playerFaction, M = this.memo(g, fk), mood = this.mood(g, fk);
      const parts = [];
      let sc = mood.peace; parts.push([mood.peace - 0.5, mood.peace < 0.4 ? 'war is in their blood' : 'they have no love of war']);
      if (kind === 'alliance') { sc -= 0.18; parts.push([-0.18, 'an alliance asks much of them']); }
      const gap = P.power() - R.power();
      if (gap > 3) { sc += 0.22; parts.push([0.22, 'they fear your strength']); }
      else if (gap < -3) { sc -= 0.25; parts.push([-0.25, 'they think you weak']); }
      // hard pressed by someone else: an ally against them is welcome
      if (g.time - R.attackedT < 60 && R.lastAttacker && R.lastAttacker !== P) { sc += 0.15; parts.push([0.15, 'others are at their gates']); }
      // you hurt them lately
      if (g.time - M.hurtT < 60 || (R.lastAttacker === P && g.time - R.attackedT < 60)) { sc -= 0.32; parts.push([-0.32, 'your fire is still warm on their walls']); }
      if (M.betrayedByPlayer) { sc -= 0.35; parts.push([-0.35, 'you broke faith with them before']); }
      const dk = g.diff && g.diff.dragonDuel ? g.diff.dragonDuel : 1;
      sc += (1 - dk) * 0.2; // gentler realms on easier settings
      parts.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]));
      const against = parts.filter((p) => p[0] < 0).sort((a, b) => a[0] - b[0])[0];
      const forIt = parts.filter((p) => p[0] > 0).sort((a, b) => b[0] - a[0])[0];
      return { score: sc, against: against && against[1], forIt: forIt && forIt[1] };
    },
    /* a word on their mood for the court */
    attitude(g, fk, kind) {
      const w = this.weigh(g, fk, kind || 'truce').score;
      return w > 0.68 ? 'Eager' : w > 0.52 ? 'Willing' : w > 0.38 ? 'Wary' : w > 0.25 ? 'Cold' : 'Hostile';
    },
    canAsk(g, fk) {
      const R = g.factions[fk];
      if (!R || R.eliminated || fk === g.playerKey) return 'They are no more';
      const M = this.memo(g, fk);
      if (g.time < M.refusedUntil) return 'They will not hear you again for ' + Math.ceil(M.refusedUntil - g.time) + 's';
      return null;
    },
    propose(g, fk, kind) {
      const why = this.canAsk(g, fk);
      if (why) return { ok: false, text: why };
      const R = g.factions[fk], cur = g.pacts[fk];
      if (cur && cur.kind === kind) return { ok: false, text: 'You already have a ' + kind };
      const w = this.weigh(g, fk, kind), roll = w.score + U.range(-0.15, 0.15);
      const lord = R.def.dragon.name + ' and ' + R.def.rider.name;
      if (roll > 0.5) {
        g.pacts[fk] = { kind, since: g.time, until: kind === 'truce' ? g.time + TRUCE_T : Infinity, checkT: g.time + 30 };
        this.calm(g, fk);
        const text = kind === 'truce' ? R.def.short + ' accepts a truce. Four minutes of peace.' : R.def.short + ' swears an alliance with you.';
        g.news(text, fk, true); g.msg((kind === 'truce' ? 'TRUCE WITH ' : 'ALLIANCE WITH ') + R.def.short.toUpperCase(), '#bfe8a0', 3);
        AS.Audio.sfx('herald');
        return { ok: true, text: text + (w.forIt ? ' (' + w.forIt + ')' : '') };
      }
      this.memo(g, fk).refusedUntil = g.time + REFUSE_CD;
      const text = lord + ' refuse' + (w.against ? ': ' + w.against + '.' : '.');
      g.news(R.def.short + ' refuses your offer of ' + (kind === 'truce' ? 'a truce' : 'alliance'), fk, false);
      AS.Audio.sfx('denied');
      return { ok: false, text };
    },
    /* end a pact: by the player (remembered), by the rival (betrayal) or by time (a truce) */
    end(g, fk, by) {
      const P = g.pacts[fk]; if (!P) return;
      delete g.pacts[fk];
      const R = g.factions[fk], M = this.memo(g, fk);
      if (by === 'player') { M.betrayedByPlayer = 1; M.refusedUntil = g.time + ASK_CD_AFTER_BREAK; g.news('You break your ' + P.kind + ' with ' + R.def.short + '.', fk, true); g.msg(R.def.short.toUpperCase() + ' IS YOUR ENEMY AGAIN', '#ffb08a', 3); }
      else if (by === 'time') { g.news('The truce with ' + R.def.short + ' has ended.', fk, true); g.msg('THE TRUCE WITH ' + R.def.short.toUpperCase() + ' IS OVER', '#ffe7a8', 3); }
      else { M.refusedUntil = g.time + ASK_CD_AFTER_BREAK; g.news(R.def.short + ' BETRAYS your ' + P.kind + '!', fk, true); g.msg(R.def.short.toUpperCase() + ' BREAKS THE ' + P.kind.toUpperCase() + '!', '#ff7a5a', 4); AS.Audio.sfx('alarm'); }
    },
    /* make peace stick at once: stop their units chasing the player's, and vice versa */
    calm(g, fk) {
      const pk = g.playerKey;
      for (const t of g.troops) {
        if (!t.target) continue;
        if ((t.team === fk && t.target.team === pk) || (t.team === pk && t.target.team === fk)) t.target = null;
      }
      const R = g.factions[fk];
      if (R.lord && R.lord.goal && (R.lord.goal.rival === g.playerFaction || (R.lord.goal.ref && R.lord.goal.ref.team === pk))) { R.lord.goal = { type: 'patrol', x: R.townPos.x, y: R.townPos.y }; R.lord.thinkT = 0; }
      if (R.lord && R.lord.threat && R.lord.threat.team === pk) R.lord.threat = null;
    },
    /* remember harm the player does a rival (it sours offers for a while) */
    hurt(g, fk) { if (g.dipMemo) this.memo(g, fk).hurtT = g.time; },
    update(g, dt) {
      if (!g.pacts) return;
      for (const fk of Object.keys(g.pacts)) {
        const P = g.pacts[fk], R = g.factions[fk];
        if (!R || R.eliminated) { delete g.pacts[fk]; continue; }
        if (g.time >= P.until) { this.end(g, fk, 'time'); continue; }
        if (g.time < P.checkT) continue;
        P.checkT = g.time + 10;
        // betrayal: a little chance each check, more for a warlike realm or one that has outgrown the player
        const mood = this.mood(g, fk), gap = R.power() - g.playerFaction.power();
        let perMin = mood.betray * (P.kind === 'alliance' ? 0.6 : 1) * (1 + Math.max(0, gap) / 4);
        if (g.time - P.since < 60) perMin = 0; // never in the first minute
        if (Math.random() < perMin / 6) this.end(g, fk, 'ai');
      }
      // only allies left standing: the crown still has to be won alone
      if (!this.onlyAlliesNoted) {
        const rivals = g.factionList.filter((f) => f.key !== g.playerKey && !f.eliminated);
        if (rivals.length && rivals.every((f) => g.pacts[f.key] && g.pacts[f.key].kind === 'alliance')) {
          this.onlyAlliesNoted = true;
          g.msg('ONLY YOUR ALLIES REMAIN — BREAK THE ALLIANCE TO CLAIM THE CROWN', '#ffe7a8', 5);
        }
      }
    },
  };
  AS.Diplomacy = Dip;
})(window.AS);
