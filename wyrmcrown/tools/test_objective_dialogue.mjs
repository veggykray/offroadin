/* Exercise real capture/loot hooks, every faction, and warning-safe scheduling. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const AS={Data:{},Settings:{taunts:true},App:{state:'play'},
 U:{C:{},TAU:Math.PI*2,pick:a=>a[0],range:(a,b)=>(a+b)/2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},
 Audio:{sfx(){},voiceDuck(){}},Particles:{spawn(){}},
 Pickups:{coins(g,x,y,value){g.coinDrops.push(value)}},
 Troop:class{constructor(g,role,fk){this.role=role;this.team=fk;this.alive=true}takeDamage(){this.alive=false}},
 Pickup:class{constructor(g,kind){this.kind=kind}},
};
const context=vm.createContext({window:{AS},location:{protocol:'http:'},console,Math,Map,WeakSet,setTimeout});
for(const file of ['data/sites.js','data/dialogue.js','data/recordings.js','src/audio/voices.js','src/audio/dialogue_director.js','src/game/sites.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const V=AS.Voices,played=[];
V.speak=function(q){q.started=true;played.push(q);this.speaking={q,until:this.g.time+10}};
function game(fk='human'){
 const factions=Object.fromEntries(['human','elf','ice','undead'].map(key=>[key,{key,sitesOwned:0,troops:[],def:{short:key,color:'#fff',troops:{soldier:{gen:'soldier'},archer:{gen:'archer'}}}}]));
 const p={fk,team:fk,down:0,hidden:false,x:0,y:0,stats:{captures:0}};
 const g={time:0,state:'play',player:p,playerKey:fk,factions,dragons:[p],pickups:[],troops:[],life:{animals:[],people:[]},stats:{captured:0},coinDrops:[],news(){},msg(){}};
 V.start(g);V.scanAt=Infinity;V.quietUntil=Infinity;played.length=0;
 return g;
}
let serial=0;
function site(g,kind){
 return Object.assign(Object.create(AS.Site.prototype),{g,id:'test_'+serial++,kind,name:kind,def:AS.Data.sites[kind],capR:AS.Data.sites[kind].capR,x:0,y:0,owner:null,controller:null,control:0,garrison:[],structures:[],stock:0,looted:false});
}
const rewardJobs=AS.Data.dialogue.filter(j=>j.event.startsWith('capture_reward_'));
assert.equal(rewardJobs.length,68);
const latest=Object.fromEntries(AS.Data.recordings.takes.filter(t=>t.kind==='dialogue').map(t=>[t.id,t]));
for(const fk of ['human','elf','ice','undead'])for(const kind of Object.keys(AS.Data.sites)){
 const g=game(fk),s=site(g,kind);
 if(s.def.treasure){s.loot(fk);assert.equal(g.coinDrops[0],s.def.treasure,'Treasure remains coin pickups to collect')}
 else s.setOwner(fk);
 assert.equal(V.objectiveRewards.length,1,`${fk}: ${kind} capture/loot calls the reward hook`);
 V.update(.016,g);
 assert.equal(played.length,1,`${kind}: startup chatter quiet period cannot suppress the benefit`);
 const q=played[0],j=rewardJobs.find(j=>j.id===q.lineId),take=latest[q.lineId];
 assert.equal(q.event,'capture_reward_'+kind);assert.ok(j.character.startsWith(fk+'_'));
 assert.equal(q.text,j.text);assert.ok(take,`Recorded benefit exists for ${q.lineId}`);
 assert.equal(take.voice_id,AS.Data.recordings.cast.characters[j.character].voice_id);
 assert.ok(fs.existsSync(path.join(root,take.file)));
}

// Two captures during the normal event cooldown each earn their own line.
let g=game(),a=site(g,'goldmine'),b=site(g,'village');
a.setOwner('human');b.setOwner('human');V.update(.016,g);
assert.equal(played[0].event,'capture_reward_goldmine');
V.finish();g.time=2;V.update(.016,g);
assert.equal(played[1].event,'capture_reward_village');
g.time=3;V.flushObjectiveRewards(g);assert.equal(V.objectiveRewards.length,0,'Started announcements are not repeated');

// A same-owner call does not duplicate speech; enemy captures do not congratulate us.
g=game();a=site(g,'grove');a.setOwner('human');a.setOwner('human');
assert.equal(V.objectiveRewards.length,1);
b=site(g,'shrine');b.setOwner('elf');assert.equal(V.objectiveRewards.length,1);
a.setOwnerNeutral('human');V.update(.016,g);
assert.equal(played.length,0,'Lost ownership cancels a stale benefit');

// Danger interrupts chatter and defers the pending reward past short queue expiry.
g=game();g.time=100;a=site(g,'fort');a.setOwner('human');
V.speaking={q:{prio:1,event:'travel'},until:200};
V.homeWarning('home_serious',2);
assert.equal(V.objectiveRewards.length,1,'Warning interruption retains the reward');
V.update(.016,g);assert.equal(played[0].event,'home_serious');
V.finish();g.time=110;V.update(.016,g);assert.equal(played.length,1,'Benefit waits while danger is recent');
g.time=120;V.update(.016,g);assert.equal(played[1].event,'capture_reward_fort','Reward survives the five-second chatter expiry');

// A reward already queued behind a short gap also survives warning queue pruning.
g=game();a=site(g,'watchtower');a.setOwner('human');V.gapUntil=5;V.flushObjectiveRewards(g);
assert.ok(V.queue.some(q=>q.objectiveReward));V.homeWarning('home_critical',3);
assert.ok(V.queue.every(q=>!q.objectiveReward));assert.equal(V.objectiveRewards.length,1);
V.update(.016,g);V.finish();g.time=20;V.update(.016,g);
assert.equal(played[1].event,'capture_reward_watchtower');

// Pause/stop and muting cancel unsaid rewards rather than resuming stale speech.
g=game();a=site(g,'waygate');a.setOwner('human');V.stop();assert.equal(V.objectiveRewards.length,0);
a=site(g,'magicwell');a.setOwner('human');AS.Settings.taunts=false;V.update(.016,g);
assert.equal(V.objectiveRewards.length,0);AS.Settings.taunts=true;V.update(.016,g);assert.equal(played.length,0);

// Demo games, rival hoards and expiry do not enqueue player benefits.
g=game();a=site(g,'ruins');a.loot('elf');assert.equal(V.objectiveRewards.length,0);
g.demo=true;a=site(g,'castle');a.setOwner('human');assert.equal(V.objectiveRewards.length,0);
g.demo=false;a=site(g,'nest');a.setOwner('human');g.time=91;V.update(.016,g);assert.equal(played.length,0);
console.log('PASS objective dialogue: all 17 site types across four factions, exact cast/assets, neutral captures, treasure pickups, multiple captures, loss, warning deferral, no duplicates, mute/stop and expiry.');
