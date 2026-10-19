/** Separates taps from drags and pinches. Camera gestures never reach the tap handler. */
export interface PointerHandlers {
  tap(x: number, y: number): void;
  drag(dx: number, dy: number): void;
  pinch(factor: number): void;
  wheel(delta: number): void;
}
const DRAG_PX = 9;

export class Pointer {
  private active = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragging = false; private pinchDist = 0;
  constructor(private el: HTMLElement, private h: PointerHandlers) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.down); el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up); el.addEventListener('pointercancel', this.up); el.addEventListener('lostpointercapture', this.up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.h.wheel(e.deltaY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  private down = (e: PointerEvent): void => {
    this.el.setPointerCapture?.(e.pointerId);
    this.active.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.active.size === 2) { this.dragging = true; this.pinchDist = this.dist(); }
    if (this.active.size === 1) this.dragging = false;
  };
  private move = (e: PointerEvent): void => {
    const p = this.active.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (this.active.size >= 2) { const d = this.dist(); if (this.pinchDist > 0) this.h.pinch(d / this.pinchDist); this.pinchDist = d; return; }
    if (!this.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > DRAG_PX) this.dragging = true;
    if (this.dragging) this.h.drag(dx, dy);
  };
  private up = (e: PointerEvent): void => {
    const p = this.active.get(e.pointerId); if (!p) return;
    this.active.delete(e.pointerId);
    if (!this.dragging && this.active.size === 0 && e.type === 'pointerup') this.h.tap(e.clientX, e.clientY);
    if (this.active.size === 0) this.dragging = false;
  };
  private dist(): number { const [a, b] = [...this.active.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
}
