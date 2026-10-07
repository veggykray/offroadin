# WYRMCROWN: design and architecture

## What it is

Arcade aerial combat, territory control, town building and resource
competition. One player (the human Kingdom of Aldermere) fights three AI
realms. The code is organised for four players later: every realm is a
`Faction` with its own dragon, and each dragon is flown by a *pilot* that
fills the same input record. Today the pilots are `HumanPilot` and `AIPilot`;
a networked or local second player would be another pilot.

## Reuse of the ALIEN STRIKE engine

WYRMCROWN is a sibling folder that loads the shared engine from
`../alien-strike/`. The engine was extended through backward-compatible hooks
and ALIEN STRIKE still passes its own test suite.

| Shared module | Used for |
|---------------|----------|
| `core/util, input, save` | Maths and RNG, input actions (WYRMCROWN rebinds them with `Input.configure`), save data (`Save.configure` with its own keys and profile) |
| `gfx/forge, models*` | The Sprite Forge. Every 3D-looking sprite is a stack of slices rendered once into rotation × animation sheets: buildings, units, animals, trees, sites and dragon segments |
| `gfx/terrain` | Chunked terrain rasteriser, decals and decor stamping. `RealmTerrain` subclasses it with authored geography and five biomes |
| `gfx/renderer, particles, atmosphere` | Drawing, lights, particles, clouds and haze. The realm supplies the draw hooks |
| `game/camera, entity, projectiles` | Camera, base entity, projectile pools (with style, trail and hit hooks) |
| `audio/synth, audio, music` | Procedural sound effects, ambience beds and adaptive music. WYRMCROWN adds its own recipes, beds and instruments |
| `UI/kit` | The DOM and canvas helpers shared by both games' menus and HUDs |

## Code map (`wyrmcrown/`)

- **`data/`**: pure tables.
  - Palettes.
  - The four factions (dragon stats, breath, rider, troops, AI personality, music).
  - Sound recipes.
  - Buildings, court actions, upgrades, troops and difficulty.
  - Neutral site kinds.
- **`src/gfx/`**: art.
  - `realm_terrain`: biomes, rivers, lakes, islands, ridges, forests, roads, decor, ground detail.
  - `dragon_art`: the segmented dragon and rider rig with live wings; four dragon kinds (see below).
  - Model sets: nature, the four realms, units, sites; the beasts of each
    land (`models_beasts`, `models_beasts2`), giants, trolls, ogres and the
    colossi (`models_giants`), landmarks and ruins (`models_landmarks_realm`),
    extra town buildings (`models_town_extra`).
  - Realm decals: plazas, streets, fields, pastures, roads, drifts, rubble,
    battlefields, bone fields, fairy rings, pools.
- **`src/game/`**: simulation.
  - `realm`: the match. It owns everything and is the renderer's game object.
  - `dragon`: the flight model, vitals, rig layout and drawing.
  - `pilot`: human input becomes the dragon's input record.
  - `combat`: staff bolts, breath, effects, defences' missiles, ground hazards.
  - `life`: animals, people and birds. Data-oriented with level of detail; handles feeding and stealing.
  - `nav`: A* over a coarse grid, path smoothing against the real ground.
  - `building`, `troops`, `faction`: towns, their economy and the town plan.
  - `sites`: neutral objectives and their capture.
  - `powerups`: runes and spells.
  - `advisor`: "what to do next".
  - `scenery`: the places of the realm (see "The look of the realm").
  - `ai`: the strategist and the pilot.
  - `campaign`: unlocks and map tiers.
- **`src/audio/realm_audio.js`**: region-mixed ambience, creature calls, wind and music direction.
- **`maps/`**: ten hand-authored maps (pure data).
- **`UI/`**: HUD, court (town management), war map, menus and atlas.
- **`tools/`**: tests, simulator, previews, screenshots.

## The four dragons (`dragon_art.js`)

Each realm's dragon is a different kind of creature, not a recolour. The kinds
share the rig (a 12-node spine of pre-rendered segment sheets plus wings drawn
live each frame), but each has its own spine proportions, segment models, wing
renderer and ambient effects.

| Realm | Kind | Silhouette | Wings | Effects |
| --- | --- | --- | --- | --- |
| Aldermere | Ember Wyrm | classic crimson dragon; swept horns with gold rings, royal blue caparison and gold peytral, spade tail | bat membrane with veins and a sunlit glow along the trailing edge | embers, glowing eyes |
| Sylvara | Glade Serpent | long neck, slim body, long tail; stag antlers with leaves, whiskers, leaf crest, frond-fan tail | layered leaf feathers with coverts | drifting light motes |
| Hrimgard | Winter Tyrant | heavy, blocky and armoured; icicle beard, crown of crystal horns, glowing crystal spires and a crystal club tail | faceted crystal panes with a jagged edge and glints | cold vapour, crystal glow |
| Morgrave | Unburied | gaunt skeleton; skull with green eyes, ram horns, vertebra neck and tail, ribcage with ghost fire, bone-blade tail | ragged membrane, finger bones past the edge, rot holes and a green rim light | ghost fire, grave smoke |

