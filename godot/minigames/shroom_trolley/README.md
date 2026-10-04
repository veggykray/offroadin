# Shroom Mart Trolley Chaos (Godot 4 mini-game module)

Bill grabs a trolley. Mushrooms fly everywhere. Catch the good ones, avoid the
rotten ones, keep the wobbling pile from spilling, and get the full trolley to
the checkout without tipping your order across the floor.

Built and tested with **Godot 4.3**. It should work with any Godot 4.2+.
Everything lives in **`res://minigames/shroom_trolley/`**. It uses no
autoloads, no project settings, no input map and no named physics layers, so
it drops into another project without touching anything else.

---

## 1. Try it first (2 minutes)

1. Open the `godot/` folder of this repository with Godot (Project Manager > Import > pick `project.godot`).
2. Press **F5** (Run Project). It opens `test/ShroomTrolleyTest.tscn`.
3. Walk Bill to the trolley with **A/D**, press **E** to grab it.

| Key | What it does |
|---|---|
| **A / D** or **← / →** | Push / pull the trolley (gamepad: stick or d-pad) |
| **Space** | TROLLEY BASH (gamepad A) |
| **S / ↓ / E** | Tip the order into the checkout once you're parked there (gamepad X) |
| **Esc** | Quit the activity |
| **F1** | Debug overlay (velocity, acceleration, spill force vs. threshold, phase, catch area, bash area, mushroom velocities) |

Debug cheats (work while `debug_keys_enabled` is on):

