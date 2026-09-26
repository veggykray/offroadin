# DESIGN — core game rules (authoritative summary)

This file records the established design. Implementation may be improved; the core
design must not be silently changed. Any proposed deviation is listed at the bottom
under **Open design questions**.

## Identity
- Four-racer **arcade off-road** racer, inspired by the readability of *Super Off Road*,
  built in modern 3D.
- NOT a simulator, NOT open world, NOT first-person or behind-the-car.
- Pillars: momentum, positioning, collisions, terrain, jumps, shortcuts, nitro,
  controlled chaos, catching opponents, taking risks.
- **Easy to drive, difficult to drive fast.**

## Camera
- High three-quarter / isometric-style view showing most of the track.
- May gently track, zoom, anticipate — but stays stable so the player can plan ahead.
- No chase camera.

## Race format
- 4 racers (1 player + 3 AI), default 4 laps.
- Ordered checkpoints; laps cannot be farmed by crossing the line backwards.
- Race position, finish state, restart.

## Controls
- W/Up accelerate · S/Down brake/reverse · A/Left, D/Right steer · Space nitro.
- Gamepad supported where straightforward.

## Vehicle behaviour
- Weighty: visible acceleration, deceleration, lean, terrain reaction.
- Steering sensitivity falls with speed; momentum matters; controlled slides.
- Can go airborne, land (landing quality matters), shove and be shoved, spin when hit
  badly, and flip under extreme conditions.
- Flipped / stuck / fallen vehicles get a **quick, deliberate, arcade-style auto reset**.
- Collisions are strong and meaningful but ordinary contact must not launch cars.

## Vehicle architecture
- Invisible simple physics chassis (stable COM, gameplay dimensions, raycast suspension).
- Visual model (GLB/GLTF from Tripo etc.) attached to the chassis, replaceable without
  touching the controller; scaled uniformly (never distorted); wheels/parts animatable.
- Reference vehicle sheets (Cindercrest, Saberspring, Shellfort, Tuskroller) are the
  **authoritative art direction** — stylised prehistoric/animal-inspired machines, not
  buggies/monster trucks/Mad-Max cars. Until GLBs are supplied, simple placeholders are used.

## Track 1 — Prehistoric World (greybox)
Loop course with elevation. Beats, in order:
1. **Start/finish** — 4 abreast, wide.
2. **First corner** — narrows sharply; inside line shorter, outside carries speed.
3. **Rough terrain** — uneven rock/dirt affecting speed and handling.
4. **Elevation change** — climb where momentum matters.
5. **Fast sweeper** — carrying speed pays off.
6. **Jump / crest** — too fast = bad landing; skilled players approach faster and land clean.
7. **Route split** — SAFE (longer, wider, easier) vs RISK (shorter, narrow bridge over a
   gorge, 1–2 cars wide, falling costs time + recovery). Must be a real decision.
8. **Rejoin** — merge designed to avoid head-on collisions / pile-ups.
9. **Technical section** — tighter direction changes / terrain transitions.
10. **Final fast section** → finish straight.

Width varies: broad overtaking zones, medium sections, squeezes, the exceptional bridge.
Shape language: rough ground, rock, dirt, primitive bridges, water, cliffs. No modern elements.

## Terrain types
- **Dirt** baseline · **Rough/rocky** slower, less stable · **Water/Mud** much less accel/speed.
- Implemented via real surface zones / wheel contact (never invisible walls).
- Built so per-vehicle surface modifiers can be added later.

## Nitro & pickups
- Nitro is core: satisfying boost, steering preserved, risky if misused, obvious visuals.
- Prototype: racers start with nitro charges; visible nitro pickups on track add charges.
- Future specials (jump, hazard drop, attack): a racer can carry only ONE special, with a
  short visible timer around pickup interaction.

## AI
- Three physical AI racers using the same vehicle system as the player (no rails).
- Follow racing lines, handle corners, recover, take both routes sometimes, interact.
- Personalities: cautious / balanced / aggressive.
- Teleport only for genuine stuck recovery.

## Catch-up
- No blatant rubber-banding. Only subtle, easily disabled help (slightly better
  acceleration when well behind).

## Future (do not build yet)
- ~6 vehicles per world, 7–10 tracks per world, forward + reverse layouts,
  cross-world vehicle unlocks. Track data is separated from race logic to allow reversal.

## Not now
Accounts, networking, shops, currency, upgrades, elaborate UI, character select, detailed
scenery, spectacle shaders, procedural worlds, story, mobile controls, monetisation.

## Open design questions / deviations
- **Nitro vs "one special" rule:** nitro is treated as a separate charge meter (start with
  charges, pickups add one, max 3) rather than occupying the single special slot, so the
  core nitro mechanic is always available. If you want nitro to share the single special
  slot, that's a small change in `PickupManager`.
