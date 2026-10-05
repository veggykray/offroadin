// usage: node tools/crop.mjs in.png out.png x y w h [scale]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, inp, out, x, y, w, h, sc = '3'] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Math.round(w * sc), height: Math.round(h * sc) } });
const data = fs.readFileSync(inp).toString('base64');
await p.setContent(`<body style="margin:0;overflow:hidden"><div style="width:${w * sc}px;height:${h * sc}px;background:url(data:image/png;base64,${data}) -${x * sc}px -${y * sc}px / ${1440 * sc}px auto no-repeat;image-rendering:auto"></div></body>`);
await p.waitForTimeout(200); await p.screenshot({ path: out }); await b.close();