The rider sits at a per-kind height on the back. Each dragon's sheets are
built while the match loads, so a rival's first appearance never stalls a
frame. Wing and effect drawing costs about 0.3–0.6 ms per dragon per frame.
Each realm card shows the dragon's play style: a role, speed, agility,
toughness, breath and recovery pips, and a one-line summary.

## Flight model (`dragon.js`)

The dragon always flies forward; it never hovers like a helicopter.

- **Speed:** each wing stroke has a downstroke that adds thrust. **W** raises
  the stroke rate, and gliding bleeds speed slowly.
- **Turning:** turn rate falls as speed rises, so slow flight turns tight and
  fast flight carves wide arcs. Heading follows the turn with momentum, and
  the body banks into turns.
- **Height:** **Space** takes the dragon low at its current pace. With **W**
  it becomes a fast power dive; with **S** a slow, low glide. Releasing it
  climbs back. **S** alone flares the wings, which brakes and settles to a
  low hover-glide.
- **Sprint:** a fast, energy-hungry stroke.
- **Loop the loop:** a double-tap of **Space** flies a vertical circle along
  the heading in 1.25 s: up, over on its back (drifting back along its own
  line, so a chaser overshoots) and out on the same heading. For most of it
  the dragon can't be targeted or damaged. 3.5 s cooldown, 6 energy.
  It is drawn as an arcade loop built for this camera, not a rigid rotation:
  every spine node sits at its own point on a vertical ellipse along the
  heading (the neck a little ahead, the tail trailing, so the body curves
  round the arc); each segment's sprite heading is the screen direction of
  its travel, so the body swings up the screen on the climb, flips over the
  top (tinted with the belly colour, wings drawn above it, rider hidden
  beneath) and points down the screen on the dive; length is never
  foreshortened below 0.55; the dragon grows about 12% as it rises toward the
  camera; when the heading runs up or down the screen the loop leans sideways
  so it never flattens to a line; the ground shadow stays under the body and
  fades as the dragon climbs away from it. Only 30% of the climb is gameplay
  height, so the camera does not chase the dragon up and swallow the rise.
  Rival dragons loop now and then when a rival dragon is hitting them
  (Sylvara most often).
- **Landing:** flaring low and slow over open ground settles the dragon onto
  the ground with a final cupped wingbeat and dust. Grounded, it folds its
  wings, turns on the spot, can still cast and breathe, and rests (faster
  healing, almost no energy drain) at the risk of ground troops. **W**, a
  dive or a sprint launches it again.

Energy (food) drains with flight, sprinting and breathing and is restored
only by eating animals. Animals are snatched in a low pass, carried, then
eaten (a visible action), or flown home if stolen. Double-clicking an animal
hands the flying to a hunt autopilot (`pilot.js`): it lines up, skims in low
a little faster than the animal can run (but under snatch speed, for the long
reach), lunges on the last stretch, snatches and eats. Any flight key breaks
off. A click on an animal holds the staff for 0.4 s so the first click of a
double-click doesn't shoot dinner.

## Combat (`combat.js`)

- **Staff bolts:** fired from the rider's staff toward the cursor in
  *projected* screen space, so what you see is what you hit. They have light
  aim assistance and cost mana.
