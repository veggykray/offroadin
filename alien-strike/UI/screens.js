/* ALIEN STRIKE — menus and screens (DOM), plus the animated menu backdrop and
 * the procedural planet renderer used by the menu, mission select and briefing. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return e;
  };
  const btn = (label, fn, cls, sub) => {
    const b = h('button', { class: 'btn ' + (cls || ''), onclick: (e) => { AS.Audio.sfx('ui_click'); fn(e); }, onmouseenter: () => AS.Audio.sfx('ui_hover') }, label);
    if (sub) b.appendChild(h('span', { class: 'sub' }, sub));
    return b;
  };

  /* ---------------- procedural planets ---------------- */
  const Planet = {
    tex: {},
    texture(world) {
      if (this.tex[world.id]) return this.tex[world.id];
      const T = new AS.Terrain(world, { w: 3600, h: 1800, seed: 3, zones: [] });
      const cv = T.buildMap(20);
      const ctx = cv.getContext('2d');
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      this.tex[world.id] = { w: cv.width, h: cv.height, d: data.data };
      return this.tex[world.id];
    },
    render(ctx, world, cx, cy, R, rot) {
      const tx = this.texture(world);
      const img = ctx.createImageData(R * 2 + 8, R * 2 + 8);
      const D = img.data, W = R * 2 + 8;
      const sky = U.C.hex(world.sky[1]);
      const L = [-0.55, -0.45, 0.7];
      for (let y = -R - 4; y < R + 4; y++) for (let x = -R - 4; x < R + 4; x++) {
        const d2 = x * x + y * y, q = ((y + R + 4) * W + (x + R + 4)) * 4;
        const rr = Math.sqrt(d2);
        if (rr > R + 3) continue;
        if (rr > R) { const a = (1 - (rr - R) / 3) * 0.6; D[q] = sky[0]; D[q + 1] = sky[1]; D[q + 2] = sky[2]; D[q + 3] = a * 255; continue; }
        const nx = x / R, ny = y / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lon = Math.atan2(nx, nz) + rot, lat = Math.asin(ny);
        let u = (lon / TAU) % 1; if (u < 0) u += 1;
        const v = lat / Math.PI + 0.5;
        const ti = (Math.min(tx.h - 1, Math.floor(v * tx.h)) * tx.w + Math.floor(u * tx.w)) * 4;
        let lum = Math.max(0.05, nx * L[0] + ny * L[1] + nz * L[2]);
        lum = 0.12 + lum * 1.05;
        const rim = Math.pow(1 - nz, 3) * 0.8;
        D[q] = Math.min(255, tx.d[ti] * lum + sky[0] * rim); D[q + 1] = Math.min(255, tx.d[ti + 1] * lum + sky[1] * rim); D[q + 2] = Math.min(255, tx.d[ti + 2] * lum + sky[2] * rim); D[q + 3] = 255;
      }
      ctx.putImageData(img, Math.round(cx - R - 4), Math.round(cy - R - 4));
    },
    thumb(world, size) {
      const cv = AS.Forge.canvas(size, size);
      this.render(cv.getContext('2d'), world, size / 2, size / 2, size / 2 - 4, world.id * 0.7);
      return cv;
    },
  };
  AS.Planet = Planet;

  /* ---------------- menu backdrop (drawn on the game canvas) ---------------- */
  const Backdrop = {
    buf: null, stars: [], t: 0, world: null, craftT: 0,
    init() {
      this.buf = AS.Forge.canvas(480, 270);
      this.stars = [];
      for (let i = 0; i < 260; i++) this.stars.push({ x: Math.random() * 480, y: Math.random() * 270, b: Math.random(), s: Math.random() < 0.08 ? 2 : 1, tw: Math.random() * 6 });
      this.planetBuf = AS.Forge.canvas(480, 270);
    },
    setWorld(w) { this.world = w; this.lastRot = null; },
    draw(dt) {
      if (!this.buf) this.init();
      this.t += dt;
      const c = this.buf.getContext('2d');
      const w = this.world || AS.Data.worlds[0];
      const grd = c.createLinearGradient(0, 0, 480, 270);
      grd.addColorStop(0, '#03060a'); grd.addColorStop(0.6, '#070d14'); grd.addColorStop(1, U.C.css(w.sky[0], 0));
      c.fillStyle = grd; c.fillRect(0, 0, 480, 270);
      // nebula
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.18; c.drawImage(AS.Forge.glow(w.sky[1], 64), 230, -40, 300, 260);
      c.globalAlpha = 0.1; c.drawImage(AS.Forge.glow('#5a7aff', 64), -60, 120, 280, 200);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      for (const s of this.stars) { c.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(this.t * 0.6 + s.tw)) * s.b; c.fillStyle = '#dfefff'; c.fillRect(Math.round(s.x - this.t * 2 * s.b) % 480 < 0 ? Math.round(s.x - this.t * 2 * s.b) % 480 + 480 : Math.round(s.x - this.t * 2 * s.b) % 480, s.y, s.s, s.s); }
      c.globalAlpha = 1;
      // planet (re-rendered a few times a second)
      const rot = this.t * 0.05;
      if (this.lastRot === null || Math.abs(rot - this.lastRot) > 0.004) {
        const pc = this.planetBuf.getContext('2d'); pc.clearRect(0, 0, 480, 270);
        Planet.render(pc, w, 360, 150, 96, rot); this.lastRot = rot;
      }
      c.drawImage(this.planetBuf, 0, 0);
      // craft flyby
      this.craftT += dt;
      const sh = AS.Forge.sheet('craft:menu', () => AS.Models.craft({ speed: 1, armor: 1 }), 48, 1);
      const k = (this.craftT % 16) / 16;
      const cx = -40 + k * 560, cy = 200 - k * 90 + Math.sin(this.craftT * 1.5) * 4;
      const ang = Math.atan2(-90, 560);
      const fi = AS.Forge.frameIndex(sh, ang);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
      c.drawImage(AS.Forge.glow('#5fe6ff', 32), cx - 30, cy - 12, 24, 24); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(sh.frames[0][fi], Math.round(cx - sh.ax), Math.round(cy - sh.ay - 10));
      // present
      const R = AS.Renderer, ctx = R.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = R.canvas.width, H = R.canvas.height;
      const sc = Math.max(W / 480, H / 270);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, (W - 480 * sc) / 2, (H - 270 * sc) / 2, 480 * sc, 270 * sc);
      ctx.imageSmoothingEnabled = true;
    },
  };

  /* ---------------- screens ---------------- */
  const TIPS = [
    'Fuel drains while you fly and burns hard when you boost. Plan your route through fuel caches.',
    'Destroy power nodes to shut down every turret they feed.',
    'Comm relays call in reinforcements. Silence them early.',
    'Missile batteries need radar to lock at long range. Kill the radar and they go half-blind.',
    'Your passenger bay is limited. Ferry survivors to a landing pad, then go back for more.',
    'Hold the secondary trigger over targets to paint several missile locks, then release.',
    'Shields regenerate after a few seconds without damage. The hull does not — use repair kits, pads and survivor medics.',
    'Out of fuel? The emergency reserve gives you thirty seconds to reach a fuel cell.',
    'Press M for the tactical map. The game pauses while you plan.',
    'Hidden objectives are found by exploring. They pay well.',
    'Scanner upgrades reveal supply caches on the tactical map and burrowed contacts on radar.',
  ];

  const UI = {
    root: null, screens: {}, current: null, tickFn: null,
    boot(showMenu) {
      this.root = $('#ui');
      for (const id of ['menu', 'select', 'briefing', 'hangar', 'options', 'controls', 'pause', 'results', 'loading', 'modal']) {
        const s = h('div', { id, class: 'screen scan' });
        this.root.appendChild(s); this.screens[id] = s;
      }
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !AS.Input.captureHandler) {
          if (this.current === 'options' || this.current === 'controls') this.back();
          else if (this.current === 'pause') AS.App.resume();
          else if (this.current === 'select' || this.current === 'briefing' || this.current === 'hangar') { if (!AS.App.game) this.showMenu(); }
        }
      });
      if (showMenu !== false) this.showMenu();
    },
    hideAll() { for (const k in this.screens) this.screens[k].classList.remove('show'); this.current = null; AS.Renderer.canvas.style.cursor = 'crosshair'; },
    show(id) {
      this.hideAll(); this.screens[id].classList.add('show'); this.current = id;
      AS.Renderer.canvas.style.cursor = 'default';
      const first = this.screens[id].querySelector('.btn:not(:disabled)');
      if (first && id !== 'hangar') setTimeout(() => first.focus({ preventScroll: true }), 30);
    },
    tick(dt) { if (AS.App.state !== 'play') Backdrop.draw(dt); },
    menuMusic() {
      if (AS.Music.playing && AS.Music.world && AS.Music.world.id === 0) return;
      AS.Music.play({ id: 0, music: { root: 45, scale: 'aeolian', tempo: 72, pad: 'choir', lead: 'sine', perc: 'soft' } });
    },

    /* ---------- main menu ---------- */
    showMenu() {
      AS.App.state = 'menu';
      const s = this.screens.menu; s.innerHTML = '';
      const has = AS.Save.hasProfile();
      if (has && !AS.Save.profile) AS.Save.loadProfile();
      const p = AS.Save.profile;
      const next = has ? AS.Levels.byId[AS.Campaign.nextMission()] : null;
      Backdrop.setWorld(next ? AS.Data.worldById(next.world) : AS.Data.worlds[0]);
      this.menuMusic();
      s.appendChild(h('div', null,
        h('h1', { class: 'title' }, 'ALIEN', h('br'), 'STRIKE'),
        h('div', { class: 'subtitle' }, 'VESPER PROTOCOL // FRONTIER RECLAMATION'),
        h('div', { class: 'buttons' },
          btn('Start Campaign', () => this.startCampaign(), 'primary', has ? 'new' : null),
          btn('Continue', () => this.continueCampaign(), '', next ? next.name : 'no campaign saved'),
          btn('Mission Select', () => this.showSelect()),
          btn('Upgrades', () => this.showHangar(), '', has ? 'hangar' : 'start a campaign first'),
          btn('Options', () => this.showOptions('menu')),
          btn('Controls', () => this.showControls('menu')),
        )));
      const buttons = s.querySelectorAll('.btn');
      if (!has) { buttons[1].disabled = true; buttons[3].disabled = true; }
      s.appendChild(h('div', { class: 'foot' }, 'v' + AS.version + ' · keyboard + mouse · gamepad supported · ' + (AS.Save.available ? 'progress saves automatically' : 'storage unavailable — progress will not persist')));
      if (p) s.appendChild(h('div', { class: 'stat' }, 'CAMPAIGN ' + AS.Campaign.progressPct() + '% · SALVAGE ' + p.salvage + ' · TECH ' + p.tech, h('br'), 'KILLS ' + p.stats.kills + ' · RESCUED ' + p.stats.rescued + ' · MISSIONS ' + p.stats.missions));
      this.show('menu');
    },
    startCampaign() {
      const go = () => { AS.Save.newProfile(); this.showIntro(); };
      if (AS.Save.hasProfile()) this.confirm('Start a new campaign? Your current campaign progress, upgrades and salvage will be erased. Settings are kept.', go);
      else go();
    },
    continueCampaign() {
      if (!AS.Save.profile) AS.Save.loadProfile();
      this.showHangar();
    },
    showIntro() {
      const s = this.screens.briefing; s.innerHTML = '';
      const text = [
        'Ninety years ago the survey ship Halcyon followed a dead signal through the Veil and found ten worlds wrapped around one ancient star.',
        'Every world was built — or broken — by the same intelligence. We call it the Choir: a dominion of living machines that has been asleep for longer than humanity has existed.',
        'The frontier colonies woke it.',
        'You fly the Vesper: a salvaged Choir drive core bolted into a scavenger gunship. Limited fuel. Limited ammunition. No cavalry. Rescue who you can. Recover what you can. Burn the rest.',
        'Your first sortie is Ashen Vale, where the Kessler survey team went silent.',
      ];
      const box = h('div', { class: 'panel', style: 'max-width:760px;margin:auto' }, h('div', { class: 'planet' }, 'FRONTIER RECLAMATION COMMAND — HALCYON'), h('h2', null, 'THE VEIL'));
      text.forEach((t) => box.appendChild(h('p', null, t)));
      box.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, btn('Proceed to briefing', () => this.showBriefing(AS.Campaign.nextMission()), 'primary'), btn('Hangar', () => this.showHangar())));
      s.appendChild(box);
      this.show('briefing');
    },

    /* ---------- mission select ---------- */
    showSelect(worldId) {
      AS.App.state = 'menu';
      if (!AS.Save.profile) AS.Save.loadProfile() || AS.Save.newProfile();
      const s = this.screens.select; s.innerHTML = '';
      const cur = worldId || (AS.Levels.byId[AS.Campaign.nextMission()] || {}).world || 1;
      Backdrop.setWorld(AS.Data.worldById(cur));
      s.appendChild(h('div', { class: 'row', style: 'align-items:baseline;justify-content:space-between' }, h('div', null, h('div', { class: 'planet mono', style: 'color:var(--amber);letter-spacing:4px' }, 'CAMPAIGN — ' + AS.Campaign.progressPct() + '% COMPLETE'), h('h2', { style: 'margin:4px 0;font:900 30px Orbitron;letter-spacing:3px' }, 'MISSION SELECT')), h('div', null, btn('Hangar', () => this.showHangar(), 'small'), ' ', btn('Main Menu', () => this.showMenu(), 'small'))));
      const grid = h('div', { class: 'worlds' });
      for (const w of AS.Data.worlds) {
        const ms = AS.Levels.worldMissions(w.id);
        const unlocked = AS.Campaign.worldUnlocked(w.id);
        const done = ms.filter((m) => AS.Campaign.isDone(m.id)).length;
        const card = h('div', { class: 'world-card' + (unlocked ? '' : ' locked') + (w.id === cur ? ' sel' : ''), onclick: () => { if (unlocked) { AS.Audio.sfx('ui_click'); this.showSelect(w.id); } else AS.Audio.sfx('denied'); } });
        card.appendChild(Planet.thumb(w, 64));
        card.appendChild(h('div', { class: 'num' }, 'WORLD ' + String(w.id).padStart(2, '0')));
        card.appendChild(h('div', { class: 'nm' }, unlocked ? w.name : '??????'));
        card.appendChild(h('div', { class: 'reg' }, unlocked ? w.region : 'Signal not yet traced'));
        card.appendChild(h('div', { class: 'prog' }, unlocked ? done + '/' + ms.length + ' cleared' : 'LOCKED'));
        grid.appendChild(card);
      }
      s.appendChild(grid);
      const w = AS.Data.worldById(cur);
      const det = h('div', { class: 'detail' });
      det.appendChild(h('div', { class: 'panel', style: 'flex:1' }, h('h2', null, w.name), h('div', { class: 'mono dim' }, w.region), h('p', { style: 'line-height:1.55' }, w.blurb), h('h3', null, 'KNOWN THREATS'), h('p', { class: 'dim' }, w.threat), h('h3', null, 'WORLD CONDITIONS'), h('p', { class: 'dim' }, this.mechText(w))));
      const list = h('div', { class: 'panel', style: 'flex:1.3' }, h('h2', null, 'OPERATIONS'));
      AS.Levels.worldMissions(w.id).forEach((m) => {
        const un = AS.Campaign.isUnlocked(m.id), dn = AS.Campaign.isDone(m.id);
        const rec = AS.Save.profile.missions[m.id];
        const row = h('div', { class: 'mission-row' + (un ? '' : ' locked'), onclick: () => { if (un) { AS.Audio.sfx('ui_click'); this.showBriefing(m.id); } else AS.Audio.sfx('denied'); } },
          h('div', { class: 'idx' }, m.index),
          h('div', { class: 'grow' }, h('div', { class: 'mn' }, un ? m.name : 'CLASSIFIED'), h('div', { class: 'md' }, un ? (m.briefing.tagline || m.region) : 'Complete the previous operation to unlock.')),
          dn ? h('span', { class: 'tag green' }, 'CLEARED ' + U.fmtTime(rec.best || 0)) : un ? h('span', { class: 'tag amber' }, 'AVAILABLE') : h('span', { class: 'tag' }, 'LOCKED'),
          m.boss ? h('span', { class: 'tag red' }, 'MAJOR THREAT') : null);
        list.appendChild(row);
      });
      det.appendChild(list);
      s.appendChild(det);
      this.show('select');
    },
    mechText(w) {
      const M = { sandstorm: 'Periodic sandstorms reduce scanner and visual range.', spores: 'Caustic spore clouds strip shields and corrode the hull.', whiteout: 'Whiteout storms blind scanners.', fractures: 'Unstable ice fractures erupt beneath you.', submerged: 'Some targets lie under water and must be scanned before they can be attacked.', eruptions: 'Lava eruptions without warning.', heat: 'Heat zones burn shields and fuel.', lowgrav: 'Low gravity: the craft drifts further.', sporecontrol: 'Spores scramble flight controls on contact.', wind: 'Violent wind currents push the craft off course.', lightning: 'Lightning strikes across the cloud decks.', power: 'Power networks can be rerouted to disable whole sectors.', allies: 'Allied forces fight alongside you.' };
      return w.mechanics.length ? w.mechanics.map((k) => M[k]).join(' ') : 'Stable conditions. Dry winds, good visibility.';
    },

    /* ---------- briefing ---------- */
    showBriefing(id) {
      const m = AS.Levels.byId[id];
      if (!m) return;
      AS.App.state = 'menu';
      if (!AS.Save.profile) AS.Save.loadProfile() || AS.Save.newProfile();
      const w = AS.Data.worldById(m.world);
      Backdrop.setWorld(w);
      const s = this.screens.briefing; s.innerHTML = '';
      const b = m.briefing;
      const left = h('div', { class: 'left' });
      const head = h('div', { class: 'panel' },
        h('div', { class: 'planet' }, 'WORLD ' + String(w.id).padStart(2, '0') + ' — ' + w.name + ' · ' + m.region.toUpperCase()),
        h('div', { class: 'mname' }, 'OPERATION ' + m.name),
        h('div', { class: 'danger mono dim', style: 'margin-top:6px' }, 'ESTIMATED DANGER  ', ...[1, 2, 3, 4, 5].map((i) => h('span', { class: i <= (b.danger || 1) ? 'on' : '' }))));
      left.appendChild(head);
      const sit = h('p', { class: 'typing' });
      left.appendChild(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'SITUATION'), sit));
      const prim = (m.objectives || []).filter((o) => o.cat !== 'secondary' && o.cat !== 'hidden' && !o.locked);
      const sec = (m.objectives || []).filter((o) => o.cat === 'secondary' && !o.locked);
      const hid = (m.objectives || []).filter((o) => o.cat === 'hidden').length;
      const obj = h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'PRIMARY OBJECTIVES'), h('ul', null, prim.map((o) => h('li', null, o.short || o.text))));
      if (m.objectives.some((o) => o.locked && o.cat !== 'secondary' && o.cat !== 'hidden')) obj.appendChild(h('div', { class: 'dim mono' }, '+ further objectives may be assigned in the field'));
      if (sec.length) { obj.appendChild(h('h3', null, 'SECONDARY (OPTIONAL)')); obj.appendChild(h('ul', null, sec.map((o) => h('li', null, (o.short || o.text) + (o.reward ? '  [+' + o.reward + ']' : ''))))); }
      if (hid) obj.appendChild(h('div', { class: 'dim mono' }, '★ ' + hid + ' hidden objective' + (hid > 1 ? 's' : '') + ' — discovered through exploration'));
      left.appendChild(obj);
      const right = h('div', { class: 'right' });
      const mapc = h('canvas', { class: 'mapprev', width: 220, height: 220 });
      right.appendChild(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'AREA OF OPERATIONS'), mapc));
      right.appendChild(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'KNOWN THREATS'), h('ul', null, (b.threats || []).map((t) => h('li', null, t))), (b.intel && b.intel.length) ? h('h3', null, 'INTELLIGENCE') : null, (b.intel && b.intel.length) ? h('ul', null, b.intel.map((t) => h('li', { class: 'dim' }, t))) : null));
      const P = AS.Save.profile, W = AS.Data.weapons;
      right.appendChild(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'LOADOUT'), h('div', { class: 'mono' }, W[P.loadout.primary].name + ' · ' + W[P.loadout.secondary].name + ' · ' + W[P.loadout.special].name), h('div', { class: 'mono dim', style: 'margin-top:4px' }, 'Repair kits: ' + P.repairKits),
        h('div', { class: 'row', style: 'margin-top:14px;flex-wrap:wrap' }, btn('Launch', () => { AS.Voice.stop(); AS.App.startMission(m.id); }, 'primary'), btn('Hangar', () => { AS.Voice.stop(); this.showHangar(m.id); }), btn('Back', () => { AS.Voice.stop(); this.showSelect(m.world); }))));
      s.appendChild(left); s.appendChild(right);
      this.show('briefing');
      // typewriter
      const full = b.situation;
      let i = 0;
      clearInterval(this.typeT);
      this.typeT = setInterval(() => { i += 3; sit.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(this.typeT); sit.classList.remove('typing'); } }, 16);
      setTimeout(() => { if (this.current === 'briefing') AS.Voice.say('brief_' + m.id); }, 400);
      // map preview
      setTimeout(() => this.drawMapPreview(mapc, m), 30);
    },
    drawMapPreview(cv, m) {
      const w = AS.Data.worldById(m.world);
      const T = new AS.Terrain(w, m.map);
      const sc = Math.max(m.map.w, m.map.h) / 220;
      const img = T.buildMap(sc);
      const c = cv.getContext('2d');
      c.fillStyle = '#000'; c.fillRect(0, 0, 220, 220);
      c.globalAlpha = 0.85; c.drawImage(img, 0, 0); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(127,232,255,0.15)';
      for (let x = 0; x < 220; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 220); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(220, x); c.stroke(); }
      const dot = (x, y, col, r, lbl) => { c.strokeStyle = col; c.fillStyle = col; c.beginPath(); c.arc(x / sc, y / sc, r, 0, TAU); c.stroke(); if (lbl) { c.font = '9px "Share Tech Mono"'; c.fillText(lbl, x / sc + r + 2, y / sc + 3); } };
      dot(m.extraction.x, m.extraction.y, '#7dff9a', 5, 'LZ');
      dot(m.start.x, m.start.y, '#ffffff', 2);
      for (const mk of (m.briefing.marks || [])) dot(mk.x, mk.y, mk.col || '#ffc35a', mk.r || 6, mk.label);
    },

    /* ---------- hangar (UI/hangar.js) ---------- */
    showHangar(missionId) { AS.Hangar.show(this.screens.hangar, missionId); this.show('hangar'); AS.App.state = 'menu'; },

    /* ---------- options ---------- */
    showOptions(from) {
      this.backTo = from || this.backTo || 'menu';
      const S = AS.Settings;
      const s = this.screens.options; s.innerHTML = '';
      const slider = (key, label) => {
        const val = h('span', { class: 'val' }, Math.round(S[key] * 100) + '%');
        const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(S[key] * 100), oninput: (e) => { S[key] = e.target.value / 100; val.textContent = e.target.value + '%'; AS.Audio.setVolumes(); AS.Save.saveSettings(); }, onchange: () => AS.Audio.sfx(key === 'voice' ? 'radio_on' : 'pickup') });
        return h('div', { class: 'opt-row' }, h('label', null, label), inp, val);
      };
      const seg = (key, label, opts, after) => {
        const box = h('div', { class: 'seg' });
        for (const [v, t] of opts) box.appendChild(h('button', { class: S[key] === v ? 'on' : '', onclick: () => { S[key] = v; AS.Save.saveSettings(); AS.Audio.sfx('ui_click'); if (after) after(v); this.showOptions(); } }, t));
        return h('div', { class: 'opt-row' }, h('label', null, label), box, h('span'));
      };
      const panel = h('div', { class: 'panel', style: 'width:min(720px,94vw)' }, h('h2', null, 'OPTIONS'),
        h('h3', null, 'AUDIO'), slider('master', 'Master volume'), slider('music', 'Music volume'), slider('sfx', 'Effects volume'), slider('voice', 'Voice volume'),
        h('h3', null, 'VIDEO'),
        seg('quality', 'Graphics quality', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], (v) => { AS.Particles.density = v === 'low' ? 0.5 : v === 'medium' ? 0.8 : 1; }),
        seg('view', 'View distance', [['near', 'NEAR'], [undefined, 'NORMAL'], ['far', 'FAR']], () => { AS.Renderer.resize(); }),
        seg('shake', 'Screen shake', [[true, 'ON'], [false, 'OFF']]),
        seg('flash', 'Screen flashes', [[true, 'ON'], [false, 'OFF']]),
        seg('subtitles', 'Subtitles', [[true, 'ON'], [false, 'OFF']]),
        h('div', { class: 'opt-row' }, h('label', null, 'Fullscreen'), h('div', null, btn(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); setTimeout(() => this.showOptions(), 300); }, 'small')), h('span')),
        h('h3', null, 'CONTROLS'),
        seg('controlMode', 'Control mode', [['tactical', 'TACTICAL'], ['assault', 'ASSAULT']]),
        h('div', { class: 'dim mono', style: 'font-size:12px;margin:-4px 0 10px' }, S.controlMode === 'tactical' ? 'TACTICAL: W/S thrust, A/D rotate the craft, Q/F strafe. Mouse aims the weapon pods independently.' : 'ASSAULT: W/S thrust, A/D strafe, the nose follows the mouse cursor.'),
        h('div', { class: 'row', style: 'margin-top:12px;flex-wrap:wrap' }, btn('Key bindings', () => this.showControls('options')), btn('Back', () => this.back(), 'primary'), this.backTo === 'menu' ? btn('Erase campaign', () => this.confirm('Erase all campaign progress? This cannot be undone.', () => { AS.Save.deleteProfile(); this.showMenu(); }), 'danger small') : null));
      s.appendChild(panel);
      this.show('options');
    },
    back() {
      const t = this.backTo || 'menu';
      if (t === 'pause') this.showPause();
      else if (t === 'options') this.showOptions(this.prevBack || 'menu');
      else if (t === 'hangar') this.showHangar();
      else this.showMenu();
    },

    /* ---------- controls ---------- */
    showControls(from) {
      if (from && from !== 'options') this.backTo = from;
      if (from === 'options') { this.prevBack = this.backTo; this.backTo = 'options'; }
      const s = this.screens.controls; s.innerHTML = '';
      const I = AS.Input;
      const panel = h('div', { class: 'panel', style: 'width:min(820px,95vw);max-height:92vh;overflow:auto' }, h('h2', null, 'CONTROLS'));
      panel.appendChild(h('div', { class: 'row', style: 'gap:30px;flex-wrap:wrap' },
        h('div', { class: 'grow' }, h('h3', null, 'MOUSE'), h('div', { class: 'mono' }, 'Aim ............ move the mouse'), h('div', { class: 'mono' }, 'Primary fire ... left button (hold)'), h('div', { class: 'mono' }, 'Missiles ....... right button: hold to lock, release to fire')),
        h('div', { class: 'grow' }, h('h3', null, 'GAMEPAD'), h('div', { class: 'mono dim' }, 'Left stick: fly · Right stick: aim · RT/LT: primary/secondary · RB: special · A: interact · X: objectives · Y: repair · Back: map · Start: pause'))));
      panel.appendChild(h('h3', null, 'KEYBOARD — click a key to rebind (Esc cancels)'));
      for (const a in I.DEFAULT_BINDINGS) {
        const keys = I.bindings[a] || [];
        const mk = (slot) => {
          const b = h('button', { onclick: () => {
            b.textContent = 'press a key…'; b.classList.add('wait');
            I.captureHandler = (code) => {
              I.captureHandler = null;
              if (code !== 'Escape') {
                for (const k in I.bindings) I.bindings[k] = I.bindings[k].filter((c) => c !== code);
                I.bindings[a][slot] = code; I.bindings[a] = I.bindings[a].filter(Boolean);
                AS.Settings.bindings = I.bindings; AS.Save.saveSettings();
              }
              this.showControls();
            };
          } }, I.keyName(keys[slot]) || '—');
          return b;
        };
        panel.appendChild(h('div', { class: 'bind-row' }, h('span', null, I.ACTION_LABELS[a] || a), mk(0), mk(1)));
      }
      panel.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, btn('Reset defaults', () => { I.setBindings(null); AS.Settings.bindings = null; AS.Save.saveSettings(); this.showControls(); }, 'small'), btn('Back', () => this.back(), 'primary')));
      s.appendChild(panel);
      this.show('controls');
    },

    /* ---------- pause ---------- */
    showPause() {
      this.backTo = 'pause';
      const s = this.screens.pause; s.innerHTML = '';
      const g = AS.App.game;
      s.appendChild(h('div', { class: 'panel', style: 'width:380px' }, h('h2', null, 'PAUSED'), h('div', { class: 'mono dim', style: 'margin-bottom:12px' }, g ? g.mission.name + ' · T+' + U.fmtTime(g.time) : ''),
        h('div', { class: 'col' },
          btn('Resume', () => AS.App.resume(), 'primary'),
          btn('Restart mission', () => this.confirm('Restart this mission? Progress in this sortie will be lost.', () => AS.App.restart())),
          btn('Options', () => this.showOptions('pause')),
          btn('Controls', () => this.showControls('pause')),
          btn('Abort to hangar', () => this.confirm('Abort the mission and return to the hangar? Nothing from this sortie is kept.', () => { AS.Campaign.profile().repairKits = Math.min(AS.Campaign.profile().repairKits, g ? g.player.kits : 99); AS.Save.saveProfile(); AS.App.abandon(false); })),
          btn('Main menu', () => this.confirm('Quit to the main menu? Nothing from this sortie is kept.', () => AS.App.abandon(true))))));
      this.show('pause');
    },

    /* ---------- results ---------- */
    showResults(res, rw) {
      const s = this.screens.results; s.innerHTML = '';
      const m = res.mission, st = res.stats;
      const ok = res.success;
      const objs = h('div', { class: 'obj-list' });
      for (const o of res.objectives) {
        if (o.cat === 'hidden' && o.state !== 'done') continue;
        const tag = o.cat === 'primary' ? '◆' : o.cat === 'hidden' ? '★' : '◇';
        objs.appendChild(h('div', { class: o.state === 'done' ? 'done' : o.state === 'failed' ? 'failed' : 'open' }, (o.state === 'done' ? '✔ ' : o.state === 'failed' ? '✖ ' : '○ ') + tag + ' ' + o.text));
      }
      const opt = res.objectives.filter((o) => o.cat !== 'primary');
      const optDone = opt.filter((o) => o.state === 'done').length;
      const grid = h('div', { class: 'res-grid' },
        h('div', null, 'Optional objectives', h('b', null, optDone + ' / ' + opt.filter((o) => o.cat === 'secondary').length + (res.objectives.some((o) => o.cat === 'hidden' && o.state === 'done') ? ' (+hidden)' : ''))),
        h('div', null, 'Enemies destroyed', h('b', null, st.kills + st.structures)),
        h('div', null, 'Survivors rescued', h('b', null, st.rescued + (st.lost ? ' (' + st.lost + ' lost)' : ''))),
        h('div', null, 'Salvage collected', h('b', null, st.salvage + st.bonusSalvage)),
        h('div', null, 'Fuel remaining', h('b', null, Math.round(res.fuelPct * 100) + '%')),
        h('div', null, 'Damage sustained', h('b', null, Math.round(res.damage))),
        h('div', null, 'Mission time', h('b', null, U.fmtTime(res.time))),
        h('div', null, 'Missiles shot down', h('b', null, st.missilesDowned)));
      const rewards = h('div', null);
      if (rw) {
        rewards.appendChild(h('h3', null, ok ? 'REWARDS' : 'RECOVERED'));
        for (const [k, v] of rw.lines) rewards.appendChild(h('div', { class: 'mono', style: 'display:flex;justify-content:space-between;max-width:420px' }, h('span', { class: 'dim' }, k), h('span', { style: 'color:#e8c24a' }, '+' + v)));
        rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'TOTAL ', h('span', { style: 'color:#e8c24a' }, '+' + rw.salvage + ' SALVAGE'), '   ', h('span', { style: 'color:var(--violet)' }, '+' + rw.tech + ' TECH')));
        if (rw.unlocks.length) rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:8px;color:var(--amber)' }, 'BLUEPRINT RECOVERED: ' + rw.unlocks.map((w) => AS.Data.weapons[w].name).join(', ') + ' — fabricate it in the hangar.'));
        if (rw.newMission) { const nm = AS.Levels.byId[rw.newMission]; const nw = AS.Data.worldById(nm.world); rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:6px;color:var(--cyan)' }, (nm.world !== m.world ? 'NEW WORLD UNLOCKED: ' + nw.name + ' — ' : 'NEXT OPERATION: ') + nm.name)); }
      }
      const buttons = ok
        ? h('div', { class: 'row', style: 'margin-top:18px;flex-wrap:wrap' }, btn('Continue to hangar', () => { AS.App.endGame(); this.showHangar(); }, 'primary'), btn('Replay mission', () => AS.App.restart()), btn('Mission select', () => { AS.App.endGame(); this.showSelect(m.world); }))
        : h('div', { class: 'row', style: 'margin-top:18px;flex-wrap:wrap' }, btn('Retry', () => AS.App.restart(), 'primary'), btn('Return to hangar', () => { AS.App.endGame(); this.showHangar(); }), btn('Main menu', () => { AS.App.endGame(); this.showMenu(); }));
      s.appendChild(h('div', { class: 'panel', style: 'width:min(860px,95vw);max-height:94vh;overflow:auto' },
        h('div', { class: 'planet mono', style: 'color:var(--amber);letter-spacing:4px' }, AS.Data.worldById(m.world).name + ' · OPERATION ' + m.name),
        h('div', { class: 'big ' + (ok ? 'ok' : 'fail') }, ok ? 'MISSION SUCCESS' : 'MISSION FAILED'),
        !ok ? h('div', { class: 'mono', style: 'color:var(--red)' }, res.reason) : null,
        h('h3', null, 'OBJECTIVES'), objs, grid, rewards, buttons));
      this.show('results');
    },

    showLoading(m) {
      const s = this.screens.loading; s.innerHTML = '';
      const w = AS.Data.worldById(m.world);
      s.appendChild(h('div', { class: 'ld' }, h('div', { class: 'mono', style: 'color:var(--amber);letter-spacing:5px' }, w.name + ' — ' + m.region.toUpperCase()), h('div', { class: 't' }, 'OPERATION ' + m.name), h('div', { class: 'bar' }, h('i')), h('div', { class: 'tip' }, 'TIP: ' + U.pick(TIPS))));
      this.show('loading');
    },
    confirm(text, yes) {
      const s = this.screens.modal; s.innerHTML = '';
      const prev = this.current;
      s.appendChild(h('div', { class: 'panel', style: 'width:min(520px,92vw)' }, h('h2', null, 'CONFIRM'), h('p', null, text), h('div', { class: 'row' }, btn('Confirm', () => { s.classList.remove('show'); yes(); }, 'danger'), btn('Cancel', () => { s.classList.remove('show'); if (prev) this.show(prev); }))));
      s.classList.add('show');
    },
    error(text) {
      const s = this.screens.modal; s.innerHTML = '';
      s.appendChild(h('div', { class: 'panel', style: 'width:min(520px,92vw)' }, h('h2', null, 'ERROR'), h('p', null, text), btn('Main menu', () => { s.classList.remove('show'); this.showMenu(); })));
      s.classList.add('show');
    },
  };
  UI.h = h; UI.btn = btn;
  AS.UI = UI;
})(window.AS);
