# WYRMCROWN — art guide for procedural models

WYRMCROWN is a high-fantasy game built on the ALIEN STRIKE engine. All art is generated
in code with the same **Sprite Forge** (`alien-strike/src/gfx/forge.js`): a model is plain
data (stacked horizontal slices) rendered into rotation sheets, lit from the top-left,
with an automatic rim light and outline. **Read first:**

1. `alien-strike/tools/ART_GUIDE.md` — the model contract (`r`, `h`, `style`, `parts`,
   `shape`, `detail`, `stroke`, `flat`, `ao`, `bevel`, `when`), lighting rules and helpers.
   Everything there applies here.
2. `alien-strike/src/gfx/forge.js` and `alien-strike/src/gfx/models.js` (the `S` shape
   helpers are `AS.Shapes`; `craftModel` is the quality reference).
3. `alien-strike/src/gfx/models_landmarks.js` / `models_struct_colony.js` — good examples
   of large buildings with roofs, walls and details at this quality level.
4. `wyrmcrown/data/palettes.js` — the faction palettes. Design for the palette keys,
   never hard-code a faction's colours inside a shared generator.

## The look

**Cinematic high fantasy, seen top-down in 3/4.** Think of a painted strategy-game map
brought to life: warm sunlight from the top-left, readable chunky silhouettes, rich but
restrained detail, clear value contrast against the ground. Not pixel art, not cartoon
mush, not grimdark mud. Every building must be identifiable from its silhouette alone.

- **Roofs carry the read.** From this camera most of what you see of a building is its
  roof. Give roofs real form: pitched roofs as two planes (a lit plane and a shaded plane
  meeting at a ridge line — draw them as separate parts or paint the split in `detail`),
  conical tower roofs as tapering stacks (`zt` shrinks the radius), domes, spires,
  crenellated parapets. Add ridge caps, roof tiles/shingle rows (thin darker lines),
  chimneys, dormers, snow caps (ice), moss (elf), broken holes (undead/ruins).
- **Walls:** the visible south/side walls get the automatic light gradient. Add windows
  (small warm `g`-coloured lit squares — they read as a living town), doors, timber
  frames (human), carved arches (elf), ice-crystal insets (ice), bone and iron
  (undead). Keep the wall height honest: a cottage wall is 6-8 units, a keep 20-34.
- **Foundations:** a slightly wider, darker plinth part at z 0-1.5 grounds a building.
- **Banners and flags** in `pal.k` / `pal.k2` on poles: tiny, but they make faction
  ownership readable at a glance. Use 2-4 anim frames for fluttering where it is cheap.
- **Emissives** (`flat: true`) for windows, magic glows, crystals, braziers, eyes.
- **Value contrast:** buildings must separate from grass (`#6f8a3e`), forest floor
  (`#4b6c34`), snow (`#dfe8f0`, so ice buildings need darker walls/outlines and blue
  shadows) and dead earth (`#4b4640`, so undead buildings need lighter bone trim and
  green glow to pop).

## Scale (world units)

The camera shows about **1000 × 560 world units** (1 unit ≈ 1.4-2 screen px). The hero
dragon is ~64 long with a ~92 wingspan.

| Thing | Size |
|---|---|
| person (peasant, soldier, skeleton) | 9-11 tall, ~4 wide (`r` 6-7) |
| sheep / goat | 8-9 long · cow / deer / boar 12-14 long · horse 15 |
| ogre / troll | 18-24 tall · giant 34-40 tall |
| cottage / house | 22-34 footprint, 14-26 tall to the roof ridge |
| barracks, stable, market, temple | 40-60 footprint |
| archer tower | 20-26 base, 50-64 tall · watchtower 14-18 base, 60 tall |
| keep / stronghold | 100-130 footprint, 60-90 tall (level 3 biggest) |
| wall segment | 40 long × 7 thick × 14-18 tall · gate 40 wide |
| tree | 14-36 tall, crown radius 7-18 · elven great tree up to 60 |
| mine, fort, ruins, castle sites | 60-160 |

`r` must contain every part (canvas radius) and `h` is the tallest part. Keep parts ≲ 30
and heights modest — cost is parts × slices × directions × frames.

## Sheet conventions

- Buildings and sites: **1 direction** (they never rotate). Their `anims` may be 2-4 for
  flags, smoke, windmill sails, glowing magic (`anim` 0..1 in `shape`/`detail`/`when`).
- Wall segments, gates, bridges, fences, carts: **16 directions** (they are placed at any
  angle). Model them along the **x axis** (length along x, thickness along y).
- Creatures and people: **16 directions**, **4 anim frames** = walk cycle (legs swing,
  `anim` 0..1). Object space +x = facing direction.
- Siege engines (ballista, catapult): **24 directions**, 1-3 anim frames (firing arm).
- Terrain decor (trees, rocks, bushes): 1 direction, `style: 'decor'` (no outline —
  they are baked into the ground). Provide several seeded variants via `opt.seed`.

## File assignments

