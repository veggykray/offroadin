// WYRMCROWN — the Huge World Test (map.stream), in the browser: a generated
// continent ~35 km across, built around the dragon as it flies.
//   loads quickly, with only the start built → a long sprint across the land:
//   ground tiles come from the terrain workers (the page builds almost none),
//   areas and places are made ahead and packed away behind, the war map fills
//   in, memory and entity counts stay bounded → a place's beaten guards stay
//   beaten after it is packed away and built again → an area built again is the
//   same → long routes go by road, quickly, never through water, and soldiers
//   walk them → far wildlife sleeps.
//   Stage 3 (a world worth exploring): many kinds of place, each where it
//   belongs (dwarf holds under mountains, elf villages in the old forest,
//   harbours on the water) → towns, castles and holds are composed of many
//   buildings → flying low over a landmark discovers it and pays the finder →
//   a relic from a hoard raises an upgrade for free.
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_hugeworld.mjs
import { createRequire } from 'node:module';
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
const stats = () => ev(() => { const g = AS.game, T = g.terrain, S = g.stream; return { x: g.player.x, y: g.player.y, tiles: T.gtiles.size, pageTiles: T.gtBuilt, workerTiles: T.gtFromWorkers || 0, cells: S.loaded.size, made: S.stats.cellsMade, dropped: S.stats.cellsDropped, built: S.stats.sitesBuilt, packed: S.stats.sitesPacked, tac: S.stats.tacBlocks, troops: g.troops.length, buildings: g.buildings.length, life: AS.Life.count(g), scenery: g.scenery.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 }; });
const tp = (x, y, z) => ev(([x, y, z]) => { AS.Debug.hold(false); AS.Debug.tp(x, y, z); AS.Debug.hold(true); }, [x, y, z]);