- **Breath:** a cone from the jaws, ticking ten times a second, limited by a
  regenerating charge and energy. The head swings up to about 75° toward
  the cursor (or the AI's target), so you can fly one way and burn another,
  and the stream rises to meet a dragon you point at. Each realm's breath has its own effect:

  | Realm | Breath | On troops and dragons | On buildings |
  |-------|--------|-----------------------|--------------|
  | Aldermere | Fire | Burns | Sets buildings alight |
  | Sylvara | Verdant | Entangles troops | Roots crack masonry |
  | Hrimgard | Frost | Freezes and slows | Makes stone brittle |
  | Morgrave | Necrotic | Withers and raises skeletons from the slain | Rots buildings |

  Low breath is stronger than high breath.
- **Defences:** archers, ballistae, catapults (telegraphed ground blasts) and
  mage towers all use `Combat.shoot`.

## Towns and economy (`faction.js`, `building.js`, `UI/court.js`)

- **Town plan:** generated around the stronghold.
  - An inner ring of major buildings.
  - Four quarters of houses that grow along the gate road.
  - Rings for towers and engine platforms, and a wall ring with a gatehouse.
  - Farms with fields and pastures, wardstones, watchtowers.

  Purchases visibly raise scaffolding and then the building.
- **Gold is earned by doing things:**
  - carts from mines, villages, trade posts and castles, which must reach the
    town square and can be raided;
  - tolls at bridges;
  - treasure;
  - kills, dragon kills and raids on buildings;
  - conquest;
  - a small trickle of taxes from houses and market sales of livestock.

  Island sites with no road home pay by courier.
- **The court** (T) pauses the realm. It sells defences, army, economy,
  dragon upgrades and wizardry, with live prices and the reason anything is
  unavailable.

## Winning (`faction.js`)

A stronghold is shielded by a ward. Its strength comes from its three
wardstones plus its living dragon, and the damage it lets through drops to
8% at full strength. A rival is eliminated when its stronghold falls. The
match is won when all rivals are gone and lost if the player's stronghold
falls.

**Comeback rules:**
- Realms that fall behind the leader earn up to +35% income.
- The AI targets a runaway leader.
- Dragons return from defeat with a short shield.
- Power-up runes are open to anyone.

## Rival AI (`ai.js`)

- **`AILord`, the strategist:**
  - Spends gold through a personality-specific build order, with
    emergencies first (rebuild wardstones, wall up after a raid, troops).
  - Musters warbands to seize sites, raid rival outskirts or besiege a
    broken rival, but only where they can walk.
  - About once a second picks the dragon's goal: retreat, hunt, defend,
    duel, power-up, harass a rival town, siege, raid carts, capture, patrol.
- **`AIPilot`:** flies that goal through the same input record as the
  player, so it obeys the same flight model. It flies strafing attack runs,
  kites (the elves), times its breath when aligned and casts stored spells.

| Personality | Realm | Style |
|-------------|-------|-------|
| `balanced` | Aldermere | Organised |
| `evasive` | Sylvara | Kites, fast raids |
| `fortress` | Hrimgard | Defences, holds its half |
| `aggressive` | Morgrave | Early raids, theft, sieges |

## Taunts (`data/taunts.js`, `src/audio/voices.js`)

- **Who says what:** wizards are inventive and petty; dragons are primal,
  arrogant and physically insulting. Every speaker–target pairing has
  hand-written lines, mixed with lines generated from each realm's
  vocabulary:
  - humans use pub insults;
  - elves condescend in the language of nature;
  - the ice folk sneer at warmth and weakness;
  - the undead talk body horror.

  Lines are dealt from a shuffled deck, and recently heard ones are skipped.
- **Voices:** the browser's speech synthesiser. Wizards are pitched high;
  dragons are the lowest pitch, slowed, with a synthesised growl under the
  words. Without speech voices, a burble of syllables stands in and the
  subtitles carry the words.
- **One voice at a time.** Your own pair takes priority, a reply follows its
  line at once, and everything else waits out a quiet spell of 5–9 seconds.
  Each speaker also has a long cooldown, so taunts stay occasional.
- **Rivals are local.** Their voices fade with distance, and beyond about
  half their range you only catch a snippet.
- **Triggers:** meeting a rival dragon, trading hits, driving one from the
  sky, rivals squabbling within earshot, and taking a rival's land.

## Weather (`weather.js`)

- **Fronts:** rain fronts drift across the realm with the wind every few
  minutes, and some are thunderstorms.
- **Lightning:** it strikes inside storms, and a dragon flying high in one
  draws the bolt, so in a storm you fly low.
- **Each land's own air:**
  - snow over Hrimgard (a front over the ice becomes a blizzard);
  - ash over the blight;
  - motes of light in the Sylvaran forest.
- **Sound and light:** rain darkens the light, lightning flashes the screen,
  thunder rolls in late with distance, and the rain bed and wind swell in
  the mix.

## World life (`life.js`)

Herds of livestock and wild animals, villagers and farmers, and flocks of
birds. They live in their own spatial grid with level-of-detail updates, so
hundreds of creatures cost little. Animals flee dragons and breath, people
run for cover, and stolen herds change hands.

Each land has its own ecology, placed by seed in open country away from
towns, sites and roads:

| Land | Herds (food) | Too big to snatch | Predators (lairs, team wild) | Critters |
| --- | --- | --- | --- | --- |
| Aldermere / heartland | great stags, aurochs, deer, boar, horses | — | moorhounds, bears | hares, foxes |
| Sylvara | glimmerdeer, marsh croakers | elderhorns | spindle lurkers, great beetles, tree shamblers | hares, foxes |
| Hrimgard | rime elk, goats | frosthulks, woolly tuskers | snow stalkers, ice crawlers | snow hares |
| Morgrave | — | bloatlings, stilt striders | gravehounds, carrion crawlers, plague boars | rats |

Predators hold a lair (a bone-strewn patch) and chase whatever comes within
their leash, like the guardians of a site. Giants, trolls and ogres keep
their stats everywhere but take the look of the land they haunt (hill,
frost, wood and corpse giants; cave, moss, frost and blight trolls; hill and
swamp ogres), and every monster rolls one of three visible variants from its
position. One colossus per land (a wandering titan, the spider queen, the ice
behemoth, the great worm) roams the far wilds; it is passive until hurt.
Troop sprite sheets are forged on first sight, so none of this slows loading.

## The look of the realm

Everything is judged from the gameplay camera. The rules, in priority order:
silhouette, value contrast against the ground, size, shape, visible geometry,
then material detail.

- **Relief** (`realm_terrain.field`): rolling hills over the farmland and
  heartland, gentle swells under the forest, craggy broken ground in the
  north and the blight, on top of the broad landscape and the authored
  ridges; the valleys still ease down to the water. Navigation ignores
  terrace steps, so relief is free.
- **Ground detail** (`colorize`): flower meadows and dry patches, trodden
  verges along the roads and mud along the banks; moss cushions, dark loam
  and luminous ferns; snow with rock showing through on the high ground,
  sheets of ice in the hollows and wind-scoured drifts; dead yellow grass,
  bone chips, fine cracked earth in patches and bog pools in the low ground;
  leaf litter under every canopy; lily pads on elven water. Glades are opened
  in the woods (most in Sylvara), and forest edges are scrubby.
- **Decor** (`stampDecorGen`): shore boulders, reeds, drifts banked against
  northern rocks and trees, bushes at forest edges.
- **Places** (`scenery.js`): composed scenes, two to four of each kind per
  10k × 10k, placed by seed and kept clear of towns, sites, roads and water.
  Aldermere: hamlets, orchards, stone circles, ruined towers, battlefields,
  roadside shrines, deserted camps, burned farms, a colossus statue, a
  broken statue, a dragon skeleton, old foundations. Sylvara: the great
  tree, mushroom glades with fairy rings, moss ruins, a forest temple, forest
  pools, a colossal stump. Hrimgard: rune stones with braziers, a ship
  frozen into a lake, ice formations, longhouse ruins, frozen travellers, a
  frozen waterfall, pass markers. Morgrave: graveyards with mausoleums,
  gallows, dark obelisks, a ruined chapel, colossal dead trees, a giant
  skull, sinkholes, bogs, plague carts. Props are drawn in the normal
  depth-sorted pass; the biggest are solid ground for landing.
- **Towns** (`faction.plan`): a main street from the square to the gate, a
  crooked ring street, side lanes to the walls and two courtyards, with
  house slots along them (cramped by the main street, looser by the walls);
  a `streets` decal with cart ruts and cobbled junctions; banners, braziers
  and statues round the keep; hedgerows or fences round the fields, orchard
  rows, hay and a cart at every farm. Two house families per kingdom.
- **Destruction** (`building.js`): hurt buildings show soot and cracks;
  burning ones throw flames and embers; a fallen one bursts into masonry
  and roof tiles and leaves a permanent `rubble` decal (wall stubs in the
  faction's stone, charred beams, a heap of broken masonry) that smoulders
  for a few seconds.
- **Breath** (`combat.js`): a hot core, rolling flame, whirling embers,
  smoke rising behind the stream, sparks where it meets the ground.
- **Weather** (`weather.js`): rain and storms with lightning; snow that
  streaks sideways when the wind blows across Hrimgard; ash and motes; mist
  banks that drift over the blight's bogs and the forest glades; cloud
  shadows and distance haze from the engine's atmosphere layer.

## Maps

Each map is pure data:

- size and seed;
- regions (biome blobs);
- the four towns with their gate directions;
- rivers, lakes and islands;
- mountain ridges and forests;
- roads and bridges;
- 34–56 neutral sites with guardians;
- wild herds and rune circles.

A map can also set `peaksBlock` to make its high peaks a wall that only
dragons cross. Frostspine Pass uses it, so its three passes are true
chokepoints. Map 1 is the reference. `tools/mapview.html` previews any map, and
`tools/sim.mjs` runs an AI war on it.

## Performance notes

- Sprites are pre-rendered sheets and terrain is rasterised in cached
  256-unit chunks.
- Life, troops and buildings live in spatial grids.
- Navigation paths are cached.
- Particles use a fixed pool.
- Headless Chromium holds about 40–50 fps with around 250 buildings, 80
  troops and 300 creatures on screen-adjacent chunks.
