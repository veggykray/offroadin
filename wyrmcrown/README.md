# WYRMCROWN

A high-fantasy war of dragons. You are a wizard riding a fire dragon over the
Kingdom of Aldermere. Fly, fight and feed; seize the land's mines, villages and
places of power; carry gold home and build your town into a fortress; then
break the three rival dragon realms one stronghold at a time.

Built on the ALIEN STRIKE engine (`../alien-strike/`). Same approach: plain
JavaScript, no install, no build step.

## Run it

Open `wyrmcrown/index.html` in Chrome, Edge or Firefox. Double-clicking works
(it runs from `file://`). The `alien-strike/` folder must stay next to
`wyrmcrown/`, because the shared engine loads from there.

Click once anywhere to start the sound (browsers keep audio off until you
interact with the page).

## Controls

| Key | Action |
|-----|--------|
| **W** | Beat your wings. Every downstroke adds speed. |
| **S** | Flare the wings: brake, turn tighter, hover low. Keep flaring low over open ground to land; resting heals and saves energy. **W** takes off again. |
| **A / D** | Bank left / right. Slow flight gives tight turns, fast flight gives wide sweeps. |
| **Space** (hold) | Dive toward the ground. Release to pull up. |
| **Shift** | Sprint (burns energy) |
| **Mouse** | Aim the wizard's staff |
| **Left click** | Cast magic bolts |
| **Right click / F** | Dragon breath (uses its charge; strongest when flying low) |
| **E** | Snatch prey, then eat it or carry it home. Also travels through a waygate you own. |
| **Q** | Cast a stored spell (storm, frost nova, summon) |
| **T** | Hold court in your town: build, recruit, upgrade (the realm pauses) |
| **G** | Order your warband: click a site or a rival town on the map |
| **M** | War map |
| **Tab** (hold) | Realm overview |
| **C** | Switch flight controls between keys steering and following the cursor |
| **Esc / P** | Pause |

**Gamepad:** left stick flies, right stick aims, RT casts, LT breathes, A dives,
B snatches, X holds court, Y casts a spell, LB sprints.

## How a war goes

1. **Feed.** Flying burns energy. Dive low over an animal and press **E** to
   snatch it, then eat it. Livestock in your own pastures is food and wealth.
   A rival's livestock carried home joins your herds.
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
- `node wyrmcrown/tools/sim.mjs 12 normal 1 sundered` fast-forwards an
  all-AI war and logs each realm minute by minute.
- `tools/mapview.html?map=<id>` previews a whole map.
- `tools/gallery.html` shows every model.
- `tools/dragons.html` shows dragon poses.
- `node wyrmcrown/tools/shot.mjs <path> <out.png> [w] [h] [wait] [js]` takes
  a screenshot of any page.

See [DESIGN.md](DESIGN.md) for how the game is put together.
