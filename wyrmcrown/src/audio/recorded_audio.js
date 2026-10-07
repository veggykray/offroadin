/* Recorded assets extend AS.Audio's existing buffers, spatial mix and SFX bus. */
'use strict';
(function (AS) {
  const A = AS.Audio, bank = {}, manifest = AS.Data.recordings || { takes: [] };
  const aliases = { breath_inhale: 'breath_start', breath_ignite: 'breath_start', breath_stop: 'breath_start', giant_pain: 'monster_roar', giant_death: 'monster_roar', giant_body_fall: 'crash_heavy', giant_footstep: 'giant_stomp', giant_throw_effort: 'monster_roar', giant_rock_air: 'snatch', giant_rock_impact: 'stone_hit', giant_ground_impact: 'giant_stomp', troll_pain: 'monster_roar', troll_death: 'monster_roar', troll_footstep: 'giant_stomp', troll_club_swing: 'snatch', troll_club_impact: 'stone_hit', dragon_satisfied: 'dragon_growl', dragon_burp: 'gulp', dragon_snort: 'dragon_growl' };
  for (const [key, fallback] of Object.entries(aliases)) if (!AS.Data.sfx[key]) AS.Data.sfx[key] = Object.assign({}, AS.Data.sfx[fallback]);
  for (const take of manifest.takes.filter(t => t.kind === 'sfx')) {
    (bank[take.event] || (bank[take.event] = [])).push(take);
    if (!AS.Data.sfx[take.event]) AS.Data.sfx[take.event] = Object.assign({}, AS.Data.sfx[take.fallback] || AS.Data.sfx.monster_roar, { vol: take.gain, loop: take.loop, poly: 3 });
  }
  const originalBuild = A.buildBank.bind(A), originalSfx = A.sfx.bind(A), originalLoop = A.startLoop.bind(A), originalLoopParam = A.loopParam.bind(A);
  A.buildBank = function () {
    originalBuild();
    if (!location.protocol.startsWith('http')) return;
    this.recordedLoads = [];
    for (const [event, takes] of Object.entries(bank)) for (const take of takes) {
      const key = 'recorded:' + take.id;
      AS.Data.sfx[key] = Object.assign({}, AS.Data.sfx[event], { vol: take.gain, loop: take.loop });
      const load = fetch(take.file).then(r => { if (!r.ok) throw Error(r.status); return r.arrayBuffer(); })
        .then(data => this.ctx.decodeAudioData(data)).then(buffer => { this.buffers[key] = buffer; take.bufferKey = key; })
        .catch(error => { console.warn('Recorded SFX unavailable; keeping synth fallback', take.id, error.message); });
      this.recordedLoads.push(load);
    }
  };
  A.recordedPick = function (event) {
    const ready = (bank[event] || []).filter(t => this.buffers[t.bufferKey]);
    if (!ready.length) return null;
    const alternatives = ready.filter(t => t.id !== this.recordedLast?.[event]);
    const take = AS.U.pick(alternatives.length ? alternatives : ready);
    (this.recordedLast || (this.recordedLast = {}))[event] = take.id;
    return take.bufferKey;
  };
  A.sfx = function (event, options) {
    const recording = this.recordedPick(event);
    // Rapid meals are assembled to fit the feeding animation exactly.
    if (recording && /^eat_(sheep|cattle|goat_deer|large)$/.test(event)) options = Object.assign({}, options, { rate: 1, fixedRate: true });
    return originalSfx(recording || event, options);
  };
  A.startLoop = function (key, event, volume) {
    if (this.loops[key]) return;
    originalLoop(key, this.recordedPick(event) || event, volume);
    if (this.loops[key]) Object.assign(this.loops[key], { recordedEvent: event, recordedVolume: volume });
  };
  A.loopParam = function (key, rate, volume) {
    const loop = this.loops[key];
    if (loop && volume !== undefined) loop.recordedVolume = volume;
    // A breath held while recordings load switches from the synth to the
    // recorded loop, without waiting for the player to release the button.
    if (loop?.recordedEvent && !loop.id.startsWith('recorded:') && AS.RecordedAudio.has(loop.recordedEvent)) {
      this.stopLoop(key);
      this.startLoop(key, loop.recordedEvent, loop.recordedVolume);
    }
    return originalLoopParam(key, rate, volume);
  };
  AS.RecordedAudio = { bank, has(event) { return !!A.ctx && !!(bank[event] || []).find(t => A.buffers[t.bufferKey]); } };
})(window.AS);
