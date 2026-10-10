# Independent ground armies — architecture notes

Ground armies that carry out orders on their own while the dragon is somewhere
else. This layer is built and tested on its own test ground; it does not touch
the campaign map, dragon flight or how the game looks.

## What already existed (as inspected)

* **Troop data.** `AS.Data.troops` (`data/buildings.js`) has each battle role's
  hp, armour, speed, size, melee, missiles, thrown rocks and regeneration.
  `AS.Conquest.Data.troops` (`conquest/data/troops.js`) defines campaign troop
  types by reference to a role, plus multipliers. Missile damage is set in
  `AS.Combat.shoot` (`src/game/combat.js`), and stones are doubled in
  `AS.Troop.attack`. These are the source of truth.
* **Navigation.** `AS.Nav` (`src/game/nav.js`): a walking-cost grid of 64-unit
  cells (0 = impassable) with A\*. It is built from a live realm's terrain.
* **The campaign army.** `AS.BigCampaign` (`src/game/bigcampaign.js`): real
  `AS.Troop` units that follow the dragon or hold (V). Far from the camera
  they hurry ×3. There are no other orders, no passages and no unwatched battles.
* **Battles.** These happen only in real time (`AS.Realm`). Conquest runs a site
  battle in the engine and reads a result payload
  (`{survivors: {troopId: n}, …}`).

## Layout

```
wyrmcrown/armies/
  armies.js              AS.Armies namespace
  core/stats.js          troop profiles read from AS.Data.troops + Conquest types
                         (WEAPON mirrors combat.js; the tests prove it still does)
  core/ground.js         GroundMap: terrain kinds, passages (tunnel, cave, bridge),
                         blocking, connected land, nearest reachable ground, A*,
                         smoothing, routes cut into legs of even ground
  core/autoresolve.js    deterministic battle resolution from the troop data
  core/orders.js         order records + check/plan (follow, hold, move, attack,
                         defend, retreat, enter)
  core/sim.js            ArmySim: fixed ticks, near/far, contacts, battles,
                         tactical hand-off, retreat, snapshot/restore
  data/scenario_tunnel.js  the Tunnel Test scenario (ASCII ground + places)
wyrmcrown/tools/test_armies.mjs   26 Node checks (no browser)
wyrmcrown/tools/armies.html       debug viewer: watch the demo, give orders,
                                  block passages, move the dragon
```

Rules (the same ones Conquest follows):

1. **Dependencies go one way.** The army layer reads `AS.U`, `AS.Data.troops` and
   `AS.Conquest.Data.troops`. Nothing in the game references `AS.Armies`, and
   `index.html` does not load it. A test checks both.
2. **State is data.** Armies, places and orders are JSON-safe. `snapshot()` /
   `restore()` round-trip mid-march; a restored route is rebuilt from its points.
3. **Determinism.** Logic runs in fixed ticks. Battle seeds come from the
   simulation seed and the battle number. Contacts are sorted by time and id.
   Stepping frame by frame, in big chunks or with the view elsewhere gives the
   same result, and a test compares the snapshots byte for byte.

## How it works

**Ground.** Each cell has a terrain kind with a walking cost (road 0.55, plain 1,
forest 1.4, hills 1.8, ford 2.6, tunnel 0.9, cave 1.3; mountains and deep water
0). Passages are named groups of cells. Blocking one makes its cells impassable
and bumps `version`. That clears cached routes and connected-land answers, and
armies part-way through a march re-plan on their next tick. `fromNav(g.nav)`
wraps a realm's existing walking grid, so the same armies can march on the
final world once its geography is fixed.

**Routes as functions of time.** A route is a polyline cut into legs of even
ground. Progress is measured in effort (length × cost), and an army adds
`speed × dt` of effort each tick. Its slowest troops set the speed, and retreats
are ×1.15. Its position is a binary search along the legs. Because of this:

* a far army costs O(1) per tick and never searches for a route while marching
  (in the test, 400 armies over an hour of game time take about 1 µs per
  army-second);
* an arrival time is exactly `ceil(effort / speed)`;
* near armies only add per-frame smoothing (`frame()`), and nothing changes in
  the logic. The `lod` events are where the game can swap real `AS.Troop`
  units in and out.

