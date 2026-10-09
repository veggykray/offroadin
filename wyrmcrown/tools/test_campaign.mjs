// WYRMCROWN — the campaign in the Wide Realm, end to end in the browser.
//   title → Campaign → a new campaign → the realm with the Dragon Lord's town on
//   the isle → hire troops at the castle (R) → the army follows the dragon →
//   claim a place (leadership grows) → hire there → dawn: wages paid, recruits
//   return → unpaid troops desert → V holds the army → save → reload →
//   continue: the same progress → the Dragon Lord stays home → his fall wins
//   the campaign and frees the slot.
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_campaign.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
let n = 0;
const step = (name) => { n++; console.log('PASS ' + n + '. ' + name); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ev = (fn, a) => page.evaluate(fn, a);
const status = () => ev(() => Object.assign(AS.BigCampaign.status(AS.game), { gold: Math.round(AS.game.playerFaction.gold) }));
const inGame = () => page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play' && AS.game.bc, null, { timeout: 300000 });

try {
  await page.goto(BASE);
  await page.waitForSelector('#menu.show', { timeout: 60000 });
  await ev(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem('wyrmcrown.bigcampaign.slot' + i); });
  step('Dragon Wars starts (title menu)');
  await page.getByRole('button', { name: /^Campaign/ }).click();
  await page.waitForSelector('#bigcampaign.show');
  ok(await page.locator('.bc-slot').count() === 3, 'three slots');
  step('the Campaign menu opens with three save slots');
  await page.locator('.bc-slot').first().getByRole('button', { name: 'New campaign' }).click({ noWaitAfter: true, timeout: 120000 });
  await inGame();
  await page.waitForTimeout(1500);
  const w = await ev(() => { const g = AS.game; return { map: g.map.id, big: g.map.w, keys: g.factionList.map((F) => F.key), lord: g.bc.lord && g.bc.lord.townPos, homeR: g.bc.lord && g.bc.lord.homeR, gold: Math.round(g.playerFaction.gold), army: AS.BigCampaign.armyCount(g), fogged: Array.prototype.filter.call(g.explored, (v) => !v).length / g.explored.length }; });
  ok(w.map === 'largeworld' && w.big === 28000 && w.keys.length === 2 && w.lord.x > 22000 && w.army === 0 && w.gold < 400 && w.fogged > 0.9, 'world ' + JSON.stringify(w));
  step('the campaign starts in the Wide Realm: castle, little gold (' + w.gold + '), no army, ' + Math.round(w.fogged * 100) + '% under fog, the Dragon Lord (' + w.keys[1] + ') on the isle');

  // hire at the castle through the R panel
  await page.keyboard.press('KeyR');
  await page.waitForSelector('#hire.show');
  const g0 = await status();
  await page.locator('#hire .item').first().getByRole('button', { name: 'Hire 5' }).click();
  await page.waitForTimeout(200);
  const g1 = await status();
  ok(g1.army === 5 && g1.gold < g0.gold && g1.used > 0, 'hired ' + JSON.stringify(g1));
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => !document.querySelector('#hire.show'));
  step('R at the castle opens the hiring panel; 5 troops are hired (gold ' + g0.gold + ' → ' + g1.gold + ', leadership ' + g1.used + '/' + g1.lead + ')');

  // the army follows the dragon
  const c0 = await ev(() => AS.BigCampaign.centre(AS.game.bc.army));
  await ev(() => { AS.Debug.tp(7900, 17300, 60); AS.Debug.hold(true); });
  await page.waitForTimeout(7000);
  const c1 = await ev(() => { const g = AS.game; return Object.assign(AS.BigCampaign.centre(g.bc.army), { marching: g.bc.army.filter((u) => u.state === 'march' && u.path).length }); });
  const d0 = Math.hypot(c0.x - 7900, c0.y - 17300), d1 = Math.hypot(c1.x - 7900, c1.y - 17300);
  ok(c1.marching === 5 && d1 < d0 - 150, 'follow ' + d0.toFixed(0) + ' → ' + d1.toFixed(0) + ' marching ' + c1.marching);
  step('the army marches after the dragon (' + d0.toFixed(0) + ' → ' + d1.toFixed(0) + ' units away)');

  // claim an unguarded place that recruits
  const site = await ev(() => { const g = AS.game, F = g.playerFaction; const s = g.sites.filter((q) => !q.owner && !q.guarded() && ['village', 'watchtower'].includes(q.kind)).sort((a, b) => Math.hypot(a.x - F.townPos.x, a.y - F.townPos.y) - Math.hypot(b.x - F.townPos.x, b.y - F.townPos.y))[0]; return { id: s.id, name: s.name, x: s.x, y: s.y }; });
  await ev((s) => { AS.Debug.hold(false); AS.Debug.tp(s.x, s.y, 20); AS.Debug.hold(true); }, site);
  await page.waitForFunction((id) => AS.game.byId.get(id).owner === AS.game.playerKey, site.id, { timeout: 60000 });
  await page.waitForTimeout(800);
  const g2 = await status();
  ok(g2.lead > g1.lead, 'leadership ' + g1.lead + ' → ' + g2.lead);
  step('the dragon claims ' + site.name + ' by circling low; leadership grows (' + g1.lead + ' → ' + g2.lead + ')');
  const offer = await ev(() => { const g = AS.game, q = AS.BigCampaign.hirePlace(g); return q && { id: q.id, stock: AS.BigCampaign.stock(g, q).now }; });
  ok(offer && offer.id === site.id && Object.keys(offer.stock).length, 'offer ' + JSON.stringify(offer));
  await page.keyboard.press('KeyR');
  await page.waitForSelector('#hire.show');
  await page.locator('#hire .item').first().getByRole('button', { name: 'Hire 1' }).click();
  await page.keyboard.press('Escape');
  const g3 = await status();
  ok(g3.army === 6, 'army ' + g3.army);
  step('troops are hired at ' + site.name + ' too (' + JSON.stringify(offer.stock) + ' on offer; army ' + g3.army + ')');

  // dawn: wages, restock
  const dawn = await ev(() => { const g = AS.game, S = g.bc; const gold = g.playerFaction.gold, day = S.day, w = AS.BigCampaign.wages(g); S.clock = S.day * AS.BigCampaign.DAY - 0.01; return { gold, day, w }; });
  await page.waitForFunction((d) => AS.game.bc.day > d, dawn.day, { timeout: 20000 });
  const g4 = await status();
  ok(g4.day === dawn.day + 1 && g4.army === 6 && g4.gold <= Math.round(dawn.gold) - dawn.w + 40, 'dawn ' + JSON.stringify(g4) + ' ' + JSON.stringify(dawn));
  step('a new day dawns: wages of ' + dawn.w + ' gold are paid (day ' + dawn.day + ' → ' + g4.day + ')');
  // desertion
  const before = g4.army;
  await ev(() => { const g = AS.game, S = g.bc; g.playerFaction.gold = 4; S.clock = S.day * AS.BigCampaign.DAY - 0.01; });
  await page.waitForFunction((d) => AS.game.bc.day > d, g4.day, { timeout: 20000 });
  const g5 = await status();
  ok(g5.army < before && g5.gold >= 0, 'desertion ' + before + ' → ' + g5.army + ' gold ' + g5.gold);
  step('unpaid troops desert at dawn, the costliest first (' + before + ' → ' + g5.army + ')');
  await ev(() => { AS.game.playerFaction.gold += 300; });

  // V holds the army
  await page.keyboard.press('KeyV');
  ok((await status()).mode === 'hold', 'hold');
  await page.keyboard.press('KeyV');
  ok((await status()).mode === 'follow', 'follow');
  step('V switches the army between holding its ground and following');

  // save, reload, continue
  const pre = await ev(() => { const g = AS.game; AS.BigCampaign.save(g); const s = AS.BigCampaign.status(g); return { day: s.day, lead: s.lead, army: s.army, gold: Math.round(g.playerFaction.gold) }; });
  const own = await ev((id) => AS.game.byId.get(id).owner, site.id);
  const saved = await ev(() => JSON.parse(localStorage.getItem('wyrmcrown.bigcampaign.slot1')));
  ok(saved && saved.version === 1 && saved.sites[site.id] && saved.sites[site.id].o === own, 'saved record');
  step('the campaign is saved (' + JSON.stringify(saved).length + ' bytes)');
  await page.reload();
  await page.waitForSelector('#menu.show', { timeout: 60000 });
  await page.getByRole('button', { name: /^Campaign/ }).click();
  await page.waitForSelector('#bigcampaign.show');
  ok((await page.locator('.bc-slot').first().textContent()).includes('Day ' + pre.day), 'slot summary');
  await page.locator('.bc-slot').first().getByRole('button', { name: 'Continue' }).click({ noWaitAfter: true, timeout: 120000 });
  await inGame();
  await page.waitForTimeout(1500);
  const post = await ev((id) => { const g = AS.game, s = AS.BigCampaign.status(g); return { day: s.day, lead: s.lead, army: s.army, gold: Math.round(g.playerFaction.gold), owner: g.byId.get(id).owner, explored: Array.prototype.filter.call(g.explored, (v) => v).length }; }, site.id);
  ok(post.day === pre.day && post.lead === pre.lead && post.army === pre.army && Math.abs(post.gold - pre.gold) < 20 && post.owner === own, 'continued ' + JSON.stringify(pre) + ' vs ' + JSON.stringify(post));
  step('after a browser reload the campaign continues: day ' + post.day + ', ' + post.army + ' troops, leadership ' + post.lead + ', ' + site.name + ' still held');

  // the Dragon Lord stays on his isle
  await page.waitForTimeout(15000);
  const lord = await ev(() => { const g = AS.game, L = g.bc.lord, d = L.dragon; return { d: Math.round(Math.hypot(d.x - L.townPos.x, d.y - L.townPos.y)), goal: L.lord && L.lord.goal.type }; });
  ok(lord.d < 4600, 'lord away ' + JSON.stringify(lord));
  step('the Dragon Lord keeps to his isle (' + lord.d + ' units from his stronghold, ' + lord.goal + ')');

  // his fall wins the campaign
  await ev(() => { const g = AS.game; g.bc.lord.eliminate(g.playerFaction); });
  await page.waitForSelector('#results.show', { timeout: 60000 });
  const verdict = await page.locator('#results .verdict').textContent();
  ok(/VICTORY/.test(verdict), 'verdict ' + verdict);
  ok(await ev(() => !localStorage.getItem('wyrmcrown.bigcampaign.slot1')), 'slot cleared');
  ok(await page.getByRole('button', { name: 'Title' }).isVisible(), 'title button');
  step('breaking the Dragon Lord wins the campaign (victory screen; the slot is free again)');

  ok(!errors.length, 'page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + n + ' steps passed, no page errors');
} catch (e) {
  console.log('FAIL after ' + n + ' steps: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/campaign_fail.png' }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
