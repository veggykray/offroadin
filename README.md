# Prehistoric Off-Road — Track 1 prototype

> Also in this repo: [`beast_tending/`](beast_tending/README.md), a standalone
> Godot 4 mini-game (*The Beast Tending*) for Game of Games.

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
