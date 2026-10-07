/* Supplied stereo soundtrack; streams through the existing music/voice mixer.
 * Two decks crossfade complete compositions, rather than layering unrelated
 * home and fight tunes. The procedural music generator is not loaded here. */
'use strict';
(function (AS) {
  const FADE = 2.5, FIGHT_HOLD = 9;
  const Music = {
    A: null, ctx: null, out: null, decks: [], active: null, loading: null,
    world: null, realm: 'human', menu: true, playing: false, target: 0,
    intensity: 0, combatUntil: 0, ending: false, requested: null, retryAt: 0,
    attach(audio) {
      if (this.ctx) return;
      this.A = audio; this.ctx = audio.ctx;
      this.out = this.ctx.createGain(); this.out.gain.value = .9;
      this.out.connect(audio.musicDuck);
      this.decks = [0, 1].map(() => {
        const element = new window.Audio();
        element.preload = 'auto'; element.loop = false; element.playbackRate = 1;
        const source = this.ctx.createMediaElementSource(element), gain = this.ctx.createGain();
        gain.gain.value = 0; source.connect(gain); gain.connect(this.out);
        return { element, source, gain, key: null, stopAt: 0 };
      });
      if (this.playing) this.sync();
    },
    play(world) {
      const menu = world.key === 'music:menu' || world.id === 210;
      const realm = AS.Data.music.realms[world.realm] ? world.realm : 'human';
      if (this.playing && this.menu === menu && this.realm === realm) return;
      this.world = world; this.realm = realm; this.menu = menu; this.playing = true;
      if (menu) { this.target = 0; this.combatUntil = 0; this.ending = false; }
      this.retryAt = 0;
      this.sync();
    },
    setIntensity(level) {
      if (this.menu || this.ending || AS.App.state !== 'play') return;
      this.target = level;
      if (level > 0) this.combatUntil = (this.ctx?.currentTime || 0) + FIGHT_HOLD;
    },
    wanted() {
      if (this.menu) return AS.Data.music.start;
      const fight = !this.ending && (this.target > 0 || (this.ctx?.currentTime || 0) < this.combatUntil);
      this.intensity = fight ? Math.max(1, this.target) : 0;
      return AS.Data.music.realms[this.realm][fight ? 'fight' : 'home'];
    },
    ramp(deck, value, seconds) {
      const gain = deck.gain.gain, t = this.ctx.currentTime;
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(t);
      else { const current = gain.value; gain.cancelScheduledValues(t); gain.setValueAtTime(current, t); }
      gain.linearRampToValueAtTime(value, t + seconds);
    },
    retire(deck) {
      deck.element.pause(); deck.stopAt = 0;
      deck.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      deck.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    },
    sync(repeat) {
      if (!this.playing) return;
      const key = this.wanted(); this.requested = key;
      if (!this.ctx || this.ctx.state !== 'running' || this.ctx.currentTime < this.retryAt) return;
      if (this.loading && this.loading.key !== key) {
        const obsolete = this.loading; this.loading = null; this.retire(obsolete.deck);
      }
      if (this.loading || (!repeat && this.active?.key === key && !this.active.element.ended)) return;
      const deck = this.decks.find(d => d !== this.active);
      if (!deck || deck.stopAt > this.ctx.currentTime) return;
      this.retire(deck);
      if (deck.key !== key) { deck.element.src = AS.Data.music.tracks[key].file; deck.key = key; deck.element.load(); }
      deck.element.currentTime = 0; deck.element.playbackRate = 1;
      const pending = this.loading = { deck, key };
      deck.element.play().then(() => {
        if (this.loading !== pending) return;
        this.loading = null;
        if (!this.playing || this.wanted() !== key) { this.retire(deck); return; }
        const previous = this.active;
        this.active = deck;
        this.ramp(deck, 1, FADE);
        if (previous && previous !== deck) {
          this.ramp(previous, 0, FADE);
          previous.stopAt = this.ctx.currentTime + FADE + .05;
        }
        this.lastError = null;
      }).catch(error => {
        if (this.loading !== pending) return;
        this.loading = null; this.retire(deck); this.retryAt = this.ctx.currentTime + 2;
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
          this.lastError = { track: key, message: error.message };
          console.warn('Supplied music could not play', key, error.message);
        }
      });
    },
    stop() {
      this.playing = false; this.requested = null; this.world = null;
      this.target = 0; this.intensity = 0; this.combatUntil = 0; this.ending = false;
      if (this.loading) { const pending = this.loading; this.loading = null; this.retire(pending.deck); }
      if (this.ctx) for (const deck of this.decks) {
        if (deck.element.paused) this.retire(deck);
        else { this.ramp(deck, 0, .25); deck.stopAt = this.ctx.currentTime + .3; }
      }
      this.active = null;
    },
    stinger() {
      // Victory/defeat SFX remain on the effects bus. Return the score to the
      // supplied home theme; no old synthesized musical sting is scheduled.
      this.ending = true; this.target = 0; this.combatUntil = 0; this.sync();
    },
    update() {
      if (!AS.Data.music) return;
      if (this.ctx) for (const deck of this.decks) if (deck.stopAt && deck.stopAt <= this.ctx.currentTime) this.retire(deck);
      const state = AS.App.state;
      if (!['play', 'paused', 'results', 'loading'].includes(state)) {
        if (!this.playing || !this.menu) this.play({ id: 210, key: 'music:menu', realm: 'human' });
      }
      if (!this.ctx) return;
      this.out.gain.setTargetAtTime(state === 'paused' || AS.App.overlay ? .3 : .9, this.ctx.currentTime, .3);
      if (state === 'results') this.ending = true;
      this.sync();
      // Blend the final 2.5 seconds into a fresh copy for continuous looping.
      const element = this.active?.element;
      if (element && this.active.key === this.requested && !this.loading && Number.isFinite(element.duration)
          && element.duration > FADE*2 && (element.ended || element.currentTime >= element.duration-FADE)) this.sync(true);
    },
  };
  AS.Music = Music;
})(window.AS);
