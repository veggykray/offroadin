/* ALIEN STRIKE — renderer.
 * The camera always shows the same world area (viewH world units tall); the world
 * buffer renders it at `res` buffer pixels per world unit — close to the screen's
 * own resolution on high quality, 1:1 (the original low-res pixel look) on low —
 * and is scaled to the full-viewport canvas. All world drawing happens in world
 * units through the context transform. HUD is drawn at native resolution on top.
 * Draw order: terrain → ground layer → low particles → shadows → y-sorted
 * entities → high particles → projectiles → lights / darkness → weather. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;
  const CH = () => AS.Terrain.CH;

  const R = {
    canvas: null, ctx: null, buf: null, bctx: null, mid: null, mctx: null, lightBuf: null, lctx: null,
    bufW: 854, bufH: 480, vw: 854, vh: 480, res: 1, scale: 2, dpr: 1, screenW: 0, screenH: 0,
    lights: [], flares: [], texts: [], drawList: [], time: 0,
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
      if (this.viewHeights) { const v = AS.Settings && AS.Settings.view; return this.viewHeights[v] || this.viewHeights.normal; }
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
      const target = this.viewH();
      const devW = Math.round(w * dpr), devH = Math.round(h * dpr);
      const aspect = U.clamp(devW / devH, 1.2, 2.4);
      // buffer = the device pixels the world occupies (letterboxed beyond the aspect clamp)
      let bufH = devH, bufW = Math.round(devH * aspect);
      if (bufW > devW) { bufW = devW; bufH = Math.round(devW / aspect); }
      const q = AS.Settings ? AS.Settings.quality : 'high';
      let res;
      if (q === 'low') { res = 1; bufH = target; bufW = Math.round(target * aspect); }
      else {
        // texels per world unit, quantised to 1/32 so terrain chunks (256 units) and the
        // camera snap land on whole pixels; the view height flexes by ±1% to absorb it
        const maxRes = q === 'medium' ? 1.6 : 2.4;
        res = Math.max(1, Math.round(U.clamp(bufH / target, 1, maxRes) * 32) / 32);
        if (res * target < bufH - 2) { bufH = Math.round(target * res); bufW = Math.round(bufH * aspect); }
      }
      this.res = res;
      this.bufW = bufW; this.bufH = bufH;
      this.vw = bufW / res; this.vh = bufH / res;
      this.buf.width = this.bufW; this.buf.height = this.bufH;
      // the light buffer matches the world buffer: its multiply composite is then a
      // straight 1:1 blend (a scaled multiply costs far more than the extra pixels)
      this.lightScale = 1;
      this.lightBuf.width = Math.ceil(this.bufW * this.lightScale); this.lightBuf.height = Math.ceil(this.bufH * this.lightScale);
      const fit = Math.min((w * dpr) / this.bufW, (h * dpr) / this.bufH);
      this.scale = fit; // device px per buffer px
      const k = Math.max(1, Math.floor(fit));
      this.intScale = k;
      this.pixelated = this.res <= 1.01;
      if (this.pixelated) { this.mid.width = this.bufW * k; this.mid.height = this.bufH * k; }
      this.drawW = Math.round(this.bufW * fit); this.drawH = Math.round(this.bufH * fit);
      this.offX = Math.round((w * dpr - this.drawW) / 2); this.offY = Math.round((h * dpr - this.drawH) / 2);
      this.bctx.imageSmoothingEnabled = !this.pixelated;
      this.bctx.imageSmoothingQuality = 'high';
      if (AS.Forge && AS.Forge.setRes) AS.Forge.setRes(this.pixelated ? 1 : 2);
      if (AS.game && AS.game.camera) AS.game.camera.setView(this.vw, this.vh);
    },
    // CSS pixel → buffer pixel
    screenToBuf(sx, sy) {
      return { x: (sx * this.dpr - this.offX) / this.scale, y: (sy * this.dpr - this.offY) / this.scale };
    },
    bufToScreen(bx, by) { return { x: (bx * this.scale + this.offX) / this.dpr, y: (by * this.scale + this.offY) / this.dpr }; },
    // CSS pixel → world (projected) coordinates
    screenToWorld(sx, sy, cam) {
      const b = this.screenToBuf(sx, sy), k = cam.zoom * this.res;
      return { x: cam.x + b.x / k, y: cam.y + b.y / k };
    },
    // world (projected) coordinates → device pixel on the main canvas (HUD space)
    worldToScreen(wx, wy, cam) {
      const k = cam.zoom * this.res * this.scale;
      return { x: (wx - cam.x) * k + this.offX, y: (wy - cam.y) * k + this.offY };
    },
    // device pixels per world unit at the current zoom (HUD sizing)
    worldScale(cam) { return cam.zoom * this.res * this.scale; },
    light(x, y, r, col, a) { if (this.lights.length < 220) this.lights.push({ x, y, r, col, a: a === undefined ? 0.5 : a }); },
    /* a light that lives for a while and fades (muzzle flashes, explosions) */
    flare(x, y, r, col, a, life) { if (this.flares.length < 80) this.flares.push({ x, y, r, col, a: a === undefined ? 0.6 : a, life: life || 0.15, max: life || 0.15 }); },
    floatText(x, y, txt, col) { if (this.texts.length < 40) this.texts.push({ x, y, txt, col: col || '#fff', t: 1.1 }); },

    /* Main world render. g = game world */
    renderWorld(g, dt) {
      this.time += dt;
      if (AS.Forge.beginFrame) AS.Forge.beginFrame();
      const ctx = this.bctx, cam = g.camera, T = g.terrain;
      const vw = this.vw, vh = this.vh;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, this.bufW, this.bufH);
      const z = cam.zoom, zr = z * this.res;
      ctx.setTransform(zr, 0, 0, zr, 0, 0);
      const ox = cam.x, oy = cam.y;
      this.ox = ox; this.oy = oy;
      // ---- terrain
      const S = CH();
      T.frame = (T.frame || 0) + 1;
      const x0 = Math.floor(cam.x / S), x1 = Math.floor((cam.x + cam.w) / S);
      const y0 = Math.floor(cam.y / S), y1 = Math.floor((cam.y + cam.h) / S);
      // chunks are rasterised at the render scale, so at zoom 1 they blit 1:1; while the
      // camera zooms they overlap by one device pixel so scaling never opens seams
      const exact = T.TD === this.res && Math.abs(z - 1) < 1e-4;
      const ov = this.pixelated || exact ? 0 : 1 / zr;
      /* Filtering: the 'high' quality filter re-derives mipmaps / cubic taps on every
       * draw, which under software rasterisation doubles the cost of the frame. Where
       * a source is drawn at ≥ 0.55 of its size (chunks: always, they are rasterised at
       * the render scale; sprite sheets: whenever the screen is large enough) plain
       * bilinear is visually identical (< 1/255 mean difference), so it is used; on
       * small screens sprites shrink further and keep the high-quality filter. */
      const fq = zr / ((AS.Forge && AS.Forge.res) || 2) >= 0.55 ? 'low' : 'high';
      ctx.imageSmoothingQuality = 'low';
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const cv = T.getChunk(cx, cy);
        ctx.drawImage(cv, cx * S - ox, cy * S - oy, S + ov, S + ov);
      }
      // prefetch ring around view biased toward travel direction
      const q = [];
      const p = g.player;
      const ldx = p ? Math.sign(p.vx) : 0, ldy = p ? Math.sign(p.vy) : 0;
      for (let cy = y0 - 1; cy <= y1 + 1; cy++) for (let cx = x0 - 1; cx <= x1 + 1; cx++) if (!T.hasChunk(cx, cy)) q.push([cx, cy]);
      // terrains that shade off the main thread can afford to look a ring further ahead
      const ring = T.async ? 3 : 2;
      for (let cy = y0 - ring; cy <= y1 + ring; cy++) for (let cx = x0 - ring; cx <= x1 + ring; cx++) {
        if (cx >= x0 - 1 && cx <= x1 + 1 && cy >= y0 - 1 && cy <= y1 + 1) continue;
        if (ring > 2 && (cx < x0 - 2 || cx > x1 + 2 || cy < y0 - 2 || cy > y1 + 2) && !((ldx && Math.sign(cx - (x0 + x1) / 2) === ldx && Math.abs(p.vx) > Math.abs(p.vy) * 0.5) || (ldy && Math.sign(cy - (y0 + y1) / 2) === ldy && Math.abs(p.vy) > Math.abs(p.vx) * 0.5))) continue;
        const ahead = (ldx && Math.sign(cx - (x0 + x1) / 2) === ldx) || (ldy && Math.sign(cy - (y0 + y1) / 2) === ldy);
        if (ahead && !T.hasChunk(cx, cy)) q.push([cx, cy]);
      }
      T.work(AS.Settings && AS.Settings.quality === 'low' ? 2.5 : 3.5, q);

      ctx.imageSmoothingQuality = fq;
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
      // cloud shadows fall on the ground and everything standing on it
      if (AS.Atmosphere) AS.Atmosphere.under(ctx, g, this);

      // ---- lighting
      for (let i = this.flares.length - 1; i >= 0; i--) {
        const f = this.flares[i];
        f.life -= dt;
        if (f.life <= 0) { this.flares.splice(i, 1); continue; }
        const k = f.life / f.max;
        this.light(f.x, f.y, f.r * (0.7 + 0.3 * k), f.col, f.a * k * k);
      }
      this.applyLights(g, ctx, ox, oy, vw, vh);
      // ---- weather
      if (g.hazards) g.hazards.drawWeather(ctx, ox, oy, vw, vh, this);
      if (AS.Atmosphere) AS.Atmosphere.over(ctx, g, this);
      // floating texts
      ctx.textAlign = 'center';
      ctx.font = this.textFont || 'bold 8px "Share Tech Mono", monospace';
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t -= dt; t.y -= dt * 16;
        if (t.t <= 0) { this.texts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, t.t * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(t.txt, t.x - ox + 0.6, t.y - oy + 0.6);
        ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x - ox, t.y - oy);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // flash overlay
      if (cam.flashA > 0.01) {
        ctx.globalAlpha = cam.flashA; ctx.fillStyle = cam.flashCol; ctx.fillRect(0, 0, this.bufW, this.bufH); ctx.globalAlpha = 1;
      }
    },

    applyLights(g, ctx, ox, oy, vw, vh) {
      const L = g.world.light;
      const amb = L.ambient;
      const quality = AS.Settings ? AS.Settings.quality : 'high';
      if (amb < 0.99 && quality !== 'low') {
        const lc = this.lctx, LW = this.lightBuf.width, LH = this.lightBuf.height;
        lc.globalCompositeOperation = 'source-over';
        const a = Math.round(amb * 255);
        lc.fillStyle = 'rgb(' + Math.round(a * 0.92) + ',' + Math.round(a * 0.94) + ',' + a + ')';
        lc.fillRect(0, 0, LW, LH);
        lc.globalCompositeOperation = 'lighter';
        lc.imageSmoothingQuality = 'low'; // glows are magnified soft gradients
        const z = g.camera.zoom * this.res * this.lightScale;
        for (const l of this.lights) {
          const img = AS.Forge.glow(l.col, 64);
          lc.globalAlpha = Math.min(1, l.a * 1.4);
          lc.drawImage(img, (l.x - ox - l.r) * z, (l.y - oy - l.r) * z, l.r * 2 * z, l.r * 2 * z);
        }
        lc.globalAlpha = 1;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(this.lightBuf, 0, 0, this.bufW, this.bufH);
        ctx.restore();
      } else if (amb < 0.99) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = (1 - amb) * 0.8; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.bufW, this.bufH); ctx.restore();
      }
      // additive bloom from lights
      const sq = ctx.imageSmoothingQuality; ctx.imageSmoothingQuality = 'low';
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        const img = AS.Forge.glow(l.col, 64);
        ctx.globalAlpha = l.a * 0.55;
        ctx.drawImage(img, l.x - ox - l.r * 0.6, l.y - oy - l.r * 0.6, l.r * 1.2, l.r * 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingQuality = sq;
      if (L.tint) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = L.tint; ctx.fillRect(0, 0, this.bufW, this.bufH); ctx.restore(); }
      this.lastLights = this.lights.length;
      this.lights.length = 0;
    },

    /* Upscale buffer to the main canvas */
    present() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      if (this.offX > 0 || this.offY > 0) ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const k = this.intScale;
      if (!this.pixelated) {
        // 1:1 when the buffer matches the device pixels (the usual case)
        const exact = this.drawW === this.bufW && this.drawH === this.bufH;
        ctx.imageSmoothingEnabled = !exact;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(this.buf, this.offX, this.offY, this.drawW, this.drawH);
      } else if (Math.abs(this.scale - k) < 0.04) {
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
      ctx.drawImage(img, x - ox - sh.ax, y - z - oy - sh.ay, sh.w, sh.h);
      if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
    },
    // draw a specific frame image of a sheet at a world anchor point
    blit(ctx, sh, img, x, y, sc) {
      sc = sc || 1;
      ctx.drawImage(img, x - sh.ax * sc, y - sh.ay * sc, sh.w * sc, sh.h * sc);
    },
    shadow(ctx, sh, angle, x, y, z, ox, oy, k) {
      const di = AS.Forge.frameIndex(sh, angle);
      const off = 2 + z * 0.12;
      ctx.drawImage(sh.shadows[di], x - ox - sh.ax + off + z * 0.15, y - oy - sh.ay + off * 0.5 + (k || 0), sh.w, sh.h);
    },
    flashSprite(ctx, sh, angle, anim, x, y, z, ox, oy, col) {
      // white hit-flash: draw silhouette with additive tint
      const di = AS.Forge.frameIndex(sh, angle);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      const key = '__flash';
      let f = sh[key];
      if (!f) f = sh[key] = [];
      // one direction at a time, as it is first needed
      if (!f[di]) { const img = sh.frames[0][di]; const c = AS.Forge.canvas(img.width, img.height); const x2 = c.getContext('2d'); x2.drawImage(img, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = col || '#ffffff'; x2.fillRect(0, 0, c.width, c.height); f[di] = c; }
      ctx.drawImage(f[di], x - ox - sh.ax, y - z - oy - sh.ay, sh.w, sh.h);
      ctx.restore();
    },
  };
  AS.Renderer = R;
})(window.AS);
