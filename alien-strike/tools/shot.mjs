import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, w='1440', h='810', wait='300'] = process.argv;
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs=[]; p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); }); p.on('pageerror', e => errs.push('pageerror: '+e.message));
await p.goto(url); await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
console.log(errs.join('\n')||'no errors');
await b.close();
