# WYRMCROWN

A high-fantasy war of dragons. You are a wizard riding a fire dragon over the
Kingdom of Aldermere. Fly, fight and feed; seize the land's mines, villages and
places of power; carry gold home and build your town into a fortress; then
break the three rival dragon realms one stronghold at a time.

Built on the ALIEN STRIKE engine (`../alien-strike/`). Same approach: plain
JavaScript, no install, no build step.

## Run it

Double-click `PLAY_GAME.cmd` in the parent folder to play with recorded voices
and sound effects. It starts a local server and opens your default browser.
Python 3 is required; keep the launcher window open while playing.

Alternatively, run `python wyrmcrown/tools/serve.py` from the parent folder and
open the printed game URL. The `alien-strike/` folder must stay next to
`wyrmcrown/`, because the shared engine loads from there. Opening `index.html`
directly still runs the game, but uses synthesized audio fallbacks.

Click once anywhere to start the sound (browsers keep audio off until you
interact with the page).

## The world

Each realm looks like its own country: hedged farmland with hamlets, orchards,
stone circles and old battlefields; an ancient forest of glades, giant
mushrooms and moss-grown ruins; a frozen north of rune stones, ice formations
and ships locked in the ice; a blighted marsh of graveyards, gallows and bog
pools. Each has its own beasts — great stags and aurochs, glimmerdeer and
tree shamblers, frosthulks and snow stalkers, bloatlings and gravehounds —
its own giants and trolls, and somewhere in the far wilds, one colossus.

### What you are fighting (creature portraits)

Strike a foe, get struck, or rest your aim on one, and a card appears at the lower right:
a close-up portrait, its name and kind, its health (and poison), how it hurts you and a line
about it (`UI/foecard.js`). The portraits are `assets/portraits/<key>.png`, 256 × 256:
`dragon_<realm>`, `<realm>_soldier|archer|elite|siege` for each realm (human, elf, ice,
undead), and one per beast or monster (`troll`, `wolf`, `spindlelurker`, …). The files there
now are labelled placeholders; replace them with painted art of the same name. A portrait
missing from the folder is drawn as a placeholder in the game.

### The four partnerships in combat

Each rider casts its own spell and each dragon breathes its own breath (see
`src/game/combat.js` and `AS.Data.breaths` in `data/factions.js`):

| Pair | Spell | Breath |
|------|-------|--------|
| Aldric & Pyrrhax | golden spheres: 620 speed, 4/s, 11 dmg | fire: baseline reach and damage, burns |
| Ilythiel & Verdanthe | white arrows: 960 speed, 8/s, 5.5 dmg | emerald flame: 1.45× reach, 0.78× damage, roots troops |
| Ymra & Skaldfrost | ice shards: 430 speed, 1.6/s, 27.5 dmg, slows | freezing breath: 0.78× reach, 1.4× damage, drains fastest |
| Malkhar & Vorthrax | poison orbs: 340 speed, 2.5/s, 8 dmg + 9.6 poison | plague breath: 0.72× damage + 16/s poison for 3 s |

Spells cost 0.4 mana per point of damage, so every rider deals the same damage
per second at full rate and when mana runs short. Breaths are balanced on
damage per full charge. Armour weighs on each attack in proportion to the size
of its blows. Poison is a timed effect (`AS.Poison`): orb stacks are capped at
12, breath poison refreshes without stacking, and kills are credited to the
poisoner.

### Height in every world

`Z` and `X` work in every world (`src/game/altitude.js`). The dragon climbs to
and holds a height of up to 500 over the ground. The camera slides down and
widens as it climbs, and the shadow grows, fades and softens with height. Shots
at a dragon need range in 3D: bows and spears cannot reach one high overhead,
but ballistae, catapults and magic reach further. From high up, the breath burns
out before it reaches the ground. A rival dragon climbs to meet one that is
flying high. Thin mist hangs 190 to 360 over the ground, thickest over water
and woods.

The Large and Huge Worlds and the Wide Realm campaign also have relief
(`relief` in the map). Their mountain ranges have height, with summits and
saddles. Rising ground must be climbed. A steep face turns the dragon to skim
along it unless `Z` is held. Summits above the ceiling cannot be crossed, and
a ridge between an archer and the dragon blocks the shot. The ground there is
still painted flat; only the Mountain Test draws its relief.