try {
  const t0 = Date.now();
  await page.goto(BASE + '?world=huge');
  await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 300000 });
  const loadMs = Date.now() - t0;
  const s0 = await stats();
  const info = await ev(() => ({ w: AS.game.map.w, sites: AS.game.sites.length, loaded: AS.game.sites.filter((s) => s.loaded).length, roads: AS.game.nav.roads.nodes.length }));
  ok(info.w >= 150000 && info.sites > 150 && info.loaded < 10 && s0.tiles < 150, 'start ' + JSON.stringify(info) + ' ' + JSON.stringify(s0));
  step('the continent (' + info.w + ' units, ' + info.sites + ' places) loads in ' + (loadMs / 1000).toFixed(1) + ' s with only the start built (' + info.loaded + ' places, ' + s0.tiles + ' ground tiles, ' + s0.heap + ' MB)');

  // Stage 3: many kinds of place, each where it belongs
  const kinds = await ev(() => { const c = {}; for (const s of AS.game.sites) c[s.kind] = (c[s.kind] || 0) + 1; return c; });
  const need = { town: 6, walledtown: 1, stronghold: 4, abbey: 3, elfvillage: 6, dwarfhold: 4, shire: 3, harbour: 3, landmark: 40, cave: 10, dungeon: 5, banditcamp: 5, ruins: 5 };
  for (const k in need) ok((kinds[k] || 0) >= need[k], 'kinds ' + k + ' ' + JSON.stringify(kinds));
  step('the land holds ' + Object.keys(kinds).length + ' kinds of place (' + Object.keys(need).map((k) => kinds[k] + ' ' + k).join(', ') + ')');
  const where = await ev(() => { const g = AS.game, T = g.terrain, out = { dwarf: [], elf: [], harbour: [] }, bw = new Float32Array(5);
    const near = (s, R, f) => { T.warmTiles(s.x - R, s.y - R, s.x + R, s.y + R); let best = -1e9; for (let a = 0; a < 16; a++) for (const r of [0, R * 0.5, R]) { const v = f(s.x + Math.cos(a / 16 * 6.283) * r, s.y + Math.sin(a / 16 * 6.283) * r); if (v > best) best = v; } return best; };
    for (const s of g.sites) {
      if (s.kind === 'dwarfhold') out.dwarf.push(+near(s, 900, (x, y) => T.gs(T.gMount, x, y)).toFixed(2));
      else if (s.kind === 'elfvillage') { T.warmTiles(s.x - 50, s.y - 50, s.x + 50, s.y + 50); T.biomeAt(s.x, s.y, bw); out.elf.push(+bw[1].toFixed(2)); }
      else if (s.kind === 'harbour') out.harbour.push(Math.round(-near(s, 600, (x, y) => -T.gs(T.gWater, x, y))));
    }
    return out; });
  ok(where.dwarf.every((m) => m > 0.4), 'dwarf holds without mountains ' + where.dwarf);
  ok(where.elf.filter((w) => w > 0.5).length >= where.elf.length * 0.8, 'elf villages outside the forest ' + where.elf);
  ok(where.harbour.every((d) => d < 0), 'harbours away from water ' + where.harbour);
  step('places stand where they belong: every dwarf hold under a mountain (uplift ' + Math.min(...where.dwarf) + '+), elf villages in the old forest (' + where.elf.filter((w) => w > 0.5).length + ' of ' + where.elf.length + '), every harbour on the water');

  // towns, castles and holds are composed of many buildings
  const built = [];
  for (const k of ['town', 'walledtown', 'stronghold', 'abbey', 'dwarfhold', 'elfvillage', 'shire', 'harbour']) {
    const s = await ev((k) => { const g = AS.game, c = g.playerFaction.townPos; const s = g.sites.filter((q) => q.kind === k).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; return { id: s.id, name: s.name, x: s.x, y: s.y }; }, k);
    await tp(s.x, s.y + 200, 140);
    await page.waitForFunction((id) => AS.game.byId.get(id).loaded, s.id, { timeout: 30000 });
    const nb = await ev((id) => { const s = AS.game.byId.get(id); return { b: s.structures.length, gens: new Set(s.structures.map((b) => b.gen)).size }; }, s.id);
    built.push({ k, ...nb });
    ok(nb.b >= 6 && nb.gens >= 3, k + ' ' + s.name + ' ' + JSON.stringify(nb));
  }
  step('settlements are composed of many buildings: ' + built.map((q) => q.k + ' ' + q.b + ' (' + q.gens + ' kinds)').join(', '));

  // flying low over a landmark discovers it and pays the finder
  const lm = await ev(() => { const g = AS.game, c = g.playerFaction.townPos; const s = g.sites.filter((q) => q.def.landmark && !q.found).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; return { id: s.id, name: s.name, x: s.x, y: s.y, gold: g.playerFaction.gold }; });
  await tp(lm.x, lm.y + 600, 300);
  await page.waitForTimeout(1500);
  const high = await ev((id) => AS.game.byId.get(id).found, lm.id);
  await tp(lm.x, lm.y + 100, 60);
  await page.waitForFunction((id) => AS.game.byId.get(id).found, lm.id, { timeout: 15000 });
  const paid = await ev(() => AS.game.playerFaction.gold);
  ok(!high && paid > lm.gold, 'landmark ' + high + ' ' + lm.gold + ' → ' + paid);
  step(lm.name + ' is found by flying low over it (not from high above), and pays a finder\'s reward of ' + (paid - lm.gold) + ' gold');

  // a relic from a hoard raises an upgrade for free
  const relic = await ev(() => { const g = AS.game, F = g.playerFaction, s = g.sites.find((q) => q.kind === 'dungeon'), before = JSON.stringify(F.upgrades), gold = F.gold; s.relic(F); return { before, after: JSON.stringify(F.upgrades), spent: gold - F.gold, chance: s.def.relic }; });
  ok(relic.before !== relic.after && relic.spent === 0 && relic.chance > 0, 'relic ' + JSON.stringify(relic));
  step('a relic found in a dungeon hoard (chance ' + Math.round(relic.chance * 100) + '%) raises an upgrade for free (' + relic.after + ')');
  await tp(s0.x, s0.y, 120);
  await ev(() => AS.Debug.hold(false));

  // a long sprint across the land
  await page.waitForTimeout(2000);
  await ev(() => { const g = AS.game, d = g.player; g.godMode = true; const tx = 150000, ty = d.y - 20000; d.pilot = { read: (dd, inp) => { inp.steer = { x: tx, y: ty + dd.z }; inp.throttle = 1; inp.sprint = true; inp.turn = 0; inp.dive = false; inp.aimX = tx; inp.aimY = ty; dd.energy = dd.maxEnergy; } }; });
  const a = await stats();
  let maxTroops = 0, maxHeap = 0, maxBuild = 0;
  for (let i = 0; i < 9; i++) { await page.waitForTimeout(10000); const q = await stats(); maxTroops = Math.max(maxTroops, q.troops); maxHeap = Math.max(maxHeap, q.heap); maxBuild = Math.max(maxBuild, q.buildings); }
  const z = await stats();
  const flown = Math.hypot(z.x - a.x, z.y - a.y);
  ok(flown > 20000, 'flew ' + flown);
  ok(z.made > a.made + 10 && z.dropped > 5 && z.built > a.built && z.packed > 0, 'streaming ' + JSON.stringify(z));
  step('a 90-second sprint covers ' + (flown / 1000).toFixed(1) + ' km: ' + (z.made - a.made) + ' areas made ahead, ' + z.dropped + ' packed away behind; ' + (z.built - a.built) + ' places built, ' + z.packed + ' packed');
  const byPage = z.pageTiles - a.pageTiles, byWorkers = z.workerTiles - a.workerTiles;
  ok(byWorkers > 20 && byPage <= 6, 'tiles page ' + byPage + ' workers ' + byWorkers);
  step('ground tiles came from the terrain workers (' + byWorkers + '); the page built ' + byPage + ' itself');
  ok(z.tac > a.tac + 20, 'war map ' + a.tac + ' → ' + z.tac);
  step('the war map filled in as land came into view (' + (z.tac - a.tac) + ' blocks)');
  ok(maxTroops < 500 && maxBuild < 400 && maxHeap < 300 && z.tiles <= 260, 'bounded troops ' + maxTroops + ' buildings ' + maxBuild + ' heap ' + maxHeap + ' tiles ' + z.tiles);
  step('memory and entities stay bounded (at most ' + maxTroops + ' troops, ' + maxBuild + ' buildings, ' + maxHeap + ' MB, ' + z.tiles + ' tiles held)');

  // a place's beaten guards stay beaten after it is packed away and built again
  const site = await ev(() => { const g = AS.game, p = g.player; const s = g.sites.filter((q) => q.spec.guard && !q.def.treasure).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; return { id: s.id, name: s.name, x: s.x, y: s.y }; });
  await ev(() => { AS.game.player.pilot = new AS.HumanPilot(); });
  await tp(site.x, site.y + 120, 120);
  await page.waitForFunction((id) => { const s = AS.game.byId.get(id); return s.loaded && s.guards.length > 0; }, site.id, { timeout: 30000 });
  await ev((id) => { const g = AS.game, s = g.byId.get(id); for (const u of s.guards) u.takeDamage(1e6, 'fire', g.player); }, site.id);
  await page.waitForTimeout(600);
  await tp(site.x + 14000, site.y, 120);
  await page.waitForFunction((id) => !AS.game.byId.get(id).loaded, site.id, { timeout: 30000 });
  const packed = await ev((id) => { const s = AS.game.byId.get(id); return { guarded: s.guarded(), left: JSON.stringify(s.guardLeft) }; }, site.id);
  await tp(site.x, site.y + 120, 120);
  await page.waitForFunction((id) => AS.game.byId.get(id).loaded, site.id, { timeout: 30000 });
  const back = await ev((id) => { const s = AS.game.byId.get(id); return { guarded: s.guarded(), guards: s.guards.length, structures: s.structures.length }; }, site.id);
  ok(!packed.guarded && !back.guarded && back.guards === 0 && back.structures > 0, 'persist ' + JSON.stringify(packed) + ' ' + JSON.stringify(back));
  step(site.name + ': its guards, beaten, stay beaten after the place is packed away and built again (' + back.structures + ' buildings rebuilt)');

  // an area built again is the same
  const cellOf = () => ev(() => { const g = AS.game, p = g.player, S = g.stream, C = S.cells.get(AS.Stream.key(Math.floor(p.x / AS.Stream.CELL), Math.floor(p.y / AS.Stream.CELL))); return C && C.live ? { k: AS.Stream.key(C.cx, C.cy), props: (C.props || []).map((q) => q.gen + '@' + Math.round(q.x) + ',' + Math.round(q.y)).sort().join(';') } : null; });
  const c1 = await cellOf();
  ok(c1, 'live area');
  await tp(site.x + 16000, site.y, 120);
  await page.waitForFunction((k) => !AS.game.stream.cells.get(k).live, c1.k, { timeout: 30000 });
  await tp(site.x, site.y + 120, 120);
  await page.waitForFunction((k) => AS.game.stream.cells.get(k).live, c1.k, { timeout: 30000 });
  const c2 = await cellOf();
  ok(c2 && c2.props === c1.props, 'area differs');
  step('an area packed away and made again is the same (' + (c1.props ? c1.props.split(';').length : 0) + ' props in the same places)');

  // long routes go by road, quickly, never through water
  const routes = await ev(() => { const g = AS.game, F = g.playerFaction, from = [F.townPos.x, F.townPos.y + 200], out = [];
    const sites = g.sites.map((s) => [Math.hypot(s.x - from[0], s.y - from[1]), s]).sort((a, b) => a[0] - b[0]);
    for (const k of [20, 60, 120]) {
      const [d, s] = sites[k]; g.nav.cache.clear();
      // the first route through an area builds its walking-grid tiles (kept); measured again warm
      const c0 = performance.now(); AS.Nav.path(g, from[0], from[1], s.x, s.y + 60); const cold = performance.now() - c0;
      g.nav.cache.clear();
      const t0 = performance.now(), path = AS.Nav.path(g, from[0], from[1], s.x, s.y + 60), ms = performance.now() - t0;
      let wet = 0, L = 0;
      for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], m = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40); L += Math.hypot(b[0] - a[0], b[1] - a[1]); for (let q = 1; q <= m; q++) if (!g.terrain.groundPassable(a[0] + (b[0] - a[0]) * q / m, a[1] + (b[1] - a[1]) * q / m)) wet++; }
      out.push({ d: Math.round(d), L: Math.round(L), ms: +ms.toFixed(1), cold: +cold.toFixed(0), wet, unreachable: !!path.unreachable });
    }
    return out; });
  for (const r of routes) ok(!r.unreachable && r.wet === 0 && r.ms < 60 && r.cold < 400 && r.L >= r.d * 0.98, 'route ' + JSON.stringify(r));
  step('long routes are found by road in ' + routes.map((r) => r.ms + ' ms').join(', ') + ' (' + routes.map((r) => (r.d / 1000).toFixed(0) + ' km away').join(', ') + '; the first through an unvisited area ' + routes[0].cold + ' ms), none through water');

  // soldiers walk a road route
  const march = await ev(() => { const g = AS.game, F = g.playerFaction, p = F.townPos;
    const s = g.sites.filter((q) => { const d = Math.hypot(q.x - p.x, q.y - p.y); return d > 6000 && d < 9000; })[0];
    // (mustered outside the castle gate)
    const gx = p.x + Math.cos(-0.6) * 700, gy = p.y + Math.sin(-0.6) * 700;
    const t = []; for (let i = 0; i < 4; i++) { const u = new AS.Troop(g, 'soldier', F.key, gx + i * 14, gy, { gen: F.def.troops.soldier.gen }); g.troops.push(u); F.troops.push(u); u.marchTo(s.x, s.y + 80); t.push(u); }
    window.__march = t; AS.Debug.hold(false); AS.Debug.tp(p.x + 300, p.y + 300, 120); AS.Debug.hold(true);
    return { name: s.name, d: Math.round(Math.hypot(s.x - gx, s.y - gy)), pts: t[0].path.length, sx: s.x, sy: s.y }; });
  await page.waitForTimeout(20000);
  const walked = await ev((m) => { const t = window.__march; return t.map((u) => Math.round(Math.hypot(m.sx - u.x, m.sy - u.y))); }, march);
  ok(march.pts > 3 && walked.every((d) => d < march.d - 400), 'march ' + JSON.stringify(march) + ' ' + walked);
  step('soldiers set off along the road to ' + march.name + ' (' + (march.d / 1000).toFixed(1) + ' km; ' + march.pts + ' waypoints; ' + Math.round(march.d - Math.max(...walked)) + '+ units walked in 20 s)');

  // far wildlife sleeps
  const sleep = await ev(() => { const L = AS.game.life; return { asleep: L.animals.filter((o) => o.sleep).length + L.people.filter((o) => o.sleep).length, all: L.animals.length + L.people.length }; });
  ok(sleep.asleep > 0, 'sleep ' + JSON.stringify(sleep));
  step('wildlife and villagers far from the dragon sleep (' + sleep.asleep + ' of ' + sleep.all + ')');

  ok(!errors.length, 'page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + n + ' steps passed, no page errors');
} catch (e) {
  console.log('FAIL after ' + n + ' steps: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/hugeworld_fail.png' }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
