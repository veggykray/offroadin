/* ALIEN STRIKE — hangar: craft display (reflects upgrades), upgrades, weapon
 * fabrication/loadout and consumables. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const Hangar = {
    tab: 'upgrades', cv: null, raf: null, t: 0, sheetKey: null, sheet: null, missionId: null,
    show(root, missionId) {
      this.root = root; if (missionId) this.missionId = missionId;
      if (!AS.Save.profile) AS.Save.loadProfile() || AS.Save.newProfile();
      this.render();
      if (!this.raf) { const loop = () => { if (AS.UI.current === 'hangar') this.drawBay(1 / 60); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    },
    render() {
      const { h, btn } = AS.UI;
      const p = AS.Save.profile, C = AS.Campaign;
      const root = this.root; root.innerHTML = '';
      const st = AS.Stats.compute(p);
      const left = h('div', { class: 'left' });
      this.cv = h('canvas', { class: 'bay', width: 400, height: 250 });
      left.appendChild(h('div', { class: 'panel', style: 'padding:14px' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline' }, h('h2', { style: 'margin:0' }, 'HANGAR — VESPER'), h('div', { class: 'res' }, h('span', { class: 's' }, '◈ ' + p.salvage + ' SALVAGE'), h('span', { class: 't' }, '✦ ' + p.tech + ' TECH'))),
        this.cv,
        h('div', { class: 'statgrid', style: 'margin-top:10px' },
          ...[['HULL', st.hullMax], ['SHIELD', st.shieldMax], ['FUEL', Math.round(st.fuelMax)], ['SPEED', Math.round(st.maxSpeed)], ['TURN', st.turnRate.toFixed(1)], ['CARGO', st.cargoCap], ['SEATS', st.rescueCap], ['SCANNER', 'L' + st.scanLevel + ' ' + Math.round(st.scanRange)]].map(([k, v]) => h('div', { class: 'dim' }, k, h('b', null, v))))));
      const nextId = this.missionId && C.isUnlocked(this.missionId) ? this.missionId : C.nextMission();
      const nm = AS.Levels.byId[nextId];
      left.appendChild(h('div', { class: 'panel', style: 'padding:14px' },
        h('div', { class: 'mono dim' }, 'NEXT OPERATION'),
        h('div', { style: 'font:700 18px Chakra Petch;letter-spacing:1px;margin:2px 0 8px' }, nm ? AS.Data.worldById(nm.world).name + ' — ' + nm.name : '—'),
        h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, btn('Briefing', () => AS.UI.showBriefing(nextId), 'primary'), btn('Mission select', () => AS.UI.showSelect()), btn('Main menu', () => AS.UI.showMenu()))));
      const right = h('div', { class: 'right' });
      const tabs = h('div', { class: 'tabs' }, ...[['upgrades', 'UPGRADES'], ['loadout', 'WEAPONS'], ['supplies', 'SUPPLIES']].map(([k, t]) => btn(t, () => { this.tab = k; this.render(); }, 'small' + (this.tab === k ? ' on' : ''))));
      right.appendChild(tabs);
      const list = h('div', { class: 'list panel', style: 'padding:14px 16px' });
      if (this.tab === 'upgrades') this.upgradesTab(list);
      else if (this.tab === 'loadout') this.loadoutTab(list);
      else this.suppliesTab(list);
      right.appendChild(list);
      root.appendChild(left); root.appendChild(right);
      this.sheet = null;
    },
    upgradesTab(list) {
      const { h, btn } = AS.UI;
      const p = AS.Save.profile, C = AS.Campaign;
      for (const cat of AS.Data.upgradeCats) {
        list.appendChild(h('div', { class: 'cat-title' }, cat.name));
        for (const u of AS.Data.upgrades.filter((x) => x.cat === cat.id)) {
          const lv = C.upgradeLevel(u.id), cost = C.upgradeCost(u);
          const pips = h('div', { class: 'pips' }, ...Array.from({ length: u.max }, (_, i) => h('span', { class: i < lv ? 'on' : '' })));
          const buy = h('div', { class: 'buy' },
            cost ? h('div', { class: 'cost' }, cost.salvage + ' ◈', cost.tech ? h('span', { class: 't' }, '  ' + cost.tech + ' ✦') : null) : h('div', { class: 'cost' }, 'MAXED'),
            cost ? btn('Buy', () => { if (C.buyUpgrade(u.id)) { AS.Audio.sfx('ui_buy'); this.flashT = 1; this.render(); } else AS.Audio.sfx('denied'); }, 'small') : null);
          if (cost && !C.canAfford(cost)) buy.querySelector('button').disabled = true;
          list.appendChild(h('div', { class: 'upg' }, h('div', null, h('span', { class: 'nm' }, u.name), '  ', h('span', { class: 'tag' }, u.effect)), buy, pips, h('div', { class: 'ds' }, u.desc)));
        }
      }
    },
    loadoutTab(list) {
      const { h, btn } = AS.UI;
      const p = AS.Save.profile, C = AS.Campaign, W = AS.Data.weapons;
      for (const slot of ['primary', 'secondary', 'special']) {
        list.appendChild(h('div', { class: 'cat-title' }, slot.toUpperCase() + ' HARDPOINT'));
        for (const id of AS.Data.weaponOrder[slot]) {
          const w = W[id];
          const owned = p.ownedWeapons.includes(id), unlocked = p.unlockedWeapons.includes(id), eq = p.loadout[slot] === id;
          let act;
          if (eq) act = h('span', { class: 'tag amber' }, 'EQUIPPED');
          else if (owned) act = btn('Equip', () => { C.equip(id); AS.Audio.sfx('confirm'); this.render(); }, 'small');
          else if (unlocked) { act = h('div', null, h('div', { class: 'cost mono', style: 'color:#e8c24a;font-size:12px;text-align:right' }, (w.fab.salvage + ' ◈') + (w.fab.tech ? '  ' + w.fab.tech + ' ✦' : '')), btn('Fabricate', () => { if (C.fabricate(id)) { AS.Audio.sfx('ui_buy'); this.render(); } else AS.Audio.sfx('denied'); }, 'small')); if (!C.canAfford(w.fab)) act.querySelector('button').disabled = true; }
          else act = h('span', { class: 'tag' }, 'BLUEPRINT MISSING');
          list.appendChild(h('div', { class: 'weapon-card' + (eq ? ' eq' : '') + (!unlocked ? ' locked' : '') }, h('div', { class: 'nm' }, unlocked ? w.name : '??? — UNKNOWN SYSTEM'), h('div', { class: 'act' }, act), h('div', { class: 'ds' }, unlocked ? w.desc : 'Recover the blueprint during the campaign.')));
        }
      }
    },
    suppliesTab(list) {
      const { h, btn } = AS.UI;
      const p = AS.Save.profile, st = AS.Stats.compute(p);
      list.appendChild(h('div', { class: 'cat-title' }, 'CONSUMABLES'));
      const b = btn('Buy repair kit', () => { if (AS.Campaign.buyKit()) { AS.Audio.sfx('ui_buy'); this.render(); } else AS.Audio.sfx('denied'); }, 'small');
      if (p.repairKits >= st.kitCap || p.salvage < AS.Data.repairKitCost) b.disabled = true;
      list.appendChild(h('div', { class: 'upg' }, h('div', null, h('span', { class: 'nm' }, 'NANITE REPAIR KIT'), '  ', h('span', { class: 'tag' }, p.repairKits + ' / ' + st.kitCap)), h('div', { class: 'buy' }, h('div', { class: 'cost' }, AS.Data.repairKitCost + ' ◈'), b), h('div', { class: 'ds' }, 'Press R in flight to restore 40% hull over 1.4 seconds. Kits not used are kept between missions. Upgrade the kit rack to carry more.')));
      list.appendChild(h('div', { class: 'cat-title' }, 'STANDARD ISSUE'));
      list.appendChild(h('div', { class: 'dim', style: 'line-height:1.6' }, 'Fuel, ammunition and shields are topped up before every sortie. In the field, resupply from fuel cells, ammo crates and missile packs, or land on a forward pad to repair, refuel and rearm.'));
      list.appendChild(h('div', { class: 'cat-title' }, 'SERVICE RECORD'));
      const s = p.stats;
      list.appendChild(h('div', { class: 'statgrid' }, ...[['MISSIONS', s.missions], ['KILLS', s.kills], ['RESCUED', s.rescued], ['LOSSES', s.deaths], ['EARNED', s.salvageEarned], ['FLIGHT TIME', U.fmtTime(s.playTime)]].map(([k, v]) => h('div', { class: 'dim' }, k, h('b', null, v)))));
    },
    drawBay(dt) {
      const cv = this.cv; if (!cv || !cv.isConnected) return;
      this.t += dt;
      const c = cv.getContext('2d');
      const W = 100, H = 62; // low-res bay drawn then scaled ×4
      if (!this.low) this.low = AS.Forge.canvas(W, H);
      const l = this.low.getContext('2d');
      const p = AS.Save.profile;
      const key = JSON.stringify(p.upgrades);
      if (this.sheetKey !== key || !this.sheet) { this.sheetKey = key; this.sheet = AS.Forge.sheet('craft:' + key, () => AS.Models.craft(p.upgrades), 48, 1); this.podSheet = AS.Forge.sheet('pod:' + (p.upgrades.pSpread || 0) + ':' + p.loadout.primary, () => AS.Models.pod(p.upgrades, p.loadout.primary), 32, 1); }
      // backdrop
      const g = l.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c141c'); g.addColorStop(1, '#05080b');
      l.fillStyle = g; l.fillRect(0, 0, W, H);
      l.fillStyle = '#121c26'; for (let x = 0; x < W; x += 12) l.fillRect(x, 0, 2, 22);
      l.fillStyle = '#1a2632'; l.fillRect(0, 22, W, 2);
      // floor grid in perspective
      l.strokeStyle = 'rgba(127,232,255,0.12)'; l.lineWidth = 0.5;
      for (let i = -8; i <= 8; i++) { l.beginPath(); l.moveTo(W / 2 + i * 3, 26); l.lineTo(W / 2 + i * 14, H); l.stroke(); }
      for (let j = 0; j < 6; j++) { const y = 26 + j * j * 1.2 + j * 2; l.beginPath(); l.moveTo(0, y); l.lineTo(W, y); l.stroke(); }
      // lights
      for (const lx of [14, 50, 86]) { l.fillStyle = Math.sin(this.t * 2 + lx) > -0.8 ? '#ffd27a' : '#6a5a3a'; l.fillRect(lx - 3, 2, 6, 1); l.globalAlpha = 0.07; l.fillStyle = '#ffd27a'; l.beginPath(); l.moveTo(lx - 3, 3); l.lineTo(lx + 3, 3); l.lineTo(lx + 14, H); l.lineTo(lx - 14, H); l.fill(); l.globalAlpha = 1; }
      // holo ring under craft
      const cx = W / 2, cy = 42;
      l.strokeStyle = 'rgba(127,232,255,' + (0.4 + Math.sin(this.t * 3) * 0.2) + ')';
      l.beginPath(); l.ellipse(cx, cy + 4, 26, 8, 0, 0, TAU); l.stroke();
      l.strokeStyle = 'rgba(127,232,255,0.15)'; l.beginPath(); l.ellipse(cx, cy + 4, 32, 10, 0, 0, TAU); l.stroke();
      c.imageSmoothingEnabled = false;
      c.drawImage(this.low, 0, 0, cv.width, cv.height);
      // craft drawn at 2.5× over the backdrop for detail
      const sh = this.sheet, a = this.t * 0.4;
      const fi = AS.Forge.frameIndex(sh, a);
      const S = 2.6, bob = Math.sin(this.t * 2) * 2;
      const px = cv.width / 2, py = cy * 4 + 6;
      c.globalAlpha = 0.35; c.drawImage(sh.shadows[fi], px - sh.ax * S + 8, py - sh.ay * S + 26, sh.w * S, sh.h * S); c.globalAlpha = 1;
      c.drawImage(sh.frames[0][fi], px - sh.ax * S, py - sh.ay * S - 24 + bob, sh.w * S, sh.h * S);
      // pods
      const ca = Math.cos(a), sa = Math.sin(a);
      for (const off of [[3, 9], [3, -9]]) {
        const ox = off[0] * ca - off[1] * sa, oy = off[0] * sa + off[1] * ca;
        const ps = this.podSheet, pf = AS.Forge.frameIndex(ps, a);
        c.drawImage(ps.frames[0][pf], px + ox * S - ps.ax * S, py + oy * S - ps.ay * S - 24 - 7 * S + bob, ps.w * S, ps.h * S);
      }
      // ring glow
      c.globalCompositeOperation = 'lighter';
      for (const rp of sh.model.ringPts) {
        const rx = rp[0] * ca - rp[1] * sa, ry = rp[0] * sa + rp[1] * ca;
        c.globalAlpha = 0.55 + Math.sin(this.t * 10) * 0.1;
        const gs = sh.model.ringR * 2.4 * S;
        c.drawImage(AS.Forge.glow(sh.model.glow, 32), px + rx * S - gs, py + ry * S - 24 - 4 * S + bob - gs, gs * 2, gs * 2);
      }
      if (this.flashT > 0) { this.flashT -= dt; c.globalAlpha = this.flashT * 0.5; c.fillStyle = '#7fe8ff'; c.fillRect(0, 0, cv.width, cv.height); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.imageSmoothingEnabled = true;
    },
  };
  AS.Hangar = Hangar;
})(window.AS);
