/* WYRMCROWN — CONQUEST mode: namespace.
 * Conquest is a separate single-player campaign (strategic archipelago + the
 * existing real-time combat). It lives entirely under wyrmcrown/conquest/ and
 * only reaches the battle mode through a few read-only registries
 * (AS.Data.factions, AS.Data.troops, AS.U). Nothing in the battle mode
 * depends on anything here: removing the conquest scripts from index.html
 * leaves the battle game exactly as it was.
 *
 * Load order (index.html): conquest.js → data/*.js → core/*.js → ui/*.js.
 * Phase 1 (this foundation) holds data definitions, pure rules, the campaign
 * state and its versioned save, and a placeholder screen. No gameplay yet.
 * See wyrmcrown/conquest/ARCHITECTURE.md. */
'use strict';
(function (AS) {
  AS.Conquest = AS.Conquest || {
    Data: {},     // static definitions (allegiances, troop types, sites, progression)
    Rules: null,  // pure functions: leadership, wages, recruitment, income
    Campaign: null, // campaign state construction
    Save: null,   // versioned persistence
    UI: null,     // screens
  };
})(window.AS);
