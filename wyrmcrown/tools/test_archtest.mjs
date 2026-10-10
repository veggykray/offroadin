// WYRMCROWN — the Architecture Compatibility Test (maps/archtest.js, src/game/archtest.js),
// in the browser. Six revision-3 architectural assets on the Mountain Test terrain:
//   the sources are the delivered ones (hashes) → the mode loads with all six placed
//   → each sheet forges (in the forge workers where they run) and its drawn pixels
//   cover the same bounds Astra's validation measured → the dwarven recipes carry
//   their masonry overlays → ground contact under every support point → the
//   inspection shortcuts work and every structure is in the drawn list from low
//   flight and from the ceiling → copies share one sheet → unload frees the sheets
//   and reload forges the same pixels → cold forge cost and memory are printed.
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_archtest.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
let n = 0;
const step = (name) => { n++; console.log('PASS ' + n + '. ' + name); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ev = (fn, a) => page.evaluate(fn, a);

// the delivered sources (data/package-contents.json of architecture-production-phase1, revision 3)
const SRC = { 'modules.js': 'becff9713530c7a7b5eb7d238ee89a6e0939e763c7c448e14a6c604e5cad2c09', 'models.js': '07305594fb08e25cbaaeaccc16f7694a3774d1beb567a655386b186f07cb6cc6' };
// the drawn bounds Astra's validation measured (data/asset-manifest.json measuredAlpha, heading 0, world units)
const BOUNDS = { p1_h03: [-130.5, -198.5, 133, 94], p1_h01: [-34.5, -74.5, 35.5, 30], p1_e03: [-94, -185, 94, 86.5], p1_e_treehouse: [-31, -109, 33, 27], p1_d01: [-113.5, -166, 113.5, 85.5], p1_d_greathall: [-60.5, -126, 60.5, 61.5] };
const D01_HEADINGS = [[-113.5, -166, 113.5, 85.5], [-86, -209, 58.5, 113], [-113.5, -158, 113.5, 58.5], [-58.5, -209, 86, 113.5]];

try {
  const dir = fileURLToPath(new URL('../src/gfx/arch_p1/', import.meta.url));
  for (const f in SRC) ok(createHash('sha256').update(readFileSync(dir + f)).digest('hex') === SRC[f], f + ' is not the delivered revision-3 source');
  step('the sources are the delivered revision-3 files (src/gfx/arch_p1/modules.js, models.js: sha256 match the package)');

  const t0 = Date.now();
  await page.goto(BASE + '?world=arch');
  await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play' && window.__arch, null, { timeout: 180000 });
  const loadMs = Date.now() - t0;
  const st = await ev(() => { const s = __arch.state(); return { list: s.list, rev: AS.ArchP1.assets.map((a) => a.revision), n54: AS.ArchP1.assets.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, wk: AS.Forge.pool.wk.length, wkBroken: AS.Forge.pool.wk.filter((w) => w.broken).length }; });
  ok(st.n54 === 54 && st.rev.every((r) => r === 3), 'revision ' + JSON.stringify(st.rev.slice(0, 3)) + ' count ' + st.n54);
  ok(st.list.length === 6 && st.list.every((d) => !d.missing && d.sheet), 'placed ' + JSON.stringify(st.list.map((d) => [d.id, d.missing])));
  step('the mode loads in ' + (loadMs / 1000).toFixed(1) + ' s with 54 revision-3 recipes registered and all six placed: ' + st.list.map((d) => d.id).join(', ') + ' (' + st.heap + ' MB heap, ' + st.wk + ' forge workers' + (st.wkBroken ? ', ' + st.wkBroken + ' broken' : '') + ')');
  ok(st.wkBroken === 0, 'a forge worker failed to load (arch_p1 import?)');

  // forge everything (let the workers deliver first), then measure the drawn pixels
  await ev(() => { for (const d of AS.game.arch.list) AS.Forge.want(d.b.sheet, 0); });
  await page.waitForTimeout(4000);
  const px = await ev(() => {
    const out = {};
    const bounds = (img, sh) => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, solid = 0;
      for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 0) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; solid++; }
      let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; // a cheap pixel fingerprint
      const F = sh.res; return { b: [x0 / F - sh.ax, y0 / F - sh.ay, (x1 + 1) / F - sh.ax, (y1 + 1) / F - sh.ay], solid, hash: h, bitmap: typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap };
    };
    for (const d of AS.game.arch.list) {
      const sh = d.b.sheet, workerBefore = sh.frames[0].map((_, i) => !Object.getOwnPropertyDescriptor(sh.frames[0], i).get && sh.frames[0][i] instanceof ImageBitmap);
      AS.Forge.complete(sh);
      out[d.id] = { dirs: sh.dirs, frames: sh.frames[0].map((f) => bounds(f, sh)), shadow: bounds(sh.shadows[0], sh), byWorker: workerBefore };
    }
    return out;
  });
  for (const id in BOUNDS) {
    const f = px[id].frames[0], e = BOUNDS[id];
    ok(f.solid > 1000, id + ' frame is empty');
    ok(f.b.every((v, i) => Math.abs(v - e[i]) <= 1.5), id + ' drawn bounds ' + JSON.stringify(f.b) + ' vs validation ' + JSON.stringify(e));
    ok(px[id].shadow.solid > 1000, id + ' shadow is empty');
  }
  for (let k = 0; k < 4; k++) ok(px.p1_d01.frames[k].b.every((v, i) => Math.abs(v - D01_HEADINGS[k][i]) <= 1.5), 'p1_d01 heading ' + k * 90 + ' bounds ' + JSON.stringify(px.p1_d01.frames[k].b));
  const byW = Object.values(px).reduce((s, q) => s + q.byWorker.filter(Boolean).length, 0);
  step('every sheet forges with a shadow, and the drawn pixels cover the same bounds Astra\'s validation measured (±1.5 units) — five fixed facades and the gate\'s 4 headings (0/90/180/270); ' + byW + ' of 9 frames came from the forge workers');

  const mas = await ev(() => {
    const r = {};
    for (const id of ['p1_d01', 'p1_d_greathall', 'p1_h03', 'p1_e03']) { const fam = id.startsWith('p1_d') ? 'dwarf' : id.startsWith('p1_h') ? 'human' : 'elf'; const m = AS.Models[id](AS.Settlements.pal(fam), { v: 0 }); r[id] = { parts: m.parts.length, overlays: m.parts.filter((p) => p.flat && p.detail && p.z0 === 0 && p.z1 === 0).length, modules: m._arch.modules }; }
    return r;
  });
  ok(mas.p1_d01.overlays >= 40 && mas.p1_d_greathall.overlays >= 40, 'dwarf masonry overlays ' + mas.p1_d01.overlays + ' / ' + mas.p1_d_greathall.overlays);
  step('the dwarven recipes carry their cut-stone overlays (gate ' + mas.p1_d01.overlays + ' of ' + mas.p1_d01.parts + ' parts, vaulted hall ' + mas.p1_d_greathall.overlays + ' of ' + mas.p1_d_greathall.parts + '; castle ' + mas.p1_h03.overlays + ', citadel ' + mas.p1_e03.overlays + ')');

  const fit = st.list.map((d) => d.key + ' ' + d.id + ': ' + d.fit.contacts + ' contacts, anchor ' + d.fit.anchor + ', highest contact +' + d.fit.max + (d.fit.impassable ? ' (some contacts on ground the walking grid calls impassable)' : ''));
  ok(st.list.every((d) => d.fit.max < 40), 'a structure needs more than 40 units of foundation: ' + fit.join('; '));
  step('ground contact (structure at its lowest support point): ' + fit.join(' · '));

  // the shortcuts: each lands the dragon by its structure, and the structure is drawn — from low flight and from the ceiling
  const vis = await ev(() => {
    const g = AS.game, R = AS.Renderer, out = [];
    for (const k of 'ABCDEFGHI') {
      __mtn.test(k);
      for (let i = 0; i < 4; i++) g.update(1 / 30);
      R.renderWorld(g, 1 / 30);
      const drawn = g.arch.list.filter((d) => R.drawList.includes(d.b)).map((d) => d.key);
      out.push({ k, alt: Math.round(g.player._m.alt), drawn });
    }
    return out;
  });
  for (const v of vis) { const want = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'AB', H: 'CD', I: 'EF' }[v.k]; for (const c of want) ok(v.drawn.includes(c), 'shortcut ' + v.k + ' at altitude ' + v.alt + ' does not draw ' + c + ' (drawn ' + v.drawn + ')'); }
  step('the shortcuts (` then 1–9) put each structure in the drawn list: ' + vis.map((v) => v.k + '@' + v.alt + ':' + v.drawn.join('')).join(' '));

  const dup = await ev(() => __arch.dupes(8));
  ok(dup && dup.shared && dup.keys === 1, 'copies ' + JSON.stringify(dup));
  step('eight more copies of the merchant house share its one sheet (one Forge cache key for p1_h01)');

  const cyc = await ev(() => {
    const g = AS.game, A = __arch.A;
    const pix = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const before = A.mem(), b0 = g.buildings.length, p0 = g.arch.list.map((d) => pix(d.b.sheet.frames[0][0]));
    __arch.toggle();
    const gone = A.mem(), b1 = g.buildings.length, keys = [...AS.Forge.cache.keys()].filter((k) => k.startsWith('bld:p1_')).length;
    __arch.toggle();
    const t = performance.now(); for (const d of g.arch.list) AS.Forge.complete(d.b.sheet); const ms = performance.now() - t;
    // the re-forged frames against the first ones (a worker's OffscreenCanvas and the page's canvas
    // antialias a little differently: Astra's validation tolerance is used)
    const diff = g.arch.list.map((d, i) => { const a = p0[i], b = pix(d.b.sheet.frames[0][0]); if (a.length !== b.length) return { id: d.id, size: false };
      let sum = 0, dif = 0, adif = 0; for (let j = 0; j < a.length; j++) { const v = Math.abs(a[j] - b[j]); sum += v; if (v) { dif++; if ((j & 3) === 3) adif++; } }
      return { id: d.id, size: true, mean: +(sum / a.length).toFixed(3), frac: +(dif / a.length).toFixed(4), alpha: +(adif / (a.length / 4)).toFixed(4) }; });
    return { before, gone, keys, b0, b1, b2: g.buildings.length, ms, diff, after: A.mem() };
  });
  ok(cyc.gone.sheets === 0 && cyc.keys === 0 && cyc.b1 === cyc.b0 - 6 - 8, 'unload ' + JSON.stringify(cyc));
  ok(cyc.after.sheets === 6 && cyc.diff.every((q) => q.size && q.mean < 0.5 && q.frac < 0.04 && q.alpha < 0.005), 'reload ' + JSON.stringify(cyc));
  step('unload removes the six (and the copies) and evicts every p1 sheet (' + cyc.before.mb + ' MB → 0); reload places them again and re-forges the same pixels within Astra\'s worker/page tolerance (worst mean channel difference ' + Math.max(...cyc.diff.map((q) => q.mean)) + '; ' + cyc.ms.toFixed(0) + ' ms on the page for all six)');

  const cost = await ev(() => {
    const out = {};
    for (const d of AS.game.arch.list) {
      const m = AS.Models[d.id](AS.Settlements.pal(d.culture), { v: 0 }), t = [];
      for (let i = 0; i < 3; i++) { const a = performance.now(); AS.Forge.renderModel(m, 0, 0, { res: 2 }); t.push(performance.now() - a); }
      t.sort((a, b) => a - b);
      const sh = d.b.sheet; out[d.id] = { ms: +t[1].toFixed(1), frameMB: +(sh.w * sh.h * sh.res * sh.res * 4 / 1048576).toFixed(2), dirs: sh.dirs, parts: m.parts.length };
    }
    return out;
  });
  step('cold forge (one frame at res 2, page thread, this machine): ' + Object.entries(cost).map(([id, c]) => id + ' ' + c.ms + ' ms, ' + c.parts + ' parts, ' + c.dirs + '×' + c.frameMB + ' MB').join(' · '));

  ok(!errors.length, 'page errors: ' + errors.slice(0, 5).join(' | '));
  step('no page errors');
  console.log('METRICS ' + JSON.stringify({ loadMs, fit: st.list.map((d) => ({ id: d.id, fit: d.fit, sheet: d.sheet, viewR: d.viewR })), masonry: mas, cost, cycle: cyc, vis, bounds: Object.fromEntries(Object.entries(px).map(([k, v]) => [k, v.frames.map((f) => f.b)])) }));
  console.log('\nALL ' + n + ' CHECKS PASSED');
} catch (e) {
  console.log('FAIL: ' + e.message);
  if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 10).join('\n  '));
  process.exitCode = 1;
} finally { await browser.close(); }
