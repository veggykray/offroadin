// Renders a top-down debug map of Track 1 (surface colours shaded by height) to tools/out/map.png
import { initPhysics, PhysicsWorld } from '../src/physics/PhysicsWorld';
import { buildTrack } from '../src/track/TrackBuilder';
import { TRACK1 } from '../src/track/TrackData';
import { SURFACES } from '../src/track/SurfaceManager';
import { writePng } from './png';

await initPhysics();
const t0 = performance.now();
const built = buildTrack(TRACK1, new PhysicsWorld());
console.log('build ms', (performance.now() - t0).toFixed(0));
const { terrain, track } = built;
const S = 3; // pixels per metre
const W = terrain.nx * S, H = terrain.nz * S;
const img = new Uint8Array(W * H * 3);
let minH = Infinity, maxH = -Infinity;
for (const h of terrain.heights) { minH = Math.min(minH, h); maxH = Math.max(maxH, h); }
console.log('height range', minH.toFixed(1), maxH.toFixed(1));
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
  const x = terrain.minX + px / S, z = terrain.minZ + py / S;
  const h = terrain.heightAt(x, z);
  const surf = track.surfaceAt(x, h, z);
  let c = SURFACES[surf].color;
  const lvl = track.waterLevelAt(x, z);
  if (lvl !== null && h < lvl) c = 0x3a78b0;
  // hillshade
  const dx = terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z);
  const dz = terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5);
  let shade = 0.75 + (h - 0) * 0.025 - dx * 0.25 - dz * 0.35;
  shade = Math.max(0.35, Math.min(1.3, shade));
  const i = (py * W + px) * 3;
  img[i] = Math.min(255, ((c >> 16) & 255) * shade); img[i + 1] = Math.min(255, ((c >> 8) & 255) * shade); img[i + 2] = Math.min(255, (c & 255) * shade);
}
const dot = (x: number, z: number, r: number, col: [number, number, number]) => {
  for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
    const px = Math.round((x - terrain.minX) * S) + a, py = Math.round((z - terrain.minZ) * S) + b;
    if (px < 0 || py < 0 || px >= W || py >= H) continue; const i = (py * W + px) * 3; img[i] = col[0]; img[i + 1] = col[1]; img[i + 2] = col[2];
  }
};
for (const g of track.gates) for (let l = -g.halfWidth + 8; l <= g.halfWidth - 8; l += 0.5) dot(g.x + g.tz * l, g.z - g.tx * l, 1, [255, 255, 255]);
for (const s of track.gridSlots()) dot(s.position.x, s.position.z, 3, [255, 0, 255]);
for (const d of built.deck) dot(d.center.x, d.center.z, 2, [120, 60, 20]);
for (const d of built.decor) dot(d.position.x, d.position.z, 3, [40, 40, 40]);
writePng('tools/out/map.png', W, H, img);
console.log('lap length', track.main.length.toFixed(0), 'shortcut', track.shortcut?.length.toFixed(0), 'safe section', (track.rejoinS - track.splitS).toFixed(0));
for (const r of track.routes) console.log('route', r.id, r.length.toFixed(0));