Each artist owns **one new file** under `wyrmcrown/src/gfx/` and must not edit any other
file (no shared files, no `alien-strike/` files). Register generators on `AS.Models` with
the exact names below, signature `AS.Models.<gen>(pal, opt)`, `opt` always optional.
At the end of the file, push gallery entries (see `wyrmcrown/tools/gallery.html`):

```js
(AS.Gallery = AS.Gallery || []).push({ group: 'Human buildings', bg: 'human', items: [
  { name: 'keep L1', gen: 'human_keep', pal: 'human', opt: { level: 1 } },
  { name: 'wall', gen: 'human_wall', pal: 'human', dirs: 16 },
  ...
] });
```

### Faction architecture files — `models_human.js`, `models_elf.js`, `models_ice.js`, `models_undead.js`

Same building list for every faction, prefixed with the faction key
(`human_`, `elf_`, `ice_`, `undead_`). Each must look unmistakably like its faction:

| gen suffix | what | notes |
|---|---|---|
| `_keep` | central stronghold | `opt.level` 1-3: L1 modest keep, L2 bigger with towers, L3 grand citadel. Footprint ~100/115/130 |
| `_house` | dwelling | `opt.v` 0-3 four distinct variants |
| `_barracks` | troop hall | training yard feel (weapon racks, banners) |
| `_farm` | farmstead | farmhouse + barn / granary (fields are ground decals, not part of the model) |
| `_stable` | stables | long low building, hay, fenced paddock corner |
| `_magetower` | mage tower | tall, faction magic glow on top (`anims` 4 pulsing glow) |
| `_tower` | archer tower | defensive, archer platform on top (crenellations) |
| `_ballista` | anti-dragon ballista | **24 dirs**, mounted on a small round platform; +x = aim direction |
| `_catapult` | catapult / trebuchet | **24 dirs**, `anims` 3 (arm down → up → released) |
| `_wall` | wall segment | **16 dirs**, 40 long along x, crenellated top. `opt.level` 1 = timber palisade, 2 = stone, 3 = reinforced/enchanted |
| `_gate` | town gate | **16 dirs**, 40 wide along x, two gate towers. `opt.level` 1-3 |
| `_watchtower` | watchtower | tall and slim, lookout platform and brazier/beacon (`flat` glow) |
| `_temple` | healers' temple | faction shrine/chapel; soft healing glow |
| `_market` | market | stalls with awnings, crates, goods |
| `_workshop` | siege workshop | timber cranes, half-built engine, logs |
| `_wardstone` | ward shrine | a monolith/obelisk with a strong faction-glow rune, small; `anims` 4 pulse |
| `_roost` | dragon roost | a raised stone platform/perch beside the keep, claw-scratched, faction banners |

Faction direction:
- **human** (Kingdom of Aldermere): warm grey ashlar stone, timber-framed upper storeys
  (`w` beams on `s` plaster), terracotta (`t`) or slate roofs, round towers with conical
  roofs, crenellations, crimson-and-gold banners. Sturdy, organised, prosperous.
- **elf** (Sylvaran Realm): ivory stone (`b`) in flowing curves, leaf-shaped and
  crescent plans, slender spires, copper-teal roofs (`t`), living trees growing through
  buildings, silver filigree, cyan-green crystal glows (`g`). Elegant, airy, ancient.
- **ice** (Hrimgard): blue-grey stone (`a`/`b`), thick-walled nordic longhouses with
  heavy snow-laden roofs (`t` snow white with blue shading), carved timber gables,
  translucent ice crystal spires and walls (`s`, often `flat` with a pale glow), frost
  blue braziers. Hardy, fortified, cold.
- **undead** (Dominion of Morgrave): black stone (`a`/`d`), gothic spiked roofs, broken
  and patched masonry, bone ornaments and skull motifs (`s`), iron spikes, sickly green
  (`g`) and purple (`k`) glows from windows and braziers, crypt-like dwellings. Menacing
  but still readable.

### `models_sites.js` — neutral objectives and props (palette `neutral` unless noted)

