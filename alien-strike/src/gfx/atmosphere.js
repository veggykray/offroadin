/* ALIEN STRIKE — atmosphere: the air between the camera and the ground.
 *  - cloud shadows: a tileable soft-noise texture drifting with the wind,
 *    darkening terrain and everything on it (drawn before lighting)
 *  - key light: a broad warm glow from the sun side (top-left) and a cool
 *    falloff opposite, so the whole frame shares one light direction
 *  - distance haze: the top of the screen is farther from the camera in the
 *    3/4 view, so it picks up the world's air colour
 * Tuned per terrain type; each world can override with `atm` in its data. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C;

  const PRESET = {
    terraces: { cloud: 0.2, cloudCol: '#2a1408', wind: [16, 6], haze: '#e8b080', hazeA: 0.16, sun: '#ffd8a0', sunA: 0.1, shade: '#2a3050', shadeA: 0.1 },
    dunes: { cloud: 0.14, cloudCol: '#3a1008', wind: [26, 8], haze: '#f0a070', hazeA: 0.2, sun: '#ffc890', sunA: 0.12, shade: '#3a1a30', shadeA: 0.1 },
    jungle: { cloud: 0.24, cloudCol: '#08180a', wind: [8, 4], haze: '#b0e8a0', hazeA: 0.12, sun: '#f0ffb0', sunA: 0.08, shade: '#0a2030', shadeA: 0.12 },
    ice: { cloud: 0.16, cloudCol: '#102040', wind: [20, 10], haze: '#e0f0ff', hazeA: 0.22, sun: '#ffffff', sunA: 0.08, shade: '#203060', shadeA: 0.1 },
    ocean: { cloud: 0.2, cloudCol: '#082030', wind: [18, 6], haze: '#b8e8f0', hazeA: 0.16, sun: '#fff0d0', sunA: 0.08, shade: '#0a2040', shadeA: 0.1 },
    lava: { cloud: 0.26, cloudCol: '#1a0804', wind: [10, -6], haze: '#ff8040', hazeA: 0.1, sun: '#ff9a50', sunA: 0.08, shade: '#200810', shadeA: 0.14 },
    moon: { cloud: 0.0, haze: '#9a7ae8', hazeA: 0.12, sun: '#e0d0ff', sunA: 0.07, shade: '#100830', shadeA: 0.12 },
    clouds: { cloud: 0.0, haze: '#b0c0ff', hazeA: 0.18, sun: '#ffffff', sunA: 0.08, shade: '#101840', shadeA: 0.1 },
    metal: { cloud: 0.14, cloudCol: '#100804', wind: [12, 4], haze: '#ffb070', hazeA: 0.1, sun: '#ffc080', sunA: 0.07, shade: '#100c20', shadeA: 0.12 },
    sanctum: { cloud: 0.14, cloudCol: '#140828', wind: [10, 6], haze: '#c8a8ff', hazeA: 0.14, sun: '#ffe8c0', sunA: 0.08, shade: '#140830', shadeA: 0.12 },
  };

  const TEX = 192, TEXEL = 7; // cloud texture size (px) and world units per texel
  let tex = null, texKey = '';

  /* tileable soft blobs: each blob is also drawn at its wrapped copies */
  function cloudTexture(col, seed) {
    const cv = AS.Forge.canvas(TEX, TEX), ctx = cv.getContext('2d');
    const rng = new U.RNG(seed);
    const c = C.hex(col);
    for (let i = 0; i < 26; i++) {
      const x = rng.next() * TEX, y = rng.next() * TEX, r = 14 + rng.next() * 34, a = 0.25 + rng.next() * 0.45;
      for (let ox = -TEX; ox <= TEX; ox += TEX) for (let oy = -TEX; oy <= TEX; oy += TEX) {
        if (x + ox + r < 0 || x + ox - r > TEX || y + oy + r < 0 || y + oy - r > TEX) continue;
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, C.str(c, a)); g.addColorStop(0.6, C.str(c, a * 0.5)); g.addColorStop(1, C.str(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * 0.8, 0, 0, U.TAU); ctx.fill();
      }
    }
    // flatten the densest overlaps so shadows read as soft patches, not black holes
    const img = ctx.getImageData(0, 0, TEX, TEX), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, Math.pow(d[i] / 255, 0.85) * 220);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* Everything here is soft and low-frequency, so it is composed into one
   * quarter-resolution layer and upscaled onto the frame with a single blit:
   * full-screen gradient fills and scaled cloud tiles at native resolution cost
   * ~20ms a frame on software rasterisers. */
  const DOWN = 4;
  let layer = null, lctx = null, base = null, baseKey = '';

  function buildBase(A, w, h) {
    const c = AS.Forge.canvas(w, h), x = c.getContext('2d');
    // key light from the top-left, cool fill falling off toward the bottom-right
    if (A.sunA > 0) {
      const s = x.createRadialGradient(-w * 0.1, -h * 0.2, 0, -w * 0.1, -h * 0.2, Math.hypot(w, h) * 0.9);
      s.addColorStop(0, C.str(A.sun, A.sunA * 1.2)); s.addColorStop(1, C.str(A.sun, 0));
      x.fillStyle = s; x.fillRect(0, 0, w, h);
    }
    if (A.shadeA > 0) {
      const s = x.createRadialGradient(w * 1.1, h * 1.2, 0, w * 1.1, h * 1.2, Math.hypot(w, h) * 0.8);
      s.addColorStop(0, C.str(A.shade, A.shadeA)); s.addColorStop(1, C.str(A.shade, 0));
      x.fillStyle = s; x.fillRect(0, 0, w, h);
    }
    // distance haze along the far (top) edge
    if (A.hazeA > 0) {
      const hz = x.createLinearGradient(0, 0, 0, h * 0.42);
      hz.addColorStop(0, C.str(A.haze, A.hazeA)); hz.addColorStop(1, C.str(A.haze, 0));
      x.fillStyle = hz; x.fillRect(0, 0, w, h * 0.42);
    }
    return c;
  }

  const Atmosphere = {
    cfg(world) {
      const base = PRESET[world.terrain.type] || PRESET.terraces;
      return Object.assign({}, base, world.atm || {});
    },
    under() {},
    /* drawn after lighting and weather */
    off: null,
    /* On a GPU canvas this layer costs well under a millisecond. With software
     * rasterisation (no GPU, blocklisted driver, headless) its full-screen blit
     * costs 15ms+, so it stays off rather than halve the frame rate. */
    softwareRaster() {
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
        return /swiftshader|llvmpipe|software|basic render/i.test(r);
      } catch (e) { return false; }
    },
    over(ctx, g, R) {
      if (this.off === null) this.off = this.softwareRaster() && !(AS.App && AS.App.params && AS.App.params.get('atm') === '1');
      if (this.off || (AS.Settings && AS.Settings.quality === 'low')) return;
      this.draw(ctx, g, R);
    },
    draw(ctx, g, R) {
      const A = this.cfg(g.world);
      const w = Math.max(1, Math.ceil(R.bufW / DOWN)), h = Math.max(1, Math.ceil(R.bufH / DOWN));
      if (!layer || layer.width !== w || layer.height !== h) { layer = AS.Forge.canvas(w, h); lctx = layer.getContext('2d'); baseKey = ''; }
      const key = g.world.key + ':' + w + 'x' + h;
      if (baseKey !== key) { base = buildBase(A, w, h); baseKey = key; }
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, w, h);
      // cloud shadows drift with the wind across terrain and everything on it
      if (A.cloud > 0 && !(AS.Settings && AS.Settings.quality === 'medium')) {
        const tk = g.world.key + A.cloudCol;
        if (texKey !== tk) { tex = cloudTexture(A.cloudCol || '#000', 4242 + g.world.id); texKey = tk; }
        const cam = g.camera, span = TEX * TEXEL, k = (cam.zoom * R.res) / DOWN;
        const wx = (A.wind[0] * g.time) % span, wy = (A.wind[1] * g.time) % span;
        const x0 = Math.floor((cam.x - wx) / span) * span + wx, y0 = Math.floor((cam.y - wy) / span) * span + wy;
        lctx.globalAlpha = A.cloud;
        for (let x = x0; x < cam.x + cam.w; x += span) for (let y = y0; y < cam.y + cam.h; y += span) lctx.drawImage(tex, (x - cam.x) * k, (y - cam.y) * k, span * k, span * k);
        lctx.globalAlpha = 1;
      }
      lctx.drawImage(base, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(layer, 0, 0, w * DOWN, h * DOWN);
      ctx.restore();
    },
  };

  AS.Atmosphere = Atmosphere;
})(window.AS);
