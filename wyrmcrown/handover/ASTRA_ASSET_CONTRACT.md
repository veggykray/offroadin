# Hollow Crowns — Architectural Asset Contract for Astra

Version 1, 10 October 2026. Written from the Architecture Compatibility Test, which put six of
Astra's revision-3 assemblies (`p1_h03`, `p1_h01`, `p1_e03`, `p1_e_treehouse`, `p1_d01`,
`p1_d_greathall`) into the running game, unchanged, on real terrain.

Every rule below is tagged:

- **[C] Confirmed**: read from the current engine source (file and line given) or measured by
  `wyrmcrown/tools/test_archtest.mjs` in the game.
- **[R] Recommended**: not enforced by the engine, but what the test showed works best.
- **[U] Unknown**: not settled yet; the specific test that would settle it is named.

Engine files referred to: `alien-strike/src/gfx/forge.js` (Sprite Forge), `wyrmcrown/src/game/building.js`
(buildings), `wyrmcrown/src/game/settlements.js` (site placement), `wyrmcrown/src/gfx/forge_worker.js`
(background forging), `alien-strike/src/gfx/renderer.js` (draw order), `wyrmcrown/src/game/realm.js`
(culling), `wyrmcrown/src/game/mountain.js` (terrain projection).

---

## 1. Supported source format

| | Rule |
|---|---|
| [C] | An asset is a **JavaScript generator** registered as `AS.Models['<id>'] = (pal, opt) => model`. Not a mesh, GLB, image or JSON. The engine never loads anything else for a building (`building.js` `sheetFor`, `forge.js` `recipe`). |
| [C] | The returned `model` is `{ r, h, parts, style, bevel, scale?, lit?, post? }`. `r` = footprint radius, `h` = height above the footprint, both in world units (`forge.js` `renderModel`, `dims`). |
| [C] | Each part is `{ z0, z1, shape(ctx, zt, anim), side, top, flat?, bevel?, bevelW?, ao?, detail?(ctx, anim), tex?, stroke?, when?(anim) }`. The Forge draws every 1/res slice between `z0` and `z1` with `shape`, then `detail` on the top slice only (`forge.js` `renderModel`). |
| [C] | Plain browser JavaScript, no build step, no modules, no imports: files are `<script>` tags in `wyrmcrown/index.html` and `importScripts` in `forge_worker.js`. A file must run in **both** a page and a Worker (no `document`, no DOM, no `window`-only APIs inside generators). Astra's `modules.js` + `models.js` meet this. |
| [C] | Generators must be **deterministic**: the same `(pal, opt)` must always draw the same pixels. The page and the forge workers both build the model and either may supply any frame (`forge.js` `pump`, `done`). The test re-forged all six after an unload and got the same pixels (worst mean channel difference 0.19/255, worker vs page antialiasing). |
| [C] | `pal` and `opt` must be **plain cloneable data** (strings, numbers, arrays, plain objects). They are posted to the worker; anything that cannot be cloned silently drops that sheet back to the page thread (`forge.js` `pump`: `sh.noWorker = true`). |
| [R] | Keep the revision-3 split: shared geometry helpers in one file (`modules.js`, `AS.ArchP1.Kit`), recipes in another (`models.js`). New families may add files, but each must load after `modules.js`. |

## 2. Registration and load order

| | Rule |
|---|---|
| [C] | The game loads the recipes from `wyrmcrown/src/gfx/arch_p1/modules.js` then `models.js`, after `models_world.js` and before any game code (`index.html`). The same two files are in the worker's import list (`forge_worker.js` `LIBS`). A new file must be added to **both** lists, or its sheets are forged on the page thread only. |
| [C] | Each asset must be listed in `AS.Gallery` with `{ gen: '<id>', dirs, anims }`. `Building.meta()` reads `dirs`/`anims` from there, **once**, the first time any building asks (`building.js` `meta`). An asset registered after that is treated as 1 direction, 1 frame. `models.js` already does this for all 54 recipes. |
| [C] | An ID that already exists in `AS.Models` is a hard error at load (`models.js` `add`: `Asset ID collision`). |
| [C] | Load a revision **once**. Revision 3 must not be loaded alongside older `p1_` definitions (same IDs → collision error). |

