import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, wait='3000'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
p.on('console', m => console.log(m.type()+': '+m.text())); p.on('pageerror', e => console.log('pageerror: '+e.message));
const client = await p.context().newCDPSession(p);
await client.send('Profiler.enable'); await client.send('Profiler.setSamplingInterval', {interval: 100}); await client.send('Profiler.start');
await p.goto(url); await p.waitForTimeout(+wait);
const {profile} = await client.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas; const idIdx = new Map(profile.nodes.map((n,i)=>[n.id,n]));
const counts = new Map(); for (const s of profile.samples) counts.set(s,(counts.get(s)||0)+1);
for (const [id,c] of counts) { const n=idIdx.get(id); const k=n.callFrame.functionName+' '+(n.callFrame.url.split('/').pop())+':'+n.callFrame.lineNumber; self.set(k,(self.get(k)||0)+c); }
const tot=[...self.values()].reduce((a,b)=>a+b,0);
console.log([...self.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>(v/tot*100).toFixed(1)+'% '+k).join('\n'));
await b.close();
