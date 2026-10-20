import * as THREE from 'three';
import type { Fx } from '../game/game';
import { softDisc, ringSprite, chunkSprite, makeCanvas, ctx2d } from '../art/paint';

const MAX = 512;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();

class Pool {
  mesh: THREE.InstancedMesh;
  n = 0;
  constructor(scene: THREE.Group, canvas: HTMLCanvasElement, additive: boolean, z: number) {
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.position.z = z; this.mesh.frustumCulled = false; this.mesh.renderOrder = 50;
    scene.add(this.mesh);
  }
  begin(): void { this.n = 0; }
  add(x: number, y: number, size: number, rot: number, color: THREE.Color, alpha: number): void {
    if (this.n >= MAX) return;
    tmpP.set(x, y, 0); tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot); tmpS.set(size, size, 1);
    tmpM.compose(tmpP, tmpQ, tmpS); this.mesh.setMatrixAt(this.n, tmpM);
    tmpC.copy(color).multiplyScalar(alpha); this.mesh.setColorAt(this.n, tmpC);
    this.n++;
  }
  end(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  dispose(): void { this.mesh.geometry.dispose(); const m = this.mesh.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); }
}

/** Damage numbers and labels: small cached canvas sprites. */
class TextSprites {
  private cache = new Map<string, THREE.CanvasTexture>();
  private pool: THREE.Sprite[] = [];
  private used = 0;
  constructor(private root: THREE.Group) {}
  begin(): void { this.used = 0; }
  draw(text: string, x: number, y: number, color: string, alpha: number, size: number): void {
    const key = `${text}|${color}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const c = makeCanvas(256, 64), g = ctx2d(c);
      g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, 128, 34); g.fillStyle = color; g.fillText(text, 128, 34);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; this.cache.set(key, tex);
    }
    let s = this.pool[this.used];
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.renderOrder = 60; this.root.add(s); this.pool.push(s); }
    const m = s.material as THREE.SpriteMaterial; m.map = tex; m.opacity = alpha; m.needsUpdate = true;
    s.position.set(x, y, 3); s.scale.set(size * 4, size, 1); s.visible = true;
    this.used++;
  }
  end(): void { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
  dispose(): void { for (const t of this.cache.values()) t.dispose(); for (const s of this.pool) (s.material as THREE.Material).dispose(); }
}

/** Instanced particle rendering for the game's fx list (debris, sparks, smoke, flashes, rings, text). */
export class Particles {
  readonly group = new THREE.Group();
  private disc: Pool; private glow: Pool; private chunk: Pool; private ring: Pool;
  private text: TextSprites;
  private col = new THREE.Color();

  constructor() {
    this.disc = new Pool(this.group, softDisc(96, 0.1, 1.4), false, 2.5);
    this.glow = new Pool(this.group, softDisc(96, 0.0, 1.0), true, 2.6);
    this.chunk = new Pool(this.group, chunkSprite(32), false, 2.4);
    this.ring = new Pool(this.group, ringSprite(128, 0.1), true, 2.7);
    this.text = new TextSprites(this.group);
  }

  sync(fx: Fx[], time: number): void {
    this.disc.begin(); this.glow.begin(); this.chunk.begin(); this.ring.begin(); this.text.begin();
    for (const f of fx) {
      const a = Math.max(0, Math.min(1, f.life / f.max));
      switch (f.kind) {
        case 'debris': this.col.set(f.color); this.chunk.add(f.x, f.y, f.size * 1.3, time * 6 + f.x, this.col, 1); break;
        case 'spark': this.col.set(f.color); this.glow.add(f.x, f.y, f.size * 2.2 * (0.5 + a), 0, this.col, a); break;
        case 'smoke': this.col.set(f.color); this.disc.add(f.x, f.y, f.size * (2.2 - a * 1.0), f.x * 3, this.col, a * 0.5); break;
        case 'flash': this.col.set(f.color); this.glow.add(f.x, f.y, f.size * (1.6 + 1.2 * a), 0, this.col, a); break;
        case 'ring': this.col.set(f.color); this.ring.add(f.x, f.y, f.size * 2 * (1.35 - a), 0, this.col, a * 0.9); break;
        case 'text': this.text.draw(f.text ?? '', f.x, f.y, f.color, a, f.size * 1.1); break;
        case 'line': break; // drawn by Overlays
      }
    }
    this.disc.end(); this.glow.end(); this.chunk.end(); this.ring.end(); this.text.end();
  }

  dispose(): void { this.disc.dispose(); this.glow.dispose(); this.chunk.dispose(); this.ring.dispose(); this.text.dispose(); }
}
