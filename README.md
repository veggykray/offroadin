# Prehistoric Off-Road — Track 1 prototype

Arcade four-racer off-road racing in the spirit of *Super Off Road*, in 3D.
Three.js rendering, Rapier physics, TypeScript, Vite. See `DESIGN.md` for the game
rules and `PROJECT_PLAN.md` / `PROGRESS.md` for architecture and status.

## Run it

```bash
npm install      # first time only
npm run dev      # then open http://localhost:5173
```

## Controls

| Key | Action |
|-----|--------|
| **W / ↑** | Accelerate |
| **S / ↓** | Brake, then reverse |
| **A D / ← →** | Steer |
| **Space** | Nitro (uses one charge) |
| **R** | Reset your car onto the track |
| **Enter** | Restart the race |
| **C** | Toggle camera: whole-track overview (default) / closer follow |
| **M** | Mute |
| **P** | Pause |
| **`** (backquote) or **F3** | Debug panel |

Gamepad: left stick steer, RT accelerate, LT brake/reverse, A nitro, Y reset, Start restart.

### Debug panel (press `)
Shows FPS, physics cost, speed, wheels on the ground, surface, lap/checkpoint, race
position, body position/velocity/spin, suspension and nitro state. Switches (click or
press the number while the panel is open):
`1` colliders · `2` AI racing lines + checkpoints · `3` slow motion · `4` free camera
(mouse orbit) · `5` reset car · `6` restart race · `7` autopilot (AI drives your car).

### URL options
`http://localhost:5173/?car=tuskroller&slot=0&laps=2`

| Option | Meaning |
|--------|---------|
| `car=` | `cindercrest` (default), `saberspring`, `shellfort`, `tuskroller` |
| `slot=0..3` | Grid slot, 0 = inside of the first corner |
| `laps=` | Race length (default 4) |
| `demo=1` | Four AI racers, camera follows the leader |
| `catchup=0` | Disable the subtle catch-up assist |
| `reverse=1` | Run Track 1 backwards (derived automatically from the track data) |

## Changing the track

Everything about Track 1 lives in **`src/track/TrackData.ts`** as named nodes plus
features placed relative to those nodes. Examples:

- *Move the bridge 10 m left* → change `x` of `bridgeNorth` and `bridgeSouth` on the
  `shortcut` path (and the river's `underBridge` node so the gorge follows).
- *Make this corner tighter* → move the corner's apex node (e.g. `corner1Apex`) towards
  the inside.
- *Raise this crest* → increase the `height` of the `crest` feature at `hillTop`
  (or the node's `y`).
- *Widen this straight* → increase `width` on its nodes (`finish`, `straightMid`…).

Useful checks after an edit:

```bash
npm run map     # writes tools/out/map.png, a top-down picture of the course
npm test        # AI must finish forward + reverse races; a keyboard-style driver must finish
npm run sim     # a full headless AI race with lap times, shortcut use and resets (-v for detail)
```

## Vehicle models

Put GLB/GLTF files in **`models/`** (e.g. `models/cindercrest.glb`). They are picked up
automatically and fitted to the physics chassis — see `models/README.md`.

## Project layout

```
src/
  main.ts                 entry point, URL options
  game/                   Simulation (render-free world), Game (browser shell),
                          RaceManager, InputManager, HUD, Audio
  vehicle/                VehicleConfig, Vehicle (physics body), VehicleController
                          (arcade drive model), AIController, VehicleVisual
  track/                  TrackData (EDIT ME), Track (queries), Terrain (heightfield),
                          TrackBuilder (colliders), TrackVisuals, SurfaceManager,
                          reverseTrack
  camera/RaceCamera.ts    overview camera
  physics/PhysicsWorld.ts Rapier wrapper
  pickups/PickupManager.ts
  fx/Particles.ts
  debug/DebugUI.ts
tools/                    headless tests & debug renders (Node / Playwright)
models/                   drop-in vehicle GLBs
```

## Story map (The Long Way Home)

`story-map/index.html` is a standalone, editable branching story map for the
narrative game plan. It starts as a diamond: 1 scene branches into 3, each of
those into 3 more, then the branches rejoin 3-into-1 back to a single ending
(1 → 3 → 9 → 27 → 9 → 3 → 1). Add branches, join scenes, insert or delete
scenes, draw conditional/optional routes, track recurring threads, and zoom
or pan to see the whole map. **New map…** regenerates the shape with other
branch counts and depths.

**Installable app with sync:** with GitHub Pages serving this branch from the
repository root, the app lives at https://veggykray.github.io/offroadin/story-map/
and can be added to a phone or laptop home screen. **☁ Sync devices** connects
it to a GitHub key (classic token with only the `gist` scope); the map then
saves to a secret gist named `long-way-home-map.json`, and every connected
device loads and saves the same map.

Open the file directly in a browser, or through `npm run dev` at
http://localhost:5173/story-map/. Edits are kept in the browser's local
storage; use **Export** to save a `.json` copy and **Import** to load one.
Saving an export over `story-map/map.json` makes it the default map when
served.
