# THE LAST BISCUIT

A self-contained Godot 4.3+ skill mini-game for **Game of Games**.

Bill, an elderly man, sits at the end of an absurdly long formal dining table.
Six miserable elderly guests sit in silence. In the centre is an ornate plate
holding one biscuit. Bill has to steal it and bring it all the way back
without anyone noticing. Then a dog eats it.

Run `res://minigames/last_biscuit/LastBiscuit.tscn`. It is the main scene of
the host project in `game_of_games/`.

---

## How to play

| Input | Action |
|---|---|
| Mouse | Bill's hand moves towards the cursor. It accelerates, has a top speed and a little inertia, and brakes hard so freezing is instant. |
| Hold left mouse / Space | Grab the biscuit (or a cup, the teapot, the plate...). Let go to drop it. |
| Quick click near another hand | **Slap.** The other hand recoils, drops what it holds and nearby cutlery jumps. It is loud. |
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

* **Being seen is not being caught.** Moving while someone is looking at your
  hand is what gets you caught. Freeze and they eventually look away.
* Suspicion only ever shows on the diners' faces and bodies. Their eyes glance
  at the hand, then an eyebrow goes up, then they lean in, then their eyes
  narrow. After that they point. There are no meters.
* Tall things hide your hand when it is close behind them: the teapots, the
  flowers, the silver cloches and the stack of plates.
* Every collision makes noise. A gentle touch makes a tiny clink and a fast hit
  makes a CLATTER. Diners turn towards sounds, so you can nudge a spoon on one
  side of the table and then move on the other.
* Getting the biscuit is only half the job. You have to carry it past the
  green line in front of Bill (shown in debug). On the way back everyone is
  more alert and the rival hands chase you.

### The six diners

Each one's routine can be learned. Their timings are exported on the
`LBDiner` nodes.

| Diner | Seat | Behaviour | How to read it |
|---|---|---|---|
| **The Sleeper** | left, near | Awake, then drowsy (head bobs), then asleep (snores). Sometimes jolts awake without warning. Loud noises wake him. | Eyelids, head drop, snoring |
| **The Glasses** | left, middle | Scans the table, rubs her eyes (a tell), polishes her glasses (nearly blind), then puts them back on and immediately inspects the table more sharply. Noises make her hurry. | Glasses on the face or in her hands |
| **The Deaf Watcher** | left, far | A slow lighthouse with excellent, long-range, narrow sight. She lingers on the far end, then sweeps down to Bill and back. Only very loud noises turn her head. | Huge eyes, head direction |
| **The Twitch** | right, near | Looks across, then down at his plate, then at the biscuit, in a fixed cycle. Every so often his shoulder jerks (a 0.35 s tell) and he snaps his head to a random spot, often near your hand. | Shoulder tic, then the snap |
| **The Blind Listener** | right, middle | Cannot see, except that he "feels" anything right in front of him. Hears everything. Noise caused by a hand, or a hand rushing past near him, adds to his suspicion directly. | Head tilts and cups an ear towards sounds |
| **The Cheat** | right, far | Stares straight ahead. Actually watches through the polished silver teapot: **the teapot shows his eyes**, and they look where he is looking. Sometimes he admires himself instead (the reflected eyes roll upwards). Move the teapot and his view moves with it. Knock it or pick it up and he is blind. | The eyes in the teapot |

### Escalation

| Phase | Trigger | What changes |
|---|---|---|
| 1 Beginning | start | Bill alone. Learn gazes and freezing. |
| 2 Second hand | Bill passes ~45% of the way | The Cheat's hand creeps out from the far side. It drags the plate towards itself. |
| 3 Another hand | ~80% of the way, or 28 s in phase 2 | The Twitch's darting hand joins. It is fast, reckless and slaps a lot. From now on the Cheat swaps the real biscuit for a **fake** (a squeaky rubber coaster) if he gets the chance. |
| 4 Silent chaos | someone holds the biscuit, or 30 s in phase 3 | The Glasses blocks your hand with a **fork**. The Blind Listener's hand creeps in under a **napkin**. |
| 5 The run back | Bill holds the real biscuit | Everyone is 15% more alert. Rivals chase you and come back faster after being caught. |

