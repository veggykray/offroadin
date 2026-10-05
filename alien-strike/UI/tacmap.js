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
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(2,6,10,0.82)'; ctx.fillRect(0, 0, W, H);
      const size = Math.min(W - 420 * s, H - 140 * s);
      const mw = g.map.w, mh = g.map.h;
      const sc = size / Math.max(mw, mh);
      const ox = (W - mw * sc) / 2 - 120 * s, oy = (H - mh * sc) / 2 + 20 * s;
      const toM = (x, y) => ({ x: ox + x * sc, y: oy + y * sc });
      // terrain
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(g.tacMap, ox, oy, mw * sc, mh * sc);
      ctx.globalAlpha = 1;
      // fog of war
      const fc = this.fog(g);
      ctx.drawImage(fc, ox, oy, mw * sc, mh * sc);
      // grid
      ctx.strokeStyle = 'rgba(127,232,255,0.12)'; ctx.lineWidth = 1;
      for (let x = 0; x <= mw; x += 500) { ctx.beginPath(); ctx.moveTo(ox + x * sc, oy); ctx.lineTo(ox + x * sc, oy + mh * sc); ctx.stroke(); }
      for (let y = 0; y <= mh; y += 500) { ctx.beginPath(); ctx.moveTo(ox, oy + y * sc); ctx.lineTo(ox + mw * sc, oy + y * sc); ctx.stroke(); }
      ctx.strokeStyle = COL.line; ctx.strokeRect(ox, oy, mw * sc, mh * sc);
      const lvl = g.player.s.scanLevel;
      const icon = (x, y, col, shape, r, label) => {
        const q = toM(x, y); r = (r || 4) * s;
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * s;
        if (shape === 'sq') ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
        else if (shape === 'ring') { ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.5, 0, TAU); ctx.stroke(); }
        else if (shape === 'tri') { ctx.beginPath(); ctx.moveTo(q.x, q.y - r * 1.4); ctx.lineTo(q.x + r * 1.2, q.y + r); ctx.lineTo(q.x - r * 1.2, q.y + r); ctx.closePath(); ctx.fill(); }
        else if (shape === 'diamond') { ctx.beginPath(); ctx.moveTo(q.x, q.y - r * 1.5); ctx.lineTo(q.x + r * 1.5, q.y); ctx.lineTo(q.x, q.y + r * 1.5); ctx.lineTo(q.x - r * 1.5, q.y); ctx.closePath(); ctx.stroke(); }
        else if (shape === 'x') { ctx.beginPath(); ctx.moveTo(q.x - r, q.y - r); ctx.lineTo(q.x + r, q.y + r); ctx.moveTo(q.x + r, q.y - r); ctx.lineTo(q.x - r, q.y + r); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); }
        if (label) { ctx.font = M(10 * s); ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.fillText(label, q.x + r + 4 * s, q.y + 3 * s); }
      };
      // structures (discovered)
      for (const st of g.structures) {
        if (st.role === 'scenery') continue;
        const known = st.seen || g.isExplored(st.x, st.y);
        if (!known) continue;
        if (st.hidden && !g.revealHidden) continue;
        if (st.role === 'pad') { icon(st.x, st.y, COL.green, 'ring', 4, st.id === 'lz' ? 'LZ' : (st.def.repair ? 'FOB' : 'PAD')); continue; }
        if (!st.alive) { icon(st.x, st.y, 'rgba(255,154,90,0.35)', 'x', 3); continue; }
        if (st.role === 'console') { icon(st.x, st.y, '#7fe8ff', 'sq', 3); continue; }
        if (st.team === 'player') { icon(st.x, st.y, COL.green, 'sq', 4); continue; }
        icon(st.x, st.y, st.submerged && !st.scanned ? 'rgba(255,255,255,0.5)' : '#ff9a5a', 'sq', st.r > 20 ? 4 : 3);
      }
      // supplies
      for (const q of g.pickups) {
        if (!q.alive) continue;
        const known = g.isExplored(q.x, q.y) || (lvl >= 2 && !q.dropped);
        if (!known) continue;
        const col = q.kind === 'fuel' ? '#ffb04a' : q.kind === 'repair' ? '#ffffff' : q.kind === 'shield' ? '#6ab8ff' : q.kind === 'tech' ? '#b07cff' : q.kind === 'intel' ? '#5fffe0' : '#e8c24a';
        icon(q.x, q.y, col, 'dot', 2);
      }
      for (const gr of g.groups) if (gr.remaining > 0 && (gr.seen || g.isExplored(gr.x, gr.y) || gr.known)) icon(gr.x, gr.y, '#7fe8ff', 'tri', 4, 'SURVIVORS ×' + gr.remaining);
      for (const c of g.cargo) if (!c.aboard && !c.delivered && (g.isExplored(c.x, c.y) || c.known)) icon(c.x, c.y, '#9ff6ff', 'sq', 3, c.label);
      // objective markers
      for (const o of g.script.objs) {
        if (o.state !== 'active' || !o.revealed) continue;
        for (const pt of AS.HUD.objectivePoints(g, o)) icon(pt.x, pt.y, o.cat === 'primary' ? COL.amber : 'rgba(220,230,240,0.85)', 'diamond', 4);
      }
      for (const mk of g.markers) icon(mk.x, mk.y, mk.col || '#5fffe0', 'diamond', 4, mk.label);
      for (const [id, z] of g.zones) if (z.marker && !z.hidden) icon(z.x, z.y, z.col || '#ffd36b', 'ring', 5, z.label);
      // hazards
      if (g.hazards) for (const z of g.hazards.zones) if (g.isExplored(z.x, z.y)) { const q = toM(z.x, z.y); ctx.strokeStyle = z.type === 'heat' ? 'rgba(255,90,26,0.5)' : z.type === 'current' ? 'rgba(216,228,255,0.4)' : 'rgba(160,200,60,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(q.x, q.y, z.r * sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      // extraction
      icon(g.extraction.x, g.extraction.y, g.extraction.active ? COL.green : 'rgba(125,255,154,0.7)', 'ring', 6, g.extraction.active ? 'EXTRACTION' : 'LZ / DROP-OFF');
      // player
      const p = g.player, q = toM(p.x, p.y);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(6 * s, 7 * s); ctx.lineTo(0, 4 * s); ctx.lineTo(-6 * s, 7 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(127,232,255,0.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, p.s.scanRange * sc, 0, TAU); ctx.stroke();
      // title + legend
      ctx.textAlign = 'left'; ctx.font = F(22 * s, '700'); ctx.fillStyle = COL.cyan;
      ctx.fillText('TACTICAL MAP — ' + g.mission.name, ox, oy - 34 * s);
      ctx.font = M(12 * s); ctx.fillStyle = COL.dim;
      ctx.fillText(g.world.name + ' · ' + g.mission.region + '   (game paused — press M to close)', ox, oy - 14 * s);
      const lx = ox + mw * sc + 30 * s; let ly = oy + 10 * s;
      const leg = (shape, col, txt) => { icon((lx - ox) / sc, (ly - oy) / sc, col, shape, 4); ctx.font = M(12 * s); ctx.fillStyle = '#cfe6ee'; ctx.textAlign = 'left'; ctx.fillText(txt, lx + 16 * s, ly + 4 * s); ly += 24 * s; };
      leg('diamond', COL.amber, 'Primary objective'); leg('diamond', 'rgba(220,230,240,0.85)', 'Optional objective');
      leg('sq', '#ff9a5a', 'Enemy structure'); leg('ring', COL.green, 'Pad / LZ (repair · drop-off)');
      leg('tri', '#7fe8ff', 'Survivors'); leg('sq', '#9ff6ff', 'Cargo'); leg('dot', '#ffb04a', 'Fuel'); leg('dot', '#ffffff', 'Repair'); leg('dot', '#e8c24a', 'Ammo / salvage');
      leg('sq', '#7fe8ff', 'Console / interactable');
      ly += 10 * s;
      ctx.font = M(11 * s); ctx.fillStyle = COL.dim;
      ctx.fillText('SCANNER L' + lvl + (lvl >= 2 ? ' · supply caches revealed' : ' · upgrade to reveal caches'), lx, ly); ly += 18 * s;
      ctx.fillText('Unexplored terrain is hidden.', lx, ly);
      ctx.restore();
    },
    fog(g) {
      if (!this.fogCanvas || this.fogCanvas.width !== g.fogW || this.fogCanvas.height !== g.fogH) {
        this.fogCanvas = AS.Forge.canvas(g.fogW, g.fogH);
      }
      const c = this.fogCanvas.getContext('2d');
      const img = c.createImageData(g.fogW, g.fogH);
      for (let i = 0; i < g.explored.length; i++) {
        const v = g.explored[i];
        img.data[i * 4] = 6; img.data[i * 4 + 1] = 12; img.data[i * 4 + 2] = 18; img.data[i * 4 + 3] = v ? 0 : 235;
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
