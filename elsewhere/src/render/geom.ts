import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Seeded RNG for deterministic dressing. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}

/** Box whose UVs are scaled so one texture tile covers `tile` world units on every face. */
export function boxGeom(w: number, h: number, d: number, tile = 2): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * faces[f][0] / tile, uv.getY(i) * faces[f][1] / tile); }
  return g;
}

/** Push vertices along their normals by a hashed noise: irregular, shaggy or rocky silhouettes. */
export function roughen(g: THREE.BufferGeometry, amp: number, freq = 3, seed = 1): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
  const h = (x: number, y: number, z: number): number => { const s = Math.sin(x * 12.9898 * freq + y * 78.233 * freq + z * 37.719 * freq + seed) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const q = (h(Math.round(x * 20) / 20, Math.round(y * 20) / 20, Math.round(z * 20) / 20) - 0.5) * 2 * amp;
    p.setXYZ(i, x + n.getX(i) * q, y + n.getY(i) * q, z + n.getZ(i) * q);
  }
  p.needsUpdate = true; g.computeVertexNormals(); return g;
}

export function placed(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
}

/** Collects geometry per material and emits one merged mesh per material. */
export class Merger {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, g: THREE.BufferGeometry): void {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat)!.push(g.index ? g.toNonIndexed() : g);
  }
  build(group: THREE.Group, shadows = true): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.buckets) {
      for (const g of list) { if (g.attributes.uv === undefined) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = shadows; mesh.receiveShadow = shadows;
      group.add(mesh); out.push(mesh);
    }
    this.buckets.clear();
    return out;
  }
}

/** Tube along a smooth curve through the given points. */
export function tube(points: THREE.Vector3[], radius: number, segs = 24, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}
