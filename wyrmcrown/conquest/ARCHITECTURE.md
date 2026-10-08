# Conquest — architecture notes

Conquest is a single-player campaign mode built on top of the existing Dragon Wars
(WYRMCROWN) battle game. This file records what the codebase offers, how Conquest
is kept apart from it, and the technical risks found while laying the foundation.

## The existing codebase (as inspected)

* **No build step.** Plain browser JavaScript; every file is an IIFE that adds to one
  global namespace, `window.AS`, loaded in order by `wyrmcrown/index.html`. The shared
  engine lives in `alien-strike/` (from an earlier game); WYRMCROWN-specific code in
  `wyrmcrown/`. (The repo-root `package.json`, `tsconfig.json`, `src/` and `tools/`
  belong to a separate Three.js project and are not part of this game.)
* **Rendering.** Canvas 2D (`alien-strike/src/gfx/renderer.js`): a world buffer at a
  resolution-scaled size, terrain drawn from 256-unit raster chunks
  (`gfx/terrain.js`, `wyrmcrown/src/gfx/realm_terrain.js`), y-sorted sprite drawables,
  a light buffer, and the HUD drawn at native resolution. Sprites are pre-rendered
  "stacked slice" sheets (`gfx/forge.js`) built lazily and in background workers
  (`wyrmcrown/src/gfx/forge_worker.js`); terrain chunks are shaded in workers
  (`terrain_worker.js`).
* **Main loop.** `wyrmcrown/src/main.js` (`AS.App`): one requestAnimationFrame loop,
  states `boot | loading | play | paused | results`, variable dt clamped at 50 ms.
* **The world.** `AS.Realm` (`src/game/realm.js`) owns everything in a match: map,
  terrain, factions, dragons, troops, buildings, sites, life, projectiles, camera,
  spatial grid (`AS.U.Grid`, 128 units), fog of war (96-unit cells), ground navigation
  (`src/game/nav.js`, 64-unit cost grid with A*).
* **Maps.** Pure data (`wyrmcrown/maps/mapNN.js`, registry `maps/maps.js`): size, seed,
  four faction regions + neutral regions, rivers, lakes, ridges, forests, roads,
  bridges, sites, herds. All 10 maps are 4-realm, square, 9 600–11 000 units.
* **Dragons.** `src/game/dragon.js`: flight model driven by an *input record* filled by a
  *pilot* each frame — `AS.HumanPilot` (`pilot.js`, keyboard/mouse/pad) or
  `AS.AIPilot` (`ai.js`). The camera (`alien-strike/src/game/camera.js`) follows
  `realm.player` with lead and speed zoom.
* **Troops.** `src/game/troops.js` (`AS.Troop`): roles from `AS.Data.troops`
  (data/buildings.js), looks from model generators; a small state machine
  (`guard | garrison | patrol | march | haul`), targets via `realm.nearestFoe`,
  routes via `AS.Nav`.
* **Combat.** `src/game/combat.js`: wizard bolts, breath cones, tower/archer/siege shots,
  damage resolution; `realm.hostile(a, b)` (team test, honours truces).
* **Objectives.** `src/game/sites.js`: neutral sites with guardians, capture by presence,
  income by cart, defences; win/lose in `src/game/faction.js` (wards + stronghold).
* **Persistence.** `alien-strike/src/core/save.js`: localStorage profile + settings
  (`wyrmcrown.profile.v1`, `wyrmcrown.settings.v1`), merged onto defaults.
* **Tests.** `wyrmcrown/tools/test_game.mjs` (Playwright, 17 end-to-end checks),
  `sim.mjs` (fast-forwarded all-AI war), audio contract tests.

## How Conquest is kept apart

