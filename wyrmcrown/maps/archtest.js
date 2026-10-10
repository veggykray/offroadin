/* WYRMCROWN — ARCHITECTURE COMPATIBILITY TEST: six of Astra's revision-3
 * architectural assemblies (src/gfx/arch_p1/, unchanged sources) standing in the
 * game on real terrain. A development scenario; not part of any campaign.
 *
 * The ground is the Mountain Test region, unchanged: this map is a copy of
 * maps/mountaintest.js (same relief, rivers, forests, sites) with its raiders and
 * wolves left out and the six structures added by src/game/archtest.js:
 *
 *   human   level lowland east of the castle fields: the royal fortress (H03) and,
 *           beside it, the jettied merchant courtyard house (H01)
 *   elf     a glade on the gentle slopes of the western foothill forest: the
 *           council citadel (E03) and the elder tree dwelling (E07)
 *   dwarf   the foot of THE WALL west of Khaz Durn: the kingdom gate (D01) backed
 *           against the real cliff, and the great vaulted hall (D04) on the valley floor
 *
 * Positions are GROUND coordinates (as every Mountain Test place); the module
 * projects them onto the relief. ` then 1–0 picks the inspection shortcuts
 * (map.tests, filled in by src/game/archtest.js when the region loads). */
'use strict';
(function (AS) {
  const base = AS.Maps.byId.mountaintest;
  if (!base) return;
  // a clean copy: the Mountain Test projects its places in place on load
  const m = JSON.parse(JSON.stringify(base));
  Object.assign(m, {
    id: 'archtest', name: 'Architecture Compatibility Test', archTest: true,
    blurb: 'Six of the revision-3 architectural assets on real terrain: a castle and a merchant house, an elven citadel and tree dwelling, a dwarven gate and vaulted hall. Development test.',
    encounters: [],
    testMsg: 'ARCHITECTURE TEST — press ` then 1–6 for the six structures, 7–9 high views, 0 unload + reload · Z climbs · X descends',
  });
  m.wild = [];
  for (const s of m.sites) delete s.guard;
  /* the six structures: asset id, ground position, culture (palette), environment.
   * Each faces +Y (south, toward the camera): every one of these is a fixed-facade
   * recipe except the gate (4 headings), which faces out of the cliff. */
  m.archTest = {
    structures: [
      { key: 'A', id: 'p1_h03', name: 'Royal fortress and inhabited bailey', culture: 'human', x: 5600, y: 10150, env: 'level lowland' },
      { key: 'B', id: 'p1_h01', name: 'Jettied merchant courtyard house', culture: 'human', x: 5960, y: 10330, env: 'level lowland' },
      { key: 'C', id: 'p1_e03', name: 'Three crowns and the ancient living council court', culture: 'elf', x: 3150, y: 8650, env: 'forest glade, gentle slope' },
      { key: 'D', id: 'p1_e_treehouse', name: 'Two level elder tree dwelling', culture: 'elf', x: 3640, y: 8440, env: 'forest edge, gentle slope' },
      { key: 'E', id: 'p1_d01', name: 'Kingdom gate and guardian approach', culture: 'dwarf', x: 3000, y: null, env: 'against the Wall', cliff: true, heading: 0 },
      { key: 'F', id: 'p1_d_greathall', name: 'Great vaulted assembly hall', culture: 'dwarf', x: 3420, y: 4470, env: 'valley floor below the Wall' },
    ],
  };
  AS.Maps.byId[m.id] = m; // not in the battle atlas
})(window.AS);