The Wide Realm campaign builds some of its places as the Huge World's
settlements: Ashford is a market town, Kingsmead a walled town, Blackcrag a
castle, Elmshade an elf village, Saltmere a shire and two farms are farmsteads.
It adds an abbey, a roadside inn, two outlaw camps and three dungeons whose
hoards can hold a relic.

### The Huge World Test

`index.html?world=huge` (also on the title menu) is a generated continent
160 km across, built around the dragon as it flies (`maps/hugeworld.js`). It
has about 44 provinces of ten kinds: Heartland, Shire, Old Forest, Pinewood,
Highlands, Frostmarch, Moorland, Marsh, Badlands and Blight. Each kind has its
own ground colour, tree species, mountains and beasts. Danger rises with
distance from home, from safe ground through frontier to wild.

Places follow the land:
- dwarf holds are cut into the foot of the high ranges;
- elf villages sit round great trees in the old forest;
- hill-folk shires lie in gentle green country;
- harbours stand at river mouths, and castles guard river crossings;
- abbeys, market towns and walled towns stand in the settled lands;
- outlaw camps, dungeons, caves and ruins lie out in the wilds.

Landmarks (standing stones, giant bones, statues, crypts and more) are
discovered by flying low over them and pay a finder's reward. Dungeon and
outlaw hoards can hold a relic, which gives a free upgrade level.
The settlement layouts are in `src/game/settlements.js`, and the new
buildings in `src/gfx/models_world.js`.

### The Mountain Test

`index.html?world=mountain` (also "Mountain Test" on the title menu) is one
self-contained mountain region, 3 km by 3.5 km (`maps/mountaintest.js`). It
has a true heightfield (`src/gfx/mountain_terrain.js`): a Great Range with a
peak of about 250 m, a lower Front Range, a deep valley, a winding gorge, a
high pass with a fortified outpost, a waterfall, a river, a hidden basin, a
dwarven hold cut into the rock and a troll cave.

The dragon's flight ceiling is measured above sea level (125 m). Hills and
the Front Range can be flown over; the Great Range crest and the peak stand
above the ceiling, so the dragon must use the High Pass or the Windgap.
`Z` raises and `X` lowers a held altitude. Press `` ` `` (left of `1`) and
then `1`–`0` to start test scenarios A–J (`1` lowland approach … `7` an army
crossing the pass … `0` altitude descent); outside the picker the number row
casts spells as usual. The game logic is in `src/game/mountain.js`. Nothing outside this
map changes behaviour.

Without `Z` the dragon only rises over low ground; against a steep face it is
turned along the rock and skims it until it can top out. Holding `Z` climbs a
face head-on. The dragon's shadow grows, fades and blurs with height above
the ground beneath it; its tunables live in `MT.SHADOW` in
`src/game/mountain.js` (also `__mtn.M.SHADOW` in the browser console:
`scaleMin`, `scaleMax`, `alphaMax`, `alphaMin`, `softMax`, `h0`, `h1`).
Khaz Durn, the dwarf hold, is carved into the Wall (`hold` in the map's
relief) with an approach yard of halls, a smithy and watchtowers.

### The Army Command Test

`index.html?world=army` (also "Army Command Test" on the title menu) is a small
development scenario for armies that act without the dragon
(`maps/armytest.js`). South of the Greyspine, a mountain wall armies cannot
cross, stand your castle and the village of Hollowford. The Greyspine Pass is
held by raiders at the Gatewatch. Delver's Door leads underground through the
Gloomvault, where a horde waits, and up the Hollow Stair on the north side.
Blackthorn Fort stands beyond. Red Company waits at the castle with Brannoc
Deepdelver, a champion, and no commander; the Castle Watch (footmen and longbows)
stands beside it. Outlaws squat in the Burnt Mill west of the castle and at
Thornwick camp to the north-west: someone to fight near home (their guards come
back a while after you clear them). King Osric leads the Hollowford Guard
in defending the village. At 150 s of army time, raiders march from Blackthorn on
Hollowford.

Press `K` for the command panel (the realm waits while it is open). From it you
can assign commanders, give orders (follow, hold, defend, march, attack,
retreat, enter a passage) and settle an underground fight (auto-resolve or
retreat). You can also move troops between armies, save, load, send the raid at
once and unseal the Old King's Road. The armies are listed on the right, and an
arrow at the screen edge points to each army out of sight.

The rules are in `src/game/armies.js` (armies, commanders, orders, encounters,
save data), `src/game/routes.js` (route types and permissions) and
`src/game/autoresolve.js` (fights settled from the existing troop statistics).

### The Architecture Compatibility Test

`index.html?world=arch` (also "Architecture Compatibility Test" on the title
menu) puts six of Astra's revision-3 architectural assets into the game on the
Mountain Test's terrain (`maps/archtest.js`, `src/game/archtest.js`). The
sources in `src/gfx/arch_p1/` are the delivered files, unchanged. A royal
fortress and a merchant house stand on level lowland east of the castle fields,
an elven council citadel and a tree dwelling in the western foothill forest, and
a dwarven kingdom gate against the Wall with a vaulted hall below it. Each has
three of your troops at its door for scale.

Press `` ` `` then `1`–`6` to fly to each structure, `7`–`9` to see each pair
from the flight ceiling, and `0` to unload all six (their sheets leave the
sprite cache) and `0` again to put them back. The developer panel (`F3`) shows
the six sheets' memory. The technical rules for future assets are in
`handover/ASTRA_ASSET_CONTRACT.md`.
Commanders are in `data/commanders.js`. Near the dragon an army's soldiers are
ordinary troops. Far away it is a record that moves in fixed steps, and fights
there are auto-resolved against the actual enemy soldiers.

