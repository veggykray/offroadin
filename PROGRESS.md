# Progress

| Phase | Status | Notes |
|---|---|---|
| 1 Project + scene | ✅ | Vite + TS + Three.js |
| 2 Rapier + vehicle | ✅ | `@dimforge/rapier3d-compat` (same engine, WASM inlined → works in Vite and Node) |
| 3 Vehicle feel | ✅ | Raycast suspension, capped lateral grip, speed-sensitive yaw control with held drifts, landing quality, tyre tripping for extreme side hits |
| 4 Track 1 greybox | ✅ | Data-driven (`TrackData.ts`), heightfield terrain, berms, gorge, lake, ford, bridge |
| 5 Camera | ✅ | Default overview framing ~whole track with gentle drift; `C` = closer follow view |
| 6 Checkpoints/laps | ✅ | Ordered finite gate segments, forward-only; safety net for gates crossed while sliding |
| 7 AI | ✅ | 3 physical AI (cautious / balanced / aggressive), racing lines, speed profiles, route choice, unstick + reset |
| 8 Terrain effects | ✅ | Dirt, rough rock (physical bumps + jolts), mud, water (ford), bank, off-track, rickety log bridge |
| 9 Shortcut + recovery | ✅ | Risk route over narrow curved bridge; fall/flip/stuck/lost/off-map → quick deliberate respawn with ghosting |
| 10 Nitro | ✅ | 2 starting charges (max 3), 4 pickups; FOV kick, flames, shake, HUD meter |
| 11 UI / debug | ✅ | HUD, minimap, results, pause; debug panel with colliders, AI lines, slow-mo, free cam, autopilot |
| 12 Playtest + fixes | ✅ (automated) | See "Verified" below. Needs a human feel pass. |

## Verified automatically
- `npm test`: 3 forward + 1 reverse all-AI races finish (no stuck cars); a keyboard-style
  digital-input driver finishes a race.
- Jump sweep (`tools/jumpTest.ts`): clean landings up to ~28 m/s approach, rough at flat-out
  top speed, rough→hard with nitro.
- Route balance (`tools/routeTest.ts`): shortcut ≈ 0.6–0.8 s/lap faster for AI when clean;
  falling off costs ≈ 3 s.
- Bridge fall (`tools/bridgeFallTest.ts`): detected in ~1.4 s, back on the bridge 0.6 s later.
- Collisions (`tools/collisionTest.ts`): shoves deflect, 25 m/s T-bone slides the victim
  ~17 m without launching; 38 m/s nitro T-bone rolls it.
- GLB pipeline (`tools/glbTest.mjs`): off-centre / sideways / wrongly-scaled model is
  rotated, uniformly scaled, centred and grounded; drop-in discovery from `models/`.
- Browser (`tools/screenshot.mjs`): renders, HUD, countdown, results, restart, autopilot race.

## Known issues / next steps
- Needs a human "feel" pass: steering rates, grip, nitro strength, jump window are
  all in `VehicleConfig.ts` / `VehicleController.ts` (`LANDING`).
- AI finishing order is fairly stable (aggressive usually wins). AI never falls off the
  bridge on its own; bridge drama comes from the player and contact.
- A skilled player will probably beat the AI comfortably; add a difficulty knob
  (`PERSONALITIES` corner/bridge speeds) once the handling is signed off.
- Elevation reads only moderately from the high camera; real art/lighting will help.
- Reverse layout works (`?reverse=1`) but the jump was designed for the forward direction.
- Future specials (jump / hazard / attack, one-special rule) not built — `PickupManager`
  is the extension point.
