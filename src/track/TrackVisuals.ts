import * as THREE from 'three';
import type { BuiltTrack, PlacedDecor } from './TrackBuilder';
import { SURFACES, type SurfaceId } from './SurfaceManager';

/**
 * Greybox — but readable — visuals for a built track.
 * Colour language:
 *   tan dirt road · grey speckled rough rock · dark brown mud · blue water ·
 *   reddish earth banks · olive "fern" off-track ground · orange/yellow jump lip ·
 *   wooden bridge · bone arch marking the shortcut.
 */
export function buildTrackVisuals(built: BuiltTrack): THREE.Group {
  const group = new THREE.Group();
  group.name = 'track';
  group.add(terrainMesh(built));
  group.add(waterMeshes(built));
  group.add(bridgeMesh(built));
  group.add(finishLine(built));
  for (const d of built.decor) {
    const m = decorMesh(d, built);
    if (m) group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------- terrain

function terrainMesh(built: BuiltTrack): THREE.Mesh {
  const { terrain, track } = built;
  const nx = terrain.nx, nz = terrain.nz;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

  // Jump lip highlight ranges on the main path.
  const lips: Array<[number, number]> = [];
  for (const f of track.def.features) {
    if (f.kind !== 'kicker') continue;
    const p = track.paths.get(f.path)!;
    const s0 = p.node(f.at) + (f.offset ?? 0);
    lips.push([s0 - f.length, s0 + (f.lipLength ?? 2)]);
  }

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const x = terrain.minX + ix * terrain.step;
      const z = terrain.minZ + iz * terrain.step;
      const h = terrain.heights[i];
      pos[i * 3] = x;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = z;

      const surf: SurfaceId = track.surfaceAt(x, h, z);
      c.setHex(SURFACES[surf].color);
      const q = track.queryRoad(x, z, 30);
      const n = hash(ix, iz);
      if (surf === 'water') {
        c.setHex(0xb8a27a); // sandy river bed (seen through water)
      } else if (surf === 'rough') {
        c.offsetHSL(0, 0, (n - 0.5) * 0.18);
      } else if (surf === 'grass') {
        // Slope → rock faces; flat → ferny green with variation.
        const dx = terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z);
        const dz = terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1);
        const slope = Math.hypot(dx, dz) / 2;
        tmp.setHex(0x8a7f70);
        c.offsetHSL(0, 0, (n - 0.5) * 0.06);
        c.lerp(tmp, Math.min(1, Math.max(0, (slope - 0.45) * 2)));
      } else {
        c.offsetHSL(0, 0, (n - 0.5) * 0.05);
      }
      if (q && q.path.def.id === 'shortcut' && q.outside <= 0 && surf === 'dirt') {
        c.lerp(tmp.setHex(0xd9b36c), 0.35); // shortcut reads slightly lighter
      }
      if (q && q.outside <= 0 && q.path.def.id === 'main') {
        for (const [a, b] of lips) if (q.sample.s >= a && q.sample.s <= b) c.lerp(tmp.setHex(0xe9a23b), 0.55);
      }
      // Height tint: higher ground slightly lighter so elevation reads from above.
      if (surf !== 'water') c.multiplyScalar(Math.min(1.14, Math.max(0.8, 0.93 + h * 0.022)));
      // Darker road edge line helps readability.
      if (q && q.outside > -0.8 && q.outside <= 0.2 && surf !== 'water') c.multiplyScalar(0.72);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix, b = a + 1, c2 = a + nx, d = c2 + 1;
      idx[k++] = a; idx[k++] = c2; idx[k++] = b;
      idx[k++] = b; idx[k++] = c2; idx[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// ---------------------------------------------------------------- water

function waterMeshes(built: BuiltTrack): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2f7fb8, transparent: true, opacity: 0.78, emissive: 0x0b2a44 });
  const { track } = built;
  // River ribbon.
  const pts = track.riverPoints;
  if (pts.length > 1) {
    const pos: number[] = [];
    const idx: number[] = [];
    pts.forEach((r, i) => {
      const w = r.half + r.bank + 2;
      const lx = r.tz, lz = -r.tx;
      pos.push(r.x + lx * w, r.level, r.z + lz * w, r.x - lx * w, r.level, r.z - lz * w);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    g.add(m);
  }
  for (const l of track.def.lakes) {
    const geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(l.radiusX * 1.35, 1, l.radiusZ * 1.35);
    m.position.set(l.x, l.level, l.z);
    m.renderOrder = 1;
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------- bridge

function bridgeMesh(built: BuiltTrack): THREE.Group {
  const g = new THREE.Group();
  const plankA = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const plankB = new THREE.MeshLambertMaterial({ color: 0x74481f });
  const logMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  const rope = new THREE.MeshLambertMaterial({ color: 0xd8c9a0 });
  built.deck.forEach((d, i) => {
    const geo = new THREE.BoxGeometry(d.halfWidth * 2, d.thickness, d.halfLength * 2);
    const m = new THREE.Mesh(geo, i % 2 ? plankA : plankB);
    m.position.copy(d.center);
    m.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    // Edge logs (visual only — they will NOT stop you going over).
    for (const side of [-1, 1]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, d.halfLength * 2, 6), logMat);
      log.rotation.set(Math.PI / 2, 0, 0);
      const holder = new THREE.Object3D();
      holder.position.copy(d.center);
      holder.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
      log.position.set(side * (d.halfWidth - 0.1), d.thickness / 2 + 0.1, 0);
      holder.add(log);
      g.add(holder);
    }
    // Support posts every few planks, down into the gorge.
    if (i % 3 === 1) {
      for (const side of [-1, 1]) {
        const lx = Math.cos(d.yaw), lz = -Math.sin(d.yaw);
        const px = d.center.x + lx * side * (d.halfWidth - 0.3);
        const pz = d.center.z + lz * side * (d.halfWidth - 0.3);
        const ground = built.track.groundHeight(px, pz);
        const len = d.center.y - ground + 0.2;
        if (len < 0.5) continue;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, len, 6), logMat);
        post.position.set(px, ground + len / 2 - 0.3, pz);
        post.castShadow = true;
        g.add(post);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 4, 8), rope);
        tie.position.set(px, d.center.y - 0.1, pz);
        tie.rotation.x = Math.PI / 2;
        g.add(tie);
      }
    }
  });
  return g;
}

