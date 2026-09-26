import * as THREE from 'three';
import { RAPIER, PhysicsWorld, TERRAIN_GROUPS } from '../physics/PhysicsWorld';
import { Track } from './Track';
import { Terrain } from './Terrain';
import type { DecorDef, TrackDef } from './TrackData';

/** A physical deck plank of the bridge (also used by the visuals). */
export interface DeckSegment {
  center: THREE.Vector3;
  yaw: number;
  pitch: number;
  halfLength: number;
  halfWidth: number;
  thickness: number;
}

/** Placed decor instance (position resolved from path-relative data). */
export interface PlacedDecor {
  def: DecorDef;
  position: THREE.Vector3;
  yaw: number;
  scale: number;
}

export interface BuiltTrack {
  track: Track;
  terrain: Terrain;
  deck: DeckSegment[];
  decor: PlacedDecor[];
}

/**
 * Builds everything PHYSICAL about a track from its data: terrain heightfield,
 * bridge deck and solid props. Render-free, so it also runs in the headless simulator.
 * (Visual meshes are built separately by `TrackVisuals`.)
 */
export function buildTrack(def: TrackDef, physics: PhysicsWorld): BuiltTrack {
  const track = new Track(def);
  const terrain = new Terrain(track);

  // ---- Terrain heightfield collider ----
  const nrows = terrain.nz - 1, ncols = terrain.nx - 1;
  const hf = new Float32Array(terrain.nx * terrain.nz);
  // Rapier expects column-major: index = row + col * (nrows + 1), rows along z.
  for (let iz = 0; iz < terrain.nz; iz++) {
    for (let ix = 0; ix < terrain.nx; ix++) hf[iz + ix * terrain.nz] = terrain.heights[iz * terrain.nx + ix];
  }
  const hfDesc = RAPIER.ColliderDesc.heightfield(nrows, ncols, hf, { x: terrain.width, y: 1, z: terrain.depth })
    .setTranslation(terrain.minX + terrain.width / 2, 0, terrain.minZ + terrain.depth / 2)
    .setFriction(0.4)
    .setRestitution(0.05)
    .setCollisionGroups(TERRAIN_GROUPS);
  physics.tag(physics.world.createCollider(hfDesc), { kind: 'terrain' });

  // ---- Bridge deck (thin planks, no rails: you CAN fall off) ----
  const deck = buildDeck(track);
  for (const d of deck) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d.pitch, d.yaw, 0, 'YXZ'));
    const desc = RAPIER.ColliderDesc.cuboid(d.halfWidth, d.thickness / 2, d.halfLength)
      .setTranslation(d.center.x, d.center.y, d.center.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setFriction(0.4)
      .setCollisionGroups(TERRAIN_GROUPS);
    physics.tag(physics.world.createCollider(desc), { kind: 'bridge', surface: 'wood' });
  }

  // ---- Decor (solid ones get colliders) ----
  const decor = placeDecor(track, def.decor);
  for (const d of decor) {
    const s = d.scale;
    let desc: RAPIER.ColliderDesc | null = null;
    switch (d.def.kind) {
      case 'boulder':
        if (d.def.solid) desc = RAPIER.ColliderDesc.ball(1.1 * s).setTranslation(d.position.x, d.position.y + 0.35 * s, d.position.z);
        break;
      case 'pillar':
        desc = RAPIER.ColliderDesc.cylinder(4 * s, 1.6 * s).setTranslation(d.position.x, d.position.y + 3 * s, d.position.z);
        break;
      case 'arch': {
        // Two posts either side of the road.
        const road = track.queryRoad(d.position.x, d.position.z);
        const hw = road ? road.sample.halfWidth + 0.9 : 6;
        const lx = road ? road.sample.lx : 1, lz = road ? road.sample.lz : 0;
        for (const side of [-1, 1]) {
          const px = d.position.x + lx * hw * side, pz = d.position.z + lz * hw * side;
          warnIfOnRoad(track, px, pz, 0.5, 'arch post');
          const py = track.groundHeight(px, pz);
          const post = RAPIER.ColliderDesc.cylinder(2.5, 0.45).setTranslation(px, py + 2.5, pz).setCollisionGroups(TERRAIN_GROUPS);
          physics.tag(physics.world.createCollider(post), { kind: 'static', surface: 'rock' });
        }
        break;
      }
      default:
        break;
    }
    if (desc && d.def.kind === 'pillar') warnIfOnRoad(track, d.position.x, d.position.z, 1.6 * s, 'pillar');
    if (desc) {
      desc.setCollisionGroups(TERRAIN_GROUPS).setFriction(0.3).setRestitution(0.2);
      physics.tag(physics.world.createCollider(desc), { kind: 'static', surface: 'rock' });
    }
  }

  return { track, terrain, deck, decor };
}

/** Solid props that accidentally block a road are a classic data-edit mistake — shout about it. */
function warnIfOnRoad(track: Track, x: number, z: number, radius: number, what: string): void {
  const q = track.queryRoad(x, z, 30);
  if (q && q.outside < radius) console.warn(`[TrackBuilder] ${what} at (${x.toFixed(1)}, ${z.toFixed(1)}) intrudes on road "${q.path.def.id}" (s=${q.sample.s.toFixed(0)})`);
}

function buildDeck(track: Track): DeckSegment[] {
  const out: DeckSegment[] = [];
  for (const path of track.paths.values()) {
    const bridgeSamples = path.samples.filter((s) => s.bridge);
    if (!bridgeSamples.length) continue;
    const s0 = bridgeSamples[0].s - 1.0;
    const s1 = bridgeSamples[bridgeSamples.length - 1].s + 1.0;
    const segLen = 2;
    const n = Math.ceil((s1 - s0) / segLen);
    const thickness = 0.5;
    for (let i = 0; i < n; i++) {
      const a = path.sampleAt(s0 + i * segLen);
      const b = path.sampleAt(Math.min(s1, s0 + (i + 1) * segLen));
      const dx = b.x - a.x, dz = b.z - a.z;
      const horiz = Math.hypot(dx, dz) || 1;
      const ya = path.sampleAt(s0 + i * segLen).y;
      const yb = path.sampleAt(Math.min(s1, s0 + (i + 1) * segLen)).y;
      out.push({
        center: new THREE.Vector3((a.x + b.x) / 2, (ya + yb) / 2 - thickness / 2, (a.z + b.z) / 2),
        yaw: Math.atan2(dx, dz),
        pitch: -Math.atan2(yb - ya, horiz),
        halfLength: horiz / 2 + 0.06,
        halfWidth: a.halfWidth,
        thickness,
      });
    }
  }
  return out;
}

function placeDecor(track: Track, defs: DecorDef[]): PlacedDecor[] {
  return defs.map((d) => {
    let x = d.x ?? 0, z = d.z ?? 0, yaw = 0;
    if (d.path && d.at) {
      const path = track.paths.get(d.path)!;
      const s = path.node(d.at) + (d.offset ?? 0);
      const p = path.pointAt(s, d.lateral ?? 0);
      const smp = path.sampleAt(s);
      x = p.x;
      z = p.z;
      yaw = Math.atan2(smp.tx, smp.tz);
    }
    const y = track.groundHeight(x, z);
    return { def: d, position: new THREE.Vector3(x, y, z), yaw, scale: d.scale ?? 1 };
  });
}
