import * as THREE from 'three';
import { ATTENDANT, BRIDGE, CHANNELS, FLOOR1_Y, INTERACTABLES, LIFT, OBSTACLES, PLATFORMS, type FloorId, type Rect } from '../config/p2Slice';
import { boxGeom, Merger, placed, rng, roughen, tube } from './geom';
import { Materials, PALETTE, skyMaterial } from './Materials';
import { CAM_DIR, CAM_RIGHT, CAM_UP } from './cameraConst';

export interface Props {
  cvVane: THREE.Group;          // CV-01 vane (rotates between spill/bridge)
  reedPlug: THREE.Group;        // reed clump blocking the seep
  mrWheel: THREE.Group;         // MR-01 wheel
  bands0: THREE.Mesh[]; bands1: THREE.Mesh[]; // load indicator bands (floor 0 and 1)
  slats: THREE.Group;           // E02 safety slats (rise when latched)
  float: THREE.Group;           // lift float disc
  attendantArm: THREE.Group;
  attendant: THREE.Group;
  droplets: THREE.Mesh[];
  lanternLights: THREE.PointLight[];
}

export interface Built {
  floor0: THREE.Group; floor1: THREE.Group; shaft: THREE.Group; distant: THREE.Group; sky: THREE.Mesh;
  decor: THREE.Object3D[];       // hidden in the plain-geometry dev view
  ground: Record<FloorId, THREE.Mesh>; // invisible pick planes
  pickers: { id: string; floor: FloorId; mesh: THREE.Mesh }[];
  props: Props;
}

const Y1 = FLOOR1_Y;