// ---------------------------------------------------------------- finish line / grid

function finishLine(built: BuiltTrack): THREE.Group {
  const g = new THREE.Group();
  const { track } = built;
  const gate = track.gates[0];
  const s = gate.s;
  const smp = track.main.sampleAt(s);
  const w = smp.halfWidth * 2;
  const cells = 20;
  const cw = w / cells;
  const white = new THREE.MeshLambertMaterial({ color: 0xf2eee0 });
  const black = new THREE.MeshLambertMaterial({ color: 0x2a2320 });
  const yaw = Math.atan2(smp.tx, smp.tz);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < cells; i++) {
      const lat = -smp.halfWidth + cw * (i + 0.5);
      const p = track.main.pointAt(s + (r - 0.5) * cw, lat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.05, cw), (i + r) % 2 ? white : black);
      m.position.set(p.x, track.groundHeight(p.x, p.z) + 0.03, p.z);
      m.rotation.y = yaw;
      m.receiveShadow = true;
      g.add(m);
    }
  }
  // Two bone/stone totems either side of the line.
  const totem = new THREE.MeshLambertMaterial({ color: 0xe6dcc3 });
  const flag = new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const p = track.main.pointAt(s, side * (smp.halfWidth + 3.5));
    const y = track.groundHeight(p.x, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 7), totem);
    pole.position.set(p.x, y + 4.5, p.z);
    pole.castShadow = true;
    g.add(pole);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), flag);
    banner.position.set(p.x, y + 7.6, p.z);
    banner.rotation.y = yaw + Math.PI / 2;
    banner.position.x += smp.tx * 1.7;
    banner.position.z += smp.tz * 1.7;
    g.add(banner);
  }
  // Grid boxes.
  const mark = new THREE.MeshLambertMaterial({ color: 0xf2eee0 });
  for (const slot of track.gridSlots()) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 3), mark);
      const lx = Math.cos(slot.yaw), lz = -Math.sin(slot.yaw);
      m.position.set(slot.position.x + lx * side * 1.5, 0, slot.position.z + lz * side * 1.5);
      m.position.y = track.groundHeight(m.position.x, m.position.z) + 0.03;
      m.rotation.y = slot.yaw;
      g.add(m);
    }
  }
  return g;
}

