/* ALIEN STRIKE — tactical map (M) and objectives panel (Tab).
 * Only explored terrain is shown; markers appear once discovered. Scanner
 * upgrades reveal supply caches (L2) and hidden structures (L3). */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const TacMap = {
    fogCanvas: null,
    draw(ctx, g) {
      const R = AS.Renderer, W = R.canvas.width, H = R.canvas.height, dpr = R.dpr;
      const HUD = AS.HUD, F = HUD.F, M = HUD.M, COL = HUD.COL;
      const s = Math.max(0.75, Math.min(1.6, H / 900)) * dpr;
      const rr = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      // dim the paused world behind a soft vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, 'rgba(2,6,10,0.72)'); vg.addColorStop(1, 'rgba(2,6,10,0.9)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const side = 250 * s;
      const size = Math.min(W - side - 140 * s, H - 150 * s);
      const mw = g.map.w, mh = g.map.h;
      const sc = size / Math.max(mw, mh);
      const MW = mw * sc, MH = mh * sc;
      const ox = Math.round((W - MW - side) / 2), oy = Math.round((H - MH) / 2 + 22 * s);
      const toM = (x, y) => ({ x: ox + x * sc, y: oy + y * sc });
      // ---- map plate: soft drop shadow, rounded frame
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 8 * s;
      rr(ox - 10 * s, oy - 10 * s, MW + 20 * s, MH + 20 * s, 16 * s); ctx.fillStyle = 'rgba(8,16,24,0.92)'; ctx.fill();
      ctx.restore();
      ctx.save();
      rr(ox, oy, MW, MH, 9 * s); ctx.clip();
      // terrain: the whole map faintly, explored ground at full strength behind a soft fog edge
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(g.tacMap, ox, oy, MW, MH);
      ctx.drawImage(this.fog(g), ox, oy, MW, MH);
      // grid with sector labels
      ctx.strokeStyle = 'rgba(127,232,255,0.09)'; ctx.lineWidth = 1;
      for (let x = 500; x < mw; x += 500) { ctx.beginPath(); ctx.moveTo(ox + x * sc + 0.5, oy); ctx.lineTo(ox + x * sc + 0.5, oy + MH); ctx.stroke(); }
      for (let y = 500; y < mh; y += 500) { ctx.beginPath(); ctx.moveTo(ox, oy + y * sc + 0.5); ctx.lineTo(ox + MW, oy + y * sc + 0.5); ctx.stroke(); }
      ctx.font = M(9 * s); ctx.fillStyle = 'rgba(127,232,255,0.3)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (let x = 0, i = 0; x < mw; x += 1000, i++) ctx.fillText(String.fromCharCode(65 + i), ox + x * sc + 4 * s, oy + 4 * s);
      for (let y = 1000, i = 2; y < mh; y += 1000, i++) ctx.fillText(String(i), ox + 4 * s, oy + y * sc + 3 * s);
      // hazard zones
      if (g.hazards) for (const z of g.hazards.zones) if (g.isExplored(z.x, z.y)) { const q = toM(z.x, z.y); ctx.fillStyle = z.type === 'heat' ? 'rgba(255,90,26,0.12)' : z.type === 'current' ? 'rgba(216,228,255,0.1)' : 'rgba(160,200,60,0.12)'; ctx.strokeStyle = z.type === 'heat' ? 'rgba(255,90,26,0.55)' : z.type === 'current' ? 'rgba(216,228,255,0.45)' : 'rgba(160,200,60,0.55)'; ctx.setLineDash([3 * s, 3 * s]); ctx.beginPath(); ctx.arc(q.x, q.y, z.r * sc, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
      ctx.lineWidth = 1.2 * s; ctx.strokeStyle = COL.line; rr(ox, oy, MW, MH, 9 * s); ctx.stroke();

      const lvl = g.player.s.scanLevel;
      const labels = [];
      // icons with a dark halo so they read on any terrain colour
      const icon = (x, y, col, shape, r, label, labelCol) => {
        const q = toM(x, y); r = (r || 4) * s;
        const path = () => {
          ctx.beginPath();
          if (shape === 'sq') ctx.rect(q.x - r, q.y - r, r * 2, r * 2);
          else if (shape === 'ring') ctx.arc(q.x, q.y, r * 1.5, 0, TAU);
          else if (shape === 'tri') { ctx.moveTo(q.x, q.y - r * 1.4); ctx.lineTo(q.x + r * 1.25, q.y + r); ctx.lineTo(q.x - r * 1.25, q.y + r); ctx.closePath(); }
          else if (shape === 'diamond') { ctx.moveTo(q.x, q.y - r * 1.6); ctx.lineTo(q.x + r * 1.6, q.y); ctx.lineTo(q.x, q.y + r * 1.6); ctx.lineTo(q.x - r * 1.6, q.y); ctx.closePath(); }
          else if (shape === 'x') { ctx.moveTo(q.x - r, q.y - r); ctx.lineTo(q.x + r, q.y + r); ctx.moveTo(q.x + r, q.y - r); ctx.lineTo(q.x - r, q.y + r); }
          else ctx.arc(q.x, q.y, r, 0, TAU);
        };
        const stroked = shape === 'ring' || shape === 'x' || shape === 'diamond';
        path(); ctx.lineWidth = (stroked ? 4.2 : 3) * s; ctx.strokeStyle = 'rgba(2,6,10,0.75)'; ctx.stroke();
        path();
        if (stroked) { ctx.lineWidth = 1.8 * s; ctx.strokeStyle = col; ctx.stroke(); if (shape === 'diamond') { ctx.globalAlpha = 0.25; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; } }
        else { ctx.fillStyle = col; ctx.fill(); }
        if (label) labels.push({ x: q.x + r * 1.6 + 5 * s, y: q.y, t: label, col: labelCol || col });
      };
      // structures (discovered)
      for (const st of g.structures) {
        if (st.role === 'scenery') continue;
        const known = st.seen || g.isExplored(st.x, st.y);
        if (!known) continue;
        if (st.hidden && !g.revealHidden) continue;
        if (st.role === 'pad') { if (st.id !== 'lz') icon(st.x, st.y, COL.green, 'ring', 4, st.def.repair ? 'FOB' : 'PAD'); continue; }
        if (!st.alive) { icon(st.x, st.y, 'rgba(255,154,90,0.4)', 'x', 3); continue; }
        if (st.role === 'console') { icon(st.x, st.y, '#7fe8ff', 'sq', 2.6); continue; }
        if (st.team === 'player') { icon(st.x, st.y, COL.green, 'sq', 3.4); continue; }
        icon(st.x, st.y, st.submerged && !st.scanned ? 'rgba(255,255,255,0.5)' : '#ff8a4a', 'sq', st.r > 20 ? 3.6 : 2.8);
      }
      // supplies
      for (const q of g.pickups) {
        if (!q.alive) continue;
        if (!(g.isExplored(q.x, q.y) || (lvl >= 2 && !q.dropped))) continue;
        const col = q.kind === 'fuel' ? '#ffb04a' : q.kind === 'repair' ? '#ffffff' : q.kind === 'shield' ? '#6ab8ff' : q.kind === 'tech' ? '#b07cff' : q.kind === 'intel' ? '#5fffe0' : '#e8c24a';
        icon(q.x, q.y, col, 'dot', 2);
      }
      for (const gr of g.groups) if (gr.remaining > 0 && (gr.seen || g.isExplored(gr.x, gr.y) || gr.known)) icon(gr.x, gr.y, '#7fe8ff', 'tri', 4, 'SURVIVORS ×' + gr.remaining);
      for (const c of g.cargo) if (!c.aboard && !c.delivered && (g.isExplored(c.x, c.y) || c.known)) icon(c.x, c.y, '#9ff6ff', 'sq', 3, c.label);
      // objective markers, labelled once per objective
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed) continue;
        const pts = AS.HUD.objectivePoints(g, o), col = o.cat === 'primary' ? COL.amber : 'rgba(220,230,240,0.9)';
        pts.forEach((pt, i) => icon(pt.x, pt.y, col, 'diamond', 4, i === 0 ? (o.short || o.text || '').toUpperCase().slice(0, 34) : null));
      }
      for (const mk of g.markers) icon(mk.x, mk.y, mk.col || '#5fffe0', 'diamond', 4, mk.label);
      for (const [, z] of g.zones) if (z.marker && !z.hidden) icon(z.x, z.y, z.col || '#ffd36b', 'ring', 5, z.label);
      // extraction
      icon(g.extraction.x, g.extraction.y, g.extraction.active ? COL.green : 'rgba(125,255,154,0.8)', 'ring', 6, g.extraction.active ? 'EXTRACTION' : 'LZ · DROP-OFF');
      // player: scan radius and a glowing arrow
      const p = g.player, pq = toM(p.x, p.y);
      ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = 'rgba(127,232,255,0.4)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.arc(pq.x, pq.y, p.s.scanRange * sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const glow = ctx.createRadialGradient(pq.x, pq.y, 0, pq.x, pq.y, 16 * s);
      glow.addColorStop(0, 'rgba(127,232,255,0.55)'); glow.addColorStop(1, 'rgba(127,232,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(pq.x, pq.y, 16 * s, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(pq.x, pq.y); ctx.rotate(p.angle + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -9 * s); ctx.lineTo(6.5 * s, 7 * s); ctx.lineTo(0, 3.5 * s); ctx.lineTo(-6.5 * s, 7 * s); ctx.closePath();
      ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(2,6,10,0.8)'; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
      // labels last, on small dark tabs, skipping ones that would overlap
      ctx.font = F(10.5 * s, '600'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const placed = [];
      for (const L of labels) {
        const w = ctx.measureText(L.t).width + 10 * s, h = 15 * s;
        let x = L.x, y = L.y - h / 2;
        if (x + w > ox + MW - 4 * s) x = L.x - w - 22 * s;
        if (placed.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y)) continue;
        placed.push({ x, y, w, h });
        rr(x, y, w, h, 4 * s); ctx.fillStyle = 'rgba(4,9,14,0.78)'; ctx.fill();
        ctx.fillStyle = L.col; ctx.fillText(L.t, x + 5 * s, y + h / 2 + 0.5 * s);
      }
      // ---- title
      ctx.textBaseline = 'alphabetic';
      ctx.font = F(22 * s, '700'); ctx.fillStyle = COL.cyan;
      ctx.fillText('TACTICAL MAP', ox, oy - 40 * s);
      const tw = ctx.measureText('TACTICAL MAP').width;
      ctx.font = F(16 * s, '600'); ctx.fillStyle = COL.white; ctx.fillText(g.mission.name, ox + tw + 14 * s, oy - 40 * s);
      ctx.font = M(11.5 * s); ctx.fillStyle = COL.dim;
      ctx.fillText(g.world.name + ' · ' + g.mission.region + '   ·   paused   ·   M to close', ox, oy - 20 * s);
      // ---- side panel: legend + scanner
      const lx = ox + MW + 34 * s, lw = side - 20 * s;
      let ly = oy;
      const ph = 322 * s;
      rr(lx - 14 * s, ly, lw + 14 * s, ph, 12 * s); ctx.fillStyle = 'rgba(6,12,18,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(127,232,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      ly += 26 * s;
      ctx.font = F(12 * s, '700'); ctx.fillStyle = COL.dim; ctx.fillText('LEGEND', lx, ly); ly += 20 * s;
      const leg = (shape, col, txt) => { icon((lx + 6 * s - ox) / sc, (ly - 4 * s - oy) / sc, col, shape, 3.6); ctx.font = M(11.5 * s); ctx.fillStyle = '#cfe6ee'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(txt, lx + 22 * s, ly); ly += 22 * s; };
      labels.length = 0;
      leg('diamond', COL.amber, 'Primary objective'); leg('diamond', 'rgba(220,230,240,0.9)', 'Optional objective');
      leg('sq', '#ff8a4a', 'Enemy structure'); leg('ring', COL.green, 'Pad / LZ: repair, drop-off');
      leg('tri', '#7fe8ff', 'Survivors'); leg('sq', '#9ff6ff', 'Cargo'); leg('dot', '#ffb04a', 'Fuel');
      leg('dot', '#ffffff', 'Repair'); leg('dot', '#e8c24a', 'Ammo / salvage'); leg('sq', '#7fe8ff', 'Console');
      ly += 8 * s;
      ctx.font = M(10.5 * s); ctx.fillStyle = COL.dim;
      ctx.fillText('SCANNER L' + lvl + (lvl >= 2 ? ' · caches revealed' : ' · upgrade for caches'), lx, ly); ly += 16 * s;
      ctx.fillText('Fogged ground is unexplored.', lx, ly);
      ctx.restore();
    },
    fog(g) {
      // one texel per fog cell; scaled up with smoothing it gives soft fog edges
      if (!this.fogCanvas || this.fogCanvas.width !== g.fogW || this.fogCanvas.height !== g.fogH) {
        this.fogCanvas = AS.Forge.canvas(g.fogW, g.fogH);
      }
      const c = this.fogCanvas.getContext('2d');
      const img = c.createImageData(g.fogW, g.fogH);
      for (let i = 0; i < g.explored.length; i++) {
        const v = g.explored[i];
        img.data[i * 4] = 8; img.data[i * 4 + 1] = 16; img.data[i * 4 + 2] = 24; img.data[i * 4 + 3] = v ? 0 : 196;
      }
      c.putImageData(img, 0, 0);
      return this.fogCanvas;
    },

    drawObjectives(ctx, g) {
      const R = AS.Renderer, W = R.canvas.width, H = R.canvas.height, dpr = R.dpr;
      const HUD = AS.HUD, F = HUD.F, M = HUD.M, COL = HUD.COL;
      const s = Math.max(0.75, Math.min(1.6, H / 900)) * dpr;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(2,6,10,0.78)'; ctx.fillRect(0, 0, W, H);
      const w = 760 * s, x = (W - w) / 2;
      let y = 90 * s;
      HUD.panel(ctx, x, y - 40 * s, w, H - 120 * s, 14 * s);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = F(24 * s, '700'); ctx.fillStyle = COL.cyan; ctx.fillText('MISSION OBJECTIVES', x + 24 * s, y);
      ctx.font = M(12 * s); ctx.fillStyle = COL.dim; ctx.fillText(g.mission.name + ' — ' + g.world.name + '   (paused — TAB to close)', x + 24 * s, y + 24 * s);
      y += 60 * s;
      const sect = (title, cat) => {
        const list = g.script.objs.filter((o) => o.cat === cat && o.state !== 'locked' && (o.revealed || o.state === 'done'));
        if (!list.length) return;
        ctx.font = F(14 * s, '700'); ctx.fillStyle = cat === 'primary' ? COL.amber : cat === 'hidden' ? '#ffd36b' : '#cfe6ee';
        ctx.fillText(title, x + 24 * s, y); y += 26 * s;
        for (const o of list) {
          const st = o.state === 'done' ? '✔' : o.state === 'failed' ? '✖' : '○';
          ctx.font = F(15 * s, '500'); ctx.fillStyle = o.state === 'done' ? COL.green : o.state === 'failed' ? COL.red : COL.white;
          ctx.fillText(st + '  ' + g.script.text(o), x + 36 * s, y);
          y += 20 * s;
          if (o.desc) { ctx.font = M(12 * s); ctx.fillStyle = 'rgba(200,225,235,0.6)'; ctx.fillText(o.desc, x + 60 * s, y); y += 18 * s; }
          if (o.reward && o.state !== 'done') { ctx.font = M(11 * s); ctx.fillStyle = '#e8c24a'; ctx.fillText('Bonus: ' + o.reward + ' salvage', x + 60 * s, y); y += 18 * s; }
          y += 6 * s;
        }
        y += 10 * s;
      };
      sect('PRIMARY — REQUIRED FOR EXTRACTION', 'primary');
      sect('SECONDARY — OPTIONAL, EXTRA REWARDS', 'secondary');
      sect('HIDDEN — DISCOVERED', 'hidden');
      const hid = g.script.hiddenCount();
      if (hid) { ctx.font = F(14 * s, '500'); ctx.fillStyle = 'rgba(255,211,107,0.7)'; ctx.fillText('★ ' + hid + ' hidden objective' + (hid > 1 ? 's' : '') + ' remain undiscovered. Explore the area.', x + 24 * s, y); y += 30 * s; }
      if (g.extraction.active) { ctx.font = F(15 * s, '700'); ctx.fillStyle = COL.green; ctx.fillText('EXTRACTION IS AVAILABLE — return to the landing zone and hold position.', x + 24 * s, y); }
      ctx.restore();
    },
  };
  AS.TacMap = TacMap;
})(window.AS);
