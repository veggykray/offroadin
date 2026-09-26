# Project Plan — Prehistoric Off-Road Racer (prototype)

## Goal
One extremely good, playable greybox track (Track 1, Prehistoric World) with four
physical racers (1 player + 3 AI), 4 laps, readable high three-quarter camera.
Gameplay feel first; no menus, accounts, shops or networking.

## Tech
- TypeScript + Vite (npm)
- Three.js (rendering only)
- Rapier 3D (`@dimforge/rapier3d-compat` — the same Rapier engine, packaged with the
  WASM inlined so it works in Vite *and* in Node without bundler plugins; this lets us
  run headless race simulations for automated testing)
- Plain HTML/CSS HUD, no React.

## Architecture
```
src/
  main.ts                 bootstrap (init Rapier, start Game)
  game/
    Simulation.ts         render-agnostic world: physics, track, vehicles, AI, race, pickups.
                          Used by the browser game AND the headless test harness.
    Game.ts               browser shell: renderer, scene, fixed-step loop, input, HUD, FX
    RaceManager.ts        countdown, checkpoints (ordered gates), laps, positions, finish
    InputManager.ts       keyboard (+ gamepad) -> DriveInput
    HUD.ts                minimal DOM overlay + minimap
    Audio.ts              tiny WebAudio synth (engine, impacts, boost, splash, boing)
  vehicle/
    VehicleConfig.ts      tuning numbers + per-surface modifiers (per-vehicle ready)
    Vehicle.ts            invisible physics chassis + raycast suspension + state
    VehicleController.ts  arcade force model (drive, grip, steer, air, landing)
    VehicleVisual.ts      visual mesh (placeholder or GLB) — separate from physics
    AIController.ts       waypoint / racing-line driver producing the same DriveInput
  track/
    TrackData.ts          Track 1 definition: named nodes, widths, elevations, features
    Track.ts              runtime queries: sampled paths, progress, surface lookup, routes
    TrackBuilder.ts       heightfield terrain, bridge, colliders, visual meshes
    SurfaceManager.ts     surface types and their gameplay properties
  camera/RaceCamera.ts    high 3/4 overview camera with gentle tracking/zoom
  physics/PhysicsWorld.ts Rapier world wrapper, collision groups, events
  pickups/PickupManager.ts nitro pickups (extensible to other specials)
  fx/Particles.ts         pooled instanced particles (dust, splash, flame)
  debug/DebugUI.ts        toggleable overlay + switches
tools/
  headlessRace.ts         runs a full 4-AI race in Node and reports laps/stuck/resets
  screenshot.mjs          Playwright screenshots of the running game
```

Key rules:
- Physics chassis and visual model are separate. `VehicleVisual` can load a GLB
  (`public/models/<id>.glb`) and auto-fit it to the chassis without distorting it.
- Track geometry is generated from data (named nodes + features). No magic
  coordinates in game code. Paths are direction-agnostic; the race direction is a
  parameter (reverse layouts later).
- Fixed 60 Hz physics step with render interpolation.

## Phases
1. Project + Three.js scene                        
2. Rapier + ground + one controllable vehicle      
3. Vehicle feel (accel, steer, brake, momentum)    
4. Track 1 greybox, full lap driveable              
5. Race camera                                      
6. Checkpoints + laps                               
7. Three AI racers                                  
8. Terrain effects                                  
9. Bridge shortcut + recovery/reset                 
10. Nitro                                           
11. Lightweight UI / debug                          
12. Full race playtest + fixes                      

Status of each phase is tracked in `PROGRESS.md`.