| Key | Cheat |
|---|---|
| 1 / 2 / 3 / 4 | Launch a normal / bouncy / rotten / golden mushroom |
| 5 | Fill trolley (+6) |
| 6 | Force a spill (3 mushrooms) |
| 7 | Empty trolley |
| 8 | Satisfy the order (fills the trolley with what's still needed) |
| 9 | Open the checkout now |
| 0 | Giant mushroom event |
| F2 | Slow motion on/off |
| F3 | Random event |
| F5 | Reset the round |

---

## 2. How the game works (so you know what you're tuning)

**The loop:** see a mushroom, judge its arc (its shadow on the floor helps),
race under it, brake in time, *thump*. The trolley gets heavier, slower to
start and slower to stop.

**Movement (`Trolley.gd`).** Momentum, not a character controller:

* Pushing ramps up over ~0.2s, so tapping the key gives gentle control.
* Top speed is soft, and the trolley coasts a long way when you let go.
* Pushing the opposite way brakes. Braking is gentle if you tap and violent if
  you hold it at speed. Above `skid_speed` a reversal becomes a skid, with
  fishtailing wheels, dust and Bill's "!!".
* After a hard reversal there's a short "regrip" moment before you can push
  the other way.
* Load adds mass: slower acceleration, lower top speed, longer stops.
* Hitting the edge of the play area fast is a **crash**.
* Visuals: leans back when accelerating, dips forward when braking, sags with
  load, bounces when a mushroom lands, and rattles at speed.

**Hybrid mushroom physics (`Mushroom.gd`, `TrolleyCargoController.gd`).**
Flying mushrooms are real `RigidBody2D`s. They bounce off the floor, shelves,
Bill, the trolley rim and each other. Once one drops into the basket it
becomes *cargo*: frozen, and positioned by a small, stable spring simulation.
It never vibrates into orbit. Cargo still collides with flying mushrooms, so
you can land shrooms on top of your pile (or bounce them off it). When a spill
happens, a cargo mushroom is unfrozen and thrown back into the world.

**Spilling is never random.** One "load sway" spring is shoved by every change
in the trolley's speed. Each mushroom shows that sway scaled by its height in
the pile, so a tall pile visibly leans and, at speed, rattles before it goes.

* `spill force = |sway| × height of the top mushroom`
* `spill threshold = how well that layer is held`
  * Inside the basket walls: very firm.
  * Above the rim: weak, and weaker the higher it is.
  * Weaker still when the pile is rattling loose at speed.

When force beats threshold, the top mushroom flies out in the direction the
load was sliding, and it keeps cascading while the force stays high. Measured
with the probe (`-- --probe`):

| Load | Gentle driving | Hard brake at speed | Zig-zag | Bash from rest | Crash into edge |
|---|---|---|---|---|---|
| 3 | safe | safe | safe | safe | 1 lost |
| 8 (all inside basket) | safe | safe | safe | safe | 2 lost |
| 12 (pile above rim) | safe | 2 lost | 1 lost | safe | 4 lost |
| 14 (tower) | safe | 3–4 lost | 3 lost | safe | 5 lost |

**Trolley bash (Space).** A sudden lunge forward:

* Mushrooms in front of the trolley (including ones lying on the floor) get
  whacked forward and **up**, so you can re-catch spilled shrooms or set up
  bank shots.
* Mushrooms just above the basket get popped straight up (a save).
* Rotten mushrooms in the trolley are slimy and never wedge in, so a bash
  flings them out backwards over Bill's head.
* It also jolts your own pile. Bashing at speed with a tall pile costs you
  shrooms.

There's a short cooldown.

**Mushroom types (`types/*.tres`).**

| Type | Behaviour |
|---|---|
| **Normal** | The main collectible. |
| **Bouncy** | Very elastic. Only counts as caught once it calms down inside the basket. |
| **Rotten** | Bad: splat, shake, counts against your grade if delivered. Bash it out. |
| **Golden** | Rare, fast, flat arc, long sparkly warning. DING. Bonus. |

**Round structure (`ShroomSpawner.gd` → `phases`).**

1. Warm-up (slow normals)
2. Bouncy
3. Rotten
4. Golden
5. Chaos
6. Order ready: drive to the checkout (a light trickle continues)
7. Dump

Each phase moves on when you're holding enough good shrooms *or* after a time
limit, so skilled players race through and beginners still progress.

**Fair launches.** The spawner picks the landing spot first, only where the
trolley can actually get to in time. It then solves the arc backwards and
launches from a spawn marker after a visible puff. Nothing spawns straight on
top of you.

**Checkout (`Checkout.tscn`, `Scanner.gd`).** Once the trolley holds enough
good shrooms the checkout opens. If you spill below the target, it closes
again. Park at the dock and press **S**: the trolley tips and the mushrooms
pour through the scanner beam (BEEP / DING / BZZZT) into the bag. If you
deliver enough, the round completes. If not, the checkout closes and you go
back for more.

**Random events (`ShroomEvents.gd`).** Uncommon (about one every 16–26s, and
not every roll fires):

* a shelf coughs out three mushrooms
* two mushrooms collide in mid-air
* a giant mushroom bounds across the shop
* the checkout spits a mushroom back out

---

## 3. Files

```
minigames/shroom_trolley/
  ShroomTrolleyActivity.tscn/.gd   THE thing you instance. Public API + signals.
  Trolley.tscn/.gd                 Movement, basket collision, bash, visual springs.
  TrolleyVisual.gd                 Placeholder trolley art (drawn in code).
  TrolleyCargoController.gd        Catching, pile, jiggle, spilling.
  Mushroom.tscn/.gd                One mushroom (physics <-> cargo).
  MushroomData.gd + types/*.tres   Tuning per mushroom type.
  ShroomSpawner.gd                 Phases + fair launching from spawn markers.
  ShroomEvents.gd                  Small random events.
  ShroomOrderController.gd         Order + stats + result dictionary.
  Checkout.tscn/.gd                Dock, hopper, bag, placeholder art.
  Scanner.gd                       Reusable scanner (scan anything).
  TrolleyPlayerAdapter.gd          The ONLY file that knows about the player.
  ShroomAudio.gd                   Sound slots + synthesised placeholders.
  ShroomFX.gd                      Particles.
  ShroomHUD.gd                     Temporary order sign / prompts / receipt.
  ShroomPlayAreaGizmo.gd           Editor-only lines showing floor/bounds/spawns.
  test/                            TEST ONLY - see section 6.
```

---

# HOW TO PUT THIS INTO THE REAL SHROOM MART

### Step 1 – Copy the folder

Copy the whole folder `minigames/shroom_trolley/` into your real project so
the path is exactly **`res://minigames/shroom_trolley/`**. Use your file
manager, then switch back to Godot and let it import. If you'd rather use a
different path, move the folder *inside the Godot FileSystem dock*
(drag-and-drop), so Godot rewrites the paths in the `.tscn`/`.tres` files for
you.

You don't need to copy `project.godot`, and you don't need to change any
project settings.

### Step 2 – Instance the activity scene

Open your Shroom Mart scene. In the FileSystem dock, drag
**`ShroomTrolleyActivity.tscn`** onto your scene's root node in the Scene
tree. It's a `Node2D`, so your Shroom Mart scene must be 2D (or the 2D part
of it).

### Step 3 – Position it

