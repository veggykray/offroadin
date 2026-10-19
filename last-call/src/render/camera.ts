import { clamp, lerp } from '../core/math';

/** Smooth 2D side-view camera. Default zoom fits the whole level; the user can zoom in up to 4x. */
export class Camera {
  x = 50; y = 28;
  zoom = 10;
  targetX = 50; targetY = 28; targetZoom = 10;
  fitZoom = 10;
  vw = 1280; vh = 720;
  shakeX = 0; shakeY = 0;
  constructor(readonly levelW: number, readonly levelH: number) {}

  resize(vw: number, vh: number): void {
    const wasFit = Math.abs(this.targetZoom - this.fitZoom) < 1e-6;
    this.vw = vw; this.vh = vh;
    this.fitZoom = Math.min(vw / this.levelW, vh / this.levelH);
    if (wasFit) { this.targetZoom = this.fitZoom; this.zoom = this.fitZoom; }
    this.clampTarget();
  }
  get isFit(): boolean { return Math.abs(this.targetZoom - this.fitZoom) < 1e-6; }
  get maxZoom(): number { return this.fitZoom * 4; }

  fitAll(): void { this.targetZoom = this.fitZoom; this.targetX = this.levelW / 2; this.targetY = this.levelH / 2; }
  focusOn(wx: number, wy: number, zoom?: number): void {
    if (zoom !== undefined) this.targetZoom = clamp(zoom, this.fitZoom, this.maxZoom);
    this.targetX = wx; this.targetY = wy; this.clampTarget();
  }
  pan(dxScreen: number, dyScreen: number): void {
    this.targetX -= dxScreen / this.targetZoom; this.targetY += dyScreen / this.targetZoom; this.clampTarget();
    this.x = this.targetX; this.y = this.targetY;
  }
  /** Zoom by a factor keeping the world point under the cursor fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.targetZoom = clamp(this.targetZoom * factor, this.fitZoom, this.maxZoom);
    this.zoom = this.targetZoom;
    const after = this.screenToWorld(sx, sy);
    this.targetX += before.x - after.x; this.targetY += before.y - after.y;
    this.clampTarget(); this.x = this.targetX; this.y = this.targetY;
  }
  private clampTarget(): void {
    const hw = this.vw / (2 * this.targetZoom), hh = this.vh / (2 * this.targetZoom);
    this.targetX = hw * 2 >= this.levelW ? this.levelW / 2 : clamp(this.targetX, hw, this.levelW - hw);
    this.targetY = hh * 2 >= this.levelH ? this.levelH / 2 : clamp(this.targetY, hh, this.levelH - hh);
  }
  update(dt: number, shake: number, shakeEnabled: boolean, t: number): void {
    const k = 1 - Math.exp(-7 * dt);
    this.x = lerp(this.x, this.targetX, k); this.y = lerp(this.y, this.targetY, k); this.zoom = lerp(this.zoom, this.targetZoom, k);
    const amp = shakeEnabled ? shake * 0.35 : 0;
    this.shakeX = Math.sin(t * 61) * amp; this.shakeY = Math.cos(t * 47) * amp;
  }
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.x - this.shakeX) * this.zoom + this.vw / 2, y: this.vh / 2 - (wy - this.y - this.shakeY) * this.zoom };
  }
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.vw / 2) / this.zoom + this.x + this.shakeX, y: (this.vh / 2 - sy) / this.zoom + this.y + this.shakeY };
  }
  /** Apply a world->screen transform (y up) to the context. */
  applyTo(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.zoom, 0, 0, -this.zoom, this.vw / 2 - (this.x + this.shakeX) * this.zoom, this.vh / 2 + (this.y + this.shakeY) * this.zoom);
  }
}
