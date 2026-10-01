# Polarity Machine: puzzle room vertical slice (Godot 4.x)

This is a self-contained 2D puzzle room about the Hermetic principle of polarity. The player works a strange machine with three physical controls. Each control sets a continuum:

- **Temperature**: cold ↔ hot
- **Light**: dark ↔ light
- **Age**: young ↔ old

The goal is to grow a fruit, ripen it, and open it to retrieve a brass seed-key.

There is no artwork to import. Everything is drawn procedurally: vectors via `_draw()`, gradients, blend modes, one shader, and placeholder sounds synthesised at runtime.

---

## 1. File structure

```
res://minigames/polarity_machine/
├── PolarityMachine.tscn          ← open / instance this
├── README.md
├── TEST_CHECKLIST.md
├── shaders/
│   └── heat_shimmer.gdshader     screen-space heat haze (WARM / SCORCHING)
└── scripts/
    ├── polarity_machine.gd       ROOT: state, puzzle rules, signals, input, audio, layout
    ├── environment_controller.gd smooths 0..4 targets into fractional "levels", broadcasts them
    ├── room_backdrop.gd          wall, sigil, wainscot, floor, pipes; ageing, frost, condensation
    ├── water_vessel.gd           ice ↔ liquid ↔ bubbles ↔ boil/steam (temperature gauge)
    ├── mechanical_lamp.gd        hanging lamp whose iris mirrors the light wheel
    ├── atmosphere_fx.gd          darkness (multiply), beam/glare/glow (add), frost, particles, shimmer
    ├── plant_controller.gd       procedural plant + bloom/ripen/rot biology + click-to-inspect
    ├── fallen_fruit.gd           falling / bouncing fruit, split-open, key reveal + collect
    ├── machine_body.gd           machine cabinet, core globe, gears, chimneys, indicator jewels
    ├── continuum_control.gd      BASE for the three controls: drag, wheel, detents, spring
    ├── temperature_lever.gd      control 1: arced industrial lever (frosted ↔ red-hot ends)
    ├── light_iris.gd             control 2: knurled wheel opening a mechanical iris
    ├── age_dial.gd               control 3: clock dial + crank, carved rings, pictogram stations
    ├── draw_proxy.gd             tiny helper: a draw layer whose content another script supplies
    ├── placeholder_sounds.gd     synthesises the placeholder AudioStreamWAVs
    └── pm_util.gd                shared interpolation/drawing helpers (no class_name)
```

There are no `class_name` declarations, autoloads, plugins, InputMap actions or project-setting changes. Nothing outside this folder is referenced.

> **Note about this repository:** this folder was delivered into a repository that is not a Godot project (it has no `project.godot`). Copy the whole `polarity_machine` folder so that it sits at `res://minigames/polarity_machine/` in the Godot project. All scripts use absolute `res://minigames/polarity_machine/...` paths, so the folder must sit there exactly.

## 2. How to launch

- **In the editor:** open `res://minigames/polarity_machine/PolarityMachine.tscn` and press **F6** (Run Current Scene).
- **Command line:** `godot --path <project> res://minigames/polarity_machine/PolarityMachine.tscn`

The composition is designed at 1920×1080. With the default `auto_fit_to_viewport = true`, the scene scales itself to any window and letterboxes non-16:9 sizes. It does this whatever the project's stretch settings are. It was tested at the default 1152×648 window and at 1920×1080.

**Testing keys** (when `keyboard_shortcuts` is on, which is the default):

| Key | Action |
|-----|--------|
| Q / W | Temperature down / up |
| A / S | Light down / up |
| Z / X | Age down / up |
| E | Open the fallen fruit / collect the key |
| R | `reset_puzzle()` |
| F3 | Toggle the DEBUG numeric readout |
| Esc | Emits `exit_requested` (always active) |

**Mouse controls:**
- Drag any handle.
- Click anywhere on a control's track to jump it there.
- Use the mouse wheel over a control to step it one detent.
- Click the plant or a hanging fruit to read a one-line observation.

## 3. Node architecture