## 3. Coordinates and orientation

| | Rule |
|---|---|
| [C] | Model space: **+x east (screen right), +y south (toward the camera, screen down), +z up**. A point is drawn at screen `(x', y' − z)` after rotating `(x, y)` by the heading (`forge.js` `renderModel`: `translate(ax, ay − z); rotate(angle)`). |
| [C] | The camera **never rotates**. North is always up the screen and every building is always seen from the south at the same oblique. A building's look depends only on the heading it is placed with. |
| [C] | **Front = +y (south)**. Fixed-facade recipes (`dirs: 1`) are always drawn with their front facing the camera; their heading cannot change (`building.js` `draw`: `ang = dirs > 1 ? … : 0`). |
| [C] | Positive heading is **clockwise** on screen (Canvas `rotate`). Frame `d` of an `n`-direction sheet is drawn at heading `d × 360°/n` (+ the sheet's `angle0`) (`forge.js` `sheet`). A requested angle is rounded to the nearest frame (`forge.js` `frameIndex`). |
| [C] | Faces that should only show from the front must test the drawing angle themselves; the Forge has no back-face culling. Astra's `face`, `arch` and `carved` overlays already skip themselves when `cos(angle) < 0`. |
| [C] | Seen at 90° and 270°, `p1_d01` is legible but its approach stair reads as an upright slatted slab and its carved front disappears (by design of the overlays). Only heading 0 can be used against a south-facing cliff, and the camera can only see south-facing cliff faces. |
| [R] | Make monumental and cliff-set pieces `dirs: 1`, front to +y. Give 4 or 16 headings only to pieces that are genuinely placed at angles (walls, fences, bridges, retaining bays, gates in a wall run). |

## 4. Scale, pivot and bounds

| | Rule |
|---|---|
| [C] | **Pivot = ground point under the model origin**, drawn at `(x − sheet.ax, y − sheet.ay)`; `ax = r + 3`, `ay = r + h + 3` (world units, `forge.js` `dims`). The origin must be where the building meets the ground. |
| [C] | **Hard clipping box.** The frame canvas is `w = 2r + 6` by `2r + h + 6` world units. A point at heading θ, rotated to `(x', y')`, must satisfy `|x'| ≤ r` and `−(r + h) ≤ y' − z ≤ r`, or it is cut off. For multi-direction assets this must hold at **every** heading, so the whole plan must fit inside the circle of radius `r`. |
| [C] | The game's draw-culling margin (`building.js` `viewR = max(80, 0.6 w)`, `realm.js` `collectDrawables`) is safe for any `h ≤ 360 + 0.2 r`. All 54 revision-3 recipes are far inside it (tallest `h` 154). |
| [C] | Drawn bounds measured in game match Astra's `measuredAlpha` to within ±1.5 units for all six test assets and all four headings of `p1_d01` (test check 3). The supplied `asset-manifest.json` bounds can be trusted. |
| [C] | There is **no verified metres conversion for sprites**. The terrain and altitude code states 1 unit ≈ 0.25 m for heights (`maps/mountaintest.js`), but characters and buildings are stylised larger: a soldier is a 15-unit-wide sprite, the dragon about 70–75 units across the wings (measured in screenshots). |
| [C] | Measured in game against existing art: `p1_h03` (r 157) is 2.3× the radius of the largest existing human keep (`human_keep` level 3, r 68) and about 3.7 dragon wingspans across; `p1_h01` (r 43) is about 2× the radius of `human_house` (r 22). Both read as intended next to the dragon and troops (screenshots 01–02). |
| [R] | Size new assets **by reference to existing in-game sprites**, not metres: house-class 25–45 r, civic 55–80 r, landmark 125–160 r, as in revision 3. Keep a margin of at least 3 units inside the `r`/`h` box. |

## 5. Rendering, lighting and shadows (what the Forge does to a recipe)

| | Rule |
|---|---|
| [C] | Lighting is **baked into the sprite**: a fixed screen-space light from the top left; walls get a horizontal gradient, top faces a bevel (`forge.js` `litGradient`, `renderModel`). Parts with `flat: true` are not shaded. There is no dynamic sun direction; day/night and weather are a tint over the finished frame. |
| [C] | Post pass at res 2: rim light on top-left edges, under-shade on bottom-right, and a two-ring dark outline around the whole silhouette (`postIllustrated`). Any pixel with alpha < 100 is treated as empty for the outline. At res 1 (Low quality) the pixel-art pass is used instead: posterise, ordered dither, selective outline (`postProcess`). |
| [C] | `style: 'unit'` (full outline) is what existing human buildings and all revision-3 recipes use (`models.js` `finish`). Keep it. |
| [C] | The ground shadow is the sprite's own silhouette, softened (blur 1.8 px at res 2), drawn offset (+3, +1.6) units under every building at the scene's shadow strength (`forge.js` `silhouette`, `building.js` `drawShadow`). It is a contact shadow, not a cast shadow: tall buildings do not throw long shadows. |
| [C] | Masonry, slate courses, roof tiles, vault slabs and arch voussoirs are painted by `detail` overlays and **baked once into the sheet**. In game, `p1_d01` carries 47 overlay parts of 91 and `p1_d_greathall` 62 of 115; individual stones, courses, slab tops, voussoirs and ribs stay distinct at normal flight, from the 500 ceiling, at the 0.5 high-flight zoom, and at Low quality res 1 (screenshots 05, 06, 09, 12, 13). |
| [R] | Keep joint and block sizes in the revision-3 range: courses 5–9 units high, blocks 8–17 units long (`modules.js` `masonry`). That is what survived every view above. Finer detail (under ~3 units) disappears at the high-flight zoom. |
| [R] | Do not rely on colour alone to separate roof from wall: keep the value step (dark slate against pale stone, red tile against pale render, teal crowns against ivory drums). It is what reads at 0.75 px per unit. |

## 6. Materials and palettes

| | Rule |
|---|---|
| [C] | Colours come only from `pal`, with these keys: `a` wall, `b` light stone/trim, `t` roof, `g` glow/window, `d` dark/base, `k` banner, `k2` banner accent, `w` timber, `s` render/cloth (+ `skin` for figures) (`data/palettes.js`). |
| [C] | Human and elven buildings take `AS.Data.pal.human` / `.elf`; dwarven ones take the dwarf palette in `settlements.js` (`DWARF`), identical to `AS.ArchP1.PALETTES.dwarf`. Astra's defaults match the game's exactly. |
| [C] | The sheet's cache key includes the full `pal` and `opt` (`building.js` `sheetFor`: `'bld:' + gen + JSON(opt) + JSON(pal)`). **Every distinct palette or option makes a separate sheet** with its own memory. |
| [C] | `opt.owner` changes only the banner colour (`models.js` `flag`). Each owner is therefore a whole extra sheet of the building. |
| [R] | One palette per culture. Keep owner-dependent detail to small separate pieces (banners, standards) where possible, so a change of owner does not duplicate a 4 MB castle sheet. |
| [U] | Ownership refresh on capture was not tested. Test: place `p1_h03` with `opt.owner` for two lords, swap owner at run time, confirm the banner changes and the old sheet is released. |

## 7. Terrain attachment

| | Rule |
|---|---|
| [C] | A building is a flat sprite with **one ground height**. On the mountain terrain every entity is drawn at its projected point `(x, y_ground − E)` (`mountain.js` `proj`). The sprite cannot bend to a slope; nothing hides under the ground. |
| [C] | In the test each structure stands at the **lowest** of its declared support contacts, so no side floats over falling ground; on a slope the uphill side runs into the hill. Highest contact above the anchor: castle +11.6 (level lowland), merchant house +1.2, citadel +15.3 (gentle forest slope), tree dwelling +0.8, gate +24.4 (cliff-foot talus), vaulted hall +6.5. None showed a visible gap or floating edge in game. |
| [C] | The supplied `terrainSupport.contacts`, `sockets` and `collisionRecommendation.solidFootprints` are in the model's `_arch` metadata at run time and were enough to fit, clear trees and seat the gate. Keep supplying them. |
| [C] | Tree clearing in the test used one circle per declared solid footprint, not one big circle: trees stay right up to the walls and living supports (screenshots 03–04). |
| [C] | `p1_d01` was seated with its `cliff_collar` socket against the foot of the real cliff (the Wall in the Mountain Test region). Its front then stands on the talus fan; part of its footprint is ground the walking grid marks impassable (steep). It reads correctly: the dressed front stands proud of a dark rock face. |
| [R] | Design foundations to tolerate **up to ~25 units** of ground rise across the footprint (a plinth, a stepped base or a stair that can sink into the slope). Keep anything that must be seen (doors, stairs, the apron) on the low side, toward +y. |
| [R] | Cliff-set pieces: supply a `cliff_collar` socket at the back edge, keep the back 40–60 units plain (it meets rock), and do not model rock: the terrain supplies it. |
| [U] | Slopes steeper than the elven glade (15 units across the citadel) were not tested. Test: place `p1_e03` across 40+ units of rise and inspect the uphill side. |
| [U] | Terrain that should hide part of a building (a ridge in front of it) is not handled; the sprite always draws over the ground. Test: place a building just behind a ridge on the mountain terrain and look from low flight. |

## 8. Depth, sorting and visibility

| | Rule |
|---|---|
| [C] | Objects are sorted by ground y only: buildings `y + 2`, dragons `y + 4` (`renderer.js`, `building.js`, `dragon.js`). Altitude is not part of the sort. |
| [C] | **Found issue.** A dragon flying **above** a tall building, over its back half, is drawn **behind** it: at 200 units up, 15 units north of the castle's anchor, the keep's spires are drawn over the dragon; 10 units south it is drawn on top (screenshot 10). The dragon pops behind and in front as it crosses. This is an existing engine rule, made more visible by large sprites; it is not something an asset can fix. |
| [C] | At low altitude behind a building the dragon is correctly hidden by it (screenshot 11). |
| [C] | All six are in the drawn list from their shortcut altitudes and from the 500 ceiling (test check 6). |
| [R] | Engine fix (outside the art contract, for a later task): sort an airborne dragon after any building whose height it clears. Until then avoid very tall thin spires at the back of large footprints. |

## 9. Detail level and LOD

| | Rule |
|---|---|
| [C] | There is **no geometry LOD**. One sheet is forged per asset at the global Forge resolution (res 2, or res 1 at Low quality) and scaled by the camera: 1.5 px per unit at normal zoom on a 900-pixel-high view, half that in high flight (`renderer.js`). |
| [C] | Forge resolution is global. Changing it drops **every** cached sheet (`forge.js` `setRes`). Never vary it per asset. |
| [C] | Part count drives forge time (below), not draw time: a finished sheet costs one `drawImage` however many parts it had. |
| [R] | Stay within revision-3 part counts: 15–60 for domestic pieces, up to ~120 for heroes. Above that, split into separately placed pieces. |

## 10. Generation, caching and memory

| | Rule |
|---|---|
| [C] | Frames are forged lazily, the first time they are drawn, and in the background by forge workers when the page is served over http (`forge.js` `sheet`, `pump`). A sheet with no frame yet is forged **on the spot** the first time it is drawn, whatever it costs (`lazyRow`). |
| [C] | Cold forge of one frame at res 2 on the page thread of the test machine (a cloud container CPU, not the RTX laptop): `p1_h03` 120 ms, `p1_d01` 100 ms, `p1_e03` 92 ms, `p1_d_greathall` 53 ms, `p1_e_treehouse` 17 ms, `p1_h01` 11 ms. Astra's validation measured 20–640 ms for the same six at res 2 on a 16-thread Windows machine (`p1_d01`'s figure covers all four headings). These are forge costs, not frame rates. |
| [C] | Memory per sheet = dirs × 2 (frame + shadow) × (2r + 6)·res × (2r + h + 6)·res × 4 bytes. Measured: the six test sheets hold 25.7 MB at res 2 (18 images). `p1_d01` alone is 16 MB because all **4 headings** are forged although only one is ever drawn. |
| [C] | Every copy of an asset with the same palette and options **shares one sheet**: eight extra merchant houses added no memory and one cache key (test check 7). |
| [C] | The Forge cache is never trimmed on its own. Evicting by key prefix (`AS.Forge.clearCache('bld:p1_')`) frees the sheets; re-placing forges them again with the same pixels (test check 8). Ordinary site unload in the streamed worlds does not evict sheets. |
| [C] | In this region the six test sheets were half of all sprite memory (25.7 of 51 MB). |
| [R] | Make landmarks single-heading (saves 3/4 of `p1_d01`'s memory). Budget a whole culture's architecture under Astra's proposed 64 MB soft limit at res 2. |
| [R] | Prewarm landmark sheets during a loading screen or while the player is far away (`AS.Forge.want(sheet)` or `AS.Forge.complete(sheet)`), so the first sight never forges a 100 ms frame on the page. |

## 11. Streaming

| | Rule |
|---|---|
| [C] | Assets work with the existing systems unchanged: the forge workers built 6 of the 9 frames in the test; the page built the rest; unload and reload were clean. |
| [U] | The test region is not a streamed world (it loads whole). Lifecycle in a streamed world was not tested. Test: put two p1 settlements in the Large or Huge World, fly away until their sites unload and back, and record sheet counts (F3 panel) and forge stand-ins. |
| [U] | Collision and walking routes for p1 buildings were not part of this test (structures were placed non-solid). Test: add the supplied solid footprints to the walking grid and run the army route tests around the castle and through the gate passage. |

## 12. IDs, naming, metadata and manifests

| | Rule |
|---|---|
| [C] | Revision 3 IDs: `p1_<family letter><code>` or `p1_<family letter>_<name>` (`p1_h03`, `p1_e_treehouse`, `p1_d_greathall`); every ID must be unique across all of `AS.Models`. |
| [C] | `asset-manifest.json` values the test relied on and found correct: `id`, `dirs`, `r`, `h`, `visualBounds.measuredAlpha`, `terrainSupport.contacts`, `sockets` (`site_access`, `cliff_collar`, `passage`), `collisionRecommendation`, `completeSheetMemoryRGBABytes`. |
| [C] | Run-time metadata the test read from each model: `_arch.contacts`, `_arch.solids`, `_arch.sockets`, `_arch.roofs`, `_arch.assetId`. Keep returning it. |
| [R] | For each new family keep the same naming: `p2_<family letter>_<name>` for phase 2, the family letter fixed per culture, and record `revision` in `AS.ArchP1.assets` (or the phase-2 equivalent). |
| [R] | Keep supplying, per asset: `id`, `designId`, `family`, `roles`, `dirs`, `r`, `h`, `size`, measured alpha bounds per heading, support contacts, solid footprints, sockets (`site_access` always; `cliff_collar` for cliff pieces; `passage` with clear width for gates), part count, sheet memory, and the sha256 of each source file in `package-contents.json`. |

## 13. Acceptance check for new assets

A delivery is compatible when, after adding its files to `index.html` and `forge_worker.js`:

1. `node wyrmcrown/tools/test_archtest.mjs` (extended with the new IDs) passes: sources match their hashes, sheets forge in workers and on the page, drawn bounds match the manifest within ±1.5 units, copies share a sheet, unload and reload are clean, no page errors.
2. Each new asset is inspected in game from normal flight, the 500 ceiling, high flight (H), and Low quality.
3. The gallery (`wyrmcrown/tools/gallery.html`) shows every new ID with the right number of headings.
