/* Soundtrack routing, asynchronous cancellation and looping contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let deferred=false,pending=[];
class Element{
 constructor(){this.paused=true;this.duration=180;this.currentTime=0;this.ended=false}
 load(){this.ended=false}
 play(){this.paused=false;return deferred?new Promise(resolve=>pending.push(resolve)):Promise.resolve()}
 pause(){this.paused=true}
}
function gain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}},connect(node){this.connectedTo=node}}}
const ctx={currentTime:0,state:'running',createGain:gain,createMediaElementSource(element){return {element,connect(node){this.connectedTo=node}}}};
const AS={Data:{},App:{state:'play'},Audio:{ctx,musicDuck:gain()}};
const context=vm.createContext({window:{AS,Audio:Element},console,Math});
for(const file of ['data/music.js','src/audio/recorded_music.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const M=AS.Music;M.attach(AS.Audio);
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
const tick=async seconds=>{ctx.currentTime+=seconds;M.update();await flush()};
const reset=async()=>{AS.App.state='play';M.stop();await tick(.5)};
assert.equal(M.out.connectedTo,AS.Audio.musicDuck,'Supplied score follows existing volume and voice ducking');
assert.equal(M.schedule,undefined,'Procedural music generator has been replaced');
assert.equal(M.decks.length,2,'Streaming uses only two media decks');
for(const deck of M.decks)assert.equal(deck.source.connectedTo,deck.gain);
for(const [key,track] of Object.entries(AS.Data.music.tracks))assert.ok(fs.existsSync(path.join(root,track.file)),key);

AS.App.state='menu';M.update();await flush();
assert.equal(M.active.key,'human_home');assert.equal(AS.Data.music.tracks[M.active.key].source_file,'Soft Flowing Strings.wav');
M.setIntensity(3);await tick(1);assert.equal(M.active.key,'human_home','AI attract-mode fights cannot replace the opening theme');

for(const fk of ['human','elf','ice','undead']){
 await reset();M.play({realm:fk,key:'music:'+fk});await flush();assert.equal(M.active.key,fk+'_home');
 await tick(3);M.setIntensity(2);M.update();await flush();assert.equal(M.active.key,fk+'_fight');
 assert.equal(M.active.element.playbackRate,1);
 M.setIntensity(0);await tick(4);assert.equal(M.active.key,fk+'_fight','Fight score holds briefly after danger');
 await tick(6);assert.equal(M.active.key,fk+'_home','Quiet restores the home theme');
 await tick(3);M.active.element.currentTime=M.active.element.duration-2;const before=M.active;
 M.update();await flush();assert.notEqual(M.active,before,'Complete track crossfades into another copy at its end');
 assert.equal(M.active.key,fk+'_home');assert.equal(M.active.element.currentTime,0);
 await tick(3);assert.equal(before.element.paused,true,'Retired loop deck stops');
}

await reset();M.play({realm:'ice',key:'music:ice'});await flush();await tick(3);
M.setIntensity(3);M.update();await flush();await tick(3);M.stinger('victory');await flush();
assert.equal(M.active.key,'ice_home');M.setIntensity(3);await tick(12);assert.equal(M.active.key,'ice_home','Ending cannot resume the old battle score');
AS.App.state='paused';M.update();assert.equal(M.out.gain.value,.3,'Pause softens music');AS.App.state='play';M.update();assert.equal(M.out.gain.value,.9);

// A pending media play must not resurrect music after stop or a new selection.
await reset();deferred=true;M.play({realm:'undead',key:'music:undead'});
const old=M.loading.deck;M.stop();pending.shift()();await flush();assert.equal(M.active,null);assert.equal(old.element.paused,true);
M.play({realm:'elf',key:'music:elf'});const first=pending.shift();
M.play({realm:'human',key:'music:human'});const second=pending.shift();first();await flush();assert.equal(M.active,null);
second();await flush();assert.equal(M.active.key,'human_home');deferred=false;

await reset();ctx.state='suspended';M.play({realm:'undead',key:'music:undead'});assert.equal(M.loading,null);
ctx.state='running';M.update();await flush();assert.equal(M.active.key,'undead_home','First user gesture starts deferred music');
AS.App.state='menu';await tick(3);assert.equal(M.active.key,'human_home','Returning to menus restores Soft Flowing Strings');
console.log('PASS soundtrack: eight real assets, opening theme, four realm pairs, combat hold, loop crossfades, results, pause, media-load cancellation and late audio unlock.');
