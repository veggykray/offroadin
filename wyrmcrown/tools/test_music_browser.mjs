/* Actual HTML media/WebAudio playback and menu -> match -> realm transitions. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],played=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:8766')+'/wyrmcrown/index.html');
 await page.waitForSelector('#menu.show',{timeout:90000});
 await page.keyboard.press('Tab');
 await page.waitForFunction(()=>AS.Music.active?.key==='human_home'&&AS.Music.active.element.currentTime>.1,null,{timeout:90000});
 assert.equal(await page.evaluate(()=>AS.Data.music.tracks[AS.Music.active.key].source_file),'Soft Flowing Strings.wav');
 assert.equal(await page.evaluate(()=>[...document.scripts].some(s=>s.src.endsWith('/alien-strike/src/audio/music.js'))),false);
 console.log('PASS opening: Soft Flowing Strings plays; procedural music is absent.');
 await page.evaluate(()=>AS.App.startMatch('sundered',{god:true,faction:'human'}));
 await page.waitForFunction(()=>AS.App.state==='play'&&AS.Music.active?.key==='human_home',null,{timeout:90000});
 await page.evaluate(()=>AS.App.openOverlay('map'));
 for(const realm of ['human','elf','ice','undead'])for(const mode of ['home','fight']){
  await page.evaluate(([realm,mode])=>{
   AS.Music.play({realm,key:'music:'+realm});
   AS.Music.combatUntil=0;AS.Music.setIntensity(mode==='fight'?2:0);AS.Music.update();
  },[realm,mode]);
  await page.waitForFunction(key=>AS.Music.active?.key===key&&!AS.Music.active.element.paused&&AS.Music.active.element.currentTime>.1,realm+'_'+mode,{timeout:20000});
  const result=await page.evaluate(()=>({key:AS.Music.active.key,rate:AS.Music.active.element.playbackRate,duration:AS.Music.active.element.duration,file:AS.Music.active.element.currentSrc,error:AS.Music.lastError}));
  assert.equal(result.rate,1);assert.ok(result.duration>100);assert.equal(result.error,null);
  played.push(result);console.log('PASS track '+result.key+' '+result.duration.toFixed(2)+'s at rate 1.');
  await page.waitForTimeout(2800);
 }
 const loop=await page.evaluate(()=>{const M=AS.Music;window.beforeLoop=M.active;M.active.element.currentTime=M.active.element.duration-2;M.update();return M.active.key});
 await page.waitForFunction(()=>AS.Music.active!==window.beforeLoop&&!AS.Music.active.element.paused&&AS.Music.active.element.currentTime<10,null,{timeout:15000});
 assert.equal(await page.evaluate(()=>AS.Music.active.key),loop);
 console.log('PASS continuous track looping through the other media deck.');
 await page.waitForTimeout(2800);
 await page.evaluate(()=>{AS.App.closeOverlay();AS.Music.play({realm:'human',key:'music:human'});AS.Voices.event('capture_reward_goldmine',{priority:80,force:true})});
 await page.waitForFunction(()=>AS.Voices.recordedSource,null,{timeout:20000});
 await page.waitForFunction(()=>AS.Audio.musicDuck.gain.value<.65,null,{timeout:5000});
 const duck=await page.evaluate(()=>({duck:AS.Audio.musicDuck.gain.value,recordedVoice:!!AS.Voices.recordedSource,recordedMusic:!AS.Music.active.element.paused,musicBus:AS.Audio.musicBus.gain.value}));
 assert.ok(duck.duck<.8);assert.equal(duck.recordedVoice,true);assert.equal(duck.recordedMusic,true);
 await page.evaluate(()=>{AS.Voices.stop();AS.Settings.music=0;AS.Audio.setVolumes()});await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>AS.Audio.musicBus.gain.value)<.01,'Music slider mutes the supplied score');
 await page.evaluate(()=>{AS.Settings.music=.5;AS.Audio.setVolumes();AS.App.abandon()});
 await page.waitForFunction(()=>AS.Music.active?.key==='human_home'&&AS.Music.menu&&!AS.Music.active.element.paused,null,{timeout:15000});
 assert.deepEqual(errors,[]);assert.equal(new Set(played.map(t=>t.key)).size,8);
 console.log('PASS supplied soundtrack browser integration: all eight tracks, loop, voice ducking, volume slider and return to opening theme.');
}finally{await browser.close()}