| gen | what |
|---|---|
| `site_goldmine` | mine entrance cut into a rocky hillock, timber frame, rail track, ore cart, gold ore piles (`#e8b84a` glints, `flat`) ~70 |
| `site_cottage` | thatched village cottage, `opt.v` 0-3 |
| `site_villagehall` | village hall / inn with sign, ~44 |
| `site_well` | village well with roof ~12 |
| `site_windmill` | windmill, **`anims` 4** sails rotating ~30 base |
| `site_ruins` | ancient ruins: broken columns, toppled arches, overgrown, ~90 |
| `site_wizardtower` | lone arcane wizard tower, crooked, purple-blue glow, ~30 base 90 tall, `anims` 4 |
| `site_magicwell` | ring of carved stones around a glowing pool (`flat` blue-cyan), `anims` 4 shimmer |
| `site_fort` | abandoned fort: broken palisade/stone curtain, ruined gatehouse, ~130 |
| `site_bridge` | stone arch bridge **16 dirs**, length 120 along x, width 26 (deck level, low parapets) |
| `site_shrine` | standing-stone circle with central altar, glowing runes, ~60 |
| `site_cave` | rocky cave mouth in a boulder mound, dark interior, bones, ~70 |
| `site_nest` | dragon nest: huge ring of branches on a rock outcrop with 3 eggs (`flat` faint glow), ~70 |
| `site_tradepost` | trade post: colourful tents, stalls, crates, a cart, ~80 |
| `site_oldwatch` | old wooden watchtower on stilts, ~16 base 56 tall |
| `site_castle` | ruined old castle: keep shell, broken towers, ~160 |
| `site_crystal` | mana crystal cluster, tall violet-cyan crystals (`flat` glow), `anims` 4 pulse, ~40 |
| `site_relic` | relic altar on a dais, floating golden relic, `anims` 4, ~40 |
| `site_waygate` | stone ring/arch portal with swirling light inside, `anims` 4, ~50 |
| `site_grove` | enchanted grove centre: a glowing ancient stump/altar with fireflies, ~40 |
| `site_chest` | treasure chest (gold spilling) ~10 |
| `prop_haystack`, `prop_crates`, `prop_barrels`, `prop_logs`, `prop_stall`, `prop_tent`, `prop_campfire` (`anims` 4 flames), `prop_signpost`, `prop_statue`, `prop_gravestone` (`opt.v` 0-3), `prop_banner` (pole + flag in `pal.k`/`pal.k2`, `anims` 4 flutter) | small props, 6-20 |
| `prop_fence` | wooden fence segment **16 dirs**, 24 long along x |
| `prop_cart` | wooden cart with goods/gold sacks **16 dirs**, ~18 long, +x forward (a horse is drawn separately in front of it) |

### `models_units.js` — creatures and people (16 dirs, 4 anim frames walk cycle)

Animals (fixed natural colours, ignore `pal`): `ani_cow`, `ani_sheep`, `ani_goat`,
`ani_deer`, `ani_boar`, `ani_horse`, `ani_wolf`. Clear silhouettes at 8-15 units: cow
with patches and horns, fluffy round sheep, goat with beard/horns, deer with antlers,
boar dark and bristly with tusks, horse with mane and tail.

People (clothing from `pal`: `a` main garment dark, `b` main garment light, `t` trim,
`k` faction colour, `skin` skin tone): `ppl_peasant` (straw hat, hoe or basket),
`ppl_villager` (`opt.v` 0-3 different clothes/hair), `ppl_soldier` (spear + shield in
faction colours), `ppl_archer` (bow, hood), `ppl_knight` (armour, helm plume, sword,
faction tabard), `ppl_mage` (robe, staff with `g` glow).

Faction troops: `trp_elf_warden` (elegant armour, glaive), `trp_ice_berserker` (furs,
axe, horned helm), `trp_undead_skeleton` (bones, rusty sword and shield, green eye
glow), `trp_undead_ghoul` (hunched, clawed). Use `pal` of their faction.

Monsters (natural colours): `mon_ogre` (fat, club, ~20 tall), `mon_troll` (lanky,
mossy grey-green, ~24), `mon_giant` (huge, ~38 tall, tree-trunk club, animal-skin
clothes), `mon_bandit` (hooded, crossbow).

Siege on the move: `sg_catapult_cart` (24 dirs, rolling wheels anims 4).

### `models_nature.js` — terrain decor (1 dir, `style: 'decor'`, `opt.seed` variants)

`tree_oak`, `tree_pine`, `tree_birch`, `tree_willow`, `tree_elder` (elven great tree,
silver bark, luminous leaves, up to 60 tall), `tree_dead` (twisted black, for cursed
lands), `tree_snowpine` (snow-laden conifer), `tree_fruit` (orchard tree), `bush`,
`bush_berry`, `flowers` (`opt.col`), `reeds`, `rock_mossy`, `rock_snow`, `rock_dark`,
`ice_shard`, `mushrooms_glow` (cursed), `bones_pile`, `stump`, `wheat` (a small sheaf
cluster). Trees need **crowns with real volume**: a dark underside ring, mid tone body
and a lit top-left highlight cluster (several overlapping blobs), visible trunk at the
base, and a soft contact shadow. Variety matters — vary crown shape, size and tone per
seed so forests don't look stamped.

## Workflow

1. Serve the repo root: `python3 -m http.server 8766 --bind 127.0.0.1` (it is usually
   already running — check with `curl -sI http://127.0.0.1:8766/wyrmcrown/tools/gallery.html`).
2. Write your models file. Push your gallery entries at the end.
3. Screenshot: `node wyrmcrown/tools/shot_gallery.mjs models_human.js /tmp/<you>/human.png`
   (full page; optional 3rd arg = group filter; 4th = crop `x,y,w,h`). **Open the PNG and
   look at it yourself.** Check: silhouettes, roof form, contrast on the ground colour,
   outline weight, nothing clipped by `r`/`h`, detail not too noisy at game scale (1.8×).
4. Iterate until each model meets the direction above. Quality bar: at least as polished
   as the ALIEN STRIKE colony structures and hero craft. No placeholder boxes.
5. Do **not** commit, and do not edit any file except your own models file (and scratch
   files under /tmp). Report back: the gen names you registered, their `r`/`h`, dirs and
   anims, and anything the integrator must know (e.g. anchor offsets, special opts).
