# THE BEAST TENDING

A self-contained mini-game for **Game of Games**, built in **Godot 4.3+**
(GDScript, GL Compatibility renderer, no external assets: every visual and
every sound is procedural).

Bill has been asked to tend to an enormous creature. You only ever see
close-up parts of its body, which stretches out like a landscape. You learn
what it likes from how it reacts. There are no buttons, meters or
instructions.

## Running it

1. Open `beast_tending/project.godot` in Godot 4.3 or newer.
2. Press **F5**.

## Controls

| Input | Effect |
|---|---|
| Left mouse | Bill's hand. The game reads *how* you touch: poke, hold, stroke, rub, scratch, rhythmic tapping |
| A / D, ← / →, mouse wheel, right/middle drag, or resting the hand at a screen edge | Move along the beast |
| F1 or ` | Debug overlay (recognised gesture, region, judgement, hidden satisfaction, stage) |
| F2 / F3 / F4 (debug only) | Skip stage / force a hint / restart |
| M | Mute |
| Esc | Show/hide the system cursor |

## How it fits together

```
scenes/main.tscn            the whole game; every tunable node is in here
scripts/main.gd             routes gestures -> region -> judgement -> reaction

scripts/core/
  gesture.gd                one recognised touch (type, speed, frequency, ...)
  gesture_recognizer.gd     reusable mouse/touch -> gesture classifier
  body_region.gd            base class: preferences, scoring, physical state
  game.gd (autoload)        shared refs, surface contour, helpers
  paint.gd, glow_layer.gd   procedural drawing helpers

scripts/regions/            the six places on the beast
  soft_fold.gd  great_flap.gd  luminous_nodules.gd
  fur_patch.gd  whisker_field.gd  mystery_crevice.gd

scripts/beast/
  tending_sequence.gd       the hidden five-stage puzzle, hints, climax
  beast_mind.gd             pleasure / irritation / satisfaction / mood
  beast_body.gd             breathing, heaving, thumps; turns judgements into reactions
  beast_terrain.gd          the continuous hide (shaders/skin.gdshader)
  beast_decor.gd            eyes, tendrils, mushrooms, scales, scars, loose objects
  beast_eye.gd

scripts/world/              parallax depth: far flank, mid ridge, foreground hairs
scripts/audio/              Synth (offline synthesis) + BeastVoice (one-shots + live breath/heartbeat bed)
scripts/bill/               BillHand (cursor) + BillSilhouette (placeholder Bill)
scripts/ui/                 screen effects, debug overlay, title/end cards
shaders/                    skin, sky, hide detail, vignette
tests/                      headless playthrough test, screenshot tour, sound export
```

Each touch flows like this: `GestureRecognizer` emits a `Gesture` →
`main.gd` finds the `BodyRegion` under the hand → `TendingSequence.judge()`
returns a level (WRONG, neutral, CLOSE, GOOD, VERY GOOD, or the red-herring
level) → `BeastMind.apply()` updates the hidden state → `BeastBody.present()`
makes the region, the body, the eyes, the tendrils, the camera and the voice
react.

**Escalation** (0..1, from `BeastMind`) drives everything else continuously:
breathing rate and depth, heartbeat tempo, drone volume, rocking, objects
shaking, falling dust, the offscreen thumping limb, glowing veins, Bill's
balance and the vignette.

## Tuning

Everything is exported to the Inspector in `scenes/main.tscn`:

- **GestureRecognizer**: poke/hold/stroke/rub/scratch/rhythm thresholds.
- **Each region**: preferred gesture, speed and tolerance, intensity,
  direction, rhythm, disliked gestures, sensitivity, irritation threshold,
  pleasure contribution, hit area.
- **TendingSequence**: hint delay, per-stage speeds, durations, beat interval
  and tolerance, combo cycles, finish band.
- **BeastMind**: pleasure/irritation rates and decay, shift-away threshold.
- **BeastBody**: breathing range, thump threshold and tempo.

## Replacing placeholder art and sound

- **Bill's hand**: set `pose_textures` on `UI/Hand` (POINT, FLAT, CLAW,
  PRESS → Texture2D) and `texture_hotspot`.
- **Bill**: set `custom_texture` on `UI/Bill`, or swap the node for a sprite
  with the same `brace()`, `startle()` and `sit()` methods.
- **Regions**: override `_draw()` or add sprites as children. The gameplay
  contract is `contains()`, `zone_at()`, `evaluate()` and `react()`.
- **Sounds**: drop `res://audio/<name>.wav` or `.ogg` into the project to
  replace any synthesised sound (names are listed in `Synth.NAMES`).

## Tests

```bash
# Gesture unit checks + a full simulated playthrough (red herring, all five
# stages, climax, ending). Exit code 0 on success.
godot --headless --path . --fixed-fps 60 res://tests/playthrough_test.tscn

# Screenshots of every region and stage into tests/out/ (needs a display or xvfb-run).
godot --path . --fixed-fps 30 res://tests/screenshot_tour.tscn

# Render every synthesised sound to tests/out/audio/*.wav.
godot --headless --path . -s tests/export_sounds.gd
```

<details>
<summary><b>Solution (spoilers, for the team)</b></summary>

1. **Trust**: stroke the Soft Fold slowly along its length, starting in the
   middle where you begin. Lift between strokes. Pokes and scratches anywhere
   startle it.
2. **Discovery**: the Great Flap (to the left) unfolds. Scratch the pale downy
   patch underneath it. Rubbing the base is liked but not enough. Poking the
   flap is disliked.
3. **Rhythm**: the Luminous Nodules (to the right) start pulsing. Tap them in
   time with the pulse (about 0.6 s, with generous timing). Random tapping
   does not count.
4. **Combination**: scratch the Fur Patch, rub the Great Flap, then make a
   long sweep across the Whisker Field. Do the cycle twice. The eyes and
   tendrils show where it wants you next.
5. **Finish**: scratch the Fur Patch steadily, not too fast and not too slow,
   for about ten seconds. The pace it wants rises slightly as it builds.

**The Mystery Crevice**: poking it gets a spectacular bellow, a crash and
shaking. It also annoys the beast and sets back progress. After the third
poke the beast moves it out of reach.

If nothing has improved for about 22 seconds, the beast physically points at
the area it wants.
</details>
