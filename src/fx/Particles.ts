import * as THREE from 'three';

interface P {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  gravity: number;
  drag: number;
}

/**
 * Pooled instanced particles. Two pools: lit (dust, mud, water, rock chips) and
 * unlit/bright (nitro flame, sparks, respawn poof). Particles fade by shrinking.
 */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(capacity: number, material: THREE.Material, geometry: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.5, 0)) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    for (let i = 0; i < capacity; i++) {
      this.ps.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, grow: 0, gravity: 0, drag: 0 });
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.c.setRGB(1, 1, 1));
    }
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, opts?: { grow?: number; gravity?: number; drag?: number }): void {
    const i = this.next;
    this.next = (this.next + 1) % this.ps.length;
    const p = this.ps[i];
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.grow = opts?.grow ?? 1;
    p.gravity = opts?.gravity ?? 0;
    p.drag = opts?.drag ?? 1.5;
    this.mesh.setColorAt(i, this.c.setHex(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const sz = p.size * (1 + (1 - t) * p.grow) * Math.min(1, t * 3);
      this.mesh.setMatrixAt(i, this.m.compose(this.p.set(p.x, p.y, p.z), this.q, this.s.set(sz, sz, sz)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (let i = 0; i < this.ps.length; i++) {
      this.ps[i].alive = false;
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Particles {
  readonly group = new THREE.Group();
  readonly lit: ParticlePool;
  readonly bright: ParticlePool;

  constructor() {
    this.lit = new ParticlePool(900, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    this.bright = new ParticlePool(500, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.group.add(this.lit.mesh, this.bright.mesh);
  }

  update(dt: number): void {
    this.lit.update(dt);
    this.bright.update(dt);
  }

  clear(): void {
    this.lit.clear();
    this.bright.clear();
  }

  burst(x: number, y: number, z: number, count: number, speed: number, color: number, size = 0.6, bright = false, life = 0.7): void {
    const pool = bright ? this.bright : this.lit;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 0.8 + 0.2;
      pool.emit(x, y, z, Math.cos(a) * speed * u, speed * (0.4 + Math.random() * 0.8), Math.sin(a) * speed * u, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, { gravity: 9, drag: 1.2, grow: 0.8 });
    }
  }
}
