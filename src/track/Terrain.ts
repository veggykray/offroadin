import type { Track } from './Track';

/**
 * Generates the terrain heightfield from the track data.
 *
 * Layering (each layer only reads the data file, so moving a node reshapes the land):
 *   1. base landscape  — smooth interpolation of nearby road heights + gentle hills away from roads
 *   2. roads           — carved flat to their road height (with banking), earth berms at the edges
 *   3. rough bumps     — physical bumps on 'rough' road sections
 *   4. patches         — mud puddles are slightly sunken
 *   5. water           — river channel (deep gorge / shallow ford) and the lake
 *   6. map edge        — rises into cliffs so nobody drives off the world by accident
 */
export class Terrain {
  readonly nx: number; // vertices along x
  readonly nz: number; // vertices along z
  readonly heights: Float32Array; // row-major [iz * nx + ix]
  readonly minX: number;
  readonly minZ: number;
  readonly step: number;

  constructor(private track: Track) {
    const b = track.def.bounds;
    this.step = track.def.terrainResolution;
    this.minX = b.minX;
    this.minZ = b.minZ;
    this.nx = Math.round((b.maxX - b.minX) / this.step) + 1;
    this.nz = Math.round((b.maxZ - b.minZ) / this.step) + 1;
    this.heights = new Float32Array(this.nx * this.nz);
    this.generate();
  }

  get width(): number {
    return (this.nx - 1) * this.step;
  }
  get depth(): number {
    return (this.nz - 1) * this.step;
  }

  /** Bilinear height lookup. */
  heightAt(x: number, z: number): number {
    const fx = (x - this.minX) / this.step, fz = (z - this.minZ) / this.step;
    const ix = Math.max(0, Math.min(this.nx - 2, Math.floor(fx)));
    const iz = Math.max(0, Math.min(this.nz - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - ix)), tz = Math.max(0, Math.min(1, fz - iz));
    const h = this.heights, nx = this.nx;
    const a = h[iz * nx + ix], b = h[iz * nx + ix + 1], c = h[(iz + 1) * nx + ix], d = h[(iz + 1) * nx + ix + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }

  private generate(): void {
    const track = this.track;
    const base = this.baseGrid();
    const bermH = track.def.berm.height;
    const bermW = track.def.berm.width;
    const blendW = 14;

    for (let iz = 0; iz < this.nz; iz++) {
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.minX + ix * this.step;
        const z = this.minZ + iz * this.step;
        let baseH = base(x, z);
        const q = track.queryRoad(x, z, 40);
        let h = baseH;
        if (q) {
          const smp = q.sample;
          const d = Math.abs(q.lateral);
          const hw = smp.halfWidth;
          // Hills rise away from the road corridor.
          const far = smoothstep(hw + bermW + 6, hw + bermW + 40, d);
          baseH += far * hillNoise(x, z);
          let roadH = track.roadHeight(q);
          if (smp.bridge) roadH -= 3.2; // gully under the bridge deck
          if (smp.surface === 'rough' && !smp.bridge) roadH += roughNoise(x, z) * smoothstep(hw, hw - 1.5, d);
          if (d <= hw) {
            h = roadH;
          } else {
            const u = d - hw;
            if (smp.edge === 'berm' && !smp.bridge) {
              const top = roadH + bermH;
              if (u < bermW) h = roadH + bermH * smoothstep(0, bermW * 0.6, u);
              else h = lerp(top, Math.max(baseH, roadH + bermH * 0.35), smoothstep(bermW, bermW + blendW, u));
            } else {
              h = lerp(roadH, baseH, smoothstep(0, blendW, u));
            }
          }
        } else {
          baseH += hillNoise(x, z);
          h = baseH;
        }
        h -= track.patchDepthAt(x, z);
        h = Math.min(h, this.waterCarve(x, z));
        // Map edge cliffs.
        const edgeD = Math.min(ix, iz, this.nx - 1 - ix, this.nz - 1 - iz) * this.step;
        if (edgeD < 14) h += (1 - edgeD / 14) ** 2 * 16;
        this.heights[iz * this.nx + ix] = h;
      }
    }
    track.heightSampler = (x, z) => this.heightAt(x, z);
  }

  /** Coarse inverse-distance interpolation of road heights → smooth natural landscape. */
  private baseGrid(): (x: number, z: number) => number {
    const step = 8;
    const b = this.track.def.bounds;
    const gx = Math.ceil((b.maxX - b.minX) / step) + 1;
    const gz = Math.ceil((b.maxZ - b.minZ) / step) + 1;
    const grid = new Float32Array(gx * gz);
    const pts: Array<[number, number, number]> = [];
    for (const p of this.track.paths.values()) {
      for (let i = 0; i < p.samples.length; i += 3) {
        const s = p.samples[i];
        pts.push([s.x, s.z, s.bridge ? s.y - 3 : s.y]);
      }
    }
    for (let j = 0; j < gz; j++) {
      for (let i = 0; i < gx; i++) {
        const x = b.minX + i * step, z = b.minZ + j * step;
        let ws = 0, hs = 0;
        for (const [px, pz, py] of pts) {
          const d2 = (px - x) ** 2 + (pz - z) ** 2;
          const w = 1 / (d2 + 80) ** 2;
          ws += w;
          hs += w * py;
        }
        grid[j * gx + i] = ws > 0 ? hs / ws : 0;
      }
    }
    return (x: number, z: number) => {
      const fx = (x - b.minX) / step, fz = (z - b.minZ) / step;
      const i = Math.max(0, Math.min(gx - 2, Math.floor(fx)));
      const j = Math.max(0, Math.min(gz - 2, Math.floor(fz)));
      const tx = fx - i, tz = fz - j;
      const a = grid[j * gx + i], bb = grid[j * gx + i + 1], c = grid[(j + 1) * gx + i], d = grid[(j + 1) * gx + i + 1];
      return a + (bb - a) * tx + (c - a) * tz + (a - bb - c + d) * tx * tz;
    };
  }

  /** Height limit imposed by the river channel and lakes (Infinity if none). */
  private waterCarve(x: number, z: number): number {
    let h = Infinity;
    for (const l of this.track.def.lakes) {
      const u = (x - l.x) / l.radiusX, v = (z - l.z) / l.radiusZ;
      const r = Math.sqrt(u * u + v * v);
      const t = r < 1 ? l.level - l.depth * (1 - r * r) : l.level + (r - 1) * l.radiusX * 0.35;
      h = Math.min(h, t);
    }
    const q = this.track.riverQuery(x, z);
    if (q) {
      const { r, dist } = q;
      // Ignore river ends (beyond the last sample) except the outflow off the map.
      const bed = r.level - r.depth;
      let t: number;
      if (dist < r.half) t = bed + (r.depth + 0.15) * (dist / r.half) ** 2;
      else t = r.level + 0.15 + (dist - r.half) * Math.max(0.18, 2.6 / r.bank);
      h = Math.min(h, t);
    }
    return h;
  }
}

// ---------------------------------------------------------------- noise helpers

function hash(ix: number, iz: number): number {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function hillNoise(x: number, z: number): number {
  return valueNoise(x / 38, z / 38) * 7 + valueNoise(x / 13 + 50, z / 13) * 2 - 2;
}

export function roughNoise(x: number, z: number): number {
  // ~3 m wavelength rocky bumps, ±0.3 m
  return (valueNoise(x / 2.6, z / 2.6) - 0.5) * 0.55 + (valueNoise(x / 1.3 + 17, z / 1.3) - 0.5) * 0.2;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
