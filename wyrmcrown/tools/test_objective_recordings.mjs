/* Real capture/loot callbacks, approved voice playback and matching subtitles. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const results=[];
try{
 for(const faction of ['human','elf','ice','undead']){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:8766')+'/wyrmcrown/index.html?map=sundered&god=1&faction='+faction);
  await page.waitForFunction(()=>window.AS?.App?.state==='play',null,{timeout:90000,polling:100});
  await page.keyboard.press('KeyM');await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>AS.Audio.ready,null,{timeout:30000,polling:100});
  const kinds=faction==='human'?['goldmine','village','cave','ruins']:['goldmine','village'];
  for(const kind of kinds){
   const result=await page.evaluate(async kind=>{AS.Settings.subtitles=true;
    const V=AS.Voices,g=AS.game,s=g.sites.find(s=>s.kind===kind);
    if(!s)throw Error('Missing map objective: '+kind);
    V.start(g);V.scanAt=Infinity;V.quietUntil=Infinity;V.homeLastThreat=-Infinity;
    g.player.down=0;g.player.hidden=false;
    s.setOwner(null,true);
    if(s.def.treasure)s.loot(g.playerKey);else s.setOwner(g.playerKey);
    V.update(.016,g);
    const expected=V.speaking?.q;
    for(let i=0;i<200&&!V.recordedSource;i++)await new Promise(r=>setTimeout(r,25));
    const bubble=V.bubbles.find(b=>b.d===g.player),q=V.speaking?.q;
    const take=AS.Data.recordings.takes.filter(t=>t.id===q?.lineId).at(-1);
    const result={faction:g.playerKey,kind,event:q?.event,text:q?.text,subtitle:bubble?.text,
      recorded:!!V.recordedSource,rate:V.recordedSource?.playbackRate.value,lineId:q?.lineId,
      selectedId:expected?.lineId,voiceId:take?.voice_id,
      castVoiceId:AS.Data.recordings.cast.characters[g.playerKey+'_'+q?.role]?.voice_id};
    V.stop();return result;
   },kind);
   assert.equal(result.event,'capture_reward_'+kind);assert.equal(result.recorded,true);
   assert.equal(result.rate,1);assert.equal(result.subtitle,result.text);
   assert.equal(result.lineId,result.selectedId);assert.equal(result.voiceId,result.castVoiceId);
   results.push(result);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 assert.equal(new Set(results.map(r=>r.voiceId)).size,8);
 console.log('PASS objective recordings: '+JSON.stringify(results));
}finally{await browser.close()}
