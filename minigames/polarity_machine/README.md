# Polarity Machine: grow the fruit (Godot 4.x)

A self-contained 2D puzzle room. A strange machine tends a plant in a brass
cage. The player works four systems (**water**, **light**, **temperature** and
**age / time**) and watches the plant to find out what it needs. The goal is
to make it bear one fruit, half night and half day.

The room is drawn procedurally after the reference illustration:
- the tall glass reservoir with a spout into the cage;
- the brass lamp over the glass and brass cage;
- the brass bowl;
- the cabinet with the age dial, the sun wheel, the moisture porthole, the blue water button, the indicator lamps, and the temperature lever over its frost-to-fire gauge;
- the study behind: night window, crescent sigil, banners, shelves, rug.

Every component is interactive or a live read-out. There is no art to import.

```
res://minigames/polarity_machine/
├── PolarityMachine.tscn        ← open / instance this
├── README.md · TEST_CHECKLIST.md
├── shaders/heat_shimmer.gdshader
├── scripts/
│   ├── plant_rules.gd          ★ PUZZLE RULES + ALL TUNING CONSTANTS (pure logic, no nodes)
│   ├── polarity_machine.gd     root: wiring, host API/signals, input, audio, hints, layout
│   ├── room_backdrop.gd        the study (static)
│   ├── water_tank.gd           reservoir level, riser, valve, spout, floor pipe
│   ├── spray_fx.gd             the water spray onto the plant
│   ├── plant_chamber.gd        lamp, cage, bowl, soil and the procedural plant
│   ├── atmosphere.gd           darkness, lamp beam, cold/heat tint, frost, heat haze, flashes
│   ├── machine_panel.gd        cabinet, moisture porthole, indicator lamps, gears, pipes
│   ├── control_base.gd         drag / click / wheel / detent behaviour shared by the controls
│   ├── age_dial.gd · light_dial.gd · temperature_lever.gd · water_button.gd
│   ├── pm_util.gd              drawing helpers
│   └── placeholder_sounds.gd   synthesised placeholder audio
└── tests/
    ├── test_rules.gd           headless rule tests (60 checks)
    └── play_test.gd            plays the real scene with synthetic mouse input
```

There are no `class_name` declarations, autoloads, InputMap actions or project
settings. Nothing outside this folder is referenced. The folder must sit at
`res://minigames/polarity_machine/`.

## Controls

| System | Control | States | What visibly happens |
|---|---|---|---|
| **Water** | Blue button (click / **D** / Space) | Dry → Damp → Moist → Wet → Waterlogged, one step per press | The button depresses and lights, the pipes and blue glass sections light up, and the spout sprays the plant. The reservoir level drops and the moisture porthole fills. |
| **Light** | Sun wheel (drag the knob, click, scroll / **A** **S**) | Dark / Low / Medium / Bright | The wheel turns, and the hub sun and the lamp brighten. The beam and the room light change. |
| **Temperature** | Big lever over the curved gauge (drag, click the gauge, scroll / **Q** **W**) | Cold / Cool / Warm / Hot | The lever moves. Frost and a blue cast appear when cold; an amber wash, embers and heat haze when hot. |
| **Age / Time** | Upper dial (drag the hand, click a station, scroll / **Z** **X**) | Seedling → Young → Mature → Flowering → Old | The hand turns, the hourglass runs, and the plant grows (or rewinds) one stage per station. |

There are also three indicator lamps:
- **Orange** blinks while harsh conditions are about to hurt the plant, and stays on while it is ailing.
- **Green** is on while the plant is healthy, and pulses while it is recovering.
- **Cyan** shows the pump running, and flickers while the reservoir refills.

**Clicking the plant** gives one line about how it looks. It never names a setting.

Other keys: **R** reset, **F3** debug read-out, **Esc** → `exit_requested`.
Keyboard shortcuts can be disabled with `keyboard_shortcuts = false`. Esc stays active.

## The puzzle

The rules live in `scripts/plant_rules.gd`, with every value as a named constant at the top:

1. **Growing.** Turning the age dial forward grows the plant one stage. The
   conditions *at that moment* decide whether it grows healthy: soil
   **Moist or Wet**, light **Medium or Bright**, air **Cool or Warm**.
   Otherwise it grows sickly, with an ailment that matches what was wrong:
   - crisp and brown when dry;
   - yellow and limp when waterlogged;
   - pale and stretched when the light is low;
   - pale and folded when it is dark;
   - frost-bitten when cold;
   - scorched when hot.

   **Each growth spurt drinks one step of soil moisture**, so the player has to
   water again between stages.
2. **Nothing is permanent.** A sickly plant kept in good growing conditions
   for 5 s heals: the marks fade and it greens up. Harsh conditions held for
   7 s make a healthy plant ail; the orange lamp blinks first as a warning.
   Harsh means: dry, waterlogged, dark, cold or hot.

   The age dial can always be turned back. A seedling is dormant, so harsh
   conditions show on it but do not hurt it.
3. **Flowering needs a night.** A healthy plant at the Flowering age only
   buds when it gets a *cool night*: the lamp **Low or off** and the air
   **Cool or Cold**. Half a night (one of the two) swells a small closed bud,
   which is the "you're close" clue. A full night opens a violet flower in
   about 3 s.
4. **Fruit needs the day back, exactly.** The open flower sets fruit only
   while the soil is **Moist**, the lamp **Bright** and the air **Warm**,
   held for 4 s. The fruit visibly swells and the petals fall. With two of
   the three right, the flower's heart glows ("almost").
