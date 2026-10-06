// WYRMCROWN — fast-forward an all-AI war (no rendering) and log how each realm
// fares: gold, buildings, troops, sites, ward, eliminations, plus any errors.
// usage: node wyrmcrown/tools/sim.mjs [minutes=12] [difficulty=normal] [seedRuns=1]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, mins = '12', diff = 'normal', runs = '1'] = process.argv;
const b = await chromium.launch();
for (let run = 0; run < +runs; run++) {
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8766/wyrmcrown/index.html?map=sundered&demo=1');
  await p.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 30000 });
  const log = await p.evaluate(async ([mins, diff]) => {
    const g = AS.game;
    g.diff = AS.Data.difficulty[diff] || g.diff;
    AS.App.state = 'sim'; // the main loop leaves the realm alone
    const out = [], dt = 1 / 30, total = mins * 60;
    const ev = { downs: {}, lost: {}, wardsLost: {}, captures: 0 };
    const od = g.onDragonDown.bind(g);
    g.onDragonDown = (d, src) => { ev.downs[d.fk] = (ev.downs[d.fk] || 0) + 1; return od(d, src); };
    for (const F of g.factionList) { const ol = F.onBuildingLost.bind(F); F.onBuildingLost = (b, src) => { if (b.kind !== 'house' || true) ev.lost[F.key] = (ev.lost[F.key] || 0) + 1; if (b.kind === 'wardstone') ev.wardsLost[F.key] = (ev.wardsLost[F.key] || 0) + 1; return ol(b, src); }; }
    const snap = () => ({ t: Math.round(g.time), goals: g.factionList.map((F) => F.lord ? F.lord.goal.type : '-').join(','), f: g.factionList.map((F) => [F.key, Math.round(F.gold), F.buildings.filter((b) => b.alive).length, F.troopCount(), F.sitesOwned, F.wardStrength(), F.keepLevel, F.dragon.down > 0 ? 'D' : Math.round(F.dragon.hp), F.eliminated ? 'X' : '', Math.round(F.income)].join(' ')) });
    let next = 60;
    while (g.time < total && !g.ended) {
      for (let i = 0; i < 300 && g.time < total && !g.ended; i++) g.update(dt);
      if (g.time >= next) { out.push(snap()); next += 60; }
      await new Promise((r) => setTimeout(r, 0));
    }
    out.push(snap());
    out.push(ev);
    out.push({ ended: !!g.ended, result: g.result && (g.result.text || g.result.winner), troops: g.troops.length, buildings: g.buildings.length, life: AS.Life.count(g), particles: AS.Particles.pool.active.length, proj: AS.Proj.pool.active.length });
    return out;
  }, [+mins, diff]);
  console.log('--- run', run + 1, '(key gold buildings troops sites ward keepLv dragonHp elim income/min)');
  for (const l of log) console.log(JSON.stringify(l));
  console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'no errors');
  await p.close();
}
await b.close();
