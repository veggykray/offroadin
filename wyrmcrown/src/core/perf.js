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
    draw(ctx, g) {
      if (!this.on || !n) return;
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
      }
      L.push(['particles ' + AS.Particles.pool.active.length + '/' + AS.Particles.pool.capacity + '  projectiles ' + AS.Proj.pool.active.length + '/' + AS.Proj.pool.capacity]);
      if (T) {
        const busy = T._wk ? T._wk.reduce((s, w) => s + (w.busy || 0), 0) : 0;
        L.push(['terrain: chunks ' + T.cache.size + '/' + T.maxCache + '  shading ' + busy + (T._wk ? '/' + T._wk.length + 'wk' : ' (main)') + '  on the spot ' + (T.syncN || 0)]);
      }
      if (F && F.stats) {
        const st = F.stats, wkr = F.pool.wk.length;
        L.push(['sprites: forging ' + F.pending.length + ' sheets  from workers ' + st.worker + (wkr ? ' (' + wkr + ')' : '')]);
        L.push(['  on the spot ' + st.sync + ' (' + (st.syncMs / 1000).toFixed(1) + ' s)  stand-ins ' + st.stand]);
      }
      // sound: is the mixer running, what music is playing, are effects firing
      const A = AS.Audio, M = AS.Music;
      if (A) {
        const md = M && M.active ? M.active.key + (M.active.element.paused ? ' (paused)' : ' ' + Math.floor(M.active.element.currentTime) + 's') : M && M.loading ? 'loading ' + M.loading.key : 'none';
        L.push(['sound: ' + (A.ctx ? A.ctx.state : 'not started') + ' · music ' + md + ' · effects ' + (this.sfxN || 0) + (M && M.lastError ? ' · ERROR ' + M.lastError.message : ''), A.ctx && A.ctx.state === 'running' ? null : '#fc6']);
      }
      L.push(['view: ' + R.bufW + '×' + R.bufH + ' at ' + R.res.toFixed(2) + (R.resCap ? ' (lowered)' : '') + ' · ' + this.browser()]);
      if (performance.memory) L.push(['heap ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' / ' + (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB']);
      L.push(['F3 hides', '#888']);
      // panel
      const s = Math.max(1, Math.round((R.dpr || 1) * 10) / 10), lh = 14 * s, pad = 8 * s, w = 420 * s, gh = 46 * s;
      const h = pad * 2 + L.length * lh + gh + 6 * s, x = R.canvas.width - w - 10 * s, y = 10 * s;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.82; ctx.fillStyle = '#0a0c10'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
      ctx.font = (11 * s).toFixed(0) + 'px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
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
