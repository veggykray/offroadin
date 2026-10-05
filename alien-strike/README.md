# ALIEN STRIKE

A top-down tactical gunship campaign for the browser. You fly the **Vesper**, an
alien-tech hover gunship, across ten hostile worlds: rescuing survivors, hauling
cargo, breaking defence networks and taking down the machines and creatures of the
ancient Choir. Fuel, ammunition, armour and passenger seats are all limited, so
every sortie is a resource puzzle.

Everything is plain HTML5 Canvas + WebAudio + JavaScript with no build step, no
dependencies and no backend.

## Running

The game runs from `index.html`.

* **Recommended:** serve the folder over HTTP so that the voice files and any
  recorded audio overrides load:
  ```bash
  cd alien-strike
  python3 -m http.server 8000      # then open http://localhost:8000/
  ```
* **Double-click `index.html`:** this works too (`file://`). Voice lines play
  through `<audio>` elements; synthesized sound effects and music work as normal.

Progress is saved automatically to `localStorage`. Options and key bindings are
saved separately, so starting a new campaign keeps them.

Handy URL parameters for development:
`?mission=w3m2` jumps straight into a mission, `&god=1` makes you invulnerable and
`&fps=1` shows a frame-time / pool readout.

## Controls

The default scheme is **twin-stick**: you move with the keys and aim with the
mouse, independently. The craft turns its nose toward your aim and banks into
every manoeuvre, so you can strafe sideways or back away while firing.

| Input | Action |
|---|---|
| **W / A / S / D** | Move up / left / down / right on screen |
| **Mouse** | Aim. The craft faces the cursor |
| **Left mouse** | Primary weapon |
| **Right mouse** | Secondary weapon. Hold over a target to paint missile locks |
| **Space** | Special weapon |
| **Shift** | Boost (burns extra fuel) |
| **E (hold)** | Retrieval beam: lift survivors and cargo; also opens bunkers, scans and runs consoles |
| **R** | Use a repair kit |
| **M** | Tactical map |
| **Tab** | Tap to pin the objective list open, hold to peek |
| **C** | Cycle control scheme: Twin-stick, Assault (nose follows the mouse, W/S thrust) or Classic (A/D rotate, Q/F strafe) |
| **Esc / P** | Pause |

Gamepads work too: left stick moves, right stick aims, RT and LT fire primary and
secondary, RB fires the special, hold A for the beam, LB boosts, Y repairs, X
shows objectives, Back opens the map and Start pauses. Every key can be rebound
under **Options → Controls**.

## Playing

* **Hull** does not regenerate. **Shields** recharge after a few seconds without
  taking damage. Energy weapons drain shields faster, and explosive, bio and impact
  damage partly bypass them to hit the hull.
  Fuel cans, armour plates and ammo crates are scattered across every map, and
  friendly pads repair, refuel and rearm you.
* **Fuel:** the ship's AI warns you at 50%, 25% and 10%. At zero you get a short emergency
  reserve with sluggish handling, so you can still glide to a pad or a fuel can.
