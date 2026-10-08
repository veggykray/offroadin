/* WYRMCROWN — frame profiler for the developer panel (F3 / ?perf=1).
 * Active only while the panel is shown (AS.Prof.on). The main loop calls
 * begin()/end(); the renderer calls mark(name) after each stage, so each name
 * accumulates the time since the previous mark. Objects are drawn through
 * drawItems() so their cost is split by kind (buildings, troops, dragons…).
 * Sprite frames forged on the spot happen inside those draws; their time is
 * reported separately (from AS.Forge.stats) as well.
 * Frames over 100 ms are logged with their slowest stages (the stall log).
 * Note: on a GPU-accelerated canvas the browser records draw commands and
 * rasterises them later on the GPU; these are main-thread (CPU) times. */
'use strict';
(function (AS) {
  const WIN = 2000; // ms per reporting window
  const Prof = {
    on: false,
    cur: {}, kinds: {}, kindN: {}, acc: {}, accK: {}, accKN: {}, frames: 0, winT: 0,
    report: null, spikes: [], buckets: { 25: 0, 50: 0, 100: 0, 250: 0, 500: 0 }, t: 0, f0: null,
    begin() {
      if (!this.on) return;
      this.t = this.t0 = performance.now();
      for (const k in this.cur) this.cur[k] = 0;
      for (const k in this.kinds) { this.kinds[k] = 0; this.kindN[k] = 0; }
      const F = AS.Forge && AS.Forge.stats, T = AS.game && AS.game.terrain;
      this.f0 = F ? { ms: F.syncMs, n: F.sync, stand: F.stand, wk: F.worker } : null;
      this.ts0 = T ? T.syncN || 0 : 0; this.tq0 = T ? T.standN || 0 : 0;
    },
    mark(name) {
      const n = performance.now();
      this.cur[name] = (this.cur[name] || 0) + n - this.t;
      this.t = n;
    },
    kindOf(it) {
      if (it.isDragon) return 'dragons';
      if (it.isBuilding) return 'buildings';
      if (it.isTroop) return 'troops';
      const c = it.constructor && it.constructor.name;
      return c && c !== 'Object' ? c.toLowerCase() : 'wildlife/other';
    },
    drawItems(list, ctx, ox, oy, R) {
      for (let i = 0; i < list.length; i++) {
        const it = list[i], k = this.kindOf(it), a = performance.now();
        it.draw(ctx, ox, oy, R);
        this.kinds[k] = (this.kinds[k] || 0) + performance.now() - a;
        this.kindN[k] = (this.kindN[k] || 0) + 1;
      }
    },
    end(frameMs) {
      if (!this.on) return;
      const now = performance.now();
      const F = AS.Forge && AS.Forge.stats, T = AS.game && AS.game.terrain;
      const forged = F && this.f0 ? F.syncMs - this.f0.ms : 0, forgedN = F && this.f0 ? F.sync - this.f0.n : 0;
      const stand = F && this.f0 ? F.stand - this.f0.stand : 0, tsync = T ? (T.syncN || 0) - this.ts0 : 0, tstand = T ? (T.standN || 0) - this.tq0 : 0;
      for (const k in this.cur) this.acc[k] = (this.acc[k] || 0) + this.cur[k];
      for (const k in this.kinds) { this.accK[k] = (this.accK[k] || 0) + this.kinds[k]; this.accKN[k] = (this.accKN[k] || 0) + this.kindN[k]; }
      this.acc._forge = (this.acc._forge || 0) + forged; this.acc._forgeN = (this.acc._forgeN || 0) + forgedN;
      this.acc._stand = (this.acc._stand || 0) + stand; this.acc._tsync = (this.acc._tsync || 0) + tsync; this.acc._tstand = (this.acc._tstand || 0) + tstand;
      this.frames++;
      for (const b of [25, 50, 100, 250, 500]) if (frameMs > b) this.buckets[b]++;
      if (frameMs > 100) {
        const parts = Object.entries(this.cur).concat(Object.entries(this.kinds).map(([k, v]) => ['· ' + k, v])).filter(([, v]) => v > 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
        this.spikes.unshift({ ms: Math.round(frameMs), parts: parts.map(([k, v]) => k + ' ' + Math.round(v)).join(', '), forged: Math.round(forged), forgedN, tsync });
        this.spikes.length = Math.min(this.spikes.length, 5);
      }
      if (now - this.winT > WIN) {
        const n = Math.max(1, this.frames), avg = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n]));
        this.report = { frames: this.frames, sec: avg(this.acc), kinds: avg(this.accK), kindN: avg(this.accKN) };
        this.acc = {}; this.accK = {}; this.accKN = {}; this.frames = 0; this.winT = now;
      }
    },
  };
  AS.Prof = Prof;
})(window.AS);
