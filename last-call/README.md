# Last Call — side-view fantasy artillery/adventure greybox

A playable vertical slice: five long-time friends are interrupted during their monthly tavern
card game by an impossible attack. Turn-based squad combat in a true 2D side view with a
zoomed-out tactical camera, destructible terrain and Worms-style projectile physics.
This is a **greybox**: simple coloured silhouettes and plain material fills, no final art.

Stack: TypeScript + Vite, HTML Canvas 2D, Vitest. No engine, no assets, no network.

## Play (Windows)

Double-click **`PLAY.bat`**. It checks for Node.js (install the LTS from <https://nodejs.org> if
missing), runs `npm install` once, then starts the dev server and opens the browser.

Manual:

```bash
npm install
npm run dev        # http://localhost:5174/
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

URL options: `?intro=0` skip the prologue · `?seed=42` deterministic seed · `?debug=1` debug overlay on.

## Controls

| Key | Action |
|---|---|
| `1`–`5` / click a hero | Select Orrin, Brennagh, Pim, Vesk, Castellan |
| `A` `D` | Walk (spends the hero's movement budget) |
| `W` / `Space` | Jump (Pim's six-legged walker cannot jump; it climbs 2-unit ledges and steps over small gaps) |
| `Q` / `E` | Basic attack mode / Signature ability mode |
| Mouse | Aim: angle and power from the cursor. Target abilities: hover an enemy. Direction abilities: cursor side |
| `↑↓←→` | Fine-tune angle / power while aiming; pan the camera otherwise |
| `Tab` | Cycle targets (target abilities) |
| Click / `Enter` | Commit (fire, charge, send the jackal, show off) |
| `Esc` / right-click | Cancel (nothing is spent) |
| `T` | End squad turn → enemy phase |
| Wheel / right-drag | Zoom around the cursor / pan |
| `Z` / `C` | Tactical overview (whole level) / center on the selected hero |
| `H` `F3` `K` `M` | Help · Debug overlay · Camera shake toggle · Sound toggle |
| `R` (twice) | Restart the mission (skips the prologue) |

## Rules

Each squad turn every surviving hero may move (budget M) and take one action (A), in any
order. Press **End Squad Turn**; the raiders act once each with telegraphed intents, then the
heroes refresh. Heroes at 0 HP are out for the mission. **Win:** defeat all three raiders and
stand any hero on the gold stone platform at the far right. Soil and timber break; grey stone
never does. Vesk has one spear: throw it, then walk over it to pick it up (free).

## The squad

| Hero | Basic | Signature |
|---|---|---|
| **Orrin**, Beast Master (bird on shoulder, spined jackal at heel) | Hatchet throw | **Jackal Attack**: the jackal runs a real, simulated path to a reachable enemy, bites, returns |
| **Brennagh**, Giant Woman (huge shield, ornate fist) | Heavy Strike (breaks timber) | **Shield Charge**: ground-following, breaks timber, shoves enemies, stops at stone and cliff edges |
| **Pim**, Fake Wizard / Inventor (tiny, enormous head, six-legged walker with a cannon) | Sparkbolt gadget | **Cannon**: aimed shell, splash, terrain damage, recoil |
| **Vesk**, Bat-eared Spearman | Slingshot | **Piercing Throw**: the one spear pierces, embeds or falls; retrieve it on foot |
| **Castellan**, Handsome Duelist | Pistol | **Show-Off**: pistol shot, previewed lunge to a valid landing, stab |

## Tests

```bash
npm test           # Vitest: terrain, physics, level routes, turn rules, combat, spear cycle, abilities, outcomes
npm run e2e        # Playwright smoke test against the built app (needs Playwright + Chromium, see below)
npm run check      # typecheck + unit tests + build
```

`npm run e2e` builds, serves `dist/`, drives the real browser (skip intro, select heroes, fire the
cannon, throw the spear, charge, run an enemy phase, restart) and saves screenshots to `e2e/out/`.
It uses a globally installed Playwright if `PLAYWRIGHT_MODULE_DIR` points at one, or a local
`npm i -D playwright` + `npx playwright install chromium`.

## Layout

```
src/
  core/        math, seeded RNG, frame coroutines
  world/       terrain grid (stable / soil / timber), AABB physics, projectile simulation, the level
  game/        units, abilities, walking/reachability sim, enemy AI, Game (turns, combat, commands)
  render/      camera, canvas renderer (silhouettes), DOM HUD, prologue, audio
  main.ts      input + loop + window.__lastCall test hook
tests/         Vitest unit tests
e2e/           Playwright smoke test
```

## Verified in this pass

- `npm run check`: type-check clean, 41 Vitest tests pass (terrain, physics, level routes, squad/enemy
  phase order, one action per hero, stable-terrain immunity, destructible collision updates, cannon
  blast + knockback, spear throw→retrieve→throw cycle, jackal/charge/show-off validation, win/loss/
  restart, a scripted legal-commands playthrough that wins in 8 turns and still wins with the planks gone).
- `npm run e2e`: 24/24 Playwright checks against the real build in headless Chromium at 1920×1080
  (prologue + skip, default camera fits the whole battlefield with heroes at 5.3% and the giant at 9.8%
  of screen height, selection by keys and click, walker movement and no-jump refusal, cannon aimed and
  fired with the mouse, spear thrown, charge smashes timber, enemy phase resolves, zoom/overview, debug
  and help overlays, restart). Screenshot: `docs/screenshot-battlefield-1920x1080.png`.
- Not verified: human feel/tuning. No manual playtest happened; the interaction checks above are automated.

## Known limitations (greybox)

- Terrain is a 0.25-unit grid of stable / soil / timber cells (not arbitrary sculpting); explosions carve circles.
- Enemy raiders walk, hop and drop toward a hero only when a real path exists; otherwise they hold.
  They do not route around obstacles and the archer never moves.
- Units do not collide with each other. No fall damage.
- The jackal "heels" by walking after Orrin; if it cannot follow (e.g. a jump it can't make) it waits,
  which limits Jackal Attack until Orrin comes back for it.
- The prologue is staged silhouettes + text, about 40 s on auto-advance; Esc skips.
- Sound is three synthesized blips. Camera shake is a toggle (K).