Rival hands follow the same visibility rules as Bill: they freeze when
watched (each with its own reliability) and can be caught. A caught rival is
pointed at, everyone stares at its owner, and it withdraws for a while. That
gives you a window. A rival under suspicion may suddenly pick up a sugar cube
and pretend that was what it wanted. A rival that gets the biscuit home is
glared at by everyone and slowly puts it back.

If two hands grip the biscuit they **tug**. Pulling too far apart for too long
**breaks** it. Everyone freezes and stares, then the fight goes on over the
larger half, which is the only piece that counts. Hitting something hard at
speed while holding the biscuit can also snap it.

### Caught

The diner who caught you points at your hand. One by one, everyone slowly
turns to look at Bill, and nobody makes a sound. Bill withdraws, and someone
calmly puts the biscuit back in the centre with serving tongs. The attempt
resets to phase 1, but moved objects stay where they were.

### Comedy events

Rare, silent interruptions. The first comes after about 35–50 s, then one every
26–42 s. Each one changes the tactical situation:

* **Sneeze.** A readable "ah… ah…" wind-up, then everyone looks at the sneezer.
  This is a window.
* **Fly on the biscuit.** Every hand freezes and every diner stares at the
  biscuit until it leaves.
* **Legitimate reach.** A diner openly reaches for the biscuit. Everyone glares
  at them and they slowly withdraw. This is a window.
* **False teeth.** They fall out, chatter across the table and stay there as an
  obstacle.
* **Cat's tail.** It rises from under the table and flicks a cup over, which
  makes a distraction you didn't ask for.
* **Waiter.** He walks behind the guests while every thief freezes mid-theft.
* **Sugar cube.** Rivals do this themselves when they are under suspicion.

### Ending

Bill raises the biscuit, a brief sting plays, and then a large dog erupts from
under the table. CHOMP. Bill looks at his empty hand while the diners stare
straight ahead. A small note reads *Empty Biscuit Plate* with your time and
number of attempts.

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
│     ├─ Suspicion          systems/SuspicionController.gd
│     └─ Visual             visual/DinerVisual.gd      procedural puppet (reads diner state only)
├─ Rivals/×4                actors/RivalHand.gd        rival AI (extends LBHand)
├─ ComedyEventController    systems/ComedyEventController.gd
├─ HUD                      systems/Hud.gd             fade, hint, item note, debug text
└─ DebugOverlay             systems/DebugOverlay.gd    cones, noise rings, collision, cover, AI targets
actors/TableObject.gd, actors/Biscuit.gd, visual/Props.gd (per-kind placeholder art),
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
* **LBManager**: escalation thresholds, return-run alertness, slap loudness,
  hit-stop.
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
| `1`–`4` | Jump to escalation phase 1–4 (hand moved forward) |
| `5` | Jump to the run back (biscuit in hand at the plate) |
| `9` | Home stretch (biscuit in hand, close to Bill) |
| `6` | Ending |
| `7` | Trigger the next comedy event |
| `8` | Slow motion |
| `0` | Pause rival hands |

## Dev harness and play-testing

`tools/Harness.tscn` runs scripted scenarios and saves screenshots to
`res://shots/` (git-ignored):

```
godot --path . res://minigames/last_biscuit/tools/Harness.tscn -- --scenario=overview
# scenarios: overview, debug, approach, caught, slap, ending, events, closeup,
#            reach, rivals, heatmap, bot
```

* `heatmap` prints how often each part of the table is watched. It was used
  to make sure there are real windows and pockets of cover.
* `bot` (works `--headless`) plays the whole game with `tools/Bot.gd`. The bot
  is a careful player that reads where people are looking, learns patterns,
  plans routes through rarely watched cells and freezes on tells. It does not
  read suspicion. In our runs the bot won in about 60 s of play with around two
  catches. A human reading faces instead of cones should land in the intended
  2–4 minutes for a first win.
