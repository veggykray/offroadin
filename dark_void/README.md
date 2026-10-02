# Dark Void: standalone Godot 4 prototype

A self-contained mini-game prototype. Bill floats in a pitch-black void with a weak light in his hand. Somewhere in the dark is something very large.

The art is all placeholder geometry, built in code or from primitives, and every visual piece can be swapped out. The sound is generated procedurally at startup, so the project ships with no asset files.

## Run

1. Open `dark_void/project.godot` in **Godot 4.3+**. The renderer is Forward+, and it also runs on Compatibility.
2. Press F5. The main scene is `scenes/dark_void.tscn`.

| Input | Action |
|---|---|
| WASD / arrows / left stick | Float (slow thrust, inertia, damping) |
| Mouse / right stick | Aim the hand, independent of movement |
| Hold LMB / Space / RT | Illuminate (drains energy). Release to go dark and recharge |
| E / A button | Interact (TOUCH) |
| F1 | Toggle debug HUD |
| F2 | Debug: light the whole void, to inspect the layout |
| F3 | Debug: force the close-encounter scare now |
| F4 | Debug: activate the next memory |
| R | Restart |

Input actions (`dv_*`) are registered at runtime, and only if the host project hasn't already defined them. A larger game can remap them in its own InputMap.

## Tests

```bash
# Logic, headless (about 1 s): movement, energy, detection, freeze/recoil, relocation rules,
# memories, reveal levels, scare, final reversal, TOUCH, completion signal
godot --headless --fixed-fps 60 --path dark_void -s tests/smoke_test.gd

# Reference screenshots of key moments (needs a display; software GL is slow)
DV_SHOT_DIR=/tmp/shots xvfb-run -a godot --path dark_void --rendering-driver opengl3 \
      --fixed-fps 60 -s tests/screenshots.gd
```

## Architecture

```
DarkVoid (dark_void.gd)                 progression only: memories → reveal → final → completion
├─ VoidEnvironment (WorldEnvironment)   black bg, zero ambient; reveal levels per memory
├─ FillLight (DirectionalLight3D)       optional faint form-light at reveal level 3
├─ Camera (FloatCamera)                 lazy side-view follow
├─ Bill (bill.tscn)
│  ├─ BillController                    floating movement
│  ├─ Visual                            placeholder capsule + head
│  ├─ Hand (PlaceholderHand)            mouse/stick aim, marker sphere, thin arm
│  │  └─ HandLight (IlluminationSource) short-range omni light + gameplay illumination
│  │     └─ Energy (LightEnergy)        optional finite energy
│  └─ Listener (AudioListener3D)        audio is heard from Bill, not the camera
├─ Creature (creature.tscn)
│  ├─ DarkCreature                      behaviour state machine + positional audio
│  ├─ Visual (CreaturePlaceholderVisual)  procedural placeholder art + anchors
│  └─ Detector (IlluminatedObject)      "is any part of me lit?"
├─ Props/*  (PlaceholderProp)           sphere, chair, cube, frame, rocks at varied depths
├─ Memories/* (memory_object.tscn)      MemoryObject + its own IlluminatedObject
├─ Dust (DustField)                     motes that only show inside the light
├─ ScareDirector                        evaluates child ScareEvents
│  ├─ CloseEncounter (CloseEncounterScare)
│  └─ ImpactBehind (SoundCueEvent)
├─ HUD (DarkVoidHUD)                    TOUCH prompt, messages, fade
└─ DebugHUD                             energy bar / counters (delete or disable freely)
```

### Integration contract

```gdscript
var void_scene := preload("res://dark_void/scenes/dark_void.tscn").instantiate()
void_scene.standalone_controls = false        # no R-restart / F-key debug
void_scene.dark_void_completed.connect(func(reward_id): ...)  # "dark_creature_memory"
add_child(void_scene)
```

Other signals on `DarkVoid`: `memory_activated(memory_id, count, total)`, `phase_changed(phase)` and `touch_available_changed(available)`.

### Illumination system (reusable)

* **`IlluminationSource`** (Node3D): anything that lights things for gameplay purposes. The model is a radius plus a `(1 - d/range)^falloff` curve, kept deliberately separate from the renderer. That keeps detection deterministic and cheap, with no pixel readback. `HandLight` extends it and keeps its gameplay range equal to its rendered `OmniLight3D` range. Sources with `counts_for_detection = false` are ignored by default, so memory glows don't "see" the creature.
* **`IlluminatedObject`** (Node3D): add it as a child of anything. Read `is_lit`, `amount` and `continuous_lit_time`, or use the signals `illumination_started`, `illumination_ended` and `illumination_changed(amount)`. It has hysteresis and a flicker grace time. Sample points can come from explicit NodePaths, from child `Marker3D`s, or from nodes in a **group** under a search root, which is how the creature works. Each sample can carry a `sample_radius` meta, so large parts count as lit when light touches their surface. Optional raycast occlusion is available for when real colliders exist.

### Hand light → final character

`HandLight` only needs a parent transform. When Bill's model arrives:

1. Add a `BoneAttachment3D` on the hand bone.
2. Move `HandLight` (and its `Energy` child) under it.
3. Delete `PlaceholderHand`, and drive the arm's aim (IK) from the same mouse/stick logic.
4. Point `DarkVoid.hand_light_path` and `DarkCreature.hand_light_path` at the new location.

The exposed light parameters are `light_range`, `light_intensity`, `light_attenuation` (render falloff), `detection_falloff` (gameplay falloff), `light_color`, shadows, fade times and flicker. Hand distance from the body is `PlaceholderHand.hand_distance`.

### Energy

