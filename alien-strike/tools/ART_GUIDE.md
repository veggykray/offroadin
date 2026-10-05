# ALIEN STRIKE — art guide for procedural models

All art is generated in code. A **model** is plain data rendered by `AS.Forge`
(`src/gfx/forge.js`) into rotation sheets. Read `src/gfx/forge.js` and
`src/gfx/models.js` (the hero craft `craftModel` is the reference for quality and
technique) before writing a model.

## The model contract

```js
AS.Models.myThing = function (pal, opt) {
  return {
    r: 18,            // canvas radius in world units (must contain every part)
    h: 14,            // tallest part (world units)
    style: 'unit',    // 'hero' | 'unit' | 'prop' | 'decor' → outline weight (see forge STYLE)
    parts: [          // drawn in order, each as stacked horizontal slices from z0 to z1
      { z0: 0, z1: 4, side: '#4a4f58', top: '#9aa3ad',
        shape: (ctx, zt, anim) => S.poly(ctx, [...]),   // path only: add subpaths, no fill
        detail: (ctx, anim) => { ... },                   // drawn on the top slice: panel lines, glows
        stroke: 2,      // optional: stroke the shape instead of filling (rings, rails)
        ao: 0.4,        // darkening of the wall toward its base (default 0.4)
        flat: true,     // skip the light gradient (glass, glowing parts, decals)
        bevel: false,   // skip the top-edge bevel (tiny parts)
        when: (anim) => anim < 0.5,                       // optional per-frame visibility
      },
    ],
  };
};
```

- **Object space:** +x is forward (the nose or front), +y is starboard (right). Units
  are **world units**. The forge scales by its supersampling factor, so never multiply
  by pixel density yourself.
- **`shape(ctx, zt, anim)`** must only append path geometry. The forge calls
  `beginPath()` before it and fills or strokes after it. `zt` (0→1 up the part) lets a
  part taper (domes, cones, rocks). `anim` (0..1) is the animation phase for
  multi-frame sheets.
- **`detail(ctx, anim)`** draws on top of the part's top face in the same object space.
  The shape path is still current when it runs, so **call `ctx.beginPath()` before
  every fill or stroke in a detail.** The `S.*` helpers that fill (`S.dot`,
  `S.fillPoly`, `S.lines`) already do this.
- **Helpers:** `AS.Shapes` (alias `S`) provides `poly`, `sym` (mirror a half outline
  about y = 0), `circ`, `ell`, `rrect`, `blob` (irregular rock or organic outline),
  `star`, `seg`, `lines`, `dot` and `fillPoly`. Colour maths: `AS.U.C.shade(col, ±k)`,
  `C.mix(a, b, t)`, `C.str(col, alpha)`.
- **Palettes:** world palettes live in `data/worlds.js`: `choir`, `colony` and `native`,
  each with `a` (dark base), `b` (light base), `t` (trim), `g` (glow) and `d` (darkest).
  Units refer to them by name (`pal: 'choir'`) or inline objects. Design for
  `pal.a/b/t/g/d`, and fall back to sensible defaults when a key is missing.
- **Sheets:** units use 24 directions (creatures 16); `anims` gives 1–4 animation frames.
  Cost is roughly parts × slices × directions × frames: keep parts ≲ 25 and heights
  modest. Structures are one direction (their turrets or guns are separate rotating
  sheets).

## Lighting is automatic. Don't paint it.

The forge lights every part from the **top-left**: walls get a light→dark
horizontal gradient and an ambient-occlusion fade toward the ground, and top faces get
a diagonal gradient plus a bevel rim. The post pass adds a soft rim light and the
outline. So:

- Give each part a **side** (wall) and **top** colour with clear value separation. Top
  is usually lighter.
- Add **material detail** in `detail`: panel seams (`rgba(0,0,0,0.4)`, 0.35–0.5
  wide), bright specular dots on glass and metal, hazard stripes, vents, rivets,
  glyphs.
- Use **`flat: true`** parts with saturated colours for emissives (eyes, cores, engine
  glows, lenses, energy channels). The game adds dynamic light separately.
- Build **height and layering** from stacked parts at different z: hull, then superstructure,
  then turret, then sensor. Silhouettes come from the outline of the stack.

## Art direction

Polished modern indie arcade, seen top-down in 3/4. Clean illustrated forms, **strong
readable silhouettes**, convincing dimensionality, less clutter and higher quality.

- **Scale:** the camera shows about 850 × 480 world units, and 1 world unit is about
  1.7–2.2 screen px. The hero craft is about 50 units long. A typical enemy vehicle is
  20–34 units, infantry and creatures 10–20, structures 30–90, landmarks 80–220.
- **Silhouette first:** every class must be recognisable from its outline alone and
  distinct from its neighbours. Fast attackers are low and wedge-shaped. Heavies are
  wide, plated and blocky. Artillery shows long barrels or tubes. Missile units show
  pod racks. Drones have a lens, fins and a hover ring. Infantry are tall and thin.
  Never just recolour another unit.
- **Contrast with the ground:** enemies must not match their world's terrain in hue or
  value. Use a darker or lighter base than the ground, plus bright emissive accents.
- **Faction language:**
  - **Choir** (ancient alien machine-cult): bone-stone and ceramic plates (`pal.a/b`),
    violet or purple glow channels (`pal.g`), crystal shards, floating fins, glyphs,
    halo rings.
  - **Colony / FRC** (human frontier): gunmetal and off-white panels, amber hazard
    trim, teal or cyan lights, rivets, antennas, crates.
  - **Natives** (creatures): chitin, plates and flesh, with bioluminescent spots or
    sacs in warning colours (amber, magenta, toxic green).
- **Threat colour:** hostile emissives are warm or hostile (orange, red, magenta,
  violet). Player-side (FRC) emissives are cyan or teal or green.
- Avoid big flat empty tops: add a panel break, hatch, vent or glow, but keep it
  restrained. Fewer, larger details read better than many tiny ones.

## Workflow for model agents

1. Write new generator functions in **your own new file** under `src/gfx/`. Don't edit
   existing shared files (`forge.js`, `models*.js`, `data/*.js`, `src/game/*`).
2. Build a preview page `tools/<yourfile>.html` (copy `tools/craft.html`'s pattern: load
   `src/core/util.js`, `src/gfx/forge.js`, `src/gfx/models.js` and your file).
   Render each model large (3×) and at game scale (about 1.8×) on a ground colour from
   its world, at several headings. View it at
   `http://127.0.0.1:8766/tools/<yourfile>.html` with Playwright (Chromium only, at
   `/opt/node22/lib/node_modules/playwright/index.mjs`) and look at the screenshots
   yourself. Iterate until each model meets the direction above.
3. Optionally preview in-game: load `http://127.0.0.1:8766/index.html`, add your file
   with `page.addScriptTag({ url: '/src/gfx/<yourfile>.js' })`, override
   `AS.Data.enemies.<key>.model = { gen, pal, opt, anims, dirs }` (or
   `AS.Data.structures.<key>.model`), then
   `AS.App.startMission('<id>', { god: true })` and teleport with `AS.Debug.tp(x, y)`
   next to the entity.
4. Return the integration mapping (data key → `{ gen, opt, pal?, anims?, dirs?, r? }`).
   The lead integrates it.
