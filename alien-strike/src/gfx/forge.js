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
    const cv = canvas(w, h);
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
        const f = renderModel(model, (d / dirs) * U.TAU + ((opts && opts.angle) || 0), anims > 1 ? a / anims : 0, opts);
        row.push(f.img); ax = f.ax; ay = f.ay; w = f.w; h = f.h;
      }
      frames.push(row);
    }
    sh = { frames, dirs, anims, ax, ay, w, h, model, res: (opts && opts.res) || Forge.res };
    // Silhouette for shadows (first anim frame per direction), softened at high res
    sh.shadows = frames[0].map((img) => silhouette(img, sh.res >= 2 ? sh.res * 0.9 : 0));
    cache.set(key, sh);
    return sh;
  }

  /* The same sheet built a frame at a time (a generator), for warming sheets up
   * in the background without stalling a frame. The result is cached under key
   * when it completes; a sheet(key) call in the meantime simply builds the rest
   * synchronously and wins. */
  function* sheetGen(key, modelFn, dirs, anims, opts) {
    if (cache.has(key)) return cache.get(key);
    const model = typeof modelFn === 'function' ? modelFn() : modelFn;
    dirs = dirs || 1; anims = anims || 1;
    const frames = [];
    let ax = 0, ay = 0, w = 0, h = 0;
    for (let a = 0; a < anims; a++) {
      const row = [];
      for (let d = 0; d < dirs; d++) {
        if (cache.has(key)) return cache.get(key);
        const f = renderModel(model, (d / dirs) * U.TAU + ((opts && opts.angle) || 0), anims > 1 ? a / anims : 0, opts);
        row.push(f.img); ax = f.ax; ay = f.ay; w = f.w; h = f.h;
        yield null;
      }
      frames.push(row);
    }
    if (cache.has(key)) return cache.get(key);
    const sh = { frames, dirs, anims, ax, ay, w, h, model, res: (opts && opts.res) || Forge.res };
    sh.shadows = frames[0].map((img) => silhouette(img, sh.res >= 2 ? sh.res * 0.9 : 0));
    cache.set(key, sh);
    return sh;
  }

  const canFilter = (() => { try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; } catch (e) { return false; } })();
  function silhouette(img, blur) {
    const c = canvas(img.width, img.height);
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
    const cv = canvas(w * F, h * F);
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

  const Forge = { res: 2, STYLE, canvas, postProcess, postIllustrated, renderModel, sheet, sheetGen, frameIndex, flat, glow, silhouette, cache, clearCache, setRes };
  AS.Forge = Forge;
})(window.AS);
