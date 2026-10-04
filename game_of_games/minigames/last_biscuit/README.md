# THE LAST BISCUIT

A self-contained Godot 4.3+ skill mini-game for **Game of Games**.

An etiquette game. Bill, a frail old man in a hospital gown with a cloud of
wild grey hair, sits at the end of an absurdly long formal dining table.
Six miserable elderly guests sit in silence. The table is laden with food, but
everyone is waiting for the guest of honour, whose chair at the head of the
table is empty. **Nobody may eat until the guest arrives.** Everybody is
starving.

Bill has to steal food, get it to his mouth and chew it while nobody is
looking, and eat his fill before the guest arrives. The other guests are
secretly doing exactly the same. When the guest finally arrives, it is a dog,
and it wanted the biscuit.

Run `res://minigames/last_biscuit/LastBiscuit.tscn`. It is the main scene of
the host project in `game_of_games/`.

---

## How to play

| Input | Action |
|---|---|
| Mouse | Bill's hand moves towards the cursor. It accelerates, has a top speed and a little inertia, and brakes hard so freezing is instant. |
| Hold left mouse / Space | Grab food (or a cup, the teapot, a platter...). Let go to drop it. Carry food past the line in front of Bill and he eats it automatically. |
| Quick click near another hand | **Slap.** The other hand recoils, drops what it holds and nearby cutlery jumps. It is loud. A free biscuit right under your fingers is grabbed instead. |
| Keep holding on a slapped hand | **Pin** it. Pinning makes no noise. |
| Grab a napkin | It drapes over your hand. A hand under a napkin is much harder to see, but it moves slower. Move fast and the napkin comes off. Click on empty table to drop it. |
| Right mouse / E | Retract the hand quickly towards Bill. |
| Shift / Ctrl | Creep. Caps your speed very low. |
| WASD / arrows | Keyboard movement. |
| F1 or ` | Debug overlay (see below). |
| F5 | Restart (standalone only). |

All actions are `lb_*` input actions. If the host project already defines an
action, it is left alone. Otherwise the defaults are added at runtime, so you
can rebind any of them in **Project Settings › Input Map**.

### The rules, as the player discovers them

* **You can see where everyone is looking.** Realism is not the goal: every
  diner shines a searchlight onto the table, a cool blue fan with a bright
  outline, plus laser beams from their eyes to the spot they are looking at.
  The faint fringe at the sides is peripheral vision. Tall objects cast real
  shadows in the light, and those shadows are cover. A diner who is looking
  down at their own plate only lights the table nearby. Asleep or
  glasses-off means no light.
* **Being seen is not being caught.** Moving while you are in someone's light
  is what gets you caught. Freeze and they eventually look away. A ring
  glows under your hand when you are lit: amber while still, pulsing red when
  you are moving in the light. The light itself flickers while your hand
  moves in it.
* **Suspicion is readable.** A floating eye above the diner's head opens
  wider and turns red, their light goes from blue to red, and their face
  reacts: a glance, a raised eyebrow, leaning in, narrowed eyes. Then they
  point.
* **Eating takes nerve.** Bill lifts the food to his mouth and chews for about
  two seconds. Anyone whose light falls on Bill's end of the table sees his
  jaw going, and that counts as movement.
* Tall things hide your hand when it is close behind them: the teapots, the
  flowers, the silver cloches and the stack of plates.
* Every collision makes noise, and an expanding ring on the table shows how
  far it carries. A gentle touch makes a tiny clink and a fast hit makes a
  CLATTER. Diners (and their lights) turn towards sounds, so you can nudge a
  spoon on one side of the table and then move on the other.
* **Food.** Sandwiches, tarts, éclairs, Victoria sponge, grapes, macarons and
  sausage rolls sit on silver platters along the table. Each is worth 1–2
  hunger points. **The guest's biscuit**, with a cherry on top on the ornate
  centrepiece, is worth 3. The safe pickings near Bill are meagre; the rich
  ones sit under the sharpest eyes. Bill needs 10 points. Rivals eat the food
  too, so it runs out.

### The six diners

Each one's routine can be learned. Their timings are exported on the
`LBDiner` nodes.

| Diner | Seat | Behaviour | How to read it |
|---|---|---|---|
| **The Sleeper** | left, near | Awake, then drowsy (head bobs), then asleep (snores). Sometimes jolts awake without warning. Loud noises wake him. | Eyelids, head drop, snoring |
| **The Glasses** | left, middle | Scans the table, rubs her eyes (a tell), polishes her glasses (nearly blind), raises them back to her nose (the tell: freeze now) and immediately inspects the table more sharply. Noises make her hurry. | Glasses on the face or in her hands |
| **The Deaf Watcher** | left, far | A slow lighthouse with excellent, long-range, narrow sight. She lingers on the far end, then sweeps down to Bill and back. Only very loud noises turn her head. | Huge eyes, head direction |
| **The Twitch** | right, near | Looks across, then down at his plate, then at the biscuit, in a fixed cycle. Every so often his shoulder jerks (a 0.35 s tell) and he snaps his head to a random spot, often near your hand. | Shoulder tic, then the snap |
| **The Blind Listener** | right, middle | Cannot see, except that he "feels" anything right in front of him. Hears everything. Noise caused by a hand, or a hand rushing past near him, adds to his suspicion directly. | Head tilts and cups an ear towards sounds |
| **The Cheat** | right, far | Stares straight ahead. Actually watches through the polished silver teapot: **the teapot shows his eyes**, and they look where he is looking. Sometimes he admires himself instead (the reflected eyes roll upwards). Move the teapot and his view moves with it. Knock it or pick it up and he is blind. | The eyes in the teapot |

### Escalation

The dinner lasts 4 minutes (`guest_time`). Escalation is driven by the clock:

| Phase | Trigger | What changes |
|---|---|---|
| 1 Beginning | start | Bill alone. Learn the lights and freezing. |
| 2 Second hand | 25 s | The Cheat's hand creeps out from the far side. It goes for the guest's biscuit and drags the centrepiece towards itself. |
| 3 Another hand | 65 s | The Twitch's darting hand joins. It is fast, reckless and slaps a lot. From now on the Cheat swaps the guest's biscuit for a **fake** (a squeaky rubber coaster) if he gets the chance. |
| 4 Silent chaos | 105 s | The Glasses blocks your hand with a **fork**. The Blind Listener's hand creeps in under a **napkin**. |
| 5 The guest is coming | last 45 s | Everyone is more alert and rivals come back faster. |

Rival hands follow the same visibility rules as Bill: they freeze when
watched (each with its own reliability) and can be caught. A caught rival is
pointed at, everyone stares at its owner, and it withdraws for a while. That
gives you a window. A rival under suspicion may suddenly pick up a sugar cube
and pretend that was what it wanted. A rival that gets food home eats it (a
furtive bite, a long innocent chew), then sits back to digest for a while.
Slapping a rival hand makes it drop its food, which you can then take.

If two hands grip the same food they **tug**. A biscuit pulled too far apart
for too long, or yanked violently, **breaks**. Everyone freezes and stares,
then the fight goes on over the halves. Hitting something hard at speed while
holding a biscuit can also snap it.

### Caught

The diner who caught you points at your hand, or at Bill's face if he was
caught chewing. One by one, everyone slowly turns their lights onto Bill, and
nobody makes a sound. If he was chewing, he swallows very loudly. Bill
withdraws, and someone calmly puts the stolen food back on its platter with
serving tongs. The clock keeps running, the breach is counted, and every
breach makes the whole table a little more alert for the rest of the
dinner.

### Comedy events

Rare, silent interruptions. The first comes after about 35–50 s, then one every
26–42 s. Each one changes the tactical situation:

* **Sneeze.** A readable "ah… ah…" wind-up, then everyone looks at the sneezer.
  This is a window.
* **Fly on the food.** Every hand freezes and every diner stares at the food
  until the fly leaves.
* **Legitimate reach.** A diner openly reaches for some food. Everyone glares
  at them and they slowly withdraw. This is a window.
* **False teeth.** They fall out, chatter across the table and stay there as an
  obstacle.
* **Cat's tail.** It rises from under the table and flicks a cup over, which
  makes a distraction you didn't ask for.
* **Waiter.** He walks behind the guests while every thief freezes mid-theft.
* **Sugar cube.** Rivals do this themselves when they are under suspicion.

### Ending

The ending plays when time runs out, or as soon as Bill is full. There are
three slow knocks. Everyone turns to the head of the table, the camera leans
in, and the guest of honour rises into its chair: a large shaggy dog in a
napkin bib.

* If the guest's biscuit is still there, the ornate plate glides up the table
  to the dog. CHOMP.
* If someone ate it, the dog stares at the empty spot, then slowly turns to
  look at Bill, and so does everyone else.

Either way, the empty ornate plate is then sent sliding all the way down the
table to Bill. A small note reads *Empty Biscuit Plate*, followed by whether
Bill is full, the number of mouthfuls, the time, and his breaches of
etiquette.

* Signal: `last_biscuit_completed("empty_biscuit_plate")` on the root
  (`LBManager`).
* Item key: `LBManager.ITEM_KEY == "EMPTY_BISCUIT_PLATE"`, id
  `LBManager.ITEM_ID == "empty_biscuit_plate"`.

Also emitted: `phase_changed(phase)` and `player_caught(by_diner, attempt)`.

---

## Embedding in Game of Games

1. Copy `minigames/last_biscuit/` into the game project. Every script uses an
   `LB` class prefix to avoid name clashes.
2. Instance `LastBiscuit.tscn`. Set `standalone = false` on the root to
   disable the replay prompt and the F5 restart.
3. Connect `last_biscuit_completed`, give Bill `EMPTY_BISCUIT_PLATE`, and free
   or replace the scene.

The mini-game uses its own camera, WorldEnvironment and CanvasLayer HUD. It
uses no autoloads and no external assets: all audio is synthesised at
start-up, and all art is procedural placeholder art.

## Architecture

```
LastBiscuit.tscn            root: LBManager
├─ TableWorld               systems/TableWorld.gd      planar circle physics, impacts → noise, line-of-sight
├─ NoiseSystem              systems/NoiseSystem.gd     spatial noise events (+ plays the sound)
├─ AudioBank                systems/AudioBank.gd       procedural synthesis, tension drone, clock in the silence
├─ DiningRoom               visual/DiningRoom.gd       room, table, chandeliers, windows + light shafts, portraits, dust
├─ CameraRig                visual/CameraRig.gd        the single cinematic view, bumps and shakes
├─ PlayerHand               actors/PlayerHand.gd       Bill's hand (extends LBHand)
├─ Diners/×6                actors/DinerController.gd  behaviour routines, noise reactions, expressions
│     ├─ Gaze               systems/GazeController.gd  cone + focus distance + occlusion (Cheat: + mirror gaze)
│     ├─ GazeLight          visual/GazeVisual.gd       the visible searchlight fan + eye lasers
│     ├─ Suspicion          systems/SuspicionController.gd
│     └─ Visual             visual/DinerVisual.gd      procedural puppet (reads diner state only)
├─ Rivals/×4                actors/RivalHand.gd        rival AI (extends LBHand)
├─ ComedyEventController    systems/ComedyEventController.gd
├─ HUD                      systems/Hud.gd             fade, hint, item note, debug text
└─ DebugOverlay             systems/DebugOverlay.gd    cones, noise rings, collision, cover, AI targets
actors/TableObject.gd, actors/Biscuit.gd (all food), visual/Props.gd (per-kind placeholder art),
visual/HandVisual.gd (stretchy arm + hand), visual/BillAndDog.gd, systems/TableLayout.gd (what sits where)
```

Gameplay is simulated on the **table plane**: a `Vector2(x, z)` where +z is
Bill's end. The visuals are 3D. Every visual node only reads state, so
proper art and animation can replace `LBHandVisual`, `LBDinerVisual`,
`LBProps` or `LBBillVisual` without touching gameplay.

### Tuning (Inspector)

* **PlayerHand**: `max_speed`, `accel`, `decel` (braking), `follow_gain`,
  `creep_speed`, `grab_range`, `slap_range`, `napkin_speed_mult`,
  `shake_off_speed`.
* **Diners**: per-behaviour timings (sleep cycle, polishing, twitch cycle and
  snap interval, sweep period, mirror scan and preen), hearing, reaction delay,
  head speeds.
* **Suspicion** (created per diner, defaults in `SuspicionController.gd`):
  `still_speed`, `sensitivity`, `still_gain`, `decay_per_sec`.
* **Rivals**: activation phase, speed, freeze threshold, reaction and
  reliability, slap and snatch rates, tricks.
* **TableWorld**: restitution, impact loudness, fall-off speed, swish.
* **LBManager**: `guest_time`, `hunger_goal`, `chew_time`, `phase_times`,
  `rush_time`, `alertness_per_breach`, slap loudness, hit-stop.
* **Diners**: `chew_speed` sets how visible Bill's chewing is.
* **Rivals**: `digest_time` sets how long a rival rests after eating.
* **Gaze lights** (`visual/GazeVisual.gd`): colours, `intensity`,
  `beam_intensity`.
* **ComedyEventController**: first delay, interval, enabled.
* **Layout**: `systems/TableLayout.gd`.

## Debug mode (F1)

Shows gaze cones (green turns red with suspicion of Bill, blue is the Cheat's
teapot mirror), the Blind Listener's feel radius, noise rings, collision
circles (blue: cover, yellow: grabbable, orange: biscuit), hand velocity,
rival AI goals, frozen rivals, the home line, and a text panel with phase,
hand speed, every diner's state and suspicion per hand, and every rival's
state.

Keys while debug is on:

| Key | Action |
|---|---|
| `1`–`4` | Jump to escalation phase 1–4 (sets the dinner clock) |
| `5` | Jump to the last 45 s (the guest is coming) |
| `9` | Food in hand, close to Bill's mouth |
| `6` | The guest arrives (ending) |
| `7` | Trigger the next comedy event |
| `8` | Slow motion |
| `0` | Pause rival hands |

## Dev harness and play-testing

`tools/Harness.tscn` runs scripted scenarios and saves screenshots to
`res://shots/` (git-ignored):

```
godot --path . res://minigames/last_biscuit/tools/Harness.tscn -- --scenario=overview
# scenarios: overview, play, debug, approach, caught, slap, ending, events,
#            closeup, reach, rivals, tug, heatmap, bot
```

* `heatmap` prints how often each part of the table is watched. It was used
  to make sure there are real windows and pockets of cover.
* `bot` (works `--headless`) plays a whole dinner with `tools/Bot.gd`. The
  bot is a cautious player that reads where people are looking, learns
  patterns, plans routes through rarely watched cells, freezes on tells and
  never slaps rivals for their food. In the last balancing batch of four
  dinners it got full twice (at 111 s and 195 s). The other two times the
  rivals emptied the table first and it finished at 9/10. It was caught 0–2
  times per dinner. A bolder human who slaps rivals and steals their food
  should do better.