5. **Old age** withers the flowers. Turning back to Flowering brings them back.

**Soil physics:**
- Hot air dries the soil one step every 5 s; warm air does so slowly (one step every 25 s).
- Waterlogged soil drains to Wet after 10 s.
- The reservoir holds 14 sprays and refills one spray every 8 s. A solve needs about 6.

**Why it is a puzzle and not a code.** Setting all four "nice" values does
nothing: a lush, healthy plant at Flowering age under bright, warm light never
flowers. The player has to:
- notice that growth uses up the water;
- read the ailments;
- discover that the plant wants a night before it will flower (the moon motifs, the crescent on the dial's flowering station, the half-bud clue, and a gentle nudge after 30 s);
- then return the day with exactly the right warmth, light and moisture.

### A full solution (from the default start: Dry, Low, Cool, Seedling)

| # | Action | Result |
|---|---|---|
| 1 | Water ×2 (Moist), Light → Medium | Good growing conditions (Cool is fine) |
| 2 | Age → Young | Healthy growth; the plant drinks → Damp |
| 3 | Water, Age → Mature | Healthy; → Damp |
| 4 | Water, Age → Flowering | Healthy; → Damp. In cool air a small bud already forms |
| 5 | Light → Low (keep Cool) | Night: the bud swells and the violet flower opens |
| 6 | Water (Moist), Light → Bright, Temperature → Warm | The fruit swells for 4 s → **solved** |

On success:
- the fruit glows;
- the machine pulses gold and steam vents from its pipes;
- the success chime plays;
- **`puzzle_completed("polarity_fruit_key")`** is emitted once;
- every control is locked.

`reset_puzzle()` re-arms everything.

## Tuning

Everything that matters is a named constant at the top of `plant_rules.gd`:

| Constant | Controls |
|---|---|
| `START_*` | Opening state. The scene also has `start_*` exports. |
| `GROW_WATER/LIGHT/TEMP`, `DRINK_PER_GROWTH` | Healthy growth band, and how much the plant drinks per stage |
| `HARM_*`, `HARM_TIME`, `RECOVER_TIME` | Harsh conditions and how forgiving the plant is |
| `NIGHT_LIGHT`, `NIGHT_TEMP`, `BUD_PARTIAL`, `BUD_TIME` | The flowering cue |
| `FRUIT_WATER/LIGHT/TEMP`, `FRUIT_TIME`, `FRUIT_DECAY_RATE` | The final combination |
| `TANK_CAPACITY`, `TANK_REFILL_TIME` | Reservoir size and refill rate |
| `HOT_DRY_TIME`, `WARM_DRY_TIME`, `DRAIN_TIME` | Soil drying and draining |

Run `tests/test_rules.gd` after changing them. The tests encode the intended
solve, the "four good switches is not enough" case, and the recovery paths.

## Integration (unchanged contract)

```gdscript
var room := preload("res://minigames/polarity_machine/PolarityMachine.tscn").instantiate()
room.keyboard_shortcuts = false
room.puzzle_completed.connect(func(reward_id: String) -> void:   # "polarity_fruit_key", once
	inventory.add(reward_id))
room.exit_requested.connect(level_manager.leave_room)
add_child(room)
```

| API | Notes |
|---|---|
| `signal puzzle_completed(reward_id: String)` | Emitted once, the moment the fruit finishes growing. `reward_id == "polarity_fruit_key"`. Controls lock afterwards. |
| `signal exit_requested()` | Esc. The host decides what happens. |
| `func reset_puzzle()` | Back to the start, re-armed. Safe at any time. |
| `func press_water()` | Programmatic button press (for scripted demos). |

**Exports:**
- `keyboard_shortcuts`, `auto_fit_to_viewport`, `use_placeholder_sounds`, `show_intro_text` and `DEBUG` work as before.
- New: `start_water`, `start_light`, `start_temperature` and `start_age`.
- New: `nudge_delay`, the seconds before the one-line nudges at the flowering stage. 0 disables them.

**Other changes from the previous version:**
- The old `start_*` values used a five-state scale for light and temperature. These are now four-state.
- The fallen-fruit and seed-key step was removed. Completion now happens when the fruit grows, as the redesign requires.

**Audio:** every `AudioStreamPlayer` under `Audio/` without a stream gets a
synthesised placeholder. Assign real streams to those nodes to replace them:
`WaterSpray`, `ButtonPress`, `Sputter`, `Drip`, `PlantGrow`, `PlantSick`,
`PlantRecover`, `BudForm`, `FlowerOpen`, `FruitAppear`, `PuzzleSuccess`,
`LeverClick`, `LightShift`, `TemperatureShift`, `AgeShift`, `MachineHum`.

## Testing

```
godot --headless --path <project> --script res://minigames/polarity_machine/tests/test_rules.gd
godot --path <project> --script res://minigames/polarity_machine/tests/play_test.gd -- --capture=/tmp/shots
```

`play_test.gd` needs a window, because it uses real mouse events. It:
1. clicks the button, drags the lever and the sun wheel, scrolls, clicks the gauge and clicks age stations;
2. grows the plant thirsty and nurses it back;
3. overwaters, then dries the soil with heat;
4. tries darkness;
5. shows that four "good" settings do not flower;
6. gives the plant a night and the flower opens;
7. checks a near miss;
8. sets the fruit, and checks that `puzzle_completed("polarity_fruit_key")` fires exactly once;
9. checks that further input is ignored, and that `reset_puzzle()` works.

See `TEST_CHECKLIST.md` for a hands-on pass.
