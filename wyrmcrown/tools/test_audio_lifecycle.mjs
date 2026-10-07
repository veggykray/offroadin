/* Recorded audio must survive real game lifecycle and the newer flight model. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
try {
  await page.goto((process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html?map=sundered&god=1');
  await page.waitForFunction(() => window.AS?.App.state === 'play', null, { timeout: 45000 });
  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => AS.Audio.ready && AS.RecordedAudio.has('eat_sheep'), null, { timeout: 30000 });
  const result = await page.evaluate(async () => {
    const A = AS.Audio, V = AS.Voices, g = AS.game, p = g.player;
    await Promise.all(A.recordedLoads);
    const meals = ['eat_sheep', 'eat_cattle', 'eat_goat_deer', 'eat_large'].map(event => {
      const source = A.sfx(event, { vol: 0, rate: .7 });
      const info = { event, duration: source.buffer.duration, rate: source.playbackRate.value };
      source.stop(); return info;
    });
    const loops = ['breath_fire', 'breath_magic', 'breath_frost', 'breath_necro'].map(event => {
      A.startLoop('test:' + event, event, .01);
      const id = A.loops['test:' + event]?.id;
      A.stopLoop('test:' + event); return { event, id };
    });
    // Simulate a held breath started before its recorded asset finished loading.
    const take = AS.RecordedAudio.bank.breath_fire[0], buffer = A.buffers[take.bufferKey];
    delete A.buffers[take.bufferKey];
    A.startLoop('test:late', 'breath_fire', .01);
    const fallbackId = A.loops['test:late']?.id;
    A.buffers[take.bufferKey] = buffer;
    A.loopParam('test:late', 1, .04);
    const upgradedId = A.loops['test:late']?.id;
    A.stopLoop('test:late');
    V.stop(); V.scanAt = 1e9; V.quietUntil = 1e9;
    const line = AS.Data.dialogue.find(j => j.character === p.fk + '_wizard' && j.event === 'travel');
    async function speech() {
      const q = V.enqueueLine(line, p, {}); V.queue = []; V.speak(q);
      for (let i = 0; i < 160 && !V.recordedSource; i++) await new Promise(r => setTimeout(r, 25));
      if (!V.recordedSource) throw Error('Recorded speech did not start');
    }
    await speech();
    AS.App.openOverlay('map');
    const overlayStopsVoice = !V.recordedSource && !V.speaking;
    AS.App.closeOverlay();
    await speech();
    AS.App.pause();
    const pauseStopsVoice = !V.recordedSource && !V.speaking;
    AS.App.resume();
    await speech();
    AS.Settings.taunts = false; V.update(0, g);
    const muteStopsVoice = !V.recordedSource && !V.speaking;
    AS.Settings.taunts = true;
    p.landed = false; p.landing = false; p.loop = null; p.loopCd = 0; p.energy = p.maxEnergy; p.down = 0;
    const loopStillWorks = p.startLoop();
    const prey = g.life.animals.find(a => a.alive && !a.A.nosnatch);
    p.pilot.startHunt(p, prey);
    const huntingStillPresent = p.pilot.quarry.o === prey && p.preyWant === prey;
    p.pilot.stopHunt(p);
    V.stop();
    return { meals, loops, fallbackId, upgradedId, overlayStopsVoice, pauseStopsVoice, muteStopsVoice, loopStillWorks, huntingStillPresent };
  });
  assert.ok(result.meals.every(m => Math.abs(m.duration - .9) < .01 && m.rate === 1), 'Every prey meal fits its animation without speed shifting');
  assert.ok(result.loops.every(l => l.id?.startsWith('recorded:')), 'Each faction has its recorded breath loop');
  assert.equal(result.fallbackId, 'breath_fire');
  assert.ok(result.upgradedId?.startsWith('recorded:'), 'A held breath upgrades after its recording loads');
  for (const key of ['overlayStopsVoice', 'pauseStopsVoice', 'muteStopsVoice', 'loopStillWorks', 'huntingStillPresent']) assert.equal(result[key], true, key);
  assert.deepEqual(errors, []);
  console.log('PASS audio lifecycle: ' + JSON.stringify(result));
} finally {
  await browser.close();
}
