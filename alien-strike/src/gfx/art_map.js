/* ALIEN STRIKE — art integration map.
 * Points data entries at the redesigned model generators (src/gfx/models_*.js).
 * Each entry only applies when its generator exists, so a missing or broken
 * models file degrades to the original art instead of breaking a mission.
 *   enemies / structures / bosses: key -> { gen, opt, pal, anims, dirs, gunZ }
 *   obstacle: world key -> { gen, opt }   (replaces that world's default obstacle)
 *   landmark: landmark key -> { gen, opt } (overrides data/landmarks.js)
 *   other: gun / pickup / cargo / prop / dropship / kharad_seg / tempest_seg / refcore
 * apply() runs once, before the first mission builds any sheets. */
'use strict';
(function (AS) {
  const has = (g) => !!(g && AS.Models[g]);

  const ArtMap = {
    enemies: {},
    structures: {},
    bosses: {},
    obstacle: {},
    landmark: {},
    other: {},
    applied: false,

    patchModel(def, m) {
      if (!def || !m || !has(m.gen)) return false;
      const cur = def.model || {};
      def.model = {
        gen: m.gen,
        pal: m.pal !== undefined ? m.pal : cur.pal,
        opt: m.opt !== undefined ? m.opt : {},
        anims: m.anims !== undefined ? m.anims : cur.anims,
        dirs: m.dirs !== undefined ? m.dirs : cur.dirs,
      };
      if (m.gunZ !== undefined) def.gunZ = m.gunZ;
      return true;
    },

    apply() {
      if (this.applied) return;
      this.applied = true;
      const D = AS.Data;
      let n = 0;
      for (const k in this.enemies) if (this.patchModel(D.enemies[k], this.enemies[k])) n++;
      for (const k in this.structures) if (this.patchModel(D.structures[k], this.structures[k])) n++;
      if (AS.Bosses && AS.Bosses.DEFS) for (const k in this.bosses) if (this.patchModel(AS.Bosses.DEFS[k], this.bosses[k])) n++;
      for (const k in this.landmark) {
        const m = this.landmark[k], d = D.landmarks && D.landmarks[k];
        if (d && has(m.gen)) { d.gen = m.gen; if (m.opt) d.opt = Object.assign({}, d.opt || {}, m.opt); n++; }
      }
      for (const w of D.worlds) {
        const m = this.obstacle[w.key];
        if (m && has(m.gen) && w.obstacle) { w.obstacle.kind0 = w.obstacle.kind; w.obstacle.gen = m.gen; w.obstacle.genOpt = m.opt || {}; n++; }
      }
      this.count = n;
    },

    /* generator for an "other" slot, or null to keep the original */
    gen(slot) { const m = this.other[slot]; return m && has(m.gen) ? m : null; },
  };

  AS.ArtMap = ArtMap;
})(window.AS);
