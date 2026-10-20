import * as THREE from 'three';
import { Mat, type Terrain } from '../world/terrain';
import { makeCanvas, ctx2d, makeTiles, type Ctx } from '../art/paint';
import { Rng } from '../core/rng';

/**
 * Paints the terrain grid into a single large canvas texture: material tiles per cell, dark
 * outlines on every solid/air boundary, highlights and grass fringes along walkable tops, and
 * an inner shadow below surfaces. Repaints only the changed regions after terrain damage.
 */
export class TerrainPainter {
  readonly PX = 8;                       // texture pixels per terrain cell (0.25 units) -> 32 px per world unit
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh;
  private c: Ctx;
  private tiles = makeTiles(11);
  private version = -1;

  constructor(private t: Terrain) {
    this.canvas = makeCanvas(t.cols * this.PX, t.rows * this.PX);
    this.c = ctx2d(this.canvas);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter; this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(t.width, t.height);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(t.width / 2, t.height / 2, 0);
    this.repaintAll();
  }

  /** Call every frame; repaints changed regions when the terrain version advanced. */
  sync(): void {
    if (this.t.version === this.version) return;
    const dirty = this.t.takeDirty();
    if (dirty.length === 0 || dirty.length > 40) this.repaintAll();
    else for (const d of dirty) this.repaintRegion(d.x0 - 1.5, d.y0 - 1.5, d.x1 + 1.5, d.y1 + 1.5);
    this.version = this.t.version;
    this.texture.needsUpdate = true;
  }

  private repaintAll(): void { this.t.takeDirty(); this.repaintRegion(0, 0, this.t.width, this.t.height); }

  private repaintRegion(x0: number, y0: number, x1: number, y1: number): void {
    const t = this.t, cs = t.cellSize, PX = this.PX, c = this.c;
    const cx0 = Math.max(0, Math.floor(x0 / cs)), cx1 = Math.min(t.cols - 1, Math.ceil(x1 / cs));
    const cy0 = Math.max(0, Math.floor(y0 / cs)), cy1 = Math.min(t.rows - 1, Math.ceil(y1 / cs));
    const left = cx0 * PX, top = this.canvas.height - (cy1 + 1) * PX, w = (cx1 - cx0 + 1) * PX, h = (cy1 - cy0 + 1) * PX;
    c.save();
    c.beginPath(); c.rect(left, top, w, h); c.clip();
    c.clearRect(left, top, w, h);
    // 1. material fills (row runs)
    const pat = { [Mat.Stable]: this.tiles.rock.pattern(c), [Mat.Soil]: this.tiles.soil.pattern(c), [Mat.Timber]: this.tiles.timber.pattern(c) } as Record<number, CanvasPattern>;
    for (let cy = cy0; cy <= cy1; cy++) {
      const py = this.canvas.height - (cy + 1) * PX;
      let cx = cx0;
      while (cx <= cx1) {
        const m = t.get(cx, cy); let run = 1;
        while (cx + run <= cx1 && t.get(cx + run, cy) === m) run++;
        if (m !== Mat.Air) { c.fillStyle = pat[m]; c.fillRect(cx * PX, py, run * PX, PX); }
        cx += run;
      }
    }
    // 2. inner shading: darken cells that have air above within 3 cells less, deeper cells slightly darker (depth gradient)
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = t.get(cx, cy); if (m === Mat.Air) continue;
      const py = this.canvas.height - (cy + 1) * PX;
      let depth = 0; while (depth < 6 && t.get(cx, cy + depth + 1) !== Mat.Air) depth++;
      if (depth >= 6) { c.fillStyle = 'rgba(20,14,10,0.18)'; c.fillRect(cx * PX, py, PX, PX); }
      else if (depth >= 3) { c.fillStyle = 'rgba(20,14,10,0.09)'; c.fillRect(cx * PX, py, PX, PX); }
      // side shadows next to a wall face: cells with air to the left get a light edge, to the right a dark edge
      if (t.get(cx - 1, cy) === Mat.Air) { c.fillStyle = 'rgba(255,240,210,0.16)'; c.fillRect(cx * PX, py, 3, PX); }
      if (t.get(cx + 1, cy) === Mat.Air) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(cx * PX + PX - 3, py, 3, PX); }
      if (t.get(cx, cy - 1) === Mat.Air) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(cx * PX, py + PX - 3, PX, 3); }
    }
    // 3. outlines along every boundary (dark), then top highlights
    c.lineWidth = 2.5; c.strokeStyle = '#1b1410'; c.lineCap = 'round';
    c.beginPath();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = t.get(cx, cy); if (m === Mat.Air) continue;
      const x = cx * PX, y = this.canvas.height - (cy + 1) * PX;
      if (t.get(cx, cy + 1) === Mat.Air) { c.moveTo(x, y + 1); c.lineTo(x + PX, y + 1); }
      if (t.get(cx, cy - 1) === Mat.Air) { c.moveTo(x, y + PX - 1); c.lineTo(x + PX, y + PX - 1); }
      if (t.get(cx - 1, cy) === Mat.Air) { c.moveTo(x + 1, y); c.lineTo(x + 1, y + PX); }
      if (t.get(cx + 1, cy) === Mat.Air) { c.moveTo(x + PX - 1, y); c.lineTo(x + PX - 1, y + PX); }
    }
    c.stroke();
    // 4. top surfaces: rock highlight, timber highlight, soil grass fringe
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const m = t.get(cx, cy); if (m === Mat.Air || t.get(cx, cy + 1) !== Mat.Air) continue;
      const x = cx * PX, y = this.canvas.height - (cy + 1) * PX;
      if (m === Mat.Stable) { c.fillStyle = 'rgba(220,225,232,0.55)'; c.fillRect(x, y + 2, PX, 2); }
      else if (m === Mat.Timber) { c.fillStyle = 'rgba(255,220,150,0.5)'; c.fillRect(x, y + 2, PX, 2); }
      else this.grass(c, x, y, cx, cy);
    }
    c.restore();
  }

  /** Grass tufts along a soil top edge (deterministic per cell so repaints match). */
  private grass(c: Ctx, x: number, y: number, cx: number, cy: number): void {
    const rng = new Rng(cx * 7919 + cy * 104729 + 17);
    const PX = this.PX;
    c.fillStyle = '#5f7a2b'; c.fillRect(x, y, PX, 5);
    c.fillStyle = '#7d9a37'; c.fillRect(x, y, PX, 2);
    for (let i = 0; i < 3; i++) {
      const bx = x + rng.range(0, PX), hgt = rng.range(5, 13), lean = rng.range(-4, 4);
      const g = rng.next();
      c.strokeStyle = g < 0.5 ? '#6d8d2f' : g < 0.85 ? '#8aa83c' : '#b8b346';
      c.lineWidth = rng.range(1.4, 2.4); c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx, y + 4); c.quadraticCurveTo(bx + lean * 0.4, y - hgt * 0.5, bx + lean, y - hgt); c.stroke();
    }
    if (rng.next() < 0.08) { c.fillStyle = rng.next() < 0.5 ? '#f3e6c8' : '#d9b85c'; c.beginPath(); c.arc(x + rng.range(1, PX - 1), y - rng.range(5, 10), 1.6, 0, Math.PI * 2); c.fill(); }
  }

  dispose(): void { this.texture.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
