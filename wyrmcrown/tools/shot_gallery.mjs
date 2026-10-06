// WYRMCROWN — screenshot the model gallery.
// usage: node wyrmcrown/tools/shot_gallery.mjs <files> <out.png> [group] [crop: x,y,w,h]
//   files: comma list of model files under wyrmcrown/src/gfx (e.g. models_human.js)
// Needs the repo root served over HTTP on 127.0.0.1:8766
//   (python3 -m http.server 8766 --bind 127.0.0.1   from the repo root).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, files, out, group = '', crop = ''] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await p.goto('http://127.0.0.1:8766/wyrmcrown/tools/gallery.html?files=' + encodeURIComponent(files) + (group ? '&group=' + encodeURIComponent(group) : ''));
await p.waitForFunction(() => window.galleryReady === true, null, { timeout: 120000 });
const opts = { path: out, fullPage: !crop };
if (crop) { const [x, y, w, h] = crop.split(',').map(Number); opts.clip = { x, y, width: w, height: h }; }
await p.screenshot(opts);
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
