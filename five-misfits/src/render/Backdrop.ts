import * as THREE from 'three';
import { makeCanvas, ctx2d, type Ctx } from '../art/paint';
import { Rng } from '../core/rng';

interface Layer { mesh: THREE.Mesh; fx: number; fy: number; baseX: number; baseY: number }

/**
 * Layered painted backdrop: sky gradient, the approved far-ruins band from the reference art,
 * misty hills, a crooked village roofline. Parallax is applied manually (orthographic camera).
 */
export class Backdrop {
  readonly group = new THREE.Group();
  private layers: Layer[] = [];
  private disposables: (THREE.Texture | THREE.Material | THREE.BufferGeometry)[] = [];

  constructor(private levelW: number, private levelH: number) {
    this.addSky();
    this.addFarRuins();
    this.addHills();
    this.addRoofline();
  }

  private plane(tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, fx: number, fy: number, opacity = 1): Layer {
    tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity });
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
    this.group.add(mesh); this.disposables.push(tex, mat, geo);
    const layer = { mesh, fx, fy, baseX: x, baseY: y }; this.layers.push(layer); return layer;
  }

  private addSky(): void {
    const c = makeCanvas(16, 512), x = ctx2d(c);
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#4f8fe0'); g.addColorStop(0.35, '#6aa4e6'); g.addColorStop(0.62, '#9ec0e6'); g.addColorStop(0.8, '#d9dfe6'); g.addColorStop(1, '#efe0c8');
    x.fillStyle = g; x.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(c);
    const W = this.levelW * 3, H = this.levelH * 2.4;
    this.plane(tex, W, H, this.levelW / 2, this.levelH * 0.55, -60, 0, 0);
    // clouds
    // Thin, elongated cloud streaks high in the sky; they must never bury the far ruins.
    const cc = makeCanvas(2048, 256), cx = ctx2d(cc); const rng = new Rng(21);
    for (let i = 0; i < 14; i++) {
      const bx = rng.range(0, 2048), by = rng.range(40, 200), s = rng.range(18, 40);
      for (let k = 0; k < 9; k++) {
        const px = bx + rng.range(-s * 4, s * 4), py = by + rng.range(-s * 0.25, s * 0.25), r = s * rng.range(0.5, 1.0);
        const gr = cx.createRadialGradient(px, py, r * 0.1, px, py, r);
        gr.addColorStop(0, 'rgba(255,250,240,0.55)'); gr.addColorStop(0.6, 'rgba(240,238,235,0.25)'); gr.addColorStop(1, 'rgba(230,230,235,0)');
        cx.fillStyle = gr; cx.beginPath(); cx.ellipse(px, py, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); cx.fill();
      }
    }
    this.plane(new THREE.CanvasTexture(cc), this.levelW * 1.6, this.levelW * 0.2, this.levelW / 2, this.levelH * 0.9, -58, 0.05, 0.02, 0.55);
  }

  private addFarRuins(): void {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(`${import.meta.env.BASE_URL}art/far-ruins.png`);
    // One tile spans the whole level width so the mirrored neighbours stay off-screen at fit zoom.
    const w = this.levelW * 3, h = w * 330 / 3072;
    this.plane(tex, w, h, this.levelW / 2, 21 + h / 2, -50, 0.1, 0.04);
  }

  private addHills(): void {
    const c = makeCanvas(2048, 400), x = ctx2d(c); const rng = new Rng(5);
    const band = (base: number, amp: number, color: string, trees: boolean) => {
      x.fillStyle = color; x.beginPath(); x.moveTo(0, 400);
      for (let i = 0; i <= 64; i++) { const px = (i / 64) * 2048; const u = i / 64 * Math.PI * 2; x.lineTo(px, base - amp * (0.5 + 0.5 * Math.sin(u * 2.3 + 1) + 0.25 * Math.sin(u * 5.1))); }
      x.lineTo(2048, 400); x.closePath(); x.fill();
      if (trees) for (let i = 0; i < 160; i++) { const px = rng.range(0, 2048); const u = px / 2048 * Math.PI * 2; const by = base - amp * (0.5 + 0.5 * Math.sin(u * 2.3 + 1) + 0.25 * Math.sin(u * 5.1)); const hgt = rng.range(10, 26); x.beginPath(); x.moveTo(px - hgt * 0.3, by + 2); x.lineTo(px, by - hgt); x.lineTo(px + hgt * 0.3, by + 2); x.closePath(); x.fill(); }
    };
    band(250, 70, 'rgba(96,120,160,0.9)', false);
    band(300, 60, 'rgba(70,92,128,0.95)', true);
    const tex = new THREE.CanvasTexture(c);
    this.plane(tex, this.levelW * 1.6, this.levelW * 1.6 * 400 / 2048, this.levelW / 2, 12, -40, 0.25, 0.08);
  }

  private addRoofline(): void {
    // Crooked village houses in silhouette with warm windows: the village behind the battlefield.
    const c = makeCanvas(4096, 320), x = ctx2d(c); const rng = new Rng(9);
    const houses: { bx: number; w: number; h: number }[] = [];
    let bx = 10;
    while (bx < 4050) { const w = rng.range(70, 130), h = rng.range(60, 130); houses.push({ bx, w, h }); bx += w + rng.range(-8, 30); }
    for (const hs of houses) {
      const base = 320, top = base - hs.h, lean = rng.range(-8, 8);
      x.fillStyle = '#3a4258';
      x.beginPath(); x.moveTo(hs.bx, base); x.lineTo(hs.bx + lean, top); x.lineTo(hs.bx + hs.w + lean, top + rng.range(-6, 6)); x.lineTo(hs.bx + hs.w, base); x.closePath(); x.fill();
      // roof
      x.fillStyle = '#2d3447'; x.beginPath(); x.moveTo(hs.bx - 10 + lean, top + 3); x.lineTo(hs.bx + hs.w / 2 + lean + rng.range(-14, 14), top - rng.range(28, 60)); x.lineTo(hs.bx + hs.w + 10 + lean, top + 3); x.closePath(); x.fill();
      // chimney
      if (rng.next() < 0.6) { x.fillStyle = '#2d3447'; x.fillRect(hs.bx + lean + hs.w * rng.range(0.6, 0.8), top - rng.range(30, 50), 10, 40); }
      // windows
      for (let i = 0; i < 3; i++) if (rng.next() < 0.5) { x.fillStyle = `rgba(255,190,110,${rng.range(0.5, 0.9)})`; x.fillRect(hs.bx + lean + 14 + i * 22, top + 20 + rng.range(0, Math.max(4, hs.h - 50)), 7, 10); }
    }
    this.paintMist(x, 4096, 320);
    const tex = new THREE.CanvasTexture(c);
    const w = this.levelW * 1.5, h = w * 320 / 4096;
    this.plane(tex, w, h, this.levelW / 2, 7 + h / 2, -30, 0.5, 0.15, 0.95);
  }

  private paintMist(x: Ctx, w: number, h: number): void {
    const g = x.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(200,210,225,0)'); g.addColorStop(1, 'rgba(200,210,225,0.55)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }

  /** Shift layers for parallax: fx = 0 moves with the camera (infinitely far), 1 = world locked. */
  update(camX: number, camY: number): void {
    const cxr = this.levelW / 2, cyr = this.levelH / 2;
    for (const l of this.layers) {
      l.mesh.position.x = l.baseX + (camX - cxr) * (1 - l.fx);
      l.mesh.position.y = l.baseY + (camY - cyr) * (1 - l.fy);
    }
  }

  dispose(): void { for (const d of this.disposables) d.dispose(); }
}
