/* WYRMCROWN — the court: spend gold in your town.
 * Opens with T while your dragon is over its own town; the realm pauses while
 * you hold court. Five tabs (defences, army, economy, dragon, wizard) list what
 * can be built, mustered or learned, with live prices and the reason anything
 * is unavailable. Purchases happen through Faction.buy, so the town outside
 * visibly rises and fortifies. The army tab also sends warbands to march on a
 * site or a rival's town. */
'use strict';
(function (AS) {
  const { h, btn } = AS.UIKit;
  const TABS = [['defence', 'Defences'], ['army', 'Army'], ['economy', 'Economy'], ['dragon', 'Dragon'], ['wizard', 'Wizardry']];
  const ICONS = { recruitSoldiers: 'shield', recruitArchers: 'flag', recruitKnights: 'shield', recruitSiege: 'castle', buyLivestock: 'meat', keepUp: 'castle',
    scales: 'shield', wings: 'wing', lungs: 'flame', stomach: 'meat', dragonSize: 'wing', staffPower: 'star', staffRate: 'pw_rapid', staffMana: 'pw_mana' };

  const Court = {
    tab: 'defence', root: null,
    canOpen(g) {
      const p = g.player, F = g.playerFaction;
      return p.down <= 0 && Math.hypot(p.x - F.townPos.x, p.y - F.townPos.y) < 560;
    },
    toggle(g) {
      if (AS.App.overlay === 'court') return this.close();
      if (!this.canOpen(g)) { g.msg('RETURN TO YOUR TOWN TO HOLD COURT', '#ffe7a8', 2); AS.Audio.sfx('denied'); return; }
      this.open(g);
    },
    open(g) {
      this.g = g;
      AS.App.openOverlay('court');
      AS.Audio.duck && AS.Audio.duck(true);
      AS.Audio.sfx('ui_click');
      this.render();
    },
    close() {
      if (this.root) this.root.classList.remove('show');
      AS.App.closeOverlay();
      AS.Audio.duck && AS.Audio.duck(false);
    },
    render() {
      const g = this.g, F = g.playerFaction;
      let root = document.getElementById('court');
      if (!root) { root = h('div', { id: 'court', class: 'screen' }); document.getElementById('ui').appendChild(root); }
      this.root = root;
      root.innerHTML = '';
      const head = h('div', { class: 'court-head' },
        this.crest(F.def, 40),
        h('div', null, h('div', { class: 'name' }, 'The Court of ' + F.def.short), h('div', { class: 'dim' }, F.def.name + ' — stronghold level ' + F.keepLevel)),
        h('div', { class: 'gold' }, h('span', { class: 'coin' }), Math.floor(F.gold).toLocaleString()));
      const tabs = h('div', { class: 'court-tabs' }, TABS.map(([k, label]) => h('div', { class: 'tab' + (this.tab === k ? ' on' : ''), onclick: () => { this.tab = k; AS.Audio.sfx('ui_click'); this.render(); } }, label)));
      const items = h('div', { class: 'court-items' });
      for (const id of AS.Data.court[this.tab]) items.appendChild(this.card(id));
      if (this.tab === 'army') items.appendChild(this.warbandCard());
      const body = h('div', { class: 'court-body' }, tabs, items, this.side());
      const foot = h('div', { class: 'court-foot' }, h('span', null, 'The realm waits while you hold court.'), btn('Return to the skies', () => this.close(), 'primary', 'T / Esc'));
      root.appendChild(h('div', { class: 'panel' }, head, body, foot));
      root.classList.add('show');
    },
    crest(fdef, size) {
      const c = h('canvas', { width: size * 2, height: size * 2, style: 'width:' + size + 'px;height:' + size + 'px' });
      const ctx = c.getContext('2d'); ctx.scale(2, 2);
      AS.HUD.crest(ctx, size / 2, size / 2, size * 0.42, fdef);
      return c;
    },
    thumb(id) {
      const F = this.g.playerFaction, S = 56;
      const c = h('canvas', { width: S * 2, height: S * 2, style: 'width:' + S + 'px;height:' + S + 'px' });
      const ctx = c.getContext('2d'); ctx.scale(2, 2);
      const B = AS.Data.buildings[id];
      const gen = B ? F.key + '_' + B.gen : null;
      if (gen && (AS.Models[gen] || B)) {
        const sh = AS.Building.sheetFor(gen, F.def.pal, { level: id === 'wall' ? Math.min(3, (F.wallLevel || 0) + 1) : 1, v: 0 }, B.dirs || 1, 1);
        const di = AS.Forge.frameIndex(sh, -0.5), img = sh.frames[0][di];
        const k = Math.min((S - 6) / sh.w, (S - 6) / sh.h);
        ctx.drawImage(img, S / 2 - sh.w * k / 2, S / 2 - sh.h * k / 2, sh.w * k, sh.h * k);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, S, S);
        AS.HUD.icon(ctx, ICONS[id] || 'star', S / 2, S / 2, S * 0.6, AS.Data.upgrades[id] ? (id.startsWith('staff') ? '#9fd8ff' : F.def.color) : '#f2c14e');
      }
      return c;
    },
    card(id) {
      const g = this.g, F = g.playerFaction;
      const B = AS.Data.buildings[id], A = AS.Data.actions[id], Up = AS.Data.upgrades[id];
      const def = B || A || Up;
      const price = F.price(id), why = F.blocker(id);
      let lv = '';
      if (Up) lv = 'Level ' + (F.upgrades[id] || 0) + ' / ' + Up.cost.length;
      else if (id === 'wall') lv = ['No walls', 'Palisade', 'Stone walls', 'Enchanted walls'][F.wallLevel || 0];
      else if (id === 'keepUp') lv = 'Stronghold level ' + F.keepLevel + ' / 3';
      else if (B && B.max) lv = F.alive(id) + ' built' + (B.max > 1 ? ' (max ' + (B.max + ((id === 'tower' || id === 'ballista') ? F.keepLevel - 1 : 0)) + ')' : '');
      else if (A && A.unit) lv = 'Troops ' + F.troopCount() + ' / ' + F.troopCap();
      else if (id === 'buyLivestock') lv = 'Herds ' + F.livestock() + ' / ' + F.livestockCap();
      const name = id === 'wall' && F.wallLevel ? 'Upgrade the walls' : def.name;
      const done = price === null;
      const b = btn(done ? 'Complete' : 'Buy', () => this.buy(id, card), why ? '' : 'primary');
      b.classList.add('small'); b.disabled = !!why;
      const card = h('div', { class: 'item' + (done ? ' done' : '') },
        h('div', { class: 'top' }, this.thumb(id), h('div', null, h('div', { class: 'nm' }, name), h('div', { class: 'lv' }, lv))),
        h('div', { class: 'ds' }, def.desc || ''),
        h('div', { class: 'buy' }, done ? h('span', { class: 'dim' }, '—') : h('span', { class: 'price' }, h('span', { class: 'coin' }), String(price)), why && !done ? h('span', { class: 'why' }, why) : null, b));
      return card;
    },
    buy(id, card) {
      const F = this.g.playerFaction;
      const err = F.buy(id);
      if (err) { AS.Audio.sfx('denied'); this.toast(err); return; }
      this.toast('Ordered: ' + ((AS.Data.buildings[id] || AS.Data.actions[id] || AS.Data.upgrades[id]).name));
      this.render();
    },
    /* the right-hand column: the state of the town, the dragon and the war */
    side() {
      const g = this.g, F = g.playerFaction, d = F.dragon;
      const meter = (v, col) => h('div', { class: 'meter' }, h('i', { style: 'width:' + Math.round(AS.U.clamp(v, 0, 1) * 100) + '%;background:' + col }));
      const row = (k, v) => h('div', null, k + ': ', h('b', null, v));
      const keep = F.keep, ward = F.wardStrength();
      const town = h('div', { class: 'box' },
        h('b', null, 'Stronghold'), meter(keep.hp / keep.maxHp, F.def.color),
        row('Ward', ward ? ['', 'failing', 'weak', 'strong', 'unbroken'][Math.min(4, ward)] + ' (' + F.alive('wardstone') + '/3 wardstones)' : 'BROKEN'),
        row('Income', Math.round(F.income) + ' gold / min' + (F.underdog > 0.05 ? ' (underdog +' + Math.round(F.underdog * 35) + '%)' : '')),
        row('Troops', F.troopCount() + ' / ' + F.troopCap()),
        row('Herds', F.livestock() + ' / ' + F.livestockCap()),
        row('Houses', String(F.alive('house'))),
        row('Lands held', String(F.sitesOwned)));
      const up = (k) => F.upgrades[k] || 0;
      const drag = h('div', { class: 'box' },
        h('b', null, d.name), meter(d.hp / d.maxHp, '#e0503a'), meter(d.energy / d.maxEnergy, '#f0a030'),
        row('Scales', 'Lv ' + up('scales')), row('Wings', 'Lv ' + up('wings')), row('Lungs', 'Lv ' + up('lungs')), row('Staff', 'Lv ' + (up('staffPower') + up('staffRate') + up('staffMana'))));
      const rivals = h('div', { class: 'box' }, h('b', null, 'Rival realms'),
        g.factionList.filter((R) => R !== F).map((R) => h('div', { style: 'color:' + R.def.color }, R.def.short + ': ' + (R.eliminated ? 'fallen' : R.wardStrength() ? 'ward ' + R.wardStrength() + '/4 · ' + R.sitesOwned + ' lands' : 'WARD BROKEN — strike the stronghold!'))));
      const tip = AS.Advisor && AS.Advisor.current ? AS.Advisor.current(g) : null;
      return h('div', { class: 'court-side' }, town, drag, rivals, tip && tip.text ? h('div', { class: 'box dim' }, tip.text) : null);
    },
    toast(text) {
      const t = h('div', { class: 'toast' }, text);
      this.root.querySelector('.panel').appendChild(t);
      setTimeout(() => t.remove(), 1600);
    },
    warbandCard() {
      const g = this.g, F = g.playerFaction;
      const free = F.troops.filter((t) => t.alive && t.role !== 'cart' && t.state === 'garrison');
      const marching = F.troops.filter((t) => t.alive && t.state === 'march');
      const targets = [];
      const walk = (x, y) => AS.Nav.reachable(g, F.townPos.x, F.townPos.y, x, y);
      for (const s of g.sites) if (s.owner !== F.key && !(s.def.treasure && s.looted) && g.isExplored(s.x, s.y) && walk(s.x, s.y)) targets.push({ label: s.name + (s.owner ? ' (' + g.factions[s.owner].def.short + ')' : s.guarded() ? ' (guarded)' : ''), x: s.x, y: s.y, d: Math.hypot(s.x - F.townPos.x, s.y - F.townPos.y) });
      for (const R of g.factionList) if (R !== F && !R.eliminated && walk(R.townPos.x, R.townPos.y)) targets.push({ label: '⚔ ' + R.def.name + ' (siege)', x: R.townPos.x, y: R.townPos.y, siege: true, d: Math.hypot(R.townPos.x - F.townPos.x, R.townPos.y - F.townPos.y) });
      targets.sort((a, b) => (a.siege ? 1e5 : 0) + a.d - ((b.siege ? 1e5 : 0) + b.d));
      const sel = h('select', { style: 'width:100%;background:#2a1c12;color:#f0e2c0;border:1px solid rgba(214,170,90,0.3);border-radius:4px;padding:5px;font:500 14px var(--text)' }, targets.map((t, i) => h('option', { value: i }, t.label)));
      const go = btn('March!', () => {
        const t = targets[+sel.value]; if (!t) return;
        const n = this.sendWarband(F, t);
        this.toast(n ? n + ' troops march on ' + t.label.replace('⚔ ', '') : 'No troops free — keep at least 3 at home');
        this.render();
      }, 'primary');
      go.classList.add('small'); go.disabled = free.length <= 3 || !targets.length;
      const back = btn('Recall', () => { for (const t of marching) { t.state = 'garrison'; t.marchTo(F.townPos.x, F.townPos.y, { r: 250 }); t.state = 'march'; t.recall = true; } this.toast('Warband recalled'); this.render(); });
      back.classList.add('small'); back.disabled = !marching.length;
      return h('div', { class: 'item' },
        h('div', { class: 'top' }, this.thumbIcon('flag'), h('div', null, h('div', { class: 'nm' }, 'Warband'), h('div', { class: 'lv' }, free.length + ' at home · ' + marching.length + ' marching'))),
        h('div', { class: 'ds' }, 'Send your garrison (all but three guards) to seize a site or besiege a rival town. Troops capture sites they stand on.'),
        sel, h('div', { class: 'buy' }, back, go));
    },
    thumbIcon(k) { const c = h('canvas', { width: 112, height: 112, style: 'width:56px;height:56px' }); const x = c.getContext('2d'); x.scale(2, 2); AS.HUD.icon(x, k, 28, 28, 32, '#f2c14e'); return c; },
    sendWarband(F, t) {
      const free = F.troops.filter((u) => u.alive && u.role !== 'cart' && u.state === 'garrison');
      let n = 0;
      for (const u of free.slice(3)) { u.marchTo(t.x + AS.U.range(-40, 40), t.y + AS.U.range(-40, 40), { siege: !!t.siege, r: 140 }); n++; }
      if (n) this.g.news(F.def.short + ' musters a warband of ' + n, F.key);
      return n;
    },
  };
  AS.Court = Court;
})(window.AS);
