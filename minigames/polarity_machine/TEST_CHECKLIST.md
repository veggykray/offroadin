# Polarity Machine: test checklist

Open `res://minigames/polarity_machine/PolarityMachine.tscn` and run it with F6.

**Keys:**
- Q / W: temperature
- A / S: light
- Z / X: age
- E: open or collect the fruit
- R: reset
- F3: debug readout (use it to confirm the state; turn it off again for visual checks)

For each continuum test, hold the other two at the **baseline**: Temperature TEMPERATE, Light SOFT, Age MATURE. One exception: the light tests use Temperature WARM, so the plant has a healthy posture to react from.

Wait about 1.5 s after each change for the room to finish gliding.

---

## A. Temperature (5 states)

| ✓ | State | Must see (each one distinct from its neighbours) |
|---|---|---|
| ☐ | **FREEZING** | Water vessel is solid ice with fracture lines and trapped bubbles; frosted glass. Frost crystals grow in from the room edges. Icicles hang from the ceiling pipe. Rime on the pipes and rail. Ice motes fall and icy fog crosses the floor. Blue tint. The plant is pale and rimed, stiff with no sway. Machine core is icy blue and frosted. The lever knob bristles with frost. |
| ☐ | **COLD** | Ice floes bob on liquid water. Condensation droplets slide on the wall and glass. Lighter frost at the edges. A few ice motes. Cool tint. The plant droops clearly. |
| ☐ | **TEMPERATE** | No frost. Still liquid with a calm surface and an occasional bubble. Neutral colour. The plant has a reasonable, healthy posture. |
| ☐ | **WARM** | Gentle rising bubbles. Warm amber cast near the floor. A few rising motes. Slight heat haze. Machine core is amber. The plant is upright and vigorous with its leaves lifted. |
| ☐ | **SCORCHING** | Rolling boil, a visibly lower water level, and steam from the vessel cap. Strong heat haze. Ceiling and floor pipes glow orange, and so do the lamp rim, the chimneys and the core ring. Embers rise. The room is orange. The plant wilts, with blackened, curling leaf tips. The lever's knob and right end glow red-hot. |

## B. Light (5 states; Temperature WARM, Age MATURE)

| ✓ | State | Must see |
|---|---|---|
| ☐ | **DARK** | The room is nearly black. The lamp iris is closed. Still visible: the red pilot light on the lamp, the machine's indicator jewels, the core glow, and the lit glyphs on the controls. The machine itself is dimmed but usable. The plant's leaves are folded shut against the stem. There is no shadow. |
| ☐ | **DIM** | Gloomy, heavy vignette, a pinhole beam, and a **long** sheared plant shadow on the wall. The plant looks weak and droopy. |
| ☐ | **SOFT** | Subdued, normal illumination, a half-open iris, and a moderate beam and shadow. The plant is healthy, not thriving. |
| ☐ | **BRIGHT** | Strong, pleasant light, a wide iris and a full beam. The shadow is **short and crisp**. The plant leans toward the lamp (left) with its leaves fully open. |
| ☐ | **BLAZING** | Overexposed, with a white wash over the room, flare rays and ghost rings from the lamp. The plant is bleached pale and its leaves curl. The plant must still be visible through the glare. |

## C. Age (5 states; Temperature TEMPERATE, Light SOFT)

| ✓ | State | Must see |
|---|---|---|
| ☐ | **NEW** | The plant is a split seed in the soil with a tiny hooked shoot and a faint glow. The wall paint is glossy with sheen bands, the lattice is bright, and the wood is rich red. Brass is bright. The age dial points at the seed pictogram. |
| ☐ | **YOUNG** | A small green shoot with a few pale leaves and no branches. Slight wear and the first faint scuffs. |
| ☐ | **MATURE** | A full adult plant with a brown stem, side branches and many teal leaves. Normal wear. |
| ☐ | **OLD** | The plant is larger, gnarled and fissured with knots, its leaves yellowing from the bottom. Wall stains and peeling patches appear. Brass is tarnished, with verdigris on the pipes and trim. The dial face yellows. The age rings spin faster. |
| ☐ | **ANCIENT** | The plant is grey, twisted and almost leafless, with dead twigs. Cracks have grown across the wall. Cobwebs in the corners, a dusty floor and dust motes in the beam. Heavy corrosion. A crack in the vessel glass. The dial face is crazed, but the machine still works. |

☐ All 15 states above are distinguishable **without** the debug readout.

## D. Growing the fruit

- ☐ Set MATURE + WARM + BRIGHT, in any order. The machine pulses (green ring), then:
  - ☐ the plant straightens and its leaves lift
  - ☐ a bud forms
  - ☐ it opens into a violet star flower with a gold heart (violet flash)
  - ☐ the petals wither and fall
  - ☐ a green, ribbed fruit swells
  - ☐ the machine vents steam from its chimneys
