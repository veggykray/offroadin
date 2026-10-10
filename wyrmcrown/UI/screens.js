/* WYRMCROWN — menus and screens (DOM), built with the shared UI kit.
 * Title (over a live attract-mode realm), realm choice, the atlas of maps,
 * briefing, loading, pause, options, controls and the war's end. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const { $, h, btn } = AS.UIKit;
  const TIPS = [
    'Double-click an animal and your dragon swoops down and eats it. A fed dragon is a fast dragon.',
    'Double-tap SPACE to loop the loop: bolts, arrows and breath all miss while you are over the top.',
    'Gold carts roll home from the mines and villages you hold. Guard them — and break your rivals\' carts.',
    'A stronghold\'s ward holds while its wardstones stand and its dragon flies. Break both to storm it.',
    'Your breath is strongest when you fly low. At cruising height the flames spread thin.',
    'Ballistae pierce dragon scales. Come in low and fast, or burn them first.',
    'Carry a rival\'s livestock home to your pastures to steal it for your own herds.',
    'Waygates you own let you cross the realm in a heartbeat: press E while hovering in one.',
    'Rune circles raise magic orbs. Spell orbs store a spell — cast it with Q.',
    'Morgrave\'s dragon recovers fastest of all and its breath raises the slain as skeletons.',
    'Sylvara\'s dragon is the fastest flier; Hrimgard\'s is slow but terribly tough.',
  ];

  const QUOTES = [
    'Even in ice, ambition burns.', 'Kings are titles. Dragons are power.', 'Every crown is hollow until a dragon fills it.',
    'The sky remembers who ruled it.', 'Small kings, great dragons, a messy world.', 'Gold buys walls. Fire buys kingdoms.',
  ];
  // the crown that hollows the O of the logo
  function crownSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 48');
    svg.innerHTML = '<defs><linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#f2c14e"/><stop offset=".75" stop-color="#9a5e1e"/><stop offset="1" stop-color="#e8b04a"/></linearGradient></defs>' +
      '<path d="M6 40 L4 12 L18 24 L32 4 L46 24 L60 12 L58 40 Z" fill="url(#hcg)" stroke="#3a2008" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="6" y="38" width="52" height="7" rx="2" fill="url(#hcg)" stroke="#3a2008" stroke-width="2"/>' +
      '<circle cx="4" cy="11" r="3" fill="#f2c14e" stroke="#3a2008"/><circle cx="32" cy="4" r="3.4" fill="#f2c14e" stroke="#3a2008"/><circle cx="60" cy="11" r="3" fill="#f2c14e" stroke="#3a2008"/>' +
      '<path d="M32 18 L36 28 L32 34 L28 28 Z" fill="#b8262a" stroke="#3a2008" stroke-width="1.5"/>';
    return svg;
  }
  function logo() {
    return h('h1', { class: 'logo' }, h('span', { class: 'l1' }, 'Hollow'), h('span', { class: 'l2' }, 'Cr', h('span', { class: 'o' }, 'O', crownSvg()), 'wns'));
  }
  // "Magister Aldric" → "Aldric & Pyrrhax"
  const pairName = (F) => F.rider.name.split(' ').pop() + ' & ' + F.dragon.name;
  // a round seal for the card: the dragon's breath and the wizard's bolt
  function seal(fk, kind) {
    const F = AS.Data.factions[fk], cv = h('canvas', { width: 64, height: 64, class: 'seal' }), c = cv.getContext('2d');
    const col = kind === 'breath' ? ((AS.Data.breaths[F.dragon.breath] || {}).cols || ['#fff', '#fc6', '#f60'])[1] : F.rider.orb;
    const g = c.createRadialGradient(32, 28, 4, 32, 32, 30); g.addColorStop(0, 'rgba(60,40,24,0.95)'); g.addColorStop(1, 'rgba(14,9,6,0.95)');
    c.fillStyle = g; c.beginPath(); c.arc(32, 32, 29, 0, TAU); c.fill();
    c.strokeStyle = '#c8963a'; c.lineWidth = 3; c.stroke(); c.strokeStyle = 'rgba(255,230,170,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(32, 32, 24, 0, TAU); c.stroke();
    c.shadowColor = col; c.shadowBlur = 10;
    if (AS.HUD && AS.HUD.icon) AS.HUD.icon(c, kind === 'breath' ? 'flame' : 'star', 32, 33, 30, col);
    return cv;
  }

  /* parchment-style atlas thumbnail of a map: regions, water, ridges, forests, towns */
  const Atlas = {
    cache: new Map(),
    draw(map, size) {
      const key = map.id + ':' + size;
      if (this.cache.has(key)) return this.cache.get(key);
      const cv = AS.Forge.canvas(size, size), c = cv.getContext('2d'), k = size / Math.max(map.w, map.h);
      const LOOK = { human: '#8aa04e', elf: '#4f7a3a', ice: '#e6eef6', undead: '#6a6260', neutral: '#b0a868' };
      // parchment (the whole card), then the realm centred on it
      c.fillStyle = '#d8c69a'; c.fillRect(0, 0, size, size);
      c.save(); c.translate((size - map.w * k) / 2, (size - map.h * k) / 2);
      // regions: soft-edged painted blobs
      for (const r of map.regions) {
        const g = c.createRadialGradient(r.x * k, r.y * k, 0, r.x * k, r.y * k, r.r * k * 1.05);
        g.addColorStop(0, LOOK[r.biome]); g.addColorStop(0.7, LOOK[r.biome]); g.addColorStop(1, 'rgba(216,198,154,0)');
        c.globalAlpha = r.biome === 'neutral' ? 0.55 : 0.85; c.fillStyle = g; c.beginPath(); c.arc(r.x * k, r.y * k, r.r * k * 1.05, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      // forests
      for (const f of map.forests || []) { c.fillStyle = 'rgba(30,60,30,0.35)'; c.beginPath(); c.ellipse(f.x * k, f.y * k, f.r * k * (f.sx || 1), f.r * k * (f.sy || 1) * 0.9, 0, 0, TAU); c.fill(); }
      // ridges
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const m of map.mountains || []) {
        const pts = AS.RealmTerrain.smoothLine(m.pts, 200);
        c.strokeStyle = 'rgba(90,78,64,0.75)'; c.lineWidth = m.w * k * 0.9;
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.stroke();
        c.strokeStyle = 'rgba(240,236,228,0.5)'; c.lineWidth = m.w * k * 0.3;
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.stroke();
      }
      // water (keep a copy of the land first, for islands)
      const land = AS.Forge.canvas(size, size); land.getContext('2d').drawImage(cv, 0, 0);
      for (const r of map.rivers || []) {
        const pts = AS.RealmTerrain.smoothLine(r.pts, 160);
        c.strokeStyle = '#4a7a98'; c.lineWidth = Math.max(1.5, r.w * k * 1.6);
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.stroke();
      }
      for (const l of map.lakes || []) { c.fillStyle = '#4a7a98'; c.beginPath(); c.ellipse(l.x * k, l.y * k, l.r * k * (l.sx || 1), l.r * k * (l.sy || 1), 0, 0, TAU); c.fill(); }
      // islands: the land painted before the water shows through again
      if (map.islands && map.islands.length) {
        c.save(); c.beginPath();
        for (const l of map.islands) { c.moveTo(l.x * k + l.r * k * (l.sx || 1), l.y * k); c.ellipse(l.x * k, l.y * k, l.r * k * (l.sx || 1), l.r * k * (l.sy || 1), 0, 0, TAU); }
        c.clip(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(land, 0, 0);
        c.restore();
        c.strokeStyle = 'rgba(40,70,90,0.6)'; c.lineWidth = 1;
        for (const l of map.islands) { c.beginPath(); c.ellipse(l.x * k, l.y * k, l.r * k * (l.sx || 1), l.r * k * (l.sy || 1), 0, 0, TAU); c.stroke(); }
      }
      // roads
      c.setLineDash([3, 3]); c.strokeStyle = 'rgba(110,80,50,0.6)'; c.lineWidth = 1;
      for (const r of map.roads || []) { c.beginPath(); r.pts.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.stroke(); }
      c.setLineDash([]);
      // sites and towns
      for (const s of map.sites) { c.fillStyle = s.k === 'goldmine' ? '#c89a2a' : s.k === 'castle' || s.k === 'fort' ? '#6a4a3a' : '#5a4a3a'; c.beginPath(); c.arc(s.x * k, s.y * k, Math.max(1.2, size / 220), 0, TAU); c.fill(); }
      for (const fk in map.factions) {
        const t = map.factions[fk].town, F = AS.Data.factions[fk], r = Math.max(4, size / 26);
        c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(t.x * k, t.y * k, r + 1.5, 0, TAU); c.fill();
        c.fillStyle = F.color; c.beginPath(); c.arc(t.x * k, t.y * k, r, 0, TAU); c.fill();
      }
      c.restore();
      // aged edges
      const v = c.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.72);
      v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.45)');
      c.fillStyle = v; c.fillRect(0, 0, size, size);
      c.strokeStyle = 'rgba(80,56,30,0.8)'; c.lineWidth = 2; c.strokeRect(1, 1, size - 2, size - 2);
      this.cache.set(key, cv);
      return cv;
    },
  };

  /* a dragon portrait for the realm cards */
  function portrait(fk, w, hgt) {
    const cv = h('canvas', { width: w * 2, height: hgt * 2, style: 'width:' + w + 'px;height:' + hgt + 'px' });
    const ctx = cv.getContext('2d');
    const fake = { time: 0, map: { w: 9999, h: 9999 } };
    const d = new AS.Dragon(fake, Object.assign({ upgrades: {} }, AS.Data.factions[fk]), { x: 0, y: 0, angle: -1.15 });
    d.input.aimX = 120; d.input.aimY = -160;
    d.freq = 2; d.phase = 0.08; d.wing.elev = 0.22 + Math.cos(0.08 * TAU) * 0.55; d.angVel = 0.4; d.bank = 0.25; d.z = 0;
    for (let i = 0; i < 30; i++) d.layoutRig(1 / 60);
    ctx.scale(2, 2);
    const g = ctx.createRadialGradient(w / 2, hgt / 2, 4, w / 2, hgt / 2, w * 0.6);
    g.addColorStop(0, 'rgba(255,220,150,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    ctx.translate(w / 2 - 4, hgt / 2 + 12); ctx.scale(1.45, 1.45);
    d.draw(ctx, 0, 0, AS.Renderer);
    AS.Renderer.lights.length = 0; AS.Renderer.flares.length = 0;
    return cv;
  }

  const UI = {
    root: null, screens: {}, from: null, sel: { faction: 'human', map: 'sundered', difficulty: null },
    boot(showMenu) {
      // what wizards and dragons say is shown only if asked for: switched off once for older settings
      const S = AS.Settings;
      if (S && !S.subtitlesDefaultOff) { S.subtitles = false; S.subtitlesDefaultOff = true; if (AS.Save.saveSettings) AS.Save.saveSettings(); }
      this.root = document.getElementById('ui');
      for (const id of ['menu', 'select', 'maps', 'pause', 'options', 'controls', 'results', 'loading', 'confirm']) {
        const s = h('div', { id, class: 'screen' }); this.root.appendChild(s); this.screens[id] = s;
      }
      if (showMenu) { this.showMenu(); setTimeout(() => this.startDemo(), 120); }
    },
    hideAll() { for (const k in this.screens) this.screens[k].classList.remove('show'); const c = document.getElementById('court'); if (c) c.classList.remove('show'); },
    show(id) { this.hideAll(); this.screens[id].classList.add('show'); },
    error(text) { this.confirm(text, null); },

    /* ---------- attract mode: an all-AI war behind the title ---------- */
    startDemo() {
      if (AS.App.state === 'play' || AS.App.state === 'loading' || AS.App.demo) return;
      try {
        const map = AS.Maps.byId[this.sel.map] || AS.Maps.list[0];
        const g = new AS.Realm(map, { demo: true, faction: 'human', difficulty: 'normal' });
        AS.game = g; g.load(); AS.game = null;
        g.demo = true;
        AS.App.demo = g;
        g.camera.baseZoom = 0.9;
      } catch (e) { console.warn('attract mode failed', e); }
      this.menuMusic();
    },
    menuMusic() { if (AS.Music && AS.Music.play) AS.Music.play({ id: 210, key: 'music:menu', realm: 'human' }); },
    tick(dt) {},

    /* ---------- title ---------- */
    showMenu() {
      const s = this.screens.menu; s.innerHTML = '';
      const P = AS.Save.profile;
      s.appendChild(h('div', { class: 'art' }));
      s.appendChild(h('div', { class: 'hc-banner' }, h('div', { class: 'crown' }, crownSvg()), h('div', null, 'Small kings'), h('div', null, 'Great dragons'), h('div', { class: 'sp' }), h('div', null, 'A messy world')));
      s.appendChild(h('div', { class: 'col-main' },
        logo(),
        h('div', { class: 'subtitle' }, 'Kings are titles. Dragons are power.'),
        h('div', { class: 'buttons' },
          btn('Begin a War', () => this.showSelect(), 'primary', 'Choose your dragon, wizard and realm'),
          AS.BigCampaign && AS.CampaignMenu && AS.Maps.byId.largeworld ? btn('Campaign', () => AS.CampaignMenu.show(), '', 'Win the Wide Realm place by place · real time, saved as you go') : null,
          btn('Atlas of Realms', () => this.showMaps(), '', 'Ten realms to conquer'),
          AS.Maps.generateHuge ? btn('Huge World Test', () => AS.App.startMatch('hugeworld', { faction: 'human' }), '', 'A generated continent ~160 km across, built as you fly · explore it') : null,
          AS.Maps.byId.armytest && AS.ArmyTest ? btn('Army Command Test', () => AS.ArmyTest.start(null), '', 'Independent armies and commanders: orders, a guarded pass, a ground-only tunnel · development test') : null,
          AS.Maps.byId.mountaintest ? btn('Mountain Test', () => AS.App.startMatch('mountaintest', { faction: 'human' }), '', 'One mountain region with real elevation: flight ceiling, passes, gorge, waterfall, dwarf hold · prototype') : null,
          AS.Maps.byId.largeworld ? btn('Large World Test', () => AS.App.startMatch('largeworld', { faction: 'human' }), '', 'A continuous island several kilometres across · technical test') : null,
          AS.Conquest && AS.Conquest.UI ? btn('Conquest', () => AS.Conquest.UI.open(), '', 'A campaign across a new archipelago every time') : null,
          btn('How to Play', () => this.showControls('menu')),
          btn('Options', () => this.showOptions('menu')))));
      // (the buttons stay one line, as on a title; what each does shows on hover)
      for (const b of s.querySelectorAll('.btn')) { const sub = b.querySelector('.sub'); if (sub) b.title = sub.textContent; }
      s.appendChild(h('div', { class: 'foot' }, 'Hollow Crowns · built on the ALIEN STRIKE engine · fonts: Cinzel & Alegreya Sans (OFL)'));
      if (P && P.stats.played) s.appendChild(h('div', { class: 'stat' }, 'Wars won: ' + P.stats.wins + ' of ' + P.stats.played, h('br'), 'Dragons driven off: ' + P.stats.dragonsDowned));
      this.show('menu');
    },

    /* ---------- realm choice ---------- */
    showSelect() {
      const s = this.screens.select; s.innerHTML = '';
      const testAll = AS.Settings.testMode || AS.App.params.get('allRealms') === '1';
      s.appendChild(h('div', { class: 'hc-head' }, h('h2', { class: 'heading' }, 'Choose Your Dragon ', h('small', null, 'and'), ' Wizard'), h('div', { class: 'sub' }, 'Four bonds. Four fates.')));
      const grid = h('div', { class: 'realms' });
      for (const fk of AS.Data.factionOrder) {
        const F = AS.Data.factions[fk], locked = fk !== 'human' && !testAll;
        const card = h('div', { class: 'realm-card hc-' + fk + (this.sel.faction === fk ? ' sel' : '') + (locked ? ' locked' : ''), onclick: () => { if (locked) { AS.Audio.sfx('denied'); return; } this.sel.faction = fk; AS.Audio.sfx('ui_click'); this.showSelect(); } },
          h('div', { class: 'pic', style: 'background-image:url(assets/ui/portrait_' + fk + '.jpg)' },
            h('div', { class: 'pair' }, pairName(F)),
            h('div', { class: 'motto' }, F.motto || ''),
            h('div', { class: 'seals' }, seal(fk, 'breath'), seal(fk, 'bolt'))),
          h('div', { class: 'nm', style: 'color:' + F.color }, F.name),
          h('div', { class: 'who' }, F.dragon.name + ', ' + F.dragon.title + ' · ridden by ' + F.rider.name),
          h('div', { class: 'bl' }, F.blurb),
          this.playStyle(fk),
          locked ? h('span', { class: 'tag lock' }, 'Rival realm') : h('span', { class: 'tag gold lock' }, 'Playable'));
        grid.appendChild(card);
      }
      s.appendChild(grid);
      s.appendChild(h('div', { class: 'row hc-foot' }, btn('Back', () => this.showMenu()), h('div', { class: 'quote' }, '\u201cFour paths. Countless kingdoms. The sky remembers.\u201d'), btn('Choose a Map', () => this.showMaps(), 'primary')));
      this.show('select');
    },

    /* how each dragon plays: a one-line style and pips scaled across the four */
    playStyle(fk) {
      const all = AS.Data.factionOrder.map((k) => AS.Data.factions[k].dragon), D = AS.Data.factions[fk].dragon;
      const B = AS.Data.breaths[D.breath] || {};
      const stats = [
        ['Speed', (d) => d.speed], ['Agility', (d) => d.turn], ['Toughness', (d) => d.hp * (1 + d.armor * 0.12)],
        ['Breath', (d) => (AS.Data.breaths[d.breath] || {}).dps || 1], ['Reach', (d) => (AS.Data.breaths[d.breath] || {}).range || 1], ['Recovery', (d) => 1 / d.recover],
      ];
      const rows = stats.map(([label, f]) => {
        const vs = all.map(f), lo = Math.min(...vs), hi = Math.max(...vs), v = f(D);
        const pips = Math.round(2 + (hi > lo ? (v - lo) / (hi - lo) : 0.5) * 3); // 2..5
        return h('div', { class: 'stat-row' }, h('span', null, label), h('span', { class: 'pips' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= pips ? 'on' : '', style: i <= pips ? 'background:' + AS.Data.factions[fk].color : '' }))));
      });
      return h('div', { class: 'play' },
        h('div', { class: 'style' }, D.style + ' · ' + (B.name || '')),
        h('div', { class: 'stats' }, rows),
        h('div', { class: 'how' }, D.play));
    },

    /* ---------- the atlas ---------- */
    showMaps() {
      const s = this.screens.maps; s.innerHTML = '';
      const P = AS.Save.profile || AS.Save.newProfile();
      s.appendChild(h('h2', { class: 'heading' }, 'Atlas of Realms'));
      const grid = h('div', { class: 'maps-grid' });
      AS.Maps.list.forEach((m, i) => {
        const rec = P.maps[m.id];
        const cv = h('canvas', { width: 220, height: 220 });
        cv.getContext('2d').drawImage(Atlas.draw(m, 220), 0, 0);
        const locked = AS.Campaign && !AS.Campaign.unlocked(m.id);
        grid.appendChild(h('div', { class: 'map-card' + (this.sel.map === m.id ? ' sel' : '') + (locked ? ' locked' : ''), onclick: () => { if (locked) { AS.Audio.sfx('denied'); return; } this.sel.map = m.id; AS.Audio.sfx('ui_click'); this.showMaps(); } },
          cv, h('div', { class: 'num' }, 'REALM ' + (i + 1)), h('div', { class: 'nm' }, m.name),
          h('div', { class: 'dim', style: 'font:500 12px var(--text)' }, locked ? 'Conquer the realm before it to open' : (m.difficulty || 'Standard')),
          rec && rec.won ? h('span', { class: 'tag gold won' }, '✦ Conquered' + (rec.best ? ' · ' + Math.floor(rec.best / 60) + 'm' : '')) : locked ? h('span', { class: 'tag lock' }, 'Locked') : null));
      });
      s.appendChild(grid);
      const m = AS.Maps.byId[this.sel.map] || AS.Maps.list[0];
      const big = h('canvas', { width: 420, height: 420, class: 'big' });
      big.getContext('2d').drawImage(Atlas.draw(m, 420), 0, 0);
      const diff = h('select', null, Object.keys(AS.Data.difficulty).map((k) => h('option', { value: k, selected: (this.sel.difficulty || AS.Settings.difficulty) === k ? 'selected' : null }, AS.Data.difficulty[k].name)));
      diff.onchange = () => { this.sel.difficulty = diff.value; AS.Settings.difficulty = diff.value; AS.Save.saveSettings(); };
      const F = AS.Data.factions[this.sel.faction];
      s.appendChild(h('div', { class: 'map-detail panel' }, big,
        h('div', { class: 'col grow' },
          h('h2', null, m.name),
          h('p', null, m.blurb),
          h('p', { class: 'dim' }, 'You rule ' + F.name + ', riding ' + F.dragon.name + '. ' + m.sites.length + ' sites to contest. Destroy or capture every rival stronghold to win the crown.'),
          h('div', { class: 'legend' }, AS.Data.factionOrder.filter((k) => m.factions[k]).map((k) => h('span', null, h('i', { style: 'background:' + AS.Data.factions[k].color }), AS.Data.factions[k].short + (k === this.sel.faction ? ' (you)' : '')))),
          h('div', { class: 'opt-row', style: 'max-width:420px;margin-top:16px' }, h('span', null, 'Difficulty'), diff),
          h('div', { class: 'row', style: 'margin-top:auto' }, btn('Back', () => this.showSelect()), btn('Begin the War', () => this.begin(), 'primary', m.name)))));
      this.show('maps');
    },
    begin() {
      AS.Audio.init(); AS.Audio.resume();
      AS.App.startMatch(this.sel.map, { faction: this.sel.faction, difficulty: this.sel.difficulty || AS.Settings.difficulty });
    },
    showLoading(m) {
      const s = this.screens.loading; s.innerHTML = '';
      const F = AS.Data.factions[this.sel.faction] || AS.Data.factions.human;
      // (the bar is a compositor animation: it keeps moving while the realm is built on the main thread)
      s.appendChild(h('div', { class: 'blur', style: 'background-image:url(assets/ui/loading_art.jpg)' }));
      s.appendChild(h('div', { class: 'scene', style: 'background-image:url(assets/ui/loading_art.jpg)' }));
      s.appendChild(h('div', { class: 'lower' },
        h('div', { class: 'who' }, h('div', { class: 'face', style: 'background-image:url(assets/ui/portrait_' + F.key + '.jpg)' }),
          h('div', null, h('h2', null, m.name), h('div', { class: 'quote' }, '\u201c' + QUOTES[(Math.random() * QUOTES.length) | 0] + '\u201d'))),
        h('div', { class: 'bar' }, h('i')),
        h('div', { class: 'what' }, 'Preparing the realm\u2026'),
        h('div', { class: 'tip' }, 'Tip: ' + TIPS[(Math.random() * TIPS.length) | 0])));
      this.show('loading');
    },

    /* ---------- pause ---------- */
    showPause() {
      const s = this.screens.pause; s.innerHTML = '';
      const g = AS.game;
      s.appendChild(h('div', { class: 'panel' },
        h('h2', null, 'The War Pauses'),
        h('div', { class: 'dim', style: 'margin-bottom:12px' }, g ? g.map.name + ' · ' + U.fmtTime(g.time) : ''),
        btn('Resume', () => AS.App.resume(), 'primary'),
        btn('How to Play', () => this.showControls('pause')),
        btn('Options', () => this.showOptions('pause')),
        // the campaign saves and returns to the title (it is continued from the Campaign menu)
        g && g.bc ? btn('Save and Return to the Title', () => { AS.BigCampaign.save(g); AS.App.abandon(); }, 'danger') : null,
        g && g.bc ? null :
        // a Conquest battle cannot be restarted or abandoned: the army withdraws instead
        g && g.opts.conquest && AS.Conquest && AS.Conquest.Battle
          ? btn('Retreat to the Campaign Map', () => this.confirm('Withdraw the army? The battle is lost and your losses stand.', () => AS.Conquest.Battle.retreat()), 'danger')
          : btn('Restart this War', () => this.confirm('Restart this war from the beginning?', () => AS.App.restart())),
        g && (g.opts.conquest || g.bc) ? null : btn('Abandon to the Title', () => this.confirm('Abandon this war?', () => AS.App.abandon()), 'danger')));
      this.show('pause');
    },
    back() { if (this.from === 'pause') this.showPause(); else this.showMenu(); },

    /* ---------- options ---------- */
    showOptions(from) {
      this.from = from;
      const S = AS.Settings, s = this.screens.options; s.innerHTML = '';
      const slider = (key, label) => { const i = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[key] }); i.oninput = () => { S[key] = +i.value; AS.Audio.setVolumes(); AS.Save.saveSettings(); }; return h('div', { class: 'opt-row' }, h('span', null, label), i); };
      const select = (key, label, opts, after) => { const e = h('select', null, opts.map(([v, t]) => h('option', { value: v, selected: S[key] === v ? 'selected' : null }, t))); e.onchange = () => { S[key] = e.value; AS.Save.saveSettings(); if (after) after(); }; return h('div', { class: 'opt-row' }, h('span', null, label), e); };
      const check = (key, label) => { const e = h('input', { type: 'checkbox' }); e.checked = !!S[key]; e.onchange = () => { S[key] = e.checked; AS.Save.saveSettings(); }; return h('div', { class: 'opt-row' }, h('span', null, label), e); };
      s.appendChild(h('div', { class: 'panel', style: 'min-width:520px' },
        h('h2', null, 'Options'),
        slider('master', 'Master volume'), slider('music', 'Music'), slider('sfx', 'Sound effects'), slider('voice', 'Taunt voices'),
        check('taunts', 'Wizards and dragons trade insults'), check('subtitles', 'Show what they say'),
        select('controlMode', 'Flight controls', [['keys', 'Keys steer, mouse aims (A/D bank)'], ['mouse', 'Follow the cursor (W/S pace)']]),
        select('difficulty', 'Difficulty', Object.keys(AS.Data.difficulty).map((k) => [k, AS.Data.difficulty[k].name])),
        select('quality', 'Graphics quality', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low (fastest)']], () => { AS.Particles.density = S.quality === 'low' ? 0.5 : S.quality === 'medium' ? 0.8 : 1; AS.Renderer.resize(); }),
        select('view', 'View distance', [['near', 'Near'], ['normal', 'Normal'], ['far', 'Far']], () => AS.Renderer.resize()),
        check('shake', 'Screen shake'), check('flash', 'Screen flashes'),
        h('div', { class: 'row', style: 'margin-top:14px;justify-content:flex-end' }, btn('Back', () => this.back(), 'primary'))));
      this.show('options');
    },
    showControls(from) {
      this.from = from;
      const s = this.screens.controls; s.innerHTML = '';
      const rows = [
        ['W', 'Beat your wings — speed builds with every downstroke'], ['S', 'Flare the wings: brake, turn tighter, hover low — keep flaring near the ground to land (W takes off)'], ['A / D', 'Bank left / right (slow = tight turns, fast = wide sweeps)'],
        ['SPACE (hold)', 'Fly low — with W a fast power dive, with S a slow low glide; release to climb'], ['SPACE ×2', 'Loop the loop — dodges everything mid-loop (short cooldown)'], ['SHIFT', 'Sprint (burns energy)'], ['MOUSE', 'Aim the wizard\'s staff'],
        ['LEFT CLICK', 'Cast magic bolts'], ['DOUBLE-CLICK AN ANIMAL', 'Swoop down, snatch and eat it (any flight key breaks off)'], ['RIGHT CLICK / F', 'Breathe fire where the cursor points — the head turns to aim'], ['E', 'Tap to snatch and eat prey (easy when slow and low) · hold to carry it home · travel an owned waygate'],
        ['1 / 2 / 3', 'Cast the spell in that slot (three slots under the flasks) · Q casts the first'], ['T', 'Hold court in your town — build, recruit, upgrade'], ['G', 'Order your warband: pick a site or rival town on the map'], ['M', 'War map — wheel zooms, drag moves; right-click a place to set your course'], ['MOUSE WHEEL', 'Zoom the view in and out'], ['C', 'Command Mode: drag to select soldiers, click ground to move, click a foe to attack, right-click for more · C again to fly'], ['ESC / P', 'Pause'],
      ];
      s.appendChild(h('div', { class: 'panel', style: 'min-width:640px;max-width:820px' },
        h('h2', null, 'How to Play'),
        h('p', { class: 'dim', style: 'font:500 15px/1.45 var(--text);margin-top:0' }, 'Fly, fight and feed. Seize mines, villages and magic sites — circle low over them once their guardians fall. Gold carts carry your wealth home; spend it at court on walls, towers, troops and upgrades for your dragon and wizard. A rival falls when its stronghold falls: topple its wardstones and drive off its dragon to break the ward first.'),
        h('table', { class: 'keys' }, rows.map(([k, d]) => h('tr', null, h('td', null, k), h('td', null, d)))),
        h('div', { class: 'dim', style: 'margin-top:10px;font:500 13px var(--text)' }, 'Gamepad: left stick flies, right stick aims, RT casts, LT breathes, A dives, B snatches, X court, Y spell, LB sprint.'),
        h('div', { class: 'row', style: 'margin-top:14px;justify-content:flex-end' }, btn('Back', () => this.back(), 'primary'))));
      this.show('controls');
    },

    /* ---------- the end of a war ---------- */
    showResults(res) {
      const s = this.screens.results; s.innerHTML = '';
      const st = res.stats || {};
      const stand = h('div', { class: 'stand' }, h('span', { class: 'h' }, 'Realm'), h('span', { class: 'h' }, 'Sites'), h('span', { class: 'h' }, 'Buildings'), h('span', { class: 'h' }, 'Fate'),
        (res.standings || []).map((r) => [h('span', { style: 'color:' + AS.Data.factions[r.key].color }, r.name), h('span', null, String(r.sites)), h('span', null, String(r.buildings)), h('span', null, r.eliminated ? 'Fallen' : 'Standing')]).flat());
      s.appendChild(h('div', { class: 'panel' },
        h('h1', { class: 'verdict ' + (res.won ? 'won' : 'lost') }, res.won ? 'VICTORY' : 'DEFEAT'),
        h('p', { style: 'text-align:center;font:500 17px var(--text)' }, res.text || ''),
        h('p', { class: 'dim', style: 'text-align:center' }, (res.map ? res.map.name + ' · ' : '') + U.fmtTime(res.time || 0)),
        stand,
        h('p', { class: 'dim' }, 'Gold earned ' + Math.round(st.goldEarned || 0) + ' · sites captured ' + (st.captured || 0) + ' · foes slain ' + (st.kills || 0) + ' · dragons driven off ' + (st.dragonsDowned || 0) + ' · prey eaten ' + (st.eaten || 0)),
        res.unlocked ? h('p', { style: 'text-align:center;font:700 16px var(--title);color:var(--gold)' }, '✦ A new realm opens in the atlas: ' + res.unlocked.name + ' ✦') : null,
        res.bigCampaign ? h('div', { class: 'row', style: 'justify-content:center;margin-top:12px' }, btn('Title', () => { AS.App.endGame(); this.showMenu(); setTimeout(() => this.startDemo(), 100); }, 'primary')) :
        h('div', { class: 'row', style: 'justify-content:center;margin-top:12px' }, res.unlocked ? btn('Onward to ' + res.unlocked.name, () => { this.sel.map = res.unlocked.id; AS.App.endGame(); this.showMaps(); }, 'primary') : null, btn('Fight Again', () => AS.App.restart(), res.unlocked ? '' : 'primary'), btn('Atlas', () => { AS.App.endGame(); this.showMaps(); }), btn('Title', () => { AS.App.endGame(); this.showMenu(); setTimeout(() => this.startDemo(), 100); }))));
      this.show('results');
    },
    confirm(text, yes) {
      const s = this.screens.confirm; s.innerHTML = '';
      const prev = Array.from(Object.keys(this.screens)).find((k) => this.screens[k].classList.contains('show') && k !== 'confirm');
      s.appendChild(h('div', { class: 'panel' }, h('p', { style: 'font:500 17px var(--text)' }, text),
        yes ? h('div', { class: 'row', style: 'justify-content:center' }, btn('Yes', () => { s.classList.remove('show'); yes(); }, 'danger'), btn('No', () => { s.classList.remove('show'); if (prev) this.screens[prev].classList.add('show'); })) : btn('OK', () => { s.classList.remove('show'); this.showMenu(); }, 'primary')));
      this.hideAll(); s.classList.add('show');
    },
  };
  UI.Atlas = Atlas;
  AS.UI = UI;
})(window.AS);
