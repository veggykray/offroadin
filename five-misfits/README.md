# Five Misfits — 2D fantasy artillery adventure (Three.js visual build)

Five long-time friends are interrupted during their monthly tavern card game by a bell that
should not exist and an attack on their village. Turn-based squad artillery combat in a true
2D side view with a zoomed-out tactical camera, destructible terrain and Worms-style
ballistics, rendered with **Three.js as a 2D/2.5D renderer** (fixed orthographic camera, flat
gameplay plane, layered parallax backdrop).

This is the independent Three.js build. It shares no code with any Godot version.

## Run

```bash
npm install
npm run dev        # http://localhost:5180/  (Windows: double-click PLAY.bat)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # Vitest (simulation + rigs)
npm run e2e        # Playwright smoke test against the real build, screenshots in e2e/out/
npm run check      # typecheck + tests + build
```

URL options: `?intro=0` skip the prologue · `?seed=42` deterministic seed · `?debug=1` debug overlay.

## Controls

| Key | Action |
|---|---|
| `1`–`5` / click | Select Orrin, Brennagh, Pim, Vesk, Castellan |
| `A` `D` · `W`/`Space` | Walk · jump (Pim's six-legged walker cannot jump; it climbs 2-unit ledges and steps over small gaps) |
| `Q` / `E` | Basic attack / signature ability |
| Mouse | Aim: angle and power from the cursor; target abilities: hover an enemy; direction abilities: cursor side |
| `↑↓←→` | Fine-tune angle/power while aiming; pan otherwise |
| `Tab` · click/`Enter` · `Esc` | Cycle targets · commit · cancel (nothing spent) |
| `T` | End squad turn → the raiders act once each |
| Wheel / right-drag · `Z` · `C` | Zoom / pan · overview · center on hero |
| `H` `F3` `K` `M` · `R` (twice) | Help · debug · camera shake · sound · restart (skips the prologue) |

## The cast (from the approved group portrait)

| Hero | Basic | Signature |
|---|---|---|
| **Orrin**, Beast Master — scruffy, dazed; heron-like bird on his arm; leathery spined jackal at heel | Hatchet throw | **Jackal Attack**: the jackal runs a real simulated path to a reachable enemy, bites, returns |
| **Brennagh**, Giant Woman — towering, bone-decorated armour, enormous round shield, golden knuckle gauntlet | Heavy Strike (breaks timber) | **Shield Charge**: ground-following, smashes timber, shoves enemies, stops at stone and cliff edges |
| **Pim**, Fake Wizard — tiny man, enormous head in a brass head-support rig, six-legged walking machine with pipes, bulbs and a cannon (no wheels) | Sparkbolt gadget | **Cannon**: aimed shell, splash, terrain damage, recoil |
| **Vesk**, Bat-eared Spearman — slender, huge eyes, bat ears, armadillo snout | Slingshot | **Piercing Throw**: his one spear pierces, then embeds or falls; walk over it to retrieve |
| **Castellan**, Handsome Duelist — white shirt, rapier, flintlock | Pistol | **Show-Off**: pistol shot, previewed acrobatic lunge to a valid landing, stab |

Enemies in this slice: two skeletal raiders (axe and shield) and a skeletal shaman-archer on a perch.

## How it is built

```
src/
  core/       math, seeded RNG, frame coroutines
  world/      terrain grid (stable/soil/timber, dirty-rect tracking), AABB physics, ballistics, the level
  game/       units, abilities, walking/reachability simulation, enemy AI, Game (turns, combat, commands)
  art/        paint.ts (material tiles, soft sprites), characters.ts (procedural part painters + rig specs)
  render/     SceneRenderer (ortho camera, layers), TerrainPainter, Backdrop (parallax), Props, Rig, Particles, Overlays
  ui/         DOM HUD (portraits, pips, ability panel), staged prologue, tiny synth audio
  main.ts     input, loop, window.__fm test hook
public/art/far-ruins.png   far parallax band cut from the approved battlefield reference
reference/                 the supplied reference artwork (authoritative visual direction)
```

Rendering layers (z): sky → far ruins (reference art) → misty hills → crooked village roofline →
façades/arch → terrain → units → projectiles → particles → previews/bars. Terrain is one
3200×1800 canvas texture painted from the cell grid (material tiles, dark boundary outlines,
grass fringes, inner shadow) and repainted incrementally where explosions carve it.

Characters are articulated cut-out rigs: every part (legs, torso, head, arms, weapons, bird,
shield…) is painted procedurally with Canvas2D at 40 px per world unit into its own texture and
assembled into a Three.js group with pivots. Walk cycles, idle breathing, aim (arm + weapon follow
the aim angle), attack swings, hit flashes and knock-downs are animated in code. The walker's six
legs are solved per frame with two-bone IK against the real terrain height under each foot.

## Honest limitations

- All art is **procedural**: no hand-painted sprite sheets exist. The rigs are faithful in
  silhouette, proportion and signature props to the group portrait, but at close zoom they read as
  stylised vector cut-outs, not painted illustration. Expression range is limited to pose, tilt,
  swing and flash; there are no facial animation frames.
- The far backdrop band is cut from the approved battlefield reference; everything nearer
  (hills, village roofline, façades, terrain, units, effects, UI) is original.
- Enemy raiders only pursue when a real walkable path exists; they do not route around obstacles.
  The archer never moves. Units do not collide with each other. No fall damage.
- Headless Chromium renders this through SwiftShader at a few frames per second; the smoke test
  therefore steps the simulation through the test hook rather than waiting on wall-clock time.
