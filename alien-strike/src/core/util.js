/* ALIEN STRIKE — core utilities: math, seeded RNG, noise, colour, events, pools.
 * Every script attaches to the global AS namespace so the game runs from a plain
 * index.html (file:// or any static host) without a build step. */
'use strict';
window.AS = window.AS || {};
(function (AS) {
  const TAU = Math.PI * 2;

  const U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    smooth: (t) => t * t * (3 - 2 * t),
    smoothstep: (a, b, v) => { const t = U.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    dist2: (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    angleTo: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    wrapAngle(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; },
    angleDiff(a, b) { return U.wrapAngle(b - a); },
    turnToward(cur, target, maxStep) {
      const d = U.wrapAngle(target - cur);
      if (Math.abs(d) <= maxStep) return target;
      return cur + Math.sign(d) * maxStep;
    },
    approach(v, target, step) { return v < target ? Math.min(v + step, target) : Math.max(v - step, target); },
    damp(cur, target, k, dt) { return target + (cur - target) * Math.exp(-k * dt); },
    rand: Math.random,
    range: (a, b) => a + Math.random() * (b - a),
    irange: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    fmtTime(s) {
      s = Math.max(0, Math.floor(s));
      const m = Math.floor(s / 60), r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    },
    pad(n, w) { let s = String(Math.floor(n)); while (s.length < w) s = '0' + s; return s; },
    deepClone: (o) => JSON.parse(JSON.stringify(o)),
    // Distance from point to segment, used by beams and lightning.
    segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    },
  };

  /* ---------- Seeded RNG (mulberry32) ---------- */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let t = (this.s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
  }
  U.RNG = RNG;

  /* ---------- Hashing & gradient noise ---------- */
  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }
  U.hash2 = hash2;

  // Gradient noise with one shared permutation table; seeds select a lattice offset.
  const P = new Uint8Array(512);
  {
    const r = new RNG(1337);
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = a[i & 255];
  }
  const OX = new Float64Array(1024), OY = new Float64Array(1024);
  { const r = new RNG(4242); for (let i = 0; i < 1024; i++) { OX[i] = r.next() * 256; OY[i] = r.next() * 256; } }
  const GX = new Float64Array([1, -1, 1, -1, 1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071]);
  const GY = new Float64Array([0, 0, 1, 1, -1, -1, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071]);
  const G12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) G12[i] = P[i] % 12;
  function noise2(x, y, seed) {
    const si = (Math.imul(seed | 0, 2654435761) >>> 22) & 1023;
    x += OX[si]; y += OY[si];
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const px = P[X], px1 = P[X + 1];
    const aa = G12[px + Y], ab = G12[px + Y + 1];
    const ba = G12[px1 + Y], bb = G12[px1 + Y + 1];
    const n00 = GX[aa] * xf + GY[aa] * yf;
    const n10 = GX[ba] * (xf - 1) + GY[ba] * yf;
    const n01 = GX[ab] * xf + GY[ab] * (yf - 1);
    const n11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
    const x1 = n00 + u * (n10 - n00), x2 = n01 + u * (n11 - n01);
    return (x1 + v * (x2 - x1)) * 1.42; // ~[-1,1]
  }
  U.noise2 = noise2;
  U.fbm = function (x, y, oct, seed, lac, gain) {
    lac = lac || 2; gain = gain || 0.5;
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f, seed + i * 31) * a; n += a; a *= gain; f *= lac; }
    return s / n;
  };
  U.ridged = function (x, y, oct, seed) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += (1 - Math.abs(noise2(x * f, y * f, seed + i * 17))) * a; n += a; a *= 0.5; f *= 2; }
    return s / n;
  };

  /* ---------- Colour ---------- */
  const C = {
    hex(h) {
      if (Array.isArray(h)) return h;
      h = h.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    str(c, a) {
      c = C.hex(c);
      return a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
        : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    },
    mix(a, b, t) { a = C.hex(a); b = C.hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
    shade(c, f) { c = C.hex(c); return f >= 0 ? C.mix(c, [255, 255, 255], f) : C.mix(c, [0, 0, 0], -f); },
    css(c, f, a) { return C.str(f ? C.shade(c, f) : c, a); },
  };
  U.C = C;

  /* ---------- Tiny event bus ---------- */
  class Events {
    constructor() { this.map = new Map(); }
    on(name, fn) { if (!this.map.has(name)) this.map.set(name, []); this.map.get(name).push(fn); return fn; }
    off(name, fn) { const l = this.map.get(name); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
    emit(name, a, b, c) { const l = this.map.get(name); if (!l) return; for (let i = 0; i < l.length; i++) l[i](a, b, c); }
    clear() { this.map.clear(); }
  }
  U.Events = Events;

  /* ---------- Object pool (fixed capacity, swap-remove active list) ---------- */
  class Pool {
    constructor(factory, capacity) {
      this.items = [];
      this.active = [];
      this.capacity = capacity;
      for (let i = 0; i < capacity; i++) { const o = factory(); o._pi = -1; this.items.push(o); }
      this.free = this.items.slice();
    }
    get() {
      let o = this.free.pop();
      if (!o) {
        // Recycle the oldest active item rather than growing unbounded.
        o = this.active[0];
        this.release(o);
        o = this.free.pop();
      }
      o._pi = this.active.length;
      this.active.push(o);
      return o;
    }
    release(o) {
      if (o._pi < 0) return;
      const last = this.active.pop();
      if (last !== o) { this.active[o._pi] = last; last._pi = o._pi; }
      o._pi = -1;
      this.free.push(o);
    }
    clear() { while (this.active.length) this.release(this.active[this.active.length - 1]); }
  }
  U.Pool = Pool;

  /* ---------- Uniform spatial hash for proximity queries ---------- */
  class Grid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    clear() { this.map.clear(); }
    key(cx, cy) { return (cx + 4096) * 8192 + (cy + 4096); }
    insert(o) { this.insertAt(o, o.x, o.y); }
    insertAt(o, x, y) {
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      const k = this.key(cx, cy);
      let b = this.map.get(k);
      if (!b) { b = []; this.map.set(k, b); }
      b.push(o);
    }
    query(x, y, r, out) {
      out = out || [];
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const b = this.map.get(this.key(cx, cy));
        if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
      return out;
    }
  }
  U.Grid = Grid;

  AS.U = U;
  AS.version = '1.0.0';
})(window.AS);