```
PolarityMachine (Node2D)               polarity_machine.gd: draws the letterbox colour
├── Stage (Node2D)                     scaled/centred 1920×1080 design space
│   ├── Environment (Node2D)           environment_controller.gd
│   │   ├── Room (Node2D)              room_backdrop.gd
│   │   ├── WaterVessel (Node2D)       water_vessel.gd   @ (260, 830)
│   │   └── Lamp (Node2D)              mechanical_lamp.gd @ (600, 0)
│   ├── Plant (Node2D)                 plant_controller.gd @ (720, 745) = soil centre
│   ├── FallenFruit (Node2D)           fallen_fruit.gd (draws in Stage space)
│   ├── Atmosphere (Node2D)            atmosphere_fx.gd; creates these children in _ready():
│   │       Frost · Particles · Darkness(MUL) · Glow(ADD) · HeatShimmer(shader)
│   └── Machine (Node2D)               machine_body.gd (draws in Stage space)
│       ├── AgeDial (Node2D)           age_dial.gd          @ (1560, 300)
│       ├── LightIris (Node2D)         light_iris.gd        @ (1410, 630)
│       └── TemperatureLever (Node2D)  temperature_lever.gd @ (1565, 1040) = pivot
├── UI (CanvasLayer, layer 10)
│   ├── Hint (Label)                   intro line + observations; mouse_filter = ignore
│   └── DebugLabel (Label)             hidden unless DEBUG
└── Audio (Node)
    ├── LeverClick  ├── MachineHum (loops)  ├── TemperatureShift  ├── LightShift
    ├── AgeShift    ├── PlantGrow           ├── FruitAppear       ├── FruitDrop
    ├── FruitOpen   └── PuzzleSuccess
```

Draw order is tree order:
1. Room, vessel, lamp, plant and fallen fruit are drawn first.
2. The atmosphere goes over them. This is what darkens the room and adds the beam.
3. The machine is drawn last, so it is never hidden by darkness. It dims itself through an `ambient` factor, but its indicator jewels and glows stay readable in the dark.

## 4. The state system

The state is three integers, `temperature`, `light` and `age`, each 0..4. Their enums are declared in `polarity_machine.gd`:

| | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Temperature | FREEZING | COLD | TEMPERATE | WARM | SCORCHING |
| Light | DARK | DIM | SOFT | BRIGHT | BLAZING |
| Age | NEW | YOUNG | MATURE | OLD | ANCIENT |

When a control changes, the root runs `_refresh()`:

```
control.value_changed ─► _on_*_changed ─► _refresh()
                                            ├─ update_environment()  set visual targets
                                            ├─ update_plant()        pass logical state on
                                            └─ evaluate_puzzle()     apply the rules (below)
```

**Visuals are continuous, not hand-authored per state.** `environment_controller.gd` moves fractional levels (for example `temperature_level = 2.37`) toward the targets at a constant speed. Going from FREEZING to SCORCHING therefore visibly passes through COLD, TEMPERATE and WARM. Every frame the levels change, it emits `levels_changed(t, l, a)`, and the root forwards this to the plant, machine and atmosphere.

Every visual effect is a small five-entry table sampled with `pm_util.key5(level, [v0, v1, v2, v3, v4])`. For example:

```gdscript
var frost := U.key5(temperature_level, [1.0, 0.4, 0.0, 0.0, 0.0])
```

So the 125 combinations come from about 100 independent tables, not 125 scenes:

- The plant's body comes from AGE (height, thickness, gnarl, leaf count/colour, branches, seed, twigs).
- Its posture and reactions come from TEMPERATURE and LIGHT (droop, frost, scorch, leaf folding/opening, bleach, curl, lean toward the lamp, shadow length).
- The bud → flower → fruit sequence comes from the biology values `bloom`, `ripeness` and `decay`.

## 5. Exact puzzle solution