### Command Mode (C)

Press `C` (or the COMMAND button at the bottom of the screen) to command your
soldiers directly; `C` again flies the dragon. While you command, the dragon
soars quietly in slow circles, W A S D (or the arrows) pan the view, and the mouse
no longer casts or breathes. Soldiers you select stay selected when they leave the
screen.

- Drag a box to select soldiers (any mix of types). Click one to select it,
  Shift-click to add or remove one, double-click to select every soldier of that
  type nearby.
- Left-click the ground: the selection moves there. Left-click an enemy: it
  attacks at once. Left-click a guarded or enemy-held place: it assaults it.
- Right-click: a small menu with hold, defend, follow the dragon, retreat, move
  here, return home and the selection shortcuts.

Soldiers need no commander to defend themselves, help friends in a fight nearby,
fall back home when badly outmatched or obey an order near home. Going further
than 400 m (`AS.Command.CFG.LOCAL_R`, 1600 units) from
their home, or into a tunnel, needs a king or champion. A whole army sent
somewhere gets an ordinary army order, so it keeps going when the dragon leaves.
The rules are in `src/game/command.js`.

## Controls

| Key | Action |
|-----|--------|
| **W** | Beat your wings. Every downstroke adds speed. |
| **S** | Flare the wings: brake, turn tighter, hover low. Keep flaring low over open ground to land; resting heals and saves energy. **W** takes off again. |
| **A / D** | Bank left / right. Slow flight gives tight turns, fast flight gives wide sweeps. |
| **Space** (hold) | Fly low at your current pace. Add **W** for a fast power dive, or **S** to slow right down. Release to climb. |
| **Space** (double-tap) | Loop the loop. Bolts, arrows and breath miss you while you are over the top. Short cooldown, a little energy. |
| **Shift** | Sprint (burns energy) |
| **Z** (hold) | Climb and hold the height reached, up to a ceiling of 500. High up, bows cannot reach you, but your breath burns out before the ground. |
| **X** (hold) | Descend. **Space** drops a held height fast; back in the usual flying band the dragon keeps its own height again. |
| **Mouse** | Aim the wizard's staff |
| **Left click** | Cast magic bolts |
| **Double-click an animal** | Your dragon swoops down, snatches and eats it. Any flight key breaks off the hunt. |
| **Right click / F** | Dragon breath (uses its charge). The dragon turns its head toward the cursor, so you can fly one way and burn another. |
| **E** | Tap to snatch and eat prey (easy when you are low and not too fast). Hold to carry it home instead. Also travels through a waygate you own. |
| **Q** | Cast a stored spell (storm, frost nova, summon) |
| **T** | Hold court in your town: build, recruit, upgrade (the realm pauses) |
| **G** | Order your warband: click a site or a rival town on the map |
| **M** | War map |
| **Tab** (hold) | Realm overview |
| **C** | Command Mode: select your soldiers and order them with the mouse (C again flies the dragon). The flight style (keys or follow the cursor) is now chosen in Settings |
| **Esc / P** | Pause |