* **Retrieval beam:** hover over a survivor (or a piece of cargo) and **hold E**.
  The beam locks on over about two seconds: small drift is fine, but flying fast
  or wobbling makes it unstable and slows the lock, and leaving the beam radius
  breaks it (progress decays, it doesn't reset straight away). Survivors notice
  you, wave, gather under the emitter and rise up the beam. The passenger bay has
  a fixed number of seats, so ferry people to the landing zone or a friendly pad.
* **HUD:** hull, shield and fuel sit as three slim bars top-left; weapons, ammo and
  counters (seats, cargo, kits) bottom-right; the current objective is one line
  top-right (**Tab** expands it). Missile locks are drawn on the targets
  themselves, and short tips appear the first few times you need a control.
* **Objectives:** primaries must be completed. Secondaries pay extra salvage, and
  hidden objectives turn up through exploration. Objectives affect each other:
  destroying a comm relay stops enemy reinforcements, knocking out a power plant
  shuts down its turrets, killing a radar blinds the missile batteries, and freeing
  an engineer can open a bunker.
* **Extraction:** once the primaries are complete, fly back to the LZ and land on
  it to end the mission and see your results.
* **Hangar:** salvage pays for upgrades (armour, shields, fuel, engines, cargo,
  scanner and each weapon slot), for new weapons fabricated with tech cores, and for
  repair kits. Upgrades visibly change the gunship.

## Campaign

| # | World | Character |
|---|---|---|
| 1 | Ashen Vale | Dusty basins and canyons where the Choir first awakens. Three fully authored missions plus a boss |
| 2 | Crimson Dunes | Sandstorms, burrowing wyrms and raider columns |
| 3 | Verdant Hive | Jungle canopy, rivers and hive spawners |
| 4 | Frost Reach | Whiteouts, ice-locked survivors and strider walkers |
| 5 | Drowned World | Archipelagos, ocean currents and submersible ambushers |
| 6 | Obsidian Forge | Lava rivers, foundries and volcanic eruptions |
| 7 | Spore Moon | Toxic spore clouds, low gravity and infected colonists |
| 8 | Storm Giant | Floating cloud-islands, wind shear and lightning |
| 9 | Dead Machine | A planet-sized machine with power grids and repair swarms |
| 10 | First World | The Choir homeworld and the final confrontation |

Each world has 3 missions (30 in total), its own palette, terrain generator,
props, enemies, hazards, ambience, music and boss.

## Project layout

```
index.html            entry point (loads every script in order)
UI/                   style.css, HUD, tactical map, menus/briefing/options, hangar
src/core/             util (math, RNG, noise, pools, spatial hash), input, save
src/gfx/              sprite forge + pixel models, terrain generator, particles, renderer
src/audio/            SFX synth/bank/mixer, procedural layered music, voice playback
src/game/             camera, stats, entities, projectiles, weapons, player,
                      units + AI, structures, items, bosses, hazards, mission script,
                      game loop, campaign/progression
src/debug.js          AS.Debug console helpers (used by the test suite)
src/main.js           app state machine and main loop
data/                 worlds, weapons, upgrades, enemies, structures, voice lines,
                      voice manifest, SFX recipes
levels/               levels.js (registry + authoring helpers), world01..world10.js, test.js
assets/               fonts (OFL), icon
audio/voice/          generated radio and briefing voice lines (mp3)
audio/sfx/, audio/music/   drop-in folders for recorded audio (see below)
tools/                test suite, voice generator, art and terrain galleries, profilers
```

All art is generated at load time by the **Sprite Forge** (`src/gfx/forge.js`).
Models (`src/gfx/models*.js`) are stacks of shaded slices rendered at every
rotation into supersampled sprite sheets, lit from a single top-left key light,
then given a rim light and an outline whose weight depends on the object's role
(hero, unit, prop, decor). `tools/ART_GUIDE.md` describes the model format and
the art direction, `tools/gallery.html` shows every model and
`tools/terrain.html` previews every world's terrain.

The world is built in layers: terraced terrain with lit cliff faces, cast shadows
and ambient occlusion (`src/gfx/terrain.js`); clustered rock formations and
vegetation; ground decals for craters, scorch, crash trenches, plazas, roads and
building foundations (`src/gfx/decals.js`); large landmark set pieces placed per
world and per mission (`src/game/landmarks.js`, `data/landmarks.js`); and an
atmosphere pass with drifting cloud shadows, a key-light glow and distance haze
(`src/gfx/atmosphere.js`). Explosions, weapon fire and the retrieval beam light
the ground around them.

## Audio hooks

* **Sound effects:** every effect in `data/audio.js` is synthesized from a recipe.
  To use a recorded file, add `file: 'audio/sfx/<name>.ogg'` to that entry. It loads
  when served over HTTP, and the recipe stays as the fallback.
* **Music:** each world's `music` block in `data/worlds.js` drives the procedural
  score (explore → combat → battle → boss layers, plus victory and fail stingers).
  To use recorded music, add
  `files: { explore: 'audio/music/w1_explore.ogg', combat: …, battle: …, boss: …, victory: …, fail: … }`.
  Looping stems start in sync and crossfade with combat intensity. Any stem you
  leave out falls back to the generator.
* **Voice:** lines are defined in `data/voice.js` (shared lines) and in each
  mission's `lines` and `briefing.narration` (mission lines). Audio lives in
  `audio/voice/<id>.mp3` and is listed in `data/voice_manifest.js`. A line without a
  file still shows its subtitle and plays a radio blip. To regenerate the files
  (offline Piper TTS and an ffmpeg radio chain), run
  `python3 tools/gen_voice.py --models <piper voices dir>`. To use recorded
  performances, drop them in as `audio/voice/<id>.mp3` and rerun the script. It
  keeps existing files unless you pass `--force`, and rebuilds the manifest.

## Adding missions

Missions are pure data. Call `AS.Levels.add({...})` in a `levels/worldNN.js` file
with:

* `map` (size and seed), `start`, `extraction`
* `briefing`: situation, narration, threats, intel and map marks
* `entities`: units, structures, survivor groups, cargo, pickups and props. The
  `AS.L` helpers (`outpost`, `fob`, `cache`, `ring`, `patrol`, `fill`) build common
  layouts
* `objectives` (`destroy`, `rescue`, `deliver`, `scan`, `interact`, `escort`,
  `intercept`, `reach`, `defend`, `survive`, `boss`…) with `cat`
  primary/secondary/hidden
* `triggers`: `when` conditions (`destroyed`, `objective`, `enter`, `interacted`,
  `time`, `bossHp`, `all/any/not`…) mapped to `do` actions (`say`, `activate`,
  `spawn`, `unlock`, `unpower`, `padOn`, `reinforce`, `markMap`…)
* `reinforcements` (which comm structures enable them, squads, spawn points)
* `lines`: mission radio lines

`levels/world01.js` is the most complete example.

## Testing

`tools/test_game.mjs` is an end-to-end Playwright suite. It covers a new campaign,
twin-stick movement, strafing and aiming, shooting (primary, missiles, special),
enemy AI, damage, shields, pickups, fuel and ammo depletion, survivor detection,
the retrieval beam (lock, interruption, partial progress, multiple retrievals,
seat capacity, cargo), consoles, the objective panel, rescue and delivery,
extraction, success and failure, the hangar, buying and applying upgrades,
save/load, moving between missions and loading, playing and extracting every one
of the 30 missions. It fails on any console error or failed request.

```bash
cd alien-strike
python3 -m http.server 8766 --bind 127.0.0.1 &
node tools/test_game.mjs            # optional: SHOTS=/some/dir for screenshots
node tools/sweep.mjs                # quick load-and-fly pass over every mission
```

## Credits

Fonts: Orbitron, Chakra Petch and Share Tech Mono (SIL Open Font License, see
`assets/fonts/OFL.txt`). Voice lines are synthesized with Piper neural TTS. All
code, art, sound and music is original and generated by the game.
