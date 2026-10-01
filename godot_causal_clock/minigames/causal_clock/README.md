# The Causal Clock — Godot 4.3 mini-game

A standalone mechanical puzzle. The player turns the concentric rings of an
ornate, broken clock so that the fragments of a chain line up into a single
unbroken path from the crown (12 o'clock) down to the clock's heart. The rings
are geared together, some links run one way only, some only bite on part of
a turn, and you have two locking pins to hold rings still. Solving it means
reasoning about cause and effect, not clicking until something works.

All narrative content (labels, dates, icons, video clips, text) lives in data
files and can be swapped without touching code. Everything currently in them
is placeholder.

```
minigames/causal_clock/
  scenes/   causal_clock_title.tscn   entry screen (Begin / Prelude / Quit)
            causal_clock_game.tscn    the puzzle (main layout by default)
            causal_clock_prelude.tscn the small 3-ring tutorial layout
  scripts/  logic/    rules, state, puzzle session, solver   (no nodes, no drawing)
            view/     procedural rendering of the artifact     (no rules)
            content/  memory library (narrative data loader)
            ui/       HUD, memory reveal card, menus, theme
            audio/    synthesized placeholder sounds + override hooks
            causal_clock_game.gd   controller that wires the layers, exposes signals
  data/     layouts/*.json        puzzle definitions
            memories/*.json       swappable narrative content
            audio_events.json     optional sound-file overrides
  ui/       *.tscn wrappers for the HUD, reveal card and menus
  art/      shaders/, icons/ (placeholder SVGs), video/ (drop .ogv clips here)
  audio/    drop real sound files here
  tests/    run_tests.gd, smoke_test.gd, analyze_layout.gd
```

---

## Running it

1. Open `godot_causal_clock/project.godot` in **Godot 4.3** (it uses
   the Compatibility renderer for broad hardware support).
2. Press **F5**. The title scene opens. **Begin** starts the main puzzle;
   **Prelude** is a 3-ring warm-up that teaches gears and pins in about
   8 moves.

To run a scene directly, open `scenes/causal_clock_game.tscn` and press F6.

### Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Turn a ring | drag it around, or scroll over it | ← / → (or A / D) turns the selected ring |
| Select a ring | click it | ↑ / ↓ (or W / S), or 1–5 |
| Pin / unpin | right-click the ring, or click its socket on the lock rail | Space |
| Undo | Undo button | Z / Backspace |
| Reset to start (undoable) | Reset button | R |
| Hint | Hint button | H |
| Mechanism notes (the rules) | button | N / F1 |
| Pause / leave | Pause button | Esc / P |
| Mute | — | M |

Hovering a ring shows what *would* happen if you turned it clockwise. Blue
arrows mean that ring would turn clockwise, amber means anticlockwise. A
red ✕ means the turn would jam. This readout is what makes the mechanism
learnable without trial and error.

---

## How the puzzle works

### The path

Each ring carries chain **segments** in local "slots" (a ring with 8
positions has slots 0–7, 45° apart). A segment enters at the ring's outer
edge at slot `out` and leaves through the inner edge at slot `in`. Segments
with `-1` at one end are broken fragments (dead ends and decoys).

The chain is traced from the **entry** (a fixed angle on the frame) inward.
At each ring it looks for a segment whose outer port sits at the current
angle, follows it to its inner port, and continues into the next ring. It
ends either at a gap (the break is marked by a flickering ember) or in a
**socket** of the central hub.

**Win detection** (`CausalClockMechanism.trace_chain`): the puzzle is solved
when this trace reaches a hub socket. *Chain depth* is the number of rings
the trace fully crosses, and drives the HUD gauge, the chimes and the
milestones.

### Ring coupling: the ruleset

These rules are implemented in `scripts/logic/clock_mechanism.gd` and
explained to players in the in-game Mechanism notes:

1. **Turning.** The player turns one ring one step clockwise or
   anticlockwise. Pinned rings cannot be turned. The heart cannot be turned
   by hand (`manual: false`).
2. **Gears.** A coupling links two elements. When `a` turns `d` steps, `b`
   turns `d × ratio` steps (`-1` means the opposite direction). Motion
   spreads breadth-first through every connected coupling, so turning one
   ring can move a whole train. On screen, each driven ring starts a beat
   after the one driving it, so you can see cause before effect.
3. **Ratchets** (`one_way: true`). Only `a` drives `b`; `b` never pushes
   back. These are drawn as copper gears with a pawl and an arrow.
4. **Cams / toothed arcs** (`cam`). The link only bites while one of the
   listed sectors of the cam ring sits under the gear. Engagement is read
   *before* the turn. A lamp beside the gear shows it. Rocking a cam ring
   back and forth across the edge of its teeth is a real technique.
5. **Pins.** A pinned ring never moves. A gear trying to drive it **slips**
   (sparks and a rattle), and motion does not pass through it to rings
   beyond.
6. **Jams.** If two gear paths try to drive the same element by different
   amounts, the mechanism jams and refuses the turn (nothing moves). A pin
   that breaks one of the paths frees it. This is how "ring X can only turn
   if Y is pinned" arises naturally rather than as a special case.

### Locking pins

`pin_count` reusable pins (2 in the main puzzle). Pins sit in sockets on the
fixed **lock rail**. Each `pinnable` ring has one at `pin_angle_deg`. Pins
are what turn a spinning toy into a puzzle: they split gear trains, protect
work you've already aligned, and resolve jams, and you never have enough of
them.

### The default puzzle and its difficulty curve

The main layout (`data/layouts/default_layout.json`) uses 5 rings × 8
positions, a driven heart, and 6 couplings:

| Link | Type | What the player learns |
|---|---|---|
| A ⇄ B | two-way gear, reverses | "If I move this, that one shifts too." |
| B → C | ratchet | "C follows B, but I can adjust C freely." |
| C ⇄ D | two-way, cam on C (half the ring has teeth) | "It only bites on part of the turn; watch the lamp." |
| D ⇄ E | two-way gear, reverses | "Pin D before working on E." |
| E → Heart | ratchet | "The heart follows E…" |
| B → Heart | long shaft, reverses, cam on B | "…and B's shaft also drives the heart. Both at once: a jam." |

Measured with the included solver (`tests/analyze_layout.gd`):

- **Optimal solution: 16 moves** (pins count as moves), proven by
  exhaustive search over 2.2M states. About 7.6% of random unpinned turns
  jam.
- **A methodical player** who extends the chain one ring at a time needs
  about 19–23 moves. The stages cost 3 / 4 / 1 / 2 / 3 / 6 moves: easy
  outer rings, a pin lesson at B, and a final stage where the heart only
  lines up if you either set it early through B's shaft or rock B across
  its cam. That last stage is the "aha".
- Starting positions were chosen so the chain is broken at the very first
  junction, and so every pin-free start position is solvable (checked
  exhaustively during design).

There is deliberately **no tension/instability meter**. Jams already
punish careless turns with clear, local feedback, and undo makes recovery
cheap. A timer-like pressure would push players back towards trial and
error, which is the opposite of the goal.

### Hints

The Hint button runs a breadth-first search on a worker thread
(`CausalClockSolver.hint`) for the **shortest way to make the chain one ring
longer** from the current state. It then highlights the first step ("Pin
Ring A", "Turn Ring B anticlockwise"). Pressing Hint again while following
that plan reuses it. Following hint after hint finishes the puzzle from the start position (tested).

---

## Authoring layouts

Layouts are JSON. Copy `default_layout.json`, edit it, and point the game at
the new file (`CausalClockGame.layout_path`, or the inspector on
`causal_clock_game.tscn`). The format:

```jsonc
{
  "id": "my_layout",
  "title": "…", "subtitle": "…",
  "result_id": "causal_clock_complete",     // emitted by puzzle_completed
  "entry_angle_deg": 0,                      // where the chain enters (clockwise from 12)
  "pin_count": 2,
  "intro_lines": ["…", "…", "…"],            // the light tutorial prompt
  "rings": [                                 // OUTERMOST FIRST; any count >= 1
    {
      "id": "A", "label": "Ring A",
      "positions": 8,                        // discrete stops per turn (2..64)
      "start": 3,                            // scrambled starting position
      "material": "iron",                    // iron brass walnut enamel silver bone gold copper
      "ornaments": ["rivets", "hammered"],   // rivets ticks numerals grain inlay_dots filigree glyphs hammered
      "mass": 1.8,                           // heavier = slower, lower, weightier (visual/audio only)
      "pinnable": true, "pin_angle_deg": 247.5,
      "segments": [
        { "out": 0, "in": 3, "lane": 0.5 },  // through-segment; lane = arc depth in band
        { "out": 5, "in": -1 },              // broken fragment (decoy)
        { "out": 0, "in": 6, "marker": "moment_1" }  // medallion on the chain
      ]
    }
  ],
  "hub": { "id": "H", "label": "Heart", "positions": 8, "start": 1,
           "manual": false, "sockets": [0] },
  "couplings": [
    { "id": "g1", "a": "A", "b": "B", "ratio": -1, "angle_deg": 67.5 },
    { "id": "r1", "a": "B", "b": "C", "ratio": 1, "one_way": true, "angle_deg": 202.5 },
    { "id": "c1", "a": "C", "b": "D", "ratio": -1, "angle_deg": 337.5,
      "cam": { "ring": "C", "teeth": [0, 1, 2, 3] } }
  ],
  "milestones": [
    { "id": "m1", "trigger": { "type": "chain_depth", "value": 2 },
      "memory_id": "moment_1", "presentation": "toast" },
    { "id": "m_end", "trigger": { "type": "complete" },
      "memory_id": "moment_4", "presentation": "card" }
  ],
  "reference_solution": ["A+", "pin:B", "C-"]  // optional; tests verify it
}
```

Rules of thumb:

- **Put gears between slot angles** (for 8 positions: 22.5°, 67.5°, …) so a
  gear never hides a junction. A cam reads the sector under its gear: sector
  `k` spans local slots `k`…`k+1`.
- Two-way links must have ratio ±1. Larger ratios are allowed one-way.
- **Cycles** in the coupling graph create jam conditions: two paths into the
  same ring with different net ratios. Use them on purpose.
- If the hub is fixed (not manual and not driven), the segment offsets must
  add up exactly; the validator warns you.
- Different rings may have different `positions`. Alignment is compared by
  angle, so ports only meet where the angles coincide.
- Ring count, positions, pins, couplings, start state, milestones and the win
  target (the hub sockets) are all data.

**Check every layout with the analyzer:**

```
godot --headless --path . --script res://minigames/causal_clock/tests/analyze_layout.gd -- res://minigames/causal_clock/data/layouts/my_layout.json
```

It validates the file, replays `reference_solution`, prints the hint route
stage by stage (your difficulty curve), searches for the optimal solution
(`--budget=N` states) and reports the jam rate. Aim for a hint route whose
stages rise gently and end with the hardest one, and an optimal length well
below the hint route. That gap is where insight pays off.

---

## Replacing placeholder content (dates, icons, text, videos)

Narrative content is entirely in `data/memories/placeholder_memories.json`:

```json
{ "memories": [
  { "id": "moment_1",
    "label": "Moment 1",
    "date_text": "Date placeholder I",
    "icon_path": "res://minigames/causal_clock/art/icons/placeholder_moment_1.svg",
    "video_path": "res://minigames/causal_clock/art/video/moment_1.ogv",
    "description_text": "…" } ] }
```

- **Text and dates:** edit `label`, `date_text`, `description_text`
  (BBCode is allowed in the description).
- **Icons:** put any image Godot imports (png/svg/webp…) anywhere under
  `res://` and set `icon_path`. Icons appear on the memory shelf, on the
  reveal card and on chain medallions (segments with a `marker`). With no
  icon, a generic medallion is drawn.
- **Videos:** drop an **Ogg Theora `.ogv`** clip (Godot 4's native video
  format; convert with `ffmpeg -i in.mp4 -c:v libtheora -q:v 7 -c:a libvorbis out.ogv`)
  and set `video_path`. If the file is missing or unreadable, the card
  shows an animated film-frame placeholder with the expected path, so
  nothing breaks.
  `moment_1.ogv` is referenced but intentionally absent, to show this.
- **Which memory appears when:** that's the layout's `milestones`
  (`chain_depth`, `segment_linked`, `complete`), with `presentation` set to
  `toast` (non-blocking notice; the player can open it), `card` (modal) or
  `silent` (signal only). Memories, once recovered, stay on the shelf and
  can be re-opened.
- To use a different file, set `memories_path` on the game node. Host code
  can also add entries at runtime with
  `CausalClockMemoryLibrary.add()`. Unknown keys in a memory are kept in
  `memory.extra` for your own use.

**Audio:** every event (`ring_rotate`, `gear_engage`, `gear_slip`,
`pin_place`, `pin_remove`, `invalid`, `align_chime`, `chain_break`,
`milestone`, `complete`, `ui_click`, `tick`, `ambient`) has a synthesized
placeholder. To replace one, set its `path` in `data/audio_events.json`, or
call `audio.set_override(event, stream)`.

---

## Embedding in a larger project

1. Copy the `minigames/causal_clock/` folder into your project
   (same path, `res://minigames/causal_clock/`). The folder has no
   autoloads, input-map entries or project-setting dependencies. Input is
   read directly and the UI theme is built in code.
2. Instance `res://minigames/causal_clock/scenes/causal_clock_game.tscn`
   (as a scene change or as a child of your own scene), and configure it:

```gdscript
var clock: CausalClockGame = preload("res://minigames/causal_clock/scenes/causal_clock_game.tscn").instantiate()
clock.layout_path = "res://minigames/causal_clock/data/layouts/default_layout.json"
clock.memories_path = "res://story/bill_memories.json"   # your content
clock.standalone = false                                  # don't jump to the title scene on exit
clock.puzzle_completed.connect(_on_clock_done)            # (result_id: String)
clock.milestone_reached.connect(_on_clock_milestone)      # (milestone_id, memory_id)
clock.memory_revealed.connect(_on_memory_shown)           # (memory_id)
clock.exit_requested.connect(func(): clock.queue_free())
add_child(clock)

func _on_clock_done(result_id: String) -> void:
	# result_id == "causal_clock_complete" for the default layout
	pass
```

- `puzzle_completed(result_id)` fires the moment the chain reaches the
  heart (before the final reveal plays). `result_id` comes from the layout.
- `set_paused(true)` blocks puzzle input (e.g. while your own dialogue is
  up). `apply_step("B-")` / `apply_step("pin:A")` drive the clock from
  script (cutscenes, demos).
- Game-wide state you might want: `puzzle.move_count`, `hints_used`,
  `puzzle.reached` (the milestone ids recovered).
- The game uses CanvasLayers −10 (background), 5 (light rays and dust) and
  10 (UI). Renumber them in `ambient_layer.gd` / `causal_clock_game.gd` if
  they clash with yours.

---

## Tests and verification

From `godot_causal_clock/`:

```
godot --headless --path . --import
godot --headless --path . --script res://minigames/causal_clock/tests/run_tests.gd
godot --headless --path . --script res://minigames/causal_clock/tests/smoke_test.gd
```

- `run_tests.gd`: 70 logic checks covering parsing and validation, gears,
  ratchets, cams, pins and slipping, jams, undo/reset, both reference
  solutions, milestone order, hint-guided solving and optimality of the
  prelude.
- `smoke_test.gd`: boots the real title and game scenes. It drags, scrolls
  and right-clicks with synthetic mouse input, checks hint, undo, jam and
  slip, plays the full solution, and asserts the `puzzle_completed`,
  `milestone_reached` and `memory_revealed` signals, the final card and the
  completion panel. With a display, `-- --capture=/some/dir` saves
  screenshots of every stage.

## Architecture summary

| Layer | Files | Knows about |
|---|---|---|
| Puzzle logic | `scripts/logic/*` | JSON layout → typed defs; pure rules; session (history, milestones); BFS solver |
| Rendering | `scripts/view/*`, `art/shaders/*` | geometry, materials, animation; reads logic results, never mutates state |
| Content | `scripts/content/memory_library.gd`, `data/memories/*` | memory records only |
| Reveal / UI | `scripts/ui/*`, `ui/*.tscn` | HUD, toasts, memory card, menus |
| Controller | `scripts/causal_clock_game.gd` | wires the above; public signals and API |