**Gamepad:** left stick flies, right stick aims, RT casts, LT breathes, A dives,
B snatches, X holds court, Y casts a spell, LB sprints.

## How a war goes

1. **Feed.** Flying burns energy. Double-click an animal and your dragon
   hunts it down and eats it, or fly low and not too fast over one and tap
   **E**. Hold **E** to carry it home instead: livestock in
   your own pastures is food and wealth, and a rival's livestock carried home
   joins your herds.
2. **Take land.** Each neutral site has guardians: bandits, wolves, ogres,
   trolls or giants. Defeat them, then circle low over the site to claim it.
   - Mines, villages, trade posts and castles send gold home by cart. Guard the
     carts, and raid your rivals' carts.
   - Wizard towers, wells, groves, crystals and relics give magic, healing and
     dragon powers.
   - Forts and castles give troops and shoot at your foes.
   - Watchtowers reveal the map, waygates let you travel fast, bridges take tolls.
   - Caves and ruins hold treasure that comes back some time after it is looted.
3. **Build.** Return home and press **T** to hold court. Each purchase
   visibly changes the town:
   - Defences: walls (palisade, then stone, then enchanted), archer towers,
     ballistae, catapults, mage towers and wardstones.
   - Army: soldiers, archers, knights and siege engines.
   - Economy: farms, a market, a temple, stables and livestock.
   - Upgrades for your dragon and wizard.
4. **Defend.** The rival dragons raid, capture land and fight each other as
   well as you. Each one flies its own way:
   - Sylvara's verdant dragon is fast and kites with bolts.
   - Hrimgard's frost dragon is a slow fortress.
   - Morgrave's necrotic dragon is relentless and raises the dead.
5. **Conquer.** A stronghold sits behind a ward fed by its three wardstones
   and its dragon. To take it:
   1. Topple the wardstones.
   2. Drive off its dragon.
   3. Destroy the stronghold while the ward is down.

   When every rival stronghold has fallen, the Wyrmcrown is yours. If yours
   falls, the war is lost.

Eight recorded wizard and dragon voices deliver 428 dialogue lines for combat,
exploration, resources, home warnings, victories and occasional exchanges.
Your own pair comes through clearly; nearby rivals fade with distance. Urgent
home warnings interrupt chatter, and routine lines have cooldowns. Options
controls voice and sound-effect volume and subtitles. Recorded speech plays at
its original speed and pitch.

Capturing an objective prompts your wizard or dragon to explain its reward.
There are 68 new recorded lines: one for every objective type in each realm.
They explain gold deliveries, troop places, nearby recovery, defences, map
vision, spell charges and waygate travel. Cave and ruin lines remind you to
collect the dropped treasure. Urgent warnings take priority over these lines.

The soundtrack uses the eight supplied recordings. **Soft Flowing Strings**
is the opening theme and human home music. The elf, ice and undead lands each
have their own home theme, and all four realms have a combat track. Music
follows the territory, with your own realm's pair in neutral land. Tracks
crossfade, loop continuously and soften while a character speaks. Adjust the
Music slider in Options. The game streams stereo MP3s at their original speed.

Recorded effects cover wingbeats, four breath types, livestock, rapid feeding,
dragon reactions, giants, trolls, catapults and collapsing buildings. The
complete library and production history are included in `audio/`. Existing
synthesized effects and ambience remain available as fallbacks.

Realms that fall behind gather strength (up to +35% income), and the lords
gang up on a runaway leader. Magic runes rise across the map, so a war is
rarely over until it is over.

## The campaign

