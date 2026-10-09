/* WYRMCROWN — terrain chunk worker (terrain_worker.js).
 * Builds whole terrain chunks off the main thread: the same RealmTerrain from the
 * same map description runs the grid / terrace / shade passes, stamps the decor
 * (trees, rocks, scree — forged here from the same model code) and paints the
 * static decals (roads, fields, plazas, foundations), then hands the finished
 * chunk to the page as an ImageBitmap. The page only stores it and draws it, so
 * no per-chunk pixel upload, decor stamping or decal painting runs during a
 * frame. Static decals added after start-up arrive as 'sdecal' messages; the
 * page paints any the worker had not yet seen (see RealmTerrain.store). */
'use strict';
self.window = self;
self.AS = self.AS || {};
const LIBS = [
  '../../../alien-strike/src/core/util.js',
  '../../../alien-strike/src/gfx/forge.js', '../../../alien-strike/src/gfx/models.js', '../../../alien-strike/src/gfx/models4.js',
  '../../data/palettes.js', '../../data/factions.js', '../../data/buildings.js', '../../data/sites.js',
  'materials.js', 'dragon_art.js', 'models_nature.js', 'models_human.js', 'models_elf.js', 'models_ice.js', 'models_undead.js',
  'models_units.js', 'models_beasts.js', 'models_beasts2.js', 'models_giants.js', 'models_landmarks_realm.js', 'models_town_extra.js', 'models_sites.js',
  '../../../alien-strike/src/gfx/decals.js', 'decals_realm.js',
  '../../../alien-strike/src/gfx/terrain.js', 'realm_terrain.js',
];
for (const f of LIBS) { try { importScripts(f); } catch (e) { /* a model file that cannot load here: its decor falls back */ } }

let T = null, sseq = 0;
const CH = 256;
// file a static decal under every chunk it touches (the same bounds the page uses)
function addStatic(d) {
  const bb = AS.Decals.bounds(d);
  for (let cx = Math.floor(bb[0] / CH); cx <= Math.floor(bb[2] / CH); cx++)
    for (let cy = Math.floor(bb[1] / CH); cy <= Math.floor(bb[3] / CH); cy++) {
      const key = cx * 10000 + cy;
      let list = T.sdecals.get(key);
      if (!list) { list = []; T.sdecals.set(key, list); }
      list.push(d);
    }
  if (d.seq > sseq) sseq = d.seq;
}
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    const t0 = performance.now();
    if (AS.Forge && m.forgeRes) AS.Forge.res = m.forgeRes;
    // the page's lookup grids arrive with the message: use them instead of rebuilding
    const P = AS.RealmTerrain.prototype, build = P.buildGrids;
    if (m.grids) P.buildGrids = function () { Object.assign(this, m.grids); };
    try { T = new AS.RealmTerrain(m.world, m.map); } finally { P.buildGrids = build; }
    if (m.clearAreas) T.clearAreas = m.clearAreas;
    if (m.clearSegs) T.clearSegs = m.clearSegs;
    // decal kinds painted here (some painters live in game code the worker does not load)
    self.postMessage({ type: 'kinds', kinds: Object.keys(AS.Decals.painters) });
    T.zones = m.zones; T.bridges = m.bridges;
    if (T.typeGrid) T.typeGrid.fill(255);
    T.texel = () => T.TD;
    for (const d of m.sdecals || []) addStatic(d);
    // forge the decor sheets (trees, rocks, undergrowth) one at a time while idle:
    // a chunk request that arrives meanwhile runs first (forging just the ones it uses)
    try {
      T.decorSets = T.buildDecorSets();
      const todo = []; for (const k in T.decorSets.sheets) for (const sh of T.decorSets.sheets[k]) todo.push(sh);
      const step = () => {
        const sh = todo.shift();
        if (!sh) { self.postMessage({ type: 'ready', ms: performance.now() - t0 }); return; }
        try { void sh.frames[0][0]; void sh.shadows[0]; } catch (err) { /* forged on first use */ }
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    } catch (err) { /* forged on first use instead */ }
    return;
  }
  if (!T) return;
  if (m.type === 'sdecal') { addStatic(m.d); return; }
  if (m.type === 'clear') { for (const a of m.a) T.clearAreas.push(a); return; }
  // a streamed map's lookup tile, for the page (copies: the worker keeps its own)
  if (m.type === 'tile') {
    const t = T.tileAt(m.ti, m.tj);
    self.postMessage({ type: 'tile', ti: m.ti, tj: m.tj, gWater: t.gWater, gMount: t.gMount, gForest: t.gForest, gBiome: t.gBiome, gRoad: t.gRoad, gField: t.gField, kind: t.kind });
    return;
  }
  if (m.type === 'chunk') {
    const t0 = performance.now();
    // buffers are kept per texel density: near (full detail) and far (high flight) requests alternate
    if (T.TD !== m.TD) { const B = T._byTD || (T._byTD = {}); B[T.TD] = T._bufs; T.TD = m.TD; T._bufs = B[m.TD] || null; }
    if (AS.Forge && m.forgeRes && AS.Forge.res !== m.forgeRes) AS.Forge.setRes(m.forgeRes);
    const st = T.bufs(0), cx = m.cx, cy = m.cy, key = cx * 10000 + cy;
    st.cx = cx; st.cy = cy; st.x0 = cx * CH; st.y0 = cy * CH; st.TD = T.TD;
    T._grid(st, 0, st.gh);
    T._up(st, 0, st.rows);
    const D = new Uint8ClampedArray(st.N * st.N * 4);
    st.D = D; st.cnt.fill(0); st.dropL.fill(-9); st.faceH.fill(0); st.faceNX.fill(0);
    T._shade(st, 1, st.rows);
    st.D = null;
    const t1 = performance.now();
    const cv = new OffscreenCanvas(st.N, st.N), ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(D, st.N, st.N), 0, 0);
    try { T.stampDecor(ctx, cx, cy, st); } catch (err) { /* decor is cosmetic: the ground stays */ }
    const t2 = performance.now();
    const list = T.sdecals.get(key);
    if (list) for (const d of list) { try { T.paintDecal(cv, cx, cy, d); } catch (err) { /* skip a decal that cannot paint */ } }
    const bmp = cv.transferToImageBitmap();
    self.postMessage({ type: 'chunk', cx, cy, TD: m.TD, far: !!m.far, bmp, sseq, ms: performance.now() - t0, parts: [t1 - t0, t2 - t1, performance.now() - t2] }, [bmp]);
  }
};
