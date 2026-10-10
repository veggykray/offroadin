/* WYRMCROWN — INDEPENDENT GROUND ARMIES: namespace.
 * Ground armies that act on their own orders while the dragon is elsewhere:
 * follow the dragon, hold, move, attack, defend a captured place, retreat to
 * safety, and enter ground-only passages (tunnels, caves) the dragon cannot.
 *
 * Isolated like conquest/: nothing in the battle game, the campaign or the
 * dragon references AS.Armies, and index.html does not load it. It reads only
 * AS.U (util.js), AS.Data.troops (data/buildings.js) and AS.Conquest.Data.troops
 * (conquest/data/troops.js) — the troop statistics are never redefined here.
 *
 * Load order: armies.js → core/stats.js → core/ground.js → core/autoresolve.js
 *             → core/orders.js → core/sim.js → data/*.js
 * See wyrmcrown/armies/ARCHITECTURE.md. */
'use strict';
(function (AS) {
  AS.Armies = AS.Armies || {
    Stats: null,       // troop profiles from the existing troop data
    Ground: null,      // GroundMap: walking grid, passages, routes, reachability
    AutoResolve: null, // battles nobody watches (or the dragon cannot reach)
    Orders: null,      // order records and their validation
    Sim: null,         // ArmySim: the armies in play, near and far
    Scenarios: {},     // test scenarios (data)
  };
})(window.AS);
