/* ALIEN STRIKE — in-flight HUD, drawn at native resolution over the world.
 * A light tactical projection: the world owns the screen. Permanent elements are
 * small and panel-free — craft status (top-left), the current objective (top-right,
 * TAB expands the full list), radar (bottom-left), weapons and bay counters
 * (bottom-right). Everything else is contextual: lock rings sit on the target,
 * prompts sit next to the thing you can use, warnings appear only while they apply
 * and control hints fade out once the player has used each control. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const F = (px, w) => (w || '600') + ' ' + px + 'px "Chakra Petch", "Share Tech Mono", monospace';
  const M = (px) => px + 'px "Share Tech Mono", monospace';
  const COL = {
    cyan: '#7fe8ff', amber: '#ffc35a', red: '#ff5a3a', green: '#7dff9a', dim: 'rgba(190,228,240,0.55)', faint: 'rgba(190,228,240,0.28)',
    panel: 'rgba(6,12,18,0.5)', line: 'rgba(127,232,255,0.45)', white: '#eef7fa', violet: '#c58aff', hull: '#8dffb0', shield: '#7cc6ff', fuel: '#ffbf5a',
  };

  /* ---------- drawing helpers ---------- */
  // generic canvas helpers shared with other games on this engine (UI/kit.js)
  const { rrect, wash, textShadow, bar, glyph, keyText, fmtDist, fitText } = AS.UIKit;
  function panel(ctx, x, y, w, h, cut) {
    cut = cut || 8;
    ctx.beginPath();
    ctx.moveTo(x + cut, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + cut); ctx.closePath();
    ctx.fillStyle = 'rgba(6,12,18,0.7)'; ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.stroke();
  }

  /* ---------- vector icons (centred at x, y; s = size) ---------- */
  const ICON = {
    hull(c, x, y, s) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; c.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); } c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.6); c.fillRect(x - s * 0.3, y - s * 0.06, s * 0.6, s * 0.12); },
    shield(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.52); c.quadraticCurveTo(x + s * 0.2, y - s * 0.36, x + s * 0.44, y - s * 0.38); c.quadraticCurveTo(x + s * 0.46, y + s * 0.2, x, y + s * 0.54); c.quadraticCurveTo(x - s * 0.46, y + s * 0.2, x - s * 0.44, y - s * 0.38); c.quadraticCurveTo(x - s * 0.2, y - s * 0.36, x, y - s * 0.52); c.closePath(); c.fill(); },
    fuel(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.55); c.bezierCurveTo(x + s * 0.12, y - s * 0.3, x + s * 0.42, y - s * 0.05, x + s * 0.4, y + s * 0.18); c.arc(x, y + s * 0.16, s * 0.4, 0, Math.PI); c.bezierCurveTo(x - s * 0.42, y - s * 0.05, x - s * 0.12, y - s * 0.3, x, y - s * 0.55); c.closePath(); c.fill(); },
    kit(c, x, y, s) { rrect(c, x - s * 0.45, y - s * 0.4, s * 0.9, s * 0.8, s * 0.15); c.fill(); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x - s * 0.08, y - s * 0.28, s * 0.16, s * 0.56); c.fillRect(x - s * 0.28, y - s * 0.08, s * 0.56, s * 0.16); },
    cargo(c, x, y, s) { c.fillRect(x - s * 0.42, y - s * 0.32, s * 0.84, s * 0.68); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - s * 0.42, y - s * 0.06, s * 0.84, s * 0.1); c.fillRect(x - s * 0.06, y - s * 0.32, s * 0.12, s * 0.68); },
    person(c, x, y, s) { c.beginPath(); c.arc(x, y - s * 0.3, s * 0.18, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - s * 0.3, y + s * 0.48); c.quadraticCurveTo(x - s * 0.3, y - s * 0.08, x, y - s * 0.08); c.quadraticCurveTo(x + s * 0.3, y - s * 0.08, x + s * 0.3, y + s * 0.48); c.closePath(); c.fill(); },
    salvage(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.45); c.lineTo(x + s * 0.4, y); c.lineTo(x, y + s * 0.45); c.lineTo(x - s * 0.4, y); c.closePath(); c.fill(); },
    // weapons
    pulse(c, x, y, s) { for (let i = -1; i <= 1; i++) { rrect(c, x - s * 0.45 + Math.abs(i) * s * 0.12, y + i * s * 0.3 - s * 0.07, s * 0.8, s * 0.14, s * 0.07); c.fill(); } },
    apc(c, x, y, s) { c.beginPath(); c.moveTo(x + s * 0.5, y); c.lineTo(x + s * 0.18, y - s * 0.2); c.lineTo(x - s * 0.45, y - s * 0.2); c.lineTo(x - s * 0.45, y + s * 0.2); c.lineTo(x + s * 0.18, y + s * 0.2); c.closePath(); c.fill(); },
    beam(c, x, y, s) { c.fillRect(x - s * 0.5, y - s * 0.07, s, s * 0.14); c.beginPath(); c.arc(x - s * 0.38, y, s * 0.18, 0, TAU); c.fill(); },
    rail(c, x, y, s) { c.fillRect(x - s * 0.5, y - s * 0.05, s, s * 0.1); for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x - s * 0.25 + i * s * 0.25, y, s * 0.05, s * 0.22, 0, 0, TAU); c.fill(); } },
    arc(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.5, y - s * 0.2); c.lineTo(x - s * 0.1, y + s * 0.1); c.lineTo(x + s * 0.02, y - s * 0.16); c.lineTo(x + s * 0.5, y + s * 0.22); c.lineTo(x + s * 0.04, y + s * 0.04); c.lineTo(x - s * 0.08, y + s * 0.3); c.closePath(); c.fill(); },
    missile(c, x, y, s) { c.beginPath(); c.moveTo(x + s * 0.55, y); c.lineTo(x + s * 0.3, y - s * 0.12); c.lineTo(x - s * 0.3, y - s * 0.12); c.lineTo(x - s * 0.48, y - s * 0.3); c.lineTo(x - s * 0.48, y + s * 0.3); c.lineTo(x - s * 0.3, y + s * 0.12); c.lineTo(x + s * 0.3, y + s * 0.12); c.closePath(); c.fill(); },
    swarm(c, x, y, s) { for (const [dx, dy] of [[0.1, -0.28], [-0.12, 0], [0.1, 0.28]]) { c.beginPath(); c.moveTo(x + (dx + 0.32) * s, y + dy * s); c.lineTo(x + (dx - 0.26) * s, y + (dy - 0.08) * s); c.lineTo(x + (dx - 0.26) * s, y + (dy + 0.08) * s); c.closePath(); c.fill(); } },
    emp(c, x, y, s) { c.lineWidth = s * 0.1; c.beginPath(); c.arc(x, y, s * 0.4, 0, TAU); c.stroke(); ICON.arc(c, x, y, s * 0.6); },
    plasma(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.26, 0, TAU); c.fill(); c.lineWidth = s * 0.08; c.beginPath(); c.ellipse(x, y, s * 0.5, s * 0.2, -0.5, 0, TAU); c.stroke(); },
    gravitic(c, x, y, s) { c.lineWidth = s * 0.1; c.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU * 1.6, r = s * 0.05 + i / 30 * s * 0.45; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke(); },
    mines(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.24, 0, TAU); c.fill(); c.lineWidth = s * 0.09; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.moveTo(x + Math.cos(a) * s * 0.26, y + Math.sin(a) * s * 0.26); c.lineTo(x + Math.cos(a) * s * 0.46, y + Math.sin(a) * s * 0.46); } c.stroke(); },
    drones(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.16, 0, TAU); c.fill(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36, s * 0.13, 0, TAU); c.fill(); } },
    orbital(c, x, y, s) { c.lineWidth = s * 0.09; c.beginPath(); c.arc(x, y, s * 0.36, 0, TAU); c.moveTo(x - s * 0.5, y); c.lineTo(x + s * 0.5, y); c.moveTo(x, y - s * 0.5); c.lineTo(x, y + s * 0.5); c.stroke(); c.beginPath(); c.arc(x, y, s * 0.1, 0, TAU); c.fill(); },
    disruptor(c, x, y, s) { c.lineWidth = s * 0.09; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(x - s * 0.3, y, s * 0.18 * i, -0.7, 0.7); c.stroke(); } },
    bloom(c, x, y, s) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.22, y + Math.sin(a) * s * 0.22, s * 0.2, s * 0.11, a, 0, TAU); c.fill(); } },
  };
  function icon(ctx, kind, x, y, s, col) {
    const f = ICON[kind] || ICON.pulse;
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; f(ctx, x, y, s); ctx.restore();
  }

  /* ---------- objective categories: one colour + glyph per category, used everywhere
   * (objective card, TAB list, world markers, destination arrow, radar, hover labels) ---------- */
  const CAT = {
    primary: { col: '#ffbf47', rgb: '255,191,71', name: 'PRIMARY', glyph: 'dia' },
    secondary: { col: '#7fe8ff', rgb: '127,232,255', name: 'OPTIONAL', glyph: 'odia' },
    hidden: { col: '#ffe27a', rgb: '255,226,122', name: 'HIDDEN', glyph: 'star' },
    extract: { col: '#7dff9a', rgb: '125,255,154', name: 'EXTRACTION', glyph: 'lz' },
    dropoff: { col: '#7dff9a', rgb: '125,255,154', name: 'DROP-OFF', glyph: 'lz' },
    place: { col: '#9ff6ff', rgb: '159,246,255', name: 'CARGO', glyph: 'odia' },
  };
  const catOf = (k) => CAT[k] || CAT.secondary;

  // dark glass card with a thin rim and an optional category accent bar on the left
  function glass(ctx, x, y, w, h, r, accent, glow) {
    const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(10,18,26,0.84)'); gr.addColorStop(1, 'rgba(5,10,16,0.78)');
    rrect(ctx, x, y, w, h, r); ctx.fillStyle = gr; ctx.fill();
    if (glow > 0.01 && accent) { ctx.save(); ctx.shadowColor = 'rgba(' + accent.rgb + ',' + (0.85 * glow) + ')'; ctx.shadowBlur = 18 * glow + 4; ctx.strokeStyle = 'rgba(' + accent.rgb + ',' + (0.35 + 0.6 * glow) + ')'; ctx.lineWidth = 1.5 + glow * 1.5; ctx.stroke(); ctx.restore(); }
    else { ctx.strokeStyle = 'rgba(127,232,255,0.30)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + r, y + 1, w - r * 2, 1);
    if (accent) { ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = accent.col; ctx.fillRect(x, y, Math.max(2, r * 0.45), h); ctx.restore(); }
    ctx.shadowBlur = sb;
  }
  function keycap(ctx, x, y, txt, s, col) {
    ctx.font = M(Math.round(10 * s));
    const w = Math.max(16 * s, ctx.measureText(txt).width + 8 * s), h = 15 * s;
    const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
    rrect(ctx, x, y - h / 2, w, h, 3 * s); ctx.fillStyle = 'rgba(8,16,22,0.82)'; ctx.fill();
    ctx.strokeStyle = col || COL.cyan; ctx.lineWidth = 1; ctx.stroke();
    ctx.shadowBlur = sb;
    ctx.fillStyle = col || COL.cyan; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + w / 2, y + 0.5 * s);
    return w;
  }

  /* ---------- control hints (shown until each control has been used twice) ---------- */
  function nearestEnemy(g, p, r) { for (const e of g.queryEnemies(p.x, p.y, r)) if (e.alive && !e.isProp && e.targetable !== false && e.team === 'enemy') return e; return null; }
  function countEnemies(g, p, r) { let n = 0; for (const e of g.queryEnemies(p.x, p.y, r)) if (e.alive && !e.isProp && e.team === 'enemy' && !e.isStructure) n++; return n; }
  const HINTS = [
    { id: 'move', keys: ['W A S D'], text: 'MOVE · MOUSE AIM', when: (g) => g.time > 2.5 && g.time < 40 },
    { id: 'fire', keys: ['LMB'], text: 'FIRE', when: (g, p) => g.time > 3 && nearestEnemy(g, p, 420) },
    { id: 'lock', keys: ['HOLD RMB'], text: 'LOCK MISSILES — RELEASE TO FIRE', when: (g, p) => p.ammo.secondary > 0 && p.s.secondary.kind === 'missile' && nearestEnemy(g, p, 380) },
    { id: 'special', keys: ['SPACE'], text: (g, p) => (p.s.special.name || 'SPECIAL').toUpperCase(), when: (g, p) => p.ammo.special > 0 && countEnemies(g, p, 260) >= 3 },
    { id: 'beam', keys: ['HOLD E'], text: 'RETRIEVAL BEAM', when: (g, p) => !!(p.retrieval && p.retrieval.candidate) },
    { id: 'repair', keys: ['R'], text: 'REPAIR KIT', when: (g, p) => p.kits > 0 && p.hull / p.s.hullMax < 0.5 },
    { id: 'tab', keys: ['TAB'], text: 'ALL OBJECTIVES · M  TACTICAL MAP', when: (g) => g.time > 45 },
  ];

  const HUD = {
    t: 0, damageFlash: 0, lastHull: null, hullGhost: 1, shieldGhost: 1,
    objExpanded: false, objSticky: false, tabHeld: 0, tabPressing: false,
    hint: null, hintT: 0, hintCd: 4, salvageShown: 0, salvageT: 0, objFlash: 0, lastObjKey: '', moveAcc: 0,
    objSeen: {}, objPulse: {}, chipPulse: { secondary: 0, hidden: 0 }, cardHold: null, cardId: null, countPulse: 0,
    dest: null, cardRect: null, panelRect: null, layoutS: 1,
    COL, F, M, panel, icon, keycap, rrect, CAT, glyph, keyText, fmtDist, glass, fitText, bar,

    /* TAB: hold to peek, tap to pin open, tap again to close */
    tabPress() {
      if (this.objSticky) { this.objSticky = false; this.objExpanded = false; this.tabPressing = false; return; }
      this.objExpanded = true; this.tabPressing = true; this.tabHeld = 0;
      this.used('tab');
    },
    tabTick(down, dt) {
      if (!this.tabPressing) return;
      if (down) { this.tabHeld += dt; return; }
      this.tabPressing = false;
      if (this.tabHeld > 0.3) this.objExpanded = false; else this.objSticky = true;
    },
    resetMission() {
      this.objExpanded = false; this.objSticky = false; this.tabPressing = false;
      this.hint = null; this.hintT = 0; this.hintCd = 4; this.lastHull = null; this.hullGhost = 1; this.shieldGhost = 1;
      this.salvageShown = 0; this.salvageT = 0; this.lastObjKey = ''; this.objFlash = 0; this.damageFlash = 0;
      this.objSeen = {}; this.objPulse = {}; this.chipPulse = { secondary: 0, hidden: 0 }; this.cardHold = null; this.cardId = null; this.countPulse = 0;
      this.dest = null; this.cardRect = null;
      if (AS.Inspect && AS.Inspect.reset) AS.Inspect.reset();
    },
    used(id) {
      const P = AS.Save.profile;
      if (!P) return;
      P.hints = P.hints || {};
      const before = P.hints[id] || 0;
      P.hints[id] = before + 1;
      if (this.hint && this.hint.id === id) this.hintT = Math.min(this.hintT, 0.4);
      if (before + 1 === 2) AS.Save.saveProfile();
    },
    trackUsage(g) {
      const I = AS.Input, p = g.player;
      if (!p || !p.alive) return;
      if (I.down('forward') || I.down('back') || I.down('left') || I.down('right')) { this.moveAcc++; if (this.moveAcc % 45 === 0) this.used('move'); }
      if (I.mouse.lPressed) this.used('fire');
      if (I.mouse.rReleased && p.locks && p.locks.length) this.used('lock');
      if (I.hit('special')) this.used('special');
      if (I.hit('repair')) this.used('repair');
      if (I.hit('map')) this.used('tab');
    },

    draw(ctx, g, dt) {
      this.t += dt;
      const R = AS.Renderer, dpr = R.dpr;
      const W = R.canvas.width, H = R.canvas.height;
      const s = Math.max(0.85, Math.min(1.5, H / (820 * dpr))) * dpr; // UI scale (device px)
      const p = g.player;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      this.vignette(ctx, g, W, H, dt);
      if (!p) { ctx.restore(); return; }
      this.trackUsage(g);
      this.layoutS = s;
      this.trackObjectives(g, dt);
      this.dest = this.destination(g);
      this.markers(ctx, g, s, W, H);
      this.destArrow(ctx, g, s, W, H);
      this.prompts(ctx, g, s);
      this.status(ctx, g, s, dt);
      this.objectives(ctx, g, s, W, dt);
      this.radar(ctx, g, s, H);
      this.weapons(ctx, g, s, W, H, dt);
      this.center(ctx, g, s, W, H);
      this.hints(ctx, g, s, W, H, dt);
      if (AS.Inspect && !(AS.App && AS.App.overlay)) AS.Inspect.draw(ctx, g, s, W, H, dt);
      this.reticle(ctx, g, s);
      ctx.restore();
    },

    vignette(ctx, g, W, H, dt) {
      const p = g.player;
      if (!p) return;
      if (this.lastHull !== null && p.hull < this.lastHull - 0.5) this.damageFlash = Math.min(1, this.damageFlash + (this.lastHull - p.hull) * 0.06);
      this.lastHull = p.hull;
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
      const low = p.hull / p.s.hullMax < 0.25 ? 0.2 + Math.sin(this.t * 6) * 0.1 : 0;
      const a = Math.max(this.damageFlash * 0.55, low);
      if (a > 0.01) {
        const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.72);
        gr.addColorStop(0, 'rgba(255,40,20,0)'); gr.addColorStop(1, 'rgba(255,40,20,' + a + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
    },

    /* ---------- craft status: icon + compact bar + value ---------- */
    status(ctx, g, s, dt) {
      const p = g.player, st = p.s, t = this.t;
      const hullF = p.hull / st.hullMax, shF = p.shield / st.shieldMax, fuF = p.fuel / st.fuelMax;
      this.hullGhost = Math.max(hullF, U.damp(this.hullGhost, hullF, 1.6, dt));
      this.shieldGhost = Math.max(Math.min(1, shF), U.damp(this.shieldGhost, Math.min(1, shF), 2.4, dt));
      const fuelLow = fuF < 0.25 || p.emergency > 0;
      const x = 18 * s, y0 = 18 * s;
      const bw = 128 * s, bh = 6 * s, gap = 17 * s;
      wash(ctx, x - 10 * s, y0 - 11 * s, 236 * s, gap * 2 + 24 * s + (fuelLow ? 6 * s : 0), 'right', 0.42);
      textShadow(ctx, true);
      const row = (i, kind, frac, col, val, ghost, warn, extra, big) => {
        const k = big ? 1.22 : 1;
        const y = y0 + i * gap;
        const blink = warn && Math.sin(t * 9) > 0;
        const c = blink ? COL.red : col;
        icon(ctx, kind, x + 6 * s, y + bh / 2, 12 * s * k, c);
        bar(ctx, x + 18 * s, y - (big ? 1 : 0) * s, bw * k, bh * k, frac, c, ghost, extra);
        ctx.font = M(Math.round(11 * s * k)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = blink ? COL.red : COL.white;
        ctx.fillText(val, x + 24 * s + bw * k, y + bh * k / 2 + 0.5 * s);
      };
      const hullCol = hullF < 0.25 ? COL.red : hullF < 0.5 ? COL.amber : COL.hull;
      row(0, 'hull', hullF, hullCol, String(Math.ceil(p.hull)), this.hullGhost, hullF < 0.25);
      row(1, 'shield', Math.min(1, shF), shF > 1.001 ? '#ffffff' : COL.shield, String(Math.ceil(p.shield)), this.shieldGhost, false, shF > 1 ? shF - 1 : 0);
      const fuelTxt = p.emergency > 0 ? 'RESERVE ' + Math.ceil(p.emergency) + 's' : Math.round(fuF * 100) + '%';
      row(2, 'fuel', fuF, fuF < 0.15 || p.emergency > 0 ? COL.red : COL.fuel, fuelTxt, undefined, fuF < 0.15 || p.emergency > 0, 0, fuelLow);
      // contextual warnings (pills), only while they apply
      let wy = y0 + gap * 3 + 8 * s + (fuelLow ? 6 * s : 0);
      const warn = (txt, col, blink) => {
        if (blink && Math.sin(t * 8) < -0.2) { wy += 20 * s; return; }
        ctx.font = F(Math.round(11 * s), '700');
        const tw = ctx.measureText(txt).width + 16 * s;
        const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
        rrect(ctx, x - 2 * s, wy - 8 * s, tw, 16 * s, 8 * s); ctx.fillStyle = U.C.str(U.C.shade(col, -0.75), 0.75); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
        ctx.shadowBlur = sb;
        ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, x + 6 * s, wy + 0.5 * s);
        wy += 20 * s;
      };
      if (p.emergency > 0) warn('FUEL DEPLETED — FIND FUEL', COL.red, true);
      else if (fuF < 0.15) warn('FUEL CRITICAL', COL.red, true);
      if (g.missileWarn > 0) warn('INCOMING MISSILE', COL.red, true);
      else if (g.lockWarn > 0) warn('MISSILE LOCK DETECTED', COL.amber, true);
      if (hullF < 0.25) warn('HULL CRITICAL', COL.red, false);
      if (p.overheated > 0) warn('WEAPON OVERHEAT', COL.amber, true);
      if (g.hazards && g.hazards.scramble > 0) warn('CONTROLS CONTAMINATED', '#e0a0ff', true);
      if (g.hazards && g.hazards.heat > 0.2) warn('EXTREME HEAT', COL.amber, false);
      if (g.hazards && (g.hazards.sand > 0.4 || g.hazards.whiteout > 0.4)) warn(g.hazards.sand > 0.4 ? 'SANDSTORM — SCANNER DEGRADED' : 'WHITEOUT — SCANNER DEGRADED', COL.amber, false);
      textShadow(ctx, false);
    },

    /* ---------- objectives: a compact card (current primary), TAB expands the full list ---------- */
    // remember each objective's state/progress so changes pulse the card, the TAB rows and the chips
    trackObjectives(g, dt) {
      const seen = this.objSeen;
      for (const k in this.objPulse) { this.objPulse[k] -= dt; if (this.objPulse[k] <= 0) delete this.objPulse[k]; }
      for (const k in this.chipPulse) this.chipPulse[k] = Math.max(0, this.chipPulse[k] - dt);
      this.countPulse = Math.max(0, this.countPulse - dt);
      for (const o of g.script.objs) {
        const timed = o.type === 'defend' || o.type === 'survive';
        const key = o.state + '|' + (o.revealed ? 1 : 0) + '|' + (timed ? (o.running ? 1 : 0) : Math.min(o.progress, o.required));
        const was = seen[o.id];
        seen[o.id] = key;
        if (was === undefined || was === key) continue;
        this.objPulse[o.id] = 1.6;
        if (o.cat !== 'primary') this.chipPulse[o.cat === 'hidden' ? 'hidden' : 'secondary'] = 1.6;
        if (o.id === this.cardId) this.countPulse = 0.8;
      }
    },
    // split "Rescue the crew (2/5)" / "Hold the line — 1:20" into text + count
    splitText(g, o) {
      let txt = g.script.text(o), count = '';
      const m = txt.match(/^(.*?)\s*\((\d+\/\d+)\)\s*$/);
      if (m) { txt = m[1]; count = m[2]; }
      const m2 = txt.match(/^(.*?)\s+—\s+(\d+:\d+)$/);
      if (m2) { txt = m2[1]; count = m2[2]; }
      return { txt, count };
    },
    objFrac(o) {
      if (o.state === 'done') return 1;
      if (!(o.required > 1) && o.type !== 'defend' && o.type !== 'survive') return null;
      return U.clamp(Math.min(o.progress, o.required) / (o.required || 1), 0, 1);
    },
    currentObjective(g) {
      if (g.extraction.active) return { text: 'EXTRACT AT THE LANDING ZONE', count: '', col: CAT.extract.col, cat: 'extract', extraction: true, more: 0, id: 'extract', frac: g.extraction.hold > 0 ? Math.min(1, g.extraction.hold / 3) : null };
      const list = g.script.visibleObjectives().filter((o) => o.state === 'active' && o.cat === 'primary');
      if (!list.length) return null;
      const o = list[0];
      const sp = this.splitText(g, o);
      return { text: sp.txt.toUpperCase(), count: sp.count, col: COL.white, cat: 'primary', o, id: o.id, more: list.length - 1, frac: this.objFrac(o) };
    },
    objectives(ctx, g, s, W, dt) {
      let cur = this.currentObjective(g);
      // completion beat: a finished primary stays on the card for a moment, in green, before the next one slides in
      if (this.cardHold) { this.cardHold.t -= dt; if (this.cardHold.t <= 0) this.cardHold = null; }
      else if (this.cardId && this.cardId !== 'extract' && (!cur || cur.id !== this.cardId)) {
        const po = g.script.obj(this.cardId);
        if (po && po.state === 'done') this.cardHold = { t: 1.7, cur: { text: this.splitText(g, po).txt.toUpperCase(), count: '', cat: 'primary', o: po, id: po.id, more: 0, frac: 1, done: true } };
      }
      this.cardId = cur ? cur.id : null; // always the live objective
      if (this.cardHold) cur = this.cardHold.cur;
      const key = cur ? cur.id + '|' + cur.text : '';
      if (key !== this.lastObjKey) { if (this.lastObjKey) this.objFlash = 1; this.lastObjKey = key; }
      this.objFlash = Math.max(0, this.objFlash - dt * 0.9);
      const xR = W - 16 * s, top = 14 * s;
      let cardBottom = top;
      if (cur) {
        const cat = cur.done ? CAT.extract : catOf(cur.cat);
        const pad = 14 * s, inner = pad + 4 * s;
        const fT = F(Math.round(17 * s), '700'), fC = F(Math.round(19 * s), '700'), fH = F(Math.round(10.5 * s), '700'), fS = F(Math.round(11 * s), '700');
        // footer chips: other objectives, colour-coded
        const vis = g.script.visibleObjectives().filter((o) => o.state === 'active');
        const nSec = vis.filter((o) => o.cat === 'secondary').length;
        const nHid = vis.filter((o) => o.cat === 'hidden').length + g.script.hiddenCount();
        const chips = [];
        if (cur.more > 0) chips.push({ c: CAT.primary, t: '+' + cur.more + ' PRIMARY', p: 0 });
        if (nSec) chips.push({ c: CAT.secondary, t: nSec + ' OPTIONAL', p: this.chipPulse.secondary });
        if (nHid) chips.push({ c: CAT.hidden, t: nHid + ' HIDDEN', p: this.chipPulse.hidden });
        // width from content
        ctx.font = fC; const cw = cur.count ? ctx.measureText(cur.count).width + 14 * s : 0;
        const maxW = Math.max(250 * s, Math.min(500 * s, W / 2 - 215 * s));
        // long briefing-style text: use the objective's short form rather than truncating
        ctx.font = fT;
        let title = cur.text;
        if (inner + ctx.measureText(title).width + cw + pad > maxW && cur.o && cur.o.short) title = cur.o.short.toUpperCase();
        const tw0 = ctx.measureText(title).width;
        ctx.font = fS; let chipW = 0; for (const c of chips) chipW += ctx.measureText(c.t).width + 26 * s;
        const tabW = 92 * s;
        const w = U.clamp(Math.max(inner + tw0 + cw + pad + 4 * s, inner + chipW + tabW + pad, 300 * s), 250 * s, maxW);
        const hasBar = cur.frac !== null && cur.frac !== undefined;
        const h = (hasBar ? 84 : 76) * s;
        const x = xR - w, y = top;
        const pulse = Math.max(this.objFlash, this.countPulse * 0.8);
        const fl = pulse > 0 ? pulse * (0.65 + 0.35 * Math.sin(this.t * 18)) : 0;
        glass(ctx, x, y, w, h, 7 * s, cat, fl);
        this.cardRect = { x, y, w, h };
        // header: category tag + distance to it
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const hy = y + 15 * s;
        glyph(ctx, cat.glyph, x + inner + 5 * s, hy, 5.5 * s, cat.col, 0);
        ctx.font = fH; ctx.fillStyle = cat.col;
        const head = cur.done ? 'OBJECTIVE COMPLETE' : cur.extraction ? 'EXTRACTION' : (this.objFlash > 0.25 && !this.countPulse ? 'NEW ' : '') + 'PRIMARY OBJECTIVE';
        ctx.fillText(head, x + inner + 15 * s, hy + 0.5 * s);
        const d = this.dest;
        if (d && !cur.done && ((cur.o && d.o === cur.o) || (cur.extraction && d.cat === 'extract'))) {
          ctx.font = M(Math.round(11 * s)); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(214,236,244,0.78)';
          const dt2 = (d.label && d.via ? d.label + '  ' : '') + fmtDist(U.dist(g.player.x, g.player.y, d.x, d.y));
          ctx.fillText(dt2, x + w - pad, hy + 0.5 * s);
        }
        // title + count
        const ty = y + 37 * s;
        ctx.font = fT; ctx.textAlign = 'left';
        const txt = fitText(ctx, title, w - inner - pad - cw);
        textShadow(ctx, true);
        ctx.fillStyle = cur.done ? '#c8ffd6' : this.objFlash > 0.4 && Math.sin(this.t * 16) > 0 ? cat.col : COL.white;
        ctx.fillText(txt, x + inner, ty + 0.5 * s);
        if (cur.done) { ctx.font = fC; ctx.textAlign = 'right'; ctx.fillStyle = CAT.extract.col; ctx.fillText('✔', x + w - pad, ty + 0.5 * s); }
        else if (cur.count) {
          const k = 1 + this.countPulse * 0.35;
          ctx.save(); ctx.translate(x + w - pad, ty + 0.5 * s); ctx.scale(k, k);
          ctx.font = fC; ctx.textAlign = 'right'; ctx.fillStyle = this.countPulse > 0 ? '#ffffff' : cat.col; ctx.fillText(cur.count, 0, 0);
          ctx.restore();
        }
        textShadow(ctx, false);
        let fy = y + 62 * s;
        if (hasBar) {
          const by = y + 52 * s;
          bar(ctx, x + inner, by, w - inner - pad, 5 * s, cur.frac, cur.done ? CAT.extract.col : cat.col);
          fy = y + 70 * s;
        }
        // footer: what else is going on + TAB
        ctx.font = fS; ctx.textAlign = 'left';
        let cx = x + inner;
        for (const c of chips) {
          const tw = ctx.measureText(c.t).width;
          if (c.p > 0) { const sb = ctx.shadowBlur; ctx.shadowBlur = 0; rrect(ctx, cx - 6 * s, fy - 9 * s, tw + 25 * s, 18 * s, 9 * s); ctx.fillStyle = 'rgba(' + c.c.rgb + ',' + (0.28 * Math.min(1, c.p)) + ')'; ctx.fill(); ctx.shadowBlur = sb; }
          glyph(ctx, c.c.glyph, cx + 4 * s, fy, 4.6 * s, c.c.col, 0);
          ctx.fillStyle = c.c.col; ctx.fillText(c.t, cx + 13 * s, fy + 0.5 * s);
          cx += tw + 26 * s;
        }
        const kw = keycap(ctx, x + w - pad - 28 * s - 52 * s, fy, 'TAB', s * 1.05, 'rgba(190,228,240,0.8)');
        ctx.font = F(Math.round(10 * s), '600'); ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(this.objExpanded ? (this.objSticky ? 'CLOSE' : 'LIST') : 'ALL', x + w - pad - 52 * s + kw - 22 * s, fy + 0.5 * s);
        cardBottom = y + h;
      } else this.cardRect = null;
      this.panelRect = null;
      if (this.objExpanded) this.objectivesPanel(ctx, g, s, W, cardBottom + 8 * s);
    },
    objectivesPanel(ctx, g, s, W, top) {
      const w = Math.max(this.cardRect ? this.cardRect.w : 0, Math.min(460 * s, W * 0.4)), x = W - 16 * s - w;
      const rows = [];
      const sect = (cat) => {
        const list = g.script.objs.filter((o) => o.cat === cat && o.state !== 'locked' && (o.revealed || o.state === 'done'));
        if (!list.length) return;
        rows.push({ head: catOf(cat), cat });
        for (const o of list) rows.push({ o });
      };
      sect('primary'); sect('secondary'); sect('hidden');
      const hid = g.script.hiddenCount();
      const rowH = 24 * s, headH = 22 * s;
      let h = 40 * s + (hid ? 24 * s : 0) + (g.extraction.active ? 24 * s : 0) + 6 * s;
      for (const r of rows) h += r.head ? headH : rowH;
      glass(ctx, x, top, w, h, 8 * s, null, 0);
      this.panelRect = { x, y: top, w, h };
      const pad = 16 * s;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = F(Math.round(12 * s), '700'); ctx.fillStyle = COL.cyan;
      ctx.fillText(fitText(ctx, g.mission.name.toUpperCase() + '  ·  ' + g.world.name.toUpperCase(), w - 150 * s), x + pad, top + 18 * s);
      ctx.font = M(Math.round(11 * s)); ctx.fillStyle = COL.dim; ctx.textAlign = 'right';
      ctx.fillText('T+' + U.fmtTime(g.time), x + w - pad, top + 18 * s);
      ctx.fillStyle = 'rgba(127,232,255,0.16)'; ctx.fillRect(x + pad, top + 31 * s, w - pad * 2, 1);
      let yy = top + 40 * s;
      const p = g.player;
      for (const r of rows) {
        ctx.textAlign = 'left';
        if (r.head) {
          const c = r.head, cy = yy + headH / 2 + 1 * s;
          glyph(ctx, c.glyph, x + pad + 4 * s, cy, 4.6 * s, c.col, 0);
          ctx.font = F(Math.round(11 * s), '700'); ctx.fillStyle = c.col;
          const lbl = r.cat === 'hidden' ? 'DISCOVERED' : c.name;
          ctx.fillText(lbl, x + pad + 14 * s, cy + 0.5 * s);
          const lw = ctx.measureText(lbl).width;
          ctx.fillStyle = 'rgba(' + c.rgb + ',0.22)'; ctx.fillRect(x + pad + 22 * s + lw, cy, w - pad * 2 - 22 * s - lw, 1);
          yy += headH; continue;
        }
        const o = r.o, c = catOf(o.cat), done = o.state === 'done', failed = o.state === 'failed';
        const cy = yy + rowH / 2;
        const pu = this.objPulse[o.id] || 0;
        if (pu > 0) { rrect(ctx, x + 6 * s, yy + 1 * s, w - 12 * s, rowH - 2 * s, 5 * s); ctx.fillStyle = 'rgba(' + (done ? CAT.extract.rgb : c.rgb) + ',' + (0.24 * Math.min(1, pu)) + ')'; ctx.fill(); }
        if (done) { ctx.font = F(Math.round(13 * s), '700'); ctx.fillStyle = COL.green; ctx.textAlign = 'center'; ctx.fillText('✔', x + pad + 4 * s, cy + 0.5 * s); }
        else if (failed) { ctx.font = F(Math.round(13 * s), '700'); ctx.fillStyle = COL.red; ctx.textAlign = 'center'; ctx.fillText('✖', x + pad + 4 * s, cy + 0.5 * s); }
        else glyph(ctx, c.glyph, x + pad + 4 * s, cy, 5.2 * s, c.col, 0);
        const sp = this.splitText(g, o);
        // right column: count (category colour) · reward · distance
        let rx = x + w - pad;
        ctx.textAlign = 'right';
        if (!done && !failed) {
          const pts = this.objectivePoints(g, o);
          let bd = 1e9; for (const q of pts) bd = Math.min(bd, U.dist(p.x, p.y, q.x, q.y));
          if (bd < 1e9) { ctx.font = M(Math.round(11 * s)); ctx.fillStyle = COL.dim; ctx.fillText(fmtDist(bd), rx, cy + 0.5 * s); rx -= 58 * s; }
          const pay = o.cat === 'secondary' && o.state !== 'done' ? AS.Campaign.optionalValue(g.mission.id, o) : 0;
          if (pay) { ctx.font = M(Math.round(11 * s)); ctx.fillStyle = 'rgba(232,194,74,0.85)'; ctx.fillText('+' + pay, rx, cy + 0.5 * s); rx -= ctx.measureText('+' + pay).width + 10 * s; }
          if (sp.count) { ctx.font = F(Math.round(13 * s), '700'); ctx.fillStyle = c.col; ctx.fillText(sp.count, rx, cy + 0.5 * s); rx -= ctx.measureText(sp.count).width + 10 * s; }
        }
        ctx.textAlign = 'left';
        ctx.font = F(Math.round(14.5 * s), o.cat === 'primary' ? '700' : '600');
        ctx.fillStyle = done ? 'rgba(160,240,180,0.75)' : failed ? 'rgba(255,120,100,0.8)' : o.cat === 'primary' ? COL.white : 'rgba(226,240,246,0.92)';
        const room = rx - (x + pad + 16 * s);
        const t = fitText(ctx, ctx.measureText(sp.txt).width > room && o.short ? o.short : sp.txt, room);
        ctx.fillText(t, x + pad + 16 * s, cy + 0.5 * s);
        if (done) { const tw = ctx.measureText(t).width; ctx.fillStyle = 'rgba(160,240,180,0.45)'; ctx.fillRect(x + pad + 16 * s, cy + 1 * s, tw, Math.max(1, 1.2 * s)); }
        yy += rowH;
      }
      if (hid) {
        const cy = yy + 12 * s;
        glyph(ctx, 'star', x + pad + 4 * s, cy, 5 * s, 'rgba(255,226,122,0.7)', 0);
        ctx.font = F(Math.round(12.5 * s), '600'); ctx.fillStyle = 'rgba(255,226,122,0.8)'; ctx.textAlign = 'left';
        ctx.fillText(hid + ' hidden objective' + (hid > 1 ? 's' : '') + ' — explore to discover', x + pad + 16 * s, cy + 0.5 * s); yy += 24 * s;
      }
      if (g.extraction.active) {
        const cy = yy + 12 * s;
        glyph(ctx, 'lz', x + pad + 4 * s, cy, 5 * s, COL.green, 0);
        ctx.font = F(Math.round(12.5 * s), '700'); ctx.fillStyle = COL.green; ctx.textAlign = 'left';
        ctx.fillText('Extraction available — land at the LZ', x + pad + 16 * s, cy + 0.5 * s);
      }
    },

    /* ---------- radar ---------- */
    radar(ctx, g, s, H) {
      const p = g.player;
      const r = 64 * s, cx = 20 * s + r, cy = H - 20 * s - r;
      const range = p.s.scanRange * (g.hazards ? g.hazards.scanMul() : 1);
      const k = r / range;
      ctx.save();
      const bg = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      bg.addColorStop(0, 'rgba(8,18,24,0.5)'); bg.addColorStop(1, 'rgba(4,10,14,0.74)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = bg; ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, TAU); ctx.clip();
      // terrain under the scan disc (north-up)
      if (g.tacMap) {
        const tm = g.tacMap, sx = tm.width / g.map.w, sy = tm.height / g.map.h;
        ctx.globalAlpha = 0.34; ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tm, (p.x - range) * sx, (p.y - range) * sy, range * 2 * sx, range * 2 * sy, cx - r, cy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(127,232,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.stroke();
      const sw = (this.t * 1.4) % TAU;
      if (ctx.createConicGradient) { const grd = ctx.createConicGradient(sw - 0.7, cx, cy); grd.addColorStop(0, 'rgba(127,232,255,0)'); grd.addColorStop(0.11, 'rgba(127,232,255,0.16)'); grd.addColorStop(0.112, 'rgba(127,232,255,0)'); ctx.fillStyle = grd; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
      if (g.hazards && (g.hazards.sand > 0.3 || g.hazards.whiteout > 0.3)) { for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(200,230,240,' + Math.random() * 0.25 + ')'; ctx.fillRect(cx - r + Math.random() * r * 2, cy - r + Math.random() * r * 2, 2 * s, 2 * s); } }
      const rpos = (x, y, clampEdge, inset) => {
        let dx = (x - p.x) * k, dy = (y - p.y) * k;
        const d2 = dx * dx + dy * dy, lim = r - (inset || 4) * s;
        if (d2 > lim * lim) { if (!clampEdge) return null; const d = Math.sqrt(d2); dx *= (lim - 2 * s) / d; dy *= (lim - 2 * s) / d; }
        return { x: cx + dx, y: cy + dy };
      };
      const blip = (x, y, col, size, shape, clampEdge) => {
        const bp = rpos(x, y, clampEdge);
        if (!bp) return;
        const bx = bp.x, by = bp.y, sz = size * s;
        ctx.fillStyle = col; ctx.strokeStyle = col;
        if (shape === 'sq') ctx.fillRect(bx - sz, by - sz, sz * 2, sz * 2);
        else if (shape === 'tri') { ctx.beginPath(); ctx.moveTo(bx, by - sz * 1.3); ctx.lineTo(bx + sz * 1.1, by + sz); ctx.lineTo(bx - sz * 1.1, by + sz); ctx.closePath(); ctx.fill(); }
        else if (shape === 'ring') { ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(bx, by, sz * 1.4, 0, TAU); ctx.stroke(); }
        else if (shape === 'dia') { ctx.beginPath(); ctx.moveTo(bx, by - sz * 1.5); ctx.lineTo(bx + sz * 1.2, by); ctx.lineTo(bx, by + sz * 1.5); ctx.lineTo(bx - sz * 1.2, by); ctx.closePath(); ctx.fill(); }
        else if (shape === 'person') ICON.person(ctx, bx, by, sz * 3.2);
        else { ctx.beginPath(); ctx.arc(bx, by, sz, 0, TAU); ctx.fill(); }
      };
      const lvl = p.s.scanLevel;
      for (const q of g.pickups) if (q.alive && (!q.hidden || lvl >= 2)) blip(q.x, q.y, 'rgba(255,211,107,0.7)', 1.1, 'dot');
      for (const st of g.structures) {
        if (!st.alive || st.role === 'scenery') continue;
        if (st.hidden && !g.revealHidden) continue;
        if (st.role === 'pad') { blip(st.x, st.y, COL.green, 2.4, 'ring'); continue; }
        if (st.role === 'console') { blip(st.x, st.y, COL.cyan, 1.6, 'sq'); continue; }
        blip(st.x, st.y, st.team === 'player' ? COL.green : (st.submerged && !st.scanned ? 'rgba(255,255,255,0.5)' : '#ff9a5a'), 1.9, 'sq');
      }
      for (const c of g.cargo) if (!c.aboard && !c.delivered) blip(c.x, c.y, '#9ff6ff', 1.6, 'sq');
      for (const u of g.units) {
        if (!u.alive) continue;
        if (u.team === 'player') { blip(u.x, u.y, COL.green, 1.6, 'dot'); continue; }
        if (u.burrowed || u.submerged) { if (lvl >= 3) blip(u.x, u.y, 'rgba(255,255,255,0.55)', 1.4, 'dot'); continue; }
        if (u.hidden && lvl < 3) continue;
        blip(u.x, u.y, u.air ? '#ff7ad8' : '#ff4a3a', u.boss ? 3.6 : u.r > 16 ? 2.2 : 1.5, u.air ? 'tri' : 'dot');
      }
      for (const gr of g.groups) if (gr.remaining > 0) blip(gr.x, gr.y, COL.cyan, 2.2, 'person', true);
      if (g.extraction) blip(g.extraction.x, g.extraction.y, g.extraction.active ? COL.green : 'rgba(125,255,154,0.6)', 3, 'ring', g.extraction.active);
      // objectives in their category colours (primaries pinned to the rim when out of range)
      for (const cat of ['hidden', 'secondary', 'primary']) {
        for (const o of g.script.objs) {
          if (o.cat !== cat || o.state !== 'active' || !o.revealed) continue;
          const c = catOf(cat);
          for (const q of this.objectivePoints(g, o)) { const bp = rpos(q.x, q.y, cat === 'primary', 6); if (bp) glyph(ctx, c.glyph, bp.x, bp.y, (cat === 'primary' ? 4.2 : 3.6) * s, c.col, 0.8 * s); }
        }
      }
      // destination: pulsing ring around its blip
      const D = this.dest;
      if (D) {
        const bp = rpos(D.x, D.y, true, 7), c = catOf(D.cat), ph = (this.t * 1.2) % 1;
        ctx.strokeStyle = c.col; ctx.lineWidth = 1.5 * s;
        ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(bp.x, bp.y, (4 + ph * 7) * s, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(bp.x, bp.y, 5.5 * s, 0, TAU); ctx.stroke();
        if (D.cat === 'extract' || D.cat === 'dropoff' || D.via) glyph(ctx, c.glyph, bp.x, bp.y, 3.6 * s, c.col, 0.8 * s);
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.strokeStyle = 'rgba(127,232,255,0.45)'; ctx.lineWidth = 1.2 * s; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r + 3 * s, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.strokeStyle = 'rgba(127,232,255,0.25)'; ctx.stroke();
      ctx.font = F(Math.round(9 * s), '700'); ctx.fillStyle = COL.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, cy - r + 8 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(p.aimAngle) * r * 0.45, cy + Math.sin(p.aimAngle) * r * 0.45); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -5.5 * s); ctx.lineTo(4 * s, 4.5 * s); ctx.lineTo(0, 2.5 * s); ctx.lineTo(-4 * s, 4.5 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
    },

    /* ---------- weapons + bay counters ---------- */
    weapons(ctx, g, s, W, H, dt) {
      const p = g.player, st = p.s;
      const xR = W - 18 * s;
      let y = H - 22 * s - 62 * s;
      const slotH = 21 * s, iconS = 15 * s, ix = xR - 170 * s;
      wash(ctx, xR - 194 * s, y - 14 * s, 204 * s, slotH * 3 + 40 * s, 'left', 0.42);
      textShadow(ctx, true);
      ctx.textBaseline = 'middle';
      const halo = (yy, col, a) => { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(ix, yy, iconS * 0.75, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; };
      // primary: heat bar + ammo
      const P = st.primary;
      if (AS.Input.mouse.l) halo(y, '#9fe8ff', 0.22);
      icon(ctx, P.id, ix, y, iconS, p.overheated > 0 ? COL.red : '#9fe8ff');
      const heatCol = p.overheated > 0 ? (Math.sin(this.t * 12) > 0 ? COL.red : COL.amber) : p.heat > 70 ? COL.amber : '#9fe8ff';
      bar(ctx, ix + iconS + 6 * s, y - 2.5 * s, 92 * s, 5 * s, p.heat / 100, heatCol);
      const ammoF = p.ammo.primary / P.ammoMax;
      ctx.font = M(Math.round(11 * s)); ctx.textAlign = 'right';
      ctx.fillStyle = p.ammo.primary <= 0 ? COL.red : ammoF < 0.2 ? COL.amber : COL.white;
      ctx.fillText(String(Math.floor(p.ammo.primary)), xR, y + 0.5 * s);
      // secondary
      y += slotH;
      const S2 = st.secondary;
      if (AS.Input.mouse.r) halo(y, '#ffa070', 0.22);
      icon(ctx, S2.id, ix, y, iconS, p.ammo.secondary > 0 ? '#ffa070' : 'rgba(255,160,112,0.4)');
      if (S2.kind === 'missile' && (p.locks.length || p.lockCand)) {
        for (let i = 0; i < S2.multi; i++) { ctx.beginPath(); ctx.arc(ix + iconS + 10 * s + i * 9 * s, y, 3 * s, 0, TAU); ctx.fillStyle = i < p.locks.length ? COL.red : 'rgba(255,90,58,0.25)'; ctx.fill(); }
      }
      ctx.font = M(Math.round(12 * s)); ctx.textAlign = 'right';
      ctx.fillStyle = p.ammo.secondary <= 0 ? COL.red : COL.white;
      ctx.fillText('×' + p.ammo.secondary, xR, y + 0.5 * s);
      // special: cooldown ring around the icon
      y += slotH;
      const X = st.special;
      const ready = p.specialCd <= 0 && p.ammo.special > 0;
      if (p.specialCd > 0) {
        const f = 1 - p.specialCd / (X.cooldown || 1);
        ctx.strokeStyle = 'rgba(197,138,255,0.25)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(ix, y, iconS * 0.72, 0, TAU); ctx.stroke();
        ctx.strokeStyle = COL.violet; ctx.beginPath(); ctx.arc(ix, y, iconS * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * U.clamp(f, 0, 1)); ctx.stroke();
      } else if (ready) halo(y, COL.violet, 0.22 + Math.sin(this.t * 3) * 0.08);
      icon(ctx, X.id, ix, y, iconS, ready ? COL.violet : 'rgba(197,138,255,0.5)');
      ctx.font = F(Math.round(10 * s), '700'); ctx.textAlign = 'left';
      ctx.fillStyle = ready ? COL.violet : COL.faint;
      ctx.fillText(p.ammo.special <= 0 ? 'EMPTY' : p.specialCd > 0 ? p.specialCd.toFixed(1) + 's' : 'READY', ix + iconS + 6 * s, y + 0.5 * s);
      ctx.font = M(Math.round(12 * s)); ctx.textAlign = 'right'; ctx.fillStyle = p.ammo.special <= 0 ? COL.red : COL.white;
      ctx.fillText('×' + p.ammo.special, xR, y + 0.5 * s);
      // bay counters: seats · cargo · kits
      y += slotH + 4 * s;
      const counters = [];
      counters.push({ k: 'person', v: p.passengers.length + '/' + st.rescueCap, col: p.passengers.length >= st.rescueCap ? COL.amber : '#ffd27a', hot: p.passengers.length > 0 });
      if (st.cargoCap > 0) counters.push({ k: 'cargo', v: p.cargo.length + '/' + st.cargoCap, col: '#9ff6ff', hot: p.cargo.length > 0 });
      counters.push({ k: 'kit', v: String(p.kits), col: p.kits > 0 ? COL.green : COL.faint, hot: false });
      ctx.textAlign = 'right';
      let cxR = xR;
      ctx.font = M(Math.round(11 * s));
      for (let i = counters.length - 1; i >= 0; i--) {
        const c = counters[i];
        const tw = ctx.measureText(c.v).width;
        ctx.fillStyle = c.hot ? COL.white : COL.dim; ctx.fillText(c.v, cxR, y + 0.5 * s);
        icon(ctx, c.k, cxR - tw - 9 * s, y, 11 * s, c.col);
        cxR -= tw + 28 * s;
      }
      // salvage appears briefly whenever it changes
      const salv = g.stats.salvage + g.stats.bonusSalvage;
      if (salv !== this.salvageShown) { this.salvageShown = salv; this.salvageT = 3; }
      this.salvageT = Math.max(0, this.salvageT - dt);
      if (this.salvageT > 0 && salv > 0) {
        const sy = y - slotH * 3 - 14 * s;
        ctx.globalAlpha = Math.min(1, this.salvageT);
        ctx.font = M(Math.round(11 * s)); ctx.fillStyle = '#e8c24a'; ctx.textAlign = 'right';
        ctx.fillText(String(salv), xR, sy);
        icon(ctx, 'salvage', xR - ctx.measureText(String(salv)).width - 9 * s, sy, 10 * s, '#e8c24a');
        ctx.globalAlpha = 1;
      }
      textShadow(ctx, false);
    },

    /* ---------- reticle, lock rings on targets, target readout ---------- */
    reticle(ctx, g, s) {
      const p = g.player, I = AS.Input, R = AS.Renderer, cam = g.camera;
      if (!p.alive || p.dying > 0) return;
      const toScr = (wx, wy) => R.worldToScreen(wx, wy, cam);
      const ws = R.worldScale(cam);
      const m = I.usingPad && I.padAim.active ? toScr(p.aimX, p.aimY) : { x: I.mouse.x * R.dpr, y: I.mouse.y * R.dpr };
      const rr = 9 * s;
      const heat = p.heat / 100;
      const hot = p.overheated > 0;
      const X = p.s.special;
      const outOfRange = X.range && U.dist(p.x, p.y, p.aimX, p.aimY + 8) > X.range;
      textShadow(ctx, true);
      ctx.strokeStyle = hot ? COL.red : COL.cyan; ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(m.x + Math.cos(a) * rr * 0.55, m.y + Math.sin(a) * rr * 0.55); ctx.lineTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.4 * s, 0, TAU); ctx.fill();
      if (heat > 0.02) {
        ctx.strokeStyle = hot ? COL.red : heat > 0.7 ? COL.amber : 'rgba(127,232,255,0.55)'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(m.x, m.y, rr + 5 * s, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 0.5 * heat); ctx.stroke();
      }
      if (outOfRange) { ctx.strokeStyle = 'rgba(197,138,255,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2 * s, 3 * s]); ctx.beginPath(); ctx.arc(m.x, m.y, rr + 9 * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      // missile lock: rotating, contracting ring on the candidate; solid ring on locks
      if (p.lockCand && p.lockCand.alive) {
        const e = p.lockCand, q = toScr(e.x, e.py);
        const f = Math.min(1, p.lockT / (p.s.secondary.lockTime * p.s.secondary.lockMul));
        const r = (e.r + 6) * ws * (1.9 - f * 0.9);
        ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.6 * s;
        const rot = this.t * 3;
        for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; ctx.beginPath(); ctx.arc(q.x, q.y, r, a, a + 0.7); ctx.stroke(); }
        ctx.font = F(Math.round(9 * s), '700'); ctx.fillStyle = COL.amber; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('LOCKING', q.x, q.y - r - 3 * s);
      }
      for (const e of p.locks) {
        if (!e.alive) continue;
        const q = toScr(e.x, e.py), r = (e.r + 6) * ws;
        ctx.strokeStyle = COL.red; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = COL.red;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const px = q.x + Math.cos(a) * r, py = q.y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * 5 * s, py - Math.sin(a) * 5 * s); ctx.lineTo(px + Math.cos(a + 1.2) * 3 * s, py + Math.sin(a + 1.2) * 3 * s); ctx.lineTo(px + Math.cos(a - 1.2) * 3 * s, py + Math.sin(a - 1.2) * 3 * s); ctx.closePath(); ctx.fill(); }
        ctx.font = F(Math.round(9 * s), '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('LOCKED', q.x, q.y - r - 4 * s);
      }
      // hovered target: name + health right above the target
      let hov = null, bd = 30;
      for (const e of g.queryEnemies(p.aimX, p.aimY, 60)) { if (!e.alive || e.isProp || !e.targetable) continue; const d = U.dist(e.x, e.py, p.aimX, p.aimY) - e.r; if (d < bd) { bd = d; hov = e; } }
      if (hov && AS.Inspect && AS.Inspect.isShowing && AS.Inspect.isShowing(hov)) hov = null; // the hover card already says it
      if (hov) {
        const q = toScr(hov.x, hov.py), top = q.y - (hov.r + 8) * ws;
        const shielded = hov.isShielded && hov.isShielded();
        const nm = (hov.def.name || hov.kind || '').toUpperCase() + (shielded ? ' · SHIELDED' : '') + (hov.powered === false ? ' · OFFLINE' : '');
        const bw = Math.max(40 * s, Math.min(90 * s, hov.r * ws * 2));
        ctx.font = F(Math.round(10 * s), '600'); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = shielded ? COL.violet : '#ffd8b0';
        ctx.fillText(nm, q.x, top - 6 * s);
        const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(q.x - bw / 2, top - 4 * s, bw, 3 * s);
        ctx.fillStyle = shielded ? COL.violet : COL.red; ctx.fillRect(q.x - bw / 2, top - 4 * s, bw * U.clamp(hov.hp / hov.maxHp, 0, 1), 3 * s);
        ctx.shadowBlur = sb;
      }
      textShadow(ctx, false);
    },

    /* ---------- destination: where to fly next (always shown as an arrow around the craft) ---------- */
    destination(g) {
      const p = g.player;
      if (!p) return null;
      const near = (list) => { let best = null, bd = 1e9; for (const q of list) { const d = U.dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } } return best; };
      const lz = { x: g.extraction.x, y: g.extraction.y, h: 8, r: 40, cat: 'extract', label: 'LZ', ent: g.lz };
      if (g.extraction.active) return lz;
      const dropoff = (o) => {
        let best = g.lz, bd = U.dist(p.x, p.y, g.lz.x, g.lz.y);
        for (const pad of g.pads) if (pad.def.dropoff && pad.alive !== false && U.dist(p.x, p.y, pad.x, pad.y) < bd) { best = pad; bd = U.dist(p.x, p.y, pad.x, pad.y); }
        return { x: best.x, y: best.y, h: 8, r: 40, cat: 'dropoff', label: 'DROP-OFF', ent: best, o };
      };
      for (const o of g.script.objs) {
        if (o.state !== 'active' || o.cat !== 'primary' || !o.revealed) continue;
        // a boss that cannot be hurt right now: point at whatever exposes it (thumpers, shield nodes)
        if (o.targets && (o.type === 'boss' || o.type === 'kill')) {
          const b = o.targets.map((id) => g.byId.get(id)).find((e) => e && e.alive);
          if (b && b.boss && (b.targetable === false || (b.isShielded && b.isShielded()))) {
            let ents = (o.hint || []).map((id) => g.byId.get(id)).filter((e) => e && e.alive !== false);
            if (!ents.length && b.shieldedBy) ents = b.shieldedBy.map((id) => g.byId.get(id)).filter((e) => e && e.alive);
            if (ents.length) {
              const ready = ents.filter((e) => !(e.role === 'console' && (e.activated || e.locked)));
              const e = near(ready.length ? ready : ents);
              return { x: e.x, y: e.y, h: (e.hc || 10) * 2 + 10, r: e.r || 14, cat: 'primary', o, ent: e, via: b, label: String(e.label || (e.def && e.def.name) || '').toUpperCase() };
            }
          }
        }
        const pts = this.objectivePoints(g, o);
        // survivors / cargo aboard with nowhere else to go (or the bay is full): drop them off
        if (o.type === 'rescue' && p.passengers.length && (!pts.length || p.passengers.length >= p.s.rescueCap)) return dropoff(o);
        if ((o.type === 'collect' || o.type === 'deliver') && !o.to && o.items && p.cargo.some((c) => o.items.includes(c.id)) && (!pts.length || p.cargo.length >= p.s.cargoCap)) return dropoff(o);
        if (pts.length) { const q = near(pts); return { x: q.x, y: q.y, h: q.h, r: 18, cat: 'primary', o }; }
      }
      return lz;
    },

    /* ---------- world markers: category glyphs on targets, chevrons at the screen edge ---------- */
    markers(ctx, g, s, W, H) {
      const p = g.player, cam = g.camera, R = AS.Renderer;
      const targets = this.trackedTargets(g);
      const ws = R.worldScale(cam);
      const cr = this.cardRect;
      for (const t of targets) {
        const cat = catOf(t.cat);
        const q = R.worldToScreen(t.x, t.y, cam), sx = q.x, sy = q.y;
        const m = 34 * s;
        const d = U.dist(p.x, p.y, t.x, t.y);
        if (sx > m && sy > m && sx < W - m && sy < H - m) {
          if (d < 90 && !t.dest) continue;
          // ground ring under the destination
          if (t.dest) {
            const rr = U.clamp((t.r || 18) * ws * 1.25, 18 * s, 52 * s), ph = (this.t * 0.9) % 1;
            ctx.save();
            ctx.strokeStyle = 'rgba(4,8,12,0.55)'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.62, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = cat.col; ctx.lineWidth = 2 * s; ctx.setLineDash([7 * s, 5 * s]); ctx.lineDashOffset = -this.t * 14 * s;
            ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = 0.7 * (1 - ph); ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.ellipse(sx, sy, rr * (1 + ph * 0.6), rr * 0.62 * (1 + ph * 0.6), 0, 0, TAU); ctx.stroke();
            ctx.restore();
          }
          if (d < 90) continue;
          const bob = Math.sin(this.t * 3 + t.x) * 2 * s;
          const big = t.dest ? 1.25 : 1;
          const yy = sy - (t.h || 30) * ws - 14 * s * big + bob;
          ctx.globalAlpha = t.dest ? 1 : 0.9;
          // stem pointer + glyph
          const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.moveTo(sx, yy + 15 * s * big); ctx.lineTo(sx + 4 * s * big, yy + 10 * s * big); ctx.lineTo(sx - 4 * s * big, yy + 10 * s * big); ctx.closePath();
          ctx.strokeStyle = 'rgba(4,8,12,0.7)'; ctx.lineWidth = 2.5 * s; ctx.stroke(); ctx.fillStyle = cat.col; ctx.fill();
          ctx.shadowBlur = sb;
          glyph(ctx, cat.glyph, sx, yy, 7 * s * big, cat.col);
          ctx.globalAlpha = 1;
          continue;
        }
        if (t.dest) continue; // the destination already has the arrow around the craft
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = W / 2 + Math.cos(a) * (W / 2 - m), ey = H / 2 + Math.sin(a) * (H / 2 - m);
        const low = ey > H / 2;
        let cx2 = U.clamp(ex, m + (low ? 170 * s : 0), W - m - (low ? 210 * s : 0)), cy2 = U.clamp(ey, m + 64 * s, H - m - 30 * s);
        // keep edge chevrons clear of the objective card and the TAB list
        const inR = (r) => r && cx2 > r.x - 30 * s && cx2 < r.x + r.w + 30 * s && cy2 > r.y - 20 * s && cy2 < r.y + r.h + 24 * s;
        if (inR(cr)) cy2 = cr.y + cr.h + 24 * s;
        if (inR(this.panelRect)) cy2 = this.panelRect.y + this.panelRect.h + 24 * s;
        if (cy2 > H - m - 30 * s) continue;
        ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(11 * s, 0); ctx.lineTo(-5 * s, 7.5 * s); ctx.lineTo(-1.5 * s, 0); ctx.lineTo(-5 * s, -7.5 * s); ctx.closePath();
        ctx.strokeStyle = 'rgba(4,8,12,0.75)'; ctx.lineWidth = 3 * s; ctx.stroke(); ctx.fillStyle = cat.col; ctx.fill();
        ctx.restore();
        const lx = cx2 - Math.cos(a) * 26 * s, ly = cy2 - Math.sin(a) * 18 * s;
        ctx.font = M(Math.round(11 * s)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lbl = (t.label ? t.label + ' ' : '') + fmtDist(d);
        const tw = ctx.measureText(lbl).width;
        glyph(ctx, cat.glyph, lx - tw / 2 - 8 * s, ly, 4.6 * s, cat.col);
        keyText(ctx, lbl, lx + 1 * s, ly + 0.5 * s, cat.col, 3 * s);
      }
    },
    trackedTargets(g) {
      const out = [], p = g.player, D = this.dest;
      const same = (a, b) => a && b && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
      if (D) out.push(Object.assign({}, D, { dest: true }));
      const push = (t) => { if (!same(t, D) && !out.some((q) => same(q, t))) out.push(t); };
      if (!g.extraction.active && (p.passengers.length || p.cargo.some((c) => c.deliver === 'pad'))) {
        let best = g.lz, bd = U.dist(p.x, p.y, g.lz.x, g.lz.y);
        for (const pad of g.pads) if (pad.def.dropoff && U.dist(p.x, p.y, pad.x, pad.y) < bd) { best = pad; bd = U.dist(p.x, p.y, pad.x, pad.y); }
        push({ x: best.x, y: best.y, cat: 'dropoff', label: 'DROP-OFF', h: 8, r: 40 });
      }
      for (const c of p.cargo) if (c.deliver !== 'pad') { const z = g.zones.get(c.deliver) || g.byId.get(c.deliver); if (z) push({ x: z.x, y: z.y, cat: 'place', label: 'PLACE', h: 8 }); }
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed) continue;
        const pts = this.objectivePoints(g, o);
        let best = null, bd = 1e9;
        for (const q of pts) { const d = U.dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
        if (best && (o.cat === 'primary' || bd < 1600)) push({ x: best.x, y: best.y, h: best.h, cat: o.cat, o, label: '' });
        if (out.length > 5) break;
      }
      return out;
    },
    destArrow(ctx, g, s, W, H) {
      const D = this.dest, p = g.player;
      if (!D || !p.alive || p.dying > 0) return;
      const R = AS.Renderer, cam = g.camera, ws = R.worldScale(cam);
      const dist = U.dist(p.x, p.y, D.x, D.y);
      if (dist < 70) return;
      const cat = catOf(D.cat);
      const c = R.worldToScreen(p.x, p.py, cam), q = R.worldToScreen(D.x, D.y, cam);
      const m = 30 * s;
      const onScreen = q.x > m && q.y > m && q.x < W - m && q.y < H - m;
      const a = Math.atan2(q.y - c.y, q.x - c.x);
      const rad = Math.max(60 * s, 42 * ws);
      const k = onScreen ? 0.78 : 1.12;
      const pulse = onScreen ? 0 : 0.5 + 0.5 * Math.sin(this.t * 4);
      const ax = c.x + Math.cos(a) * rad, ay = c.y + Math.sin(a) * rad;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(a);
      const L = 17 * s * k, Wd = 12 * s * k;
      const path = () => { ctx.beginPath(); ctx.moveTo(L * 0.8, 0); ctx.lineTo(-L * 0.5, Wd); ctx.lineTo(-L * 0.18, 0); ctx.lineTo(-L * 0.5, -Wd); ctx.closePath(); };
      // trailing ghost chevrons give it motion without extra clutter
      if (!onScreen) for (let i = 1; i <= 2; i++) { ctx.save(); ctx.translate(-i * 10 * s * k, 0); ctx.scale(0.7, 0.7); path(); ctx.strokeStyle = 'rgba(4,8,12,' + (0.5 - i * 0.15) + ')'; ctx.lineWidth = 4 * s; ctx.stroke(); ctx.fillStyle = 'rgba(' + cat.rgb + ',' + (0.6 - i * 0.18) + ')'; ctx.fill(); ctx.restore(); }
      path();
      ctx.strokeStyle = 'rgba(4,8,12,0.85)'; ctx.lineWidth = 5.5 * s; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.shadowColor = 'rgba(' + cat.rgb + ',0.9)'; ctx.shadowBlur = (8 + pulse * 8) * s;
      ctx.fillStyle = cat.col; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(L * 0.8, 0); ctx.lineTo(-L * 0.5, -Wd); ctx.lineTo(-L * 0.18, 0); ctx.closePath(); ctx.globalAlpha = 0.35; ctx.fill();
      ctx.restore();
      // distance (and what it is) just outside the arrow, kept upright
      ctx.font = F(Math.round(11.5 * s), '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lbl = (D.label ? D.label + '  ' : '') + fmtDist(dist);
      const tw = ctx.measureText(lbl).width;
      const off = rad + 20 * s * k + Math.abs(Math.cos(a)) * (tw / 2 + 4 * s) + Math.abs(Math.sin(a)) * 4 * s;
      const lx = c.x + Math.cos(a) * off, ly = c.y + Math.sin(a) * off;
      const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
      rrect(ctx, lx - tw / 2 - 7 * s, ly - 9 * s, tw + 14 * s, 18 * s, 9 * s); ctx.fillStyle = 'rgba(4,9,14,' + (onScreen ? 0.5 : 0.62) + ')'; ctx.fill();
      ctx.strokeStyle = 'rgba(' + cat.rgb + ',0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.shadowBlur = sb;
      ctx.fillStyle = cat.col; ctx.fillText(lbl, lx, ly + 0.5 * s);
    },
    objectivePoints(g, o) {
      const pts = [];
      const add = (id) => { const e = g.byId.get(id) || g.zones.get(id); if (e && (e.alive !== false || e.role === 'console') && !(e.aboard) && !(e.delivered)) pts.push({ x: e.x, y: e.y, h: e.hc ? e.hc * 2 + 10 : 16 }); };
      if (o.noMarker) return pts;
      if (o.targets) for (const id of o.targets) { const e = g.byId.get(id); if (e && (e.alive || (o.type === 'interact' && !e.activated && !e.locked) || (o.type === 'scan' && !e.scanned))) { if (o.type === 'interact' && (e.activated || e.locked)) continue; if (o.type === 'scan' && e.scanned) continue; if (o.type !== 'interact' && o.type !== 'scan' && !e.alive) continue; pts.push({ x: e.x, y: e.y, h: (e.hc || 10) * 2 + (e.r || 10) * 0.6 + 6 }); } }
      if (o.groups) for (const id of o.groups) { const gr = g.groupById(id); if (gr && gr.remaining > 0) pts.push({ x: gr.x, y: gr.y, h: 20 }); }
      if (o.items) for (const id of o.items) { const c = g.byId.get(id); if (c && !c.aboard && !c.delivered) pts.push({ x: c.x, y: c.y, h: 16 }); else if (c && c.aboard && o.to) add(o.to); }
      if (o.zone && o.type !== 'discover') add(o.zone);
      if (o.target) add(o.target);
      if (o.convoy) for (const u of g.convoyUnits(o.convoy)) if (u.alive) { pts.push({ x: u.x, y: u.y, h: 22 }); break; }
      if (o.points) for (const q of o.points) pts.push(q);
      return pts;
    },

    /* ---------- contextual prompts next to the thing you can use ---------- */
    prompts(ctx, g, s) {
      const p = g.player, cam = g.camera, R = AS.Renderer;
      if (!p.alive || p.dying > 0) return;
      const ws = R.worldScale(cam);
      textShadow(ctx, true);
      const it = p.interactTarget;
      if (it && !(p.retrieval && (p.retrieval.active || p.retrieval.candidate))) {
        const q = R.worldToScreen(it.x, it.y - (it.hc || 6) - (it.r || 8) * 0.6, cam);
        const x = q.x + (it.r || 10) * ws * 0.7 + 10 * s, y = q.y;
        const lbl = (p.interactLabel || '').replace(/^(PRESS|HOLD) E — /, '');
        const blocked = /FULL|LOCKED|OFFLINE|NEED|SEALED/.test(lbl);
        let w = 0;
        if (!blocked) w = keycap(ctx, x, y, 'E', s, COL.cyan) + 6 * s;
        ctx.font = F(Math.round(11 * s), '700'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = blocked ? COL.amber : COL.white;
        ctx.fillText(lbl, x + w, y + 0.5 * s);
        if (p.interactT > 0 && it.interactTime) {
          const tw = ctx.measureText(lbl).width, sb = ctx.shadowBlur; ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + w, y + 9 * s, tw, 2.5 * s);
          ctx.fillStyle = COL.green; ctx.fillRect(x + w, y + 9 * s, tw * Math.min(1, p.interactT / it.interactTime), 2.5 * s);
          ctx.shadowBlur = sb;
        }
      }
      if (p.retrieval && p.retrieval.drawHUD) p.retrieval.drawHUD(ctx, g, s);
      // craft-centred status rings: extraction hold, pad servicing
      const c = R.worldToScreen(p.x, p.py, cam);
      if (g.extraction.active && g.extraction.hold > 0) {
        const f = Math.min(1, g.extraction.hold / 3);
        ctx.strokeStyle = 'rgba(125,255,154,0.25)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(c.x, c.y, 30 * ws, 0, TAU); ctx.stroke();
        ctx.strokeStyle = COL.green; ctx.beginPath(); ctx.arc(c.x, c.y, 30 * ws, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
        ctx.font = F(Math.round(11 * s), '700'); ctx.fillStyle = COL.green; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('EXTRACTING', c.x, c.y + 32 * ws);
      } else if (p.onPad && p.pad_service) {
        ctx.font = F(Math.round(10 * s), '700'); ctx.fillStyle = COL.green; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('SERVICING', c.x, c.y + 26 * ws);
      }
      textShadow(ctx, false);
    },

    /* ---------- messages, boss bar, subtitles ---------- */
    center(ctx, g, s, W, H) {
      let y = 66 * s;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (g.bossActive && g.bossActive.alive) y += 34 * s;
      const msgs = g.msgs.slice(-3);
      for (const m of msgs) {
        const a = Math.min(1, m.t * 2, (m.max - m.t) * 6 + 0.2);
        ctx.globalAlpha = a;
        ctx.font = F(Math.round(14 * s), '700');
        const tw = ctx.measureText(m.text).width;
        const gr = ctx.createLinearGradient(W / 2 - tw / 2 - 40 * s, 0, W / 2 + tw / 2 + 40 * s, 0);
        gr.addColorStop(0, 'rgba(4,9,14,0)'); gr.addColorStop(0.2, 'rgba(4,9,14,0.45)'); gr.addColorStop(0.8, 'rgba(4,9,14,0.45)'); gr.addColorStop(1, 'rgba(4,9,14,0)');
        ctx.fillStyle = gr; ctx.fillRect(W / 2 - tw / 2 - 40 * s, y - 10 * s, tw + 80 * s, 20 * s);
        textShadow(ctx, true);
        ctx.fillStyle = m.col; ctx.fillText(m.text, W / 2, y + 0.5 * s);
        textShadow(ctx, false);
        y += 24 * s;
      }
      ctx.globalAlpha = 1;
      if (g.bossActive && g.bossActive.alive) {
        const b = g.bossActive, bw = 360 * s, bx = W / 2 - bw / 2, by = 22 * s;
        textShadow(ctx, true);
        ctx.font = F(Math.round(11 * s), '700'); ctx.fillStyle = '#ffb8a0'; ctx.fillText((b.bossName || b.def.name).toUpperCase(), W / 2, by);
        bar(ctx, bx, by + 9 * s, bw, 6 * s, b.hp / b.maxHp, b.isShielded && b.isShielded() ? '#9a6aff' : '#ff4a3a');
        if (b.statusText) { ctx.font = M(Math.round(10 * s)); ctx.fillStyle = '#ffd0c0'; ctx.fillText(b.statusText(), W / 2, by + 26 * s); }
        textShadow(ctx, false);
      }
      // subtitles: no box — a soft band and a shadowed line
      const sub = AS.Voice && AS.Voice.current;
      if (sub && AS.Settings.subtitles !== false) {
        const sy = H - 54 * s;
        ctx.font = F(Math.round(14 * s), '500');
        const txt = sub.text;
        const tw = Math.min(W * 0.62, ctx.measureText(txt).width);
        ctx.globalAlpha = Math.min(1, sub.t * 3);
        const gr = ctx.createLinearGradient(W / 2 - tw / 2 - 60 * s, 0, W / 2 + tw / 2 + 60 * s, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.85, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(W / 2 - tw / 2 - 60 * s, sy - 26 * s, tw + 120 * s, 42 * s);
        textShadow(ctx, true);
        ctx.font = F(Math.round(10 * s), '700'); ctx.fillStyle = sub.col; ctx.fillText(sub.speaker, W / 2, sy - 15 * s);
        ctx.font = F(Math.round(14 * s), '500'); ctx.fillStyle = '#f0f4f6';
        ctx.fillText(txt, W / 2, sy + 2 * s, W * 0.66);
        textShadow(ctx, false);
        ctx.globalAlpha = 1;
      }
    },

    /* ---------- control hints ---------- */
    hints(ctx, g, s, W, H, dt) {
      const P = AS.Save.profile, p = g.player;
      if (!P || !p.alive || p.dying > 0 || AS.Settings.hints === false) return;
      const done = P.hints || {};
      this.hintCd -= dt;
      if (this.hint) {
        this.hintT -= dt;
        if (this.hintT <= 0 || (done[this.hint.id] || 0) >= 2) { this.hint = null; this.hintCd = 6; }
      } else if (this.hintCd <= 0) {
        for (const h of HINTS) {
          if ((done[h.id] || 0) >= 2) continue;
          if (h.when(g, p)) { this.hint = h; this.hintT = 7; break; }
        }
        if (!this.hint) this.hintCd = 1;
      }
      if (!this.hint) return;
      const h = this.hint;
      const a = Math.max(0, Math.min(1, (7 - this.hintT) * 3, this.hintT * 2));
      ctx.globalAlpha = a;
      const y = H - (AS.Voice && AS.Voice.current ? 104 : 70) * s;
      const label = typeof h.text === 'function' ? h.text(g, p) : h.text;
      ctx.font = M(Math.round(10 * s));
      let w = 0;
      for (const k of h.keys) w += Math.max(16 * s, ctx.measureText(k).width + 8 * s) + 6 * s;
      ctx.font = F(Math.round(12 * s), '700');
      w += ctx.measureText(label).width;
      let x = W / 2 - w / 2;
      textShadow(ctx, true);
      for (const k of h.keys) x += keycap(ctx, x, y, k, s, COL.cyan) + 6 * s;
      ctx.font = F(Math.round(12 * s), '700'); ctx.fillStyle = COL.white; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 0.5 * s);
      textShadow(ctx, false);
      ctx.globalAlpha = 1;
    },
  };
  AS.HUD = HUD;
})(window.AS);
