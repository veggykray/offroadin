/* ALIEN STRIKE — Sprite Forge.
 * All art is generated at load time from "stacked" models: each model is a list of
 * parts with a height range; the forge draws every height slice offset upward on
 * screen, which gives rotating vehicles, creatures and buildings a consistent 3/4
 * oblique look. Frames are supersampled (Forge.res texels per world unit) and lit
 * from the top-left: walls carry a screen-space light gradient, top faces get a
 * bevel, and a post pass adds rim light and a clean dark outline. At res 1 (low
 * quality) the original pixel-art post pass (posterise, dither, sel-out) is used.
 * Sheet metadata (ax, ay, w, h) is always in WORLD units; frames are res× larger,
 * so draw them with explicit width/height. Replacing art later = swapping the
 * model for an image sheet with the same {frames, ax, ay, w, h} contract. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C;

  function canvas(w, h, cpu) {
    // (inside a worker there is no document: the same drawing goes to an OffscreenCanvas)
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    // cpu: a canvas whose pixels are read back (sprite post-processing, patterns, tints).
    // Asking for willReadFrequently before anything else keeps it in main memory: on a
    // GPU-accelerated browser every getImageData from a GPU canvas stalls the whole
    // graphics pipeline (hundreds of ms per sprite frame on some machines). Later
    // getContext('2d') calls return this same context.
    if (cpu) c.getContext('2d', { willReadFrequently: true });
    return c;
  }
  const scratch = (w, h) => canvas(w, h, true);

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* Pixel post-processing on a canvas in place. */
  function postProcess(cv, opts) {
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const n = w * h;
    const alpha = new Uint8Array(n);
    // 1. crisp alpha
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3];
      if (a >= 110) { alpha[i] = 1; d[i * 4 + 3] = 255; } else { d[i * 4 + 3] = 0; }
    }
    // 2. rim light / under-shade relative to the screen-space light (top-left)
    if (opts.rim !== false) {
      const rim = opts.rimStrength || 0.22;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!alpha[i]) continue;
        const up = alpha[i - w], left = alpha[i - 1], down = alpha[i + w], right = alpha[i + 1];
        const p = i * 4;
        if (!up || !left) {
          d[p] += (255 - d[p]) * rim; d[p + 1] += (255 - d[p + 1]) * rim; d[p + 2] += (255 - d[p + 2]) * rim;
        } else if (!down || !right) {
          d[p] *= 0.72; d[p + 1] *= 0.72; d[p + 2] *= 0.74;
        }
      }
    }
    // 3. posterise with ordered dither (retro gradient banding)
    if (opts.dither !== false) {
      const lv = opts.levels || 20, step = 255 / lv;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!alpha[i]) continue;
        const t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
        const p = i * 4;
        for (let c = 0; c < 3; c++) {
          const v = d[p + c] + t;
          d[p + c] = U.clamp(Math.round(v / step) * step, 0, 255);
        }
      }
    }
    // 4. selective outline: dark tint of the neighbouring colour
    if (opts.outline !== false) {
      const out = new Uint8ClampedArray(d);
      const k = opts.outlineDark !== undefined ? opts.outlineDark : 0.22;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (alpha[i]) continue;
        let best = -1;
        if (x > 0 && alpha[i - 1]) best = i - 1;
        else if (x < w - 1 && alpha[i + 1]) best = i + 1;
        else if (y > 0 && alpha[i - w]) best = i - w;
        else if (y < h - 1 && alpha[i + w]) best = i + w;
        if (best >= 0) {
          const p = i * 4, q = best * 4;
          out[p] = d[q] * k + 6; out[p + 1] = d[q + 1] * k + 4; out[p + 2] = d[q + 2] * k + 10; out[p + 3] = opts.outlineAlpha || 255;
        }
      }
      img.data.set(out);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* Outline hierarchy (model.style): the hero and units read strongest, props are
   * lighter, terrain decor carries no outline at all (just its contact shadow). */
  const STYLE = {
    hero: { rimStrength: 0.3, outlineDark: 0.2 },
    unit: {},
    prop: { soft: false, outlineAlpha: 200, rimStrength: 0.18 },
    decor: { outline: false, rimStrength: 0.14 },
  };

  /* Illustrated post-processing for supersampled frames: soft top-left rim light,
   * bottom-right under-shade and a two-ring dark outline (crisp inner ring, soft
   * outer ring) that gives every sprite a strong, clean silhouette. */
  function postIllustrated(cv, opts, F) {
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data, n = w * h;
    const solid = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (d[i * 4 + 3] >= 100) solid[i] = 1;
    const st = Math.max(1, Math.round(F));
    if (opts.rim !== false) {
      const rim = (opts.rimStrength || 0.22) * 0.75;
      for (let y = st; y < h - st; y++) for (let x = st; x < w - st; x++) {
        const i = y * w + x;
        if (!solid[i]) continue;
        const p = i * 4;
        if (!solid[i - w * st] || !solid[i - st]) {
          d[p] += (255 - d[p]) * rim; d[p + 1] += (255 - d[p + 1]) * rim; d[p + 2] += (255 - d[p + 2]) * rim;
        } else if (!solid[i + w * st] || !solid[i + st]) {
          d[p] *= 0.8; d[p + 1] *= 0.8; d[p + 2] *= 0.83;
        }
      }
    }
    if (opts.outline !== false) {
      const k = opts.outlineDark !== undefined ? opts.outlineDark : 0.24;
      const oa = opts.outlineAlpha || 235;
      const out = new Uint8ClampedArray(d);
      const ring = new Uint8Array(n);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        let best = -1;
        if (x > 0 && solid[i - 1]) best = i - 1;
        else if (x < w - 1 && solid[i + 1]) best = i + 1;
        else if (y > 0 && solid[i - w]) best = i - w;
        else if (y < h - 1 && solid[i + w]) best = i + w;
        if (best < 0) continue;
        ring[i] = 1;
        const p = i * 4, q = best * 4;
        out[p] = d[q] * k + 6; out[p + 1] = d[q + 1] * k + 5; out[p + 2] = d[q + 2] * k + 10; out[p + 3] = oa;
      }
      if (F >= 2 && opts.soft !== false) {
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (solid[i] || ring[i]) continue;
          if (!(ring[i - 1] || ring[i + 1] || ring[i - w] || ring[i + w])) continue;
          const j = ring[i - 1] ? i - 1 : ring[i + 1] ? i + 1 : ring[i - w] ? i - w : i + w;
          const p = i * 4, q = j * 4;
          out[p] = out[q]; out[p + 1] = out[q + 1]; out[p + 2] = out[q + 2]; out[p + 3] = Math.round(oa * 0.38);
        }
      }
      img.data.set(out);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // Screen-space light: walls brighten toward the left, top faces toward the
  // top-left. Gradients are built in the part's local (rotated, scaled) space.
  function litGradient(ctx, ca, sa, s, R, col, diag, lift, drop) {
    let ex = R, ey = 0;
    if (diag) { ex = R * 0.7; ey = R * 0.7; }
    // inverse rotation of the screen-space endpoint (-ex, -ey) into local coordinates
    const x0 = (-ex * ca - ey * sa) / s, y0 = (ex * sa - ey * ca) / s;
    const gr = ctx.createLinearGradient(x0, y0, -x0, -y0);
    gr.addColorStop(0, C.str(C.shade(col, lift)));
    gr.addColorStop(0.5, C.str(col));
    gr.addColorStop(1, C.str(C.shade(col, -drop)));
    return gr;
  }

  /* Render one frame of a stacked model.
   * model: { r, h, parts:[{z0,z1,shape(ctx,zt,anim),side,top,detail(ctx,anim),tex(ctx,zt,anim,isTop,k,steps),stroke}], scale }
   * Object space: +x is forward. Anchor (ax, ay) is the ground point under the model's centre. */
  function renderModel(model, angle, anim, opts) {
    opts = opts || {};
    const F = opts.res || Forge.res;
    const ms = model.scale || 1, s = ms * F;
    const lit = F >= 2 && model.lit !== false;
    const pad = 3 * F;
    const r = Math.ceil(model.r * s), hh = Math.ceil(model.h * s);
    const w = r * 2 + pad * 2, h = r * 2 + hh + pad * 2;
    const ax = r + pad, ay = r + hh + pad;
    const cv = scratch(w, h);
    const ctx = cv.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const R = model.r * s;
    const bevelW = (model.bevel !== undefined ? model.bevel : 0.9) * 2 / ms;
    const parts = model.parts;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      if (p.when && !p.when(anim)) continue;
      const z0 = p.z0 * s, z1 = p.z1 * s;
      const side = C.hex(p.side || p.top || '#888');
      const top = C.hex(p.top || p.side || '#aaa');
      const sideDark = C.shade(side, -(p.ao !== undefined ? p.ao : 0.4));
      const steps = Math.max(0, Math.round(z1 - z0));
      const shadeIt = lit && !p.flat;
      for (let k = 0; k <= steps; k++) {
        const isTop = k === steps;
        const zt = steps ? k / steps : 1;
        const z = z0 + k;
        ctx.save();
        ctx.translate(ax, ay - z);
        ctx.rotate(angle);
        ctx.scale(s, s);
        const col = isTop ? top : C.mix(sideDark, side, zt);
        const paint = shadeIt ? litGradient(ctx, ca, sa, s, R, col, isTop, isTop ? 0.14 : 0.12, isTop ? 0.14 : 0.3) : C.str(col);
        ctx.fillStyle = paint;
        ctx.strokeStyle = paint;
        if (p.stroke) ctx.lineWidth = p.stroke;
        ctx.beginPath();
        p.shape(ctx, zt, anim || 0);
        if (p.stroke) ctx.stroke(); else ctx.fill();
        // optional surface material: called after every filled slice with the slice path still
        // current (it may clip to it); slices show only their camera-facing rim, so per-slice
        // marks build up a texture on the walls and the last slice textures the top face
        if (p.tex && !p.stroke) p.tex(ctx, zt, anim || 0, isTop, k, steps);
        if (isTop && shadeIt && !p.stroke && p.bevel !== false) {
          // bevel: light rim on edges facing the light, dark rim on the far edges
          ctx.save();
          ctx.clip();
          const bx = (-R * 0.7 * ca - R * 0.7 * sa) / s, by = (R * 0.7 * sa - R * 0.7 * ca) / s;
          const bg = ctx.createLinearGradient(bx * 0.35, by * 0.35, -bx * 0.35, -by * 0.35);
          bg.addColorStop(0, 'rgba(255,255,255,0.42)');
          bg.addColorStop(0.5, 'rgba(255,255,255,0)');
          bg.addColorStop(0.5, 'rgba(0,0,0,0)');
          bg.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.strokeStyle = bg;
          ctx.lineWidth = bevelW * (p.bevelW || 1);
          ctx.stroke();
          ctx.restore();
        }
        if (isTop && p.detail) p.detail(ctx, anim || 0);
        ctx.restore();
      }
    }
    if (opts.noPost !== true) {
      if (F >= 2) postIllustrated(cv, Object.assign({}, STYLE[model.style] || STYLE.unit, model.post || {}), F);
      else postProcess(cv, model.post || {});
    }
    return { img: cv, ax: ax / F, ay: ay / F, w: w / F, h: h / F };
  }

  /* Build (and cache) a rotation × animation sheet.
   * Frames are forged lazily: the sheet comes back at once with its layout (every
   * frame of a model shares one size and anchor), and each frame — and each
   * direction's shadow silhouette — is rendered the first time anything reads it.
   * A creature seen for the first time so costs the one frame it is drawn in
   * rather than its whole rotation × animation set (over a second for a colossus),
   * and fill() (or a forge worker) draws the rest in spare time — the same drawing. */
  const cache = new Map();
  const stats = { sync: 0, syncMs: 0, worker: 0, stand: 0 }; // frames forged on the spot / time spent / frames from workers
  const pending = []; // sheets with frames still to forge, most recently requested last
  function dims(model, opts) {
    const F = (opts && opts.res) || Forge.res;
    const s = (model.scale || 1) * F, pad = 3 * F;
    const r = Math.ceil(model.r * s), hh = Math.ceil(model.h * s);
    return { ax: (r + pad) / F, ay: (r + hh + pad) / F, w: (r * 2 + pad * 2) / F, h: (r * 2 + hh + pad * 2) / F };
  }
  /* On-the-spot forging is capped per frame (beginFrame resets it). Past the cap, a
   * frame that is not forged yet is stood in for by the nearest finished frame of
   * the same sheet — the neighbouring direction or animation phase — until the
   * workers (or a later frame) deliver it; a sheet with nothing finished yet is
   * always forged at once, so nothing ever pops in. */
  const SYNC_MS = 6;
  let frameSync = 0, exact = 0; // exact: forging on purpose (fill, shadows) — no stand-ins
  function beginFrame() { frameSync = 0; }
  function standIn(sh, a, d, shadow) {
    const dirs = sh.dirs;
    // the same facing in another animation phase reads best, then the nearest facings
    if (!shadow) for (let j = 1; j < sh.anims; j++) { const aa = (a + j) % sh.anims; if (built(sh.frames[aa], d)) return sh.frames[aa][d]; }
    for (let k = 1; k <= dirs; k++) {
      const dd = ((d + (k & 1 ? (k + 1) >> 1 : -(k >> 1))) % dirs + dirs) % dirs;
      if (shadow) { if (built(sh.shadows, dd)) return sh.shadows[dd]; continue; }
      for (let j = 0; j < sh.anims; j++) { const aa = (a + j) % sh.anims; if (built(sh.frames[aa], dd)) return sh.frames[aa][dd]; }
    }
    return null;
  }
  // an array whose slots build themselves on first read and then become plain values
  function lazyRow(n, build, sh, a) {
    const row = new Array(n);
    for (let i = 0; i < n; i++) {
      Object.defineProperty(row, i, {
        configurable: true, enumerable: true,
        get() {
          if (!exact) sh.needT = performance.now(); // drawn (or about to be): its sheet goes first in the workers' queue
          // over the cap — or a frame known to cost more than the cap allows (a giant) — takes a stand-in if there is one
          if (!exact && sh.dirs > 1 && frameSync + (a < 0 ? (built(sh.frames[0], i) ? 1 : (sh.cost || 0) + 1) : (sh.cost || 0)) > SYNC_MS && (frameSync >= SYNC_MS || sh.cost)) {
            const sub = standIn(sh, a, i, a < 0); if (sub) { stats.stand++; if (stats.log) stats.log.push(['stand-in', sh.key, a, i, !!sh.recipe]); return sub; }
          }
          const t = performance.now(), v = build(i), dt = performance.now() - t;
          stats.sync++; stats.syncMs += dt; frameSync += dt; if (a >= 0) sh.cost = sh.cost ? sh.cost * 0.7 + dt * 0.3 : dt; if (stats.log && dt > 2) stats.log.push([sh.key, a, i, +dt.toFixed(1), exact]);
          Object.defineProperty(row, i, { value: v, writable: true, configurable: true, enumerable: true }); sh.left--; return v;
        },
        set(v) { Object.defineProperty(row, i, { value: v, writable: true, configurable: true, enumerable: true }); sh.left--; },
      });
    }
    return row;
  }
  // the exact first-phase frame of direction d (forged now if need be, never a stand-in)
  function frame0(sh, d) { const row = sh.frames[0]; if (built(row, d)) return row[d]; exact++; try { return row[d]; } finally { exact--; } }
  // has slot i of a lazy row been forged yet?
  const built = (row, i) => !Object.getOwnPropertyDescriptor(row, i).get;
  function sheet(key, modelFn, dirs, anims, opts) {
    let sh = cache.get(key);
    if (sh) return sh;
    const model = typeof modelFn === 'function' ? modelFn() : modelFn;
    dirs = dirs || 1; anims = anims || 1;
    const d0 = dims(model, opts), angle0 = (opts && opts.angle) || 0;
    sh = { frames: [], dirs, anims, ax: d0.ax, ay: d0.ay, w: d0.w, h: d0.h, model, res: (opts && opts.res) || Forge.res, left: dirs * anims + dirs, key, angle0 };
    if (modelFn && modelFn.recipe && !opts) sh.recipe = modelFn.recipe; // can be forged in a worker
    for (let a = 0; a < anims; a++) sh.frames.push(lazyRow(dirs, (d) => renderModel(model, (d / dirs) * U.TAU + angle0, anims > 1 ? a / anims : 0, opts).img, sh, a));
    // silhouette for shadows (first anim frame per direction), softened at high res
    sh.shadows = lazyRow(dirs, (d) => silhouette(frame0(sh, d), sh.res >= 2 ? sh.res * 0.9 : 0), sh, -1);
    cache.set(key, sh);
    pending.push(sh);
    return sh;
  }
  // forge the next missing frame of a sheet (anim 0 and its shadows first); false when complete
  function step(sh) {
    if (sh.left <= 0) return false;
    const c = frameSync; exact++;
    try { return step1(sh); } finally { exact--; frameSync = c; } // background work does not count against the frame's cap
  }
  function step1(sh) {
    const fly = sh.fly; let busy = false; // frames a worker is already drawing are left to it
    for (let a = 0; a < sh.anims; a++) {
      const row = sh.frames[a];
      for (let d = 0; d < sh.dirs; d++) if (!built(row, d) || (a === 0 && !built(sh.shadows, d))) {
        if (fly && fly.has(a * sh.dirs + d)) { busy = true; continue; }
        row[d]; if (a === 0) sh.shadows[d]; return true;
      }
    }
    for (let d = 0; d < sh.dirs; d++) if (!built(sh.shadows, d)) { if (fly && fly.has(d)) { busy = true; continue; } sh.shadows[d]; return true; }
    if (!busy) sh.left = 0;
    return false;
  }
  // forge every remaining frame of a sheet now
  function complete(sh) { exact++; try { while (sh.left > 0 && step(sh)); } finally { exact--; } return sh; }
  // run fn with every frame it touches forged exactly (no stand-ins), e.g. while loading
  function exactly(fn) { exact++; try { return fn(); } finally { exact--; } }
  // repack a finished sheet's rows as ordinary arrays (fast element access again)
  function seal(sh) { sh.frames = sh.frames.map((r) => r.slice()); sh.shadows = sh.shadows.slice(); }
  /* Forge missing frames of sheets drawn lately (or coming within reach of the view,
   * see want) for up to budget ms; sheets nothing has drawn or asked for lately wait,
   * as in pump. A frame is only started if it is expected to fit (from the sheet's
   * measured cost), but with `force` one is always started so even very heavy sheets
   * make progress. */
  const live = (sh, now) => now - (sh.needT || -1e9) < 2000 || now - (sh.wantT || -1e9) < 3000;
  function fill(budget, force) {
    const t0 = performance.now();
    let did = 0;
    pump();
    for (let i = pending.length - 1; i >= 0; i--) {
      const sh = pending[i];
      if (sh.left <= 0 || cache.get(sh.key) !== sh) { pending.splice(i, 1); if (sh.left <= 0) seal(sh); }
    }
    for (;;) {
      let sh = null;
      for (let i = pending.length - 1; i >= 0 && !sh; i--) { const q = pending[i]; if (q.left > 0 && !offThread(q) && live(q, t0)) sh = q; }
      if (!sh) break;
      const used = performance.now() - t0;
      if ((did || !force) && used + (sh.fcost || sh.cost || 2) > budget) break;
      const a = performance.now();
      if (!step(sh)) { if (sh.left > 0) break; seal(sh); pending.splice(pending.indexOf(sh), 1); continue; } // (what is left is with a worker)
      const c = performance.now() - a;
      sh.fcost = sh.fcost ? sh.fcost * 0.7 + c * 0.3 : c;
      did++;
    }
    return did;
  }
  // how many forged images are held, and their pixel memory (for the developer panel; cached for 2 s)
  let memT = 0, memV = { n: 0, bytes: 0, sheets: 0 };
  function memory() {
    const now = performance.now();
    if (now - memT < 2000) return memV;
    memT = now; let n = 0, bytes = 0, sheets = 0;
    const add = (img) => { if (img && img.width) { n++; bytes += img.width * img.height * 4; } };
    for (const v of cache.values()) {
      if (v && v.frames) { sheets++; for (const row of v.frames) for (let d = 0; d < row.length; d++) if (built(row, d)) add(row[d]); if (v.shadows) for (let d = 0; d < v.shadows.length; d++) if (built(v.shadows, d)) add(v.shadows[d]); }
      else if (v && v.img) add(v.img);
      else add(v);
    }
    memV = { n, bytes, sheets };
    return memV;
  }
  const ready = (key) => { const sh = cache.get(key); return !!sh && !(sh.left > 0); };

  /* ---- background forging in workers ----
   * A sheet whose model comes from a recipe (a generator name and its plain-data
   * arguments, see recipe()) can be forged by a worker that loads the same model
   * code and draws to an OffscreenCanvas: the frames arrive as bitmaps, identical
   * to the ones the main thread would draw, without costing the game a frame. A
   * frame needed before its bitmap arrives is still drawn on the spot, as above. */
  const pool = { wk: [], seq: 0, jobs: new Map(), dead: false };
  function recipe(gen, pal, opt) {
    const fn = () => AS.Models[gen](pal, opt);
    fn.recipe = { gen, pal, opt };
    return fn;
  }
  function useWorkers(url, n) {
    if (pool.wk.length || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
    for (let i = 0; i < n; i++) {
      try {
        const w = new Worker(url); w.busy = 0;
        w.onmessage = (e) => done(e.data, w);
        w.onerror = (e) => { e.preventDefault && e.preventDefault(); drop(w); };
        pool.wk.push(w);
      } catch (e) { break; }
    }
  }
  const offThread = (sh) => sh.recipe && !sh.noWorker && pool.wk.length > 0 && pool.wk.some((w) => !w.broken);
  /* frames of sh nearest a drawing angle first (creatures in view, or about to be) */
  function want(sh, angle) {
    if (!sh || !(sh.left > 0)) return;
    sh.hint = angle; sh.wantT = performance.now();
    const i = pending.indexOf(sh);
    if (i >= 0 && i !== pending.length - 1) { pending.splice(i, 1); pending.push(sh); }
  }
  function nextJob(sh) {
    const dirs = sh.dirs, fly = sh.fly || (sh.fly = new Set());
    const h = sh.hint !== undefined ? frameIndex(sh, sh.hint) : 0;
    for (let k = 0; k <= dirs; k++) {
      const d = ((h + (k & 1 ? (k + 1) >> 1 : -(k >> 1))) % dirs + dirs) % dirs;
      for (let a = 0; a < sh.anims; a++) {
        const id = a * dirs + d;
        if (fly.has(id)) continue;
        if (!built(sh.frames[a], d) || (a === 0 && !built(sh.shadows, d))) return [d, a, id];
      }
    }
    return null;
  }
  function pump() {
    if (!pool.wk.length) return;
    for (const w of pool.wk) {
      if (w.broken) continue;
      while (w.busy < 2) {
        let job = null, sh = null;
        // first one frame (the wanted facing) for every sheet that has none yet, so a
        // creature coming into view never has to be forged on the spot; then the rest
        for (let i = pending.length - 1; i >= 0 && !job; i--) {
          sh = pending[i];
          if (sh.seeded || !offThread(sh) || !(sh.left > 0) || cache.get(sh.key) !== sh) continue;
          sh.seeded = true;
          job = nextJob(sh);
        }
        // then the rest of the sheets being drawn now (on screen), then of those
        // coming within reach of the view (want); sheets nothing has drawn or asked
        // for lately wait — forging every frame of everything filled hundreds of MB
        const now = performance.now();
        for (let pass = 0; pass < 2 && !job; pass++) {
          for (let i = pending.length - 1; i >= 0 && !job; i--) {
            sh = pending[i];
            if (!offThread(sh) || !(sh.left > 0) || cache.get(sh.key) !== sh) continue;
            if (pass === 0 ? !(now - (sh.needT || -1e9) < 2000) : !(now - (sh.wantT || -1e9) < 3000)) continue;
            job = nextJob(sh);
          }
        }
        if (!job) return;
        const [d, a, fid] = job, id = ++pool.seq;
        try {
          w.postMessage({ type: 'frame', id, key: sh.key, recipe: sh.recipe, res: sh.res, angle: (d / sh.dirs) * U.TAU + sh.angle0, anim: sh.anims > 1 ? a / sh.anims : 0, shadow: a === 0, blur: sh.res >= 2 ? sh.res * 0.9 : 0 });
        } catch (e) { sh.noWorker = true; continue; } // arguments that cannot be cloned: forged here instead
        sh.fly.add(fid); w.busy++;
        pool.jobs.set(id, { sh, d, a, fid, w });
      }
    }
  }
  // a worker that failed: its frames go back to the page (forged on first draw / by fill)
  function drop(w) {
    w.broken = true;
    for (const [id, j] of pool.jobs) if (j.w === w) { pool.jobs.delete(id); j.sh.fly.delete(j.fid); }
    w.busy = 0;
  }
  function done(m, w) {
    if (m.type === 'ready') { if (!m.ok) drop(w); return; }
    const j = pool.jobs.get(m.id); if (!j) return;
    pool.jobs.delete(m.id); w.busy--;
    const sh = j.sh; sh.fly.delete(j.fid);
    if (m.err) { sh.noWorker = true; return; }
    if (cache.get(sh.key) !== sh) return;
    if (!built(sh.frames[j.a], j.d)) { sh.frames[j.a][j.d] = m.img; stats.worker++; }
    if (m.ms && !sh.cost) sh.cost = m.ms;
    if (m.shadow && !built(sh.shadows, j.d)) sh.shadows[j.d] = m.shadow;
    pump();
  }

  /* The same sheet built a frame at a time (a generator), for warming sheets up
   * in the background without stalling a frame. */
  function* sheetGen(key, modelFn, dirs, anims, opts) {
    const sh = sheet(key, modelFn, dirs, anims, opts);
    while (step(sh)) yield null;
    return sh;
  }

  const canFilter = (() => { try { return typeof canvas(1, 1).getContext('2d').filter === 'string'; } catch (e) { return false; } })();
  function silhouette(img, blur) {
    const c = scratch(img.width, img.height);
    const x = c.getContext('2d');
    if (blur && canFilter) x.filter = 'blur(' + blur + 'px)';
    x.drawImage(img, 0, 0);
    x.filter = 'none';
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#000';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function frameIndex(sh, angle) {
    if (sh.dirs <= 1) return 0;
    let a = angle % U.TAU; if (a < 0) a += U.TAU;
    return Math.round((a / U.TAU) * sh.dirs) % sh.dirs;
  }

  /* Flat (non-stacked) sprite drawn by a function, post-processed. */
  function flat(key, w, h, fn, post) {
    let f = cache.get(key);
    if (f) return f;
    const F = Forge.res;
    const cv = scratch(w * F, h * F);
    const ctx = cv.getContext('2d');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.scale(F, F);
    fn(ctx, w, h);
    if (post !== false) { if (F >= 2) postIllustrated(cv, post || {}, F); else postProcess(cv, post || {}); }
    f = { img: cv, w, h, ax: w / 2, ay: h / 2 };
    cache.set(key, f);
    return f;
  }

  /* Soft radial glow textures for additive lighting (cached per colour). */
  function glow(color, size) {
    const key = 'glow:' + color + ':' + size;
    let g = cache.get(key);
    if (g) return g;
    const cv = canvas(size, size);
    const ctx = cv.getContext('2d');
    const c = C.hex(color);
    const gr = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, C.str(c, 1));
    gr.addColorStop(0.25, C.str(c, 0.55));
    gr.addColorStop(0.6, C.str(c, 0.16));
    gr.addColorStop(1, C.str(c, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size, size);
    cache.set(key, cv);
    return cv;
  }

  function clearCache(prefix) {
    for (const k of Array.from(cache.keys())) if (!prefix || k.startsWith(prefix)) cache.delete(k);
  }

  /* Set the supersampling factor (texels per world unit). Sheets are cached per
   * factor, so changing it drops the cache. */
  function setRes(F) {
    F = F >= 2 ? 2 : 1;
    if (F !== Forge.res) { Forge.res = F; clearCache(); }
  }

  const Forge = { res: 2, STYLE, canvas, scratch, postProcess, postIllustrated, renderModel, sheet, sheetGen, fill, ready, offThread, pending, recipe, useWorkers, want, pool, stats, beginFrame, exactly, complete, memory, frameIndex, flat, glow, silhouette, cache, clearCache, setRes };
  AS.Forge = Forge;
})(window.AS);
