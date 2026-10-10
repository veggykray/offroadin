/* Real browser verifies the existing mixer, recorded variation and warning UI. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto((process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html?map=sundered&god=1');
 await page.waitForFunction(()=>window.AS?.App?.state==='play',null,{timeout:45000,polling:100});
 await page.keyboard.press('KeyM');await page.keyboard.press('KeyM');
 await page.waitForFunction(()=>AS.Audio.ready&&AS.RecordedAudio.has('eat_sheep'),null,{timeout:30000,polling:100});
 const result=await page.evaluate(async()=>{
  const A=AS.Audio,V=AS.Voices,g=AS.game;AS.Settings.subtitles=true; // (subtitles are off by default)
  await Promise.all(A.recordedLoads);
  const keys=[];for(let i=0;i<8;i++)keys.push(A.recordedPick('eat_sheep'));
  const src=A.sfx('eat_cattle',{vol:0});
  const duration=src?.buffer.duration;src?.stop();
  const ctx=A.ctx;
  V.stop();V.homeLevel=0;V.homeLastThreat=-Infinity;V.eventNext={};V.homeWarning('home_serious',2);
  const serious=V.queue[0];V.speak(serious);V.queue=[];
  V.homeWarning('home_critical',3);
  const critical=V.queue[0]?.event,expectedSubtitle=V.queue[0]?.text,interrupted=!V.speaking;
  V.update(.016,g);
  for(let i=0;i<120&&!V.recordedSource;i++)await new Promise(resolve=>setTimeout(resolve,25));
  const bubble=V.bubbles.find(b=>b.d===g.player)?.text;
  const recordedVoice=!!V.recordedSource,unalteredRate=V.recordedSource?.playbackRate.value;
  V.stop();
  V.scanAt=1e9;V.quietUntil=1e9;
  const castPlayed=[];
  for(const [key,cast] of Object.entries(AS.Data.recordings.cast.characters)){
   const line=AS.Data.dialogue.find(j=>j.character===key&&j.event==='travel'),dragon=g.factions[key.split('_')[0]].dragon;
   dragon.x=g.player.x+100;dragon.y=g.player.y;dragon.down=0;dragon.hidden=false;
   const q=V.enqueueLine(line,dragon,{});V.queue=[];V.speak(q);
   for(let i=0;i<160&&!V.recordedSource;i++)await new Promise(resolve=>setTimeout(resolve,25));
   castPlayed.push({character:key,voice_id:cast.voice_id,recorded:!!V.recordedSource,rate:V.recordedSource?.playbackRate.value});
   V.stop();
  }
  return {sharedContext:A.ctx===ctx,duration,keys,critical,interrupted,bubble,expectedSubtitle,recordedVoice,unalteredRate,castPlayed,loaded:Object.values(AS.RecordedAudio.bank).flat().filter(t=>A.buffers[t.bufferKey]).length,total:Object.values(AS.RecordedAudio.bank).flat().length};
 });
 assert.equal(result.sharedContext,true);assert.ok(result.duration>.8&&result.duration<1.2,'Rapid meal length');assert.equal(result.loaded,result.total,'Every recorded SFX decoded');
 assert.ok(result.keys.every((key,i)=>i===0||key!==result.keys[i-1]),'No immediately repeated SFX variant');assert.equal(result.critical,'home_critical');assert.equal(result.interrupted,true);assert.equal(result.bubble,result.expectedSubtitle,'Warning subtitle matches the selected dialogue variant');assert.equal(result.recordedVoice,true,'Approved recorded dialogue plays through WebAudio');assert.equal(result.unalteredRate,1,'No voice pitch or speed shifting');assert.deepEqual(errors,[]);
 assert.equal(result.castPlayed.length,8);assert.equal(new Set(result.castPlayed.map(c=>c.voice_id)).size,8);assert.ok(result.castPlayed.every(c=>c.recorded&&c.rate===1),'Every chosen character plays recorded speech at its original rate');
 console.log('PASS recorded audio browser integration: '+JSON.stringify(result));
}finally{await browser.close()}
