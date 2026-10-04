# GAME OF GAMES — HUMAN ZOO — "THE EXHIBIT"

A self-contained Godot 4.x (4.3+) gameplay module: a narrative deduction game
where Bill walks a viewing gallery, talks to five people (and one empty cage)
through steampunk communication devices, carries ideas and messages between
them, and slowly wakes the brass machine at the centre of the Human Zoo.

Everything lives under `res://minigames/human_zoo/`. Nothing outside it is
required. Art and audio are generated in code, so there are no assets to import.

```
minigames/human_zoo/
  data/human_zoo_content.json   <- ALL narrative/puzzle content (edit this)
  scenes/HumanZooTest.tscn      <- playable test gallery
  scripts/
    core/   HumanZooGame (orchestrator), State, Database, Conversation,
            Progress, GuidanceController, MachinePuzzle, Conditions, Lines,
            CharacterData / TopicData (Resources), Input
    world/  Enclosure, CommStation, CentralMachine, Pipes, Gallery,
            Symbols (procedural icons), PlaceholderBill
    ui/     HumanZooUI (dialogue/options/thoughts/nudge), ThoughtBoard,
            TuningDial, Vignette
    audio/  HumanZooSfx (procedural clunks, hiss, bells, static, hum)
    HumanZooTestScene.gd, HumanZooTestCamera.gd   <- test scene only
  tests/    test_human_zoo.gd (headless suite), HumanZooBot.gd (auto-play)
```

## Play the test scene

Open the `godot/` folder in Godot 4.3+ and press F5 (the main scene is
`scenes/HumanZooTest.tscn`).

| Key | Action |
|---|---|
| A / D (← →) | walk |
| E / Space / Enter | speak at a microphone, use the machine, advance a line |
| W / S, 1–5, mouse | pick a conversation option |
| Esc | leave a conversation / step back from the machine or dial |
| Tab | Bill's thought board (the folded card) |
| H | accept "NEED A NUDGE?" when it's offered |

At the machine: A/D picks a dial (or the lever), W/S turns the dial, E pulls the lever.

Debug keys (turn off with `HumanZooGame.debug_keys = false`):
F1 guidance overlay · F2 skip the current stage · F3 run guidance timers ×12 · F4 mute.

## How the game is built

**Topics, not items.** Bill carries *facts*: topics (`third_bell`), messages
(`edith_message`, addressed to someone), claims (`liar_order`, unconfirmed
until corroborated), questions (`what_want`) and notes (`desire_king`, which
only appear on the thought board). Topics and flags share one namespace, so a
condition never cares where a fact came from.

**Responses are data.** Each character has a list of entries per topic:

```json
"king_lights": {"lines": ["Of course they go out.", {"pause": 0.8},
                          "That's when the bird comes."],
                "do": {"unlock": ["the_bird"]}}
```

The first unused entry whose `if` holds is played. An entry is *productive* if
its `do` would teach the player something new. That is worked out from the
data, never hand-marked. A topic with no entry falls back to the character's
`fallback` pool (`"{topic}? I invented {topic}."`), so the wrong person always
answers in character. After one dead end the topic disappears from that
microphone until something new becomes available.

**Microphone options.** At most four options plus Leave. Messages for this
person come first, then the newest topics. Productive options outrank filler
when space is tight, but the display order doesn't show which ones they are. NEW and
MESSAGE badges mark fresh topics and deliveries. The station's indicator lamp
glows amber when you're carrying a message for that person.

**Five hidden stages** (`stages[]`). Each has a `complete_when` condition, a
`machine` block (level, symbol lamps, pipe glow), a Bill thought, and authored
`leads`. Stages complete strictly in order, but their facts can be found in any
order: finishing stage 3's facts early simply cascades when stage 2 lands. On
completion the camera visits the machine. CLUNK.