```
wyrmcrown/conquest/
  conquest.js          AS.Conquest namespace
  data/allegiances.js  realms + neutral + independent; neutral recruiting costs
  data/troops.js       troop types: fixed stats by reference to AS.Data.troops,
                       leadership, cost, wage, recruitment sites, look (model gen)
  data/sites.js        recruitment sites, capturable territories, progression
                       template, objective kinds, Dragon Lord count odds
  data/world.js        (Phase 2) all generator / clock / economy tuning: garrison
                       budgets per tier, rewards, hours per action, ship cost, lairs
  core/rules.js        pure rules: leadership, wages, income, recruitment, day tick
  core/worldgen.js     (Phase 2) the seeded archipelago: graph first, then layout;
                       validate() checks every progression guarantee
  core/world.js        (Phase 2) the campaign map in play: movement, fog, the clock,
                       hiring, the ship, captures, battle results, victory
  core/campaign.js     the campaign state record (JSON-safe) and its constructor
  core/save.js         versioned saves (schema v2, migrations, validation, slots)
  core/battle.js       (Phase 2) a site fought in the real-time engine: battle
                       config + local island map, the realm callbacks, the result
  ui/map.js            (Phase 2) the campaign map canvas (islands, fog, routes, icons)
  ui/screen.js         slots and the campaign map screen (panels, briefing, results)
```

Rules for this folder:

1. **One-way dependency.** Conquest may *read* battle-mode registries (`AS.Data.*`,
   `AS.U`, `AS.Models`, `AS.UIKit`) and, later, *instantiate* battle-mode classes
   (`AS.Realm`, `AS.Troop`, `AS.Dragon`). The battle mode never references
   `AS.Conquest` (the only hooks are a guarded title-menu button and a guarded URL
   entry). Deleting the conquest `<script>` tags restores the original game exactly.
2. **State is data.** The campaign is one JSON-safe record. Runtime objects (a running
   realm, entities) are built from it and write results back; they are never saved.
3. **Rules are pure** and tested in Node without a browser (`tools/test_conquest.mjs`).
4. **Changes to shared code** happen only through small, opt-in extension points
   (an option defaulting to today's behaviour), each covered by the existing
   end-to-end suite.

## Technical risks found

1. **Realm assumes four faction towns.** `Realm.load`, `AS.Faction`, the AI and win/lose
   expect `map.factions` with four realms, towns and wardstones. A Conquest battlefield
   (one player dragon, a garrison, maybe no rival dragon) needs `Realm` options to run
   with fewer or no factions — or a slimmer "battle on an island" realm. This is the
   biggest integration point.
2. **The player dragon is assumed human-piloted.** `realm.player` is the camera
   target, HUD subject and input reader. Switching to Commander Mode means giving the
   player's dragon an AI-style pilot that follows orders (the pilot abstraction makes
   this feasible) and pointing the camera at a free-moving commander target instead.
   The camera currently follows `realm.player`/`focus` only.
3. **Troops have no notion of orders or selection.** `AS.Troop` targets the nearest
   foe and marches on paths; there is no per-unit command queue, formation, hold
   position, or selection state, and the HUD has no box-select. Orders need a new
   layer in front of the troop state machine (without changing default behaviour).
4. **Input is shared and global.** Left/right mouse are bolts/breath; a commander mode
   needs its own mouse mapping (select, order) and must not leak clicks into flight.
5. **Map size.** Terrain lookup grids are 32-unit cells over the whole map
   (≈ 6 Float32 grids + biome×5); at 9 600² that is ~1.3 M cells. An archipelago
   several times larger costs memory and build time linearly (and the nav grid, fog
   and `buildMap` with it). Campaign islands should load as **separate realms**
   (one island or island group at a time) rather than one huge map.
6. **Procedural maps.** Maps are hand-authored data. A generator must emit the same
   map format (regions, coasts as water, rivers, bridges, roads, sites, herds) so the
   existing terrain, nav and site code can consume it; coastline/sea is expressed
   today only as lakes and rivers — a sea-surrounded island needs a "water outside
   the land mask" mode in `realm_terrain`.
7. **Persistence quota.** localStorage is ~5 MB per origin. Fog of war and world
   state for an archipelago must be compact (run-length or bit-packed strings).
