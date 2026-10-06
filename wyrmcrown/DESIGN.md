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
  - `realm_terrain`: biomes, rivers, lakes, islands, ridges, forests, roads, decor.
  - `dragon_art`: the segmented dragon and rider rig with live wings; four dragon kinds (see below).
  - Model sets: nature, the four realms, units, sites.
  - Realm decals: plazas, fields, pastures, lanes, roads.
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
- **Landing:** flaring low and slow over open ground settles the dragon onto
  the ground with a final cupped wingbeat and dust. Grounded, it folds its
  wings, turns on the spot, can still cast and breathe, and rests (faster
  healing, almost no energy drain) at the risk of ground troops. **W**, a
  dive or a sprint launches it again.

Energy (food) drains with flight, sprinting and breathing and is restored
only by eating animals. Animals are snatched in a low pass, carried, then
eaten (a visible action), or flown home if stolen.

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
