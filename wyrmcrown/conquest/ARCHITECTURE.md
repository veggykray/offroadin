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
  core/rules.js        pure rules: leadership, wages, income, recruitment, day tick
  core/campaign.js     the campaign state record (JSON-safe) and its constructor
  core/save.js         versioned saves (schema, migrations, validation, slots)
  ui/screen.js         placeholder mode entry (title menu "Conquest", ?mode=conquest)
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

## Not implemented (by design, Phase 1)

World generation, the campaign map, travel, battles, recruitment UI, Commander Mode,
selection and orders, autonomous dragon, ships, Dragon Lords' behaviour, hero
progression, campaign AI.

## Suggested Phase 2

1. **Archipelago generator (data only).** Seeded generator producing the island graph
   (start island → bridges → frontier → castle → harbour → outer islands → lord
   strongholds) and, per island, a map record in the existing map format. Node-tested:
   determinism, guaranteed progression, reachability rules (lord strongholds by sea
   only).
2. **Island realm option.** Let `AS.Realm` run a map with zero or one faction town and
   sea around the land (`realm_terrain` land mask), behind an option that defaults to
   current behaviour; prove with the existing suite plus a new island smoke test.
3. **Campaign map screen.** Overview of discovered islands, holdings and the army;
   enter an island to play it in real time; results written back to the campaign state.
4. Then (Phase 3) Commander Mode: commander camera, selection, order layer for troops,
   ordered pilot for the dragon — each a separate module.