Select the new `ShroomTrolleyActivity` node and move it so its markers sit on
your shop. Then right-click it and choose **Editable Children**, so you can
move the markers inside it individually. Leave the activity node's rotation at
0 and scale at 1 (Godot physics doesn't like scaled rigid bodies). Move the
markers instead.

With the scene open in the editor you'll see yellow, orange and pink helper
lines (from `ShroomPlayAreaGizmo.gd`). They only show in the editor.

### Step 4 – Connect the real Bill

The mini-game needs **one thing** from Bill: a `Node2D` reference passed to
`start_activity(bill)`. In whatever script decides "Bill uses the trolley"
(your interaction system, an Area2D near the trolley, a dialogue choice…):

```gdscript
@onready var trolley_game = $ShroomTrolleyActivity   # adjust the path to where you put it
@onready var bill = $Bill                            # your real Bill

func _on_bill_interacts_with_trolley():
    trolley_game.start_activity(bill)
```

What happens to Bill while the game runs, and why:

| What the mini-game does | Why |
|---|---|
| Moves Bill every physics frame so he stands behind the trolley handle | Bill and the trolley must move as one. Bill's own movement code must not fight it. |
| Calls `bill.set_trolley_mode(true, trolley)` **if Bill has that function**. If he doesn't, it pauses Bill's `_physics_process`, `_process`, `_input` and `_unhandled_input`. | Stops Bill's normal walk/jump code from also reacting to A/D. |
| Sets Bill's `collision_layer` / `collision_mask` to 0 (if he's a physics body) | Stops Bill's own collider from shoving the trolley or getting stuck. The trolley has its own invisible "Bill bumper", so mushrooms still bounce off him. |
| Calls `bill.update_trolley_pose(info)` every frame **if Bill has that function** | So Bill can play push / skid / bash / dump animations. `info` holds velocity, speed01, facing, pushing, braking, skidding, bashing, dumping, lean and load. |

When the game ends (complete, cancel or stop) all of that is undone: processing
and collision are restored, and `set_trolley_mode(false, trolley)` is called.

**Recommended:** add these two optional functions to Bill's script. Look at
`test/TestBill.gd` for a working example.

```gdscript
func set_trolley_mode(active: bool, trolley: Node2D) -> void:
    pushing_trolley = active          # your own flag: skip walking code while true
    velocity = Vector2.ZERO
    $AnimationPlayer.play("push_idle" if active else "idle")

func update_trolley_pose(info: Dictionary) -> void:
    if info.skidding: $AnimationPlayer.play("skid")
    elif info.bashing: $AnimationPlayer.play("shove")
    elif info.pushing: $AnimationPlayer.play("push_run")
    else: $AnimationPlayer.play("push_idle")
```

**Bill's origin.** The adapter assumes Bill's origin is at his **feet**. If
it's at his middle, select `ShroomTrolleyActivity/PlayerAdapter` and set
**Player Offset → y** to minus half his height (e.g. `-60`). **Player Offset →
x** moves him closer to or further from the handle.

**If Bill needs something unusual** (a state machine, a different way to stop
his input), edit **`TrolleyPlayerAdapter.gd`** (`attach()` / `detach()` /
`update_player()`). That's the only file that touches the player.

**Keys.** The adapter creates input actions `shroom_trolley_left/right/bash/dump/cancel`
at runtime if they don't exist. To use your own actions instead (e.g.
`move_left`), select `PlayerAdapter` and type your action names into
**Action Left / Action Right / …**.

### Step 5 – Mushroom spawn markers

Inside `ShroomTrolleyActivity/SpawnPoints` there are five `Marker2D`s
(`Spawn_LeftHigh`, `Spawn_LeftLow`, `Spawn_Centre`, `Spawn_RightHigh`,
`Spawn_RightLow`). Drag them onto the shelves / chutes / vents where
mushrooms should fly out from.

* You can add more (duplicate one, Ctrl+D) or delete some. Any `Marker2D`
  under `SpawnPoints` is used, and the names don't matter.
* Keep at least one on each side of the room so arcs come from different
  directions.
* Put them above the floor, inside the visible area. Launch arcs are kept
  below `play_height` pixels above the floor (an Inspector setting on the
  activity).

### Step 6 – Playable boundaries

Inside `ShroomTrolleyActivity/PlayArea`:

* **TrolleyStart**: where the trolley waits, **on the floor**. Its **height
  defines the floor** for the whole mini-game: mushroom bounces, shadows, and
  the invisible floor it creates. Put it exactly on your shop floor line.
* **LeftBound / RightBound**: the furthest left/right the trolley **plus
  Bill** may go. The trolley body stops ~88px inside RightBound and Bill stops
  ~160px inside LeftBound. Driving into them fast is a crash.

