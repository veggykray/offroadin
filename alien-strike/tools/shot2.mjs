import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, w='1440', h='810', wait='300', scale='1'] = process.argv;
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
p.on('console', m => console.log(m.type()+': '+m.text())); p.on('pageerror', e => console.log('pageerror: '+e.message));
await p.goto(url); await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
