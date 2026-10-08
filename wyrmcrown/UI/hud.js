/* WYRMCROWN — in-flight HUD, drawn at native resolution over the realm.
 * Built on the shared UI kit (alien-strike/UI/kit.js) but styled for high
 * fantasy: dark leather panels, gilded rims, parchment text. Permanent
 * elements stay small and at the edges:
 *   top-left     dragon & rider: health, energy (hunger), breath, mana
 *   top-centre   gold and income
 *   top-right    the four realms: stronghold, ward, territory
 *   right        the advisor's current aim
 *   left         the herald's news
 *   bottom-left  the realm map (minimap)
 *   bottom-right blessings (power-ups) and the stored spell (Q)
 * Contextual prompts (snatch, court, waygate, capture progress) appear next to
 * what they refer to; arrows at the screen edge point to rival dragons and home. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;
  const K = AS.UIKit;
  const SERIF = '"Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif';
  const BODY = '"Alegreya Sans", "Segoe UI", "Trebuchet MS", sans-serif';
  const F = (px, w) => (w || '700') + ' ' + px + 'px ' + SERIF;
  const B = (px, w) => (w || '600') + ' ' + px + 'px ' + BODY;
  const COL = { gold: '#f2c14e', goldDim: '#a8863a', parch: '#f0e2c0', dim: 'rgba(244,232,204,0.82)', hp: '#e0473a', energy: '#f0a23a', mana: '#5aa8ff', fire: '#ff7a2a', ok: '#8ee07a', bad: '#ff6a4a', leather: 'rgba(18,11,8,0.88)', rim: 'rgba(214,170,90,0.75)' };

  /* ---------- vector icons ---------- */
  const ICON = {
    heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * 0.4); c.bezierCurveTo(x - s * 0.7, y - s * 0.05, x - s * 0.4, y - s * 0.6, x, y - s * 0.2); c.bezierCurveTo(x + s * 0.4, y - s * 0.6, x + s * 0.7, y - s * 0.05, x, y + s * 0.4); c.fill(); },
    meat(c, x, y, s) { c.beginPath(); c.ellipse(x - s * 0.1, y - s * 0.08, s * 0.36, s * 0.28, -0.6, 0, TAU); c.fill(); c.fillRect(x + s * 0.08, y + s * 0.02, s * 0.32, s * 0.12); c.beginPath(); c.arc(x + s * 0.44, y + s * 0.02, s * 0.1, 0, TAU); c.arc(x + s * 0.44, y + s * 0.16, s * 0.1, 0, TAU); c.fill(); },
    flame(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.55); c.bezierCurveTo(x + s * 0.5, y - s * 0.1, x + s * 0.4, y + s * 0.5, x, y + s * 0.5); c.bezierCurveTo(x - s * 0.4, y + s * 0.5, x - s * 0.5, y, x - s * 0.1, y - s * 0.25); c.quadraticCurveTo(x, y, x, y - s * 0.55); c.fill(); },
    star(c, x, y, s) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.22 : s * 0.5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); },
    coin(c, x, y, s) { const f = c.fillStyle; c.beginPath(); c.arc(x, y, s * 0.48, 0, TAU); c.fill(); c.fillStyle = 'rgba(80,50,10,0.55)'; c.beginPath(); c.arc(x, y, s * 0.32, 0, TAU); c.fill(); c.fillStyle = f; c.beginPath(); c.arc(x - s * 0.04, y - s * 0.04, s * 0.26, 0, TAU); c.fill(); },
    castle(c, x, y, s) { c.fillRect(x - s * 0.45, y - s * 0.1, s * 0.9, s * 0.55); for (let i = 0; i < 3; i++) c.fillRect(x - s * 0.45 + i * s * 0.35, y - s * 0.32, s * 0.2, s * 0.25); c.fillRect(x - s * 0.12, y - s * 0.5, s * 0.24, s * 0.4); },
    shield(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.45); c.lineTo(x + s * 0.42, y - s * 0.45); c.lineTo(x + s * 0.4, y + s * 0.05); c.quadraticCurveTo(x + s * 0.3, y + s * 0.38, x, y + s * 0.52); c.quadraticCurveTo(x - s * 0.3, y + s * 0.38, x - s * 0.4, y + s * 0.05); c.closePath(); c.fill(); },
    ward(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.5); c.lineTo(x + s * 0.22, y); c.lineTo(x, y + s * 0.5); c.lineTo(x - s * 0.22, y); c.closePath(); c.fill(); },
    wing(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.2); c.quadraticCurveTo(x - s * 0.1, y - s * 0.6, x + s * 0.5, y - s * 0.35); c.lineTo(x + s * 0.2, y - s * 0.1); c.lineTo(x + s * 0.4, y + s * 0.05); c.lineTo(x + s * 0.05, y + s * 0.12); c.lineTo(x + s * 0.2, y + s * 0.3); c.closePath(); c.fill(); },
    flag(c, x, y, s) { c.fillRect(x - s * 0.35, y - s * 0.5, s * 0.08, s); c.beginPath(); c.moveTo(x - s * 0.27, y - s * 0.5); c.lineTo(x + s * 0.4, y - s * 0.32); c.lineTo(x - s * 0.27, y - s * 0.12); c.closePath(); c.fill(); },
    skull(c, x, y, s) { c.beginPath(); c.arc(x, y - s * 0.08, s * 0.36, 0, TAU); c.fill(); c.fillRect(x - s * 0.2, y + s * 0.15, s * 0.4, s * 0.25); c.fillStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(x - s * 0.13, y - s * 0.06, s * 0.09, 0, TAU); c.arc(x + s * 0.13, y - s * 0.06, s * 0.09, 0, TAU); c.fill(); },
    // power-ups
    pw_shield(c, x, y, s) { ICON.shield(c, x, y, s); }, pw_power(c, x, y, s) { ICON.star(c, x, y, s); }, pw_rapid(c, x, y, s) { for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * s * 0.25 - s * 0.1, y - s * 0.4); c.lineTo(x + i * s * 0.25 + s * 0.12, y); c.lineTo(x + i * s * 0.25 - s * 0.1, y + s * 0.4); c.lineTo(x + i * s * 0.25 - s * 0.02, y); c.closePath(); c.fill(); } },
    pw_haste(c, x, y, s) { ICON.wing(c, x, y, s); }, pw_invuln(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.42, 0, TAU); c.lineWidth = s * 0.12; c.strokeStyle = c.fillStyle; c.stroke(); ICON.star(c, x, y, s * 0.6); },
    pw_inferno(c, x, y, s) { ICON.flame(c, x, y, s); }, pw_heal(c, x, y, s) { c.fillRect(x - s * 0.12, y - s * 0.4, s * 0.24, s * 0.8); c.fillRect(x - s * 0.4, y - s * 0.12, s * 0.8, s * 0.24); },
    pw_mana(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.5); c.quadraticCurveTo(x + s * 0.45, y + s * 0.05, x, y + s * 0.45); c.quadraticCurveTo(x - s * 0.45, y + s * 0.05, x, y - s * 0.5); c.fill(); },
    pw_feast(c, x, y, s) { ICON.meat(c, x, y, s); }, pw_storm(c, x, y, s) { c.beginPath(); c.moveTo(x + s * 0.1, y - s * 0.5); c.lineTo(x - s * 0.25, y + s * 0.05); c.lineTo(x, y + s * 0.05); c.lineTo(x - s * 0.1, y + s * 0.5); c.lineTo(x + s * 0.3, y - s * 0.08); c.lineTo(x + s * 0.05, y - s * 0.08); c.closePath(); c.fill(); },
    pw_nova(c, x, y, s) { c.lineWidth = s * 0.1; c.strokeStyle = c.fillStyle; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); } c.stroke(); },
    pw_summon(c, x, y, s) { ICON.shield(c, x, y, s * 0.9); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - s * 0.04, y - s * 0.3, s * 0.08, s * 0.6); c.fillRect(x - s * 0.22, y - s * 0.12, s * 0.44, s * 0.08); },
    // site icons for the maps
    mine(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.4); c.lineTo(x, y - s * 0.4); c.lineTo(x + s * 0.5, y + s * 0.4); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.arc(x, y + s * 0.25, s * 0.18, Math.PI, 0); c.fill(); },
    village(c, x, y, s) { c.beginPath(); c.moveTo(x - s * 0.45, y); c.lineTo(x, y - s * 0.45); c.lineTo(x + s * 0.45, y); c.closePath(); c.fill(); c.fillRect(x - s * 0.32, y, s * 0.64, s * 0.4); },
    trade(c, x, y, s) { ICON.coin(c, x, y, s); }, tower(c, x, y, s) { c.fillRect(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.65); c.beginPath(); c.moveTo(x - s * 0.25, y - s * 0.2); c.lineTo(x, y - s * 0.55); c.lineTo(x + s * 0.25, y - s * 0.2); c.closePath(); c.fill(); },
    well(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.42, 0, TAU); c.lineWidth = s * 0.16; c.strokeStyle = c.fillStyle; c.stroke(); c.beginPath(); c.arc(x, y, s * 0.18, 0, TAU); c.fill(); },
    grove(c, x, y, s) { c.beginPath(); c.arc(x, y - s * 0.12, s * 0.34, 0, TAU); c.fill(); c.fillRect(x - s * 0.06, y + s * 0.1, s * 0.12, s * 0.35); },
    crystal(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s * 0.55); c.lineTo(x + s * 0.25, y); c.lineTo(x, y + s * 0.45); c.lineTo(x - s * 0.25, y); c.closePath(); c.fill(); },
    relic(c, x, y, s) { ICON.star(c, x, y, s); }, fort(c, x, y, s) { ICON.castle(c, x, y, s * 0.9); }, castle_s(c, x, y, s) { ICON.castle(c, x, y, s); },
    bridge(c, x, y, s) { c.beginPath(); c.arc(x, y + s * 0.35, s * 0.45, Math.PI, 0); c.lineWidth = s * 0.16; c.strokeStyle = c.fillStyle; c.stroke(); c.fillRect(x - s * 0.55, y - s * 0.15, s * 1.1, s * 0.14); },
    shrine(c, x, y, s) { for (let i = 0; i < 3; i++) c.fillRect(x - s * 0.4 + i * s * 0.32, y - s * 0.3, s * 0.16, s * 0.6); c.fillRect(x - s * 0.45, y - s * 0.38, s * 0.9, s * 0.12); },
    cave(c, x, y, s) { c.beginPath(); c.arc(x, y + s * 0.2, s * 0.5, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(x, y + s * 0.25, s * 0.22, Math.PI, 0); c.fill(); },
    nest(c, x, y, s) { c.beginPath(); c.ellipse(x, y + s * 0.1, s * 0.5, s * 0.25, 0, 0, TAU); c.fill(); c.fillStyle = '#fff6e0'; c.beginPath(); c.ellipse(x - s * 0.15, y - s * 0.05, s * 0.12, s * 0.16, 0, 0, TAU); c.ellipse(x + s * 0.12, y - s * 0.08, s * 0.12, s * 0.16, 0, 0, TAU); c.fill(); },
    eye(c, x, y, s) { c.beginPath(); c.ellipse(x, y, s * 0.5, s * 0.28, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.75)'; c.beginPath(); c.arc(x, y, s * 0.14, 0, TAU); c.fill(); },
    gate(c, x, y, s) { c.beginPath(); c.arc(x, y, s * 0.42, 0, TAU); c.lineWidth = s * 0.18; c.strokeStyle = c.fillStyle; c.stroke(); },
    ruins(c, x, y, s) { c.fillRect(x - s * 0.4, y - s * 0.1, s * 0.16, s * 0.5); c.fillRect(x - s * 0.08, y - s * 0.4, s * 0.16, s * 0.8); c.fillRect(x + s * 0.24, y + s * 0.05, s * 0.16, s * 0.35); },
  };
  function icon(ctx, kind, x, y, s, col) { const f = ICON[kind] || ICON.star; ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; f(ctx, x, y, s); ctx.restore(); }

  // leather panel with a gilded rim
  function plate(ctx, x, y, w, h, r, a) {
    const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(40,26,16,' + (a || 0.82) + ')'); gr.addColorStop(1, 'rgba(16,10,7,' + (a || 0.82) + ')');
    K.rrect(ctx, x, y, w, h, r); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = COL.rim; ctx.lineWidth = 1.2; ctx.stroke();
    K.rrect(ctx, x + 2.5, y + 2.5, w - 5, h - 5, Math.max(1, r - 2)); ctx.strokeStyle = 'rgba(255,220,150,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.shadowBlur = sb;
  }
  function crest(ctx, x, y, s, fdef) {
    ctx.save();
    ICON.shield(ctx, x, y, s * 1.12);
    ctx.fillStyle = 'rgba(20,12,8,0.9)'; ICON.shield(ctx, x, y, s * 1.12);
    ctx.fillStyle = fdef.color; ICON.shield(ctx, x, y, s);
    ctx.fillStyle = fdef.color2; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y - s * 0.22); ctx.lineTo(x + s * 0.2, y - s * 0.22); ctx.lineTo(x, y + s * 0.25); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const HUD = {
    t: 0, ghost: 1, hurtA: 0, tabHeld: 0, expanded: false, buffFlash: {}, lastHp: null,
    COL, F, B, SERIF, BODY, icon, plate, crest, ICON,
    reset(g) { this.ghost = 1; this.lastHp = null; this.hurtA = 0; this.advice = null; },
    tabTick(down, dt) { this.expanded = down; },
    flashBuff(k) { this.buffFlash[k] = 1; },
    draw(ctx, g, dt) {
      this.t += dt;
      const R = AS.Renderer, W = R.canvas.width, H = R.canvas.height, dpr = R.dpr;
      // the HUD scales with the window; a touch larger than before for legibility
      const s = Math.max(0.95, Math.min(1.7, H / (900 * dpr) * 1.2)) * dpr;
      this.s = s;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textBaseline = 'middle';
      this.vignette(ctx, g, W, H, dt);
      this.worldMarks(ctx, g, W, H, s);
      this.dragonPanel(ctx, g, s, dt);
      this.goldPanel(ctx, g, W, s);
      this.realms(ctx, g, W, s);
      this.advisor(ctx, g, W, s, dt);
      this.feed(ctx, g, s, H);
      this.minimap(ctx, g, s, H);
      this.buffs(ctx, g, W, H, s, dt);
      this.prompts(ctx, g, W, H, s);
      if (AS.Voices) AS.Voices.draw(ctx, g, W, H, s);
      this.messages(ctx, g, W, H, s);
      if (g.player.down > 0 && g.player.fall <= 0) this.downBanner(ctx, g, W, H, s);
      ctx.restore();
    },

    vignette(ctx, g, W, H, dt) {
      const p = g.player, hp = p.hp / p.maxHp;
      if (this.lastHp !== null && p.hp < this.lastHp - 0.5) this.hurtA = Math.min(0.7, this.hurtA + (this.lastHp - p.hp) / p.maxHp * 6);
      this.lastHp = p.hp;
      this.hurtA = Math.max(0, this.hurtA - dt * 1.6);
      const low = hp < 0.3 ? (0.3 - hp) * 1.4 * (0.6 + Math.sin(this.t * 5) * 0.4) : 0;
      const a = Math.min(0.75, this.hurtA + low);
      if (a > 0.01) {
        const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, 'rgba(150,10,0,' + a + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
      if (p.energy <= 0) { ctx.fillStyle = 'rgba(40,20,0,' + (0.18 + Math.sin(this.t * 3) * 0.06) + ')'; ctx.fillRect(0, 0, W, H); }
    },

    /* ---------- top-left: the dragon and rider ---------- */
    dragonPanel(ctx, g, s, dt) {
      const p = g.player, fdef = p.fdef;
      const x = 14 * s, y = 12 * s, w = 300 * s, h = 112 * s;
      plate(ctx, x, y, w, h, 10 * s);
      crest(ctx, x + 30 * s, y + 34 * s, 22 * s, fdef);
      ctx.textAlign = 'left';
      ctx.font = F(Math.round(15 * s)); ctx.fillStyle = COL.parch;
      ctx.fillText(p.name, x + 58 * s, y + 20 * s);
      ctx.font = B(Math.round(12.5 * s), '500'); ctx.fillStyle = COL.dim;
      ctx.fillText(fdef.dragon.title + ' · ' + fdef.rider.name, x + 58 * s, y + 37 * s);
      const bx = x + 58 * s, bw = w - 72 * s, bh = 9 * s;
      const hp = p.hp / p.maxHp;
      this.ghost = U.damp(this.ghost, hp, hp < this.ghost ? 1.6 : 8, dt);
      const row = (yy, ic, col, frac, ghost, label, warn) => {
        icon(ctx, ic, x + 34 * s, yy + bh / 2, 13 * s, warn && Math.sin(this.t * 8) > 0 ? '#ffffff' : col);
        K.bar(ctx, bx, yy, bw, bh, frac, col, ghost);
        if (label) { ctx.font = B(Math.round(11 * s), '700'); ctx.textAlign = 'right'; K.keyText(ctx, label, bx + bw - 4 * s, yy + bh / 2 + 0.5 * s, '#fff8e8', 2.5 * s); ctx.textAlign = 'left'; }
      };
      row(y + 50 * s, 'heart', COL.hp, hp, this.ghost, Math.ceil(p.hp) + ' / ' + p.maxHp, hp < 0.25);
      const en = p.energy / p.maxEnergy;
      row(y + 65 * s, 'meat', COL.energy, en, undefined, en < 0.2 ? (p.energy <= 0 ? 'STARVING — EAT!' : 'HUNGRY') : 'ENERGY', en < 0.2);
      const fr = p.fireCharge / p.maxFire;
      row(y + 80 * s, 'flame', p.fireDelay > 0 ? '#9a5a3a' : COL.fire, fr, undefined, p.breathing ? (AS.Data.breaths[fdef.dragon.breath] || {}).name.toUpperCase() : p.fireDelay > 0 ? 'COOLING' : fr >= 0.999 ? 'BREATH READY' : 'BREATH');
      row(y + 95 * s, 'star', COL.mana, p.mana / p.maxMana, undefined, 'MAGIC');
    },

    /* ---------- top-centre: gold ---------- */
    goldPanel(ctx, g, W, s) {
      const Fp = g.playerFaction;
      const w = 190 * s, h = 40 * s, x = W / 2 - w / 2, y = 10 * s;
      plate(ctx, x, y, w, h, 18 * s, 0.7);
      this.goldShown = this.goldShown === undefined ? Fp.gold : U.lerp(this.goldShown, Fp.gold, 0.15);
      icon(ctx, 'coin', x + 26 * s, y + h / 2, 22 * s, COL.gold);
      ctx.font = F(Math.round(19 * s)); ctx.textAlign = 'left'; ctx.fillStyle = '#ffe6a0';
      ctx.fillText(Math.floor(this.goldShown + 0.5).toLocaleString(), x + 44 * s, y + h / 2 + 1 * s);
      ctx.font = B(Math.round(12 * s), '600'); ctx.textAlign = 'right'; ctx.fillStyle = COL.dim;
      ctx.fillText('+' + Math.round(Fp.income) + ' / min', x + w - 14 * s, y + h / 2 + 1 * s);
    },

    /* ---------- top-right: the four realms ---------- */
    realms(ctx, g, W, s) {
      const rows = g.factionList, rh = 30 * s, w = 260 * s, x = W - w - 14 * s, y = 12 * s;
      plate(ctx, x, y, w, rh * rows.length + 12 * s, 10 * s, 0.7);
      rows.forEach((Fc, i) => {
        const yy = y + 6 * s + i * rh, mine = Fc.key === g.playerKey;
        if (mine) { K.rrect(ctx, x + 4 * s, yy + 1 * s, w - 8 * s, rh - 2 * s, 6 * s); ctx.fillStyle = 'rgba(255,220,140,0.08)'; ctx.fill(); }
        crest(ctx, x + 18 * s, yy + rh / 2, 10 * s, Fc.def);
        ctx.textAlign = 'left'; ctx.font = F(Math.round(12.5 * s), mine ? '700' : '600');
        ctx.fillStyle = Fc.eliminated ? 'rgba(200,180,160,0.4)' : mine ? '#ffe6a0' : COL.parch;
        ctx.fillText(Fc.def.short, x + 34 * s, yy + rh / 2 - 5 * s);
        if (Fc.eliminated) { ctx.strokeStyle = 'rgba(255,90,60,0.8)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(x + 32 * s, yy + rh / 2 - 5 * s); ctx.lineTo(x + 34 * s + ctx.measureText(Fc.def.short).width, yy + rh / 2 - 5 * s); ctx.stroke(); icon(ctx, 'skull', x + w - 22 * s, yy + rh / 2, 13 * s, '#c8b8a0'); return; }
        // stronghold health
        const keep = Fc.keep, kf = keep && keep.alive ? keep.hp / keep.maxHp : 0;
        K.bar(ctx, x + 34 * s, yy + rh / 2 + 3 * s, 92 * s, 5 * s, kf, Fc.def.color);
        // ward pips: wardstones + dragon
        let wx = x + 136 * s;
        const wards = Fc.buildings.filter((b) => b.kind === 'wardstone' && b.alive && b.built >= 1).length;
        for (let k = 0; k < 3; k++) { icon(ctx, 'ward', wx, yy + rh / 2, 11 * s, k < wards ? Fc.def.color : 'rgba(255,255,255,0.16)'); wx += 10 * s; }
        const up = Fc.dragon && Fc.dragon.down <= 0;
        icon(ctx, 'wing', wx + 6 * s, yy + rh / 2, 14 * s, up ? Fc.def.color2 : 'rgba(255,255,255,0.18)');
        // territory
        icon(ctx, 'flag', x + w - 52 * s, yy + rh / 2, 12 * s, Fc.def.color);
        ctx.font = B(Math.round(12.5 * s), '700'); ctx.textAlign = 'left'; ctx.fillStyle = COL.parch;
        ctx.fillText(String(Fc.sitesOwned), x + w - 43 * s, yy + rh / 2 + 0.5 * s);
        if (!mine && Fc.attackedT > g.time - 3 && Math.sin(this.t * 10) > 0) icon(ctx, 'flame', x + w - 18 * s, yy + rh / 2, 12 * s, '#ff8a3a');
        // a truce or alliance with the player
        const pact = !mine && g.pacts && g.pacts[Fc.key];
        if (pact) {
          ctx.font = F(Math.round(12.5 * s), '600'); const nw = ctx.measureText(Fc.def.short).width;
          ctx.font = B(Math.round(9.5 * s), '800'); ctx.textAlign = 'left'; ctx.fillStyle = pact.kind === 'alliance' ? '#bfe8a0' : '#f0e2a0';
          ctx.fillText(pact.kind === 'alliance' ? 'ALLY' : 'TRUCE', x + 40 * s + nw, yy + rh / 2 - 5 * s);
        }
      });
      this.realmsBottom = y + rh * rows.length + 12 * s;
    },

    /* ---------- the advisor: what to do next ---------- */
    advisor(ctx, g, W, s, dt) {
      const a = AS.Advisor ? AS.Advisor.current(g) : null;
      if (!a) return;
      const w = 280 * s, x = W - w - 14 * s, y = this.realmsBottom + 8 * s;
      ctx.font = B(Math.round(13.5 * s), '600');
      const lines = this.wrap(ctx, a.text, w - 30 * s);
      const h = (30 + lines.length * 17) * s;
      plate(ctx, x, y, w, h, 8 * s, 0.8);
      this.advBottom = y + h;
      icon(ctx, a.icon || 'flag', x + 16 * s, y + 15 * s, 14 * s, a.col || COL.gold);
      ctx.font = F(Math.round(11.5 * s)); ctx.textAlign = 'left'; ctx.fillStyle = a.col || COL.gold;
      ctx.fillText(a.title || 'COUNSEL', x + 30 * s, y + 13 * s);
      ctx.font = B(Math.round(13.5 * s), '600'); ctx.fillStyle = COL.parch;
      lines.forEach((l, i) => ctx.fillText(l, x + 14 * s, y + (32 + i * 17) * s));
      this.advTarget = a.target || null;
    },
    wrap(ctx, text, maxW) {
      const words = String(text).split(' '), out = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
      if (cur) out.push(cur);
      return out.slice(0, 4);
    },

    /* ---------- left: the herald's feed ---------- */
    feed(ctx, g, s, H) {
      let y = 140 * s;
      ctx.textAlign = 'left';
      for (const n of g.feed) {
        const a = Math.min(1, n.t / 1.2) * Math.min(1, (n.max - n.t) * 4 + 0.2);
        ctx.globalAlpha = a;
        ctx.font = B(Math.round((n.important ? 13 : 12) * s), n.important ? '700' : '600');
        const tw = ctx.measureText(n.text).width;
        K.wash(ctx, 10 * s, y - 10 * s, tw + 50 * s, 21 * s, 'right', 0.55);
        if (n.fk && g.factions[n.fk]) crest(ctx, 24 * s, y, 7 * s, g.factions[n.fk].def);
        K.keyText(ctx, n.text, 38 * s, y + 1 * s, n.important ? '#ffe6a0' : COL.parch, 3 * s);
        y += 24 * s;
      }
      ctx.globalAlpha = 1;
    },

    /* ---------- bottom-left: realm minimap ---------- */
    minimap(ctx, g, s, H) {
      const size = 190 * s, x = 14 * s, y = H - size - 14 * s, p = g.player;
      plate(ctx, x - 4 * s, y - 4 * s, size + 8 * s, size + 8 * s, 10 * s, 0.85);
      ctx.save();
      K.rrect(ctx, x, y, size, size, 8 * s); ctx.clip();
      // show ~3000 units around the player
      const span = 3200, k = size / span, cx = U.clamp(p.x, span / 2, g.map.w - span / 2), cy = U.clamp(p.y, span / 2, g.map.h - span / 2);
      const tm = g.tacMap, ts = g.map.w / tm.width;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tm, (cx - span / 2) / ts, (cy - span / 2) / ts, span / ts, span / ts, x, y, size, size);
      const P = (wx, wy) => [x + (wx - cx + span / 2) * k, y + (wy - cy + span / 2) * k];
      // unexplored land darkens (a soft, upscaled fog layer)
      const fog = this.fogLayer(g);
      ctx.drawImage(fog, (cx - span / 2) / g.fogCell, (cy - span / 2) / g.fogCell, span / g.fogCell, span / g.fogCell, x, y, size, size);
      for (const site of g.sites) {
        if (!g.isExplored(site.x, site.y)) continue;
        const q = P(site.x, site.y);
        const col = site.owner ? g.factions[site.owner].def.color : site.guarded() ? '#d86a4a' : '#e8dcc0';
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(q[0], q[1], 5 * s, 0, TAU); ctx.fill();
        icon(ctx, site.def.icon === 'castle' ? 'castle_s' : site.def.icon, q[0], q[1], 8 * s, col);
      }
      for (const Fc of g.factionList) { if (Fc.eliminated) continue; const q = P(Fc.townPos.x, Fc.townPos.y); crest(ctx, q[0], q[1], 7 * s, Fc.def); }
      if (g.waypoint) {
        // the course: a dashed guide from the dragon toward it (the minimap shows ~3200 units)
        const q = P(g.waypoint.x, g.waypoint.y), pq = P(p.x, p.y);
        ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = 'rgba(255,226,140,0.8)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(pq[0], pq[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#ffe28c'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(q[0], q[1], 6 * s, 0, TAU); ctx.stroke();
      }
      for (const t of g.troops) if (t.role === 'cart' && t.alive && (t.team === g.playerKey || g.isExplored(t.x, t.y))) { const q = P(t.x, t.y); ctx.fillStyle = g.factions[t.team].def.color2; ctx.fillRect(q[0] - 1.5 * s, q[1] - 1.5 * s, 3 * s, 3 * s); }
      // soldiers: all of yours (garrison, patrols, the warband on the march), and rival warbands marching through land you have seen
      for (const t of g.troops) {
        if (!t.alive || t.role === 'cart' || !t.faction) continue;
        const mine = t.team === g.playerKey;
        if (!mine && !(t.state === 'march' && g.isExplored(t.x, t.y))) continue;
        const q = P(t.x, t.y); if (q[0] < x - 4 || q[1] < y - 4 || q[0] > x + size + 4 || q[1] > y + size + 4) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.arc(q[0], q[1], 3.3 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = t.faction.def.color; ctx.beginPath(); ctx.arc(q[0], q[1], 2.4 * s, 0, TAU); ctx.fill();
      }
      for (const d of g.dragons) {
        if (!d.targetable || (d !== p && !g.isExplored(d.x, d.y))) continue;
        const q = P(d.x, d.y);
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(d.angle + Math.PI / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.moveTo(0, -7 * s); ctx.lineTo(6 * s, 6 * s); ctx.lineTo(-6 * s, 6 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d === p ? '#ffffff' : d.fdef.color; ctx.beginPath(); ctx.moveTo(0, -5.5 * s); ctx.lineTo(4.5 * s, 4.5 * s); ctx.lineTo(-4.5 * s, 4.5 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.font = F(Math.round(11 * s)); ctx.textAlign = 'center'; ctx.fillStyle = COL.dim;
      ctx.fillText('M — WAR MAP', x + size / 2, y + size + 1 * s);
    },

    // one texel per fog cell, refreshed twice a second; drawn smoothed
    fogLayer(g) {
      if (!this.fog || this.fog.width !== g.fogW || this.fog.height !== g.fogH) { this.fog = AS.Forge.canvas(g.fogW, g.fogH); this.fogT = -1; }
      if (g.time - this.fogT > 0.5 || this.fogG !== g) {
        this.fogT = g.time; this.fogG = g;
        const c = this.fog.getContext('2d'), img = c.createImageData(g.fogW, g.fogH), D = img.data;
        for (let i = 0; i < g.explored.length; i++) { D[i * 4] = 12; D[i * 4 + 1] = 8; D[i * 4 + 2] = 6; D[i * 4 + 3] = g.explored[i] ? 0 : 170; }
        c.putImageData(img, 0, 0);
      }
      return this.fog;
    },

    /* ---------- bottom-right: blessings and the spell slot ---------- */
    buffs(ctx, g, W, H, s, dt) {
      const p = g.player, P = AS.Powerups ? AS.Powerups.POWER : {};
      let x = W - 16 * s, y = H - 16 * s;
      // spell slot
      const sw = 62 * s;
      plate(ctx, x - sw, y - sw, sw, sw, 10 * s, 0.8);
      if (p.spell) {
        const D = P[p.spell];
        icon(ctx, 'pw_' + p.spell, x - sw / 2, y - sw / 2 - 4 * s, 26 * s, D.col);
        ctx.font = F(Math.round(11.5 * s)); ctx.textAlign = 'center'; ctx.fillStyle = COL.parch;
        ctx.fillText('Q ×' + p.spellCharges, x - sw / 2, y - 10 * s);
      } else { ctx.font = F(Math.round(11 * s)); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(240,226,192,0.35)'; ctx.fillText('NO SPELL', x - sw / 2, y - sw / 2); }
      x -= sw + 10 * s;
      for (const k in p.buffs) {
        const D = P[k]; if (!D) continue;
        const r = 20 * s, frac = p.buffs[k] / (D.dur || 1);
        const cx = x - r, cy = y - r - 10 * s;
        ctx.fillStyle = 'rgba(20,12,8,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = D.col; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(cx, cy, r - 2 * s, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
        const fl = this.buffFlash[k] || 0; if (fl > 0) this.buffFlash[k] = fl - dt;
        icon(ctx, 'pw_' + k, cx, cy, 20 * s * (1 + fl * 0.5), D.col);
        x -= r * 2 + 8 * s;
      }
    },

    /* ---------- contextual prompts ---------- */
    prompts(ctx, g, W, H, s) {
      const p = g.player, R = AS.Renderer, cam = g.camera;
      if (p.down > 0) return;
      const lines = [];
      const Fp = g.playerFaction;
      if (!g.opts.conquest && Math.hypot(p.x - Fp.townPos.x, p.y - Fp.townPos.y) < 520) lines.push(['T', 'HOLD COURT — SPEND YOUR GOLD']);
      if (p.pilot && p.pilot.quarry) lines.push(['W A S D', 'HUNTING — ANY FLIGHT KEY BREAKS OFF']);
      else if (p.carry) lines.push(['E', p.carry.owner && p.carry.owner !== p.team ? 'EAT — OR CARRY IT HOME TO YOUR PASTURES' : 'EAT YOUR PREY']);
      else if (AS.Life.preyInReach(g, p)) lines.push(['E', 'SNATCH AND EAT — HOLD E TO CARRY IT HOME']);
      else if (p.energy < p.maxEnergy * 0.3 && !p.carry) lines.push(['2× CLICK', 'HUNGRY — DOUBLE-CLICK AN ANIMAL TO SWOOP ON IT']);
      if (p.landed) lines.push(['W', 'TAKE OFF — RESTING HEALS AND SAVES ENERGY']);
      else if (!p.carry && p.speed < 110 && p.z < 52 && p.braking && p.canLand && p.canLand()) lines.push(['S', 'KEEP FLARING TO LAND']);
      const gate = AS.Sites && AS.Sites.gateAt(g, p);
      if (gate && AS.Sites.gatesOf(g, p.team).length > 1) lines.push(['E', 'TRAVEL THROUGH THE WAYGATE']);
      // capture progress of the site we are over
      for (const site of g.sites) {
        if (Math.hypot(p.x - site.x, p.y - site.y) > site.capR) continue;
        if (site.guarded()) lines.push(['', site.name.toUpperCase() + ' IS GUARDED — DEFEAT ITS GUARDIANS']);
        else if (site.def.treasure && !site.looted) lines.push(['', 'DESCEND TO CLAIM THE HOARD']);
        else if (site.owner !== p.team && !site.looted) {
          if (p.z > 46) lines.push(['SPACE', 'FLY LOWER TO CLAIM ' + site.name.toUpperCase()]);
          else if (site.contested) lines.push(['', site.name.toUpperCase() + ' IS CONTESTED']);
          else lines.push(['', (site.controller === p.team ? 'CLAIMING ' : 'BREAKING ITS HOLD — ') + site.name.toUpperCase() + ' ' + Math.round((site.controller === p.team ? site.control : 1 - site.control) * 100) + '%']);
        }
        break;
      }
      let y = H * 0.72;
      ctx.textAlign = 'center';
      for (const [key, text] of lines.slice(0, 3)) {
        ctx.font = F(Math.round(13.5 * s));
        const tw = ctx.measureText(text).width, kw = key ? (ctx.measureText(key).width + 18 * s) : 0;
        const w = tw + kw + 30 * s, x = W / 2 - w / 2;
        plate(ctx, x, y - 14 * s, w, 28 * s, 14 * s, 0.68);
        if (key) { K.rrect(ctx, x + 8 * s, y - 9 * s, kw, 18 * s, 4 * s); ctx.fillStyle = 'rgba(255,220,140,0.15)'; ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#ffe6a0'; ctx.fillText(key, x + 8 * s + kw / 2, y + 1 * s); }
        ctx.fillStyle = COL.parch; ctx.fillText(text, x + kw + 15 * s + tw / 2, y + 1 * s);
        y += 34 * s;
      }
    },

    /* ---------- in-world marks: rival dragons and home at the screen edge ---------- */
    worldMarks(ctx, g, W, H, s) {
      const R = AS.Renderer, cam = g.camera, p = g.player;
      const marks = [];
      this.preyMarks(ctx, g, s);
      for (const d of g.dragons) if (d !== p && d.alive && d.down <= 0 && Math.hypot(d.x - p.x, d.y - p.y) < 1800) marks.push({ x: d.x, y: d.y - d.z, col: d.fdef.color, label: d.name, kind: 'wing', d });
      const home = g.playerFaction.townPos;
      marks.push({ x: home.x, y: home.y, col: COL.gold, label: 'HOME', kind: 'castle' });
      if (this.advTarget) marks.push({ x: this.advTarget.x, y: this.advTarget.y, col: '#fff2c0', label: this.advTarget.label || '', kind: 'flag' });
      // the course set on the war map: arrived when close, otherwise marked on the ground or at the edge
      const wp = g.waypoint;
      if (wp && Math.hypot(wp.x - p.x, wp.y - p.y) < 220) { g.msg('ARRIVED — ' + wp.label, '#ffe28c', 2); g.waypoint = null; }
      else if (wp) marks.push({ x: wp.x, y: wp.y, col: '#ffe28c', label: wp.label, kind: 'flag', wp: true });
      const m = 46 * s;
      for (const mk of marks) {
        const q = R.worldToScreen(mk.x, mk.y, cam);
        const on = q.x > m && q.y > m && q.x < W - m && q.y < H - m;
        if (on) {
          if (mk.kind === 'wing') this.dragonTag(ctx, mk.d, q.x, q.y - 58 * s, s);
          if (mk.wp) {
            // the destination itself: a pulsing ring with its name
            const r = (18 + Math.sin(this.t * 4) * 3) * s;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
            ctx.strokeStyle = mk.col; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
            icon(ctx, 'flag', q.x, q.y - r - 12 * s, 16 * s, mk.col);
            ctx.font = F(Math.round(12 * s)); ctx.textAlign = 'center';
            K.keyText(ctx, mk.label, q.x, q.y + r + 14 * s, mk.col, 3 * s);
          }
          continue;
        }
        const cx = W / 2, cy = H / 2, a = Math.atan2(q.y - cy, q.x - cx);
        // (the course arrow rides a ring round the dragon, clear of the HUD panels in the corners)
        const ex = mk.wp ? cx + Math.cos(a) * Math.min(W * 0.34, H * 0.42) : U.clamp(cx + Math.cos(a) * W, m, W - m);
        const ey = mk.wp ? cy + Math.sin(a) * Math.min(W * 0.34, H * 0.42) * 0.82 : U.clamp(cy + Math.sin(a) * H, m, H - m);
        ctx.save(); ctx.translate(ex, ey);
        ctx.fillStyle = 'rgba(16,10,6,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 15 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = mk.col; ctx.lineWidth = 1.5 * s; ctx.stroke();
        icon(ctx, mk.kind, 0, 0, 16 * s, mk.col);
        if (mk.wp) {
          // the course arrow is larger, pulses, and names the destination
          ctx.lineWidth = 2.5 * s; ctx.strokeStyle = mk.col; ctx.beginPath(); ctx.arc(0, 0, (19 + Math.sin(this.t * 4) * 2) * s, 0, TAU); ctx.stroke();
          ctx.font = F(Math.round(11.5 * s)); ctx.textAlign = 'center';
          const ly = ey > H / 2 ? 34 * s : -32 * s, lx = 0;
          K.keyText(ctx, mk.label, lx, ly, mk.col, 3 * s);
          ctx.rotate(a); ctx.fillStyle = mk.col; ctx.beginPath(); ctx.moveTo(30 * s, 0); ctx.lineTo(19 * s, -9 * s); ctx.lineTo(19 * s, 9 * s); ctx.closePath(); ctx.fill();
        } else { ctx.rotate(a); ctx.fillStyle = mk.col; ctx.beginPath(); ctx.moveTo(22 * s, 0); ctx.lineTo(15 * s, -6 * s); ctx.lineTo(15 * s, 6 * s); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    },

    /* the animal being hunted (double-click) gets a closing reticle; an animal
     * under the cursor gets a faint ring, so the double-click is discoverable */
    preyMarks(ctx, g, s) {
      const R = AS.Renderer, cam = g.camera, p = g.player, pl = p.pilot;
      const ring = (o, col, r, a, spin) => {
        const q = R.worldToScreen(o.x, o.y - 4, cam);
        ctx.save(); ctx.translate(q.x, q.y); ctx.globalAlpha = a;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
        if (spin !== undefined) {
          for (let i = 0; i < 4; i++) { const a0 = spin + i * TAU / 4; ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 0.9); ctx.stroke(); }
          for (let i = 0; i < 4; i++) { const a0 = i * TAU / 4 + TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * (r + 9 * s), Math.sin(a0) * (r + 9 * s)); ctx.lineTo(Math.cos(a0) * (r + 3 * s), Math.sin(a0) * (r + 3 * s)); ctx.stroke(); }
        } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
        ctx.restore();
        return q;
      };
      if (pl && pl.quarry && pl.quarry.o.alive) {
        const r = (16 + Math.sin(this.t * 7) * 3) * s;
        const q = ring(pl.quarry.o, '#ffd27a', r, 1, this.t * 2.2);
        ctx.font = F(Math.round(11 * s)); ctx.textAlign = 'center';
        K.keyText(ctx, 'DINNER', q.x, q.y - r - 12 * s, '#ffd27a', 3 * s);
        return;
      }
      if (AS.Input.usingPad || g.uiBlocking || p.carry) return;
      const m = AS.Input.mouse, w = R.screenToWorld(m.x, m.y, cam);
      const o = AS.Life.preyAt(g, w.x, w.y, 30);
      if (!o) return;
      const q = ring(o, '#fff2c0', 14 * s, 0.75);
      if (p.energy < p.maxEnergy * 0.9) {
        ctx.font = B(Math.round(12 * s), '700'); ctx.textAlign = 'center';
        K.keyText(ctx, 'DOUBLE-CLICK TO HUNT', q.x, q.y + 26 * s, '#fff2c0', 3 * s);
      }
    },

    // a rival dragon's name plate: name, health bar, and a flash when it is hurt
    dragonTag(ctx, d, x, y, s) {
      const w = 92 * s, h = 7 * s, hp = U.clamp(d.hp / d.maxHp, 0, 1);
      ctx.font = F(Math.round(13.5 * s)); ctx.textAlign = 'center';
      const tw = ctx.measureText(d.name.toUpperCase()).width;
      const bw = Math.max(w, tw + 16 * s) + 8 * s;
      ctx.fillStyle = 'rgba(12,8,5,0.72)'; K.rrect(ctx, x - bw / 2, y - 16 * s, bw, 30 * s, 5 * s); ctx.fill();
      ctx.strokeStyle = C.str(d.fdef.color, 0.8); ctx.lineWidth = 1.2 * s; ctx.stroke();
      K.keyText(ctx, d.name.toUpperCase(), x, y - 3 * s, d.fdef.color, 3 * s);
      const bx = x - w / 2, by = y + 3 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
      ctx.fillStyle = hp > 0.5 ? '#6ed06a' : hp > 0.25 ? '#f0c040' : '#ff5a3a';
      ctx.fillRect(bx, by, w * hp, h);
      if (d.hurt > 0.2) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, d.hurt) + ')'; ctx.fillRect(bx, by, w * hp, h); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, w * hp, h * 0.35);
    },
    messages(ctx, g, W, H, s) {
      let y = H * 0.2;
      ctx.textAlign = 'center';
      for (const m of g.msgs) {
        const a = Math.min(1, m.t * 2) * Math.min(1, (m.max - m.t) * 6 + 0.3);
        ctx.globalAlpha = a;
        ctx.font = F(Math.round(17 * s));
        K.keyText(ctx, m.text, W / 2, y, m.col, 4 * s);
        y += 26 * s;
      }
      ctx.globalAlpha = 1;
    },
    downBanner(ctx, g, W, H, s) {
      const p = g.player;
      const w = 420 * s, h = 64 * s, x = W / 2 - w / 2, y = H * 0.38;
      plate(ctx, x, y, w, h, 12 * s, 0.85);
      ctx.textAlign = 'center'; ctx.font = F(Math.round(18 * s)); ctx.fillStyle = '#ff9a7a';
      ctx.fillText(p.name.toUpperCase() + ' IS RECOVERING', W / 2, y + 22 * s);
      ctx.font = B(Math.round(13.5 * s)); ctx.fillStyle = COL.parch;
      ctx.fillText('Back in the sky in ' + Math.ceil(p.down) + 's — your ward is weakened while you are down', W / 2, y + 44 * s);
    },
  };
  AS.HUD = HUD;
})(window.AS);
