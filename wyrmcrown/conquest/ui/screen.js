/* WYRMCROWN — CONQUEST mode entry (placeholder screen).
 * Reached from the title menu ("Conquest") or with ?mode=conquest in the
 * address. Lists the three campaign slots; a new campaign can be created
 * (allegiance and an optional seed), inspected and deleted, proving the
 * campaign state and its save round-trip. The campaign map and play are not
 * built yet, so "Continue" only says so. Uses the title screen's own styles
 * (UI/style.css) and UI kit; it adds one screen element (#conquest). */
'use strict';
(function (AS) {
  const C = AS.Conquest;
  const UI = {
    root: null,
    open() {
      const ui = document.getElementById('ui');
      if (!ui) return;
      let root = document.getElementById('conquest');
      if (!root) { root = AS.UIKit.h('div', { id: 'conquest', class: 'screen' }); ui.appendChild(root); }
      if (!document.getElementById('conquest-style')) {
        // a few styles of its own, scoped to #conquest (the shared stylesheet is left alone)
        const st = document.createElement('style'); st.id = 'conquest-style';
        st.textContent = '#conquest .cq-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:12px}' +
          '#conquest .map-card{cursor:default;display:flex;flex-direction:column;gap:8px}#conquest .map-card h3{margin:2px 0}' +
          '#conquest .row{flex-wrap:wrap;gap:10px;align-items:center}' +
          '#conquest select,#conquest input{background:#2a1c12;color:var(--ink);border:1px solid var(--rim2);border-radius:4px;padding:5px;font:500 14px var(--text)}' +
          '#conquest .cq-note{margin:10px 0;color:var(--gold);font:600 15px var(--text)}';
        document.head.appendChild(st);
      }
      this.root = root;
      if (AS.UI && AS.UI.hideAll) AS.UI.hideAll();
      this.render();
      root.classList.add('show');
    },
    close() {
      if (this.root) this.root.classList.remove('show');
      if (AS.UI && AS.UI.showMenu) AS.UI.showMenu();
    },
    render(note) {
      const { h, btn } = AS.UIKit, root = this.root;
      root.innerHTML = '';
      const slots = C.Save.slots();
      const cards = slots.map((s) => {
        if (s.summary) {
          const S = s.summary;
          return h('div', { class: 'map-card' },
            h('h3', null, 'Campaign ' + s.slot + ' · ' + C.Data.allegianceName(S.allegiance)),
            h('div', { class: 'dim' }, 'Day ' + S.day + ' · ' + S.gold + ' gold · leadership ' + S.leadership + ' · ' + S.troops + ' troops'),
            h('div', { class: 'dim' }, 'Dragon Lords: ' + S.lords.map((k) => C.Data.allegianceName(k.split(' ')[0]) + (k.includes('fallen') ? ' (fallen)' : '')).join(', ')),
            h('div', { class: 'dim' }, 'Progress: ' + S.progress),
            h('div', { class: 'row' },
              btn('Continue', () => this.render('The campaign map is not built yet. This is the Conquest foundation: campaign creation and saving work.'), 'primary'),
              btn('Delete', () => { C.Save.remove(s.slot); this.render('Campaign ' + s.slot + ' deleted.'); })));
        }
        const sel = h('select', { id: 'cq-alleg-' + s.slot }, C.Data.realmKeys.map((k) => h('option', { value: k }, C.Data.allegianceName(k))));
        const seed = h('input', { id: 'cq-seed-' + s.slot, placeholder: 'Seed (optional)', inputmode: 'numeric', style: 'width:9em' });
        return h('div', { class: 'map-card' },
          h('h3', null, 'Campaign ' + s.slot),
          h('div', { class: 'dim' }, s.error ? 'This save could not be read (' + s.error + '). A copy was kept.' : 'Empty'),
          h('div', { class: 'row' }, sel, seed),
          h('div', { class: 'row' }, btn('New campaign', () => {
            const v = seed.value.trim(), st = C.Campaign.create({ allegiance: sel.value, seed: v && /^\d+$/.test(v) ? +v : undefined });
            const r = C.Save.save(s.slot, st);
            this.render(r.ok ? 'Campaign ' + s.slot + ' founded (seed ' + st.seed + ').' : 'Could not save: ' + r.error);
          }, 'primary')));
      });
      root.appendChild(h('div', { class: 'panel', style: 'max-width:980px;margin:0 auto' },
        h('h2', { class: 'heading' }, 'Conquest'),
        h('div', { class: 'dim', style: 'max-width:760px' }, 'A campaign across an unknown archipelago: one dragon and its wizard, an army raised in villages and monster lairs, and the strongholds of the Dragon Lords waiting across the sea. In development.'),
        note ? h('div', { class: 'cq-note' }, note) : null,
        h('div', { class: 'cq-slots' }, ...cards),
        h('div', { class: 'row', style: 'margin-top:14px' }, btn('Back', () => this.close()))));
    },
  };
  C.UI = UI;
})(window.AS);
