/* WYRMCROWN — CONQUEST screens: the campaign slots and the campaign map.
 * Reached from the title menu ("Conquest") or with ?mode=conquest.
 *
 *  - Slots: three campaigns; found a new one (allegiance, optional seed),
 *    continue, delete.
 *  - The campaign map: the archipelago (ui/map.js) with a top bar (gold, the
 *    day, income/wages/net, leadership, the ship), a side panel for the selected
 *    place (owner, known threat, what taking it gives, recruitment, routes and
 *    the action — march, attack, hire, buy the ship), the army and the latest
 *    campaign events. Attacking opens a briefing; the battle itself is the real-
 *    time game (core/battle.js); its result returns here.
 *  - Every action saves the campaign at once (no saving every frame).
 *
 * Debug tools (reveal the map, gold, a ship, auto-win, pass a day, validate)
 * appear only with ?cqdebug=1 in the address. Uses the title screen's styles
 * plus a few of its own, scoped to #conquest. */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data;
  const CSS = `
#conquest{flex-direction:column;align-items:stretch;justify-content:flex-start;background:#120d09}
#conquest .cq-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:12px}
#conquest .map-card{cursor:default;display:flex;flex-direction:column;gap:8px}#conquest .map-card h3{margin:2px 0}
#conquest .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
#conquest select,#conquest input{background:#2a1c12;color:var(--ink);border:1px solid var(--rim2);border-radius:4px;padding:5px;font:500 14px var(--text)}
#conquest .cq-note{margin:10px 0;color:var(--gold);font:600 15px var(--text)}
#conquest .cq-wrap{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr;grid-template-columns:1fr 360px}
#conquest .cq-top{grid-column:1/3;display:flex;gap:18px;align-items:center;padding:8px 14px;background:linear-gradient(180deg,#3a2616,#24170d);border-bottom:1px solid var(--rim);font:600 15px var(--text);flex-wrap:wrap}
#conquest .cq-top .t{font:700 18px var(--title);color:var(--gold);letter-spacing:1.5px;margin-right:6px}
#conquest .cq-top .v{color:#fff3d6}#conquest .cq-top .k{color:var(--dim);font-weight:500;margin-right:4px}
#conquest .cq-top .pos{color:#9fe08a}#conquest .cq-top .neg{color:#ff9a7a}
#conquest .cq-top .sp{flex:1}
#conquest .cq-wrap .btn,#conquest .cq-debug .btn,#conquest .cq-modal .btn{min-width:0;letter-spacing:1px}
#conquest .cq-top .btn{padding:5px 12px;font-size:12px;margin:0}
#conquest .cq-modal .btn{min-width:140px}
#conquest .cq-mapbox{position:relative;overflow:hidden}
#conquest canvas.cq-map{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none}
#conquest .cq-zoom{position:absolute;left:10px;bottom:10px;display:flex;flex-direction:column;gap:6px}
#conquest .cq-zoom .btn{width:38px;padding:4px 0;margin:0;font-size:16px}
#conquest .cq-legend{position:absolute;left:58px;bottom:10px;padding:6px 10px;border-radius:6px;background:rgba(18,12,8,.8);border:1px solid var(--rim2);font:500 12px var(--text);color:var(--dim)}
#conquest .cq-side{overflow:auto;background:linear-gradient(180deg,#2c1d12,#1a110a);border-left:1px solid var(--rim);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
#conquest .cq-box{border:1px solid var(--rim2);border-radius:8px;padding:10px 12px;background:rgba(0,0,0,.25)}
#conquest .cq-box h3{margin:0 0 6px;font:700 16px var(--title);color:var(--gold);letter-spacing:1px}
#conquest .cq-box h4{margin:8px 0 4px;font:700 12px var(--title);color:#e8c890;letter-spacing:1px;text-transform:uppercase}
#conquest .cq-line{font:500 14px/1.35 var(--text);color:#f0e2c0}
#conquest .cq-dim{font:500 13px/1.35 var(--text);color:var(--dim)}
#conquest .cq-warn{color:#ffb08a}#conquest .cq-good{color:#9fe08a}
#conquest .cq-side .btn{margin:6px 0 0;width:100%;padding:8px 10px;font-size:13px;text-transform:none;letter-spacing:.5px}
#conquest .cq-hire{display:grid;grid-template-columns:1fr auto auto auto;gap:4px 6px;align-items:center;font:500 13px var(--text)}
#conquest .cq-hire .btn{width:auto;padding:3px 8px;margin:0;font-size:12px}
#conquest .cq-log div{font:500 12.5px/1.35 var(--text);color:var(--dim);padding:2px 0;border-bottom:1px solid rgba(214,170,90,.1)}
#conquest .cq-log .good{color:#bfe8a0}#conquest .cq-log .bad{color:#ffb08a}
#conquest .cq-modal{position:absolute;inset:0;background:rgba(5,3,2,.6);display:flex;align-items:center;justify-content:center;z-index:5}
#conquest .cq-modal .panel{max-width:620px;width:calc(100% - 40px);max-height:calc(100% - 40px);overflow:auto}
#conquest .cq-debug{position:absolute;right:370px;top:56px;display:flex;flex-direction:column;gap:4px;z-index:4}
#conquest .cq-debug .btn{padding:3px 8px;font-size:11px;margin:0;background:#3a1a3a}
`;
  const own = (o, alleg) => o === 'player' ? 'Yours' : o === 'free' ? 'Free folk (friendly)' : o === 'neutral' ? 'Wild creatures and outlaws' : o === 'independent' ? 'Independent lords' : D.allegianceName(o) + (alleg === o ? '' : '');
  const stacksTxt = (st) => st.map((s) => (Array.isArray(s) ? C.World.many(s[1], s[0]) : C.World.many(s.count, s.troop))).join(', ');
  const kindName = (s) => s.kind === 'lair' && D.lairs[s.lair] ? D.lairs[s.lair].name : (D.territories[s.kind] || {}).name || s.kind;

  const UI = {
    root: null, slot: null, state: null, raf: 0,
    debug() { try { return new URLSearchParams(location.search).get('cqdebug') === '1'; } catch (e) { return false; } },
    ensure() {
      const ui = document.getElementById('ui');
      if (!ui) return null;
      let root = document.getElementById('conquest');
      if (!root) { root = AS.UIKit.h('div', { id: 'conquest', class: 'screen' }); ui.appendChild(root); }
      if (!document.getElementById('conquest-style')) { const st = document.createElement('style'); st.id = 'conquest-style'; st.textContent = CSS; document.head.appendChild(st); }
      this.root = root;
      return root;
    },
    /* open the slots, or (slot given) that campaign's map; `after` reports a battle just fought */
    open(slot, note, after) {
      if (!this.ensure()) return;
      if (AS.UI && AS.UI.hideAll) AS.UI.hideAll();
      if (AS.App) AS.App.demoHold = true; // the attract-mode war behind the title stops while the campaign is open
      this.root.classList.add('show');
      if (slot) this.openMap(slot, note, after); else this.renderSlots(note);
    },
    hide() { if (this.root) this.root.classList.remove('show'); this.stopLoop(); },
    close() {
      this.hide();
      if (AS.App) AS.App.demoHold = false;
      if (AS.UI && AS.UI.showMenu) AS.UI.showMenu();
    },

    /* ---------------- slots ---------------- */
    renderSlots(note) {
      const { h, btn } = AS.UIKit, root = this.root;
      this.stopLoop(); this.slot = null; this.state = null;
      root.innerHTML = '';
      const slots = C.Save.slots();
      const cards = slots.map((s) => {
        if (s.summary) {
          const S = s.summary, r = C.Save.load(s.slot).state, at = r ? C.World.site(r, r.army.at) : null;
          return h('div', { class: 'map-card' },
            h('h3', null, 'Campaign ' + s.slot + ' · ' + D.allegianceName(S.allegiance)),
            h('div', { class: 'dim' }, 'Day ' + S.day + ' · ' + S.gold + ' gold · leadership ' + S.leadership + ' · ' + S.troops + ' troops'),
            h('div', { class: 'dim' }, (S.won ? 'VICTORIOUS · ' : '') + 'Progress: ' + S.progress + (at ? ' · at ' + at.name : '')),
            h('div', { class: 'dim' }, 'Dragon Lords: ' + S.lords.map((k) => D.allegianceName(k.split(' ')[0]) + (k.includes('fallen') ? ' (fallen)' : '')).join(', ')),
            h('div', { class: 'row' },
              btn('Continue', () => this.openMap(s.slot), 'primary'),
              btn('Delete', () => { if (confirm('Delete campaign ' + s.slot + '? This cannot be undone.')) { C.Save.remove(s.slot); this.renderSlots('Campaign ' + s.slot + ' deleted.'); } })));
        }
        const sel = h('select', { id: 'cq-alleg-' + s.slot }, D.realmKeys.map((k) => h('option', { value: k }, D.allegianceName(k))));
        const seed = h('input', { id: 'cq-seed-' + s.slot, placeholder: 'Seed (optional)', inputmode: 'numeric', style: 'width:9em' });
        return h('div', { class: 'map-card' },
          h('h3', null, 'Campaign ' + s.slot),
          h('div', { class: 'dim' }, s.error ? 'This save could not be read (' + s.error + '). A copy was kept.' : 'Empty'),
          h('div', { class: 'row' }, sel, seed),
          h('div', { class: 'row' }, btn('New campaign', () => {
            const v = seed.value.trim();
            let st;
            try { st = C.Campaign.create({ allegiance: sel.value, seed: v && /^\d+$/.test(v) ? +v : undefined }); } catch (e) { this.renderSlots('That world could not be made: ' + e.message); return; }
            const r = C.Save.save(s.slot, st);
            if (r.ok) this.openMap(s.slot, 'Campaign founded — seed ' + st.seed + '.');
            else this.renderSlots('Could not save: ' + r.error);
          }, 'primary')));
      });
      root.appendChild(h('div', { class: 'panel', style: 'max-width:980px;margin:40px auto' },
        h('h2', { class: 'heading' }, 'Conquest'),
        h('div', { class: 'dim', style: 'max-width:760px' }, 'A campaign across an unknown archipelago, different every time: one dragon and its wizard, an army raised in villages and monster lairs, bridges and castles to take, a ship to win, and the fortress of the main Dragon Lord waiting across the sea.'),
        note ? h('div', { class: 'cq-note' }, note) : null,
        h('div', { class: 'cq-slots' }, ...cards),
        h('div', { class: 'row', style: 'margin-top:14px' }, btn('Back', () => this.close()))));
    },

    /* ---------------- the campaign map ---------------- */
    openMap(slot, note, after) {
      const r = C.Save.load(slot);
      if (!r.state) { this.renderSlots('Campaign ' + slot + ' could not be read: ' + r.error); return; }
      this.slot = slot; this.state = r.state; this.sel = r.state.army.at;
      const { h } = AS.UIKit, root = this.root;
      root.innerHTML = '';
      this.top = h('div', { class: 'cq-top' });
      this.mapBox = h('div', { class: 'cq-mapbox' });
      this.side = h('div', { class: 'cq-side' });
      const cv = h('canvas', { class: 'cq-map' });
      this.mapBox.appendChild(cv);
      const { btn } = AS.UIKit;
      this.mapBox.appendChild(h('div', { class: 'cq-zoom' }, btn('+', () => C.MapView.zoom(1.25)), btn('−', () => C.MapView.zoom(0.8)), btn('⌖', () => C.MapView.focusArmy(false))));
      this.mapBox.appendChild(h('div', { class: 'cq-legend' }, 'Click a place to see it · double-click to march · drag to pan · wheel to zoom · ⚔ defended · ▲ hire here'));
      this.wrap = h('div', { class: 'cq-wrap' }, this.top, this.mapBox, this.side);
      root.appendChild(this.wrap);
      if (this.debug()) root.appendChild(this.debugPanel());
      const MV = C.MapView;
      MV.attach(cv, this.state);
      MV.sel = this.sel;
      MV.onSelect = (id) => { this.sel = id; this.renderSide(); };
      MV.onAct = (id) => { this.sel = id; MV.sel = id; this.act(id); };
      this.onResize = this.onResize || (() => { if (C.MapView.cv) C.MapView.resize(); });
      window.removeEventListener('resize', this.onResize); window.addEventListener('resize', this.onResize);
      this.renderTop(); this.renderSide();
      this.startLoop();
      if (after) this.showBattleResult(after);
      else if (note) this.toast(note);
      if (C.World.isWon(this.state) && !after) this.toast('This campaign is won. You may keep exploring.');
    },
    startLoop() {
      this.stopLoop();
      let last = performance.now();
      const step = (t) => { this.raf = requestAnimationFrame(step); const dt = Math.min(0.1, (t - last) / 1000); if (t - last < 50) return; last = t; C.MapView.tick(dt); };
      this.raf = requestAnimationFrame(step);
    },
    stopLoop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
    save() {
      const r = C.Save.save(this.slot, this.state);
      if (!r.ok) this.toast('Could not save: ' + r.error, true);
      return r.ok;
    },
    refresh() { C.MapView.setState(this.state); this.renderTop(); this.renderSide(); },
    renderTop() {
      const { h, btn } = AS.UIKit, st = this.state, L = C.World.ledger(st);
      this.top.innerHTML = '';
      const it = (k, v, cls) => h('span', null, h('span', { class: 'k' }, k), h('span', { class: 'v ' + (cls || '') }, v));
      this.top.append(
        h('span', { class: 't' }, D.allegianceName(st.hero.allegiance)),
        it('', C.World.timeLabel(st)),
        it('Gold', String(st.economy.gold)),
        it('Income', '+' + L.income), it('Wages', '−' + L.wages), it('Net', (L.net >= 0 ? '+' : '') + L.net + '/day', L.net >= 0 ? 'pos' : 'neg'),
        it('Leadership', C.Rules.leadershipUsed(st.army) + ' / ' + st.hero.leadership),
        it('Ship', st.army.ship.owned ? 'Yes' : 'No'),
        h('span', { class: 'sp' }),
        btn('Rest until morning', () => this.rest()),
        btn('Campaigns', () => this.renderSlots()),
        btn('Title', () => this.close()));
    },
    rest() {
      const reps = C.World.rest(this.state);
      this.save(); this.refresh();
      this.toast(reps.map((r) => 'Day ' + r.day + ': +' + r.income + ' / −' + r.wages + (r.deserted.length ? ' · ' + r.deserted.length + ' deserted' : '')).join(' · '));
    },
    renderSide() {
      const { h, btn } = AS.UIKit, st = this.state, W = C.World;
      const id = this.sel || st.army.at, s = W.site(st, id), here = id === st.army.at;
      this.side.innerHTML = '';
      // ---- the selected place
      const box = h('div', { class: 'cq-box' });
      box.append(h('h3', null, s.name + (s.final ? ' ♛' : '')));
      box.append(h('div', { class: 'cq-dim' }, kindName(s) + ' · ' + (C.MapView.TIER_NAME[s.tier] || '') + (here ? ' · your army is here' : '')));
      box.append(h('div', { class: 'cq-line' }, 'Held by: ' + own(s.owner, st.hero.allegiance)));
      if (s.final) box.append(h('div', { class: 'cq-line cq-warn' }, 'The main Dragon Lord\'s fortress. Taking it wins the campaign.'));
      else if (s.kind === 'lordhold') box.append(h('div', { class: 'cq-line cq-warn' }, 'A Dragon Lord\'s fortress. Taking it fells that Lord.'));
      if (s.id === C.World.of(st).castle && s.owner !== 'player') box.append(h('div', { class: 'cq-line' }, 'This castle commands the road to the harbour.'));
      if (s.kind === 'bridge' && s.owner !== 'player') box.append(h('div', { class: 'cq-line' }, 'A guarded crossing: take it to pass.'));
      if (W.hostile(st, id)) {
        const scouted = here || W.neighbours(st, st.army.at).some((e) => e.to === id);
        box.append(h('div', { class: 'cq-line cq-warn' }, 'Defended · threat: ' + W.threat(st, id)));
        box.append(h('div', { class: 'cq-dim' }, scouted ? 'Defenders: ' + stacksTxt(s.garrison) : 'Defenders: unknown until your army is next to it.'));
      }
      const taken = st.flags.taken && st.flags.taken[id];
      if (s.reward && s.owner !== 'player' && !taken) box.append(h('div', { class: 'cq-line' }, 'Taking it: +' + s.reward.gold + ' gold' + (s.reward.leadership ? ', +' + s.reward.leadership + ' leadership' : '')));
      if (s.income) box.append(h('div', { class: 'cq-line' }, (s.owner === 'player' ? 'Pays you ' : 'Would pay ') + s.income + ' gold a day'));
      if (s.recruitKind && s.stock) box.append(h('div', { class: 'cq-dim' }, 'Recruits: ' + Object.keys(s.stock).map((k) => D.troops[k].name).join(', ') + (s.owner === 'player' || s.owner === 'free' ? '' : ' (once taken)')));
      if (s.art) box.append(h('div', { class: 'cq-dim' }, 'Battlefield art: ' + s.art + '.'));
      const routes = W.neighbours(st, id).filter((e) => W.known(st, e.to)).map((e) => W.site(st, e.to).name + (e.type === 'sea' ? ' (by sea)' : e.type === 'bridge' ? ' (bridge)' : ''));
      if (routes.length) box.append(h('div', { class: 'cq-dim' }, 'Routes: ' + routes.join(', ')));
      // action
      if (!here) {
        const m = W.canMove(st, id);
        if (m.ok && m.battle) box.append(btn('Attack ' + s.name + ' (' + m.hours + 'h + battle)', () => this.act(id), 'primary'));
        else if (m.ok) box.append(btn('March here (' + m.hours + ' hours)', () => this.act(id), 'primary'));
        else box.append(h('div', { class: 'cq-line cq-warn', style: 'margin-top:6px' }, m.reason === 'No route from here' ? 'Not reachable in one march from where your army stands.' : m.reason + (m.sea ? ' — buy one at a harbour you hold (' + D.world.ship.cost + ' gold).' : '.')));
      }
      this.side.append(box);
      // ---- hiring and the ship, where the army stands (whatever is selected)
      {
        const rs = W.recruitSite(st), atName = W.site(st, st.army.at).name;
        if (rs) {
          const hb = h('div', { class: 'cq-box' }, h('h3', null, 'Hire troops at ' + atName), h('div', { class: 'cq-dim' }, (D.recruitSites[rs.kind] || {}).name + ' · stock refills every ' + ((D.recruitSites[rs.kind] || {}).restock || 3) + ' days'));
          const grid = h('div', { class: 'cq-hire' });
          for (const tid of Object.keys(rs.stock)) {
            const t = D.troops[tid], terms = C.Rules.recruitTerms(st.hero.allegiance, tid);
            grid.append(h('span', null, t.name + (t.gen ? '' : ' (art pending)'), h('span', { class: 'cq-dim' }, ' · ' + (terms.cost || '?') + 'g · ' + t.leadership + ' lead · ' + t.wage + '/day')),
              h('span', { class: 'cq-dim' }, rs.stock[tid] + ' left'),
              btn('+1', () => this.hire(tid, 1)), btn('+5', () => this.hire(tid, Math.min(5, rs.stock[tid] || 1))));
          }
          hb.append(grid);
          this.side.append(hb);
        }
        const sh = W.shipTerms(st);
        if (!sh.owned && (sh.ok || sh.cost)) this.side.append(h('div', { class: 'cq-box' }, h('h3', null, 'The shipwright of ' + atName), h('div', { class: 'cq-line' }, 'A ship carries your army over the sea routes. Cost: ' + D.world.ship.cost + ' gold.'), sh.ok ? btn('Buy the ship', () => this.buyShip(), 'primary') : h('div', { class: 'cq-line cq-warn' }, sh.reason + '.')));
      }
      // ---- the army
      const L = C.World.ledger(st);
      const ab = h('div', { class: 'cq-box' }, h('h3', null, 'Your army'));
      ab.append(h('div', { class: 'cq-line' }, 'Your dragon and its wizard' + (st.army.stacks.length ? ', with:' : ' — no troops yet. Hire some where you can.')));
      for (const q of st.army.stacks) { const t = D.troops[q.troop]; ab.append(h('div', { class: 'cq-dim' }, q.count + ' × ' + t.name + ' · ' + (t.leadership * q.count) + ' lead · ' + (t.wage * q.count) + '/day')); }
      ab.append(h('div', { class: 'cq-dim' }, 'Leadership ' + C.Rules.leadershipUsed(st.army) + ' / ' + st.hero.leadership + ' · wages ' + L.wages + '/day · income ' + L.income + '/day'));
      if (L.net < 0 && st.economy.gold + L.net * 2 < 0) ab.append(h('div', { class: 'cq-line cq-warn' }, 'Your gold will not cover wages for long: unpaid troops desert at the end of a day.'));
      this.side.append(ab);
      // ---- events
      const lb = h('div', { class: 'cq-box cq-log' }, h('h3', null, 'Chronicle'));
      for (const e of (st.log || []).slice(-8).reverse()) lb.append(h('div', { class: e.k || '' }, 'Day ' + e.d + ' · ' + e.t));
      this.side.append(lb);
    },
    hire(tid, n) {
      const r = C.World.recruit(this.state, tid, n);
      if (!r.ok) { this.toast(r.reason, true); return; }
      this.save(); this.refresh();
    },
    buyShip() {
      const r = C.World.buyShip(this.state);
      if (!r.ok) { this.toast(r.reason, true); return; }
      this.save(); this.refresh();
      this.modal('Your ship is launched', ['The sea routes from here are open. Your army can now cross to the islands beyond — where stronger troops, richer holdings and greater dangers wait.'], [['Set sail', null, 'primary']]);
    },
    // march, or attack (with a briefing first)
    act(id) {
      const st = this.state, W = C.World, m = W.canMove(st, id);
      if (!m.ok) { this.toast(m.reason, true); return; }
      if (m.battle) { this.briefing(id); return; }
      const before = st.army.at, r = W.move(st, id);
      if (!r.ok) { this.toast(r.reason || 'Cannot march there', true); return; }
      this.save();
      this.sel = id; C.MapView.sel = id;
      this.refresh();
      const msgs = [];
      if (r.captured && r.captured.reward) msgs.push('Claimed! +' + r.captured.reward.gold + ' gold, +' + r.captured.reward.leadership + ' leadership.');
      for (const d of r.reports) msgs.push('Day ' + d.day + ' ended: +' + d.income + ' / −' + d.wages + (d.deserted.length ? ' · ' + d.deserted.length + ' deserted' : ''));
      if (msgs.length) this.toast(msgs.join(' · '));
      if (C.World.isWon(st) && before !== id) this.victory();
    },
    briefing(id) {
      const { h, btn } = AS.UIKit, st = this.state, W = C.World, s = W.site(st, id), m = W.canMove(st, id);
      const stake = [];
      if (s.reward && !(st.flags.taken && st.flags.taken[id])) stake.push('+' + s.reward.gold + ' gold and +' + s.reward.leadership + ' leadership');
      if (s.income) stake.push(s.income + ' gold a day');
      if (s.recruitKind && s.stock) stake.push('hiring: ' + Object.keys(s.stock).map((k) => D.troops[k].name).join(', '));
      if (s.kind === 'bridge') stake.push('the crossing beyond it');
      if (id === W.of(st).castle) stake.push('the road to the harbour');
      if (s.kind === 'harbour') stake.push('a shipwright (a ship costs ' + D.world.ship.cost + ' gold)');
      if (s.final) stake.push('VICTORY in the campaign');
      const body = h('div', null,
        h('div', { class: 'cq-line' }, kindName(s) + ' held by ' + own(s.owner) + '. Threat: ', h('b', { class: 'cq-warn' }, W.threat(st, id)), '.'),
        h('div', { class: 'cq-dim', style: 'margin:6px 0' }, 'Defenders: ' + stacksTxt(s.garrison)),
        stake.length ? h('div', { class: 'cq-line' }, 'At stake: ' + stake.join(' · ') + '.') : null,
        h('div', { class: 'cq-line', style: 'margin-top:8px' }, 'Your army: your dragon' + (st.army.stacks.length ? ' and ' + stacksTxt(st.army.stacks) : ' alone') + '.'),
        h('div', { class: 'cq-dim', style: 'margin-top:8px' }, s.kind === 'lordhold' ? 'Break the wardstones and drive off the Lord\'s dragon, then destroy the stronghold.' : 'Defeat the defenders, then circle low over the site (or have troops stand in its ring) to claim it.'),
        h('div', { class: 'cq-dim' }, 'If your dragon is driven from the sky, the army withdraws and the battle is lost. Losses are permanent. The march and battle take about ' + (m.hours + D.world.hours.battle) + ' hours.'));
      const acts = [['Fight!', () => { const r = C.Battle.launch(this.slot, id); if (!r.ok) this.toast(r.reason, true); }, 'primary'], ['Back', null]];
      if (this.debug()) acts.splice(1, 0, ['Auto-win (debug)', () => this.debugWin(id)]);
      this.modal('Attack ' + s.name + '?', [body], acts);
    },
    showBattleResult(after) {
      const { h } = AS.UIKit, res = after.battle, A = after.applied || {};
      const s = C.World.site(this.state, res.siteId);
      const lost = A.lost || {};
      const lines = [h('div', { class: 'cq-line' }, res.won ? 'Victory at ' + s.name + '.' : (res.retreat ? 'Your army withdrew from ' : 'Defeat at ') + s.name + '.')];
      lines.push(h('div', { class: 'cq-dim' }, Object.keys(lost).length ? 'Losses: ' + Object.keys(lost).map((k) => C.World.many(lost[k], k)).join(', ') + '.' : 'No losses.'));
      if (A.captured && A.captured.reward) lines.push(h('div', { class: 'cq-line cq-good' }, 'Spoils: +' + A.captured.reward.gold + ' gold, +' + A.captured.reward.leadership + ' leadership.'));
      if (!res.won && this.state.sites[res.siteId] && !this.state.sites[res.siteId].garrison.length) lines.push(h('div', { class: 'cq-line cq-good' }, 'Its defenders are all dead — march in to claim it.'));
      for (const d of A.reports || []) lines.push(h('div', { class: 'cq-dim' }, 'Day ' + d.day + ' ended: income +' + d.income + ', wages −' + d.wages + (d.deserted.length ? ', ' + d.deserted.length + ' deserted' : '') + '.'));
      lines.push(h('div', { class: 'cq-dim' }, 'Now: ' + C.World.timeLabel(this.state) + (after.saved ? ' · campaign saved' : '')));
      this.modal(res.won ? 'Victory' : 'Defeat', lines, [['Continue', () => { if (C.World.isWon(this.state)) this.victory(); }, 'primary']]);
    },
    victory() {
      const st = this.state;
      this.modal('Campaign Victory', ['The fortress of the main Dragon Lord has fallen. The archipelago is yours.', 'Day ' + st.economy.day + ' · ' + st.stats.battles + ' battles (' + st.stats.won + ' won) · ' + st.stats.captured + ' places taken · ' + st.stats.recruited + ' troops hired.'], [['Keep exploring', null, 'primary'], ['Back to the campaigns', () => this.renderSlots('Campaign ' + this.slot + ' won!')]]);
    },
    modal(title, lines, actions) {
      const { h, btn } = AS.UIKit;
      const m = h('div', { class: 'cq-modal' });
      const close = () => m.remove();
      m.appendChild(h('div', { class: 'panel' }, h('h2', null, title), ...lines.map((l) => (typeof l === 'string' ? h('div', { class: 'cq-line', style: 'margin:6px 0' }, l) : l)),
        h('div', { class: 'row', style: 'margin-top:14px' }, ...actions.map(([label, fn, cls]) => btn(label, () => { close(); if (fn) fn(); }, cls)))));
      this.root.appendChild(m);
      return m;
    },
    toast(text, bad) {
      const { h } = AS.UIKit;
      const t = h('div', { style: 'position:absolute;left:50%;top:60px;transform:translateX(-50%);z-index:6;max-width:70%;padding:8px 16px;border-radius:8px;background:rgba(20,12,8,.92);border:1px solid ' + (bad ? '#c06a4a' : 'var(--rim)') + ';font:600 14px var(--text);color:' + (bad ? '#ffb08a' : '#fff3d6') + ';pointer-events:none' }, text);
      this.root.appendChild(t);
      setTimeout(() => t.remove(), 3800);
    },

    /* ---------------- debug (?cqdebug=1 only) ---------------- */
    debugPanel() {
      const { h, btn } = AS.UIKit;
      const go = (fn) => () => { fn(); this.save(); this.refresh(); };
      return h('div', { class: 'cq-debug' },
        btn('Reveal map', go(() => { this.state.flags.reveal = true; for (const s of C.World.of(this.state).sites) C.World.reveal(this.state, s.id); })),
        btn('+1000 gold', go(() => { this.state.economy.gold += 1000; })),
        btn('+200 leadership', go(() => { this.state.hero.leadership += 200; })),
        btn('Give ship', go(() => { this.state.army.ship = { owned: true, at: this.state.army.at }; })),
        btn('Pass a day', go(() => { C.World.advance(this.state, 24); })),
        btn('Seed: ' + this.state.seed, () => this.toast('Seed ' + this.state.seed + ' · world style ' + C.World.of(this.state).style)),
        btn('Validate', () => { const w = C.World.of(this.state); this.toast('World: ' + (w.problems.length ? w.problems.join('; ') : 'valid') + ' · save: ' + (C.Save.validate(this.state).join('; ') || 'valid')); }));
    },
    debugWin(id) {
      const surv = {}; for (const q of this.state.army.stacks) surv[q.troop] = q.count;
      const res = { conquest: true, siteId: id, won: true, survivors: surv, enemy: {}, hours: C.World.canMove(this.state, id).hours + D.world.hours.battle };
      const out = C.World.applyBattle(this.state, id, res);
      this.save(); this.sel = id; C.MapView.sel = id; this.refresh();
      this.showBattleResult({ battle: res, applied: out, saved: true });
    },
  };
  C.UI = UI;
})(window.AS);