`LightEnergy` exposes `max_energy`, `drain_rate` (scaled by output), `recharge_rate`, `recharge_delay`, `min_light_threshold`, and the dimming settings `dim_below` and `dim_floor`. `min_light_threshold` is the fraction of energy needed to switch on, or to relight after running dry. Set `enabled = false` for unlimited light, and `HandLight.always_on = true` for no hold-to-illuminate. The debug bar is the only UI, and the light itself already gutters and dims when energy is low.

### Creature behaviour (`DarkCreature`)

| State | Behaviour |
|---|---|
| `DORMANT` | Silent and still for `dormant_time` (the exploratory opening) |
| `STALKING` | Unseen. Every few seconds it **teleports** to a new place around Bill. It never travels visibly. Most moves bring it a few metres closer, some keep the distance at a new angle, and a few retreat. It also gets a random roll and yaw, so different parts end up facing Bill. Candidates are rejected if any part would land within `player_clearance` of Bill, inside the light's potential reach, or in front of Bill's depth plane. Off-screen spots are preferred. Moves are announced only by positional sound (move/scrape) from the nearest body part, plus occasional breathing and distant impacts. Threat level (memories collected) shortens intervals and lets it come closer. |
| `FROZEN` | Lit: stops completely, including the idle breathing and finger twitch. |
| `RECOILING` | Lit for longer than `freeze_before_recoil`: slowly backs away from the light and into depth. It never attacks. |
| `FINAL_WAITING` / `FINAL_RECOIL` | After 3 memories: no more stalking. A looping beacon plays from `TouchAnchor`, and direct light makes it recoil. |
| `REVEALED` | Completion: soft lights fade in at `RevealPoint*` anchors, showing part of it, not all. |

The placeholder art is about 30 m across. Bill is about 1.8 m tall, so one finger is roughly his height. The placeholder includes rough skin masses with a noise normal map, about 370 hair strands, a long arm and hand with jointed fingers and nails, a second clawed limb, a huge wet eye with a slit pupil, and rows of uneven teeth. With a 3.2 m light you only ever see a fragment.

To replace the art, swap the `Visual` node and keep this contract:

* `Marker3D "EyeAnchor"`, `"TouchAnchor"` and `"RevealPoint1..n"`
* `Marker3D`s in group `dv_creature_samples` with meta `sample_radius`, covering the body
* optionally a `set_idle_motion(enabled)` method
* local +Z faces the camera, and everything sits at local z ≤ ~1.2

### Memories

`MemoryObject` uses its own `IlluminatedObject`. While lit it glows faintly. After `activation_duration` seconds of continuous light (default 1.5 s) it activates. It then becomes a permanent faint `OmniLight3D`, plays a chime, stays visible and emits `activated`. No collision is involved. For custom art, add a `Visual` child, optionally with a `set_glow(amount)` method.

### Progressive reveal

`VoidEnvironment.ambient_levels = [0, 0.01, 0.03, 0.07]` and `fill_levels = [0, 0, 0.003, 0.012]`, indexed by memories collected. Each change eases in over 5 s. At level 3 the creature's silhouette becomes faintly readable at a distance, but it is not revealed.

### Scare events

`ScareDirector` ticks its child `ScareEvent` nodes against a `ScareContext` (elapsed time, memories, light on/off time, Bill, hand, creature). Each event has `enabled`, `one_shot` and `cooldown`, plus its own conditions. Add an event by subclassing `ScareEvent` and overriding `can_trigger(ctx)` / `trigger(ctx)`.

* **`CloseEncounterScare`**: once ≥1 memory is collected, ≥45 s have passed and the light has been off for ≥4 s, the creature silently teleports. Its `EyeAnchor` lands about 1.3 m in front of the hand, just behind Bill's plane, and it holds there for up to 40 s. When the light comes on, the eye fills the light. There's no animation or sting, only a very quiet exhale on discovery, which can be turned off. Normal lit rules then apply: it freezes, then recoils.
* **`SoundCueEvent`**: a heavy impact behind Bill a few seconds after the first memory. This is a second example of a sound-only event.

### Final reversal

After the last memory there is a short pause, then the creature stops stalking and is placed about 24 m away. Its beacon sound is the main way to find it. Shining the light at it makes it recoil. Approaching in the dark lets Bill get right up to it. Within `touch_distance` of `TouchAnchor`, while it isn't lit, **TOUCH** appears, and Interact completes the game: the hand light swells, the creature is partly revealed, the screen fades, and `dark_void_completed("dark_creature_memory")` is emitted.

## Files

```
scenes/   dark_void.tscn (main), bill.tscn, creature.tscn, memory_object.tscn
scripts/
  core/          dark_void.gd, void_environment.gd, float_camera.gd, dv_input.gd
  player/        bill_controller.gd, placeholder_hand.gd
  illumination/  illumination_source.gd, illuminated_object.gd, hand_light.gd, light_energy.gd
  creature/      dark_creature.gd, creature_placeholder_visual.gd
  memory/        memory_object.gd
  events/        scare_director.gd, scare_event.gd, scare_context.gd,
                 close_encounter_scare.gd, sound_cue_event.gd
  ui/            dark_void_hud.gd, debug_hud.gd
  placeholder/   placeholder_meshes.gd, placeholder_audio.gd, placeholder_prop.gd, dust_field.gd
tests/    smoke_test.gd, screenshots.gd
```

## Known prototype limits

* At reveal levels 2–3 the ambient light is non-zero, so a relocation the camera can see shows as a faint pop. Off-screen spots are preferred, but it isn't guaranteed.
* There are no colliders on props or the creature. Bill passes through everything, and occlusion checks are off.
* The sounds are synthetic stand-ins. Every sound is an exported `AudioStream` slot.