export function buildEnvironment(mats: Materials): Built {
  const floor0 = new THREE.Group(), floor1 = new THREE.Group(), shaft = new THREE.Group(), distant = new THREE.Group();
  floor0.name = 'floor0'; floor1.name = 'floor1'; shaft.name = 'shaft'; distant.name = 'distant';
  const decor: THREE.Object3D[] = [];
  const r = rng(101);
  const m0 = new Merger(), m1 = new Merger(), ms = new Merger();
  const mergerOf = (f: FloorId): Merger => (f === 0 ? m0 : m1);
  const yOf = (f: FloorId): number => (f === 0 ? 0 : Y1);

  // ---------------------------------------------------------------- platforms
  for (const p of PLATFORMS) {
    const M = mergerOf(p.floor), y = yOf(p.floor), R = p.rect;
    const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const skirt = 0.6;
    M.add(mats.paving, placed(boxGeom(w + skirt * 2, 0.25, d + skirt * 2, 3.9), cx, y - 0.125, cz));
    M.add(mats.basalt, placed(boxGeom(w + skirt * 2 + 0.2, 2.2, d + skirt * 2 + 0.2, 2.4), cx, y - 1.35, cz));
    // rocky underside: hanging basalt masses
    for (let i = 0; i < 14; i++) {
      const bw = 1.5 + r() * 3, bd = 1.5 + r() * 3, bh = 1 + r() * 3.5;
      const bx = R.x0 + r() * w, bz = R.z0 + r() * d;
      M.add(mats.basaltDark, placed(roughen(boxGeom(bw, bh, bd, 2.4), 0.08, 2, i), bx, y - 2.3 - bh / 2 + 0.3, bz, r() * 0.4));
    }
    // parapet blocks along outer edges (outside the walkable rect), leaving openings
    const openings: Rect[] = [BRIDGE.rect, { x0: 13.2, z0: 4.2, x1: 15.8, z1: 7.3 }, { x0: 2.5, z0: -3.5, x1: 3.5, z1: -0.5 }];
    if (p.floor === 1) openings.push({ x0: 16.8, z0: -6.8, x1: 18.0, z1: -3 }, { x0: 2.5, z0: -5, x1: 3.5, z1: -2 });
    const edgeBlocks = (ax: number, az: number, bx: number, bz: number): void => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (openings.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1)) continue;
        if (r() < 0.12) continue; // gaps for a crenellated silhouette
        const h = 0.35 + r() * 0.5;
        M.add(mats.basalt, placed(roughen(boxGeom(0.9, h, 0.5, 2.0), 0.03, 4, i), x, y + h / 2 - 0.05, z, Math.atan2(bx - ax, bz - az) + Math.PI / 2));
      }
    };
    const o = skirt - 0.25;
    edgeBlocks(R.x0 - o, R.z0 - o, R.x1 + o, R.z0 - o); edgeBlocks(R.x1 + o, R.z0 - o, R.x1 + o, R.z1 + o);
    edgeBlocks(R.x1 + o, R.z1 + o, R.x0 - o, R.z1 + o); edgeBlocks(R.x0 - o, R.z1 + o, R.x0 - o, R.z0 - o);
  }

  // ---------------------------------------------------------------- walls from obstacle rects
  const blockWall = (f: FloorId, R: Rect, baseH: number, vary: number, mat = mats.basalt): void => {
    const M = mergerOf(f), y = yOf(f);
    const w = R.x1 - R.x0, d = R.z1 - R.z0; const alongX = w >= d; const len = alongX ? w : d; const thick = alongX ? d : w;
    const n = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const x = alongX ? R.x0 + w * t : (R.x0 + R.x1) / 2; const z = alongX ? (R.z0 + R.z1) / 2 : R.z0 + d * t;
      const h = baseH + (r() - 0.5) * vary; const bw = alongX ? len / n + 0.02 : thick; const bd = alongX ? thick : len / n + 0.02;
      M.add(mat, placed(roughen(boxGeom(bw, h, bd, 2.2), 0.025, 5, i + 7), x, y + h / 2, z));
      if (r() > 0.6) M.add(mat, placed(boxGeom(bw * 0.5, 0.35, bd * 0.8, 2), x + (r() - 0.5) * bw * 0.4, y + h + 0.17, z));
    }
  };
  const archOver = (f: FloorId, x: number, zA: number, zB: number, height: number, thick: number, mat: THREE.Material): void => {
    // Arch in the (z,y) plane extruded along x, spanning zA..zB with a semicircular top.
    const span = zB - zA; const s = new THREE.Shape();
    const legH = height - span / 2;
    s.moveTo(zA - 0.6, 0); s.lineTo(zB + 0.6, 0); s.lineTo(zB + 0.6, height + 0.7); s.lineTo(zA - 0.6, height + 0.7); s.closePath();
    const hole = new THREE.Path(); hole.moveTo(zA, 0); hole.lineTo(zA, legH); hole.absarc(zA + span / 2, legH, span / 2, Math.PI, 0, true); hole.lineTo(zB, 0); hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    // Shape x -> world z, shape y -> world y, extrusion -> world x
    g.rotateY(-Math.PI / 2); g.translate(x + thick / 2, yOf(f), 0);
    const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2);
    mergerOf(f).add(mat, g);
  };
  const rootsAround = (M: Merger, x: number, y: number, z: number, radius: number, height: number, count: number, seed: number): void => {
    const rr = rng(seed);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rr() * 0.4; const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 4; k++) { const t = k / 4; const ra = radius + Math.sin(t * 6 + i) * 0.25; pts.push(new THREE.Vector3(x + Math.cos(a + t * 0.6) * ra, y - 0.5 + t * height, z + Math.sin(a + t * 0.6) * ra)); }
      M.add(mats.root, tube(pts, 0.16 + rr() * 0.12, 16, 6));
    }
  };

  for (const o of OBSTACLES) {
    const f = o.floor, y = yOf(f), M = mergerOf(f);
    const id = o.id.split('.').pop()!;
    if (!o.rect && !o.circle) continue;
    if (/^wallN\.(w|e)$/.test(id) || id === 'wallW') blockWall(f, o.rect!, id === 'wallW' ? 2.0 : 2.6, 0.9);
    else if (id === 'seep') {
      // sluice wall section with a rounded seep opening low down, cyan-stained
      const R = o.rect!; const cx = (R.x0 + R.x1) / 2;
      M.add(mats.basalt, placed(boxGeom(R.x1 - R.x0, 1.2, 1.1, 2.2), cx, y + 2.2, R.z0 + 0.55));
      M.add(mats.basalt, placed(boxGeom(0.5, 1.7, 1.1, 2.2), R.x0 + 0.25, y + 0.85, R.z0 + 0.55));
      M.add(mats.basalt, placed(boxGeom(0.5, 1.7, 1.1, 2.2), R.x1 - 0.25, y + 0.85, R.z0 + 0.55));
      M.add(mats.porcelain, placed(new THREE.TorusGeometry(0.7, 0.12, 6, 18, Math.PI), cx, y + 1.0, R.z0 + 1.1, 0, 1, 1, 1, 0, 0));
      M.add(mats.porcelain, placed(boxGeom(1.9, 0.18, 0.9, 1), cx, y + 0.08, R.z0 + 1.2));
    } else if (id === 'p1' || id === 'p2') {
      if (id === 'p1') { archOver(f, -5.9, 1.0, 5.4, 3.4, 0.8, mats.basalt); rootsAround(M, -5.5, y, 1.4, 0.55, 3.2, 3, 3); rootsAround(M, -5.5, y, 5.0, 0.55, 3.2, 3, 4); }
    } else if (id === 'CV-01') { /* dynamic, below */ }
    else if (id === 'cistern') {
      const R = o.rect!; const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      // broken porcelain cistern: a wide basin with a copper rim, one shattered corner and a dark crack
      M.add(mats.porcelain, placed(new THREE.LatheGeometry([new THREE.Vector2(0.3, 0), new THREE.Vector2(1.25, 0.08), new THREE.Vector2(1.45, 0.95), new THREE.Vector2(1.3, 1.0), new THREE.Vector2(1.1, 0.35)], 16), cx, y, cz, 0, 1.05, 1, 0.72));
      M.add(mats.copper, placed(new THREE.TorusGeometry(1.42, 0.06, 6, 24), cx, y + 0.97, cz, 0, 1.05, 1, 0.72, Math.PI / 2, 0));
      M.add(mats.dark, placed(boxGeom(0.05, 0.9, 0.35, 1), cx + 1.2, y + 0.45, cz - 0.4, 0.5));
      for (let i = 0; i < 4; i++) M.add(mats.porcelain, placed(boxGeom(0.3, 0.12, 0.25, 1), cx + 0.9 + r() * 0.9, y + 0.06, cz + 0.6 + r() * 0.6, r() * 3));
      M.add(mats.basaltDark, placed(boxGeom(0.7, 0.5, 0.7, 1), cx + 1.3, y + 0.2, cz + 0.5, 0.4));
    } else if (id === 'bowls') {
      const c = o.circle!; for (let i = 0; i < 3; i++) { const bx = c.x + Math.cos(i * 2.1) * 0.45, bz = c.z + Math.sin(i * 2.1) * 0.45; M.add(mats.porcelain, placed(new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.3, 0.05), new THREE.Vector2(0.38, 0.28), new THREE.Vector2(0.33, 0.3), new THREE.Vector2(0.25, 0.14)], 12), bx, y, bz)); }
    } else if (id === 'receiver') {
      const c = o.circle!;
      M.add(mats.porcelain, placed(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.75, 0.05), new THREE.Vector2(0.95, 0.55), new THREE.Vector2(0.9, 0.6), new THREE.Vector2(0.7, 0.25)], 16), c.x, y, c.z));
      M.add(mats.copper, placed(new THREE.TorusGeometry(0.92, 0.06, 6, 20), c.x, y + 0.58, c.z, 0, 1, 1, 1, Math.PI / 2, 0));
      // receiver spout toward the bridge
      M.add(mats.copper, placed(boxGeom(0.4, 0.2, 1.6, 1), c.x - 0.2, y + 0.1, c.z + 1.5));
    } else if (/^ring[NSE]$/.test(id)) {
      blockWall(f, o.rect!, 1.0, 0.5, mats.basaltDark);
    } else if (id === 'shelterS' || id === 'shelterE') {
      blockWall(f, o.rect!, 1.5, 0.6);
    } else if (id === 'gateE03') {
      const R = o.rect!; const cx = (R.x0 + R.x1) / 2;
      M.add(mats.copper, placed(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), R.x0 + 0.2, y + 0.65, R.z0 + 0.3));
      M.add(mats.copper, placed(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), R.x1 - 0.2, y + 0.65, R.z0 + 0.3));
      M.add(mats.porcelain, placed(boxGeom(R.x1 - R.x0 - 0.4, 0.08, 0.08, 1), cx, y + 1.1, R.z0 + 0.3));
      M.add(mats.porcelain, placed(boxGeom(0.9, 0.5, 0.06, 1), cx, y + 0.75, R.z0 + 0.32));
      M.add(mats.basaltDark, placed(boxGeom(R.x1 - R.x0, 0.3, R.z1 - R.z0 - 0.3, 2), cx, y + 0.1, (R.z0 + R.z1) / 2 + 0.15));
    } else if (id === 'indicator') { /* dynamic, below */ }
    else if (id === 'MR-01') { /* dynamic, below */ }
    else if (id === 'bench') {
      const R = o.rect!; const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      M.add(mats.basaltDark, placed(boxGeom(R.x1 - R.x0, 0.8, R.z1 - R.z0, 2), cx, y + 0.4, cz));
      M.add(mats.porcelain, placed(boxGeom(R.x1 - R.x0 + 0.1, 0.08, R.z1 - R.z0 + 0.1, 2), cx, y + 0.84, cz));
      // tools: wrenches, gauge bowl, a dark slate
      M.add(mats.copper, placed(boxGeom(0.5, 0.06, 0.12, 1), cx - 0.6, y + 0.91, cz + 0.1, 0.4));
      M.add(mats.copper, placed(boxGeom(0.45, 0.06, 0.1, 1), cx - 0.3, y + 0.91, cz - 0.2, -0.6));
      M.add(mats.copper, placed(new THREE.CylinderGeometry(0.16, 0.12, 0.2, 8), cx + 0.5, y + 0.98, cz));
      M.add(mats.dark, placed(boxGeom(0.42, 0.03, 0.32, 1), cx + 0.1, y + 0.9, cz + 0.15, 0.2));
    } else if (id === 'houses') {
      const R = o.rect!;
      for (let i = 0; i < 6; i++) {
        const hx = R.x0 + 1.2 + i * 2.35, hw = 1.8 + r() * 0.5, hh = 2.2 + r() * 1.6; const hz = R.z0 + 0.9;
        M.add(mats.porcelainWarm, placed(boxGeom(hw, hh, 1.5, 2), hx, y + hh / 2, hz));
        if (r() > 0.4) M.add(mats.porcelainWarm, placed(new THREE.SphereGeometry(hw * 0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), hx, y + hh, hz));
        else M.add(mats.copper, placed(new THREE.ConeGeometry(hw * 0.55, 0.9, 6), hx, y + hh + 0.45, hz));
        // glowing arched doorway / window
        M.add(mats.lantern, placed(boxGeom(0.5, 0.9, 0.08, 1), hx, y + 0.5, hz + 0.78));
        M.add(mats.lantern, placed(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 10, 1, false, 0, Math.PI), hx, y + 0.95, hz + 0.78, 0, 1, 1, 1, Math.PI / 2, 0));
        M.add(mats.copper, placed(boxGeom(hw + 0.1, 0.1, 0.2, 1), hx, y + hh * 0.55, hz + 0.75));
      }
      M.add(mats.basalt, placed(boxGeom(R.x1 - R.x0, 0.5, 0.4, 2), (R.x0 + R.x1) / 2, y + 0.25, R.z1 - 0.2));
    } else if (id === 'reeds') {
      const R = o.rect!; const rr = rng(44);
      for (let i = 0; i < 34; i++) {
        const x = R.x0 + 0.3 + rr() * (R.x1 - R.x0 - 0.6), z = R.z0 + 0.3 + rr() * (R.z1 - R.z0 - 0.6), h = 1.0 + rr() * 1.2;
        M.add(mats.glassReed, placed(new THREE.CylinderGeometry(0.03, 0.05, h, 5), x, y + h / 2, z, 0, 1, 1, 1, (rr() - 0.5) * 0.25, (rr() - 0.5) * 0.25));
        M.add(rr() > 0.5 ? mats.plantPink : mats.lantern, placed(new THREE.SphereGeometry(0.07, 6, 5), x, y + h, z));
      }
      M.add(mats.moss, placed(boxGeom(R.x1 - R.x0, 0.2, R.z1 - R.z0, 2), (R.x0 + R.x1) / 2, y + 0.1, (R.z0 + R.z1) / 2));
    } else if (id === 'skiff') {
      const R = o.rect!; const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2 + 0.6;
      M.add(mats.moss, placed(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(1.1, 0.15), new THREE.Vector2(1.35, 0.6), new THREE.Vector2(1.2, 0.65), new THREE.Vector2(1.0, 0.25)], 14), cx, y - 0.4, cz, 0, 1.1, 1, 0.75));
      M.add(mats.copper, placed(new THREE.TorusGeometry(1.3, 0.05, 5, 20), cx, y + 0.25, cz, 0, 1.1, 1, 0.75, Math.PI / 2, 0));
      M.add(mats.copper, placed(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), R.x0 + 0.3, y + 0.8, R.z0 + 0.2));
      M.add(mats.dark, placed(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 4), cx - 0.6, y + 0.6, cz - 0.9, 0, 1, 1, 1, 0.5, 0.3));
    }
  }

  // ---------------------------------------------------------------- 1A unbuilt exits (E11 / E12): rope rails, nothing faked beyond
  const ropeGate = (M: Merger, x: number, y: number, z: number, ry: number): void => {
    for (const s of [-1, 1]) M.add(mats.copper, placed(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), x + Math.cos(ry) * s * 1.1, y + 0.55, z - Math.sin(ry) * s * 1.1));
    M.add(mats.porcelain, placed(boxGeom(2.3, 0.07, 0.07, 1), x, y + 0.95, z, ry));
    M.add(mats.porcelain, placed(boxGeom(0.7, 0.4, 0.05, 1), x, y + 0.65, z, ry));
  };
  ropeGate(m1, 17.4, Y1, -4.9, Math.PI / 2); ropeGate(m1, 3.1, Y1, -3.5, Math.PI / 2);
  ropeGate(m0, 3.1, 0, -2.0, Math.PI / 2); // 0D north-west ledge (no E04 arrival built here)

  // ---------------------------------------------------------------- channels (carved grooves with copper rims)
  const groove = (M: Merger, y: number, pts: { x: number; z: number }[], width = 0.95): void => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const len = Math.hypot(b.x - a.x, b.z - a.z) + width * 0.5; const ang = Math.atan2(b.x - a.x, b.z - a.z);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      M.add(mats.basaltDark, placed(boxGeom(width, 0.12, len, 1), cx, y + 0.02, cz, ang));
      for (const s of [-1, 1]) M.add(mats.copper, placed(boxGeom(0.1, 0.16, len, 1), cx + Math.cos(ang) * s * (width / 2 + 0.05), y + 0.08, cz - Math.sin(ang) * s * (width / 2 + 0.05), ang));
    }
  };
  groove(m0, 0, [CHANNELS.seep, ...CHANNELS.feed, CHANNELS.junction]);
  groove(m0, 0, [CHANNELS.junction, ...CHANNELS.spill]);
  groove(m0, 0, [CHANNELS.junction, ...CHANNELS.bridgeRoute.slice(0, 2)]);
  // conduit across the gap: copper pipe with glass sections, below bridge level
  {
    const a = CHANNELS.bridgeRoute[1], b = CHANNELS.bridgeRoute[2], c = CHANNELS.bridgeRoute[3], d = CHANNELS.bridgeRoute[4];
    const pts = [new THREE.Vector3(a.x, 0.05, a.z), new THREE.Vector3(b.x, -0.3, b.z), new THREE.Vector3(c.x, -0.3, c.z), new THREE.Vector3(d.x, 0.1, d.z)];
    for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.14; const p = new THREE.CatmullRomCurve3(pts).getPoint(t); m0.add(mats.copper, placed(new THREE.TorusGeometry(0.22, 0.05, 6, 12), p.x, p.y, p.z, Math.PI / 2 + 0.15, 1, 1, 1, 0, 0)); }
    // hanging supports into the void
    for (const t of [0.42, 0.7]) { const p = new THREE.CatmullRomCurve3(pts).getPoint(t); m0.add(mats.basaltDark, placed(boxGeom(0.5, 2.2, 0.5, 2), p.x, p.y - 1.3, p.z)); }
  }
  // bridge abutments and E02 rails (copper posts on both landings)
  for (const x of [-3.2, 3.2]) for (const s of [-1, 1]) m0.add(mats.copper, placed(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), x, 0.45, BRIDGE.z + s * (BRIDGE.width / 2 + 0.15)));

  // ---------------------------------------------------------------- lift shaft (V02): carved roots ring from below 0D up through 1A
  rootsAround(ms, LIFT.centre.x, -2.5, LIFT.centre.z, 2.35, Y1 + 5.2, 9, 77);
  for (const yy of [-0.3, 3.2, 6.1, Y1 + 0.9]) ms.add(mats.copper, placed(new THREE.TorusGeometry(2.3, 0.08, 6, 28), LIFT.centre.x, yy, LIFT.centre.z, 0, 1, 1, 1, Math.PI / 2, 0));
  // floor-1 landing ring cutout edge
  ms.add(mats.porcelain, placed(new THREE.TorusGeometry(LIFT.interior.r + 0.15, 0.12, 6, 32), LIFT.centre.x, Y1 + 0.02, LIFT.centre.z, 0, 1, 1, 1, Math.PI / 2, 0));
  ms.add(mats.basaltDark, placed(new THREE.CylinderGeometry(2.0, 2.6, 1.2, 18), LIFT.centre.x, -1.6, LIFT.centre.z));

  // ---------------------------------------------------------------- shelter cushions + lanterns, plants
  const lanternLights: THREE.PointLight[] = [];
  const lantern = (group: THREE.Group, x: number, y: number, z: number): void => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), mats.copper); post.position.y = 0.95; g.add(post);
    const arm = new THREE.Mesh(boxGeom(0.5, 0.05, 0.05, 1), mats.copper); arm.position.set(0.22, 1.85, 0); g.add(arm);
    const lamp = new THREE.Mesh(boxGeom(0.22, 0.3, 0.22, 1), mats.lantern); lamp.position.set(0.42, 1.65, 0); g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 6), mats.copper); cap.position.set(0.42, 1.88, 0); g.add(cap);
    const light = new THREE.PointLight(PALETTE.amber, 6, 7, 2); light.position.set(0.42, 1.6, 0); g.add(light); lanternLights.push(light);
    group.add(g); decor.push(lamp);
  };
  lantern(floor0, -15.2, 0, -4.9); lantern(floor0, 7.9, 0, 6.2); lantern(floor1, 4.2, Y1, -2.0); lantern(floor1, 16.3, Y1, 3.8);
  for (const [x, z] of [[5.2, 5.6], [6.6, 6.0], [7.6, 5.0]]) m0.add(mats.moss, placed(new THREE.SphereGeometry(0.55, 8, 6), x, 0.05, z, 0, 1, 0.45, 1));
  const plant = (M: Merger, x: number, y: number, z: number, kind: number, seed: number): void => {
    const rr = rng(seed);
    if (kind === 0) { // coral fan
      for (let i = 0; i < 4; i++) M.add(i % 2 ? mats.plantPink : mats.plantViolet, placed(new THREE.ConeGeometry(0.35 + rr() * 0.2, 0.9 + rr() * 0.6, 5), x + (rr() - 0.5) * 0.4, y + 0.45, z + (rr() - 0.5) * 0.4, rr() * 3, 1, 1, 0.3, (rr() - 0.5) * 0.4, (rr() - 0.5) * 0.4));
    } else if (kind === 1) { // glass reeds with glowing tips
      for (let i = 0; i < 5; i++) { const h = 0.9 + rr() * 1.1; const px = x + (rr() - 0.5) * 0.5, pz = z + (rr() - 0.5) * 0.5; M.add(mats.glassReed, placed(new THREE.CylinderGeometry(0.025, 0.045, h, 5), px, y + h / 2, pz, 0, 1, 1, 1, (rr() - 0.5) * 0.3, (rr() - 0.5) * 0.3)); M.add(mats.plantPink, placed(new THREE.SphereGeometry(0.07, 6, 5), px, y + h, pz)); }
    } else { // puff shrub
      for (let i = 0; i < 5; i++) M.add(rr() > 0.4 ? mats.plantPink : mats.plantViolet, placed(roughen(new THREE.SphereGeometry(0.28 + rr() * 0.2, 8, 6), 0.05, 3, seed + i), x + (rr() - 0.5) * 0.7, y + 0.2 + rr() * 0.3, z + (rr() - 0.5) * 0.7));
    }
  };
  plant(m0, -16.6, 0, 5.8, 0, 1); plant(m0, -3.6, 0, 6.3, 1, 2); plant(m0, -12.4, 0, -6.1, 2, 3); plant(m0, 14.6, 0, -6.2, 0, 4); plant(m0, 4.0, 0, 6.3, 1, 5); plant(m0, -16.8, 0, -1.5, 1, 6);
  plant(m1, 3.6, Y1, 4.3, 0, 7); plant(m1, 16.9, Y1, -5.6, 2, 8); plant(m1, 9.4, Y1, 4.6, 1, 9);

  // ---------------------------------------------------------------- contact shadows at wall bases (merged decals)
  for (const o of OBSTACLES) {
    const M = mergerOf(o.floor), y = yOf(o.floor);
    if (o.rect) { const R = o.rect; const g = new THREE.PlaneGeometry(R.x1 - R.x0 + 1.0, R.z1 - R.z0 + 1.0); g.rotateX(-Math.PI / 2); M.add(mats.contact, placed(g, (R.x0 + R.x1) / 2, y + 0.012, (R.z0 + R.z1) / 2)); }
  }

  // ---------------------------------------------------------------- dynamic props
  const props = buildProps(mats, floor0, floor1, shaft, decor);
  props.lanternLights = lanternLights;

  // ---------------------------------------------------------------- merge
  for (const mesh of m0.build(floor0)) mesh.name = 'floor0.static';
  for (const mesh of m1.build(floor1)) mesh.name = 'floor1.static';
  for (const mesh of ms.build(shaft)) mesh.name = 'shaft.static';

  // ---------------------------------------------------------------- distant islands and sky
  // Placed in SCREEN space (right/up/depth from the scene centre) so they frame the playable
  // area in the fixed orthographic view: below it in the void and along the top edge, never on top of it.
  const md = new Merger(); const rd = rng(909); const centre = new THREE.Vector3(-1, 1, 0);
  const screenPlace = (sx: number, sy: number, depth: number): THREE.Vector3 => centre.clone().addScaledVector(CAM_RIGHT, sx).addScaledVector(CAM_UP, sy).addScaledVector(CAM_DIR, -depth);
  const islandSpots: [number, number, number][] = [[-24, -15, 34], [-8, -22, 48], [9, -18, 40], [26, -13, 52], [-34, -4, 70], [34, -2, 76], [-16, 17, 84], [6, 19, 80], [24, 16, 90], [-2, -30, 36], [38, -8, 64], [-30, 10, 96], [16, -27, 44]];
  for (let i = 0; i < islandSpots.length; i++) {
    const [sx, sy, depth] = islandSpots[i]; const p = screenPlace(sx + (rd() - 0.5) * 4, sy + (rd() - 0.5) * 3, depth);
    const far = depth / 96; const w = (3 + rd() * 5) * (1.2 - far * 0.5), h = (2.5 + rd() * 5) * (1.2 - far * 0.5);
    md.add(mats.distant, placed(roughen(boxGeom(w, h, w * 0.8, 4), 0.4, 1.5, i), p.x, p.y, p.z, rd()));
    md.add(mats.distant, placed(roughen(boxGeom(w * 0.55, h * 1.1, w * 0.5, 4), 0.35, 1.5, i + 20), p.x + w * 0.35, p.y - h * 0.45, p.z + 1, rd()));
    if (rd() > 0.45) md.add(mats.distant, placed(boxGeom(0.8, 3 + rd() * 4, 0.8, 4), p.x - w * 0.3, p.y + h / 2 + 1.5, p.z + 1, 0.3)); // tower silhouette
    if (rd() > 0.5) { // arch silhouette on top
      md.add(mats.distant, placed(boxGeom(0.6, 2, 0.6, 4), p.x + 0.8, p.y + h / 2 + 1, p.z, 0)); md.add(mats.distant, placed(boxGeom(0.6, 2, 0.6, 4), p.x + 2.4, p.y + h / 2 + 1, p.z, 0)); md.add(mats.distant, placed(boxGeom(2.4, 0.5, 0.6, 4), p.x + 1.6, p.y + h / 2 + 2.1, p.z, 0));
    }
  }
  const dMeshes = md.build(distant, false); decor.push(...dMeshes);
  // distant liquid falls from a few islands
  for (let i = 0; i < 4; i++) {
    const [sx, sy, depth] = islandSpots[[0, 3, 5, 8][i]]; const p = screenPlace(sx + 1, sy - 5.5, depth - 1);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 7), new THREE.MeshBasicMaterial({ color: i % 2 ? PALETTE.magenta : PALETTE.cyan, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    fall.position.copy(p); fall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), CAM_DIR); distant.add(fall); decor.push(fall);
  }
  // soft pink cloud banks drifting in the void below and behind
  for (let i = 0; i < 10; i++) {
    const p = screenPlace(-34 + i * 7.5 + (rd() - 0.5) * 6, -14 - rd() * 14, 14 + rd() * 40);
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats.cloud); cloud.position.copy(p); cloud.scale.set(18 + rd() * 14, 6 + rd() * 5, 1);
    cloud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), CAM_DIR); cloud.renderOrder = -1; distant.add(cloud); decor.push(cloud);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 2), skyMaterial()); sky.name = 'sky'; sky.visible = false; // unused: ortho views need a screen-space sky (CSS gradient)

  // ---------------------------------------------------------------- pick proxies
  const ground: Record<FloorId, THREE.Mesh> = { 0: pickPlane(0), 1: pickPlane(1) };
  floor0.add(ground[0]); floor1.add(ground[1]);
  const pickers: Built['pickers'] = [];
  for (const def of Object.values(INTERACTABLES)) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.pickRadius, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    mesh.position.set(def.pos.x, yOf(def.floor) + 0.6, def.pos.z); mesh.name = 'pick:' + def.id;
    (def.floor === 0 ? floor0 : floor1).add(mesh); pickers.push({ id: def.id, floor: def.floor, mesh });
  }
  return { floor0, floor1, shaft, distant, sky, decor, ground, pickers, props };
}