// ---------------------------------------------------------------- decor

const rockMat = new THREE.MeshLambertMaterial({ color: 0x857d72, flatShading: true });
const darkRock = new THREE.MeshLambertMaterial({ color: 0x6b645c, flatShading: true });
const boneMat = new THREE.MeshLambertMaterial({ color: 0xe8dfc8, flatShading: true });
const fernMat = new THREE.MeshLambertMaterial({ color: 0x4f7a2c, flatShading: true });
const markerMat = new THREE.MeshLambertMaterial({ color: 0xf0a020 });

function decorMesh(d: PlacedDecor, built: BuiltTrack): THREE.Object3D | null {
  const s = d.scale;
  const g = new THREE.Group();
  g.position.copy(d.position);
  g.rotation.y = d.yaw;
  switch (d.def.kind) {
    case 'boulder': {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15 * s, 0), rockMat);
      m.position.y = 0.35 * s;
      m.rotation.set(d.position.x, d.position.z, 0);
      m.castShadow = true;
      g.add(m);
      break;
    }
    case 'pillar': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 1.7 * s, 8 * s, 7), darkRock);
      m.position.y = 3 * s;
      m.castShadow = true;
      g.add(m);
      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 * s, 0), rockMat);
      cap.position.y = 7 * s;
      cap.castShadow = true;
      g.add(cap);
      break;
    }
    case 'fern': {
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s, 2.4 * s, 4), fernMat);
        leaf.position.y = 1 * s;
        leaf.rotation.set(0.6, (i / 5) * Math.PI * 2, 0, 'YXZ');
        g.add(leaf);
      }
      break;
    }
    case 'marker': {
      // Chevron board on two bone posts, facing the approaching racers.
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.2, 5), boneMat);
        post.position.set(side * 0.9, 1.1, 0);
        g.add(post);
      }
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.15), markerMat);
      board.position.y = 1.9;
      board.castShadow = true;
      g.add(board);
      break;
    }
    case 'arch': {
      const road = built.track.queryRoad(d.position.x, d.position.z);
      const hw = road ? road.sample.halfWidth + 0.9 : 6;
      for (const side of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6.5, 7), boneMat);
        tusk.position.set(side * hw, 3, 0);
        tusk.rotation.z = -side * 0.18;
        tusk.castShadow = true;
        g.add(tusk);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, hw * 2 + 1, 7), boneMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = 6.2;
      beam.castShadow = true;
      g.add(beam);
      const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), boneMat);
      skull.position.y = 6.8;
      g.add(skull);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.2), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
      sign.position.y = 5.3;
      g.add(sign);
      break;
    }
    case 'bones': {
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.6 * s, 0.14 * s, 5, 10, Math.PI), boneMat);
        rib.position.set(0, 0, (i - 2.5) * 0.8 * s);
        rib.rotation.set(0, 0, 0);
        g.add(rib);
      }
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 5 * s, 6), boneMat);
      spine.rotation.x = Math.PI / 2;
      spine.position.y = 1.6 * s;
      g.add(spine);
      break;
    }
  }
  return g;
}

function hash(ix: number, iz: number): number {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
