// usage: STEPS='[...]' node tools/run.mjs <url> <outprefix> [w] [h]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, w="1440", h="810"] = process.argv;
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs=[]; p.on('console', m => { const t=m.type(); if (t==='error'||t==='warning') errs.push(t+': '+m.text()); else if (process.env.LOG) console.log('log: '+m.text()); }); p.on('pageerror', e => errs.push('pageerror: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
p.on('requestfailed', r => errs.push('requestfailed: '+r.url()));
await p.goto(url); await p.waitForTimeout(+(process.env.WAIT||1500));
const steps = JSON.parse(process.env.STEPS || '[]');
for (const s of steps) {
  if (s.key) { await p.keyboard.down(s.key); await p.waitForTimeout(s.ms||300); await p.keyboard.up(s.key); }
  if (s.keys) { for (const k of s.keys) await p.keyboard.down(k); await p.waitForTimeout(s.ms||300); for (const k of s.keys) await p.keyboard.up(k); }
  if (s.mouse) { await p.mouse.move(s.mouse[0], s.mouse[1]); }
  if (s.click) { await p.mouse.move(s.click[0], s.click[1]); await p.mouse.down({button: s.button||'left'}); await p.waitForTimeout(s.ms||200); await p.mouse.up({button: s.button||'left'}); }
  if (s.sel) { await p.click(s.sel); }
  if (s.text) { await p.getByText(s.text, { exact: false }).first().click(); }
  if (s.eval) { try { const r = await p.evaluate(s.eval); if (r!==undefined) console.log("eval:", JSON.stringify(r)); } catch (e) { console.log("evalerr:", e.message.split("\n")[0]); } }
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.shot) await p.screenshot({ path: out + '_' + (s.shot) + '.png' });
}
if (!process.env.NOFINAL) await p.screenshot({ path: out + '_final.png' });
console.log(errs.slice(0,40).join('\n')||'no errors');
await b.close();
