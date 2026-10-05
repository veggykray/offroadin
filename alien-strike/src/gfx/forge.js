/* ALIEN STRIKE — Sprite Forge.
 * All art is generated at load time from "stacked" models: each model is a list of
 * parts with a height range; the forge draws every height slice offset upward on
 * screen, which gives rotating vehicles, creatures and buildings a consistent 3/4
 * oblique look. Each rendered frame is then pixel-processed (crisp alpha, top-left
 * rim light, ordered dithering, selective outline) so the result reads as cohesive
 * pixel art. Replacing art later = swapping the model for an image sheet with the
 * same {frames, ax, ay} contract. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

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

  /* Render one frame of a stacked model.
   * model: { r, h, parts:[{z0,z1,shape(ctx,zt,anim),side,top,detail(ctx,anim),stroke}], scale }
   * Object space: +x is forward. Anchor (ax, ay) is the ground point under the model's centre. */
  function renderModel(model, angle, anim, opts) {
    opts = opts || {};
    const s = model.scale || 1;
    const pad = 3;
    const r = Math.ceil(model.r * s), hh = Math.ceil(model.h * s);
    const w = r * 2 + pad * 2, h = r * 2 + hh + pad * 2;
    const ax = r + pad, ay = r + hh + pad;
    const cv = canvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const parts = model.parts;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      if (p.when && !p.when(anim)) continue;
      const z0 = p.z0 * s, z1 = p.z1 * s;
      const side = C.hex(p.side || p.top || '#888');
      const top = C.hex(p.top || p.side || '#aaa');
      const sideDark = C.shade(side, -(p.ao !== undefined ? p.ao : 0.4));
      const steps = Math.max(0, Math.round(z1 - z0));
      for (let k = 0; k <= steps; k++) {
        const isTop = k === steps;
        const zt = steps ? k / steps : 1;
        const z = z0 + k;
        ctx.save();
        ctx.translate(ax, ay - z);
        ctx.rotate(angle);
        ctx.scale(s, s);
        const col = isTop ? top : C.mix(sideDark, side, zt);
        ctx.fillStyle = C.str(col);
        ctx.strokeStyle = C.str(col);
        if (p.stroke) ctx.lineWidth = p.stroke;
        ctx.beginPath();
        p.shape(ctx, zt, anim || 0);
        if (p.stroke) ctx.stroke(); else ctx.fill();
        if (isTop && p.detail) p.detail(ctx, anim || 0);
        ctx.restore();
      }
    }
    if (opts.noPost !== true) postProcess(cv, model.post || {});
    return { img: cv, ax, ay, w, h };
  }

  /* Build (and cache) a rotation × animation sheet. */
  const cache = new Map();
  function sheet(key, modelFn, dirs, anims, opts) {
    let sh = cache.get(key);
    if (sh) return sh;
    const model = typeof modelFn === 'function' ? modelFn() : modelFn;
    dirs = dirs || 1; anims = anims || 1;
    const frames = [];
    let ax = 0, ay = 0, w = 0, h = 0;
    for (let a = 0; a < anims; a++) {
      const row = [];
      for (let d = 0; d < dirs; d++) {
        const f = renderModel(model, (d / dirs) * U.TAU, anims > 1 ? a / anims : 0, opts);
        row.push(f.img); ax = f.ax; ay = f.ay; w = f.w; h = f.h;
      }
      frames.push(row);
    }
    sh = { frames, dirs, anims, ax, ay, w, h, model };
    // Silhouette for shadows (first anim frame per direction)
    sh.shadows = frames[0].map((img) => silhouette(img));
    cache.set(key, sh);
    return sh;
  }

  function silhouette(img) {
    const c = canvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
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
    const cv = canvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    fn(ctx, w, h);
    if (post !== false) postProcess(cv, post || {});
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

  AS.Forge = { canvas, postProcess, renderModel, sheet, frameIndex, flat, glow, silhouette, cache, clearCache };
})(window.AS);
