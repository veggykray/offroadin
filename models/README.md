# Vehicle models

Drop GLB/GLTF files here and the game picks them up automatically (restart `npm run dev`
if it was already running).

| File name          | Vehicle      |
|--------------------|--------------|
| `cindercrest.glb`  | Cindercrest  |
| `saberspring.glb`  | Saberspring  |
| `shellfort.glb`    | Shellfort    |
| `tuskroller.glb`   | Tuskroller   |

What happens on load (see `src/vehicle/VehicleVisual.ts`):

- The model is **uniformly** scaled so its length matches the physics chassis
  (it is never stretched or squashed), centred, and its lowest point is placed on the
  ground at the car's resting ride height.
- The simple placeholder and placeholder wheels are hidden.
- The physics chassis is unchanged — handling does not depend on the model.

If a model faces the wrong way, set `rotationY` for that vehicle in
`src/vehicle/VehicleConfig.ts` (e.g. `Math.PI / 2`). Fine position tweaks go in `offset`.
If the model has separate wheel nodes, list their names in `wheelNodes` and they will
spin and steer.

Tripo exports usually face +Z or -Z; the game's forward direction is **+Z**.