8. **Sea travel and ships** have no existing counterpart (no water units or naval
   pathing).
9. **Art gaps.** No wyvern model exists (the Wyvern troop is defined with `gen: null`);
   ships, harbours and farmsteads have no models yet.
10. **Performance.** The game is canvas-bound; RTS views (many units on screen,
    zoomed out) multiply draw cost. Commander Mode should keep the zoom range of the
    battle mode or add level-of-detail drawing.

## Phase 2 (implemented): the archipelago and the playable campaign loop

**World generation (core/worldgen.js).** Graph first: five home zones in
progression order (start → early → frontier → castle country → harbour coast),
joined by gate sites (one or two bridges, then a bridge or a fort, then a road or
a bridge, then the castle, which is the only way to the harbour). Outer islands
(2–5) are joined to the harbour and to each other by sea routes; each Dragon Lord
has an island joined only to the outer islands. Details vary per seed: landmass
style (mainland / chain / long / isles), site counts and kinds, occupiers
(bandits, monsters, independents, other realms' remnants, the Lords' vassals),
garrisons, hiring, free villages, island count, routes and orientation. The
same seed always gives the same world. `validate()` checks 17 guarantees (start,
starter hiring and income, two exits, bridge and castle gates, harbour by land,
ship, sea routes, Lords only by sea, nothing isolated, owners, armies, stock,
rising threat, models, size, readability); a failing build is rebuilt from a
derived sub-seed. Tested on 1,000 seeds: 0 unrecoverable.

**What is saved.** The static world is regenerated from the seed. The save holds
only what play changes: owners (`territories`), garrisons and stock (`sites`),
discovered ids, the army (stacks, position, ship), gold and the clock (day,
hour), leadership, Lords' and strongholds' fates, flags, stats and a short log —
about 8–10 KB. Schema v2; v1 (Phase 1) saves migrate by generating their seed's
world.

**The clock.** Actions take campaign hours (march 6, sea 24, battle 6, hire 1).
At each midnight holdings pay, troops are paid and unpaid troops desert
(Phase 1 rule), stock refills on schedule — all logged. No wall-clock time.

**Battles (core/battle.js).** `opts.conquest` on `AS.Realm` (opt-in): the map is
a generated record in the normal map format (one island in a sea made of the
terrain's existing lake + island shapes; a river and bridge for bridge sites);
the player's faction gets a camp (roost) instead of a town; the defenders are
spawned as the battle site's guards (or around a Dragon Lord's full realm town
with its AI lord and dragon); the army lands and marches. Victory is the battle
mode's own capture/loot/elimination; defeat is the dragon driven down or a
retreat (pause menu). Every unit carries its campaign troop type, so survivors
and casualties are exact. Hooks in battle mode: realm.js (camp, setup, update,
diplomacy/victory skip), main.js (map record, result routing, court disabled),
screens.js (Retreat in the pause menu), hud.js (no court prompt), ai.js /
advisor.js (skip a rival without a keep). Without `opts.conquest` nothing changes.

## Known limitations (Phase 2)

* The Dragon Lords never leave their islands, and enemy holdings do not counter-
  attack yet: the world changes only by the player's actions.
* No random travel encounters.
* Per-type stat multipliers apply to hp, melee damage, range and speed; flying
  (wyvern) is not modelled in battle — wyverns fight on foot with a stand-in model.
* At most 120 of the army's units take the field at once; the rest wait in reserve
  (and survive).
* Missing dedicated art (stand-ins used): farmstead (village site), harbour and
  landing (trade post site), ship (map icon only), wyvern (fallback model).

## Phase 3 foundations

The battle configuration, per-unit campaign troop types, exact result payloads
and the camp/army spawning in core/battle.js are where Commander Mode plugs in:
selection and orders act on `g.cq.army`; a commander camera and an order-
following pilot for the player's dragon replace HumanPilot only when the battle
config asks for it.
