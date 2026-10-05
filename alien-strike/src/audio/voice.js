/* ALIEN STRIKE — voice & radio system.
 * Lines live in data/voice.js (text, speaker, priority, cooldown). Audio files are
 * pre-generated into audio/voice/<id>.mp3 and listed in data/voice_manifest.js;
 * a line without a file still plays its subtitle with a radio blip (no browser
 * text-to-speech). Higher-priority lines interrupt; others queue briefly. */
'use strict';
(function (AS) {
  const SPEAKERS = {
    ship: { name: 'VESPER // SHIP AI', col: '#7fe8ff', radio: false },
    command: { name: 'HALCYON ACTUAL', col: '#ffc35a', radio: true },
    intel: { name: 'DR. MARR // XENOLOGY', col: '#c58aff', radio: true },
    survivor: { name: 'SURVIVOR', col: '#e8e8e8', radio: true },
  };
  const Voice = {
    current: null, queue: [], last: {}, cache: {}, el: null,
    reset() { this.stop(); this.queue = []; this.last = {}; },
    stop() {
      if (this.current && this.current.audio) { try { this.current.audio.pause(); } catch (e) { /* noop */ } }
      this.current = null;
      AS.Audio.voiceDuck && AS.Audio.voiceDuck(false);
    },
    line(id) {
      const L = AS.Data.voice[id];
      if (L) return L;
      if (AS.Data.voiceDynamic && AS.Data.voiceDynamic[id]) return AS.Data.voiceDynamic[id];
      return null;
    },
    say(id, g) {
      const L = this.line(id);
      if (!L) return;
      const now = performance.now() / 1000;
      const cd = L.cd !== undefined ? L.cd : 6;
      if (this.last[id] && now - this.last[id] < cd) return;
      this.last[id] = now;
      const pr = L.p || 1;
      if (this.current) {
        if (this.current.id === id) return;
        if (pr > (this.current.p || 1) + 0) { this.queue.unshift({ id: this.current.id, L: this.current.L, retry: true }); this.stop(); }
        else { if (this.queue.length < 3 && !this.queue.some((q) => q.id === id)) this.queue.push({ id, L }); return; }
      }
      this.play(id, L);
    },
    play(id, L) {
      const sp = SPEAKERS[L.s] || SPEAKERS.ship;
      const has = AS.Data.voiceFiles && AS.Data.voiceFiles[id];
      const words = L.t.split(/\s+/).length;
      const est = Math.max(1.4, words * 0.36 + 0.4);
      const cur = { id, L, text: L.t, speaker: L.name || sp.name, col: sp.col, p: L.p || 1, t: 0, dur: (has && has.d) || est, audio: null };
      if (has) {
        let a = this.cache[id];
        if (!a) { a = new window.Audio('audio/voice/' + id + '.mp3'); a.preload = 'auto'; this.cache[id] = a; }
        const S = AS.Settings;
        a.volume = Math.max(0, Math.min(1, S.master * S.voice));
        try { a.currentTime = 0; } catch (e) { /* noop */ }
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => { /* autoplay blocked: subtitle still shows */ });
        cur.audio = a;
      }
      if (sp.radio) AS.Audio.sfx('radio_on');
      AS.Audio.voiceDuck && AS.Audio.voiceDuck(true);
      this.current = cur;
    },
    update(dt) {
      const c = this.current;
      if (!c) {
        if (this.queue.length) { const q = this.queue.shift(); this.play(q.id, q.L); }
        return;
      }
      c.t += dt;
      const ended = c.audio ? (c.audio.ended || (c.t > c.dur + 1.5)) : c.t > c.dur;
      if (ended || c.t > c.dur + 4) {
        const sp = SPEAKERS[c.L.s] || SPEAKERS.ship;
        if (sp.radio) AS.Audio.sfx('radio_off');
        this.current = null;
        if (!this.queue.length) AS.Audio.voiceDuck && AS.Audio.voiceDuck(false);
        else { const q = this.queue.shift(); setTimeout(() => this.play(q.id, q.L), 250); }
      }
    },
    /* register mission-specific lines at runtime (briefings, scripted radio) */
    register(id, text, speaker, opts) {
      AS.Data.voiceDynamic = AS.Data.voiceDynamic || {};
      AS.Data.voiceDynamic[id] = Object.assign({ t: text, s: speaker || 'command', p: 2, cd: 0 }, opts || {});
    },
    SPEAKERS,
  };
  AS.Voice = Voice;
})(window.AS);
