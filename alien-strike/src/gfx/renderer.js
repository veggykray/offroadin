/* ALIEN STRIKE — renderer.
 * The world is drawn into a low-resolution buffer (1 world unit = 1 pixel at zoom 1)
 * and upscaled to the full-viewport canvas: integer nearest-neighbour first, then a
 * smooth remainder so pixels stay even at any window size. HUD is drawn at native
 * resolution on top. Draw order: terrain → ground layer → low particles → shadows →
 * y-sorted entities → high particles → projectiles → lights / darkness → weather. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;
  const CH = () => AS.Terrain.CH;

  const R = {
    canvas: null, ctx: null, buf: null, bctx: null, mid: null, mctx: null, lightBuf: null, lctx: null,
    bufW: 854, bufH: 480, scale: 2, dpr: 1, screenW: 0, screenH: 0,
    lights: [], texts: [], drawList: [], time: 0,
    weatherParts: [],
    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buf = document.createElement('canvas');
      this.bctx = this.buf.getContext('2d');
      this.mid = document.createElement('canvas');
      this.mctx = this.mid.getContext('2d');
      this.lightBuf = document.createElement('canvas');
      this.lctx = this.lightBuf.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },
    viewH() {
      const v = AS.Settings && AS.Settings.view;
      return v === 'near' ? 420 : v === 'far' ? 560 : 480;
    },
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr;
      const w = window.innerWidth, h = window.innerHeight;
      this.screenW = w; this.screenH = h;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      const vh = this.viewH();
      const aspect = U.clamp(w / h, 1.2, 2.4);
      this.bufH = vh; this.bufW = Math.round(vh * aspect);
      // when the window is wider/taller than the clamped aspect, letterbox the world
      this.buf.width = this.bufW; this.buf.height = this.bufH;
      this.lightBuf.width = this.bufW; this.lightBuf.height = this.bufH;
      const fit = Math.min((w * dpr) / this.bufW, (h * dpr) / this.bufH);
      this.scale = fit; // device px per buffer px
      const k = Math.max(1, Math.floor(fit));
      this.intScale = k;
      this.mid.width = this.bufW * k; this.mid.height = this.bufH * k;
      this.drawW = Math.round(this.bufW * fit); this.drawH = Math.round(this.bufH * fit);
      this.offX = Math.round((w * dpr - this.drawW) / 2); this.offY = Math.round((h * dpr - this.drawH) / 2);
      this.bctx.imageSmoothingEnabled = false;
      if (AS.game && AS.game.camera) AS.game.camera.setView(this.bufW, this.bufH);
    },
    // CSS pixel → buffer pixel
    screenToBuf(sx, sy) {
      return { x: (sx * this.dpr - this.offX) / this.scale, y: (sy * this.dpr - this.offY) / this.scale };
    },
    bufToScreen(bx, by) { return { x: (bx * this.scale + this.offX) / this.dpr, y: (by * this.scale + this.offY) / this.dpr }; },
    light(x, y, r, col, a) { if (this.lights.length < 220) this.lights.push({ x, y, r, col, a: a === undefined ? 0.5 : a }); },
    floatText(x, y, txt, col) { if (this.texts.length < 40) this.texts.push({ x, y, txt, col: col || '#fff', t: 1.1 }); },

    /* Main world render. g = game world */
    renderWorld(g, dt) {
      this.time += dt;
      const ctx = this.bctx, cam = g.camera, T = g.terrain;
      const vw = this.bufW, vh = this.bufH;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, vw, vh);
      const z = cam.zoom;
      ctx.setTransform(z, 0, 0, z, 0, 0);
      const ox = cam.x, oy = cam.y;
      this.ox = ox; this.oy = oy;
      // ---- terrain
      const S = CH();
      T.frame = (T.frame || 0) + 1;
      const x0 = Math.floor(cam.x / S), x1 = Math.floor((cam.x + cam.w) / S);
      const y0 = Math.floor(cam.y / S), y1 = Math.floor((cam.y + cam.h) / S);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const cv = T.getChunk(cx, cy);
        ctx.drawImage(cv, cx * S - ox, cy * S - oy);
      }
      // prefetch ring around view biased toward travel direction
      const q = [];
      const p = g.player;
      const ldx = p ? Math.sign(p.vx) : 0, ldy = p ? Math.sign(p.vy) : 0;
      for (let cy = y0 - 1; cy <= y1 + 1; cy++) for (let cx = x0 - 1; cx <= x1 + 1; cx++) if (!T.hasChunk(cx, cy)) q.push([cx, cy]);
      for (let cy = y0 - 2; cy <= y1 + 2; cy++) for (let cx = x0 - 2; cx <= x1 + 2; cx++) {
        if (cx >= x0 - 1 && cx <= x1 + 1 && cy >= y0 - 1 && cy <= y1 + 1) continue;
        const ahead = (ldx && Math.sign(cx - (x0 + x1) / 2) === ldx) || (ldy && Math.sign(cy - (y0 + y1) / 2) === ldy);
        if (ahead && !T.hasChunk(cx, cy)) q.push([cx, cy]);
      }
      T.work(AS.Settings && AS.Settings.quality === 'low' ? 2.5 : 3.5, q);

      // ---- ground layer (pads, zones, telegraphs)
      g.drawGround(ctx, ox, oy, this);
      AS.Particles.draw(ctx, ox, oy, 0, cam.w, cam.h);

      // ---- collect & sort drawables
      const list = this.drawList; list.length = 0;
      g.collectDrawables(list, cam.x - 120, cam.y - 160, cam.x + cam.w + 120, cam.y + cam.h + 200);
      list.sort((a, b) => a.sortY - b.sortY);
      // shadows
      const shadowA = g.world.light.shadow !== undefined ? g.world.light.shadow : 0.3;
      if (shadowA > 0) {
        ctx.globalAlpha = shadowA;
        for (let i = 0; i < list.length; i++) if (list[i].drawShadow) list[i].drawShadow(ctx, ox, oy);
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < list.length; i++) list[i].draw(ctx, ox, oy, this);
      AS.Particles.draw(ctx, ox, oy, 1, cam.w, cam.h);
      g.drawProjectiles(ctx, ox, oy, this);
      g.drawOverlay(ctx, ox, oy, this);

      // ---- lighting
      this.applyLights(g, ctx, ox, oy, vw, vh);
      // ---- weather
      if (g.hazards) g.hazards.drawWeather(ctx, ox, oy, vw, vh, this);
      // floating texts
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px "Share Tech Mono", monospace';
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t -= dt; t.y -= dt * 16;
        if (t.t <= 0) { this.texts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, t.t * 2);
        ctx.fillStyle = '#000'; ctx.fillText(t.txt, Math.round(t.x - ox) + 1, Math.round(t.y - oy) + 1);
        ctx.fillStyle = t.col; ctx.fillText(t.txt, Math.round(t.x - ox), Math.round(t.y - oy));
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // flash overlay
      if (cam.flashA > 0.01) {
        ctx.globalAlpha = cam.flashA; ctx.fillStyle = cam.flashCol; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
      }
    },

    applyLights(g, ctx, ox, oy, vw, vh) {
      const L = g.world.light;
      const amb = L.ambient;
      const quality = AS.Settings ? AS.Settings.quality : 'high';
      if (amb < 0.99 && quality !== 'low') {
        const lc = this.lctx;
        lc.globalCompositeOperation = 'source-over';
        const a = Math.round(amb * 255);
        lc.fillStyle = 'rgb(' + Math.round(a * 0.92) + ',' + Math.round(a * 0.94) + ',' + a + ')';
        lc.fillRect(0, 0, vw, vh);
        lc.globalCompositeOperation = 'lighter';
        const z = g.camera.zoom;
        for (const l of this.lights) {
          const img = AS.Forge.glow(l.col, 64);
          lc.globalAlpha = Math.min(1, l.a * 1.4);
          lc.drawImage(img, (l.x - ox - l.r) * z, (l.y - oy - l.r) * z, l.r * 2 * z, l.r * 2 * z);
        }
        lc.globalAlpha = 1;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(this.lightBuf, 0, 0);
        ctx.restore();
      } else if (amb < 0.99) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = (1 - amb) * 0.8; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh); ctx.restore();
      }
      // additive bloom from lights
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        const img = AS.Forge.glow(l.col, 64);
        ctx.globalAlpha = l.a * 0.55;
        ctx.drawImage(img, l.x - ox - l.r * 0.6, l.y - oy - l.r * 0.6, l.r * 1.2, l.r * 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (L.tint) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = L.tint; ctx.fillRect(0, 0, vw, vh); ctx.restore(); }
      this.lights.length = 0;
    },

    /* Upscale buffer to the main canvas */
    present() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      if (this.offX > 0 || this.offY > 0) ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const k = this.intScale;
      if (Math.abs(this.scale - k) < 0.04) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.buf, this.offX, this.offY, this.drawW, this.drawH);
      } else {
        this.mctx.imageSmoothingEnabled = false;
        this.mctx.drawImage(this.buf, 0, 0, this.mid.width, this.mid.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.mid, this.offX, this.offY, this.drawW, this.drawH);
      }
      ctx.imageSmoothingEnabled = true;
    },

    /* Helper used by entities: draw a sheet frame at world position (ground x,y; height z) */
    sprite(ctx, sh, angle, anim, x, y, z, ox, oy, alpha) {
      const di = AS.Forge.frameIndex(sh, angle);
      const ai = anim ? Math.floor(anim) % sh.anims : 0;
      const img = sh.frames[ai][di];
      if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
      ctx.drawImage(img, Math.round(x - ox - sh.ax), Math.round(y - z - oy - sh.ay));
      if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
    },
    shadow(ctx, sh, angle, x, y, z, ox, oy, k) {
      const di = AS.Forge.frameIndex(sh, angle);
      const off = 2 + z * 0.12;
      ctx.drawImage(sh.shadows[di], Math.round(x - ox - sh.ax + off + z * 0.15), Math.round(y - oy - sh.ay + off * 0.5 + (k || 0)));
    },
    flashSprite(ctx, sh, angle, anim, x, y, z, ox, oy, col) {
      // white hit-flash: draw silhouette with additive tint
      const di = AS.Forge.frameIndex(sh, angle);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      const key = '__flash';
      let f = sh[key];
      if (!f) { f = sh[key] = sh.frames[0].map((img) => { const c = AS.Forge.canvas(img.width, img.height); const x2 = c.getContext('2d'); x2.drawImage(img, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = col || '#ffffff'; x2.fillRect(0, 0, c.width, c.height); return c; }); }
      ctx.drawImage(f[di], Math.round(x - ox - sh.ax), Math.round(y - z - oy - sh.ay));
      ctx.restore();
    },
  };
  AS.Renderer = R;
})(window.AS);
