/* WYRMCROWN — CONQUEST campaign map: the archipelago drawn on a canvas.
 * An illustrated sea chart: islands with ragged coasts and shallows, rivers,
 * roads, bridges and sea lanes, a symbol for every kind of place ringed in its
 * holder's colours, the army's banner, and fog over everything not yet
 * discovered (soft, so a coast half seen invites a closer look).
 *
 * Drawn only when something changes (selection, hover, pan, zoom, a move) — the
 * campaign screen costs nothing while it sits still. Pan by dragging, zoom with
 * the wheel; everything is in world units (data/world.js size) under a camera. */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data, U = AS.U;
  const OWN_COL = { player: null, free: '#f4ecd8', neutral: '#8a8478', independent: '#9a6a8a' };
  const LAND = { home: ['#9aa064', '#7f8a4c'], outer: ['#8c9858', '#6e7c46'], human: ['#a8a060', '#8a8448'], elf: ['#5e8a52', '#40683a'], ice: ['#d8e4ea', '#a8bcc8'], undead: ['#6e6274', '#4a4052'], neutral: ['#94965e', '#767a48'] };
  const TIER_NAME = { 0: 'Home lands', 1: 'Early lands', 2: 'The frontier', 3: 'Castle country', 4: 'The harbour coast', 5: 'Across the sea', 6: 'Dragon Lord territory', 7: 'Dragon Lord territory' };

  const MapView = {
    TIER_NAME,
    cv: null, ctx: null, state: null, world: null, cam: { x: 0, y: 0, z: 1 },
    sel: null, hover: null, dirty: true, onSelect: null, onAct: null, t: 0,
    attach(cv, state) {
      this.cv = cv; this.ctx = cv.getContext('2d'); this.state = state; this.world = C.World.of(state);
      this.coast = null; this.fogCv = null;
      this.bind();
      this.resize();
      this.focusArmy(true);
    },
    setState(state) { this.state = state; this.world = C.World.of(state); this.dirty = true; },
    resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cv.width = Math.max(10, Math.round(r.width * dpr)); this.cv.height = Math.max(10, Math.round(r.height * dpr));
      this.dpr = dpr; this.dirty = true;
    },
    // fit the whole known world, or zoom in on the army
    focusArmy(fit) {
      const w = this.world, s = C.World.site(this.state, this.state.army.at);
      const W = this.cv.width, H = this.cv.height;
      const known = this.state.world.explored.map((id) => C.WorldGen.index(w).byId[id]).filter(Boolean);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const k of known) { x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y); x1 = Math.max(x1, k.x); y1 = Math.max(y1, k.y); }
      const pad = 320;
      const z = Math.min(W / (x1 - x0 + pad * 2), H / (y1 - y0 + pad * 2));
      this.cam.z = U.clamp(fit ? z : this.cam.z, this.minZ(), 3.5 * this.dpr);
      this.cam.x = fit ? (x0 + x1) / 2 : s.x; this.cam.y = fit ? (y0 + y1) / 2 : s.y;
      this.dirty = true;
    },
    minZ() { return Math.min(this.cv.width / this.world.w, this.cv.height / this.world.h) * 0.9; },
    toScreen(x, y) { return [(x - this.cam.x) * this.cam.z + this.cv.width / 2, (y - this.cam.y) * this.cam.z + this.cv.height / 2]; },
    toWorld(sx, sy) { return [(sx - this.cv.width / 2) / this.cam.z + this.cam.x, (sy - this.cv.height / 2) / this.cam.z + this.cam.y]; },
    pick(sx, sy) {
      let best = null, bd = 1e9;
      for (const id of this.state.world.explored) {
        const s = C.WorldGen.index(this.world).byId[id]; if (!s) continue;
        const [x, y] = this.toScreen(s.x, s.y), d = Math.hypot(x - sx, y - sy);
        if (d < Math.max(18 * this.dpr, 10 * this.cam.z) && d < bd) { bd = d; best = id; }
      }
      return best;
    },
    bind() {
      const cv = this.cv;
      if (cv._cqBound) return; cv._cqBound = true;
      let drag = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]; };
      cv.addEventListener('pointerdown', (e) => { const [x, y] = pos(e); drag = { x, y, cx: this.cam.x, cy: this.cam.y, moved: false }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        const [x, y] = pos(e);
        if (drag) {
          if (Math.hypot(x - drag.x, y - drag.y) > 5 * this.dpr) drag.moved = true;
          if (drag.moved) { this.cam.x = drag.cx - (x - drag.x) / this.cam.z; this.cam.y = drag.cy - (y - drag.y) / this.cam.z; this.dirty = true; }
          return;
        }
        const h = this.pick(x, y);
        if (h !== this.hover) { this.hover = h; this.dirty = true; cv.style.cursor = h ? 'pointer' : 'grab'; }
      });
      cv.addEventListener('pointerup', (e) => {
        const [x, y] = pos(e);
        if (drag && !drag.moved) { const id = this.pick(x, y); if (id) { this.sel = id; this.dirty = true; if (this.onSelect) this.onSelect(id); } }
        drag = null;
      });
      cv.addEventListener('dblclick', (e) => { const [x, y] = pos(e); const id = this.pick(x, y); if (id && this.onAct) this.onAct(id); });
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [x, y] = pos(e), [wx, wy] = this.toWorld(x, y);
        this.cam.z = U.clamp(this.cam.z * (e.deltaY > 0 ? 1 / 1.15 : 1.15), this.minZ(), 3.5 * this.dpr);
        const [nx, ny] = this.toWorld(x, y); this.cam.x += wx - nx; this.cam.y += wy - ny;
        this.dirty = true;
      }, { passive: false });
    },
    zoom(k) { this.cam.z = U.clamp(this.cam.z * k, this.minZ(), 3.5 * this.dpr); this.dirty = true; },

    /* ---------------- drawing ---------------- */
    ownerCol(o) {
      if (o === 'player') return AS.Data.factions[this.state.hero.allegiance].color;
      if (AS.Data.factions[o]) return AS.Data.factions[o].color;
      return OWN_COL[o] || '#888';
    },
    // a ragged coast for an island blob (deterministic)
    blobPath(ctx, b, seed, grow) {
      const n = 40;
      ctx.moveTo(0, 0);
      for (let i = 0; i <= n; i++) {
        const a = i / n * U.TAU, k = 1 + 0.12 * U.noise2(Math.cos(a) * 1.7 + b.x * 0.01, Math.sin(a) * 1.7 + b.y * 0.01, seed) + 0.05 * U.noise2(Math.cos(a) * 5 + b.x, Math.sin(a) * 5, seed + 3);
        const r = b.r * k + (grow || 0), [x, y] = this.toScreen(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    landCol(I) {
      if (I.kind === 'lord') { const L = this.world.lords.find((q) => q.id === I.lord); return LAND[L ? L.allegiance : 'neutral']; }
      return LAND[I.kind] || LAND.neutral;
    },
    known(id) { return this.state.world.explored.includes(id); },
    draw() {
      if (!this.dirty || !this.ctx) return;
      this.dirty = false;
      const ctx = this.ctx, W = this.cv.width, H = this.cv.height, z = this.cam.z, w = this.world, st = this.state, dpr = this.dpr;
      const ix = C.WorldGen.index(w);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // the sea
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1f3d52'); g.addColorStop(1, '#2a5068');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.07; ctx.strokeStyle = '#cfe6f0'; ctx.lineWidth = 1 * dpr;
      for (let yy = (-this.cam.y * z) % (26 * z); yy < H; yy += 26 * z) { ctx.beginPath(); for (let xx = 0; xx <= W; xx += 16 * dpr) ctx.lineTo(xx, yy + Math.sin(xx * 0.02 + yy) * 3 * dpr); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // islands: shallows, coast line, land (strokes first so overlapping blobs merge)
      const seed = st.seed % 1000;
      for (const I of w.islands) { ctx.beginPath(); for (const b of I.blobs) this.blobPath(ctx, b, seed, 16 / Math.max(0.4, z / dpr)); ctx.fillStyle = 'rgba(120,180,190,0.28)'; ctx.fill(); }
      for (const I of w.islands) { ctx.beginPath(); for (const b of I.blobs) this.blobPath(ctx, b, seed, 0); ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 3.2 * dpr; ctx.stroke(); }
      for (const I of w.islands) {
        const [a, b2] = this.landCol(I);
        ctx.beginPath(); for (const b of I.blobs) this.blobPath(ctx, b, seed, 0);
        const c0 = I.blobs[0], [cx, cy] = this.toScreen(c0.x, c0.y);
        const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, c0.r * z * 1.6); lg.addColorStop(0, a); lg.addColorStop(1, b2);
        ctx.fillStyle = lg; ctx.fill();
      }
      // texture: a few hills and trees on the land
      ctx.globalAlpha = 0.18;
      for (const I of w.islands) for (const b of I.blobs) {
        for (let i = 0; i < 7; i++) {
          const a = U.hash2(b.x + i, b.y, 3) * U.TAU, r = Math.sqrt(U.hash2(b.x, b.y + i, 4)) * b.r * 0.8;
          const [x, y] = this.toScreen(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r), s = 7 * z;
          ctx.fillStyle = '#2a3a1c'; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s, y + s * 0.5); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // rivers
      for (const R of w.rivers) {
        ctx.beginPath(); R.pts.forEach((q, i) => { const [x, y] = this.toScreen(q[0], q[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = '#2a4a60'; ctx.lineWidth = Math.max(3, 9 * z); ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = '#5a8aa0'; ctx.lineWidth = Math.max(1.5, 4 * z); ctx.stroke();
      }
      // routes between known places; the ones from the army's site are highlighted
      const at = st.army.at;
      for (const r of w.routes) {
        if (!this.known(r.a) || !this.known(r.b)) continue;
        const A = ix.byId[r.a], B = ix.byId[r.b], [ax, ay] = this.toScreen(A.x, A.y), [bx, by] = this.toScreen(B.x, B.y);
        const fromHere = r.a === at || r.b === at, other = r.a === at ? r.b : r.a;
        const can = fromHere ? C.World.canMove(st, other) : null;
        ctx.save();
        if (r.type === 'sea') {
          const mx = (ax + bx) / 2 + (by - ay) * 0.12, my = (ay + by) / 2 - (bx - ax) * 0.12;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
          ctx.setLineDash([3 * dpr, 7 * dpr]); ctx.lineWidth = 2.4 * dpr;
          ctx.strokeStyle = fromHere ? (can.ok ? '#ffe08a' : '#e07a6a') : 'rgba(210,235,245,0.6)';
          ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          if (fromHere) { ctx.strokeStyle = 'rgba(255,224,138,0.35)'; ctx.lineWidth = 9 * dpr; ctx.stroke(); }
          ctx.setLineDash(r.type === 'bridge' ? [] : [7 * dpr, 4 * dpr]); ctx.lineWidth = (r.type === 'bridge' ? 3 : 2.4) * dpr;
          ctx.strokeStyle = fromHere ? (can.ok ? '#ffe08a' : '#c0a080') : '#5a4630';
          ctx.stroke();
        }
        ctx.restore();
      }
      // fog over the unknown (soft holes around every discovered place)
      if (!st.flags.reveal) {
        if (!this.fogCv || this.fogCv.width !== W || this.fogCv.height !== H) { this.fogCv = document.createElement('canvas'); this.fogCv.width = W; this.fogCv.height = H; }
        const f = this.fogCv.getContext('2d');
        f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
        const fg = f.createLinearGradient(0, 0, W, H); fg.addColorStop(0, '#d8ccb0'); fg.addColorStop(1, '#bfb092');
        f.fillStyle = fg; f.fillRect(0, 0, W, H);
        // drifting cloud shapes, fixed to the world so they pan with the map
        for (let i = 0; i < 60; i++) {
          const wx = U.hash2(i, 1, 9) * w.w, wy = U.hash2(i, 2, 9) * w.h, [x, y] = this.toScreen(wx, wy), r = (60 + U.hash2(i, 3, 9) * 140) * z;
          const cg = f.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255,250,235,0.35)'); cg.addColorStop(1, 'rgba(255,250,235,0)');
          f.fillStyle = cg; f.fillRect(x - r, y - r, r * 2, r * 2);
        }
        f.globalAlpha = 1; f.globalCompositeOperation = 'destination-out';
        for (const id of st.world.explored) {
          const s = ix.byId[id]; if (!s) continue;
          const [x, y] = this.toScreen(s.x, s.y), R = 125 * z;
          const rg = f.createRadialGradient(x, y, R * 0.35, x, y, R); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
          f.fillStyle = rg; f.fillRect(x - R, y - R, R * 2, R * 2);
        }
        ctx.globalAlpha = 0.94; ctx.drawImage(this.fogCv, 0, 0); ctx.globalAlpha = 1;
      }
      // Dragon Lord domains, once seen
      for (const L of w.lords) {
        const I = w.islands.find((q) => q.id === L.island);
        if (!w.sites.some((s) => s.lord === L.id && this.known(s.id))) continue;
        const [x, y] = this.toScreen(I.blobs[0].x, I.blobs[0].y - I.blobs[0].r - 18);
        ctx.font = 'bold ' + Math.round(13 * dpr) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(20,10,10,0.6)'; ctx.fillText('DOMAIN OF ' + AS.Data.factions[L.allegiance].short.toUpperCase() + (L.primary ? ' · THE MAIN DRAGON LORD' : ''), x + 1, y + 1);
        ctx.fillStyle = AS.Data.factions[L.allegiance].color; ctx.fillText('DOMAIN OF ' + AS.Data.factions[L.allegiance].short.toUpperCase() + (L.primary ? ' · THE MAIN DRAGON LORD' : ''), x, y);
      }
      // places
      for (const id of st.world.explored) {
        const s0 = ix.byId[id]; if (!s0) continue;
        const s = C.World.site(st, id), [x, y] = this.toScreen(s.x, s.y);
        if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
        this.drawSite(ctx, s, x, y);
      }
      // the army
      const A = ix.byId[at], [ax, ay] = this.toScreen(A.x, A.y), pulse = 1 + 0.12 * Math.sin(this.t * 4);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5 * dpr; ctx.beginPath(); ctx.arc(ax, ay, 22 * dpr * pulse, 0, U.TAU); ctx.stroke();
      this.banner(ctx, ax + 10 * dpr, ay - 18 * dpr, this.ownerCol('player'));
      if (st.army.ship.owned) this.shipIcon(ctx, ax - 24 * dpr, ay + 12 * dpr);
      // labels
      ctx.textAlign = 'center';
      for (const id of st.world.explored) {
        const s = ix.byId[id]; if (!s) continue;
        const showAll = z / dpr > 0.85;
        if (!showAll && id !== this.sel && id !== this.hover && id !== at && !s.final && s.kind !== 'castle' && s.kind !== 'harbour') continue;
        const [x, y] = this.toScreen(s.x, s.y);
        ctx.font = (id === this.sel ? 'bold ' : '') + Math.round((id === this.sel || id === this.hover ? 13 : 11) * dpr) + 'px Cinzel, Georgia, serif';
        ctx.fillStyle = 'rgba(15,10,5,0.75)'; ctx.fillText(s.name, x + 1, y + 26 * dpr + 1);
        ctx.fillStyle = id === this.sel ? '#ffe08a' : '#f4ecd8'; ctx.fillText(s.name, x, y + 26 * dpr);
      }
      // selection ring
      if (this.sel && ix.byId[this.sel]) { const s = ix.byId[this.sel], [x, y] = this.toScreen(s.x, s.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.beginPath(); ctx.arc(x, y, 17 * dpr, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]); }
    },
    banner(ctx, x, y, col) {
      const d = this.dpr;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 1 * d, y - 4 * d, 2 * d, 26 * d);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 1 * d, y - 4 * d); ctx.lineTo(x + 16 * d, y - 1 * d); ctx.lineTo(x + 11 * d, y + 4 * d); ctx.lineTo(x + 16 * d, y + 9 * d); ctx.lineTo(x + 1 * d, y + 9 * d); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1 * d; ctx.stroke();
    },
    shipIcon(ctx, x, y) {
      const d = this.dpr;
      ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.moveTo(x - 10 * d, y); ctx.lineTo(x + 10 * d, y); ctx.lineTo(x + 6 * d, y + 6 * d); ctx.lineTo(x - 6 * d, y + 6 * d); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f0e8d0'; ctx.beginPath(); ctx.moveTo(x, y - 14 * d); ctx.lineTo(x + 8 * d, y - 2 * d); ctx.lineTo(x, y - 2 * d); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 1 * d, y - 14 * d, 1.6 * d, 14 * d);
    },
    // a place: a badge in its holder's colours, the kind's symbol, pips for danger and hiring
    drawSite(ctx, s, x, y) {
      const d = this.dpr, big = s.kind === 'lordhold' ? 1.5 : s.kind === 'castle' || s.kind === 'stronghold' ? 1.2 : 1;
      const R = 12 * d * big, col = this.ownerCol(s.owner);
      const hot = s.id === this.hover || s.id === this.sel;
      ctx.beginPath(); ctx.arc(x, y + 2 * d, R + 2 * d, 0, U.TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, R, 0, U.TAU); ctx.fillStyle = '#f2e6c8'; ctx.fill();
      ctx.lineWidth = (hot ? 4 : 3) * d; ctx.strokeStyle = col; ctx.stroke();
      this.symbol(ctx, s, x, y, R * 0.72);
      const hostile = C.World.hostile(this.state, s.id);
      if (hostile) { // crossed swords pip
        const px = x + R * 0.85, py = y - R * 0.85;
        ctx.fillStyle = '#7a1a10'; ctx.beginPath(); ctx.arc(px, py, 5.5 * d, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#ffd8c0'; ctx.lineWidth = 1.4 * d; ctx.beginPath(); ctx.moveTo(px - 3 * d, py - 3 * d); ctx.lineTo(px + 3 * d, py + 3 * d); ctx.moveTo(px + 3 * d, py - 3 * d); ctx.lineTo(px - 3 * d, py + 3 * d); ctx.stroke();
      }
      const rs = C.World.recruitSite(this.state, s.id);
      if (rs && Object.values(rs.stock).some((v) => v > 0)) { const px = x - R * 0.9, py = y - R * 0.8; ctx.fillStyle = '#e8c050'; ctx.beginPath(); ctx.moveTo(px, py - 5 * d); ctx.lineTo(px + 5 * d, py + 4 * d); ctx.lineTo(px - 5 * d, py + 4 * d); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1 * d; ctx.stroke(); }
      if (s.final) { ctx.fillStyle = '#ffd24a'; ctx.font = 'bold ' + Math.round(16 * d) + 'px serif'; ctx.textAlign = 'center'; ctx.fillText('♛', x, y - R - 4 * d); }
    },
    symbol(ctx, s, x, y, r) {
      const d = this.dpr; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#3a2a1a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6 * d; ctx.lineJoin = 'round';
      const k = s.kind;
      const house = (hx, hy, sz) => { ctx.beginPath(); ctx.moveTo(hx - sz, hy + sz * 0.8); ctx.lineTo(hx - sz, hy - sz * 0.1); ctx.lineTo(hx, hy - sz); ctx.lineTo(hx + sz, hy - sz * 0.1); ctx.lineTo(hx + sz, hy + sz * 0.8); ctx.closePath(); ctx.fill(); };
      const tower = (tx, ty, tw, th) => { ctx.fillRect(tx - tw / 2, ty - th, tw, th); for (let i = -1; i <= 1; i += 2) ctx.fillRect(tx + i * tw / 3 - tw / 8, ty - th - tw * 0.3, tw / 4, tw * 0.3); };
      if (k === 'village') { house(-r * 0.4, r * 0.15, r * 0.45); house(r * 0.42, r * 0.25, r * 0.38); }
      else if (k === 'farm') { ctx.fillStyle = '#b08a3a'; ctx.fillRect(-r * 0.8, -r * 0.1, r * 1.6, r * 0.8); ctx.fillStyle = '#3a2a1a'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * 0.32 - 0.6 * d, -r * 0.1, 1.2 * d, r * 0.8); house(0, -r * 0.25, r * 0.38); }
      else if (k === 'tower') tower(0, r * 0.8, r * 0.55, r * 1.3);
      else if (k === 'bridge') { ctx.beginPath(); ctx.moveTo(-r, r * 0.4); ctx.lineTo(-r, -r * 0.1); ctx.quadraticCurveTo(0, -r * 0.8, r, -r * 0.1); ctx.lineTo(r, r * 0.4); ctx.lineTo(r * 0.55, r * 0.4); ctx.quadraticCurveTo(0, -r * 0.25, -r * 0.55, r * 0.4); ctx.closePath(); ctx.fill(); }
      else if (k === 'mine') { ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.7, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e8c050'; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.35, r * 0.22, 0, U.TAU); ctx.fill(); }
      else if (k === 'fort') { ctx.fillRect(-r * 0.8, -r * 0.2, r * 1.6, r * 0.9); for (let i = -3; i <= 3; i++) ctx.fillRect(i * r * 0.24 - r * 0.08, -r * 0.55, r * 0.16, r * 0.4); }
      else if (k === 'castle' || k === 'stronghold') { tower(-r * 0.55, r * 0.8, r * 0.45, r * 1.2); tower(r * 0.55, r * 0.8, r * 0.45, r * 1.2); ctx.fillRect(-r * 0.35, -r * 0.1, r * 0.7, r * 0.9); tower(0, r * 0.1, r * 0.4, r * 1.0); }
      else if (k === 'harbour' || k === 'landing') { ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.7); ctx.moveTo(-r * 0.5, -r * 0.35); ctx.lineTo(r * 0.5, -r * 0.35); ctx.stroke(); ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -r * 0.85, r * 0.18, 0, U.TAU); ctx.stroke(); }
      else if (k === 'lair') { ctx.beginPath(); ctx.arc(0, r * 0.6, r * 0.85, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(-r * 0.25, r * 0.15, r * 0.12, 0, U.TAU); ctx.arc(r * 0.25, r * 0.15, r * 0.12, 0, U.TAU); ctx.fill(); }
      else if (k === 'ruins') { ctx.fillRect(-r * 0.7, -r * 0.3, r * 0.3, r * 1.0); ctx.fillRect(-r * 0.1, -r * 0.7, r * 0.3, r * 1.4); ctx.fillRect(r * 0.45, r * 0.1, r * 0.3, r * 0.6); ctx.fillRect(-r * 0.85, r * 0.6, r * 1.7, r * 0.15); }
      else if (k === 'lordhold') { ctx.fillStyle = '#2a1a2a'; ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * 0.35, -r * 0.1); ctx.lineTo(r * 0.35, r * 0.8); ctx.lineTo(-r * 0.35, r * 0.8); ctx.lineTo(-r * 0.35, -r * 0.1); ctx.closePath(); ctx.fill(); tower(-r * 0.7, r * 0.8, r * 0.35, r * 0.8); tower(r * 0.7, r * 0.8, r * 0.35, r * 0.8); ctx.fillStyle = '#c03020'; ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.14, 0, U.TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, U.TAU); ctx.fill(); }
      ctx.restore();
    },
    tick(dt) { this.t += dt; this.dirty = true; this.draw(); },
  };
  C.MapView = MapView;
})(window.AS);
