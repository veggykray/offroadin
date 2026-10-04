# DON'T TAP THE GLASS — Aquarium mini-game module (Godot 4.x)

A self-contained gameplay module for **Game of Games**. Bill stands outside a huge
aquarium window. The player touches the **glass** (tap, double tap, rub, scratch,
hard knock); the creatures behind it react, affect each other, and eventually get
the glowing `aquarium_memory` out of a giant clam and into a retrieval chute.
Then something enormous comes to the glass.

Everything lives in `res://minigames/aquarium_glass/`. The test scene and the
placeholder Bill are disposable; the gameplay systems are the deliverable.

Built and tested with **Godot 4.3** (works in the Compatibility, Mobile and Forward+ renderers).

---

## Contents

1. [How to run the test game](#how-to-run-the-test-game)
2. [Folder layout](#folder-layout)
3. [How the glass gesture system works](#how-the-glass-gesture-system-works)
4. [How to change gesture sensitivity](#how-to-change-gesture-sensitivity)
5. [How each creature works](#how-each-creature-works)
6. [How to change creature speed / behaviour](#how-to-change-creature-speed--behaviour)
7. [How the puzzle sequence works](#how-the-puzzle-sequence-works)
8. [How the adaptive hint system works](#how-the-adaptive-hint-system-works)
9. [How to change hint delays](#how-to-change-hint-delays)
10. [How to add / edit information panel hints](#how-to-add--edit-information-panel-hints)
11. [How the deep creature attention system works](#how-the-deep-creature-attention-system-works)
12. [How to change glass damage](#how-to-change-glass-damage)
13. [How to test the Idiot chase](#how-to-test-the-idiot-chase)
14. [How to test the ending](#how-to-test-the-ending)
15. [Debug mode](#debug-mode)
16. [Automated play-testing](#automated-play-testing)
17. [**HOW TO PUT THIS INTO THE REAL AQUARIUM SCENE**](#how-to-put-this-into-the-real-aquarium-scene)

---

## How to run the test game

1. Install **Godot 4.3 or newer** (standard version, not .NET is fine).
2. Open Godot → **Import** → choose `game_of_games_aquarium/project.godot`.
3. The first time, Godot imports the audio files (a few seconds).
4. Press **F5** (Run Project). The main scene is
   `res://minigames/aquarium_glass/test/AquariumTest.tscn`.

Controls in the test scene:

| Input | Gesture |
|---|---|
| Left click (quick) | **Single tap** |
| Two quick left clicks close together | **Double tap** |
| Hold left button and move slowly | **Rub** |
| Hold left button and zig-zag quickly in a small area | **Scratch** |
| Right click (or Shift + left click) | **Hard knock** |
| F1 | Toggle debug view |
| Enter (after the end) | Play again |

There is deliberately no tutorial. A tiny controls line shows for 12 s in the test
scene only.

---

## Folder layout

```
minigames/aquarium_glass/
  AquariumActivity.tscn        <- THE component you instance
  scripts/
    AquariumActivity.gd        orchestration: stages, physics, signals, API, debug commands
    GlassGestureRecognizer.gd  press/move/release -> tap / double / rub / scratch / knock
    GlassInteractionSurface.gd mouse/touch input -> recognizer (only inside the glass rect)
    GlassStimulus.gd           data object for one vibration (+ gesture enum)
    AquariumCreatureBase.gd    shared steering, gaze, blinking, squash, nervousness
    Blimp.gd  BastardSwarm.gd  Coward.gd  Sucker.gd  Idiot.gd
    ShellObjective.gd          the clam: cover / restraint / cracking / opening
    MemoryOrb.gd               aquarium_memory states (in shell, carried, falling, delivered)
    RetrievalChute.gd          the chute; emits memory_received
    AquariumHintController.gd  adaptive hint system
    AquariumHintUI.gd          "Need a hint?" bubble + hint line
    AquariumInfoPanel.gd       species information panel (UI)
    AquariumOutsideProps.gd    PLEASE DO NOT TAP THE GLASS sign, info plaque, falling dust
    DeepCreatureController.gd  hidden attention + the thing in the dark + finale
    GlassDamageController.gd   cracks
    GlassFX.gd                 ripples (refraction shader), smears, scratches, reflections
    AquariumWaterFX.gd         motes, bubbles, fragments, sand
    AquariumEnvironment.gd     placeholder art (background, plants, rocks, pebbles)
    AquariumAudio.gd           replaceable sound slots
    AquariumDebugOverlay.gd    debug view + hotkeys
    AquariumObstacle.gd        @tool: a solid circle (rock)  - editor gizmo
    AquariumZone.gd            @tool: a rectangle zone       - editor gizmo
    AquariumLayoutGuides.gd    @tool: draws bounds/glass/floor in the editor
    AqDraw.gd                  safe polygon drawing helpers
  shaders/  water_background.gdshader, glass_distort.gdshader
  audio/    placeholder .wav files (one per sound slot)
  data/     info_panel_entries.json, hint_texts.json
  tools/    generate_placeholder_audio.py
  test/     AquariumTest.tscn, AquariumTest.gd, TestBill.gd, AquariumAutoPlaytest.gd   (disposable)
```

---

## How the glass gesture system works

`GlassInteractionSurface` listens with `_unhandled_input` (so any UI on top of it
automatically blocks the glass), converts the mouse position into the activity's
local coordinates with `make_input_local()` (works under any camera), ignores
anything outside `glass_rect`, and calls the recognizer:

* `press(pos)` – immediately emits `contact` → the game plays **TOK**, a ripple and pushes particles. Feedback never waits for classification.
* `move(pos)` – once the pointer has moved more than `stroke_start_distance` the press becomes a **stroke**. After `stroke_classify_delay` the stroke is classified every frame using the last `motion_window` seconds of movement:
  * **SCRATCH** if it reversed direction at least `scratch_min_reversals` times, moved faster than `scratch_min_speed` and stayed inside `scratch_max_spread`.
  * otherwise **RUB**.
  Strokes report continuously (every `continuous_interval`) while they last.
* `release(pos)` – a short, still press becomes a *pending* tap. If a second press arrives within `double_tap_window` and `double_tap_max_distance`, a **DOUBLE TAP** fires at once (on the second press-down). Otherwise the **SINGLE TAP** fires when the window runs out (~0.3 s – creatures "take a moment to notice", which hides the delay).
* `knock(pos)` – right click / Shift+click / the optional input action → **HARD KNOCK**.

Every gesture becomes a `GlassStimulus` (kind, position, radius, strength) that is
broadcast to all creatures. Creatures never see raw input. The hint system creates
"natural" stimuli (bubbles popping on the glass, a parasite wriggling) the same way.

---

## How to change gesture sensitivity

Open `AquariumActivity.tscn`, select **GestureRecognizer**, and edit in the Inspector:

| Want… | Change |
|---|---|
| Taps to register even if the mouse wobbles | raise `tap_max_movement` |
| Slow clickers to get double taps | raise `double_tap_window` (single taps then wait that long) |
| Scratch to trigger more easily | lower `scratch_min_speed` or `scratch_min_reversals` |
| Rubs never mistaken for scratching | raise `scratch_min_speed` |
| Bigger/smaller area of effect | `single_tap_radius`, `double_tap_radius`, `rub_radius`, `scratch_radius`, `hard_knock_radius` |

Hard-knock input: select **InteractionSurface** → `right_click_is_hard_knock`,
`shift_click_is_hard_knock`, `hard_knock_action` (create an InputMap action with that
name, e.g. a gamepad button, and it knocks where the pointer is).

Debug mode (F1) shows the currently recognised gesture and draws each gesture's position and radius.

---

## How each creature works

All creatures extend `AquariumCreatureBase.gd`: smooth acceleration/deceleration
steering, eyes that look at things (including Bill), blinking, squash-and-stretch on
impacts, "noticing" hops, occasional glances at Bill, and nervous glances into the dark
when the deep creature is paying attention.

| Creature | Responds to | Behaviour | Puzzle role |
|---|---|---|---|
| **Blimp** (`Blimp.gd`) | SINGLE TAP | Notices (brows up), then lumbers to the tap. Heavy (mass 10): shoves the shell, pebbles, other creatures. THUD + squash + surprised face on impact. Pushing against something immovable → confused look at the thing, then at Bill. Rammed by the Coward → slow confused spin. | Bulldozer |
| **Bastards** (`BastardSwarm.gd`) | SCRATCH | 8 tiny biters. Scratching makes them flash red and swarm the spot; anything bitable near the spot gets chewed (restraint > parasite > Idiot during chase > other creatures > puffweed). Excitement fades when you stop. They bicker, nip each other, regroup at home. | Cutting tool |
| **Coward** (`Coward.gd`) | DOUBLE TAP (single tap close = small flinch) | Visible startle (kinks, eyes bulge) then bolts in a straight line **away** from the tap. Crashes into things (dazed stars). | Projectile |
| **Sucker** (`Sucker.gd`) | RUB | Swims to the rub and splats onto the glass (underside, suckers, squashed lips). Follows a rub along the glass (squeak). Peels off after a while, or when you rub far away, or when knocked. Heavy while stuck → a wall. Extra-ridiculous face when stuck in front of Bill. | Blocker |
| **Idiot** (`Idiot.gd`) | Watches the others | Telegraphs (stops, stares, nods) then imitates: bolts like the Coward, pushes a pebble like the Blimp, follows the Blimp like a duckling, joins the Bastards (chases its own tail), presses its face to the glass like the Sucker. Steals the memory. | The chase |

---

## How to change creature speed / behaviour

Select the creature under `AquariumActivity/Creatures/` and edit its Inspector:

* **Body**: `body_radius`, `body_mass` (heavier pushes harder).
* **Movement**: `max_speed`, `acceleration` (low = floaty/heavy), `water_drag`, `arrive_radius`.
* **Personality**: `look_at_bill_interval`, `deep_sensitivity`, `min_turn_width`.
* Creature-specific exports, e.g. Blimp `tap_attention_radius`, `reaction_delay`, `linger_time`;
  Coward `startle_radius`, `bolt_speed_max/min`, `bolt_full_time`, `bolt_decay`;
  Sucker `attach_duration`, `follow_radius`, `slide_speed`;
  Bastards `swarm_size`, `swarm_speed`, `excitement_per_scratch`, `excitement_decay`, `bite_damage`, `bite_interval`;
  Idiot `imitation_chance`, `imitation_cooldown`, chase values (below).

Defaults are set in each script's `_init()`; values you change in the Inspector override them.

---

## How the puzzle sequence works

Stages (`AquariumActivity.Stage`, also reported by the `stage_changed` signal):

1. **push_shell** – The clam starts under a rock overhang (`Layout/ShellCover` zone). Lure the
   Blimp *behind* it (left side) with taps, then tap beyond the shell: the Blimp shoves it
   out. It needs ~200 px of pushing, so one bump is not enough. Stage completes when 80% of
   the shell is out from under the cover (`ShellObjective.exposed_fraction`).
   The shell can be pushed back and forth freely and is clamped so there is always room
   for the Blimp on both sides; the Blimp only shoves it when it is going somewhere on purpose.
2. **break_restraint** – A knotted growth straps the shell shut. Scratch near it: the
   Bastards chew it (≈8 s of scratching). SNAP.
3. **crack_shell** – A fast, hard hit cracks the shell. Line the Coward up and double tap
   *behind* it. A direct hit opens it; weaker or glancing hits add cracks (two weak hits
   also open it). Hits while the restraint is intact just go BOING.
4. **shell_opened** – a pause ("YES.").
5. **idiot_theft** – the Idiot grabs the memory, swims up to the glass, stares at Bill, leaves.
6. **chase** – trap the Idiot (see below). It spits out the memory.
7. **memory_falling** – a current carries the memory towards the chute; the Blimp nudges it if it stalls.
8. **calm → finale_approach → finale_wait → finale_response → complete**.

Order is enforced physically (the cover blocks bites and hits; the restraint absorbs hits),
not by invisible rules.

---

## How the adaptive hint system works

`AquariumHintController.gd` tracks:
current stage, time since meaningful progress, gestures discovered, creature responses
(debounced), failed actions (`blimp_wrong_way`, `coward_miss`, `coward_hit_restraint`...),
Coward aim quality (did the bolt pass near the shell?), and the current hint level.

From that it **diagnoses** the most likely misunderstanding:

| Diagnosis | Meaning |
|---|---|
| `blimp_attract` | Doesn't know the Blimp follows taps |
| `blimp_position` | Knows, but can't get it behind the shell (also used if the shell is pushed back under the rock later) |
| `bastards_attract` / `bastards_target` | Hasn't found scratching / isn't scratching near the growth |
| `coward_startle` / `coward_direction` / `coward_timing` | Never bolted it / bolts it the wrong way / knows but needs to line it up |
| `chase_box` | Chase taking long |

Escalation (only while no progress is being made):

* **Level 0** – natural learning, always on: every ~22 s the tank demonstrates something the
  player hasn't discovered (a bubble pops near the Blimp and it swims over; a bubble startles
  the Coward; the Sucker briefly sticks to the glass; the Bastards chew a puffweed).
* **Level 1** – creature nudge targeted at the diagnosis (the Blimp *looks at the space behind
  the shell*; the Bastards chew a plant next to the shell; the Coward is startled across open
  water to show "away"; the Coward drifts nearer the shell).
* **Level 2** – ~80% demonstration (a bubble behind the shell lures the Blimp there, then one
  beyond it makes the Blimp nudge the shell a little; a parasite pops up next to the restraint
  and the Bastards maul it, nicking the growth; the Coward is startled towards the shell and
  narrowly misses).
* **Level 3** – the information plaque by the tank glows and pings.
* **Level 4** – only after ~90 s stuck on the same stage: a small "Need a hint?" bubble. If
  clicked, ONE line for the current diagnosis (from `data/hint_texts.json`). Ignored → it fades.

Meaningful progress (stage change = full reset; first response from a new creature, pushing
the shell further, restraint passing 75/50/25%, cracking the shell = minor, lowers the level and
resets the timer). Hints are at least `min_gap_between_hints` apart. `hints_used` counts
level 2+ demonstrations, panel opens after level 3, and accepted direct hints.

---

## How to change hint delays

Select **HintController** in `AquariumActivity.tscn`:
`level1_delay` (25 s), `level2_delay` (45 s), `level3_delay` (65 s), `level4_delay` (90 s),
`first_stage_extra` (extra play time at the start), `min_gap_between_hints`,
`repeat_interval`, `natural_demo_interval`. Untick `enabled` to switch hints off.

Direct hint wording: edit `data/hint_texts.json` (keys are the diagnoses above).

---

## How to add / edit information panel hints

Edit `data/info_panel_entries.json`:

```json
{ "name": "GREATER BLIMP", "latin": "Pinguis enormis",
  "lines": ["Docile. Curious. Attracted to small vibrations.", "..."] }
```

Add/remove entries freely; the panel builds itself from the file. The path is the
`entries_path` export on `UI/InfoPanel`. The panel opens when the player clicks the plaque
(`OutsideProps/InfoPlaque`), or from code: `activity.info_panel.open()`.

---

## How the deep creature attention system works

`DeepCreatureController.gd` keeps a hidden `attention` (0..1, never displayed).

| Gesture | Attention |
|---|---|
| single tap | +0.006 |
| double tap | +0.016 |
| rub | +0.0012 per report (minimal) |
| scratch | +0.0055 per report (~0.07/s) |
| hard knock | +0.17 |
| 5+ taps/knocks within 2 s | extra per impact |

It decays by `attention_decay`/s. Thresholds: `medium_threshold` 0.2, `high_threshold` 0.45,
`very_high_threshold` 0.75. What the player sees:

* **LOW** – a barely visible shape drifting far back, or plants swaying with nothing there.
* **MEDIUM** – two faint eyes open in the distance, blink, fade.
* **HIGH** – a huge shadow crosses the background, rumble, creatures glance back and tremble.
* **VERY HIGH** – something enormous approaches the glass, stares, then loses interest (attention drops).

Nothing happens in the first `quiet_start_time` seconds. Going up a level triggers an
apparition within a few seconds so the player can connect cause and effect.

---

## How to change glass damage

Select **GlassDamage**: `damage_per_knock` (0.125 → 8 knocks = maximum), `merge_radius`
(knocks this close grow the same crack), `creak_threshold` (when the glass starts creaking
on its own). Progression: stress mark → small crack → branching crack → spidered crack +
creaking. The glass never breaks; at maximum it only groans. `glass_damage` in the
result data is 0..1. The giant's tap leaves its own crack that is not counted.

---

## How to test the Idiot chase

* In the test scene press **F1**, then **C** (start chase). Debug view shows the Idiot's
  goal, its 12 trap probes (red = blocked), and a pressure bar above it.
* **I** captures it instantly.
* Tuning (select **Creatures/Idiot**): `chase_cruise_speed`, `chase_dash_speed`,
  `trap_probe_length`, `trap_blocked_needed` (of 12 directions), `trap_pressure_rate`,
  `bite_pressure`, `coward_hit_pressure`, `pressure_decay`, `chase_grace_time`, `tire_after`.
* Pressure rises while it is boxed in (walls, rocks, Blimp, a stuck Sucker, the swarm),
  bitten by the Bastards, hit by the Coward, bonked by the Blimp, or frozen by a hard knock;
  it falls when it is free. At 1.0 it spits the memory out.
* Automated: `godot --path . -- --autoplay --chase` (prints chase time + where pressure came from).

## How to test the ending

* **F1** then **F** jumps straight to the finale (memory delivered, everything goes quiet,
  the giant approaches). Then either tap the glass, or wait `finale_wait_time` (9 s) for
  the disappointed version.
* Timings: `AquariumActivity` → `calm_duration`, `finale_wait_time`;
  `DeepCreature` → `finale_approach_time`, `finale_head_offset`.

---

## Debug mode

Turn on with **F1** (`debug_toggle_key`) or tick `debug_mode` on the activity. Set
`allow_debug_toggle = false` for release builds. While on:

| Key | Action |
|---|---|
| 1 / 2 / 3 / 4 / 5 | tap / double tap / rub / scratch / hard knock at the mouse |
| N | advance puzzle stage |
| R | reset & restart |
| H | trigger next hint |
| O | open shell |
| C | start chase |
| I | capture Idiot |
| = / - | glass damage up / down |
| U | summon deep creature |
| F | trigger finale |
| T | 3× speed |

The overlay shows the gesture, stage, time since progress, hint level + diagnosis, deep
attention, glass damage, shell state, every creature's state and target, and the Idiot's
path/probes. All of these are also callable from code: `activity.debug_command("finale")`.

---

## Automated play-testing

`test/AquariumAutoPlaytest.gd` plays through REAL mouse events (so the input surface,
camera conversion and gesture recognizer are all exercised):

```
godot --path game_of_games_aquarium -- --autoplay           # full play-through
godot --path game_of_games_aquarium -- --autoplay --chase   # chase only
godot --path game_of_games_aquarium -- --autoplay --idle    # never touches the glass: watch hints escalate
add --fast for 3x speed, --shots for screenshots in user://aquarium_shots/
```

---

# HOW TO PUT THIS INTO THE REAL AQUARIUM SCENE

The module is a single 2D scene. All of its gameplay coordinates are **local to the
`AquariumActivity` node**, so you place it once and everything inside moves with it.

### 1. Copy the folder

Copy `game_of_games_aquarium/minigames/aquarium_glass/` (the whole folder) into your
project so it ends up at **`res://minigames/aquarium_glass/`**. Do it with the Godot
FileSystem dock closed or let Godot re-import afterwards. Keep the `.import` files.

(If you must use another path: scripts use relative paths and will work, but update the
three exported paths that point into the folder: `UI/InfoPanel → entries_path`,
`HintController → hint_texts_path`, `Audio → audio_folder`.)

### 2. Instance the component

In your aquarium scene: **Scene → Instantiate Child Scene… → `AquariumActivity.tscn`**.
Put it in front of/over your aquarium art. If your scene is 3D, see
[3D projects](#if-the-real-aquarium-scene-is-3d).

### 3. Define the glass interaction area

Select the `AquariumActivity` node → Inspector → **Aquarium area**:
* `glass_rect` – the rectangle where clicks count as touching the glass (activity-local
  pixels). Leave its size at `0, 0` to use `aquarium_bounds`.
The editor shows it as a white dashed rectangle (drawn by `LayoutGuides`).

### 4. Set the aquarium boundaries

* `aquarium_bounds` – the water volume (cyan rectangle in the editor). Creatures never leave it.
* `floor_height` – sand thickness measured up from the bottom of the bounds (yellow line).
* `surface_margin` – how far below the top creatures stay.

Line these up with your tank art (move/scale the AquariumActivity node itself if easier —
if you scale it, everything scales together).

### 5. Position each creature

Move the markers under **`Layout`**: `BlimpStart`, `BastardsHome` (where the swarm
loiters), `CowardStart`, `SuckerStart`, `IdiotStart`. They are read when the activity
starts/resets.

### 6. Position the shell

* `Layout/ShellStart` – x is used; y is snapped onto the floor.
* `Layout/ShellCover` – the zone the shell must be pushed out of. Its **right side must be
  the open side** (the shell is pushed to the right). Resize it with its `size` property.
* `Layout/Obstacles/Overhang1..4` – the solid rock above the shell. Each obstacle is a circle
  (`radius`). Add/remove/move `AquariumObstacle` nodes to match your rocks. Tick
  `draw_placeholder_rock = false` when your own art shows the rock; tick `idiot_hide_spot` on
  rocks the Idiot may hide behind.
* Leave room for the Blimp (≈130 px) between the left wall and the shell.

### 7. Position the retrieval chute

Move `Layout/Chute` (put it on the floor line). The shell can never be pushed onto it.

### 8. Position the deep creature starting area

Move `Layout/DeepCreatureOrigin` (somewhere in the dark background). Its final position at
the glass is `DeepCreature → finale_head_offset` (relative to the bounds centre).
`Layout/HideSpots/*` are extra Idiot hiding places (e.g. behind foreground plants).

### 9. Connect the real Bill / player

From your aquarium/interaction code, when Bill starts using the aquarium:

```gdscript
@onready var aquarium = $AquariumActivity

func _on_bill_interacts_with_aquarium():
    aquarium.start_activity($Bill)      # any Node, or null
```

The `player` is optional and duck-typed. If it has these methods they are used, otherwise ignored:

```gdscript
func get_aquarium_gaze_position() -> Vector2: return $Head.global_position  # where creatures look
func on_aquarium_knockdown() -> void: $AnimationPlayer.play("fall_over")      # the giant tapped back
func on_aquarium_reward(reward_id: String) -> void: pass                     # memory delivered
```

If it has no `get_aquarium_gaze_position()` but is a `Node2D`, creatures look at
`player.global_position + bill_head_offset`. Otherwise at `Layout/BillGazePoint`.

To stop early (Bill walks away): `aquarium.cancel_activity()` → emits `activity_cancelled`.
To start over: `aquarium.reset_activity()` then `start_activity(...)`.

Disable your own player movement/input while the activity runs if needed (connect to
`activity_started` / `activity_completed` / `activity_cancelled`).

### 10. Connect the real camera for camera impulses

Either:
* set `camera_path` on the activity to your `Camera2D` — it is shaken automatically; or to
  a camera node that has `add_trauma(amount)`, `shake(strength, duration)` or
  `apply_impulse(strength, duration)` — that method is called; **or**
* connect the signal yourself:

```gdscript
aquarium.camera_impulse_requested.connect(func(strength, duration): $Camera.shake(strength, duration))
```

Strengths: hard knock 0.35, Coward impacts 0.1–0.3, the giant's tap 1.0.

### 11. How completion is signalled

`activity_completed(result_data)` (and the identical `aquarium_completed(result_data)`) fire once, after the finale:

```gdscript
{
  "completion_time": 312.4,        # seconds since start_activity
  "hard_knocks_used": 3,
  "glass_damage": 0.38,            # 0..1
  "hints_used": 1,
  "idiot_capture_time": 41.2,      # chase duration in seconds
  "final_tap_used": true,          # did the player tap the giant?
  "reward_id": "aquarium_memory",
  "gesture_counts": {...}          # extra: how often each gesture was used
}
```

You can also read it any time with `aquarium.get_result_data()`.

### 12. How to receive aquarium_memory

The module does not touch any inventory. When the memory drops into the chute it emits
`reward_delivered("aquarium_memory")` (and calls `player.on_aquarium_reward(...)` if present).
Give the item there (or at `activity_completed` using `result_data.reward_id`):

```gdscript
aquarium.reward_delivered.connect(func(id): GameState.give_item(id))
```

### 13. Test files not needed in the final game

Delete (or just never reference) `minigames/aquarium_glass/test/` — `AquariumTest.tscn`,
`AquariumTest.gd`, `TestBill.gd`, `AquariumAutoPlaytest.gd`. Also `tools/` (Python audio
generator) is not needed at runtime. Nothing in the module depends on them.
Set `allow_debug_toggle = false` (and `debug_mode = false`) for release.

### 14. How to replace placeholder creature artwork

Each creature draws itself in its `_draw()` function. The simplest replacement:

1. Add a `Sprite2D` / `AnimatedSprite2D` as a child of e.g. `Creatures/Blimp`.
2. In `Blimp.gd`, replace the body of `_draw()` with `pass` (keep the function).
3. In the creature script's `_process`/`tick`, drive the sprite from the existing animation
   state, which is already computed for you every frame:
   `facing` (-1..1, use for `flip_h` or `scale.x`), `squash`/`squash_axis` (impact squash),
   `surprise` (0..1), `blink`, `gaze_point` (where the eyes should look), `state`
   (`"idle"`, `"approach"`, `"confused"`, `"bolt"`, `"attached"`, `"flee"`, `"panic"`...),
   `velocity`, `front_scale` (>1 when right at the glass), `nervous`.
   Example: `$Sprite.scale = Vector2(facing, 1) * front_scale; $Sprite.play(state)`.
4. Keep `body_radius` roughly matching the art — it is the collision size.

Scenery: hide the placeholder world with `show_placeholder_environment = false`, keep the
`Layout/Obstacles` circles matched to your rocks. The shell (`ShellObjective._draw`), memory,
chute, deep creature and cracks can be replaced the same way (they expose `restraint_hp`,
`crack_hp`, `open_amount`, `is_open`; the deep creature exposes `head_pos`, `dist`,
`body_alpha`, `eyes_alpha`, `tentacle`, `tip_target`, `tip_press`). Glass ripples/smears
(`GlassFX`) are generic and can stay.

### 15. How to replace placeholder audio

Overwrite the file with the same name in `minigames/aquarium_glass/audio/` (e.g.
`glass_tap.wav`). `.ogg` and `.mp3` with the same base name also work (ogg is tried first).
Or select **Audio** and add `slot name → AudioStream` pairs to `overrides`. Missing files are
silently skipped. Set `bus` to play through your SFX bus. Slot list:

`glass_tap, glass_double_tap, glass_rub*, glass_scratch*, hard_knock, glass_stress, glass_crack,
ambience*, bubbles, blimp_move, blimp_impact, bastard_swarm, bastard_swarm_loop*, bastard_bite,
coward_startle, coward_dash, coward_impact, sucker_attach, idiot_noise, shell_move, shell_crack,
rope_snap, memory_release, memory_shimmer, chute_suck, deep_rumble, deep_approach, final_tap,
completion, chase_music*` (* = looped automatically).

To regenerate the placeholders: `pip install numpy && python3 tools/generate_placeholder_audio.py`.

### 16. Common integration problems and exactly how to fix them

| Problem | Cause | Fix |
|---|---|---|
| Clicking the glass does nothing | Something else consumes the click (a full-screen `Control` with mouse filter *Stop*), or `start_activity()` was never called | Set that Control's `mouse_filter` to *Ignore*/*Pass*; make sure `start_activity()` runs; check `glass_rect` (F1 shows it) |
| Clicks land in the wrong place | `glass_rect`/`aquarium_bounds` don't match the art | They are in the activity's local space: move/scale the `AquariumActivity` node or edit the rects; the editor guides show them |
| Creatures swim through my rocks | Obstacles still at the placeholder positions | Move/add `Layout/Obstacles` circles over your rocks |
| The shell can't be pushed out | `ShellCover` open side isn't on the right, or no room for the Blimp | Cover's right edge must face open floor; keep ≈130 px left of the shell |
| Creatures look in a strange direction "at Bill" | Gaze point is wrong | Implement `get_aquarium_gaze_position()` on the player, or move `Layout/BillGazePoint`, or set `bill_head_offset` |
| No camera shake | `camera_path` empty | Set it, or connect `camera_impulse_requested` |
| No sound | Audio not imported, or wrong bus | Open the project in the editor once (imports `.wav`); set `Audio → bus` to an existing bus |
| Ripples look offset / wrong | Unusual viewport transforms, or a platform without screen-texture support | Untick `GlassFX → use_refraction` (rings and smears still show) |
| Hint bubble / info panel appear in the wrong place or behind my UI | `UI` CanvasLayer is layer 10 | Change `UI → layer` |
| Debug view appears in the real game | `F1` pressed | Set `allow_debug_toggle = false` |
| "Invalid get index" errors after renaming nodes | The activity finds its children by name | Don't rename nodes inside `AquariumActivity.tscn` (rename the instance itself freely) |
| Everything too big/small | Scene designed for a 1920×1080 2D space | Scale the `AquariumActivity` node; all gameplay scales with it |
| Player can still walk around during the activity | The module never touches player control | Disable your controller between `activity_started` and `activity_completed`/`activity_cancelled` |

### If the real aquarium scene is 3D

Render the module into the glass:

1. Add a `SubViewport` (size 1920×1080, *Handle Input Locally* on) and put
   `AquariumActivity.tscn` (plus a `Camera2D` at 960,540) inside it.
2. Give your glass mesh a material whose albedo texture is a `ViewportTexture` of that SubViewport.
3. Forward mouse clicks: raycast from your 3D camera to the glass mesh, convert the hit to
   UV (0..1) and push a mouse event into the SubViewport:

```gdscript
func _forward_click(uv: Vector2, pressed: bool, button := MOUSE_BUTTON_LEFT):
    var ev := InputEventMouseButton.new()
    ev.button_index = button
    ev.pressed = pressed
    ev.position = uv * Vector2($SubViewport.size)
    $SubViewport.push_input(ev, true)
    # do the same with InputEventMouseMotion for mouse movement (rub/scratch)
```

4. Connect `camera_impulse_requested` to your 3D camera shake, and use the duck-typed player
   methods above for Bill (the gaze falls back to `Layout/BillGazePoint`, which should then
   be placed where Bill's face appears relative to the glass).
