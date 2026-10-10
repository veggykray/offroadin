/* WYRMCROWN — developer performance overlay (F3, or ?perf=1 to start with it open).
 * Hidden in normal play. While hidden it only keeps a few numbers per frame in
 * fixed ring buffers (no allocation); the panel itself is drawn only when shown.
 *   frame     fps, frame interval avg / p99 / worst, slow frames (> 33 ms, > 50 ms)
 *   work      main-thread work per frame: world update, render (world + present + HUD)
 *   world     troops (all updated every frame), buildings, wildlife, dragons,
 *             drawables this frame, lights, particles, projectiles
 *   terrain   cached chunks, chunks shading in workers, chunks built on the spot
 *   sprites   sheets still being forged, frames from workers, frames forged on
 *             the spot (and their cost), stand-in frames shown
 *   memory    JS heap (Chrome only) */
'use strict';
(function (AS) {
  const N = 600; // ~10 s of frames at 60 fps
  const gap = new Float32Array(N), work = new Float32Array(N), upd = new Float32Array(N), ren = new Float32Array(N);
  const sorted = new Float32Array(N);
  let n = 0, i = 0, last = 0;
  const Perf = {
    on: false,
    init() {
      try { this.on = new URLSearchParams(location.search).get('perf') === '1'; } catch (e) { /* no query string */ }
      // count sound effects played (shown on the panel)
      if (AS.Audio && AS.Audio.sfx) { const sfx = AS.Audio.sfx; AS.Audio.sfx = function () { Perf.sfxN = (Perf.sfxN || 0) + 1; return sfx.apply(this, arguments); }; }
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'F3') return;
        e.preventDefault(); // (the browser's "find next")
        if (!e.repeat) this.on = !this.on;
      });
    },
    reset() { n = 0; i = 0; last = 0; },
    gpu() {
      if (this._gpu) return this._gpu;
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
        this._gpu = gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 60) : 'no WebGL';
        const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      } catch (e) { this._gpu = 'unknown'; }
      return this._gpu;
    },
    browser() {
      const u = navigator.userAgent;
      for (const [k, name] of [['Edg', 'Edge'], ['OPR', 'Opera'], ['Firefox', 'Firefox'], ['Chrome', 'Chrome'], ['Version', 'Safari']]) {
        const m = u.match(new RegExp(k + '\\/(\\d+)'));
        if (m) return name + ' ' + m[1];
      }
      return 'browser ?';
    },
    /* one main-loop frame: wall time now, main-thread work, update and render parts (ms) */
    frame(now, workMs, updMs, renMs) {
      gap[i] = last ? now - last : 16.7; last = now;
      work[i] = workMs; upd[i] = updMs; ren[i] = renMs;
      i = (i + 1) % N; if (n < N) n++;
    },
    /* stats over the last k frames of a ring */
    stat(a, k) {
      k = Math.min(k, n);
      let s = 0, mx = 0;
      for (let j = 0; j < k; j++) { const v = a[(i - 1 - j + N) % N]; s += v; if (v > mx) mx = v; sorted[j] = v; }
      const view = sorted.subarray(0, k); view.sort();
      return { avg: k ? s / k : 0, p99: k ? view[Math.min(k - 1, Math.floor(k * 0.99))] : 0, max: mx };
    },
    /* the panel is composed into its own canvas twice a second and blitted every
     * frame, so leaving it open costs almost nothing (redrawing ~30 lines of text
     * each frame cost several ms on a GPU canvas, inflating what it measured) */
    draw(ctx, g) {
      if (!this.on || !n) return;
      const R = AS.Renderer, now = performance.now();
      if (!this._pc || now - this._pt > 500 || this._pw !== R.canvas.width) {
        this._pt = now; this._pw = R.canvas.width;
        this._pc = this._pc || document.createElement('canvas');
        this.compose(this._pc, g);
      }
      const s = Math.max(1, Math.round((R.dpr || 1) * 10) / 10);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this._pc, R.canvas.width - this._pc.width - 10 * s, 10 * s);
      ctx.restore();
    },
    compose(pc, g) {
      const R = AS.Renderer, F = AS.Forge, T = g && g.terrain;
      const fr = this.stat(gap, 240), wk = this.stat(work, 240), up = this.stat(upd, 240), rn = this.stat(ren, 240);
      let slow = 0, vslow = 0; for (let j = 0; j < n; j++) { if (gap[j] > 33.4) slow++; if (gap[j] > 50) vslow++; }
      const L = [];
      L.push(['FPS ' + (1000 / Math.max(1, fr.avg)).toFixed(0), '#9f9']);
      L.push(['frame ' + fr.avg.toFixed(1) + ' ms  p99 ' + fr.p99.toFixed(1) + '  worst ' + fr.max.toFixed(0)]);
      L.push(['slow frames (10 s): >33ms ' + slow + '  >50ms ' + vslow, vslow ? '#fc6' : null]);
      L.push(['work ' + wk.avg.toFixed(1) + ' ms (p99 ' + wk.p99.toFixed(1) + ')  update ' + up.avg.toFixed(1) + '  render ' + rn.avg.toFixed(1)]);
      if (g) {
        const life = g.life ? (g.life.animals.length + g.life.people.length + (g.life.critters ? g.life.critters.length : 0)) : 0;
        L.push(['AI/updates: troops ' + g.troops.length + '  dragons ' + g.dragons.length + '  life ' + life]);
        L.push(['buildings ' + g.buildings.length + '  drawn ' + R.drawList.length + '  lights ' + (R.lastLights || 0)]);
        if (g.lw) {
          // the Large World Test: where the dragon is, and how much of the world is awake
          const C = g.lw.counts, p = g.player;
          L.push(['world: x ' + Math.round(p.x) + ' y ' + Math.round(p.y) + ' (' + (p.x * 0.00025).toFixed(2) + ', ' + (p.y * 0.00025).toFixed(2) + ' km) · forces spawned ' + C.spawnedGroups + ' of ' + (C.groups || 0)]);
          L.push(['troops: ' + C.total + ' exist · ' + C.active + ' running AI · ' + C.asleep + ' asleep · ' + C.visible + ' on screen (drawn + animated)']);
        }
      }
      if (g && g.perfLines) for (const l of g.perfLines()) L.push(l);
      L.push(['particles ' + AS.Particles.pool.active.length + '/' + AS.Particles.pool.capacity + '  projectiles ' + AS.Proj.pool.active.length + '/' + AS.Proj.pool.capacity]);
      if (T) {
        const busy = T._wk ? T._wk.reduce((s, w) => s + (w.busy || 0), 0) : 0;
        L.push(['terrain: chunks ' + T.cache.size + '/' + T.maxCache + '  shading ' + busy + (T._wk ? '/' + T._wk.length + 'wk' : ' (main)') + '  built on the spot ' + (T.syncN || 0) + '  stand-ins ' + (T.standN || 0) + (T._old ? ' (rescaling)' : '')]);
      }
      if (F && F.stats) {
        const st = F.stats, wkr = F.pool.wk.length;
        L.push(['sprites: forging ' + F.pending.length + ' sheets  from workers ' + st.worker + (wkr ? ' (' + wkr + ')' : '')]);
        L.push(['  since start: forged on the spot ' + st.sync + ' (' + (st.syncMs / 1000).toFixed(1) + ' s) · stand-in draws ' + st.stand + ' (cumulative)']);
        if (F.memory) { const mm = F.memory(); L.push(['  sprite images held: ' + mm.n + ' (' + (mm.bytes / 1048576).toFixed(0) + ' MB) in ' + mm.sheets + ' sheets']); }
      }
      // sound: is the mixer running, what music is playing, are effects firing
      const A = AS.Audio, M = AS.Music;
      if (A) {
        const md = M && M.active ? M.active.key + (M.active.element.paused ? ' (paused)' : ' ' + Math.floor(M.active.element.currentTime) + 's') : M && M.loading ? 'loading ' + M.loading.key : 'none';
        L.push(['sound: ' + (A.ctx ? A.ctx.state : 'not started') + ' · music ' + md + ' · effects ' + (this.sfxN || 0) + (M && M.lastError ? ' · ERROR ' + M.lastError.message : ''), A.ctx && A.ctx.state === 'running' ? null : '#fc6']);
      }
      L.push(['view: ' + R.bufW + '×' + R.bufH + ' at ' + R.res.toFixed(2) + (R.resCap ? ' (lowered)' : '') + ' · ' + this.browser()]);
      L.push(['canvas ' + R.canvas.width + '×' + R.canvas.height + ' (css ' + R.screenW + '×' + R.screenH + ', dpr ' + (window.devicePixelRatio || 1).toFixed(2) + ') · ' + ((R.canvas.width * R.canvas.height + R.bufW * R.bufH * 2) / 1e6).toFixed(1) + ' Mpx/frame']);
      L.push(['GPU: ' + this.gpu(), /swiftshader|llvmpipe|software|basic render/i.test(this.gpu()) ? '#fc6' : null]);
      // the render breakdown (AS.Prof): main-thread ms per frame by stage, slowest first
      const P = AS.Prof && AS.Prof.report;
      if (P) {
        const sec = Object.entries(P.sec).filter(([k]) => k[0] !== '_').sort((a, b) => b[1] - a[1]);
        L.push(['— per frame (ms), over ' + P.frames + ' frames —', '#9cf']);
        for (let j = 0; j < sec.length; j += 2) L.push([sec.slice(j, j + 2).map(([k, v]) => (k + ' ').padEnd(20, '.') + ' ' + v.toFixed(1).padStart(5)).join('   ')]);
        const kd = Object.entries(P.kinds).sort((a, b) => b[1] - a[1]);
        if (kd.length) L.push(['objects: ' + kd.map(([k, v]) => k + ' ' + v.toFixed(1) + ' (' + Math.round(P.kindN[k]) + ')').join(' · ')]);
        L.push(['sprite forging on the spot: ' + P.sec._forge.toFixed(1) + ' ms, ' + P.sec._forgeN.toFixed(2) + ' frames · stand-ins drawn now: ' + P.sec._stand.toFixed(1), P.sec._forge > 2 ? '#fc6' : null]);
        L.push(['terrain: built on the spot ' + (P.sec._tsync * P.frames).toFixed(0) + ' · stand-in chunks ' + ((P.sec._tstand || 0) * P.frames).toFixed(0) + ' in the last ' + P.frames + ' frames']);
        const B = AS.Prof.buckets;
        L.push(['slow frames since open: >25 ' + B[25] + ' · >50 ' + B[50] + ' · >100 ' + B[100] + ' · >250 ' + B[250] + ' · >500 ' + B[500]]);
        for (const sp of AS.Prof.spikes.slice(0, 3)) L.push(['  stall ' + sp.ms + ' ms: ' + sp.parts + (sp.forgedN ? ' · forged ' + sp.forgedN + ' (' + sp.forged + ' ms)' : '') + (sp.tsync ? ' · terrain ' + sp.tsync : ''), '#f99']);
      }
      if (performance.memory) L.push(['heap ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' / ' + (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB']);
      L.push(['F3 hides', '#888']);
      // panel
      const s = Math.max(1, Math.round((R.dpr || 1) * 10) / 10), lh = 13 * s, pad = 8 * s, w = 560 * s, gh = 46 * s;
      const h = pad * 2 + L.length * lh + gh + 6 * s, x = 0, y = 0;
      pc.width = Math.ceil(w); pc.height = Math.ceil(h);
      const ctx = pc.getContext('2d');
      ctx.save();
      ctx.globalAlpha = 0.82; ctx.fillStyle = '#0a0c10'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
      ctx.font = (10.5 * s).toFixed(0) + 'px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      for (let j = 0; j < L.length; j++) { ctx.fillStyle = L[j][1] || '#dde'; ctx.fillText(L[j][0], x + pad, y + pad + j * lh); }
      // frame-interval graph, newest on the right; lines at 16.7 and 33.3 ms
      const gx = x + pad, gy = y + pad + L.length * lh + 4 * s, gw = w - pad * 2, K = Math.min(n, 240), sc = gh / 50;
      ctx.fillStyle = '#151a22'; ctx.fillRect(gx, gy, gw, gh);
      for (let j = 0; j < K; j++) {
        const v = gap[(i - K + j + N) % N], bh = Math.min(gh, v * sc);
        ctx.fillStyle = v > 50 ? '#f55' : v > 33.4 ? '#fb4' : '#5c8';
        ctx.fillRect(gx + j * gw / K, gy + gh - bh, Math.max(1, gw / K), bh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(gx, gy + gh - 16.7 * sc, gw, 1); ctx.fillRect(gx, gy + gh - 33.3 * sc, gw, 1);
      ctx.restore();
    },
  };
  AS.Perf = Perf;
})(window.AS);