The activity creates its own invisible floor and side walls on its own physics
layer (**layer 10** by default, setting **Shroom Layer**). That means it
doesn't depend on your floor's collision, and your world doesn't get bumped by
mushrooms. If layer 10 is already used in your game, change **Shroom Layer**.
If you want mushrooms to bounce off your real shelves, put those shelves'
layer in **Extra Collision Mask**, or add the shelves' StaticBody2D to layer 10.

### Step 7 – Position the checkout

`ShroomTrolleyActivity/Checkout` is its own scene. Its **origin is the floor
point under the hopper/bag**. Drag it next to your real checkout desk.

* **Checkout/DockPoint** (a child marker) is where the trolley's centre must
  stop to dump. Keep it within reach, i.e. between LeftBound and RightBound,
  near RightBound. The test layout puts it about 7px inside the trolley's
  right limit, so pushing gently against the right edge = docked.
* **HopperTarget** is what dumped mushrooms aim for. **SpitPoint** is used by
  the "checkout spits one back" event.
* To hide the placeholder art, untick **Draw Placeholder Art** on the
  Checkout node and put your own sprite there. The hopper collision and
  scanner beam keep working.

### Step 8 – Connect completion

```gdscript
func _ready():
    trolley_game.activity_completed.connect(_on_trolley_done)
    trolley_game.activity_cancelled.connect(_on_trolley_quit)

func _on_trolley_done(result: Dictionary):
    print(result)                     # see "Result data" below
    # e.g. resume Shroom Mart, play a cutscene, save progress...

func _on_trolley_quit():
    pass                              # player pressed Esc
```

Completion order: the receipt shows for `results_delay` seconds (2.5), then
**Bill is handed back** and `activity_completed(result)` fires. It's safe to
free the activity or change scene inside that handler.

Other signals: `activity_started`, `activity_stopped` (after `stop_activity()`),
`phase_changed(index, name)`, `order_progress_changed(have, need, ready)` (for
your own UI), and `camera_impulse_requested(strength, direction)`.

Other calls: `stop_activity()` ends it immediately and quietly (e.g. a
cutscene interrupts). `cancel_activity()` is the same but emits
`activity_cancelled`. `is_running()` and `get_result()` are also available.

### Step 9 – The reward ID

```gdscript
func _on_trolley_done(result: Dictionary):
    if result.reward_id == &"perfect_little_shroom":
        your_inventory_or_save_system.give(result.reward_id)
```

`reward_id` is always included on completion. The mini-game does **not** give
the item itself, because your game decides what that means. Change the ID with
the activity's **Reward Id** setting.

**Result data** (all in the dictionary):

`completed`, `normal_delivered`, `bouncy_delivered`, `good_delivered`,
`golden_delivered`, `rotten_delivered`, `bonus_achieved`, `golden_caught`,
`rotten_caught`, `catches`, `spills` (spill events), `mushrooms_spilled`,
`crashes`, `bashes`, `largest_load`, `completion_time` (seconds), `score`,
`grade` (S/A/B/C/D), `reward_id`.

### Step 10 – The real camera (optional)

The game works without any camera hookup. For screen shake, do **either**:

* Select the activity, set **Camera Handler** to your camera node, and give
  that camera a function
  `request_camera_impulse(strength: float, direction: Vector2)`
  (or `add_trauma(amount: float)`, which receives strength/15).
* **Or** connect the signal yourself:
  `trolley_game.camera_impulse_requested.connect(my_camera.shake)`.

`test/TestCamera.gd` is a 25-line example of a shake.

### Step 11 – Remove TestBill

You never instanced `TestBill`; it only lives inside
`test/ShroomTrolleyTest.tscn`. Just don't use that scene in your game. Your
real Bill is passed in through `start_activity(bill)`.

### Step 12 – Files you don't need

Everything in **`minigames/shroom_trolley/test/`** is test-only and can be
deleted from the real project:

* `ShroomTrolleyTest.tscn/.gd`
* `TestBill.gd`
* `TestCamera.gd`
* `TestBackdrop.gd`
* `ShroomAutoPilot.gd`
* `ShroomProbe.gd`

Nothing outside `test/` references them. Before shipping, also untick **Debug
Keys Enabled** on the activity.