function pickPlane(floor: FloorId): THREE.Mesh {
  const g = new THREE.PlaneGeometry(60, 40); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(0, floor === 0 ? 0 : Y1, 0); m.name = 'ground' + floor; return m;
}

function buildProps(mats: Materials, floor0: THREE.Group, floor1: THREE.Group, shaft: THREE.Group, decor: THREE.Object3D[]): Props {
  // CV-01: big ceramic diverter disc sunk into the junction, with a copper vane that points down the live branch.
  const cv = new THREE.Group(); cv.position.set(CHANNELS.junction.x, 0, CHANNELS.junction.z);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 20), mats.porcelain); disc.position.y = 0.17; cv.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.07, 6, 24), mats.copper); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36; cv.add(rim);
  const cvVane = new THREE.Group(); cvVane.position.y = 0.36; cv.add(cvVane);
  const vane = new THREE.Mesh(boxGeom(0.22, 0.36, 1.5, 1), mats.copper); vane.position.z = 0.35; cvVane.add(vane);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mats.porcelain); knob.position.y = 0.25; cvVane.add(knob);
  const vaneTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), mats.copper); vaneTip.rotation.x = Math.PI / 2; vaneTip.position.z = 1.25; vaneTip.position.y = 0.05; cvVane.add(vaneTip);
  cv.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  floor0.add(cv);

  // Reed plug at the seep + wet mineral droplets on the ground leading to it.
  const reedPlug = new THREE.Group(); reedPlug.position.set(CHANNELS.seep.x, 0, CHANNELS.seep.z + 0.1);
  const rr = rng(5);
  for (let i = 0; i < 16; i++) { const h = 0.6 + rr() * 0.8; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, h, 5), mats.moss); st.position.set((rr() - 0.5) * 1.3, h / 2, (rr() - 0.5) * 0.6); st.rotation.set((rr() - 0.5) * 0.6, 0, (rr() - 0.5) * 0.6); st.castShadow = true; reedPlug.add(st); }
  const wad = new THREE.Mesh(roughen(new THREE.SphereGeometry(0.75, 10, 8), 0.1, 2, 9), mats.moss); wad.scale.set(1.2, 0.6, 0.8); wad.position.y = 0.3; wad.castShadow = true; reedPlug.add(wad);
  floor0.add(reedPlug);
  const droplets: THREE.Mesh[] = [];
  const dropMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 7; i++) { const t = i / 6; const d = new THREE.Mesh(new THREE.CircleGeometry(0.08 + rr() * 0.07, 8), dropMat); d.rotation.x = -Math.PI / 2; d.position.set(-9.6 + 1.3 * t + (rr() - 0.5) * 0.5, 0.015, -1.2 - 3.4 * t + (rr() - 0.5) * 0.4); floor0.add(d); droplets.push(d); decor.push(d); }

  // Load indicator pillars (floor 0 on the ring, floor 1 by the landing): porcelain post, three bands.
  const bandsFor = (group: THREE.Group, x: number, y: number, z: number): THREE.Mesh[] => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.4, 10), mats.porcelain); post.position.set(x, y + 1.2, z); post.castShadow = true; group.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 10), mats.copper); cap.position.set(x, y + 2.55, z); group.add(cap);
    const out: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: '#5a3458' })); b.rotation.x = Math.PI / 2; b.position.set(x, y + 1.0 + i * 0.45, z); group.add(b); out.push(b); }
    return out;
  };
  const bands0 = bandsFor(floor0, 11, 0, -3.5);
  const ind = INTERACTABLES.indicator.pos; const bands1 = bandsFor(floor1, ind.x, Y1, ind.z);

  // MR-01: upper pressure regulator — a large ceramic wheel on a copper riser pipe.
  const mr = new THREE.Group(); const mp = INTERACTABLES['MR-01'].pos; mr.position.set(mp.x, Y1, mp.z);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.3, 10), mats.copper); riser.position.y = 0.65; mr.add(riser);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.2, 8), mats.copper); pipe.rotation.z = Math.PI / 2; pipe.position.set(-1.3, 0.25, 0); mr.add(pipe);
  const mrWheel = new THREE.Group(); mrWheel.position.y = 1.35; mr.add(mrWheel);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 8, 24), mats.porcelain); wheel.rotation.x = Math.PI / 2; mrWheel.add(wheel);
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(boxGeom(0.12, 0.1, 1.45, 1), mats.copper); sp.rotation.y = i * Math.PI / 4; mrWheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), mats.copper); mrWheel.add(hub);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), mats.porcelain); gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 0.9, -0.35); mr.add(gauge);
  mr.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  floor1.add(mr);

  // E02 safety slats: porcelain slats + copper side rails that rise into place when the latch engages.
  const slats = new THREE.Group(); slats.position.set(0, -1.2, BRIDGE.z); slats.visible = false;
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(boxGeom(0.42, 0.12, BRIDGE.width - 0.3, 1), mats.porcelain); s.position.set(-2.9 + i * 0.72, 0, 0); s.castShadow = true; slats.add(s); }
  for (const sg of [-1, 1]) { const rail = new THREE.Mesh(boxGeom(6.6, 0.08, 0.08, 1), mats.copper); rail.position.set(0, 0.5, sg * (BRIDGE.width / 2 - 0.05)); slats.add(rail); for (let i = 0; i < 4; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5), mats.copper); post.position.set(-2.7 + i * 1.8, 0.25, sg * (BRIDGE.width / 2 - 0.05)); slats.add(post); } }
  floor0.add(slats);

  // Lift float: porcelain disc with a copper rim, carried by the magenta column.
  const float = new THREE.Group(); float.position.set(LIFT.centre.x, 0, LIFT.centre.z);
  const fd = new THREE.Mesh(new THREE.CylinderGeometry(LIFT.floatRadius, LIFT.floatRadius - 0.2, 0.28, 24), mats.porcelain); fd.position.y = -0.14; fd.castShadow = true; fd.receiveShadow = true; float.add(fd);
  const fr = new THREE.Mesh(new THREE.TorusGeometry(LIFT.floatRadius - 0.02, 0.07, 6, 28), mats.copper); fr.rotation.x = Math.PI / 2; fr.position.y = 0.0; float.add(fr);
  const fc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.2, 16), mats.copper); fc.position.y = -0.34; float.add(fc);
  shaft.add(float);

  // Lift attendant (non-interactive): small porcelain-hooded inhabitant with a copper apron and a slate.
  const attendant = new THREE.Group(); attendant.position.set(ATTENDANT.pos.x, Y1, ATTENDANT.pos.z); attendant.rotation.y = ATTENDANT.facing;
  const body = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.02, 0.62), new THREE.Vector2(0.14, 0.6), new THREE.Vector2(0.2, 0.45), new THREE.Vector2(0.24, 0.2), new THREE.Vector2(0.22, 0)], 12), mats.porcelain); body.castShadow = true; attendant.add(body);
  const apron = new THREE.Mesh(boxGeom(0.3, 0.3, 0.06, 1), mats.copper); apron.position.set(0, 0.18, 0.2); attendant.add(apron);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), mats.dark); face.position.set(0, 0.48, 0.19); attendant.add(face);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); e.position.set(s * 0.04, 0.5, 0.26); attendant.add(e); }
  const attendantArm = new THREE.Group(); attendantArm.position.set(0.2, 0.4, 0.08); attendant.add(attendantArm);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 3, 6), mats.porcelain); arm.rotation.z = -1.1; arm.position.set(0.08, -0.06, 0.1); attendantArm.add(arm);
  const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), mats.copper); stylus.position.set(0.18, -0.12, 0.2); stylus.rotation.z = -0.5; attendantArm.add(stylus);
  const slate = new THREE.Mesh(boxGeom(0.26, 0.18, 0.02, 1), mats.dark); slate.position.set(-0.08, 0.32, 0.24); slate.rotation.x = -0.5; attendant.add(slate);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 3, 6), mats.porcelain); armL.rotation.z = 0.9; armL.position.set(-0.2, 0.33, 0.12); attendant.add(armL);
  floor1.add(attendant);

  return { cvVane, reedPlug, mrWheel, bands0, bands1, slats, float, attendantArm, attendant, droplets, lanternLights: [] };
}

