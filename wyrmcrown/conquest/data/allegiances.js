/* WYRMCROWN — CONQUEST data: allegiances.
 * The four dragon realms of the battle mode (their names, colours and looks
 * are read from AS.Data.factions at runtime, never copied) plus the
 * allegiances that only exist in the campaign: neutral creatures and folk,
 * and the minor independent strongholds.
 *
 * @typedef {Object} Allegiance
 * @property {string} key            'human' | 'elf' | 'ice' | 'undead' | 'neutral' | 'independent'
 * @property {boolean} realm         one of the four dragon realms (can field a Dragon Lord)
 * @property {boolean} playable      the player may ride for it
 * @property {Object<string,number>} neutralCost  for a neutral troop type tag, the recruiting
 *                                   cost multiplier for a player of this allegiance (missing = 1)
 */
'use strict';
(function (AS) {
  const D = AS.Conquest.Data;
  D.allegiances = {
    human: { key: 'human', realm: true, playable: true, neutralCost: { beast: 1, brute: 1.15, giant: 1.2, fey: 1.35, dead: null } },
    elf: { key: 'elf', realm: true, playable: true, neutralCost: { beast: 0.9, brute: 1.3, giant: 1.3, fey: 0.85, dead: null } },
    ice: { key: 'ice', realm: true, playable: true, neutralCost: { beast: 1, brute: 0.95, giant: 0.9, fey: 1.4, dead: null } },
    undead: { key: 'undead', realm: true, playable: true, neutralCost: { beast: 1.2, brute: 1.1, giant: 1.25, fey: null, dead: 0.8 } },
    // campaign-only allegiances
    neutral: { key: 'neutral', realm: false, playable: false, neutralCost: {} },          // wild creatures, free folk, bandits
    independent: { key: 'independent', realm: false, playable: false, neutralCost: {} },  // minor strongholds owing no realm
  };
  D.realmKeys = ['human', 'elf', 'ice', 'undead'];
  // display data comes from the battle mode's faction table (single source of truth)
  D.allegianceName = (k) => (AS.Data.factions[k] ? AS.Data.factions[k].name : k === 'neutral' ? 'The Free Wilds' : 'Independent');
})(window.AS);
