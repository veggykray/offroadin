# Asset provenance

Everything rendered by this build is generated in code at start-up or authored in this repository.
No third-party models, textures, fonts, audio files or paid services are used, and no image-generation
tool was available or used.

| Asset | Source | Notes |
|---|---|---|
| Basalt, paving, porcelain, copper, moss, fur textures | `src/render/Textures.ts` — painted onto canvases with a seeded RNG | Original, deterministic; one 512² basalt, 512² paving, the rest 256² |
| Toon gradient, glow sprite, contact-shadow decal | `src/render/Textures.ts` | Original |
| Environment geometry (platforms, modular block walls, root arch, channels, cistern, receiver, lift shaft, 1A houses/bench/reeds/skiff, plants, distant islands) | `src/render/Environment.ts` built from Three.js primitives, merged per material | Original |
| Dog, cat (procedural quadruped rigs, 2-bone IK gait), White, lift attendant | `src/render/Characters.ts` | Original; shapes are code, not scanned/downloaded models |
| Liquid shaders (cyan channels, bridge construct, magenta column) | `src/render/Materials.ts` `liquidMaterial` | Original GLSL |
| Portrait icons (dog/cat) | inline SVG in `src/ui/Hud.ts` | Original |
| Sound (footsteps, valve creak, scrape, flow, lift rumble, rejection, chimes) | `src/audio/Audio.ts` — WebAudio synthesis | Original; no recordings |
| Engine | [three.js](https://threejs.org) r0.186 (MIT) via npm | Only runtime dependency |
| Reference concept art | `design/references/*.png` (supplied with the brief) | Visual direction only — never loaded by the game, never used as a texture |

What was **not** produced: a scene-specific painted plate or camera-projected artwork over the blockout.
The painted-surface test in this build is the "textured/material-driven" path: authored tileable canvas
textures on geometry-bound UVs, layered decals (contact shadows, scent discs, glow halos) and screen-space
atmosphere (CSS sky gradient, fogged silhouettes, cloud sprites). See `TEST_REPORT.md`.
