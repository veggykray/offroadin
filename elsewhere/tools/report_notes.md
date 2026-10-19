## Headless simulation tests (`npm test`)

`test/sim.test.ts` (node:test, fixed 1/60 s steps): clearance-aware pathing (dog vs cat), the complete
P2 sequence through the public order API twice with a reset in between (investigate → redirect →
occupied-closure deferral → first-crossing latch → redirect-after-latch keeps E02 walkable → balk →
reassure → cat weak ascent → portrait switching moves nobody → cat return → dog rejected safely →
MR-01 → dog + White ascent → P2_ASCENDED), the activation-vs-completion rule (the transport that earns
P2_ASCENDED does not require it), and that every stand point is on free ground for its actor's radius.

## Environments tested

- Headless Chromium 141 (Playwright 1.56.1) on Linux with SwiftShader software OpenGL, viewports
  1280×800 (mouse), 780×360 and 932×430 (touch emulation, `hasTouch`/`isMobile`), plus a 430×932 /
  800×1280 portrait rotation check. `dist/PLAY.html` loaded from a `file://` URL with external requests
  monitored (none).
- `npm test` under Node 22.

## Not tested (honest limitations)

- **No physical phone, no Safari/WebKit, no real GPU.** All frame-time numbers above are CPU time of
  `renderer.render()` in software GL; they say nothing about GPU cost on a phone. The headless run
  itself managed only ~2 fps, which is why the sim loop was given up to 0.5 s of catch-up per frame.
  The 30 fps phone / 60 fps desktop figures remain *targets*, not measurements.
- **Audio** is synthesized and wired to events, but headless Chromium has no audio output; nothing was
  listened to. Mute/pause toggles were exercised only as state.
- **Pinch zoom** is implemented (two-pointer distance) but the walkthrough only automates wheel zoom and
  mouse/touch drag; pinch was not automated.
- **Double-click / Windows launch** of PLAY.html was not tested on Windows; it was opened from a
  `file://` URL in headless Chromium on Linux (no errors, no network). No preview deployment exists,
  so there is no playable URL — use the ZIP.
- The two phone viewports are **viewport emulation**, not devices; safe-area insets are honoured via
  CSS `env()` but could not be exercised.
- The recording (`evidence/clip/`) comes from the headless software renderer at ~2–8 fps, so it is
  choppy; it shows real play (valve change and the cat's ascent), not a scripted camera.

## Visual issues still present (my own review against `design/references/`)

- **Palette / atmosphere:** close in spirit — dark pitted basalt, warm peach paving, pale ceramic, copper
  rims, pink/lavender sky, cyan/magenta glow, violet shadow fill. The reference's painterly atmosphere
  (drifting mist, glowing pits lit from inside, dense hanging roots) is only partly there: the
  pits are painted but do not glow; cloud banks are flat sprites.
- **Environment density:** deliberately sparser than the references so routes stay readable at phone
  scale; the 0B terrace in particular could carry more carved roots, bowls and hanging reed roots.
- **Animals:** procedurally modelled in code (original), articulated with IK gaits so feet plant without
  sliding. At gameplay distance they read as a big black shaggy dog, a tuxedo cat and a small pale hooded
  inhabitant. Close up they are clearly primitive-built (capsule torsos, sphere heads); fur is a painted
  stroke texture under toon shading, not groomed fur; the dog's head is on the small side and its droop
  ears are simple. These are the right proportions and motions but not final-quality models.
- **White:** readable silhouette and luminous eyes; the hunch/shiver/relax posture change is visible but
  subtle at 780×360.
- **Painted-surface approach:** this build uses geometry-bound authored textures plus decals and
  screen-space atmosphere. **No scene-specific painted plate or camera projection was produced** (no
  image-editing/generation tooling was available), so that half of the technique test is still open.
- Draw calls are ~250–300 (three characters are ~35 meshes each and are not merged); fine for desktop,
  untested on phones.

## Things intentionally not built

P1 and the garden opening, 0A/0C, the rest of 1A and all other floors, potion conversion, Watchers/
Collectors, capture/fall recovery, inventory/quest UI, minimap, achievements, save games, level editor.