Ten realms, played in order. Winning one opens the next in the atlas.

| # | Realm | Character |
|---|-------|-----------|
| 1 | The Sundered Crown | Four realms around one great river; a ruined crown-castle by the heartland lake |
| 2 | The Drowned Vale | A vast lake of islands; the island castle can only be reached by air |
| 3 | Frostspine Pass | A mountain wall with three passes splits north from south |
| 4 | The Riven Isles | An archipelago; an air war between island realms |
| 5 | Elderwood | An ancient forest full of clearings and places of power |
| 6 | The Ashen Wastes | A blighted land where food is scarce |
| 7 | Twin Rivers | Two great rivers: the bridges and the rich middle band decide everything |
| 8 | The Dragon's Spine | A ring of mountains guards a caldera of nests and a castle |
| 9 | Highmarch | Highland terraces held by a chain of forts |
| 10 | The Wyrmcrown | Everything at once, around the crown-castle in the central lake |

Later realms make the rival lords a little stronger, on top of the chosen
difficulty (Squire, Knight or Dragonlord).

## For testing

URL options (add them to `index.html?…`):

| Option | Effect |
|--------|--------|
| `map=sundered` | Start that map straight away (map ids are in `maps/`) |
| `god=1` | Invulnerable dragon |
| `gold=5000` | Starting gold for every realm |
| `demo=1` | All four dragons flown by the AI |
| `allRealms=1` | Unlock every realm and map |
| `fps=1` | Frame-time readout |
| `world=army` | The Army Command Test (`K`: command panel) |
| `world=arch` | The Architecture Compatibility Test (`` ` `` then `1`–`0`) |

The browser console has `AS.Debug`:

| Call | Effect |
|------|--------|
| `tp(x, y)` | Teleport |
| `see('elf')` | Jump to a town |
| `site('heartstone')` | Jump to a site |
| `hold(true)` | Hover in place |
| `gold(n)` | Add gold |
| `info()` | Print each realm's state |

The tools need the repo served over HTTP at `http://127.0.0.1:8766`, for
example with `npx http-server -p 8766` from the repo root, plus Playwright:

- `node wyrmcrown/tools/test_game.mjs` runs end-to-end checks of the core
  loop through real keyboard and mouse input. It covers the menus, flight,
  bolts, breath, eating, capturing, the court, victory, defeat, and a short
  all-AI war.
- `node wyrmcrown/tools/test_combat.mjs` measures each pair's spell and breath
  (rate, speed, damage, reach, balance) and checks poison.
- `node wyrmcrown/tools/test_hugeworld.mjs` checks the Huge World Test:
  streaming, where places stand, composed settlements, discovery, relics,
  road routes.
- `node wyrmcrown/tools/test_mountain.mjs` checks the Mountain Test: the
  ceiling, the pass, the gorge, cliff deflection, the shadow, the dwarf
  hold, army routes, line of sight and streaming.
- `node wyrmcrown/tools/test_altitude.mjs` checks height in the other worlds:
  Z/X and the ceiling, camera and shadow, weapons at height, a rival climbing,
  the Large and Huge Worlds, and the big worlds' relief (summits, saddles,
  ridges blocking shots).
- `node wyrmcrown/tools/test_armies.mjs` checks the Army Command Test:
  commander rules, route restrictions, the tunnel, auto-resolve, commander
  defeat, movement off the field, troop conservation, save and load.
- `node wyrmcrown/tools/test_archtest.mjs` checks the Architecture
  Compatibility Test: source hashes, sheets and drawn bounds against Astra's
  manifest, masonry overlays, ground contact, the shortcuts, shared sheets,
  unload and reload, and forge cost.
- `node wyrmcrown/tools/sim.mjs 12 normal 1 sundered` fast-forwards an
  all-AI war and logs each realm minute by minute.
- `tools/mapview.html?map=<id>` previews a whole map.
- `tools/gallery.html` shows every model.
- `tools/dragons.html` shows dragon poses.
- `node wyrmcrown/tools/shot.mjs <path> <out.png> [w] [h] [wait] [js]` takes
  a screenshot of any page.

See [DESIGN.md](DESIGN.md) for how the game is put together.
