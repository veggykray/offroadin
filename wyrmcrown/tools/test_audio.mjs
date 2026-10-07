/* Contract tests for warning priority, banter cadence, resets and casting. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const AS={Data:{},U:{pick:a=>a[0],range:(a,b)=>(a+b)/2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},Settings:{taunts:true,voice:.9},App:{state:'play'},Audio:{voiceDuck(){}},Voices:{queue:[],bubbles:[],seq:0,
  start(g){this.g=g;this.queue=[];this.bubbles=[];this.speaking=null},stop(){this.queue=[];this.bubbles=[];this.speaking=null},update(){},speak(q){this.speaking={q}},finish(){this.speaking=null;this.calmUntil=this.g.time+5}}};
const context=vm.createContext({window:{AS},location:{protocol:'http:'},console,Math,Map,WeakSet,setTimeout,fetch(){throw Error('No network in contract tests')}});
for(const file of ['data/dialogue.js','data/recordings.js','src/audio/voices.js','src/audio/dialogue_director.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const p={fk:'human',down:0,hidden:false},g={time:0,player:p,playerKey:'human',combatLevel:0,demo:false};
const V=AS.Voices;V.start(g);
assert.equal(V.ownBanter(),false,'No banter in first 90 seconds');
g.time=100;assert.equal(V.ownBanter(),true);const opener=V.queue[0];assert.equal(V.banterUntil,340);
V.queue=[];opener.started=true;V.speaking={q:opener};V.finish();assert.equal(V.queue.length,1,'One reply follows a completed opener');
V.stop();g.time=130;assert.equal(V.ownBanter(),false,'Shared cooldown covers all exchanges');
g.time=350;V.ownBanter();assert.ok(V.pendingReply);V.homeWarning('home_serious',2);assert.equal(V.pendingReply,null,'Danger cancels an unsaid comic reply');assert.equal(V.queue[0].event,'home_serious');
const serious=V.queue[0];V.speaking={q:serious};V.queue=[];g.time=351;V.homeWarning('home_critical',3);assert.equal(V.speaking,null,'Critical warning interrupts serious warning');assert.equal(V.queue[0].event,'home_critical');
g.time=352;V.homeWarning('home_early',1);assert.equal(V.queue[0].event,'home_critical','No warning downgrade');assert.equal(V.queue.length,1);
V.stop();assert.equal(V.event('home_critical',{priority:95,cooldownKey:'home_warning'}),null,'Warnings obey cooldown at same severity');
g.time=353;assert.equal(V.event('travel'),null,'Chatter suppressed during home danger');
V.start({...g,time:0});assert.equal(V.routineUntil,15,'Restart resets routine timer');assert.equal(V.playedLines.length,0);
const pool=AS.Data.dialogue.filter(j=>j.event==='travel'&&j.character==='human_wizard');const heard=[];for(let i=0;i<pool.length;i++)heard.push(V.eventLine('travel','wizard','human').id);assert.equal(new Set(heard).size,pool.length,'Shuffled pool exhausts before repeats');
const ids=AS.Data.dialogue.map(j=>j.id);assert.equal(new Set(ids).size,ids.length,'No duplicate dialogue identifiers');
assert.ok(AS.Data.dialogue.every(j=>j.performance&&j.synthesis_text.startsWith('[')),'Every line has performance direction');
const cast=JSON.parse(fs.readFileSync(path.join(root,'audio/production/cast.json'),'utf8'));assert.equal(Object.keys(cast.characters).length,8);assert.ok(Object.values(cast.characters).every(c=>c.voice_settings&&c.model_id&&c.candidates.every(v=>v.voice_id)));
for(const take of AS.Data.recordings.takes)assert.ok(fs.existsSync(path.join(root,take.file)),'Manifest points to an actual recording: '+take.id);
console.log('PASS audio contracts: rare exchanges, reply sequencing, interrupting/escalating warnings, cooldowns, no downgrade, restarts, varied lines, eight cast records, real files.');
