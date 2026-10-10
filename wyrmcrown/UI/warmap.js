/* WYRMCROWN — the war map (M). The whole realm as the player knows it: the
 * terrain, fog over unexplored land, every known site with its owner, towns
 * with their strongholds and wards, dragons, gold carts and warbands. Hover a
 * site for its details. Opened from an owned waygate it becomes the travel map:
 * click another owned waygate (or your stronghold) to pass through. The realm
 * pauses while the map is open. The mouse wheel zooms (about the cursor), dragging pans,
 * + / − zoom and 0 shows the whole realm again; zoomed into a streamed realm the land you have
 * explored is painted in sharper as you look (AS.HUD.Detail). */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, K = AS.UIKit;
  const WarMap = {
    travel: null,
    openTravel(g, gate) { this.travel = gate; this.orders = false; AS.App.openOverlay('map'); },
    // G: the war map becomes the muster: click a site or a rival town to march on it
    openOrders(g) { this.orders = true; this.travel = null; AS.App.openOverlay('map'); },
    draw(ctx, g, dt) {
      const R = AS.Renderer, W = R.canvas.width, H = R.canvas.height, dpr = R.dpr, HUD = AS.HUD;
      const s = Math.max(0.95, Math.min(1.7, H / (900 * dpr) * 1.15)) * dpr;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(8,5,3,0.82)'; ctx.fillRect(0, 0, W, H);
      // fit the realm (square or not) into the space left of the side panel
      const boxH = H - 90 * s, boxW = W - 380 * s;
      const k = Math.min(boxW / g.map.w, boxH / g.map.h), sw = g.map.w * k, size = g.map.h * k;
      const x0 = (W - sw) / 2 - 120 * s, y0 = 50 * s;
      const mouse = AS.Input.mouse, mx = mouse.x * dpr, my = mouse.y * dpr, inside = mx > x0 && my > y0 && mx < x0 + sw && my < y0 + size;
      // the view: zoom (1 = the whole realm) about a centre, kept inside the realm
      if (this.vg !== g) { this.vg = g; this.zoom = 1; this.vcx = g.map.w / 2; this.vcy = g.map.h / 2; this.drag = null; }
      const zMax = Math.max(4, g.map.w / 4000), keys = AS.Input.pressed;
      let z = this.zoom;
      const zoomAt = (nz, ax, ay) => {
        nz = U.clamp(nz, 1, zMax);
        const kz0 = k * z, wx = this.vcx - g.map.w / z / 2 + (ax - x0) / kz0, wy = this.vcy - g.map.h / z / 2 + (ay - y0) / kz0;
        z = nz; const kz1 = k * z;
        this.vcx = wx - (ax - x0) / kz1 + g.map.w / z / 2; this.vcy = wy - (ay - y0) / kz1 + g.map.h / z / 2;
      };
      if (inside && mouse.wheel) zoomAt(z * (mouse.wheel < 0 ? 1.3 : 1 / 1.3), mx, my);
      if (keys && (keys.has('Equal') || keys.has('NumpadAdd'))) zoomAt(z * 1.3, x0 + sw / 2, y0 + size / 2);
      if (keys && (keys.has('Minus') || keys.has('NumpadSubtract'))) zoomAt(z / 1.3, x0 + sw / 2, y0 + size / 2);
      if (keys && (keys.has('Digit0') || keys.has('Numpad0'))) { z = 1; this.vcx = g.map.w / 2; this.vcy = g.map.h / 2; }
      if (mouse.lPressed && inside) this.drag = { mx, my, cx: this.vcx, cy: this.vcy, moved: false };
      if (this.drag && mouse.l) { const dx = mx - this.drag.mx, dy = my - this.drag.my; if (Math.abs(dx) + Math.abs(dy) > 5 * s) this.drag.moved = true; if (this.drag.moved) { this.vcx = this.drag.cx - dx / (k * z); this.vcy = this.drag.cy - dy / (k * z); } }
      else this.drag = null;
      this.zoom = z;
      const vw = g.map.w / z, vh = g.map.h / z;
      this.vcx = U.clamp(this.vcx, vw / 2, g.map.w - vw / 2); this.vcy = U.clamp(this.vcy, vh / 2, g.map.h - vh / 2);
      const vx0 = this.vcx - vw / 2, vy0 = this.vcy - vh / 2, kz = k * z;
      this.lay = { x0: x0 - vx0 * kz, y0: y0 - vy0 * kz, k: kz, dpr, zoom: z }; // for tests and tools: world → canvas pixels
      HUD.plate(ctx, x0 - 10 * s, y0 - 10 * s, sw + 20 * s, size + 20 * s, 12 * s, 0.95);
      ctx.save(); K.rrect(ctx, x0, y0, sw, size, 8 * s); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const ts = g.map.w / g.tacMap.width;
      ctx.drawImage(g.tacMap, vx0 / ts, vy0 / ts, vw / ts, vh / ts, x0, y0, sw, size);
      // zoomed into a coarse (streamed) war map: the explored land painted sharper as you look
      if (HUD.Detail && HUD.Detail.wanted(g) && kz * ts > 2.5) {
        const sc = 1 / kz < 20 ? 16 : 32;
        HUD.Detail.work(g, sc, this.vcx, this.vcy, Math.max(vw, vh), 10, true, sc === 16 ? 160 : 500, true);
        HUD.Detail.draw(ctx, g, sc, vx0, vy0, vw, vh, x0, y0, kz);
      }
      const fc = g.fogCell;
      ctx.drawImage(HUD.fogLayer(g), vx0 / fc, vy0 / fc, vw / fc, vh / fc, x0, y0, sw, size);
      const P = (wx, wy) => [x0 + (wx - vx0) * kz, y0 + (wy - vy0) * kz];
      let hover = null, hd = 22 * s;
      // territory rings
      for (const site of g.sites) {
        if (!g.isExplored(site.x, site.y)) continue;
        const q = P(site.x, site.y);
        if (site.owner) { ctx.globalAlpha = 0.25; ctx.fillStyle = g.factions[site.owner].def.color; ctx.beginPath(); ctx.arc(q[0], q[1], site.capR * kz * 1.4 + 4 * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        const d = Math.hypot(mx - q[0], my - q[1]); if (d < hd) { hd = d; hover = site; }
      }
      for (const site of g.sites) {
        if (!g.isExplored(site.x, site.y) || (site.def.landmark && !site.found)) continue;
        const q = P(site.x, site.y);
        if (q[0] < x0 - 20 || q[1] < y0 - 20 || q[0] > x0 + sw + 20 || q[1] > y0 + size + 20) continue;
        const col = site.def.landmark && !site.owner ? '#f6d24a' : site.owner ? g.factions[site.owner].def.color : site.guarded() ? '#e07050' : (site.def.treasure && site.looted) ? '#8a7a6a' : '#f0e2c0';
        const travel = this.travel && site.def.travel && site.owner === g.playerKey && site !== this.travel;
        ctx.fillStyle = 'rgba(10,6,4,0.8)'; ctx.beginPath(); ctx.arc(q[0], q[1], (travel ? 11 : 8) * s, 0, TAU); ctx.fill();
        if (travel) { ctx.strokeStyle = '#8affff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(q[0], q[1], (12 + Math.sin(g.time * 6 + site.x) * 2) * s, 0, TAU); ctx.stroke(); }
        HUD.icon(ctx, site.def.icon === 'castle' ? 'castle_s' : site.def.icon, q[0], q[1], 11 * s, col);
        if (z >= 3 && (site.def.grand || z >= 6)) { ctx.font = HUD.B(Math.round(12 * s), '700'); ctx.textAlign = 'center'; K.keyText(ctx, site.name, q[0], q[1] + 16 * s, col, 3 * s); } // (names, once zoomed in)
        if (site.control > 0 && site.control < 1 && site.controller) { ctx.strokeStyle = g.factions[site.controller] ? g.factions[site.controller].def.color : '#fff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(q[0], q[1], 10 * s, -Math.PI / 2, -Math.PI / 2 + TAU * site.control); ctx.stroke(); }
      }
      // carts and warbands
      for (const t of g.troops) {
        if (!t.alive || !t.faction) continue;
        if (t.team !== g.playerKey && !g.isExplored(t.x, t.y)) continue;
        if (t.role === 'cart') { const q = P(t.x, t.y); ctx.fillStyle = '#000'; ctx.fillRect(q[0] - 3 * s, q[1] - 3 * s, 6 * s, 6 * s); ctx.fillStyle = '#ffd24a'; ctx.fillRect(q[0] - 2 * s, q[1] - 2 * s, 4 * s, 4 * s); }
        else if (t.state === 'march') { const q = P(t.x, t.y); ctx.fillStyle = t.faction.def.color; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2 * s, 0, TAU); ctx.fill(); }
      }
      // towns
      for (const F of g.factionList) {
        if (g.bc && F.key !== g.playerKey && !g.isExplored(F.townPos.x, F.townPos.y)) continue; // (the campaign's Dragon Lord must be found)
        const q = P(F.townPos.x, F.townPos.y);
        if (F.eliminated) { HUD.icon(ctx, 'skull', q[0], q[1], 22 * s, '#a89880'); continue; }
        HUD.crest(ctx, q[0], q[1], 15 * s, F.def);
        ctx.font = HUD.F(Math.round(13.5 * s)); ctx.textAlign = 'center';
        K.keyText(ctx, F.def.short, q[0], q[1] + 26 * s, F.def.color, 3 * s);
        const d = Math.hypot(mx - q[0], my - q[1]); if (d < hd + 6 * s) { hd = d; hover = F; }
      }
      // dragons
      for (const d of g.dragons) {
        if (!d.targetable || (d !== g.player && !g.isExplored(d.x, d.y))) continue;
        const q = P(d.x, d.y);
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(d.angle + Math.PI / 2);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(8 * s, 8 * s); ctx.lineTo(-8 * s, 8 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d === g.player ? '#ffffff' : d.fdef.color; ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(6 * s, 6 * s); ctx.lineTo(-6 * s, 6 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // the player's chosen course (right-click)
      if (g.waypoint) {
        const q = P(g.waypoint.x, g.waypoint.y), pq = P(g.player.x, g.player.y);
        ctx.setLineDash([5 * s, 5 * s]); ctx.strokeStyle = 'rgba(255,226,140,0.75)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(pq[0], pq[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#ffe28c'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(q[0], q[1], (13 + Math.sin(g.time * 5) * 2) * s, 0, TAU); ctx.stroke();
        HUD.icon(ctx, 'flag', q[0], q[1] - 1 * s, 12 * s, '#ffe28c');
      }
      // the current view
      const cam = g.camera, a = P(cam.x, cam.y);
      ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(a[0], a[1], cam.w * kz, cam.h * kz);
      ctx.restore();
      // side panel: legend + hover details
      const px = x0 + sw + 26 * s, pw = W - px - 20 * s;
      HUD.plate(ctx, px, y0 - 10 * s, pw, size + 20 * s, 12 * s, 0.9);
      ctx.textAlign = 'left'; ctx.font = HUD.F(Math.round(20 * s)); ctx.fillStyle = HUD.COL.gold;
      const PF = g.playerFaction, ready = this.orders ? PF.troops.filter((t) => t.alive && t.role !== 'cart' && t.state === 'garrison').length : 0;
      ctx.fillText(this.travel ? 'WAYGATE TRAVEL' : this.orders ? 'MUSTER THE WARBAND' : 'WAR MAP', px + 18 * s, y0 + 16 * s);
      ctx.font = HUD.B(Math.round(14 * s), '500'); ctx.fillStyle = HUD.COL.dim;
      ctx.fillText(this.travel ? 'Click a glowing waygate you own.' : this.orders ? (ready > 3 ? 'Click a site or rival town · ' + (ready - 3) + ' troops will march' : 'Too few troops at home (3 stay on guard)') : g.map.name + ' · day ' + (1 + Math.floor(g.time / 300)), px + 18 * s, y0 + 40 * s);
      let yy = y0 + 72 * s;
      if (hover) {
        const isF = !!hover.def && hover.def.dragon;
        ctx.font = HUD.F(Math.round(16 * s)); ctx.fillStyle = HUD.COL.parch;
        ctx.fillText(isF ? hover.def.name : hover.name, px + 18 * s, yy); yy += 24 * s;
        ctx.font = HUD.B(Math.round(14 * s), '600');
        const lines = [];
        if (isF) {
          const F = hover;
          lines.push('Stronghold: ' + (F.keep && F.keep.alive ? Math.round(F.keep.hp / F.keep.maxHp * 100) + '%' : 'fallen'));
          lines.push('Ward strength: ' + F.wardStrength() + ' / 4');
          lines.push('Territory: ' + F.sitesOwned + ' sites');
          lines.push('Dragon: ' + (F.dragon ? F.dragon.name + (F.dragon.down > 0 ? ' (recovering)' : '') : '—'));
          if (F === g.playerFaction) lines.push('Gold: ' + Math.floor(F.gold));
        } else {
          const st = hover;
          lines.push(st.owner ? 'Held by ' + g.factions[st.owner].def.name : st.guarded() ? 'Guarded — defeat the guardians' : st.def.treasure && st.looted ? 'Plundered — hoard returns later' : 'Unclaimed');
          for (const l of HUD.wrap(ctx, st.def.desc, pw - 36 * s)) lines.push(l);
          if (st.rich) lines.push('A rich seam: nearly double the gold.');
        }
        ctx.fillStyle = HUD.COL.dim;
        for (const l of lines) { ctx.fillText(l, px + 18 * s, yy); yy += 18 * s; }
        yy += 10 * s;
      }
      // legend
      yy = Math.max(yy, y0 + size - 170 * s);
      const leg = [['mine', 'Gold mine'], ['village', 'Village'], ['castle_s', 'Castle / fort'], ['tower', 'Wizard tower'], ['gate', 'Waygate'], ['crystal', 'Magic site'], ['cave', 'Treasure']];
      ctx.font = HUD.B(Math.round(13.5 * s), '600');
      leg.forEach(([ic, label], i) => { const lx = px + 18 * s + (i % 2) * (pw / 2 - 10 * s), ly = yy + Math.floor(i / 2) * 22 * s; HUD.icon(ctx, ic, lx + 6 * s, ly, 12 * s, '#f0e2c0'); ctx.fillStyle = HUD.COL.dim; ctx.fillText(label, lx + 18 * s, ly + 1 * s); });
      ctx.fillStyle = HUD.COL.faint || 'rgba(240,226,192,0.4)'; ctx.font = HUD.B(Math.round(13.5 * s), '500');
      ctx.fillText(g.waypoint ? 'Right-click — new course · on it again to clear' : 'Right-click — set your course', px + 18 * s, y0 + size - 22 * s);
      ctx.fillText('Wheel — zoom (×' + (Math.round(z * 10) / 10) + ') · drag — move · 0 — whole realm', px + 18 * s, y0 + size - 44 * s);
      ctx.fillText('M or Esc — close', px + 18 * s, y0 + size);
      ctx.restore();
      // click to travel
      if (this.travel && mouse.lPressed && hover && hover.def && hover.def.travel && hover.owner === g.playerKey && hover !== this.travel) {
        AS.Sites.travel(g, g.player, hover); this.travel = null; AS.App.closeOverlay();
      }
      // click to send the warband
      if (this.orders && mouse.lPressed && hover) {
        const isF = !!hover.def && !!hover.def.dragon;
        const tx = isF ? hover.townPos.x : hover.x, ty = isF ? hover.townPos.y : hover.y;
        const pk = isF ? hover.key : hover.owner;
        if ((isF && hover === PF) || (!isF && hover.owner === PF.key)) { /* our own: nothing to take */ }
        else if (pk && g.pact && g.pact(PF.key, pk)) { g.msg('YOU ARE AT PEACE WITH ' + g.factions[pk].def.short.toUpperCase() + ' — BREAK THE PACT AT COURT FIRST', '#ffe7a8', 2.6); AS.Audio.sfx('denied'); }
        else if (!AS.Nav.reachable(g, PF.townPos.x, PF.townPos.y, tx, ty)) { g.msg('NO ROAD LEADS THERE — ONLY DRAGONS CAN REACH IT', '#ffe7a8', 2.2); AS.Audio.sfx('denied'); }
        else {
          AS.Court.g = g;
          const n = AS.Court.sendWarband(PF, { x: tx, y: ty, siege: isF });
          g.msg(n ? n + ' TROOPS MARCH ON ' + (isF ? hover.def.short : hover.name).toUpperCase() : 'TOO FEW TROOPS AT HOME', n ? '#ffe08a' : '#ffe7a8', 2.4);
          AS.Audio.sfx(n ? 'herald' : 'denied');
          this.orders = false; AS.App.closeOverlay();
        }
      }
      // right-click: set a course (snapping to a site or town), or clear it
      if (!this.travel && !this.orders && mouse.rPressed && mx > x0 && my > y0 && mx < x0 + sw && my < y0 + size) {
        const wp = g.waypoint, wq = wp && P(wp.x, wp.y);
        if (wq && Math.hypot(mx - wq[0], my - wq[1]) < 18 * s) { g.waypoint = null; AS.Audio.sfx('ui_hover'); }
        else {
          const isF = hover && !!hover.def && !!hover.def.dragon;
          g.waypoint = hover ? { x: isF ? hover.townPos.x : hover.x, y: isF ? hover.townPos.y : hover.y, label: (isF ? hover.def.short : hover.name).toUpperCase() }
            : { x: U.clamp(vx0 + (mx - x0) / kz, 0, g.map.w), y: U.clamp(vy0 + (my - y0) / kz, 0, g.map.h), label: 'WAYPOINT' };
          AS.Audio.sfx('ui_click');
        }
      }
      if (AS.App.overlay !== 'map') { this.travel = null; this.orders = false; }
    },
  };
  AS.WarMap = WarMap;
})(window.AS);
