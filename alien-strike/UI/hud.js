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
  function panel(ctx, x, y, w, h, cut) {
    cut = cut || 8;
    ctx.beginPath();
    ctx.moveTo(x + cut, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + cut); ctx.closePath();
    ctx.fillStyle = 'rgba(6,12,18,0.7)'; ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.stroke();
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // soft translucent backdrop that fades out toward one side (no hard box)
  function wash(ctx, x, y, w, h, dir, a) {
    a = a || 0.5;
    const g = dir === 'left' ? ctx.createLinearGradient(x + w, 0, x, 0) : ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(4,9,14,' + a + ')'); g.addColorStop(0.7, 'rgba(4,9,14,' + (a * 0.45) + ')'); g.addColorStop(1, 'rgba(4,9,14,0)');
    ctx.fillStyle = g; rrect(ctx, x, y, w, h, Math.min(h / 2, 14)); ctx.fill();
  }
  function textShadow(ctx, on) {
    if (on) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }
  // dimensional bar: dark well, gradient fill, specular line, faint ticks, damage ghost
  function bar(ctx, x, y, w, h, frac, col, ghost, extra) {
    frac = U.clamp(frac, 0, 1);
    const sh = ctx.shadowBlur; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(2,6,10,0.62)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
    if (ghost !== undefined && ghost > frac + 0.002) {
      rrect(ctx, x, y, w * Math.min(1, ghost), h, h / 2); ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.fill();
    }
    if (frac > 0.002) {
      const fw = Math.max(h, w * frac);
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, U.C.css(col, 0.35)); gr.addColorStop(0.45, col); gr.addColorStop(1, U.C.css(col, -0.3));
      rrect(ctx, x, y, fw, h, h / 2); ctx.fillStyle = gr; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + h * 0.5, y + 0.5, Math.max(0, fw - h), Math.max(1, h * 0.16));
    }
    if (extra > 0) { rrect(ctx, x, y - 1, w * Math.min(0.3, extra), h + 2, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 1; i < 10; i++) ctx.fillRect(Math.round(x + w * i / 10), y + 1, 1, h - 2);
    if (sh) textShadow(ctx, true);
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
    COL, F, M, panel, icon, keycap, rrect,

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
      this.markers(ctx, g, s, W, H);
      this.prompts(ctx, g, s);
      this.reticle(ctx, g, s);
      this.status(ctx, g, s, dt);
      this.objectives(ctx, g, s, W, dt);
      this.radar(ctx, g, s, H);
      this.weapons(ctx, g, s, W, H, dt);
      this.center(ctx, g, s, W, H);
      this.hints(ctx, g, s, W, H, dt);
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

    /* ---------- objectives: one line, TAB expands ---------- */
    currentObjective(g) {
      if (g.extraction.active) return { text: 'EXTRACT AT THE LANDING ZONE', count: '', col: COL.green, extraction: true, more: 0 };
      const list = g.script.visibleObjectives().filter((o) => o.state === 'active' && o.cat === 'primary');
      if (!list.length) return null;
      const o = list[0];
      let txt = g.script.text(o), count = '';
      const m = txt.match(/^(.*?)\s*\((\d+\/\d+)\)\s*$/);
      if (m) { txt = m[1]; count = m[2]; }
      const m2 = txt.match(/^(.*?)\s+—\s+(\d+:\d+)$/);
      if (m2) { txt = m2[1]; count = m2[2]; }
      return { text: txt.toUpperCase(), count, col: COL.white, o, more: list.length - 1 };
    },
    objectives(ctx, g, s, W, dt) {
      const cur = this.currentObjective(g);
      const xR = W - 18 * s, y = 22 * s;
      const key = cur ? cur.text + cur.count : '';
      if (key !== this.lastObjKey) { if (this.lastObjKey) this.objFlash = 1; this.lastObjKey = key; }
      this.objFlash = Math.max(0, this.objFlash - dt * 1.2);
      if (cur) {
        ctx.font = F(Math.round(13 * s), '700');
        const cw = cur.count ? ctx.measureText(cur.count).width + 12 * s : 0;
        ctx.font = F(Math.round(13 * s), '600');
        let txt = cur.text;
        const maxW = Math.min(W * 0.36, 440 * s);
        while (ctx.measureText(txt).width > maxW && txt.length > 6) txt = txt.slice(0, -2);
        if (txt !== cur.text) txt += '…';
        const tw = ctx.measureText(txt).width;
        const total = 18 * s + tw + cw;
        wash(ctx, xR - total - 24 * s, y - 12 * s, total + 34 * s, 24 * s, 'left', 0.45 + this.objFlash * 0.3);
        textShadow(ctx, true);
        const mx = xR - total;
        ctx.fillStyle = cur.extraction ? (Math.sin(this.t * 4) > 0 ? COL.green : '#bfffd0') : COL.amber;
        ctx.beginPath(); ctx.moveTo(mx, y - 5 * s); ctx.lineTo(mx + 5 * s, y); ctx.lineTo(mx, y + 5 * s); ctx.lineTo(mx - 5 * s, y); ctx.closePath(); ctx.fill();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = this.objFlash > 0 && Math.sin(this.t * 14) > 0 ? COL.cyan : cur.col;
        ctx.fillText(txt, mx + 12 * s, y + 0.5 * s);
        if (cur.count) { ctx.font = F(Math.round(13 * s), '700'); ctx.fillStyle = COL.amber; ctx.textAlign = 'right'; ctx.fillText(cur.count, xR, y + 0.5 * s); }
        if (cur.more > 0 && !this.objExpanded) { ctx.font = M(Math.round(10 * s)); ctx.fillStyle = COL.faint; ctx.textAlign = 'right'; ctx.fillText('+' + cur.more + ' MORE  ·  TAB', xR, y + 17 * s); }
        textShadow(ctx, false);
      }
      if (this.objExpanded) this.objectivesPanel(ctx, g, s, W, y + 22 * s);
    },
    objectivesPanel(ctx, g, s, W, top) {
      const w = 372 * s, x = W - w - 14 * s;
      const rows = [];
      const sect = (title, cat, col) => {
        const list = g.script.objs.filter((o) => o.cat === cat && o.state !== 'locked' && (o.revealed || o.state === 'done'));
        if (!list.length) return;
        rows.push({ head: title, col });
        for (const o of list) rows.push({ o });
      };
      sect('PRIMARY', 'primary', COL.amber); sect('OPTIONAL', 'secondary', '#cfe6ee'); sect('DISCOVERED', 'hidden', '#ffd36b');
      const hid = g.script.hiddenCount();
      const h = 46 * s + rows.length * 19 * s + (hid ? 20 * s : 0) + (g.extraction.active ? 20 * s : 0);
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(5,10,16,0.3)'); gr.addColorStop(0.25, 'rgba(5,10,16,0.72)'); gr.addColorStop(1, 'rgba(5,10,16,0.8)');
      rrect(ctx, x, top, w, h, 8 * s); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = 'rgba(127,232,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = F(Math.round(11 * s), '700'); ctx.fillStyle = COL.cyan;
      ctx.fillText(g.mission.name + '  ·  ' + g.world.name.toUpperCase(), x + 14 * s, top + 15 * s);
      ctx.font = M(Math.round(10 * s)); ctx.fillStyle = COL.faint; ctx.textAlign = 'right';
      ctx.fillText('T+' + U.fmtTime(g.time) + (this.objSticky ? '  ·  TAB CLOSE' : ''), x + w - 12 * s, top + 15 * s);
      let yy = top + 38 * s;
      ctx.textAlign = 'left';
      for (const r of rows) {
        if (r.head) { ctx.font = F(Math.round(10 * s), '700'); ctx.fillStyle = r.col; ctx.fillText(r.head, x + 14 * s, yy); yy += 19 * s; continue; }
        const o = r.o, done = o.state === 'done', failed = o.state === 'failed';
        ctx.font = F(Math.round(12 * s), o.cat === 'primary' ? '600' : '500');
        ctx.fillStyle = done ? COL.green : failed ? COL.red : o.cat === 'primary' ? COL.white : 'rgba(215,232,240,0.85)';
        let txt = (done ? '✔ ' : failed ? '✖ ' : '○ ') + g.script.text(o);
        const maxW = w - 70 * s;
        while (ctx.measureText(txt).width > maxW && txt.length > 6) txt = txt.slice(0, -2);
        ctx.fillText(txt, x + 22 * s, yy);
        if (o.reward && !done && !failed) { ctx.font = M(Math.round(10 * s)); ctx.fillStyle = 'rgba(232,194,74,0.8)'; ctx.textAlign = 'right'; ctx.fillText('+' + o.reward, x + w - 12 * s, yy); ctx.textAlign = 'left'; }
        yy += 19 * s;
      }
      if (hid) { ctx.font = F(Math.round(11 * s), '500'); ctx.fillStyle = 'rgba(255,211,107,0.7)'; ctx.fillText('★ ' + hid + ' hidden objective' + (hid > 1 ? 's' : '') + ' — explore', x + 14 * s, yy); yy += 20 * s; }
      if (g.extraction.active) { ctx.font = F(Math.round(11 * s), '700'); ctx.fillStyle = COL.green; ctx.fillText('Extraction available — land at the LZ', x + 14 * s, yy); }
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
      const blip = (x, y, col, size, shape, clampEdge) => {
        let dx = (x - p.x) * k, dy = (y - p.y) * k;
        const d2 = dx * dx + dy * dy, lim = r - 4 * s;
        if (d2 > lim * lim) { if (!clampEdge) return; const d = Math.sqrt(d2); dx *= (lim - 2 * s) / d; dy *= (lim - 2 * s) / d; }
        const bx = cx + dx, by = cy + dy, sz = size * s;
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
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed || o.cat !== 'primary') continue;
        for (const q of this.objectivePoints(g, o)) blip(q.x, q.y, COL.amber, 2.2, 'dia', true);
      }
      if (g.extraction) blip(g.extraction.x, g.extraction.y, g.extraction.active ? COL.green : 'rgba(125,255,154,0.6)', 3, 'ring', g.extraction.active);
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

    /* ---------- world markers: small, assistive ---------- */
    markers(ctx, g, s, W, H) {
      const p = g.player, cam = g.camera, R = AS.Renderer;
      const targets = this.trackedTargets(g);
      const ws = R.worldScale(cam);
      textShadow(ctx, true);
      for (const t of targets) {
        const q = R.worldToScreen(t.x, t.y, cam), sx = q.x, sy = q.y;
        const m = 34 * s;
        const d = Math.round(U.dist(p.x, p.y, t.x, t.y));
        if (sx > m && sy > m && sx < W - m && sy < H - m) {
          if (d < 90) continue;
          const bob = Math.sin(this.t * 3 + t.x) * 2 * s;
          const yy = sy - (t.h || 30) * ws - 10 * s + bob;
          ctx.fillStyle = t.col; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(sx, yy + 5 * s); ctx.lineTo(sx + 4.5 * s, yy); ctx.lineTo(sx, yy - 5 * s); ctx.lineTo(sx - 4.5 * s, yy); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx, yy + 11 * s); ctx.lineTo(sx + 3 * s, yy + 7.5 * s); ctx.lineTo(sx - 3 * s, yy + 7.5 * s); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = W / 2 + Math.cos(a) * (W / 2 - m), ey = H / 2 + Math.sin(a) * (H / 2 - m);
        const low = ey > H / 2;
        const cx2 = U.clamp(ex, m + (low ? 160 * s : 0), W - m - (low ? 200 * s : 0)), cy2 = U.clamp(ey, m + 70 * s, H - m - 30 * s);
        ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(a);
        ctx.fillStyle = t.col; ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(-5 * s, 6 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-5 * s, -6 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.font = M(Math.round(10 * s)); ctx.fillStyle = t.col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((t.label ? t.label + ' ' : '') + d, cx2 - Math.cos(a) * 24 * s, cy2 - Math.sin(a) * 16 * s);
      }
      textShadow(ctx, false);
    },
    trackedTargets(g) {
      const out = [], p = g.player;
      if (g.extraction.active) out.push({ x: g.extraction.x, y: g.extraction.y, col: COL.green, label: 'EXTRACT', h: 8 });
      else if (p.passengers.length || p.cargo.some((c) => c.deliver === 'pad')) {
        let best = g.lz, bd = U.dist(p.x, p.y, g.lz.x, g.lz.y);
        for (const pad of g.pads) if (pad.def.dropoff && U.dist(p.x, p.y, pad.x, pad.y) < bd) { best = pad; bd = U.dist(p.x, p.y, pad.x, pad.y); }
        out.push({ x: best.x, y: best.y, col: '#ffc35a', label: 'DROP-OFF', h: 8 });
      }
      for (const c of p.cargo) if (c.deliver !== 'pad') { const z = g.zones.get(c.deliver) || g.byId.get(c.deliver); if (z) out.push({ x: z.x, y: z.y, col: '#9ff6ff', label: 'PLACE', h: 8 }); }
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed || o.cat === 'hidden') continue;
        const pts = this.objectivePoints(g, o);
        let best = null, bd = 1e9;
        for (const q of pts) { const d = U.dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
        if (best && (o.cat === 'primary' || bd < 1600)) out.push({ x: best.x, y: best.y, h: best.h, col: o.cat === 'primary' ? COL.amber : 'rgba(200,230,240,0.8)', label: '' });
        if (out.length > 4) break;
      }
      return out;
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