### Step 13 – Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Mushrooms fall through the floor | **TrolleyStart** isn't on your floor line, or **Create Floor Collision** was unticked. Move TrolleyStart so its height matches the floor. |
| Trolley floats above / sinks into the floor | Same: TrolleyStart's height is the floor. |
| Trolley won't move | `start_activity()` was never called, or Esc cancelled it. Is your own input code consuming A/D first (e.g. `set_input_as_handled()`)? Check the action names on **PlayerAdapter**. |
| Bill walks off while pushing / both move at once | Bill's movement isn't being paused. Add `set_trolley_mode()` to Bill (Step 4) and skip his movement while it's active. If his movement lives on a *child* node (a state machine), pause that child inside `set_trolley_mode`. |
| Bill floats or is sunk into the floor while pushing | Bill's origin isn't at his feet. Adjust **PlayerAdapter → Player Offset y**. |
| Bill stands too far from the handle | **PlayerAdapter → Player Offset x**. |
| Mushrooms bounce off random things in my scene | Something else in your game is on physics layer 10. Change the activity's **Shroom Layer** to an unused layer. |
| Mushrooms ignore my real shelves | Add the shelves' layer to **Extra Collision Mask**. |
| Can never dump / no "TIP IT IN" prompt | The **DockPoint** is outside the trolley's reachable range. Move it between LeftBound and RightBound, about 90px inside RightBound. With **F1** you can see the green dock zone and orange trolley range. |
| Dumped mushrooms miss the hopper | Move **HopperTarget** to the funnel mouth, a bit above the trolley rim height. |
| Trolley/mushrooms look too small or big next to Bill | Change `const S` at the top of `Trolley.gd` (trolley size), and the `radius` of each `types/*.tres` mushroom by the same factor. |
| Arcs go off the top of the screen | Lower **Play Height** on the activity. |
| No sound | Expected if `use_placeholder_sounds` is off and no streams are assigned. Drag your files onto the slots on the **Audio** node. Missing sounds never crash. |
| "Invalid get index 'trolley'" or similar on start | The activity scene was saved without its children or edited badly. Re-instance `ShroomTrolleyActivity.tscn` fresh. |
| Debug keys clash with my game's keys | Untick **Debug Keys Enabled**. |

---

## 4. Tuning cheat sheet

| I want… | Change |
|---|---|
| Faster / slower trolley | `Trolley` → Max Speed, Accel |
| More momentum (longer glides) | `Trolley` → lower Coast Decel |
| Harder to stop when full | `Trolley` → raise Mass Per Load |
| Spills more / less often | `CargoController` → Hold Above Rim, Hold Drop Per Layer, Sway Inertia, Looseness Effect |
| Bash hurts your pile less | `CargoController` → lower Bash Sway Factor |
| Bigger / longer bash | `Trolley` → Bash Boost, Bash Cooldown |
| Slower / faster rounds | `Spawner.gd` → `phases` (interval, advance_good, advance_time, speed) |
| Different order size | Activity → Required Good |
| Bouncier bouncy shrooms | `types/bouncy.tres` → Bounce |
| Fewer/more random events | `Events` → Min Gap / Max Gap / Chance, or Enabled off |

## 5. Extension points (deliberately not built yet)

* **New mushroom types / powers:** a new `.tres` in `types/`, add it to the
  activity's **Mushroom Types**, reference its `type_id` in spawner phases.
* **Big events** (tidal wave, gravity flip, rival shoppers): add an entry to
  `ShroomEvents.events` plus an `_event_<id>()` function.
* **Scanning silly things** (Bill, a shoe, a cat…): give the thing
  `get_scan_id()` or metadata `scan_id`, put it on the shroom layer, and add a
  response with `$Checkout/Scanner.register_response(&"cat", {...})`. Bill,
  trolley, shoe and unknown responses are already in the table.
* **Final art:** replace `TrolleyVisual.gd`, `Mushroom._draw()` and the
  checkout art. The gameplay doesn't read any of it.

## 6. Test tools (for developers)

Run from the `godot/` folder (Godot on your PATH as `godot`):

```
godot -- --autoplay --bot-style=careful   # watch a bot play (or reckless)
godot --headless --fixed-fps 60 -- --probe          # spill tuning table
godot --headless --fixed-fps 60 -- --apitest        # start/cancel/stop/complete + adapter restore checks
godot -- --droptest                                 # drop one of each type into a parked trolley
godot -- --autoplay --events=giant_shroom@3,shelf_burst@8
```

Latest automated results (Godot 4.3, 7 seeds per style): API test all passed,
no script errors. Careful bot completes in ~28–58s with 0–1 spills. Reckless
bot takes 60–77s, loses 6–22 mushrooms and mostly gets B–D grades. The bot is a perfect trajectory predictor, so
expect a first human run of roughly 2–3 minutes.