1. **Age dial → MATURE.** This is the third pictogram (the full plant), with the crank pointing straight up.
2. **Temperature lever → WARM.** This is the fourth notch, one short of the glowing right end.
3. **Light wheel → BRIGHT.** This is the fourth glyph, the full disc.

   The order of steps 1–3 does not matter. The machine pulses, the plant straightens, its leaves lift, a bud forms and opens into a violet flower, the petals fall, and a **green fruit** sets. This takes about 6.5 s, and then the machine vents steam.
4. **Age dial → OLD**, keeping temperature at TEMPERATE or WARM and light at SOFT or BRIGHT. The plant gnarls and yellows. The fruit turns orange, then crimson with gold ribs, and swells (about 4.5 s). It trembles and drops to the floor with a bounce.
5. **Click the fallen fruit.** It splits open, revealing a brass seed-key.
6. **Click the key.** It rises in a burst of light, the machine pulses, and **`puzzle_completed("polarity_fruit_key")`** is emitted.

How the plant teaches the answer, without numbers:
- **Too young:** a seed or a small shoot, with no branches to fruit on.
- **Too old:** gnarled, yellowing, and later dead twigs.
- **Cold:** frost and a drooping, then stiff, plant.
- **Too hot:** blackened, curling leaf tips, steam and heat haze.
- **Dark:** leaves folded shut.
- **Too bright:** bleached, curled leaves and glare.
- **Near-miss:** a mature plant at TEMPERATE+BRIGHT, WARM+SOFT or TEMPERATE+SOFT grows a **closed bud that won't open**.
- **Clicking the plant** gives one line describing its worst complaint. For example: *"Its leaves sag in the chill."*
- **Waiting:** if a green fruit hangs for 30 s without ripening, a single hint appears: *"Time has not finished with it."*

**No permanent failure.** Every case below can be recovered from:

| Situation | Result |
|---|---|
| Hanging fruit and AGE → ANCIENT | The fruit rots and crumbles. Return to MATURE to grow another. |
| Hanging fruit and FREEZING or SCORCHING | After about 4.5 s the fruit frost-bites or scorches and falls to dust. Damage heals if conditions recover in time. |
| AGE → YOUNG or NEW during bloom or with a fruit | Time runs backwards: the fruit shrinks back into a flower, then a bud. |
| Fallen fruit left on the floor at ANCIENT | The flesh rots away and the brass key remains, tarnished. It can still be collected. |
| Any extreme | The plant recovers when conditions return. Nothing locks. |

## 6. Integration instructions

1. Copy the folder to `res://minigames/polarity_machine/`.
2. Instance `PolarityMachine.tscn` wherever the room should appear (as a whole screen or as a child scene).
3. Connect `puzzle_completed(reward_id)` and give the player the reward. Optionally connect `exit_requested()` too.
4. On the instance, set the exports:
   - `keyboard_shortcuts = false` for the shipping game. Esc → `exit_requested` stays active.
   - `use_placeholder_sounds`: leave it on until real audio exists. Any `AudioStreamPlayer` under `Audio/` that already has a stream keeps it, so to add real sounds just assign streams to those nodes.
   - `auto_fit_to_viewport`: leave it on if the scene is shown full screen. Turn it off if the host positions or scales the scene itself. Content is authored in 0..1920 × 0..1080 under `Stage`.
   - `start_temperature`, `start_light`, `start_age`: the opening setting. The default is COLD / DIM / YOUNG.
   - `show_intro_text`, `DEBUG`.
5. Call `reset_puzzle()` to replay the room, for example when re-entering it.

```gdscript
var room := preload("res://minigames/polarity_machine/PolarityMachine.tscn").instantiate()
room.keyboard_shortcuts = false
room.puzzle_completed.connect(func(reward_id: String) -> void:
	inventory.add(reward_id)   # your systems
	level_manager.leave_room())
room.exit_requested.connect(level_manager.leave_room)
add_child(room)
```

## 7. Signals emitted

| Signal | When |
|---|---|
| `puzzle_completed(reward_id: String)` | When the key is clicked, about 0.9 s into its rise animation. `reward_id == "polarity_fruit_key"`. Emitted once per completion. After `reset_puzzle()` it can be earned again. |
| `exit_requested()` | Esc pressed. The scene does nothing else; the host decides. |

