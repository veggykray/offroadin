/* WYRMCROWN — the campaign's screens: the campaign menu on the title (three
 * save slots: continue, or found a new campaign for a chosen realm) and the
 * hiring panel (R over a place you hold, or your castle). The rules behind them
 * are in src/game/bigcampaign.js. */
'use strict';
(function (AS) {
  const { h, btn } = AS.UIKit;
  const BC = () => AS.BigCampaign;

  /* ---------------- hiring (R) ---------------- */
  const HirePanel = {
    root: null, g: null, place: null,
    toggle(g) {
      if (AS.App.overlay === 'hire') return this.close();
      const place = BC().hirePlace(g);
      if (!place) { g.msg('FLY LOW OVER A PLACE YOU HOLD — OR YOUR CASTLE — TO HIRE TROOPS', '#ffe7a8', 2.5); AS.Audio.sfx('denied'); return; }
      this.open(g, place);
    },
    open(g, place) {
      this.g = g; this.place = place;
      AS.App.openOverlay('hire');
      AS.Audio.duck && AS.Audio.duck(true);
      AS.Audio.sfx('ui_click');
      this.render();
    },
    close() {
      if (this.root) this.root.classList.remove('show');
      if (AS.App.overlay === 'hire') { AS.App.closeOverlay(); AS.Audio.duck && AS.Audio.duck(false); }
    },
    render() {
      const g = this.g, F = g.playerFaction, B = BC(), place = this.place, st = B.stock(g, place), S = B.status(g);
      let root = document.getElementById('hire');
      if (!root) { root = h('div', { id: 'hire', class: 'screen' }); document.getElementById('ui').appendChild(root); }
      this.root = root;
      root.innerHTML = '';
      const ids = Object.keys(st.cap);
      const items = h('div', { class: 'court-items' });
      if (!ids.length) items.appendChild(h('div', { class: 'item' }, h('div', { class: 'ds' }, 'Nobody here will serve ' + F.def.name + '.')));
      for (const id of ids) {
        const t = B.troop(id), terms = AS.Conquest.Rules.recruitTerms(g.playerKey, id), left = st.now[id] || 0;
        const one = B.canHire(g, place, id, 1);
        const row = h('div', { class: 'buy' });
        for (const n of [1, 5]) {
          const c = B.canHire(g, place, id, n);
          const b = btn((n === 1 ? 'Hire 1' : 'Hire 5'), () => { const r = B.hire(g, place, id, n); if (r.ok) g.msg(n + ' ' + t.name.toUpperCase() + (n > 1 ? 'S' : '') + ' JOIN YOUR ARMY', '#bfe8a0', 2.5); else AS.Audio.sfx('denied'); this.render(); }, n === 1 ? 'primary' : '');
          if (!c.ok) { b.disabled = true; b.classList.add('off'); }
          row.appendChild(b);
        }
        items.appendChild(h('div', { class: 'item' + (left ? '' : ' done') },
          h('div', { class: 'top' }, h('div', null, h('div', { class: 'nm' }, t.name), h('div', { class: 'lv' }, left + ' available today'))),
          h('div', { class: 'ds' }, 'Leadership ' + t.leadership + ' each · wage ' + t.wage + ' gold a day'),
          h('div', { class: 'buy' }, h('span', { class: 'price' }, terms.ok ? terms.cost + ' gold' : '—'), one.ok ? null : h('span', { class: 'why' }, one.reason)),
          row));
      }
      const side = h('div', { class: 'court-side' },
        h('div', { class: 'box' }, h('b', null, 'Your army'), h('br'), S.army + ' troops', h('br'), 'Leadership ' + S.used + ' of ' + S.lead,
          h('div', { class: 'meter' }, h('i', { style: 'width:' + Math.min(100, S.used / Math.max(1, S.lead) * 100).toFixed(0) + '%;background:var(--gold)' })),
          'Wages ' + S.wages + ' gold each dawn'),
        h('div', { class: 'box' }, 'Day ' + S.day + ' · ' + S.time, h('br'), 'Recruits return here each dawn while you hold it. Taking more places raises your leadership.'));
      root.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'court-head' },
          h('div', null, h('div', { class: 'name' }, 'Hire Troops'), h('div', { class: 'dim' }, 'at ' + place.name)),
          h('div', { class: 'gold' }, h('span', { class: 'coin' }), Math.floor(F.gold).toLocaleString())),
        h('div', { class: 'court-body' }, items, side),
        h('div', { class: 'court-foot' }, h('span', null, 'The realm waits while you hire. New troops follow your dragon (V: follow / hold).'), btn('Back to the skies', () => this.close(), 'primary', 'R / Esc'))));
      root.classList.add('show');
    },
  };

  /* ---------------- the campaign menu (title) ---------------- */
  const CampaignMenu = {
    sel: {},
    screen() {
      const UI = AS.UI;
      if (!UI.screens.bigcampaign) { const s = h('div', { id: 'bigcampaign', class: 'screen' }); UI.root.appendChild(s); UI.screens.bigcampaign = s; }
      return UI.screens.bigcampaign;
    },
    show() {
      const s = this.screen(), B = BC(); s.innerHTML = '';
      s.appendChild(h('h2', { class: 'heading' }, 'Campaign — The Wide Realm'));
      s.appendChild(h('div', { class: 'dim', style: 'font:500 16px/1.45 var(--text);max-width:900px' },
        'One great island and the sea around it, played in real time like a battle. Start at your castle with little gold and no army; take the farms and villages around you, hire troops at the places you hold and lead them across the realm. ' +
        'Each dawn your troops want their wages. Across the sea, on the Isle of Ravens, a Dragon Lord waits in his stronghold — break it to win. Every new campaign rearranges the realm\'s guardians and warbands. Progress saves itself.'));
      const grid = h('div', { class: 'bc-slots' });
      for (let i = 1; i <= 3; i++) {
        const sv = B.load(i);
        const card = h('div', { class: 'bc-slot' }, h('div', { class: 'nm' }, 'Campaign ' + i));
        if (sv) {
          const F = AS.Data.factions[sv.faction];
          card.appendChild(h('div', { class: 'who', style: 'color:' + F.color }, F.name));
          card.appendChild(h('div', { class: 'dim' }, B.describe(sv)));
          card.appendChild(h('div', { class: 'dim', style: 'font-size:12px' }, 'Saved ' + new Date(sv.savedAt).toLocaleString()));
          card.appendChild(h('div', { class: 'row' },
            btn('Continue', () => B.begin(i, sv), 'primary'),
            btn('Start over', () => AS.UI.confirm('Erase this campaign and start again?', () => this.newGame(i)), 'danger')));
        } else {
          const pick = h('select', null, AS.Data.factionOrder.map((k) => h('option', { value: k, selected: (this.sel[i] || 'human') === k ? 'selected' : null }, AS.Data.factions[k].name)));
          pick.onchange = () => { this.sel[i] = pick.value; };
          card.appendChild(h('div', { class: 'dim' }, 'An empty slot.'));
          card.appendChild(h('div', { class: 'opt-row' }, h('span', null, 'Your realm'), pick));
          card.appendChild(h('div', { class: 'row' }, btn('New campaign', () => this.newGame(i), 'primary')));
        }
        grid.appendChild(card);
      }
      s.appendChild(grid);
      s.appendChild(h('div', { class: 'row' }, btn('Back', () => AS.UI.showMenu())));
      AS.UI.show('bigcampaign');
    },
    newGame(slot) {
      const B = BC(), fk = this.sel[slot] || (B.load(slot) || {}).faction || 'human';
      const sv = B.fresh(fk, (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
      B.clear(slot);
      B.begin(slot, sv);
    },
  };

  AS.HirePanel = HirePanel;
  AS.CampaignMenu = CampaignMenu;
})(window.AS);
