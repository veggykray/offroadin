/* Extend the existing AS.Voices queue, subtitles and fallback speech. */
'use strict';
(function (AS) {
  const V = AS.Voices, U = AS.U, A = AS.Audio, jobs = AS.Data.dialogue || [], manifest = AS.Data.recordings || { takes: [] };
  const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
  const recordings = Object.fromEntries(manifest.takes.filter(t => t.kind === 'dialogue').map(t => [t.id, t]));
  const bufferCache = new Map();
  const originalStart = V.start.bind(V), originalStop = V.stop.bind(V), originalUpdate = V.update.bind(V), originalSpeak = V.speak.bind(V), originalFinish = V.finish.bind(V);
  const SETTINGS = {
    banterMin: 180, banterMax: 300, banterIntro: 90,
    chatterMin: 75, chatterMax: 130, dragonSpeechChance: .15,
    eventCooldown: 35, routineGap: 12, warningCooldown: 20,
  };
  V.cadence = SETTINGS;
  V.durationFor = function (lineId) { return recordings[lineId]?.duration || 4; };
  V.start = function (g) {
    originalStart(g);
    this.eventNext = {}; this.playedLines = []; this.seenEntities = new WeakSet();
    this.banterUntil = SETTINGS.banterIntro; this.travelAt = U.range(SETTINGS.chatterMin, SETTINGS.chatterMax);
    this.scanAt = 0; this.homeLevel = 0; this.homeLastThreat = -Infinity; this.eventBags = {};
    this.lastRegion = g.region; this.lastHome = true; this.lastHp = false; this.lastEnergy = false; this.lastStarving = false;
    this.routineUntil = 15;
    this.lastBreathReady = false; this.lastBreathEmpty = false; this.lastSpell = false; this.lastStorm = false;
    this.lastManaLow = false; this.lastNearDefeat = false; this.lastRetreating = false;
    this.brokenWards = new WeakSet();
    this.objectiveRewards = [];
    this.quietUntil = SETTINGS.banterIntro;
  };
  V.stop = function (preserveRewards) {
    if (this.recordedSource) { const src = this.recordedSource; this.recordedSource = null; try { src.stop(); } catch (_) {} }
    if (this.recordedGain) { this.recordedGain.disconnect(); this.recordedGain = null; }
    if (this.recordedPan) { this.recordedPan.disconnect(); this.recordedPan = null; }
    A.voiceDuck && A.voiceDuck(false);
    this.pendingReply = null;
    if (!preserveRewards) this.objectiveRewards = [];
    originalStop();
  };
  V.eventLine = function (event, role, fk) {
    const pool = jobs.filter(j => j.event === event && j.character === fk + '_' + role && !j.pair);
    if (!pool.length) return null;
    const key = fk + ':' + role + ':' + event;
    let bag = this.eventBags[key];
    if (!bag?.length) {
      bag = pool.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1].id === this.playedLines[this.playedLines.length - 1]) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.eventBags[key] = bag;
    }
    return bag.pop();
  };
  V.enqueueLine = function (line, d, options) {
    const g = this.g;
    if (!g || !this.enabled() || !line || !d || d.hidden || d.down > 0) return null;
    const o = options || {}, own = d === g.player, role = line.character.split('_')[1];
    const q = { d, role, text: line.text, own, event: line.event, lineId: line.id, prio: o.priority || 10,
                seq: this.seq++, after: null, until: g.time + (o.priority >= 80 ? 8 : 5) };
    this.queue.push(q);
    if (this.queue.length > 8) { this.queue.sort((a,b) => b.prio - a.prio || b.seq - a.seq); this.queue.length = 8; }
    return q;
  };
  V.event = function (event, options) {
    const g = this.g, o = options || {};
    if (!g || !this.enabled() || g.demo || g.state==='ending' && o.priority!==100) return null;
    const urgent = o.priority >= 80, key = o.cooldownKey || event;
    if (!o.force && (this.eventNext[key] || 0) > g.time) return null;
    if (!urgent && (g.time < (this.routineUntil || 0) || g.time - this.homeLastThreat < 15)) return null;
    const dragonLine = jobs.some(j => j.event === event && j.character === g.playerKey + '_dragon' && !j.pair);
    const role = o.role || (dragonLine && Math.random() < SETTINGS.dragonSpeechChance ? 'dragon' : 'wizard');
    const line = this.eventLine(event, role, g.playerKey);
    if (!line) return null;
    if (urgent) {
      this.pendingReply = null;
      this.queue = this.queue.filter(q => q.prio > (o.priority || 80));
      if (this.speaking && (this.speaking.q.prio || 0) < (o.priority || 80)) { this.stop(true); }
      this.calmUntil = 0; this.gapUntil = 0;
    }
    const q = this.enqueueLine(line, g.player, o);
    if (q) { this.eventNext[key] = g.time + (o.cooldown || SETTINGS.eventCooldown); if (!urgent) this.routineUntil = g.time + SETTINGS.routineGap; }
    return q;
  };
  V.homeWarning = function (event, level) {
    const g = this.g;
    if (!g) return;
    const escalated = level > this.homeLevel;
    if (level < this.homeLevel && g.time - this.homeLastThreat < 25) return;
    this.homeLevel = Math.max(this.homeLevel, level); this.homeLastThreat = g.time;
    this.event(event, { priority: 80 + level * 5, cooldownKey: 'home_warning', cooldown: SETTINGS.warningCooldown, force: escalated });
  };
  V.onTownAttacked = function (faction, building) {
    if (!this.g || faction.key !== this.g.playerKey) return;
    const keep = faction.keep, critical = keep?.alive && keep.hp / keep.maxHp < .3;
    if (critical) this.homeWarning('home_critical', 3);
    else if (building.kind === 'farm') this.homeWarning('home_farms', 2);
    else this.homeWarning('home_serious', 2);
  };
  V.onBuildingLost = function (building, src) {
    const g = this.g; if (!g) return;
    if (building.team === g.playerKey) {
      if (building.kind === 'wall' || building.kind === 'gate') this.homeWarning('home_wall', 2);
      else if (building.kind === 'wardstone') this.homeWarning('home_critical', 3);
    } else if (src?.team === g.playerKey) {
      const event = building.kind === 'wall' || building.kind === 'gate' ? 'castle_wall_broken' : building.kind === 'catapult' ? 'catapult_destroyed' : 'defence_destroyed';
      if (building.shoots || ['wall','gate','wardstone'].includes(building.kind)) this.event(event);
    }
  };
  V.onCapture = function (site, fk, prev) {
    if (!this.g || fk !== this.g.playerKey && prev !== this.g.playerKey) return;
    if (fk === this.g.playerKey) this.onObjectiveReward(site, fk);
    else this.event(site.kind === 'goldmine' ? 'mine_lost' : 'objective_stolen', { priority: 60 });
  };
  V.onObjectiveReward = function (site, fk) {
    const g = this.g;
    if (!g || fk !== g.playerKey || !this.enabled() || g.demo || g.state !== 'play') return;
    const line = jobs.find(j => j.event === 'capture_reward_' + site.kind && j.character.startsWith(fk + '_'));
    if (!line) return;
    // One announcement per capture, including neutral sites and treasure hoards.
    // Keep the pending reward outside the short-lived chatter queue so warnings
    // can defer it without discarding the information the player just earned.
    this.objectiveRewards = this.objectiveRewards.filter(r => r.site !== site);
    this.queue = this.queue.filter(q => !q.objectiveReward || q.site !== site);
    this.objectiveRewards.push({ site, line, until: g.time + 90, treasure: !!site.def.treasure, q: null });
    this.pendingReply = null;
    this.routineUntil = Math.max(this.routineUntil || 0, g.time + SETTINGS.routineGap);
  };
  V.flushObjectiveRewards = function (g) {
    this.objectiveRewards = this.objectiveRewards.filter(r => !r.q?.started && r.until > g.time
      && (r.treasure ? r.site.looted : r.site.owner === g.playerKey));
    const validSites = new Set(this.objectiveRewards.map(r => r.site));
    this.queue = this.queue.filter(q => !q.objectiveReward || validSites.has(q.site));
    if (g.player.down > 0 || g.player.hidden || g.time - this.homeLastThreat < 15 || this.queue.some(q => q.prio >= 70)) {
      this.queue = this.queue.filter(q => !q.objectiveReward);
      return;
    }
    if (this.speaking) return;
    const reward = this.objectiveRewards[0];
    if (!reward || this.queue.includes(reward.q)) return;
    const q = this.enqueueLine(reward.line, g.player, { priority: 65 });
    if (!q) return;
    q.until = reward.until; q.objectiveReward = true; q.site = reward.site; reward.q = q;
    this.calmUntil = 0;
    // Honour the gap after existing speech, while bypassing long chatter rests.
    this.gapUntil = Math.min(this.gapUntil || 0, g.time + .65);
    this.routineUntil = g.time + SETTINGS.routineGap;
    this.banterUntil = Math.max(this.banterUntil || 0, g.time + 45);
  };
  V.onHit = function (src, victim, damage) {
    if (src === this.g?.player && victim?.isDragon && Math.random() < .08) this.event(damage >= 40 ? 'huge_hit' : 'successful_hit', { cooldownKey: 'combat_hit', cooldown: 50 });
  };
  V.onTroopLost = function (troop, src) {
    const g=this.g;
    if (!g || troop.role==='cart' || Math.hypot(troop.x-g.player.x,troop.y-g.player.y)>750) return;
    if (troop.team===g.playerKey) this.event('friendly_troops_killed',{priority:40,cooldown:60});
    else if (src?.team===g.playerKey && Math.random()<.12) this.event('enemy_troops_killed',{cooldown:60});
  };
  V.onDown = function (dragon, killer) {
    if (killer === this.g?.player) this.event('enemy_retreating', { cooldown: 40 });
  };
  // Both rival exchanges and rider/mount banter consume the same rare interval.
  V.say = function (dragon, role, targetFaction, priority) {
    const g=this.g;
    if (!g || g.state && g.state!=='play' || g.time<this.banterUntil || g.time-this.homeLastThreat<25 || this.speaking || this.queue.length || dragon?.down>0 || dragon?.hidden) return null;
    if (dragon!==g.player && Math.hypot(dragon.x-g.player.x,dragon.y-g.player.y)>950) return null;
    const line=this.eventLine('enemy_dragon',role,dragon.fk);
    const q=this.enqueueLine(line,dragon,{priority:dragon===g.player?10:1});
    if(q)this.banterUntil=g.time+U.range(SETTINGS.banterMin,SETTINGS.banterMax);
    return q;
  };
  V.exchange = function (a,b) {
    const first=Math.random()<.5?a:b, second=first===a?b:a, role=Math.random()<.75?'wizard':'dragon';
    const q=this.say(first,role,second.fk);
    if(q && Math.random()<.35) {
      const line=this.eventLine('enemy_dragon',role==='wizard'?'dragon':'wizard',second.fk);
      if(line)this.pendingReply={opener:q,line,dragon:second};
    }
  };
  V.ownBanter = function () {
    const g = this.g;
    if (!g || g.time < this.banterUntil || g.combatLevel > 0 || g.time - this.homeLastThreat < 25 || this.speaking || this.queue.length || g.player.down > 0) return false;
    const openers = jobs.filter(j => j.event === 'banter' && j.character === g.playerKey + '_wizard');
    const choices = openers.filter(j => !this.playedLines.includes(j.id));
    const line = U.pick(choices.length ? choices : openers); if (!line) return false;
    const q = this.enqueueLine(line, g.player, { priority: 1 });
    if (!q) return false;
    this.banterUntil = g.time + U.range(SETTINGS.banterMin, SETTINGS.banterMax);
    const reply = jobs.find(j => j.pair === line.pair && j.character === g.playerKey + '_dragon');
    this.pendingReply = reply ? { opener: q, line: reply } : null;
    return true;
  };
  V.onEat = function (dragon) {
    if (dragon !== this.g?.player) return;
    if (Math.random() < .1) this.event('eating_reaction', { role: 'dragon', cooldown: 100 });
  };
  V.scan = function (g) {
    const p = g.player, F = g.playerFaction;
    if (g.time - this.homeLastThreat > 25) this.homeLevel = 0;
    if (p.down > 0) return;
    const transition = (key, condition, event, options) => { if (condition && !this[key]) this.event(event, options); this[key] = condition; };
    transition('lastHp', p.hp / p.maxHp < .25, 'health_low', { priority: 80, cooldown: 50 });
    transition('lastRetreating', g.combatLevel > 0 && p.hp / p.maxHp < .4 && p.sprinting, 'player_retreating', { priority: 55, cooldown: 60 });
    transition('lastEnergy', p.energy / p.maxEnergy < .25, 'energy_low', { priority: 55, cooldown: 60 });
    transition('lastManaLow', p.mana < 4 && p.input?.fire, 'mana_low', { cooldown: 60 });
    transition('lastNearDefeat', !!F.keep?.alive && F.keep.hp/F.keep.maxHp<.15, 'near_defeat', { priority:95,cooldownKey:'home_warning',cooldown:40 });
    transition('lastStarving', p.energy <= 0, 'starving', { priority: 80, cooldown: 30 });
    transition('lastBreathEmpty', p.fireCharge < 4, 'breath_empty', { cooldown: 60 });
    transition('lastBreathReady', p.fireCharge >= p.maxFire * .98, 'breath_ready', { role: Math.random() < SETTINGS.dragonSpeechChance ? 'dragon' : 'wizard', cooldown: 90 });
    transition('lastSpell', p.spellCharges > 0, 'spell_ready', { cooldown: 45 });
    transition('lastStorm', g.weather?.storm > .5, 'storm', { priority: 80, cooldown: 90 });
    const near = (e,r) => Math.hypot(e.x-p.x,e.y-p.y)<r;
    for (const rival of g.factionList) {
      if (rival === F || rival.eliminated || this.brokenWards.has(rival) || rival.wardStrength() > 0) continue;
      if (this.event('ward_down', { priority: 70, cooldown: 25 })) this.brokenWards.add(rival);
    }
    for (const d of g.dragons) {
      if (d === p || !d.targetable) continue;
      if (Math.hypot(d.x-F.townPos.x,d.y-F.townPos.y)<900) this.homeWarning('home_early',1);
      if (near(d,650) && !this.seenEntities.has(d)) { if (this.event(Math.random()<.2 ? 'rival_wizard' : 'enemy_dragon',{cooldownKey:'rival_spotted',cooldown:55})) this.seenEntities.add(d); }
    }
    const monster = g.troops.find(t=>t.alive && ['giant','troll'].includes(t.role) && near(t,650) && !this.seenEntities.has(t));
    if (monster && this.event(monster.role+'_spotted',{priority:45,cooldown:55})) this.seenEntities.add(monster);
    const army = g.troops.filter(t=>t.alive && g.hostile(p.team,t.team) && t.state==='march' && near(t,800));
    if (army.length>=5) this.event('army_approaching',{priority:60,cooldown:75});
    for (const site of g.sites) {
      if (!near(site,500) || this.seenEntities.has(site)) continue;
      const event = site.kind==='village' ? 'village_found' : ['cave','ruins'].includes(site.kind) ? 'treasure_found' : ['shrine','magicwell','grove'].includes(site.kind) ? 'shrine_found' : 'objective_found';
      if (this.event(event,{cooldown:50})) this.seenEntities.add(site);
      break;
    }
    if (g.pickups.some(q=>q.alive && q.def && near(q,400))) this.event('magic_nearby',{cooldown:65});
    const home=Math.hypot(p.x-F.townPos.x,p.y-F.townPos.y)<650;
    if (home&&!this.lastHome) this.event('returning_home',{cooldown:90});
    this.lastHome=home;
    if (g.region!==this.lastRegion) { this.event(g.region!=='neutral' && g.region!==g.playerKey ? 'enemy_territory' : 'leaving_territory',{cooldownKey:'border',cooldown:90}); this.lastRegion=g.region; }
    if (g.time>=this.travelAt && g.combatLevel===0 && !p.breathing && g.time-p.lastHurt>15 && g.time < this.banterUntil) {
      if (this.event('travel',{role:Math.random()<SETTINGS.dragonSpeechChance?'dragon':'wizard',cooldown:75})) this.travelAt=g.time+U.range(SETTINGS.chatterMin,SETTINGS.chatterMax);
    }
    this.ownBanter();
  };
  V.update = function (dt,g) {
    if (!this.enabled() && (this.speaking || this.queue.length || this.objectiveRewards.length)) this.stop();
    if (g===this.g && this.enabled() && !g.demo && g.state==='play' && !AS.App.overlay) {
      if (g.time>=this.scanAt) { this.scanAt=g.time+1; this.scan(g); }
      this.flushObjectiveRewards(g);
    }
    originalUpdate(dt,g);
  };
  V.finish = function () {
    const finished=this.speaking?.q, reply=this.pendingReply;
    if (this.recordedSource) { const src=this.recordedSource; this.recordedSource=null; try { src.stop(); } catch (_) {} }
    if (this.recordedGain) { this.recordedGain.disconnect(); this.recordedGain=null; }
    if (this.recordedPan) { this.recordedPan.disconnect(); this.recordedPan=null; }
    this.recordedSource=null;
    A.voiceDuck && A.voiceDuck(false);
    originalFinish();
    if (finished?.lineId) { this.playedLines.push(finished.lineId); if (this.playedLines.length>40) this.playedLines.shift(); }
    if (reply?.opener===finished && finished.started && this.g && this.g.time-this.homeLastThreat>20 && !this.queue.some(q=>q.prio>=70)) {
      this.pendingReply=null;
      const q=this.enqueueLine(reply.line,reply.dragon||this.g.player,{priority:1});
      if (q) { this.calmUntil=0; this.gapUntil=this.g.time+.65; }
    } else if (reply?.opener===finished) this.pendingReply=null;
  };
  V.speak = function (q) {
    const take=recordings[q.lineId], line=byId[q.lineId], g=this.g;
    // No audition clip or unapproved cast can silently become a production voice.
    const character=line && manifest.cast?.characters[line.character];
    if (!take || !character?.approved || take.voice_id!==character.voice_id || take.model_id!==character.model_id || JSON.stringify(take.voice_settings)!==JSON.stringify(character.voice_settings) || !A.ctx || !location.protocol.startsWith('http')) { q.started=true; originalSpeak(q); return; }
    let promise=bufferCache.get(take.file);
    if (!promise) { promise=fetch(take.file).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer()}).then(data=>A.ctx.decodeAudioData(data)); bufferCache.set(take.file,promise); }
    this.speaking={q,until:g.time+take.duration+5};
    promise.then(buffer=>{
      if(this.speaking?.q!==q || AS.App.state!=='play' || AS.App.overlay || !this.enabled())return;
      const src=A.ctx.createBufferSource(),gain=A.ctx.createGain();
      src.buffer=buffer; src.playbackRate.value=1;
      const distance=q.own?0:Math.hypot(q.d.x-g.player.x,q.d.y-g.player.y),near=Math.pow(U.clamp(1-distance/950,0,1),1.2);
      gain.gain.value=(AS.Settings.voice ?? .9)*near;
      src.connect(gain);
      if(!q.own&&A.ctx.createStereoPanner){const pan=A.ctx.createStereoPanner();this.recordedPan=pan;pan.pan.value=U.clamp((q.d.x-g.player.x)/450,-.85,.85);gain.connect(pan);pan.connect(A.master)}else gain.connect(A.master);
      this.recordedSource=src;this.recordedGain=gain;
      this.speaking.until=g.time+buffer.duration+2;
      if(AS.Settings.subtitles!==false)this.bubbles.push({d:q.d,role:q.role,text:q.text,t:buffer.duration+.7,max:buffer.duration+.7,own:q.own,alpha:q.own?1:Math.max(.3,near)});
      A.voiceDuck && A.voiceDuck(true);
      src.onended=()=>{if(this.speaking?.q===q)this.finish()};q.started=true;src.start();
    }).catch(()=>{bufferCache.delete(take.file);if(this.speaking?.q===q){q.started=true;originalSpeak(q)}});
  };
})(window.AS);
