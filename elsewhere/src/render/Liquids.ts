import * as THREE from 'three';
import { BRIDGE, CHANNELS, FLOOR1_Y, LIFT } from '../config/p2Slice';
import type { Game } from '../sim/Game';
import type { V2 } from '../sim/vec';
import { liquidMaterial, Materials, PALETTE } from './Materials';
import type { Built } from './Environment';

/** Flat ribbon along a polyline; uv.x runs 0..1 along the length, uv.y across. */
function ribbon(points: V2[], width: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []; const lens: number[] = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const total = lens[lens.length - 1];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; const nx = -dz / l, nz = dx / l;
    const p = points[i];
    pos.push(p.x + nx * width / 2, y, p.z + nz * width / 2, p.x - nx * width / 2, y, p.z - nz * width / 2);
    uv.push(lens[i] / total, 0, lens[i] / total, 1);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export const conduitCurve = (): THREE.CatmullRomCurve3 => {
  const [, a, b, c, d] = CHANNELS.bridgeRoute;
  return new THREE.CatmullRomCurve3([new THREE.Vector3(a.x, 0.05, a.z), new THREE.Vector3(b.x, -0.3, b.z), new THREE.Vector3(c.x, -0.3, c.z), new THREE.Vector3(d.x, 0.1, d.z)]);
};

/**
 * Every puzzle-relevant liquid surface is its own mesh with its own fill uniform, driven directly
 * from the deterministic sim state each frame.
 */
export class Liquids {
  readonly group = new THREE.Group();
  readonly decor: THREE.Object3D[] = [];
  private feed: THREE.ShaderMaterial; private spill: THREE.ShaderMaterial; private branch: THREE.ShaderMaterial; private conduit: THREE.ShaderMaterial;
  private receiverPool: THREE.Mesh; private receiverMat: THREE.ShaderMaterial;
  private spillFall: THREE.Mesh; private spillFallMat: THREE.ShaderMaterial; private cisternPool: THREE.Mesh;
  private bridge: THREE.ShaderMaterial; private bridgeSlab: THREE.Mesh;
  private column: THREE.ShaderMaterial; private core: THREE.ShaderMaterial; private mist: THREE.ShaderMaterial;
  private columnMesh: THREE.Mesh; private coreMesh: THREE.Mesh;
  private particles: THREE.Points; private pPos: Float32Array; private pSeed: Float32Array;
  private halos: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; read: (g: Game) => number }[] = [];
  private lights: { light: THREE.PointLight; max: number; read: (g: Game) => number }[] = [];
  private scentGroup = new THREE.Group(); private scentMeshes: THREE.Mesh[] = []; private scentT = 0;
  private time = 0;

  constructor(mats: Materials, built: Built) {
    const G = this.group;
    const mk = (pts: V2[], width: number, y: number, color: THREE.Color): THREE.ShaderMaterial => { const m = liquidMaterial(color); const mesh = new THREE.Mesh(ribbon(pts, width, y), m); mesh.renderOrder = 2; G.add(mesh); return m; };
    this.feed = mk([CHANNELS.seep, ...CHANNELS.feed, CHANNELS.junction], 0.62, 0.09, PALETTE.cyan);
    this.spill = mk([CHANNELS.junction, ...CHANNELS.spill], 0.62, 0.09, PALETTE.cyan);
    this.branch = mk([CHANNELS.junction, ...CHANNELS.bridgeRoute.slice(0, 2)], 0.62, 0.09, PALETTE.cyan);
    // glass conduit + liquid inside
    const curve = conduitCurve();
    const glass = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.19, 8, false), new THREE.MeshToonMaterial({ color: '#d8f0f2', transparent: true, opacity: 0.32, depthWrite: false, gradientMap: mats.gradient }));
    glass.renderOrder = 3; G.add(glass);
    this.conduit = liquidMaterial(PALETTE.cyan, { opacity: 0.95 }); const cl = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.11, 7, false), this.conduit); cl.renderOrder = 2; G.add(cl);
    // receiver pool rises inside the basin
    this.receiverMat = liquidMaterial(PALETTE.cyan, { axis: 'u', flow: 0.4 }); this.receiverMat.uniforms.uFill.value = 1;
    this.receiverPool = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), this.receiverMat); this.receiverPool.rotation.x = -Math.PI / 2; this.receiverPool.position.set(CHANNELS.receiver.x, 0.12, CHANNELS.receiver.z); this.receiverPool.renderOrder = 2; G.add(this.receiverPool);
    // cistern pool and the spill over the south edge
    this.cisternPool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), liquidMaterial(PALETTE.cyan, { flow: 0.3 })); this.cisternPool.rotation.x = -Math.PI / 2; this.cisternPool.scale.set(1.3, 0.85, 1); this.cisternPool.position.set(-8, 0.62, 6.1); this.cisternPool.renderOrder = 2; G.add(this.cisternPool);
    (this.cisternPool.material as THREE.ShaderMaterial).uniforms.uFill.value = 1;
    this.spillFallMat = liquidMaterial(PALETTE.cyan, { axis: 'v', flow: -1.6, opacity: 0.8 }); this.spillFallMat.uniforms.uFill.value = 1;
    this.spillFall = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5), this.spillFallMat); this.spillFall.position.set(-8, -1.6, 7.75); this.spillFall.renderOrder = 2; G.add(this.spillFall);
    // E02 bridge: flowing construct + a translucent solidified slab that fades in
    this.bridge = liquidMaterial(PALETTE.cyan, { opacity: 0.9 });
    const bz = BRIDGE.z; const bm = new THREE.Mesh(ribbon([{ x: BRIDGE.rect.x1, z: bz }, { x: BRIDGE.rect.x0, z: bz }], BRIDGE.width, 0.04), this.bridge); bm.renderOrder = 2; G.add(bm);
    this.bridgeSlab = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.rect.x1 - BRIDGE.rect.x0, 0.3, BRIDGE.width), new THREE.MeshToonMaterial({ color: '#9ff6ff', transparent: true, opacity: 0, gradientMap: mats.gradient }));
    this.bridgeSlab.position.set(0, -0.17, bz); this.bridgeSlab.receiveShadow = true; G.add(this.bridgeSlab);
    // V02: a vertical RING of magenta liquid rises around the float (between the float's rim and the
    // carved roots). Always flowing — thin and dim when weak, wide and bright when strong — with a
    // brighter surge band that travels with the float while it is being carried.
    const H = FLOOR1_Y + 3.4;
    this.column = liquidMaterial(PALETTE.magenta, { axis: 'v', flow: 1.6, opacity: 0.5 }); this.column.uniforms.uFill.value = 1;
    this.columnMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, H, 36, 1, true), this.column); this.columnMesh.position.set(LIFT.centre.x, -1.4 + H / 2, LIFT.centre.z); this.columnMesh.renderOrder = 2; G.add(this.columnMesh);
    this.core = liquidMaterial(PALETTE.magenta, { axis: 'v', flow: 2.6, opacity: 0.85 }); this.core.uniforms.uFill.value = 1;
    this.coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.74, 1.7, 36, 1, true), this.core); this.coreMesh.position.copy(this.columnMesh.position); this.coreMesh.renderOrder = 3; G.add(this.coreMesh);
    this.mist = liquidMaterial(PALETTE.magenta, { axis: 'v', flow: 0.5, opacity: 0.12 }); this.mist.uniforms.uFill.value = 1;
    const mist = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, H + 1.5, 24, 1, true), this.mist); mist.position.copy(this.columnMesh.position); mist.renderOrder = 1; G.add(mist); this.decor.push(mist);
    // rising droplet particles in the column
    const N = 140; this.pPos = new Float32Array(N * 3); this.pSeed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { this.pSeed[i * 2] = Math.random(); this.pSeed[i * 2 + 1] = Math.random(); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ map: mats.glowTex, color: '#ffb6ef', size: 9, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    this.particles.renderOrder = 4; G.add(this.particles); this.decor.push(this.particles);
    // halos (additive) and lights
    const halo = (x: number, y: number, z: number, sx: number, sz: number, color: THREE.Color, read: (g: Game) => number, vertical = false): void => {
      const mat = new THREE.MeshBasicMaterial({ map: mats.glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); if (!vertical) mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.scale.set(sx, sz, 1); mesh.renderOrder = 1; G.add(mesh); this.halos.push({ mesh, mat, read }); this.decor.push(mesh);
    };
    halo(CHANNELS.receiver.x, 0.3, CHANNELS.receiver.z, 4, 4, PALETTE.cyan, (g) => g.cyan.receiver * 0.55);
    halo(0, 0.06, BRIDGE.z, 9, 4.5, PALETTE.cyan, (g) => g.cyan.bridgeForm * 0.45);
    halo(-8, 0.06, 2.8, 2.6, 6.5, PALETTE.cyan, (g) => (g.cyan.seepOpen ? g.cyan.spill * 0.3 : 0.1));
    halo(-8, 0.06, -3.2, 2.6, 4.5, PALETTE.cyan, (g) => (g.cyan.seepOpen ? g.cyan.feed * 0.3 : 0.1));
    halo(LIFT.centre.x, 0.08, LIFT.centre.z, 7, 7, PALETTE.magenta, (g) => 0.25 + g.lift.intensity * 0.35);
    halo(LIFT.centre.x, FLOOR1_Y + 0.08, LIFT.centre.z, 6, 6, PALETTE.magenta, (g) => 0.2 + g.lift.intensity * 0.3);
    const light = (x: number, y: number, z: number, color: THREE.Color, max: number, range: number, read: (g: Game) => number): void => { const l = new THREE.PointLight(color, 0, range, 2); l.position.set(x, y, z); G.add(l); this.lights.push({ light: l, max, read }); };
    light(CHANNELS.receiver.x, 1.2, CHANNELS.receiver.z, PALETTE.cyan, 14, 8, (g) => Math.max(g.cyan.receiver, g.cyan.bridgeForm));
    light(LIFT.centre.x, 1.5, LIFT.centre.z, PALETTE.magenta, 20, 10, (g) => g.lift.intensity);
    light(LIFT.centre.x, FLOOR1_Y + 1.5, LIFT.centre.z, PALETTE.magenta, 16, 9, (g) => g.lift.intensity);
    // scent trail discs
    const sm = new THREE.MeshBasicMaterial({ map: mats.glowTex, color: '#bffcff', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), sm.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; this.scentGroup.add(m); this.scentMeshes.push(m); }
    G.add(this.scentGroup); this.decor.push(this.scentGroup);
    void built;
  }

  update(game: Game, dt: number): void {
    this.time += dt;
    const t = this.time;
    const set = (m: THREE.ShaderMaterial, fill: number, intensity = 1): void => { m.uniforms.uTime.value = t; m.uniforms.uFill.value = fill; m.uniforms.uIntensity.value = intensity; };
    const c = game.cyan;
    // Before the reeds are scraped a thin trickle still seeps through and drains into the broken cistern
    // (the 'dry crossing / visible cyan' opening state); the real flow only comes once the seep is open.
    const trickle = !c.seepOpen;
    const widen = (m: THREE.ShaderMaterial, v: number): void => { m.uniforms.uWidth.value += (v - m.uniforms.uWidth.value) * Math.min(1, dt * 2.5); };
    widen(this.feed, trickle ? 0.28 : 1); widen(this.spill, trickle ? 0.28 : 1);
    set(this.feed, trickle ? 1 : c.feed, trickle ? 0.8 : 1); set(this.spill, trickle ? 1 : c.spill, trickle ? 0.8 : 1); set(this.branch, c.branch); set(this.conduit, c.conduit);
    set(this.receiverMat, 1, 0.6 + c.receiver * 0.6); this.receiverPool.visible = c.receiver > 0.02; this.receiverPool.position.y = 0.08 + c.receiver * 0.42; this.receiverPool.scale.setScalar(0.4 + c.receiver * 0.6);
    const cp = this.cisternPool.material as THREE.ShaderMaterial; set(cp, 1, c.seepOpen ? 0.5 + c.spill * 0.5 : 0.35); this.cisternPool.visible = c.spill > 0.95 || !c.seepOpen;
    set(this.spillFallMat, 1, c.seepOpen ? 1 : 0.4); this.spillFall.visible = c.spill > 0.98 || !c.seepOpen; this.spillFall.scale.x = c.seepOpen ? 1 : 0.45;
    set(this.bridge, c.bridgeForm, c.bridgeSolid ? 0.85 : 1.1);
    const slab = this.bridgeSlab.material as THREE.MeshToonMaterial; slab.opacity = Math.max(0, (c.bridgeForm - 0.75) / 0.25) * 0.55; this.bridgeSlab.visible = slab.opacity > 0.01;
    // magenta ring: width/brightness by pressure tier; surge band follows the float while carrying
    const L = game.lift; const floatY = L.level * FLOOR1_Y;
    const strong = L.strength === 'strong';
    set(this.column, 1, (strong ? 1.0 : 0.55) * (L.busy ? 1.3 : 1)); this.column.uniforms.uOpacity.value = strong ? 0.5 : 0.3;
    this.column.uniforms.uFlow.value = strong ? 2.6 : 1.2;
    this.coreMesh.position.y = floatY + 0.2; this.coreMesh.visible = L.busy || L.level > 0.01; set(this.core, 1, L.busy ? 1.6 : 0.9); this.core.uniforms.uOpacity.value = L.busy ? 0.85 : 0.35;
    set(this.mist, 1, 0.3 + L.intensity * 0.5);
    // particles: droplets rising in the ring, faster and denser with pressure
    const N = this.pPos.length / 3; const speed = (strong ? 3.6 : 1.4) * (L.busy ? 1.5 : 1); const H = FLOOR1_Y + 3.4;
    for (let i = 0; i < N; i++) {
      const s0 = this.pSeed[i * 2], s1 = this.pSeed[i * 2 + 1];
      const y = ((t * speed * (0.6 + s1 * 0.8) + s0 * 40) % H) - 1.4;
      const a = s0 * 6.283 + t * 0.4 * (s1 - 0.5); const rad = 1.62 + s1 * 0.3;
      this.pPos[i * 3] = LIFT.centre.x + Math.cos(a) * rad; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = LIFT.centre.z + Math.sin(a) * rad;
    }
    (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).size = strong ? 9 : 5; (this.particles.material as THREE.PointsMaterial).opacity = strong ? 0.9 : 0.55;
    for (const h of this.halos) h.mat.opacity = h.read(game) * (0.9 + 0.1 * Math.sin(t * 5));
    for (const l of this.lights) l.light.intensity = l.read(game) * l.max;
    // scent trail reveal
    if (game.scentTrail.length) {
      this.scentT += dt;
      for (let i = 0; i < this.scentMeshes.length; i++) {
        const m = this.scentMeshes[i]; const p = game.scentTrail[i];
        if (!p) { m.visible = false; continue; }
        const appear = this.scentT - i * 0.12; m.visible = appear > 0; m.position.set(p.x, 0.03, p.z);
        const life = game.scentUntil - game.time; (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, appear * 3)) * Math.min(1, life / 2) * (0.55 + 0.25 * Math.sin(t * 6 + i));
        m.scale.setScalar(0.8 + 0.2 * Math.sin(t * 4 + i * 0.7));
      }
    } else { this.scentT = 0; for (const m of this.scentMeshes) m.visible = false; }
  }
}
