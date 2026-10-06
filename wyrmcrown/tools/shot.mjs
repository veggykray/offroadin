// WYRMCROWN — screenshot any page under the served repo root.
// usage: node wyrmcrown/tools/shot.mjs <url-path> <out.png> [w] [h] [waitMs] [evalJS]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, path, out, w = '1500', h = '1000', waitMs = '1500', js = ''] = process.argv;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); else if (process.env.LOG) console.log('log:', m.text()); });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await p.goto('http://127.0.0.1:8766/' + path.replace(/^\//, ''));
await p.waitForTimeout(+waitMs);
if (js) { try { const r = await p.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r)); } catch (e) { console.log('evalerr:', e.message.split('\n')[0]); } await p.waitForTimeout(300); }
await p.screenshot({ path: out });
const uniq = [...new Set(errs)]; console.log(uniq.length ? uniq.slice(0, 12).join('\n') + (errs.length > uniq.length ? '\n(' + errs.length + ' total)' : '') : 'no errors');
await b.close();
