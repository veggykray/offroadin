/* WYRMCROWN — CONQUEST campaign state.
 * The one plain-data record a campaign is (everything that is saved), and the
 * constructor for a new one. JSON-safe by design: no class instances, no
 * functions, no cyclic references. Live runtime objects (a running realm,
 * troop entities, the dragon) are built FROM this record and write results back
 * to it; they are never stored in it.
 *
 * World generation is not implemented yet: a new campaign carries its seed
 * and its Dragon Lords; `world.generated` stays false until the generator
 * (Phase 2+) fills `world.islands`, `territories` and `sites`.
 *
 * @typedef {Object} CampaignState
 * @property {string} schema   'wyrmcrown.conquest'
 * @property {number} version  save-schema version (core/save.js SCHEMA_VERSION)
 * @property {string} id       unique campaign id
 * @property {number} seed     world seed (32-bit)
 * @property {number} created  ms since epoch
 * @property {number} updated  ms since epoch
 * @property {number} playTime seconds played
 * @property {{difficulty:string}} settings
 * @property {{allegiance:string, leadership:number, renown:number,
 *             dragon:{level:number, xp:number, perks:string[]},
 *             wizard:{level:number, xp:number, spells:string[]}}} hero
 * @property {{gold:number, day:number}} economy
 * @property {{stacks:{troop:string,count:number}[], ship:{owned:boolean, at:(string|null)}}} army
 * @property {{generated:boolean, w:number, h:number, islands:Object[], explored:(string|null), progress:number}} world
 * @property {Object<string,{kind:string, owner:string, island:(number|null)}>} territories
 * @property {Object<string,{kind:string, stock:Object<string,number>, restockDay:number}>} sites
 * @property {{lords:{id:string, allegiance:string, stronghold:(string|null), defeated:boolean}[], minor:Object<string,{allegiance:string,captured:boolean}>}} objectives
 * @property {Object<string,*>} flags
 * @property {{battles:number, won:number, recruited:number, captured:number}} stats
 */
'use strict';
(function (AS) {
  const C = AS.Conquest, D = C.Data;
  const Campaign = {
    /* a fresh campaign: the player's allegiance, little gold, no army, one to three Dragon Lords */
    create(o) {
      o = o || {};
      const seed = (o.seed !== undefined ? o.seed : Math.floor(Math.random() * 4294967296)) >>> 0;
      const rng = new AS.U.RNG(seed ^ 0x9e3779b9);
      const allegiance = D.allegiances[o.allegiance] && D.allegiances[o.allegiance].playable ? o.allegiance : 'human';
      // how many Dragon Lords, and of which rival realms
      let roll = rng.next(), lordCount = 1;
      for (const [n, p] of D.lordCountOdds) { if (roll < p) { lordCount = n; break; } roll -= p; }
      const rivals = D.realmKeys.filter((k) => k !== allegiance);
      const lords = [];
      while (lords.length < lordCount && rivals.length) {
        const k = rivals.splice(Math.floor(rng.next() * rivals.length), 1)[0];
        lords.push({ id: 'lord_' + k, allegiance: k, stronghold: null, defeated: false });
      }
      const now = Date.now();
      return {
        schema: 'wyrmcrown.conquest',
        version: C.Save ? C.Save.SCHEMA_VERSION : 1,
        id: 'c' + seed.toString(36) + '-' + now.toString(36),
        seed, created: now, updated: now, playTime: 0,
        settings: { difficulty: o.difficulty || 'normal' },
        hero: {
          allegiance, leadership: C.Rules.CFG.baseLeadership, renown: 0,
          dragon: { level: 1, xp: 0, perks: [] },
          wizard: { level: 1, xp: 0, spells: [] },
        },
        economy: { gold: C.Rules.CFG.startGold, day: 1 },
        army: { stacks: [], ship: { owned: false, at: null } },
        world: { generated: false, w: 0, h: 0, islands: [], explored: null, progress: 0 },
        territories: {},
        sites: {},
        objectives: { lords, minor: {} },
        flags: {},
        stats: { battles: 0, won: 0, recruited: 0, captured: 0 },
      };
    },
    /* the campaign is won when every Dragon Lord's stronghold has fallen */
    isWon(state) { return state.objectives.lords.length > 0 && state.objectives.lords.every((l) => l.defeated); },
    summary(state) {
      return {
        allegiance: state.hero.allegiance, day: state.economy.day, gold: state.economy.gold,
        leadership: C.Rules.leadershipUsed(state.army) + ' / ' + state.hero.leadership,
        troops: state.army.stacks.reduce((n, s) => n + s.count, 0),
        lords: state.objectives.lords.map((l) => l.allegiance + (l.defeated ? ' (fallen)' : '')),
        progress: D.progression[state.world.progress] ? D.progression[state.world.progress].name : '?',
      };
    },
  };
  C.Campaign = Campaign;
})(window.AS);