**Contacts.** Contacts are found by closest approach over the tick, both
army-to-army and army-to-place, so coarse ticks cannot let forces pass through
each other. Each side gets a coarse grid, and an army only looks at the grids
of sides hostile to it.

**Orders** (`core/orders.js`):

| Order | Behaviour |
|-------|-----------|
| follow | Walks to the dragon's nearest reachable ground and re-plans when the dragon moves (every 2 s near, 8 s far). Over sea or mountains it waits on the shore and raises `cannot-follow`. |
| hold | Stops and takes a holding stance. |
| move | Marches to accessible ground. Inaccessible ground is refused with a reason, unless `nearest: true`. |
| attack | Attacks a place or an army. A place it takes, it then defends (`thenDefend`). |
| defend | Works only for a place its side holds. It fights as the garrison, with the place's `fort` behind it. |
| retreat | Goes to the quickest safe place its side holds, with no enemies within `threatR`. Its route skirts enemies, it marches a little faster and it avoids battle unless hunted. If no place is safe, it falls back to where it set out. |
| enter | Goes into a passage and walks only inside it (`within`). A tunnel takes it to the far mouth. A cave takes it to its encounter. It can also target an encounter location directly. |

**Battles.** A battle forms when hostile armies meet, or when an army walks into
a hostile place that has defenders. The dragon joins only if all of these hold:
its side is in the fight, it is within `dragonReach`, and the ground is not
ground-only. If it joins and `onTactical` is set, the battle is handed to the
real-time game, and the armies freeze until `settle(id, result)`. Otherwise
`AutoResolve` settles it at once. Both paths use the same result shape, and
survivors go back to the army or garrison they came from. A beaten garrison
leaves as a remnant army and retreats, or disperses if it has nowhere to go.

**Auto-resolve.** Fights run in rounds of 4 s at 30% intensity. The first round
is the approach, with missiles and thrown rocks only. Each blow uses the real
game's armour rule and never does more than the target's hp. Melee splash and
blasts catch several soldiers, fewer in cramped ground. Lobbed shots hit 60% of
the time. Terrain changes missile effect and sets frontage (how many can fight
abreast). In tunnels and caves a big creature has less room to swing. High
ground, cover and fords favour the defender. Stance and walls (`fort`) cut the
damage a defender takes. A `breach` limits how many attackers reach the walls,
and siege engines wear the walls down. Each side breaks at a loss threshold set
by morale. The undead hardly ever break, and `noRetreat` defenders never do.
A side also breaks when the fight is hopeless. Pursuit kills more fleeing
troops when the pursuers are faster. After 30 rounds the defender holds.

## The Tunnel Test

`data/scenario_tunnel.js`, 56 × 30 cells: Oakhollow (friendly settlement), the
Greyteeth barrier down to the sea, the Deepdelve tunnel, a troll cave with
defenders, the collapsed Old Mine, a river with two bridges and a ford,
Blackspire (hostile fortress) and Millbrook (friendly village). Routes: through
the tunnel, round the north, or down either bank.

The demo (test 15, and "run the tunnel demo" in `tools/armies.html`):

1. The dragon waits at the western mouth.
2. The Host goes through Deepdelve (ground-only), leaves the dragon's view and
   keeps marching.
3. It storms Blackspire. The dragon is beyond the mountain, so the battle is
   auto-resolved.
4. It takes Blackspire and defends it.

## Limits and next steps

* **Large worlds.** The grid router fits regions up to a few hundred cells
  across (about 0.3 ms a route here). A 160 km world at 64-unit cells is too big
  for flat A\*. Long routes need a route graph over passages and roads on top
  (much as `AS.Nav` does with roads), with the grid kept for local legs. The
  `findPath` / route interface stays the same.
* **Tactical battles.** `onTactical(battle)` hands over `battle.ctx` (both
  forces as troop stacks, terrain, stance, fort) for a playable ground battle.
  The real-time result is applied with `settle`.
* **Not modelled yet.** Supply, fatigue, fog of war, and splitting or merging
  armies. Battles have one attacking army. Wyverns walk.