| Stage | Breakthrough | Machine |
|---|---|---|
| 1 Something Is Connected | third bell → King's lights → the bird | a ring turns, BIRD lamp, King's pipe warms |
| 2 Symbol Relationships | child's blocks *or* Sully's version, corroborated by the Accountant's tallies | steam, outer ring starts turning |
| 3 People, Not Symbols | Edith ⇄ King messages expose the time discrepancy; Accountant's tallies can't both be true | gauges wake, steam pulses |
| 4 The Missing Person | seven trays / five people → the empty cage wakes → tune the dial → "Hello, Bill." → "They're telling you what they want." | inner core glows and hums |
| 5 What They Want | ask all six WHAT DO YOU WANT? (each lights that person's pipe and dial) | lever unlocks |

Five lock bolts round the core retract one per stage. The machine never shows a number.

**The third bell is real.** A bell rings every 15 s (`world.bell_interval`). On
every third bell the King's lights fail, a bird flies in and perches on his
bars, the moon lamp lights, and the feeding hand comes down: bird, moon, hand.
If Bill is standing near the King's cage when it happens (and knows about the
third bell), he works out the King's lights himself, which is an alternative route
(`observations[]`).

**Final puzzle** (`puzzle`): six dials, each piped to one enclosure, plus the
lever. The solution is plain data:

```json
"solution": {"king": "EYE", "child": "KEY", "accountant": "MOON",
             "liar": "TREE", "old_woman": "HAND", "empty": "BIRD"}
```

The clues are planted in the world and in the WHAT DO YOU WANT? answers:

- **King → EYE**: "eyes on me", and the eye painted on his throne.
- **Child → KEY**: holds up the key block at the painted door.
- **Accountant → MOON**: "the moon lamp has never once been late", chalked on his wall.
- **Sully → TREE**: "the machine grew a tree once", which turns out to be true.
- **Edith → HAND**: "hold an old woman's hand". There's an empty stool beside her.
- **Voice → BIRD**: "birds remember where they were fed".

To change the mapping, edit `solution`. `solution_notes` is there for the writers.

**Wrong answers are fun and informative.** A failed pull plays one absurd
event from `wrong_events` (bubbles for the King, ping-pong balls for the child,
Edith's chair doing a slow 360, a nightclub for the Accountant, Sully's
microphone at full volume, a biscuit arm, steam taking Bill's hat, the empty
cage playing a waltz). Then come reactions from `feedback`:

- The Accountant always gives the exact count.
- The child points at one wrong dial, and the dial shakes.
- The King claims one dial was right, and he's right about 70% of the time.
- Edith and the voice each say whether *their own* dial is right.
- Sully talks nonsense, except sometimes he doesn't.

Reactions get more generous with each attempt. Dials stay where the player
left them, and nothing learned is ever lost.

## Guidance (`HumanZooGuidanceController`)

The controller tracks the current stage, time since the last discovery, dead
ends, repeated conversations, machine attempts, known topics, productive
pairs and the possible next characters. Its levels:

| Level | Trigger (exported, tunable) | What happens |
|---|---|---|
| 0 natural | a topic is learned | anyone with something new to say about it reacts (looks over, holds up a block, barks "Hm?") |
| 1 behaviour | 3 dead ends or 50 s | the lead character gets restless (bangs mic / waves / taps chart) and their lamp flickers, repeating every 15 s |
| 2 thought | 5 dead ends or 95 s | one short Bill thought ("Edith mentioned the King's lights.") |
| 3 nudge | 8 dead ends or 160 s | NEED A NUDGE? [H] → one contextual hint; asking again on the same lead gives `nudge2` |

Leads are authored per stage (`when` / `until` / `who` / `thought` / `nudge`).
If the authored leads ever run out, it falls back to any productive
(character, topic) pair computed from the data, so the player can't get
permanently stuck. The test suite checks this with randomised play.

## Thought board

Tab opens Bill's folded card. It shows only what Bill has picked up, in
columns from `ledger.columns`:

