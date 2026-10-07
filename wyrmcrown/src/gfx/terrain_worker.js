/* WYRMCROWN — terrain shading worker (terrain_worker.js).
 * Rasterising a terrain chunk is ~90% per-texel maths (height grid, terraces,
 * hillshade, cliff faces, shadows, ground colour) and was the biggest source of
 * frame spikes when flying fast into new ground. This worker builds the very same
 * RealmTerrain from the same map description and runs the same grid / up / shade
 * passes, then hands the finished pixels (and the terrace levels the decor stamping
 * needs) back to the page, which only uploads them and stamps decor. Identical code
 * and inputs give identical pixels. */
'use strict';
self.window = self;
self.AS = self.AS || {};
importScripts('../../../alien-strike/src/core/util.js', '../../../alien-strike/src/gfx/terrain.js', 'realm_terrain.js');

let T = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    T = new AS.RealmTerrain(m.world, m.map);
    T.zones = m.zones; T.bridges = m.bridges;
    T.typeGrid.fill(255);
    T.texel = () => T.TD;
    return;
  }
  if (m.type === 'chunk' && T) {
    if (T.TD !== m.TD) { T.TD = m.TD; T._bufs = null; }
    const st = T.bufs(0), cx = m.cx, cy = m.cy;
    st.cx = cx; st.cy = cy; st.x0 = cx * 256; st.y0 = cy * 256;
    T._grid(st, 0, st.gh);
    T._up(st, 0, st.rows);
    const D = new Uint8ClampedArray(st.N * st.N * 4);
    st.D = D; st.cnt.fill(0); st.dropL.fill(-9); st.faceH.fill(0); st.faceNX.fill(0);
    T._shade(st, 1, st.rows);
    st.D = null;
    const L = new Int8Array(st.L); // the terrace levels, for decor placement on the page
    self.postMessage({ type: 'chunk', id: m.id, cx, cy, TD: m.TD, D, L, N: st.N, NW: st.NW, rows: st.rows, ML: st.ML, top: st.top }, [D.buffer, L.buffer]);
  }
};
