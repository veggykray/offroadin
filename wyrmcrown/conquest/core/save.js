/* WYRMCROWN — CONQUEST saves: a versioned schema.
 * Campaigns are stored apart from the battle mode's profile and settings
 * (different keys, so neither can damage the other), one key per slot:
 *   wyrmcrown.conquest.slot1 … slot3
 * Each save is the campaign state (core/campaign.js) carrying `schema` and
 * `version`. Loading runs it through MIGRATIONS up to SCHEMA_VERSION, then
 * validate(); a save that fails is not loaded (and not overwritten — it is
 * copied to `<key>.damaged` so it can be recovered by hand). A save from a
 * NEWER version than this code is refused rather than misread.
 *
 * To change the schema: bump SCHEMA_VERSION, add MIGRATIONS[oldVersion] that
 * turns a record of that version into the next, and extend validate(). */
'use strict';
(function (AS) {
  const C = AS.Conquest;
  const SCHEMA = 'wyrmcrown.conquest', SCHEMA_VERSION = 1, SLOTS = 3;
  const keyOf = (slot) => SCHEMA + '.slot' + slot;
  // MIGRATIONS[v](record) returns the record upgraded from version v to v + 1
  const MIGRATIONS = {
    // v0 (pre-release prototype records without a version field): rename gold → economy.gold
    0(r) {
      r.economy = r.economy || { gold: r.gold || 0, day: r.day || 1 };
      delete r.gold; delete r.day;
      r.version = 1;
      return r;
    },
  };
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const Save = {
    SCHEMA, SCHEMA_VERSION, SLOTS, keyOf, MIGRATIONS,
    storage: null, // a Storage-like object; defaults to localStorage when available
    store() {
      if (this.storage) return this.storage;
      try { const k = '__wc_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; }
    },
    /* list problems with a record (empty = valid) */
    validate(r) {
      const p = [];
      if (!isObj(r)) return ['not an object'];
      if (r.schema !== SCHEMA) p.push('wrong schema');
      if (r.version !== SCHEMA_VERSION) p.push('version ' + r.version + ' (expected ' + SCHEMA_VERSION + ')');
      if (!(Number.isInteger(r.seed) && r.seed >= 0)) p.push('bad seed');
      if (!isObj(r.hero) || !C.Data.allegiances[r.hero.allegiance] || !(r.hero.leadership > 0)) p.push('bad hero');
      if (!isObj(r.hero && r.hero.dragon) || !isObj(r.hero && r.hero.wizard)) p.push('bad dragon/wizard');
      if (!isObj(r.economy) || !Number.isFinite(r.economy.gold) || !(r.economy.day >= 1)) p.push('bad economy');
      if (!isObj(r.army) || !Array.isArray(r.army.stacks)) p.push('bad army');
      else for (const s of r.army.stacks) if (!isObj(s) || !C.Data.troops[s.troop] || !(Number.isInteger(s.count) && s.count > 0)) { p.push('bad army stack'); break; }
      if (!isObj(r.world) || typeof r.world.generated !== 'boolean') p.push('bad world');
      if (!isObj(r.territories) || !isObj(r.sites)) p.push('bad holdings');
      if (!isObj(r.objectives) || !Array.isArray(r.objectives.lords) || !r.objectives.lords.length) p.push('bad objectives');
      if (!isObj(r.stats) || !isObj(r.flags) || !isObj(r.settings)) p.push('bad bookkeeping');
      return p;
    },
    /* upgrade an older record to the current version (returns null if it cannot) */
    migrate(r) {
      if (!isObj(r)) return null;
      if (r.version === undefined) r.version = 0;
      if (!Number.isInteger(r.version) || r.version > SCHEMA_VERSION) return null; // from a newer game: refuse
      while (r.version < SCHEMA_VERSION) {
        const m = MIGRATIONS[r.version];
        if (!m) return null;
        r = m(r);
      }
      r.schema = r.schema || SCHEMA;
      return r;
    },
    /* text → campaign state, or { error } */
    parse(text) {
      let r;
      try { r = JSON.parse(text); } catch (e) { return { error: 'unreadable' }; }
      if (isObj(r) && Number.isInteger(r.version) && r.version > SCHEMA_VERSION) return { error: 'made by a newer version of the game' };
      r = this.migrate(r);
      if (!r) return { error: 'cannot be upgraded' };
      const p = this.validate(r);
      return p.length ? { error: 'damaged: ' + p.join(', ') } : { state: r };
    },
    serialize(state) { return JSON.stringify(state); },
    save(slot, state) {
      const S = this.store();
      if (!S) return { ok: false, error: 'storage unavailable' };
      const p = this.validate(state);
      if (p.length) return { ok: false, error: 'refusing to save an invalid campaign: ' + p.join(', ') };
      state.updated = Date.now();
      try { S.setItem(keyOf(slot), this.serialize(state)); return { ok: true }; } catch (e) { return { ok: false, error: 'storage full or blocked' }; }
    },
    load(slot) {
      const S = this.store();
      if (!S) return { error: 'storage unavailable' };
      let raw = null;
      try { raw = S.getItem(keyOf(slot)); } catch (e) { return { error: 'storage blocked' }; }
      if (raw === null) return { error: 'empty' };
      const res = this.parse(raw);
      if (res.error && res.error !== 'made by a newer version of the game') { try { S.setItem(keyOf(slot) + '.damaged', raw); } catch (e) { /* best effort */ } }
      return res;
    },
    remove(slot) { const S = this.store(); if (S) try { S.removeItem(keyOf(slot)); } catch (e) { /* ignore */ } },
    /* what each slot holds, for a load screen */
    slots() {
      const out = [];
      for (let i = 1; i <= SLOTS; i++) {
        const r = this.load(i);
        out.push(r.state ? { slot: i, summary: C.Campaign.summary(r.state), updated: r.state.updated } : { slot: i, empty: r.error === 'empty', error: r.error === 'empty' ? null : r.error });
      }
      return out;
    },
  };
  C.Save = Save;
})(window.AS);