- **Solid arrows**: confirmed connections.
- **Dotted lines**: claims nobody has corroborated yet.
- **Red cross**: a debunked version (Sully's sequence, once the Accountant has counted it).
- **Red "?"**: a loose thread, where the next connection hasn't been found.

There's also a WHAT THEY WANT row and a CARRYING list of undelivered messages.
Nothing undiscovered is ever drawn.

## Integrating into the real Human Zoo scene

1. Copy `minigames/human_zoo/` into the project as-is.
2. Add a `HumanZooGame` node (script `scripts/core/HumanZooGame.gd`). It loads
   the content, builds the controllers, and adds its own `HumanZooUI` child
   unless you've already given it one.
3. Register world nodes, then call `start()`:
   ```gdscript
   game.register_enclosure(enclosure)      # HumanZooEnclosure, per character_id
   game.register_station(station)          # HumanZooCommStation, per character_id
   game.register_machine(machine)          # HumanZooCentralMachine
   game.register_pipes(pipes)              # optional
   game.register_gallery(gallery)          # optional (bell / bird / moon / hand)
   game.player = $Bill                     # any Node2D
   game.start()
   ```
   The final art can replace any world script as long as it keeps the same
   public methods. For example, an enclosure needs `play_behaviour`, `notice`,
   `bark`, `set_talking`, `lights_out`, `bird_visit`, `perform_action`,
   `play_effect`, `set_glow`, plus `look_target_x` and `presence`.
   `HumanZooTestScene.gd` is a complete example of wiring it all up.
4. **Bill.** The module never controls Bill directly. It reads
   `player.global_position.x` to decide which microphone (or the machine) is
   in reach. It emits `player_lock_changed(locked)` and calls `set_locked()`
   if the node has it. It calls `blast_hat()` if it exists, for the
   steam-hat gag. It emits `machine_mode_changed(active, operator_position)`
   so Bill can step beside the lever and stay clear of the dials.
5. **Camera.** Connect `focus_requested(world_position, zoom)` and
   `focus_released()`. These are used for machine reveals, the wrong-attempt
   gags and the finale.
6. **Input.** The actions `hz_left`, `hz_right`, `hz_up`, `hz_down`, `hz_interact`,
   `hz_cancel`, `hz_board` and `hz_nudge` are created at runtime if missing.
   Define them in the project's Input Map to rebind.
7. **Exit.** Listen for `minigame_completed`. Other signals:
   `conversation_started/ended`, `topic_learned`, `stage_completed`,
   `machine_attempted(solved, correct)` and `puzzle_solved`.
8. **Save / load.** `game.get_save_data()` returns a JSON-safe dictionary.
   `game.load_save_data(d)` restores it and rebuilds the machine's state.

## Authoring cheatsheet (`data/human_zoo_content.json`)

- **Line syntax:**
  - `"text"`: the character speaks.
  - `{"bill": "..."}`: Bill speaks.
  - `{"do": "(stage direction)"}`: narration.
  - `{"pause": 1.2}`: a beat of "...".
  - `{"as": "king", "say": "..."}`: another character, used in reactions.
  - `{"action": "child_blocks", "args": ["BIRD", "MOON", "HAND"]}`: a world action, played in sequence.
- **Conditions:** `"fact"`, `"!fact"`, `["a", "b"]` (all), or
  `{"all": [], "any": [], "none": [], "min_stage": 2}`.
- **Effects:** `{"unlock": [topics], "set": [flags], "consume": [messages]}`.
  Delivering a message to its recipient consumes it automatically.
- One entry list can answer several topics: `"the_machine,symbol_order": [...]`.
- `chat` is each character's small-talk option. Its entries are a natural way
  to hand Bill a message ("Tell the King he's a prick.").
- Mark side quests with `"optional": true` on their topics and chat entries,
  and guidance will never steer toward them.
- Run the test suite after editing. `HumanZooDatabase.validate()` reports
  unknown topics, unreachable facts, broken stage conditions and solution
  typos, and the game prints the same problems as warnings at startup.

**Optional message chains** (none are required): Edith's spoon (completed as
specced: confiscated → why → "tapping it during my address" → "he'll need
something to eat his words with"), Sully's claim to the throne, the King's
census, the Accountant's three-four humming complaint, and the child's
block-picture of Edith ("Tell her the nose is wrong. Don't tell her that.").

## Tests

```bash
# Headless suite: script loading, content validation, guided playthrough,
# 25 randomised "never stuck" runs, alternate routes, dead ends, option counts,
# puzzle feedback, optional chains, save/load.
godot --headless --path godot --script res://minigames/human_zoo/tests/test_human_zoo.gd

# Full automated play-through of the real scene through the real UI
# (optionally with screenshots):
godot --path godot res://minigames/human_zoo/scenes/HumanZooTest.tscn -- --hz-bot --hz-speed=3 --hz-shots=/abs/path
```
