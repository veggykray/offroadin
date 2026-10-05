/* ALIEN STRIKE — camera: smooth follow with movement lead, trauma-based shake,
 * event zoom pulses and screen flashes. Coordinates are world pixels; (x, y) is
 * the top-left of the visible area. */
'use strict';
(function (AS) {
  const U = AS.U;
  class Camera {
    constructor() {
      this.cx = 0; this.cy = 0; this.x = 0; this.y = 0;
      this.vw = 854; this.vh = 480;
      this.zoom = 1; this.baseZoom = 1; this.zoomPulse = 0; this.zoomPulseT = 0; this.zoomPulseDur = 1;
      this.trauma = 0; this.ox = 0; this.oy = 0;
      this.flashA = 0; this.flashCol = '#ffffff';
      this.leadX = 0; this.leadY = 0;
      this.bounds = null;
      this.t = 0;
    }
    snap(x, y) { this.cx = x; this.cy = y; this.leadX = this.leadY = 0; this.apply(); }
    setView(vw, vh) { this.vw = vw; this.vh = vh; }
    shake(amount) {
      if (AS.Settings && AS.Settings.shake === false) return;
      this.trauma = Math.min(1, this.trauma + amount);
    }
    flash(alpha, col) {
      if (AS.Settings && AS.Settings.flash === false) return;
      this.flashA = Math.max(this.flashA, alpha); this.flashCol = col || '#ffffff';
    }
    pulseZoom(amount, dur) { this.zoomPulse = amount; this.zoomPulseT = dur; this.zoomPulseDur = dur; }
    update(dt, tx, ty, vx, vy) {
      this.t += dt;
      // lead in the direction of travel, clamped
      const lx = U.clamp(vx * 0.38, -150, 150), ly = U.clamp(vy * 0.32, -110, 110);
      this.leadX = U.damp(this.leadX, lx, 2.2, dt);
      this.leadY = U.damp(this.leadY, ly, 2.2, dt);
      this.cx = U.damp(this.cx, tx + this.leadX, 6, dt);
      this.cy = U.damp(this.cy, ty + this.leadY, 6, dt);
      // zoom
      let z = this.baseZoom;
      if (this.zoomPulseT > 0) {
        this.zoomPulseT -= dt;
        const k = this.zoomPulseT / this.zoomPulseDur;
        z += this.zoomPulse * Math.sin(Math.min(1, (1 - k) * 4) * Math.PI / 2) * Math.min(1, k * 3);
      }
      this.zoom = U.damp(this.zoom, z, 4, dt);
      if (Math.abs(this.zoom - z) < 5e-4) this.zoom = z; // settle exactly so terrain blits stay 1:1
      // shake
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      const s = this.trauma * this.trauma * 14;
      this.ox = s ? (U.noise2(this.t * 18, 0.5, 7) * s) : 0;
      this.oy = s ? (U.noise2(0.5, this.t * 18, 8) * s) : 0;
      this.flashA = Math.max(0, this.flashA - dt * 2.8);
      this.apply();
    }
    apply() {
      const vw = this.vw / this.zoom, vh = this.vh / this.zoom;
      let cx = this.cx, cy = this.cy;
      if (this.bounds) {
        const b = this.bounds, m = 260;
        cx = U.clamp(cx, b.x0 - m + vw / 2, b.x1 + m - vw / 2);
        cy = U.clamp(cy, b.y0 - m + vh / 2, b.y1 + m - vh / 2);
      }
      // snap to whole buffer pixels (not whole world units) so motion stays smooth
      const q = ((AS.Renderer && AS.Renderer.res) || 1) * this.zoom;
      this.x = Math.round((cx - vw / 2 + this.ox) * q) / q;
      this.y = Math.round((cy - vh / 2 + this.oy) * q) / q;
      this.w = vw; this.h = vh;
    }
    // screen pixel (canvas css px) -> world projected coordinates
    toWorld(sx, sy, scale) { return { x: this.x + sx / (scale * this.zoom), y: this.y + sy / (scale * this.zoom) }; }
  }
  AS.Camera = Camera;
})(window.AS);
