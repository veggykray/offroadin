/* ALIEN STRIKE — in-flight HUD, drawn at native resolution over the upscaled world.
 * Top-left: hull / shield / fuel. Top-right: objectives. Bottom-left: radar.
 * Bottom-right: weapons, kits, cargo & passengers. Centre: reticle and locks. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const F = (px, w) => (w || '600') + ' ' + px + 'px "Chakra Petch", "Share Tech Mono", monospace';
  const M = (px) => px + 'px "Share Tech Mono", monospace';
  const COL = { cyan: '#7fe8ff', amber: '#ffc35a', red: '#ff5a3a', green: '#7dff9a', dim: 'rgba(127,232,255,0.35)', panel: 'rgba(8,14,20,0.62)', line: 'rgba(127,232,255,0.55)', white: '#e8f4f8', violet: '#c58aff' };

  function panel(ctx, x, y, w, h, cut) {
    cut = cut || 8;
    ctx.beginPath();
    ctx.moveTo(x + cut, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + cut); ctx.closePath();
    ctx.fillStyle = COL.panel; ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.stroke();
  }
  function bar(ctx, x, y, w, h, frac, col, segs, label, value, warn, t) {
    ctx.font = F(Math.round(h * 0.9), '700'); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = warn && Math.sin(t * 10) > 0 ? COL.red : col;
    ctx.fillText(label, x, y + h / 2);
    const bx = x + h * 4.2, bw = w - h * 4.2 - h * 3.4;
    const n = segs || 20, gap = 2, sw = (bw - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const on = (i + 1) / n <= frac + 0.001 || (i / n < frac);
      ctx.fillStyle = on ? (warn && Math.sin(t * 10) > 0 ? COL.red : col) : 'rgba(127,232,255,0.1)';
      ctx.beginPath();
      const sx = bx + i * (sw + gap);
      ctx.moveTo(sx + 2, y); ctx.lineTo(sx + sw, y); ctx.lineTo(sx + sw - 2, y + h); ctx.lineTo(sx, y + h); ctx.closePath(); ctx.fill();
    }
    ctx.textAlign = 'right'; ctx.font = M(Math.round(h * 0.95));
    ctx.fillStyle = col; ctx.fillText(value, x + w, y + h / 2);
  }

  const HUD = {
    t: 0, damageFlash: 0, lastHull: null,
    draw(ctx, g, dt) {
      this.t += dt;
      const R = AS.Renderer, dpr = R.dpr;
      const W = R.canvas.width, H = R.canvas.height;
      const s = Math.max(0.75, Math.min(1.6, H / 900)) * dpr; // UI scale
      const p = g.player;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.vignette(ctx, g, W, H, dt);
      if (!p) { ctx.restore(); return; }
      this.reticle(ctx, g, s);
      this.offscreen(ctx, g, s, W, H);
      this.status(ctx, g, s);
      this.objectives(ctx, g, s, W);
      this.radar(ctx, g, s, H);
      this.weapons(ctx, g, s, W, H);
      this.center(ctx, g, s, W, H);
      ctx.restore();
    },

    vignette(ctx, g, W, H, dt) {
      const p = g.player;
      if (!p) return;
      if (this.lastHull !== null && p.hull < this.lastHull - 0.5) this.damageFlash = Math.min(1, this.damageFlash + (this.lastHull - p.hull) * 0.06);
      this.lastHull = p.hull;
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
      const low = p.hull / p.s.hullMax < 0.25 ? 0.25 + Math.sin(this.t * 6) * 0.12 : 0;
      const a = Math.max(this.damageFlash * 0.6, low);
      if (a > 0.01) {
        const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
        gr.addColorStop(0, 'rgba(255,40,20,0)'); gr.addColorStop(1, 'rgba(255,40,20,' + a + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
    },

    status(ctx, g, s) {
      const p = g.player, st = p.s, t = this.t;
      const x = 16 * s, y = 14 * s, w = 300 * s, h = 92 * s;
      panel(ctx, x, y, w, h, 10 * s);
      const bh = 13 * s, bx = x + 12 * s, bw = w - 24 * s;
      const hullF = p.hull / st.hullMax, shF = Math.min(1.3, p.shield / st.shieldMax), fuF = p.fuel / st.fuelMax;
      bar(ctx, bx, y + 12 * s, bw, bh, hullF, hullF < 0.25 ? COL.red : hullF < 0.5 ? COL.amber : COL.green, 20, 'HULL', Math.ceil(p.hull) + '', hullF < 0.25, t);
      bar(ctx, bx, y + 33 * s, bw, bh, Math.min(1, shF), shF > 1 ? '#ffffff' : '#6ab8ff', 20, 'SHLD', Math.ceil(p.shield) + '', false, t);
      bar(ctx, bx, y + 54 * s, bw, bh, fuF, fuF < 0.1 ? COL.red : fuF < 0.25 ? COL.amber : COL.amber, 20, 'FUEL', Math.round(fuF * 100) + '%', fuF < 0.15, t);
      // speed / status strip
      ctx.font = M(11 * s); ctx.textAlign = 'left'; ctx.fillStyle = COL.dim;
      const spd = Math.round(p.speed);
      let line = 'SPD ' + U.pad(spd, 3) + (p.boosting ? '  BOOST' : '') + '   T+' + U.fmtTime(g.time);
      if (p.onPad && p.pad_service) line += '   SERVICING';
      ctx.fillText(line, bx, y + 80 * s);
      // warnings
      let wy = y + h + 16 * s;
      const warn = (txt, col, blink) => {
        if (blink && Math.sin(t * 9) < 0) { wy += 20 * s; return; }
        ctx.font = F(14 * s, '700'); ctx.fillStyle = col; ctx.textAlign = 'left';
        ctx.fillText('▲ ' + txt, x + 4 * s, wy); wy += 20 * s;
      };
      if (p.emergency > 0) warn('EMERGENCY RESERVE ' + Math.ceil(p.emergency) + 's — FIND FUEL', COL.red, true);
      else if (fuF < 0.15) warn('FUEL CRITICAL', COL.red, true);
      if (g.missileWarn > 0) warn('INCOMING MISSILE', COL.red, true);
      else if (g.lockWarn > 0) warn('MISSILE LOCK DETECTED', COL.amber, true);
      if (p.overheated > 0) warn('WEAPON OVERHEAT', COL.amber, true);
      if (hullF < 0.25) warn('HULL CRITICAL', COL.red, false);
      if (g.hazards && g.hazards.scramble > 0) warn('FLIGHT CONTROLS CONTAMINATED', '#e0a0ff', true);
      if (g.hazards && g.hazards.heat > 0.2) warn('EXTREME HEAT — SHIELDS BURNING', COL.amber, false);
      if (g.hazards && (g.hazards.sand > 0.4 || g.hazards.whiteout > 0.4)) warn(g.hazards.sand > 0.4 ? 'SANDSTORM — SCANNER DEGRADED' : 'WHITEOUT — SCANNER DEGRADED', COL.amber, false);
    },

    objectives(ctx, g, s, W) {
      const list = g.script.visibleObjectives();
      const hidden = g.script.hiddenCount();
      const w = 330 * s, x = W - w - 16 * s, y = 14 * s;
      const rows = list.filter((o) => o.state !== 'done' || (g.time - (o.doneAt || (o.doneAt = g.time))) < 6);
      const extra = (g.extraction.active ? 1 : 0) + (hidden ? 1 : 0);
      const h = 30 * s + (rows.length + extra) * 20 * s;
      panel(ctx, x, y, w, h, 10 * s);
      ctx.font = F(12 * s, '700'); ctx.fillStyle = COL.cyan; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('OBJECTIVES', x + 12 * s, y + 13 * s);
      ctx.font = M(10 * s); ctx.fillStyle = COL.dim; ctx.textAlign = 'right';
      ctx.fillText('[TAB] DETAILS', x + w - 10 * s, y + 13 * s);
      let yy = y + 32 * s;
      ctx.textAlign = 'left';
      for (const o of rows) {
        const done = o.state === 'done', failed = o.state === 'failed';
        const icon = done ? '✔' : failed ? '✖' : o.cat === 'primary' ? '◆' : o.cat === 'hidden' ? '★' : '◇';
        const col = done ? COL.green : failed ? COL.red : o.cat === 'primary' ? COL.white : o.cat === 'hidden' ? '#ffd36b' : 'rgba(200,230,240,0.75)';
        ctx.fillStyle = col; ctx.font = F(12 * s, o.cat === 'primary' ? '600' : '400');
        let txt = g.script.text(o);
        const maxW = w - 36 * s;
        while (ctx.measureText(txt).width > maxW && txt.length > 4) txt = txt.slice(0, -2);
        if (txt !== g.script.text(o)) txt += '…';
        ctx.fillText(icon + ' ' + txt, x + 12 * s, yy);
        yy += 20 * s;
      }
      if (g.extraction.active) {
        ctx.fillStyle = Math.sin(this.t * 4) > 0 ? COL.green : '#bfffd0'; ctx.font = F(12 * s, '700');
        ctx.fillText('➤ EXTRACT AT THE LANDING ZONE', x + 12 * s, yy); yy += 20 * s;
      }
      if (hidden) { ctx.fillStyle = 'rgba(255,211,107,0.6)'; ctx.font = F(11 * s, '400'); ctx.fillText('★ ' + hidden + ' HIDDEN OBJECTIVE' + (hidden > 1 ? 'S' : '') + ' — EXPLORE', x + 12 * s, yy); }
    },

    radar(ctx, g, s, H) {
      const p = g.player;
      const r = 92 * s, cx = 16 * s + r + 6 * s, cy = H - 16 * s - r - 6 * s;
      const range = p.s.scanRange * (g.hazards ? g.hazards.scanMul() : 1);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r + 4 * s, 0, TAU); ctx.fillStyle = 'rgba(6,14,18,0.72)'; ctx.fill();
      ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5 * s; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      // rings & sweep
      ctx.strokeStyle = 'rgba(127,232,255,0.12)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, r * i / 3, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      const sw = (this.t * 1.6) % TAU;
      const grd = ctx.createConicGradient ? ctx.createConicGradient(sw - 0.8, cx, cy) : null;
      if (grd) { grd.addColorStop(0, 'rgba(127,232,255,0)'); grd.addColorStop(0.12, 'rgba(127,232,255,0.22)'); grd.addColorStop(0.125, 'rgba(127,232,255,0)'); ctx.fillStyle = grd; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
      if (g.hazards && (g.hazards.sand > 0.3 || g.hazards.whiteout > 0.3)) { for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(200,230,240,' + Math.random() * 0.25 + ')'; ctx.fillRect(cx - r + Math.random() * r * 2, cy - r + Math.random() * r * 2, 2 * s, 2 * s); } }
      const k = r / range;
      const blip = (x, y, col, size, shape) => {
        const dx = (x - p.x) * k, dy = (y - p.y) * k;
        if (dx * dx + dy * dy > r * r) return;
        ctx.fillStyle = col;
        const sz = size * s;
        if (shape === 'sq') ctx.fillRect(cx + dx - sz, cy + dy - sz, sz * 2, sz * 2);
        else if (shape === 'tri') { ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - sz * 1.4); ctx.lineTo(cx + dx + sz * 1.2, cy + dy + sz); ctx.lineTo(cx + dx - sz * 1.2, cy + dy + sz); ctx.fill(); }
        else if (shape === 'ring') { ctx.strokeStyle = col; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, sz * 1.5, 0, TAU); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, sz, 0, TAU); ctx.fill(); }
      };
      const lvl = p.s.scanLevel;
      for (const q of g.pickups) if (q.alive && (!q.hidden || lvl >= 2)) blip(q.x, q.y, '#ffd36b', 1.6, 'sq');
      for (const st of g.structures) {
        if (!st.alive || st.role === 'scenery') continue;
        if (st.hidden && !g.revealHidden) continue;
        if (st.role === 'pad') { blip(st.x, st.y, COL.green, 3, 'ring'); continue; }
        if (st.role === 'console') { blip(st.x, st.y, '#7fe8ff', 2.2, 'sq'); continue; }
        blip(st.x, st.y, st.team === 'player' ? COL.green : (st.submerged && !st.scanned ? 'rgba(255,255,255,0.5)' : '#ff9a5a'), 2.6, 'sq');
      }
      for (const gr of g.groups) if (gr.remaining > 0) blip(gr.x, gr.y, '#7fe8ff', 2.4, 'tri');
      for (const c of g.cargo) if (!c.aboard && !c.delivered) blip(c.x, c.y, '#9ff6ff', 2, 'sq');
      for (const u of g.units) {
        if (!u.alive) continue;
        if (u.team === 'player') { blip(u.x, u.y, COL.green, 2, 'dot'); continue; }
        if (u.burrowed || u.submerged) { if (lvl >= 3) blip(u.x, u.y, 'rgba(255,255,255,0.55)', 1.8, 'dot'); continue; }
        if (u.hidden && lvl < 3) continue;
        blip(u.x, u.y, u.air ? '#ff7ad8' : COL.red, u.boss ? 4 : u.r > 16 ? 2.6 : 1.8, u.air ? 'tri' : 'dot');
      }
      if (g.extraction) blip(g.extraction.x, g.extraction.y, g.extraction.active ? COL.green : 'rgba(125,255,154,0.6)', 4, 'ring');
      ctx.restore();
      // own arrow
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -6 * s); ctx.lineTo(4 * s, 5 * s); ctx.lineTo(0, 3 * s); ctx.lineTo(-4 * s, 5 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = M(10 * s); ctx.fillStyle = COL.dim; ctx.textAlign = 'center';
      ctx.fillText('SCAN ' + Math.round(range) + 'm', cx, cy + r + 0 * s - 6 * s);
      ctx.fillText('N', cx, cy - r + 10 * s);
      ctx.fillText('[M] TACTICAL MAP', cx, cy - r - 12 * s);
    },

    weapons(ctx, g, s, W, H) {
      const p = g.player, st = p.s;
      const w = 310 * s, h = 150 * s, x = W - w - 16 * s, y = H - h - 16 * s;
      panel(ctx, x, y, w, h, 10 * s);
      const row = (yy, key, name, ammo, sub, col, extraFn) => {
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.font = M(10 * s); ctx.fillStyle = COL.dim; ctx.fillText(key, x + 12 * s, yy);
        ctx.font = F(13 * s, '700'); ctx.fillStyle = col; ctx.fillText(name, x + 42 * s, yy);
        ctx.textAlign = 'right'; ctx.font = M(15 * s); ctx.fillStyle = ammo === 0 ? COL.red : COL.white; ctx.fillText(String(ammo), x + w - 12 * s, yy);
        if (sub) { ctx.font = M(10 * s); ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.fillText(sub, x + 42 * s, yy + 14 * s); }
        if (extraFn) extraFn(yy);
      };
      const P = st.primary;
      row(y + 18 * s, 'LMB', P.short, Math.floor(p.ammo.primary), null, '#9fe8ff', (yy) => {
        const bx = x + 42 * s, bw = 150 * s;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, yy + 10 * s, bw, 4 * s);
        ctx.fillStyle = p.overheated > 0 ? (Math.sin(this.t * 12) > 0 ? COL.red : COL.amber) : p.heat > 70 ? COL.amber : '#9fe8ff';
        ctx.fillRect(bx, yy + 10 * s, bw * p.heat / 100, 4 * s);
        ctx.font = M(9 * s); ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.fillText(p.overheated > 0 ? 'OVERHEAT' : 'HEAT', bx + bw + 6 * s, yy + 12 * s);
      });
      const S2 = st.secondary;
      const lockTxt = S2.kind === 'missile' ? (p.locks.length ? 'LOCKS ' + p.locks.length + '/' + S2.multi : 'HOLD TO LOCK · MULTI ' + S2.multi) : '';
      row(y + 52 * s, 'RMB', S2.short, p.ammo.secondary, lockTxt, '#ff9a5a');
      const X = st.special;
      row(y + 86 * s, 'SPC', X.short, p.ammo.special, p.specialCd > 0 ? 'CYCLING ' + p.specialCd.toFixed(1) + 's' : 'READY', '#c58aff');
      // kits, cargo, seats
      const by = y + 118 * s;
      ctx.textAlign = 'left'; ctx.font = M(10 * s); ctx.fillStyle = COL.dim;
      ctx.fillText('[R] KITS', x + 12 * s, by);
      for (let i = 0; i < st.kitCap; i++) { ctx.fillStyle = i < p.kits ? COL.green : 'rgba(125,255,154,0.15)'; ctx.fillRect(x + 64 * s + i * 11 * s, by - 4 * s, 8 * s, 8 * s); }
      ctx.fillStyle = COL.dim; ctx.fillText('CARGO', x + 112 * s, by);
      for (let i = 0; i < st.cargoCap; i++) { ctx.fillStyle = i < p.cargo.length ? '#9ff6ff' : 'rgba(159,246,255,0.15)'; ctx.fillRect(x + 152 * s + i * 11 * s, by - 4 * s, 8 * s, 8 * s); }
      ctx.fillStyle = COL.dim; ctx.fillText('SEATS', x + 12 * s, by + 18 * s);
      for (let i = 0; i < st.rescueCap; i++) { ctx.fillStyle = i < p.passengers.length ? '#ffc35a' : 'rgba(255,195,90,0.15)'; ctx.fillRect(x + 54 * s + i * 9 * s, by + 14 * s, 6 * s, 8 * s); }
      ctx.textAlign = 'right'; ctx.fillStyle = '#e8c24a'; ctx.font = M(12 * s);
      ctx.fillText('SALVAGE ' + (g.stats.salvage + g.stats.bonusSalvage), x + w - 12 * s, by + 18 * s);
    },

    reticle(ctx, g, s) {
      const p = g.player, I = AS.Input, R = AS.Renderer, cam = g.camera;
      if (!p.alive || p.dying > 0) return;
      const toScr = (wx, wy) => { const bx = (wx - cam.x) * cam.zoom, by = (wy - cam.y) * cam.zoom; return { x: bx * R.scale + R.offX, y: by * R.scale + R.offY }; };
      const m = I.usingPad && I.padAim.active ? toScr(p.aimX, p.aimY) : { x: I.mouse.x * R.dpr, y: I.mouse.y * R.dpr };
      // aim line from craft
      const c = toScr(p.x, p.py);
      ctx.strokeStyle = 'rgba(127,232,255,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([4 * s, 6 * s]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(m.x, m.y); ctx.stroke(); ctx.setLineDash([]);
      // reticle
      const rr = 13 * s;
      const heat = p.heat / 100;
      ctx.strokeStyle = p.overheated > 0 ? COL.red : heat > 0.7 ? COL.amber : COL.cyan; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath(); ctx.arc(m.x, m.y, rr, a - 0.45, a + 0.45); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(m.x - 1 * s, m.y - 1 * s, 2 * s, 2 * s);
      // special range ring indicator when out of range
      const X = p.s.special;
      if (X.range && U.dist(p.x, p.y, p.aimX, p.aimY + 8) > X.range) { ctx.fillStyle = COL.dim; ctx.font = M(9 * s); ctx.textAlign = 'center'; ctx.fillText('SPECIAL: MAX RANGE', m.x, m.y + 26 * s); }
      // locks
      const bracket = (e, col, k) => {
        const q = toScr(e.x, e.py);
        const r = (e.r + 6) * R.scale * cam.zoom * (k || 1);
        ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
        const L = r * 0.45;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(q.x + sx * r, q.y + sy * (r - L)); ctx.lineTo(q.x + sx * r, q.y + sy * r); ctx.lineTo(q.x + sx * (r - L), q.y + sy * r); ctx.stroke();
        }
        return q;
      };
      for (const e of p.locks) { const q = bracket(e, COL.red); ctx.font = M(10 * s); ctx.fillStyle = COL.red; ctx.textAlign = 'center'; ctx.fillText('LOCK', q.x, q.y - (e.r + 12) * R.scale); }
      if (p.lockCand && p.lockCand.alive) {
        const k = 1.8 - Math.min(1, p.lockT / (p.s.secondary.lockTime * p.s.secondary.lockMul)) * 0.8;
        bracket(p.lockCand, COL.amber, k);
      }
      // hovered target readout
      let hov = null, bd = 30;
      for (const e of g.queryEnemies(p.aimX, p.aimY, 60)) { if (!e.alive || e.isProp || !e.targetable) continue; const d = U.dist(e.x, e.py, p.aimX, p.aimY) - e.r; if (d < bd) { bd = d; hov = e; } }
      if (hov) {
        ctx.font = F(11 * s, '600'); ctx.textAlign = 'left'; ctx.fillStyle = hov.isShielded && hov.isShielded() ? COL.violet : COL.amber;
        const nm = (hov.def.name || hov.kind || '').toUpperCase() + (hov.isShielded && hov.isShielded() ? ' — SHIELDED' : '') + (hov.powered === false ? ' — OFFLINE' : '');
        ctx.fillText(nm, m.x + 18 * s, m.y - 14 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(m.x + 18 * s, m.y - 6 * s, 70 * s, 4 * s);
        ctx.fillStyle = COL.red; ctx.fillRect(m.x + 18 * s, m.y - 6 * s, 70 * s * hov.hp / hov.maxHp, 4 * s);
      }
    },

    offscreen(ctx, g, s, W, H) {
      const p = g.player, cam = g.camera, R = AS.Renderer;
      const targets = AS.HUD.trackedTargets(g);
      for (const t of targets) {
        const bx = (t.x - cam.x) * cam.zoom, by = (t.y - cam.y) * cam.zoom;
        const sx = bx * R.scale + R.offX, sy = by * R.scale + R.offY;
        const m = 40 * s;
        const d = Math.round(U.dist(p.x, p.y, t.x, t.y));
        if (sx > m && sy > m && sx < W - m && sy < H - m) {
          // on-screen marker
          ctx.strokeStyle = t.col; ctx.lineWidth = 1.5 * s;
          const r = 10 * s + Math.sin(this.t * 4) * 2 * s;
          ctx.beginPath(); ctx.moveTo(sx, sy - r - 14 * s); ctx.lineTo(sx + 6 * s, sy - r - 22 * s); ctx.lineTo(sx - 6 * s, sy - r - 22 * s); ctx.closePath(); ctx.stroke();
          continue;
        }
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = W / 2 + Math.cos(a) * (W / 2 - m), ey = H / 2 + Math.sin(a) * (H / 2 - m);
        const cx2 = U.clamp(ex, m, W - m), cy2 = U.clamp(ey, m + 90 * s, H - m - 40 * s);
        ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(a);
        ctx.fillStyle = t.col; ctx.beginPath(); ctx.moveTo(12 * s, 0); ctx.lineTo(-6 * s, 8 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-6 * s, -8 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.font = M(10 * s); ctx.fillStyle = t.col; ctx.textAlign = 'center';
        ctx.fillText(t.label + ' ' + d + 'm', cx2 - Math.cos(a) * 26 * s, cy2 - Math.sin(a) * 18 * s + 3 * s);
      }
    },
    trackedTargets(g) {
      const out = [], p = g.player;
      if (g.extraction.active) out.push({ x: g.extraction.x, y: g.extraction.y, col: COL.green, label: 'EXTRACT' });
      else if (p.passengers.length || p.cargo.some((c) => c.deliver === 'pad')) {
        let best = g.lz, bd = U.dist(p.x, p.y, g.lz.x, g.lz.y);
        for (const pad of g.pads) if (pad.def.dropoff && U.dist(p.x, p.y, pad.x, pad.y) < bd) { best = pad; bd = U.dist(p.x, p.y, pad.x, pad.y); }
        out.push({ x: best.x, y: best.y, col: '#ffc35a', label: 'DROP-OFF' });
      }
      for (const c of p.cargo) if (c.deliver !== 'pad') { const z = g.zones.get(c.deliver) || g.byId.get(c.deliver); if (z) out.push({ x: z.x, y: z.y, col: '#9ff6ff', label: 'PLACE' }); }
      // nearest primary objective target that is known
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed || o.cat === 'hidden') continue;
        const pts = AS.HUD.objectivePoints(g, o);
        let best = null, bd = 1e9;
        for (const q of pts) { const d = U.dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
        if (best && (o.cat === 'primary' || bd < 1600)) out.push({ x: best.x, y: best.y, col: o.cat === 'primary' ? COL.amber : 'rgba(200,230,240,0.8)', label: o.marker || (o.cat === 'primary' ? 'OBJ' : 'OPT') });
        if (out.length > 4) break;
      }
      return out;
    },
    objectivePoints(g, o) {
      const pts = [];
      const add = (id) => { const e = g.byId.get(id) || g.zones.get(id); if (e && (e.alive !== false || e.role === 'console') && !(e.aboard) && !(e.delivered)) pts.push({ x: e.x, y: e.y }); };
      if (o.noMarker) return pts;
      if (o.targets) for (const id of o.targets) { const e = g.byId.get(id); if (e && (e.alive || (o.type === 'interact' && !e.activated && !e.locked) || (o.type === 'scan' && !e.scanned))) { if (o.type === 'interact' && (e.activated || e.locked)) continue; if (o.type === 'scan' && e.scanned) continue; if (o.type !== 'interact' && o.type !== 'scan' && !e.alive) continue; pts.push({ x: e.x, y: e.y }); } }
      if (o.groups) for (const id of o.groups) { const gr = g.groupById(id); if (gr && gr.remaining > 0) pts.push({ x: gr.x, y: gr.y }); }
      if (o.items) for (const id of o.items) { const c = g.byId.get(id); if (c && !c.aboard && !c.delivered) pts.push({ x: c.x, y: c.y }); else if (c && c.aboard && o.to) add(o.to); }
      if (o.zone && o.type !== 'discover') add(o.zone);
      if (o.target) add(o.target);
      if (o.convoy) for (const u of g.convoyUnits(o.convoy)) if (u.alive) { pts.push({ x: u.x, y: u.y }); break; }
      if (o.points) for (const q of o.points) pts.push(q);
      return pts;
    },

    center(ctx, g, s, W, H) {
      const p = g.player;
      // messages
      let y = 112 * s;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const m of g.msgs) {
        const a = Math.min(1, m.t * 2, (m.max - m.t) * 6 + 0.2);
        ctx.globalAlpha = a;
        ctx.font = F(17 * s, '700');
        const tw = ctx.measureText(m.text).width;
        ctx.fillStyle = 'rgba(4,10,14,0.55)'; ctx.fillRect(W / 2 - tw / 2 - 14 * s, y - 13 * s, tw + 28 * s, 26 * s);
        ctx.fillStyle = m.col; ctx.fillText(m.text, W / 2, y);
        y += 30 * s;
      }
      ctx.globalAlpha = 1;
      // boss bar
      if (g.bossActive && g.bossActive.alive) {
        const b = g.bossActive, bw = 520 * s, bx = W / 2 - bw / 2, by = 18 * s;
        ctx.font = F(13 * s, '700'); ctx.fillStyle = '#ff9a7a'; ctx.fillText(b.bossName || b.def.name, W / 2, by + 6 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by + 16 * s, bw, 10 * s);
        ctx.fillStyle = b.isShielded && b.isShielded() ? '#9a6aff' : '#ff4a3a'; ctx.fillRect(bx, by + 16 * s, bw * b.hp / b.maxHp, 10 * s);
        ctx.strokeStyle = 'rgba(255,180,160,0.6)'; ctx.strokeRect(bx, by + 16 * s, bw, 10 * s);
        if (b.statusText) { ctx.font = M(11 * s); ctx.fillStyle = '#ffd0c0'; ctx.fillText(b.statusText(), W / 2, by + 38 * s); }
      }
      // interaction prompt
      const it = p.interactTarget;
      const py = H - 140 * s;
      if (it && p.alive) {
        ctx.font = F(15 * s, '700');
        const txt = p.interactLabel;
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(4,10,14,0.65)'; ctx.fillRect(W / 2 - tw / 2 - 16 * s, py - 16 * s, tw + 32 * s, 32 * s);
        ctx.strokeStyle = COL.line; ctx.strokeRect(W / 2 - tw / 2 - 16 * s, py - 16 * s, tw + 32 * s, 32 * s);
        ctx.fillStyle = COL.cyan; ctx.fillText(txt, W / 2, py);
        if (p.interactT > 0 && it.interactTime) {
          ctx.fillStyle = COL.green; ctx.fillRect(W / 2 - tw / 2 - 16 * s, py + 14 * s, (tw + 32 * s) * Math.min(1, p.interactT / it.interactTime), 3 * s);
        }
      } else if (g.extraction.active && g.extraction.hold > 0) {
        ctx.font = F(16 * s, '700'); ctx.fillStyle = COL.green;
        ctx.fillText('EXTRACTING… ' + Math.max(0, 3 - g.extraction.hold).toFixed(1), W / 2, py);
      } else if (p.onPad && p.pad_service) {
        ctx.font = F(13 * s, '600'); ctx.fillStyle = COL.green; ctx.fillText('ON PAD — REPAIR / REFUEL / REARM IN PROGRESS', W / 2, py);
      }
      // subtitles
      const sub = AS.Voice && AS.Voice.current;
      if (sub && AS.Settings.subtitles !== false) {
        const sy = H - 80 * s;
        ctx.font = F(15 * s, '500');
        const txt = sub.text;
        const tw = ctx.measureText(txt).width;
        ctx.globalAlpha = Math.min(1, sub.t * 3);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - tw / 2 - 14 * s, sy - 14 * s, tw + 28 * s, 30 * s);
        ctx.font = F(11 * s, '700'); ctx.fillStyle = sub.col; ctx.fillText(sub.speaker, W / 2, sy - 22 * s);
        ctx.font = F(15 * s, '500'); ctx.fillStyle = '#f0f4f6'; ctx.fillText(txt, W / 2, sy + 1 * s);
        ctx.globalAlpha = 1;
      }
    },
  };
  AS.HUD = HUD;
  AS.HUD.COL = COL; AS.HUD.F = F; AS.HUD.M = M; AS.HUD.panel = panel;
})(window.AS);
