/* WYRMCROWN — wizards and dragons trading insults.
 *  - Voices come from the browser's own speech synthesiser: wizards squeak
 *    (high pitch), dragons rumble (lowest pitch, slow, with a growl under the
 *    words). With no speech voices available, a burble of syllables in the
 *    right register stands in, and the subtitles carry the words.
 *  - One voice at a time, never over each other. Your own wizard and dragon
 *    always come through clearly and take priority.
 *  - Rival voices are local: they fade with distance and, far off, you only
 *    catch a snippet of the line.
 *  - Occasional, not constant: each speaker has a long cooldown, rival lines go
 *    stale if they can't be said at once, and recently heard lines are not
 *    repeated (hand-written lines are dealt from a shuffled deck and mixed with
 *    lines generated from each realm's vocabulary, data/taunts.js).
 * Triggers: meeting a rival dragon, landing hits on one (or taking them),
 * driving one from the sky, rivals squabbling nearby, taking a rival's land. */
'use strict';
(function (AS) {
  const U = AS.U;
  const RANGE = 950, SNIPPET_AT = 520;
  const PRESET = {
    wizard: { human: { pitch: 1.9, rate: 1.12 }, elf: { pitch: 2, rate: 1 }, ice: { pitch: 1.6, rate: 0.95 }, undead: { pitch: 1.35, rate: 0.88 } },
    dragon: { human: { pitch: 0.15, rate: 0.8 }, elf: { pitch: 0.4, rate: 0.9 }, ice: { pitch: 0.25, rate: 0.74 }, undead: { pitch: 0.02, rate: 0.7 } },
  };

  const V = {
    g: null, queue: [], speaking: null, gapUntil: 0, recent: [], bags: {}, spkNext: {}, pairNext: {}, bubbles: [], seq: 0,
    tts: typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null,
    voices: [],

    init() {
      if (!this.tts) return;
      const load = () => { try { this.voices = this.tts.getVoices().filter((v) => /^en/i.test(v.lang)); } catch (e) { this.voices = []; } };
      load();
      try { this.tts.addEventListener('voiceschanged', load); } catch (e) { this.tts.onvoiceschanged = load; }
    },
    start(g) {
      this.stop();
      this.g = g; this.queue = []; this.bubbles = []; this.gapUntil = 0; this.calmUntil = 0; this.spkNext = {}; this.pairNext = {};
      this.quietUntil = 20; // let the war get going before anyone starts shouting
    },
    stop() {
      if (this.tts) { try { this.tts.cancel(); } catch (e) { /* not supported */ } }
      this.speaking = null; this.queue = []; this.bubbles = [];
    },
    enabled() { return !AS.Settings || AS.Settings.taunts !== false; },

    /* ---------- choosing words ---------- */
    line(role, fk, tgt) {
      const T = AS.Data.taunts, curated = T.lines[role][fk] && T.lines[role][fk][tgt];
      for (let tries = 0; tries < 8; tries++) {
        const cand = !curated || Math.random() < 0.3 ? this.generate(role, fk, tgt) : this.deal(role + ':' + fk + ':' + tgt, curated);
        if (cand && !this.recent.includes(cand)) {
          this.recent.push(cand); if (this.recent.length > 60) this.recent.shift();
          return cand;
        }
      }
      return null;
    },
    deal(key, list) {
      let bag = this.bags[key];
      if (!bag || !bag.length) bag = this.bags[key] = list.slice().sort(() => Math.random() - 0.5);
      return bag.pop();
    },
    generate(role, fk, tgt) {
      const T = AS.Data.taunts, G = T.gen[role][fk];
      if (!G) return null;
      const foes = (T.FOE[role][fk] || {})[tgt] || ['fool'];
      const s = U.pick(G.t).replace(/\{(\w+)\}/g, (m, k) => (k === 'foe' ? U.pick(foes) : G[k] ? U.pick(G[k]) : m));
      return s.charAt(0).toUpperCase() + s.slice(1);
    },

    /* ---------- queueing lines ---------- */
    // d: the speaking dragon (its rider speaks for role 'wizard'); returns the queued item
    say(d, role, tgtFk, prio, after) {
      const g = this.g;
      if (!g || !this.enabled() || !d || d.down > 0 || d.hidden || !tgtFk || tgtFk === d.fk) return null;
      const own = d === g.player, key = d.fk + ':' + role;
      if ((this.spkNext[key] || 0) > g.time) return null;
      if (!after && g.time < (this.calmUntil || 0) - (own ? 2 : 0)) return null; // too soon after the last line
      if (!own && Math.hypot(d.x - g.player.x, d.y - g.player.y) > RANGE) return null;
      const text = this.line(role, d.fk, tgtFk);
      if (!text) return null;
      this.spkNext[key] = g.time + (own ? U.range(16, 26) : U.range(24, 40));
      const item = { d, role, text, own, prio: (own ? 10 : 0) + (prio || 0), seq: this.seq++, after: after || null, until: g.time + (after ? 9 : own ? 6 : 2.5) };
      this.queue.push(item);
      return item;
    },
    // one side opens, the other may answer once the first has finished
    exchange(a, b) {
      const first = Math.random() < 0.5 ? a : b, second = first === a ? b : a;
      const q = this.say(first, Math.random() < 0.55 ? 'wizard' : 'dragon', second.fk, 1);
      if (q && Math.random() < 0.65) this.say(second, Math.random() < 0.5 ? 'wizard' : 'dragon', first.fk, 0, q);
    },

    /* ---------- events from the game ---------- */
    onHit(src, victim) {
      const g = this.g;
      if (!g || !src.isDragon || !victim.isDragon || src === victim) return;
      if (src !== g.player && victim !== g.player && Math.random() > 0.3) return;
      if (Math.random() > 0.12) return; // only now and then
      if (Math.random() < 0.6) this.say(src, Math.random() < 0.5 ? 'wizard' : 'dragon', victim.fk, 1);
      else this.say(victim, 'dragon', src.fk, 1);
    },
    onDown(d, killer) {
      if (!killer || !killer.isDragon) return;
      this.spkNext[killer.fk + ':dragon'] = 0; // a kill always earns a gloat
      this.say(killer, Math.random() < 0.6 ? 'dragon' : 'wizard', d.fk, 3);
    },
    onCapture(site, fk, prev) {
      const g = this.g;
      if (!g || !prev || !g.factions[fk] || Math.random() > 0.5) return;
      const d = g.factions[fk].dragon;
      if (d && Math.hypot(d.x - site.x, d.y - site.y) < 600) this.say(d, 'wizard', prev, 0);
    },

    /* ---------- the voice ---------- */
    update(dt, g) {
      if (g !== this.g) return;
      const p = g.player;
      if (this.speaking && g.time > this.speaking.until) this.finish();
      // lines that can no longer be said go stale
      this.queue = this.queue.filter((q) => q.until > g.time && q.d.down <= 0 && !q.d.hidden && (q.own || Math.hypot(q.d.x - p.x, q.d.y - p.y) < RANGE));
      if (!this.speaking && this.queue.length && g.time >= this.gapUntil) {
        // a reply follows its line at once; anything else waits out a quiet spell
        const ready = this.queue.filter((q) => (q.after ? !this.queue.includes(q.after) : g.time >= (this.calmUntil || 0)));
        if (ready.length) {
          ready.sort((a, b) => b.prio - a.prio || a.seq - b.seq);
          const q = ready[0];
          this.queue.splice(this.queue.indexOf(q), 1);
          this.speak(q);
        }
      }
      // meeting a rival dragon
      if (g.time > this.quietUntil && p.down <= 0) {
        for (const e of g.dragons) {
          if (e === p || !e.targetable) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 700 && (this.pairNext[e.fk] || 0) < g.time) { this.pairNext[e.fk] = g.time + U.range(45, 80); this.exchange(p, e); }
        }
        // rivals squabbling within earshot
        for (const a of g.dragons) for (const b of g.dragons) {
          if (a === p || b === p || a.fk >= b.fk || !a.targetable || !b.targetable) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) > 600 || Math.hypot(a.x - p.x, a.y - p.y) > RANGE * 0.8) continue;
          const k = a.fk + b.fk;
          if ((this.pairNext[k] || 0) < g.time) { this.pairNext[k] = g.time + U.range(50, 90); this.exchange(a, b); }
        }
      }
      for (const b of this.bubbles) b.t -= dt;
      this.bubbles = this.bubbles.filter((b) => b.t > 0);
    },
    speak(q) {
      const g = this.g, p = g.player, d = q.d, S = AS.Settings || {};
      const dist = q.own ? 0 : Math.hypot(d.x - p.x, d.y - p.y);
      const near = q.own ? 1 : Math.pow(U.clamp(1 - dist / RANGE, 0, 1), 1.2);
      const vol = U.clamp(near * (S.master === undefined ? 0.8 : S.master) * (S.voice === undefined ? 0.9 : S.voice) * 1.4, 0, 1);
      // far away you only catch a fragment of the line
      let text = q.text, snippet = false;
      if (!q.own && dist > SNIPPET_AT) {
        const w = text.split(' ');
        // always only part of it: a few words of a long line, one word of a short one
        const n = w.length > 1 ? Math.max(1, Math.min(w.length - 1, 2 + ((Math.random() * 3) | 0))) : 1;
        const st = (Math.random() * (w.length - n + 1)) | 0;
        text = w.slice(st, st + n).join(' ').replace(/[.,!?]+$/, ''); snippet = true;
      }
      const pre = PRESET[q.role][d.fk] || { pitch: 1, rate: 1 };
      const words = text.split(/\s+/).length, est = words * 0.42 / pre.rate + 0.7;
      this.speaking = { q, until: g.time + est + 2.5 };
      if (S.subtitles !== false) {
        this.bubbles = this.bubbles.filter((b) => b.d !== d);
        this.bubbles.push({ d, role: q.role, text: snippet ? '…' + text + '…' : text, t: Math.max(2.6, est + 1.2), max: Math.max(2.6, est + 1.2), own: q.own, alpha: q.own ? 1 : Math.max(0.5, near) });
      }
      if (q.role === 'dragon') AS.Audio.sfx('dragon_growl', { vol: vol * 0.8, rate: U.range(0.85, 1.1) });
      if (vol < 0.03) { setTimeout(() => this.speaking && this.speaking.q === q && this.finish(), est * 1000); return; }
      if (this.tts && this.voices.length) this.ttsSpeak(text, q, pre, vol);
      else this.babble(words, q, pre, vol);
    },
    voiceFor(fk, role) {
      const vs = this.voices;
      if (!vs.length) return null;
      const gb = vs.filter((v) => /GB|UK|British/i.test(v.lang + ' ' + v.name)), list = gb.length >= 2 ? gb : vs;
      const i = ({ human: 0, elf: 1, ice: 2, undead: 3 }[fk] || 0) + (role === 'dragon' ? 2 : 0);
      return list[i % list.length];
    },
    ttsSpeak(text, q, pre, vol) {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = pre.pitch; u.rate = pre.rate; u.volume = vol;
        const v = this.voiceFor(q.d.fk, q.role);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
        u.onend = u.onerror = () => { if (this.speaking && this.speaking.q === q) this.finish(); };
        this.tts.speak(u);
      } catch (e) { this.babble(text.split(/\s+/).length, q, pre, vol); }
    },
    // no speech voices: a burble of syllables in the speaker's register
    babble(words, q, pre, vol) {
      const hi = q.role === 'wizard', n = Math.min(16, Math.round(words * 1.7)), step = (hi ? 95 : 150) / pre.rate;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (!this.speaking || this.speaking.q !== q) return;
          AS.Audio.sfx(hi ? 'babble_hi' : 'babble_lo', { vol: vol * (0.8 + Math.random() * 0.3), rate: (hi ? 0.55 + pre.pitch * 0.35 : 0.75 + pre.pitch * 0.4) * U.range(0.85, 1.25) });
        }, i * step + (i % 3 === 2 ? 40 : 0));
      }
      setTimeout(() => { if (this.speaking && this.speaking.q === q) this.finish(); }, n * step + 350);
    },
    finish() {
      this.speaking = null;
      const t = this.g ? this.g.time : 0;
      this.gapUntil = t + U.range(0.6, 1.4);
      this.calmUntil = t + U.range(5, 9); // occasional, not constant
    },

    /* ---------- subtitles: speech bubbles over the speaker ---------- */
    draw(ctx, g, W, H, s) {
      if (!this.bubbles.length || g !== this.g) return;
      const R = AS.Renderer, cam = g.camera, HUD = AS.HUD;
      const K = AS.UIKit, m = 20 * s;
      ctx.save();
      for (const b of this.bubbles) {
        const d = b.d, F = AS.Data.factions[d.fk];
        const q = R.worldToScreen(d.x, d.y - d.z, cam);
        const fade = Math.min(1, (b.max - b.t) * 6, b.t * 2.5) * b.alpha;
        if (fade <= 0.01) continue;
        ctx.font = '700 ' + Math.round(15 * s) + 'px "Alegreya Sans", "Segoe UI", sans-serif';
        const lines = HUD.wrap ? HUD.wrap(ctx, b.text, 300 * s) : [b.text];
        let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
        const name = b.role === 'wizard' ? F.rider.name : d.name;
        ctx.font = '700 ' + Math.round(11 * s) + 'px "Cinzel", Georgia, serif';
        w = Math.max(w, ctx.measureText(name.toUpperCase()).width) + 24 * s;
        const lh = 19 * s, h = lines.length * lh + 30 * s;
        let x = q.x - w / 2, y = q.y - (b.role === 'wizard' ? 118 : 98) * s - h;
        // keep clear of the panels along the top of the screen
        x = U.clamp(x, m, W - w - m); y = U.clamp(y, 250 * s, H - h - m);
        ctx.globalAlpha = fade;
        ctx.fillStyle = b.role === 'dragon' ? 'rgba(30,8,6,0.9)' : 'rgba(14,10,8,0.9)';
        K.rrect(ctx, x, y, w, h, 8 * s); ctx.fill();
        ctx.strokeStyle = F.color; ctx.lineWidth = 1.6 * s; ctx.stroke();
        // the tail toward the speaker
        const tx = U.clamp(q.x, x + 16 * s, x + w - 16 * s);
        ctx.beginPath(); ctx.moveTo(tx - 7 * s, y + h); ctx.lineTo(tx + 7 * s, y + h); ctx.lineTo(U.clamp(q.x, tx - 18 * s, tx + 18 * s), y + h + 12 * s); ctx.closePath();
        ctx.fillStyle = b.role === 'dragon' ? 'rgba(30,8,6,0.9)' : 'rgba(14,10,8,0.9)'; ctx.fill();
        ctx.textAlign = 'left';
        ctx.font = '700 ' + Math.round(11 * s) + 'px "Cinzel", Georgia, serif'; ctx.fillStyle = F.color;
        ctx.fillText(name.toUpperCase(), x + 12 * s, y + 17 * s);
        ctx.font = (b.role === 'dragon' ? '800 ' : '700 ') + Math.round(15 * s) + 'px "Alegreya Sans", "Segoe UI", sans-serif'; ctx.fillStyle = '#fff4dc';
        lines.forEach((l, i) => ctx.fillText(l, x + 12 * s, y + 36 * s + i * lh));
      }
      ctx.restore();
    },
  };
  V.init();
  AS.Voices = V;
})(window.AS);
