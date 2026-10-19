# The Elsewhere — First Rise test (P2 playable slice)

One small, playable scene from Chapter One: **P2 “The First Rise”** in isolation — Refuge Sluice (0B),
Root Elevator (0D) and the arrival terrace of Reed Quay (1A). It exists to test the visual style,
natural-looking animals, touch movement, character switching, liquid routing and upward transport.
Design baseline: V3.1 (unchanged, in `design/`). Build identifier: see `src/config/buildInfo.ts`
(shown on the start screen).

## Play it

- **No install:** open `dist/PLAY.html` (self-contained, built by `npm run build`) — or the copy at the
  root of the release ZIP in `releases/`.
- **Served (needed for phones):** `npx --yes serve dist` (Node 18+) or `python3 -m http.server 8000 --directory dist`,
  then open the LAN address of the serving machine on the phone (e.g. `http://192.168.1.23:8000`), not `localhost`.
- **From source:** `npm install`, `npm run dev` → http://localhost:5174 (add `?dev=1` for the plain-geometry button).

Landscape phones and desktop. Tap the ground to walk; tap an object to approach and use it; the big
dog/cat portraits switch characters (also across floors). Drag empty space to pan, pinch or wheel to
zoom. Top right: reset ↺, mute, pause. Press **G** (or the ▦ button with `?dev=1`) for the developer
plain-geometry view — same gameplay state, flat materials, nav grid and hit spheres shown.

### Test-only starting state
The scene starts **after P1’s rescue**: dog, cat and White are together at 0B, White already trusts the
dog enough to follow. Flags `START`, `P1_LATCH_OPEN`, `P1_RESCUED` are pre-set. P1 is not implemented;
0A, 0C, the rest of 1A and all other floors are not built (walkways E03/E11/E12 end at rope rails).

### The sequence
A. **Investigate** — tap the dog to sniff: a short scent clue leads to wet droplets at the reed-blocked seep; tap the seep and the dog scrapes it open.
B. **Redirect** — CV-01 (either animal) switches the cyan between the spill route (broken cistern) and the bridge receiver. Cyan visibly travels the groove and the glass conduit, fills the receiver, and E02 forms. Closing while someone is on the bridge waits until it is clear; after the first full crossing porcelain safety slats keep a solid return path (`P2_BRIDGE_SAFE`).
C. **Reassure** — White balks once at the loud magenta rise; with the dog selected tap White and the dog sits beside him. No meter, no timer.
D. **Separate** — the weak V02 stream carries the cat alone to 1A (and back). The dog is rejected safely.
E. **Strengthen** — at 1A the cat inspects the three-band load indicator and nudges MR-01; the same stream becomes visibly stronger (`P2_LIFT_STRONG`).
F. **Reunite** — the dog boards, White joins automatically, both ascend; all three at 1A → `P2_ASCENDED`, a small relief moment, scene stays explorable, Replay available.

Identifiers used: `L01`, `L02`, `CV-01`, `MR-01`, `E02`, `V02`, `P2_BRIDGE_READY`, `P2_BRIDGE_SAFE`, `P2_LIFT_STRONG`, `P2_ASCENDED`.

## Layout
```
src/
  config/p2Slice.ts     the slice layout: platforms, obstacles, channels, lift, interactables, timings (the only place that knows coordinates)
  config/buildInfo.ts   build identifier
  sim/                  render-free simulation: NavGrid (clearance A*), Actor, Liquid (L01 cyan + E02 latch, L02 lift), Game (orders, White policy, flags)
  render/               Textures (canvas-painted), Materials, Environment, Liquids, Characters (procedural rigs), SceneView (camera, picking, dev view)
  input/Pointer.ts      tap vs drag vs pinch
  ui/Hud.ts             start/about, portraits, F0/F1, reset/mute/pause, hints, context labels
  audio/Audio.ts        synthesized sounds
test/sim.test.ts        headless sequence + edge cases (npm test)
tools/                  shot.mjs (screenshot), walkthrough.mjs (browser walkthrough + evidence), makePlay.mjs, package.mjs
design/                 immutable design inputs (V3.1 archive, handoff brief, reference images)
evidence/               screenshots, video and report.json from the last walkthrough
releases/               playable ZIPs
```

## Scripts
```
npm test            typecheck + headless simulation tests
npm run build       typecheck + vite build + dist/PLAY.html
npm run walkthrough browser walkthrough (node tools/walkthrough.mjs --w 932 --h 430 --out evidence/phone_932 --mobile)
npm run package     release ZIP in releases/
```
See `TEST_REPORT.md` for what was verified, measured and not tested, and `ASSET_PROVENANCE.md` for asset origins.
