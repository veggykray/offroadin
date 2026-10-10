/* WYRMCROWN — the army command panel (K) of the ARMY COMMAND TEST.
 * A plain test panel, not the final strategy interface: every button calls the
 * rules in src/game/armies.js and shows their answer. The realm waits while it is
 * open. */
'use strict';
(function (AS) {
  const { h, btn } = AS.UIKit;
  const Arm = () => AS.Armies;

  const ArmyPanel = {
    root: null, g: null, said: '',
    toggle(g) { if (AS.App.overlay === 'armycmd') this.close(); else this.open(g); },
    open(g) {
      this.g = g; this.said = '';
      AS.App.openOverlay('armycmd');
      AS.Audio.duck && AS.Audio.duck(true);
      this.render();
    },
    close() {
      if (this.root) this.root.classList.remove('show');
      if (AS.App.overlay === 'armycmd') { AS.App.closeOverlay(); AS.Audio.duck && AS.Audio.duck(false); }
    },
    say(r, okText) {
      this.said = r && r.ok ? (okText || 'Done.') + (r.notes && r.notes.length ? ' ' + r.notes.join(' ') : '') : 'Refused: ' + ((r && r.reason) || 'not possible');
      if (r && !r.ok) AS.Audio.sfx('denied');
      this.render();
    },
    sel(options, id) {
      const s = h('select', { id, class: 'ac-sel' });
      for (const [v, t] of options) s.appendChild(h('option', { value: v }, t));
      return s;
    },
    render() {
      const g = this.g, A = g.armies, M = g.map.armyTest, P = g.player;
      let root = document.getElementById('armycmd');
      if (!root) { root = h('div', { id: 'armycmd', class: 'screen' }); document.getElementById('ui').appendChild(root); }
      this.root = root; root.innerHTML = '';
      const cards = h('div', { class: 'court-items ac-items' });
      for (const a of A.list) {
        if (a.status === 'disbanded') continue;
        const S = Arm().summary(g, a), dead = a.status === 'destroyed';
        const card = h('div', { class: 'item ac-army' + (dead ? ' done' : ''), 'data-army': a.id },
          h('div', { class: 'top' }, h('div', null, h('div', { class: 'nm' }, S.name), h('div', { class: 'lv' }, dead ? 'DESTROYED' : (S.cmdr ? 'Led by ' + S.cmdr : 'No commander') + ' · ' + S.count + ' troops'))),
          h('div', { class: 'ds' }, S.troops),
          h('div', { class: 'ds' }, (S.layer === 'under' ? 'UNDERGROUND at ' + S.where : 'At ' + S.where) + ' · ' + S.order + ' · ' + S.status + (S.field ? ' · on the field' : ' · as a record (off the field)')),
          h('div', { class: 'ds' }, 'Morale ' + S.morale + ' · leadership ' + S.lead + (S.cap < Infinity ? ' of ' + S.cap : ' (no commander cap)')),
          S.last ? h('div', { class: 'ds ac-last' }, 'Last fight: ' + (S.last.won ? 'won' : 'lost') + ' vs ' + S.last.vs + ' (' + S.last.kind + ', ' + S.last.terrain + ', ' + S.last.method + ') — lost ' + S.last.lost + ', killed ' + S.last.killed) : null);
        if (!dead) {
          const o = (t, extra, label) => btn(label, () => this.say(Arm().order(g, a.id, Object.assign({ type: t }, extra || {})), label + ': ordered.'));
          card.appendChild(h('div', { class: 'ac-row' }, o('follow', null, 'Follow dragon'), o('hold', null, 'Hold'), o('defend', null, 'Defend here'), o('retreat', null, 'Retreat')));
          const dsel = this.sel(M.destinations.map((d) => [d.id, d.name]).concat([['dragon', 'Where the dragon is now']]), 'ac-dest-' + a.id);
          card.appendChild(h('div', { class: 'ac-row' }, dsel, btn('March', () => {
            const v = dsel.value, d = M.destinations.find((q) => q.id === v);
            const tgt = v === 'dragon' ? { x: P.x, y: P.y } : { x: d.x, y: d.y, name: d.name };
            this.say(Arm().order(g, a.id, Object.assign({ type: 'march' }, tgt)), 'Marching.');
          })));
          card.appendChild(h('div', { class: 'ac-row' },
            o('defend', { siteId: 'hollowford' }, 'Defend Hollowford'), o('attack', { siteId: 'gatewatch' }, 'Attack the Gatewatch'), o('attack', { siteId: 'blackthorn' }, 'Attack Blackthorn')));
          card.appendChild(h('div', { class: 'ac-row' }, o('enter', { passage: 'delverway' }, 'Enter the Delverway'), o('enter', { passage: 'kingsway' }, 'Take the Old King\'s Road')));
          // commander
          const free = Object.values(A.cmdrs).filter((c) => c.owner === a.owner && c.status === 'available' && !c.armyId);
          const csel = this.sel(free.map((c) => [c.id, Arm().cmdrDef(c).name]), 'ac-cmdr-' + a.id);
          card.appendChild(h('div', { class: 'ac-row' }, a.cmdr ? btn('Leave commander here', () => this.say(Arm().unassign(g, a.id), 'The commander waits here.'))
            : free.length ? [csel, btn('Assign', () => this.say(Arm().assign(g, csel.value, a.id), 'Commander assigned.'))] : h('span', { class: 'ds' }, 'No commander free')));
          // move troops between armies
          const others = A.list.filter((b) => b !== a && b.status !== 'destroyed' && b.status !== 'disbanded'), st = Arm().stacksOf(a);
          if (others.length && Object.keys(st).length) {
            const tsel = this.sel(Object.keys(st).map((k) => [k, Arm().troop(k).name]), 'ac-tt-' + a.id), bsel = this.sel(others.map((b) => [b.id, b.name]), 'ac-tb-' + a.id);
            card.appendChild(h('div', { class: 'ac-row' }, 'Move 1', tsel, 'to', bsel, btn('Move', () => this.say(Arm().transfer(g, a.id, bsel.value, tsel.value, 1), 'Moved.'))));
          }
          // a fight waiting for a decision
          const e = a.enc && A.encounters.find((q) => q.id === a.enc);
          if (e && e.status === 'pending') {
            card.appendChild(h('div', { class: 'ac-enc' }, 'ENGAGED: ' + e.b.name + ' (' + e.terrain + ') — settles itself in ' + Math.max(0, Math.ceil(e.autoAt - A.clock)) + ' s',
              h('div', { class: 'ac-row' }, btn('Auto-resolve now', () => { const r = Arm().resolve(g, e.id, 'auto'); this.showResult(r); }, 'primary'), btn('Retreat', () => { const r = Arm().resolve(g, e.id, 'retreat'); this.showResult(r); }))));
          }
        }
        cards.appendChild(card);
      }
      // commanders and the world
      const cm = h('div', { class: 'box' }, h('b', null, 'Commanders'));
      for (const id in A.cmdrs) {
        const c = A.cmdrs[id], d = Arm().cmdrDef(c);
        cm.appendChild(h('div', { class: 'ac-cm' }, h('b', null, d.name + ' ' + d.title), ' (' + d.kind + ') — ' + (c.armyId ? 'leads ' + A.byId[c.armyId].name : c.status) +
          (c.fate ? ' · ' + c.fate.kind + (c.fate.by ? ' by ' + c.fate.by : '') + (c.fate.recoverAt ? ', back in ' + Math.max(0, Math.ceil(c.fate.recoverAt - A.clock)) + ' s' : '') : ''),
          h('div', { class: 'dim' }, d.blurb)));
      }
      const groups = h('div', { class: 'box' }, h('b', null, 'Underground'));
      for (const id in A.groups) { const G = A.groups[id]; groups.appendChild(h('div', null, G.name + ' in ' + ((AS.Routes.node(g, G.node) || {}).name || G.node) + ': ' + (G.defeated ? 'destroyed' : Object.keys(G.stacks).map((k) => G.stacks[k] + ' ' + k).join(', ')))); }
      groups.appendChild(h('div', null, 'The Old King\'s Road: ' + (A.flags.kingsroad_open ? 'open' : 'sealed')));
      const last = A.encounters.filter((e) => e.status === 'done').slice(-1)[0];
      const res = this.lastShown || (last && last.result);
      const log = h('div', { class: 'box ac-log' }, h('b', null, 'Last encounter'), res ? res.log.slice(-8).map((l) => h('div', null, l)) : h('div', { class: 'dim' }, 'none yet'));
      const notes = h('div', { class: 'box ac-log' }, h('b', null, 'Reports'), A.log.slice(-8).reverse().map((n) => h('div', null, '[' + Math.round(n.t) + 's] ' + n.text)));
      const tools = h('div', { class: 'box' }, h('b', null, 'Test tools'),
        h('div', { class: 'ac-row' },
          btn('Send the raid now', () => { AS.ArmyTest.sendRaid(g); this.say({ ok: true }, 'The raiders march on Hollowford.'); }),
          btn(A.flags.kingsroad_open ? 'Seal the Old King\'s Road' : 'Unseal the Old King\'s Road', () => { A.flags.kingsroad_open = !A.flags.kingsroad_open; this.say({ ok: true }, 'The road is ' + (A.flags.kingsroad_open ? 'open.' : 'sealed.')); })),
        h('div', { class: 'ac-row' },
          btn('Save', () => this.say({ ok: AS.ArmyTest.save(g), reason: 'could not save' }, 'Saved.'), 'primary'),
          btn('Load', () => { const sv = AS.ArmyTest.load(); if (!sv) return this.say({ ok: false, reason: 'no save' }); this.close(); AS.ArmyTest.start(sv); }),
          btn('Restart test', () => { this.close(); AS.ArmyTest.start(null); })));
      root.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'court-head' }, h('div', null, h('div', { class: 'name' }, 'Army Command'), h('div', { class: 'dim' }, 'Test panel · army clock ' + Math.round(A.clock) + ' s'))),
        this.said ? h('div', { class: 'ac-said' }, this.said) : null,
        h('div', { class: 'court-body' }, cards, h('div', { class: 'court-side ac-side' }, cm, groups, log, notes, tools)),
        h('div', { class: 'court-foot' }, h('span', null, 'The realm waits while this panel is open.'), btn('Back to the skies', () => this.close(), 'primary', 'K / Esc'))));
      root.classList.add('show');
    },
    showResult(e) {
      if (!e) return this.say({ ok: false, reason: 'nothing to resolve' });
      const r = e.result; this.lastShown = r;
      this.say({ ok: true }, (r.winner === 'A' ? 'Victory' : 'Defeat') + ' in ' + r.rounds + ' rounds: lost ' + AS.AutoResolve.count(r.A.lost) + ', killed ' + AS.AutoResolve.count(r.B.lost) + '.');
    },
  };
  AS.ArmyPanel = ArmyPanel;
})(window.AS);
