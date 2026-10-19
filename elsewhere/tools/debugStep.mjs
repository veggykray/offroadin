// Focused reproduction of the harness steps that time out: seep tap and the cat's trip to the lift.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { makeDriver } from './drive.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const W = +(args.w || 780), H = +(args.h || 360);
const { url, close } = await serve(args.dist || 'dist');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: !!args.mobile, isMobile: !!args.mobile });
const d = makeDriver(page, { mobile: !!args.mobile, W, H, debug: true });
const say = async (l) => { const s = await d.snap(); console.log(l, JSON.stringify({ sel: s.selected, dog: s.dog, cat: s.cat, hint: s.hint })); };
await page.goto(url + '/index.html'); await page.waitForFunction(() => !!window.__elsewhere); await page.click('#play'); await page.waitForTimeout(args.arch ? 1200 : 4000);
if (args.arch) {
  await page.waitForTimeout(-2800 + 4000 > 0 ? 0 : 0);
  await d.portrait('dog'); console.log('arch west ->', await d.tapWorld(-7.6, 3.3)); await d.waitFor(() => window.__elsewhere.game.dog.motion === 'idle' && window.__elsewhere.game.dog.x < -7, 20000, 'arch west'); await say('arch west');
  console.log('arch east ->', await d.tapWorld(-3.9, 3.3)); await d.waitFor(() => window.__elsewhere.game.dog.motion === 'idle' && window.__elsewhere.game.dog.x > -4.5, 20000, 'arch east'); await say('arch east');
}
await d.portrait('dog'); await d.tapActor('dog'); await page.waitForTimeout(1500); await say('after sniff');
console.log('tapThing seep ->', await d.tapThing('seep')); await say('after seep tap'); await page.waitForTimeout(2000); await say('+2s');
console.log('seep open:', await d.waitFor(() => window.__elsewhere.snapshot().cyan.seepOpen, 30000, 'seep')); await say('seep');
await page.screenshot({ path: `tools/out/dbg_${W}_seep.png` });
console.log('tapThing CV-01 ->', await d.tapThing('CV-01')); console.log('bridge:', await d.waitFor(() => window.__elsewhere.snapshot().cyan.bridgeSolid, 40000, 'bridge'));
await d.portrait('cat'); await say('cat selected');
console.log('tapWorld 6,0.2 ->', await d.tapWorld(6, 0.2)); await say('after tapWorld'); await page.waitForTimeout(1500); await say('+1.5s');
console.log('cat x>4:', await d.waitFor(() => window.__elsewhere.game.cat.x > 4, 25000, 'cat x>4')); await say('cat');
await page.screenshot({ path: `tools/out/dbg_${W}_cat.png` });
console.log('tapThing liftBase ->', await d.tapThing('liftBase')); console.log('cat up:', await d.waitFor(() => window.__elsewhere.snapshot().cat.floor === 1, 40000, 'cat up')); await say('end');
await browser.close(); close();