Internal signals, useful for hooking extra effects:
- **`plant_controller`:** `bloom_milestone("stir"|"bud"|"flower"|"fruit")`, `fruit_ripened`, `fruit_dropped`, `fruit_lost`, `inspected`
- **`fallen_fruit`:** `landed`, `opened`, `key_collected`, `became_idle`
- **Each control:** `value_changed`, `detent_crossed`, `grabbed`, `released`
- **`environment_controller`:** `levels_changed`

## 8. Notes for the next developer

- **The rules live in one place:** the constants at the top of `polarity_machine.gd` plus `evaluate_puzzle()`. The plant only runs timers. Its tunables (`BLOOM_TIME`, `RIPEN_TIME`, `ROT_TIME`, `HAZARD_TIME`, `FRUIT_RADIUS`) are constants in `plant_controller.gd`.
- **Transition speeds** are `TEMPERATURE_SPEED`, `LIGHT_SPEED` and `AGE_SPEED` in `environment_controller.gd`, measured in detents per second.
- **To add a new reactive object:** give it `set_levels(t, l, a)`, connect it to `environment.levels_changed` in the root, and drive its look with `U.key5` tables.
- **To swap in painted art:** any `_draw()` can be replaced with sprites. Keep the `set_levels` interface and use the same tables to pick frames, modulate or blend overlays.
- **Input:** controls, plant and fruit use `_unhandled_input` and `get_local_mouse_position()`, so picking still works when the host scales or moves the scene. The labels are `mouse_filter = ignore`.
- **Debug:** set `DEBUG = true`, or press F3, to show `T 3 WARM  L 3 BRIGHT  A 2 MATURE` and the biology values. This is never shown in normal play.
- **Mouse cursor:** the global cursor shape is not changed. Controls and fruit glow on hover instead.

## 9. Known limitations and testing status

**What was actually tested:**
- Godot **4.3-stable** on Linux, in two ways:
  - Headless, to catch parse and runtime errors. There are none.
  - With real rendering through the OpenGL 3 / Compatibility renderer (Mesa llvmpipe under Xvfb), with screenshots of all 15 single-continuum states and the full solve sequence.
- An automated driver exercised:
  - growing, ripening, dropping, opening and collecting (`puzzle_completed("polarity_fruit_key")` was emitted);
  - rot at ANCIENT and regrowth;
  - scorch loss and regrowth;
  - rewinding to NEW;
  - 40 random rapid setting changes;
  - the fallen fruit rotting to a tarnished key;
  - `reset_puzzle()`.

**What was not tested:**
- Not run on Windows or macOS.
- Not run with the Forward+ (Vulkan) or Mobile renderers. The shader is standard `canvas_item` with `hint_screen_texture`.
- Mouse input was tested with **synthetic** events (`Input.parse_input_event`) at the default 1152×648 window, where the stage is scaled to 0.6:
  - dragged the lever to WARM and the iris wheel to BRIGHT;
  - used the mouse wheel on the age dial;
  - clicked the hanging fruit (correct observation shown), then the fallen fruit, then the key.

  `puzzle_completed` fired. A **physical** mouse was not used, so the *feel* (notchiness, spring, hover) still needs a hands-on pass (see `TEST_CHECKLIST.md`, section J).
- Audio only ran on the dummy driver. The placeholder sounds were generated but not listened to.

**Other limitations:**
- The art is procedural prototype art. It is drawn every frame, which is cheap at this size (a few thousand primitives) but not free.
- Placeholder sounds are simple synths.
- The UI `CanvasLayer` (layer 10) draws above everything in the host while the scene is in the tree.
- With `auto_fit_to_viewport` on, the scene assumes it owns the whole viewport.
- On exit, Godot 4.3 may print "ObjectDB instances leaked" for the looping hum's `AudioStreamPlaybackWAV`. This is an engine shutdown quirk with no gameplay effect.
- Requires Godot **4.2 or newer**, for typed-array `assign()`, `Array.filter` and `hint_screen_texture`.