- ☐ Near-misses on a mature plant: TEMPERATE + BRIGHT, WARM + SOFT and TEMPERATE + SOFT each show a **closed bud only**. Moving to WARM + BRIGHT opens it.
- ☐ Leaving the ideal settings mid-bloom makes the bud/flower recede. It does not pop away.
- ☐ Clicking the hanging fruit shows "Hard and green. It is not ready."
- ☐ Leaving the green fruit hanging for 30 s shows the time hint, once.

## E. Ripening the fruit

- ☐ AGE → OLD, with temperature TEMPERATE/WARM and light SOFT/BRIGHT: the plant visibly ages. The fruit turns green → orange → crimson with gold ribs, swells and starts to glow (red flash). It trembles, then drops with two small bounces and a thud.
- ☐ AGE → OLD with DARK or BLAZING light: ripening pauses. Restoring the light resumes it.
- ☐ Ripening at MATURE never happens (the fruit stays green).

## F. Destroying the fruit (no permanent failure)

- ☐ Hanging fruit, AGE → ANCIENT: the fruit browns and shrivels, falls, and crumbles to dust.
- ☐ Hanging fruit, Temperature → FREEZING (or SCORCHING) for about 5 s: the fruit frosts (or blackens), then falls and shatters into pale (or black) dust.
- ☐ Same as above, but restore within about 3 s: the fruit recovers.
- ☐ Hanging fruit or mid-bloom, AGE → YOUNG or NEW: the fruit shrinks back into a flower, then a bud, then nothing.

## G. Regrowing the fruit

- ☐ After each destruction case in F, returning to MATURE + WARM + BRIGHT grows a new fruit.
- ☐ No new bloom starts while a fruit is lying on the floor or the key is waiting.

## H. Opening the fruit and completing the puzzle

- ☐ The fallen fruit pulses with a glow, and brightens on hover.
- ☐ Clicking it splits it into halves showing pale flesh and seeds, with juice droplets. A brass seed-key rises.
- ☐ Clicking the key: it spins up in a golden burst, the machine pulses, the room flashes, the success chime plays, and "The machine exhales, and falls quiet." appears.
- ☐ `puzzle_completed("polarity_fruit_key")` is emitted exactly once. Connect a print to check.
- ☐ After completion, no new fruit grows even at the ideal settings. The controls still move.
- ☐ Alternative: leave the fallen fruit on the floor and set ANCIENT. It rots away, leaving a **tarnished** key that can still be collected.

## I. Resetting

- ☐ Press R (or call `reset_puzzle()`) at each stage: mid-bloom, fruit hanging, fruit on the floor, key showing, and completed. Each time the room returns to COLD / DIM / YOUNG instantly, the handles snap back, the fruit and key are gone, and the puzzle can be completed again.

## J. Controls and feel (mouse)

- ☐ Each handle can be dragged. It is notchy, and a click plus a jolt fires at every detent passed.
- ☐ On release the handle springs onto its detent with a small overshoot.
- ☐ Clicking a point on a track jumps the handle there.
- ☐ The mouse wheel over a control steps it one detent.
- ☐ Releasing the mouse outside the window does not leave a handle stuck.
- ☐ Hovering a handle shows a warm highlight.
- ☐ The light wheel and age crank never wrap from one end to the other when dragged past the bottom dead-zone.
- ☐ No numbers appear anywhere in normal play.

## K. Changing controls rapidly

- ☐ Mash Q/W/A/S/Z/X, or drag the handles back and forth quickly. The room glides through the intermediate states without popping or errors, sounds don't pile up badly, and no fruit gets stuck half-formed. It recedes if conditions are no longer met.

## L. Odd combinations (spot checks)

- ☐ FREEZING + BLAZING + ANCIENT: a frozen, bleached, dead plant in an ancient room. Still readable.
- ☐ SCORCHING + DARK + NEW: a seed in a dark, orange-tinted room, with the steaming vessel visible near the pilot light.
- ☐ COLD + BRIGHT + OLD: a drooping, frosted old plant in strong light.
- ☐ WARM + DIM + MATURE: a healthy plant straining in the gloom, with a long shadow and no bud.
- ☐ Clicking the plant in each case shows a sensible observation line.

## M. Integration and layout

- ☐ Window sizes 1280×720, 1920×1080 and 2560×1440 all scale the whole puzzle onto one screen. A non-16:9 window is letterboxed.
- ☐ The debug label is hidden by default. F3 toggles it.
- ☐ Esc emits `exit_requested`.
- ☐ `keyboard_shortcuts = false` disables Q/W/A/S/Z/X/E/R/F3 but not Esc.
- ☐ Assigning a real stream to any `Audio/*` node overrides its placeholder.
