# Talking Door

A door with a living face in it. The eyes follow Bill, it blinks on its own, it changes expression, and it talks with lip sync that follows the audio. The face stays on the door in the game world. There is no separate dialogue screen.

Works in **Godot 4.3 and newer** (tested on 4.3 and 4.5.1, Compatibility renderer).

```
res://interactables/talking_door/
├── TalkingDoor.tscn / .gd        ← the door you place in levels (proximity, interaction, opening)
├── TalkingDoorFace.tscn / .gd    ← the reusable face rig (eyes, blinks, expressions, lip sync)
├── DoorCharacterData.gd          ← personality + dialogue resource (one .tres per door character)
├── characters/
│   ├── weary_door.tres           ← the test door (has voice audio)
│   └── nervous_door.tres         ← example 2nd personality (no audio yet; mouth driven by text)
├── dialogue/
│   ├── DialogueLine.gd           ← one line/beat: text, audio, expression, pauses, [acting tags]
│   └── DoorDialogueRunner.gd     ← plays lines on the face
├── face/
│   ├── FaceExpression.gd / FaceExpressionSet.gd / default_expressions.tres
│   ├── FaceEye.gd, FaceBrow.gd   ← per-part rigs (all the artwork-specific numbers live here)
│   ├── MouthPose.gd              ← mouth shapes (REST, SMALL_OPEN, WIDE_OPEN, ROUND, NARROW, SMILE_OPEN, FROWN_OPEN, PRESSED)
│   ├── MouthRig.gd               ← base class for mouths
│   ├── ProceduralMouth.gd        ← placeholder mouth drawn in code
│   └── SpriteMouth.gd            ← mouth made from your own drawings (one per shape)
├── lipsync/
│   ├── LipSyncDriver.gd          ← interface the face listens to
│   ├── AmplitudeLipSync.gd       ← mouth from the audio's loudness + tone
│   └── VisemeTrackLipSync.gd     ← timed mouth shapes (from text, or from Rhubarb Lip Sync)
├── art/                          ← placeholder SVGs (replace freely)
└── audio/weary_door/             ← placeholder voice lines (robot TTS, replace with real VO)
```

The test scene is in `res://tests/talking_door/` and is not needed by the door.

---

## 1. Running the test

1. Open Godot. In the **Project Manager**, click **Import**, pick `game_of_games/project.godot` and click **Import & Edit**.
2. Press **F5** (or the ▶ "Run Project" button at the top right). The test scene is the main scene.
   To open it by hand: in the FileSystem dock, double-click `tests/talking_door/TalkingDoorTest.tscn` and press **F6** (Run Current Scene).

| Key | What it does |
|---|---|
| **A / D** or **← / →** | Move Bill |
| **E** or **Space** | Interact (when "E  Talk" shows next to the door) |
| **1 – 8** | Force an expression: idle, curious, happy, annoyed, suspicious, sad, surprised, asleep |
| **O** | Open / close the door |
| **T** | Play a test line (cycles through all the door's lines) |
| **R** | Reset the conversation (greeting will play again) |
| **G** | Show the detection / interaction ranges on the floor |
| **F1** | Hide / show the debug panel |

**What to try:**

1. Start on the left. The door ignores Bill, but now and then it glances his way.
2. Walk right until it **notices** him (about 560 px away). Its eyes jump to him and its brows lift. After that it follows him.
3. Walk past the door to the other side. The eyes and the face turn to follow.
4. Stop in front of it. It plays the **greeting**: it pauses, becomes curious, says *"Oh. You're back."*, looks Bill up and down, says *"At least… I think you're back."*, becomes suspicious, and says *"You are Bill, aren't you?"*
5. Press **E** a few times. The door gets more irritated each time. On the 4th press it gives in and **opens**.
6. Walk away. It mutters, watches Bill leave for a few seconds, then sighs and goes back to idle. If Bill stays away for about 30 seconds, it falls asleep. Come back and it wakes with a start.

**Automated check** (optional, from a terminal): `godot --path game_of_games -- --autotest` walks Bill through all of this and prints PASS/FAIL. Add `--shots=/some/folder` to also save screenshots.

---

## 2. Adding dialogue audio

The voice lines that ship with the project are robot TTS placeholders in `audio/weary_door/`. To use a real recording:

1. Drag your `.wav` or `.ogg` file into `res://interactables/talking_door/audio/<door name>/` in the **FileSystem** dock.
2. **Recommended for WAV:** click the file, open the **Import** tab (next to the Scene tab, top left), set **Compress → Mode** to **Disabled**, and click **Reimport**. Uncompressed WAVs are analysed in advance, which gives the most accurate lip sync, and the mouth moves a few milliseconds before the sound, which looks better. OGG and compressed WAV files still work. They are analysed live while they play.
3. Double-click `characters/weary_door.tres`. The **Inspector** shows the character.
4. Open **Dialogue → Greeting** (or **Interact Responses**, etc.), expand a line, and drag your audio file into its **Audio** slot.
5. Edit the **Text** to match what is said. It is also the subtitle.

That's all. You don't need to change any code. To replace the existing placeholder lines, you can also just overwrite the files in `audio/weary_door/` and keep the same names.

### Each line (DialogueLine) has

| Field | Meaning |
|---|---|
| **Text** | The subtitle. Can contain acting tags (below). Leave it empty for a silent acting beat. |
| **Audio** | The WAV/OGG for this line. If empty, the mouth is animated from the text. |
| **Lip Sync Cues** | Optional. A Rhubarb Lip Sync export for this audio (see §7). |
| **Expression / Expression Intensity** | The expression to switch to when the line starts. Intensity 0.5 means "half annoyed". |
| **End Expression** | The expression to switch to when the line ends. |
| **Delay Before / Hold After** | The pause before the line starts and after it finishes. The pauses matter for timing. |

### Acting tags

You can place these anywhere in **Text**. They are removed from the subtitle and fire at roughly the point in the sentence where you put them:

```
[expr:annoyed]  [expr:annoyed:0.5]      change expression (optional intensity)
[brow_raise] [brow_furrow] [squint] [widen]
[blink] [slow_blink] [double_blink]
[glance_away] [glance:left|right|up|down] [look_away] [look_at_player]
[look_up_down]                          look the player up and down
[nod] [shake] [recoil]
[open_door] [close_door]
```

Example: `At least... [glance_away]I think [look_at_player]you're back.`

The face also acts on its own while it talks. It reacts to the audio: brows lift on stressed syllables, an angry face frowns on them instead, it sometimes looks away during pauses and back when speech resumes, and it blinks at phrase starts. Gestures have cooldowns, so there are still moments of stillness. **Speech Gesture Amount** controls how much of this happens.

---

## 3. Replacing the placeholder face artwork

All the face art is in `art/` as SVG files. Each part is a separate `Sprite2D` in `TalkingDoorFace.tscn`:

```
TalkingDoorFace
└── Skin                     (breathes)
    ├── FacePlate            face_plate.svg   – skin, nose shading, cheeks, sockets
    └── Features             (shifts slightly toward where the eyes look)
        ├── LeftEye / RightEye   (FaceEye script)
        │   ├── Socket           eye_socket_shadow.svg
        │   ├── Sclera           eye_sclera.svg   ← the eye opening. "Clip Children" is on,
        │   │   ├── Iris         eye_iris.svg       so everything inside is cut to its shape
        │   │   │   ├── Pupil    eye_pupil.svg
        │   │   │   └── Catchlight
        │   │   ├── UpperLid     eyelid_upper.svg  (its bottom edge = lash line)
        │   │   └── LowerLid     eyelid_lower.svg
        │   └── Outline          eye_outline.svg
        ├── LeftBrow / RightBrow (FaceBrow script) → Art  brow.svg
        ├── Nose                 nose.svg
        ├── Jaw → Chin           chin.svg  (drops when the mouth opens)
        └── Mouth                ProceduralMouth (drawn in code)
```

The door-side art is in `TalkingDoor.tscn`: `door_panel.svg`, `door_frame.svg`, `doorway_void.svg`, and `face_rim.svg`. The rim is the torn wood lip drawn over the edge of the face. It is what makes the face look pushed through the door.

**To swap a picture:**

1. Open `TalkingDoorFace.tscn` (double-click it in the FileSystem dock).
2. Select the node in the **Scene** dock, for example `Skin/Features/LeftEye/Sclera/Iris`.
3. Drag your PNG from the FileSystem dock onto the **Texture** property in the Inspector.
4. If your drawing is a different size, change the node's **Transform → Scale**. For example, use 0.5 for art drawn at double size.

The easiest option is to overwrite the SVG files in `art/` with your own files under the same names. PNG works if you also update the texture slots.

**Rules your art needs to follow:**

- **Sclera:** the opaque part *is* the eye opening. The iris and lids are clipped to it.
- **Brows:** draw the **left** brow, with the inner end on the right. The right brow is the same image, mirrored automatically.
- **Eyelids:** select `LeftEye` (or `RightEye`). The Inspector has **Upper Lid Closed Y**, **Upper Lid Open Y**, **Lower Lid Rest Y**, **Lower Lid Raised Y**, and the **Margin Offset** values. The margin offset is the distance from the centre of the lid image to its lash line. Adjust them until the lids close exactly and open to the right height. **Pupil Range** sets how far the iris can move.
- **Placement:** move the eye, brow, and mouth nodes in the 2D view to fit your face plate.

**Mouth artwork.** The placeholder mouth is drawn in code so it can blend smoothly between shapes. To use drawings instead:

1. Draw one image per shape: rest, small open, wide open, round ("oo"), narrow ("ee/s"), smile open, frown open, pressed ("m/b/p"). Only *rest* is required. Missing shapes fall back to it.
2. In `TalkingDoorFace.tscn`, delete the `Mouth` node.
3. Select `Features` and add a child node. Choose **Node2D**, name it exactly `Mouth`, and in the Inspector set its **Script** to `face/SpriteMouth.gd`.
4. Fill the texture slots in the Inspector.

To write a fully custom mouth (with bones, frames, or shaders), extend `MouthRig` and implement `apply_pose(pose: MouthPose)`.

---

## 4. Creating a second door character

The face technology and the personality are separate. Each door is the same `TalkingDoor.tscn` with a different **DoorCharacterData** resource.

1. In the FileSystem dock, right-click `characters/weary_door.tres` → **Duplicate…** → name it, for example, `obnoxious_door.tres`.
   (`nervous_door.tres` is already a working second personality you can try.)
2. Double-click the new file and edit it in the Inspector:
   - **Moods:** which expression it uses when alone, when it notices you, while you stand at it, and after you leave. Whether it falls asleep.
   - **Habits:** **Notice Delay** (slow and dozy vs. jumpy), **Shiftiness** (how often it breaks eye contact; nervous doors use 2–3), **Blink Rate**, **Expressiveness** (acting while talking), **Eye Speed**, **Fidget** (nervous tremble).
   - **Voice:** volume, pitch, and mouth sensitivity for this voice.
   - **Dialogue:** greeting, return greeting, interact responses (one per press, escalating), farewell, which press opens the door, lines before opening, and lines while open.
3. Select a door in your scene and drag the new `.tres` onto its **Character** property.

To try `nervous_door.tres` right now: open `TalkingDoorTest.tscn`, select `TalkingDoor`, drag `nervous_door.tres` onto **Character**, and press F6. It has no audio files, so its mouth is animated from the subtitle text.

**A different acting style:** duplicate `face/default_expressions.tres`, change the expressions (for example, a depressed door whose *happy* is barely a smile), and assign it to the character's **Expression Set Override**.

**Swapping a door at runtime:** `door.set_character(load("res://.../obnoxious_door.tres"))`.

---

## 5. Putting the door into another scene (e.g. the real lobby)

1. Open your lobby scene and drag `interactables/talking_door/TalkingDoor.tscn` from the FileSystem dock into the 2D view.
2. **The door's origin is the bottom centre of the door, on the floor.** Place it where the door meets the floor.
3. Let the door find Bill. Use **either** of these:
   - Select Bill's root node → **Node** dock → **Groups** → add the group `player`, **or**
   - set the door's **Player Path** to Bill.
4. Optional but recommended: give Bill's script this function so the door looks at his face rather than his feet:
   ```gdscript
   func get_look_target_position() -> Vector2:
       return global_position + Vector2(0, -180)   # where Bill's eyes are
   ```
   Without it, the door uses Bill's position plus **Player Look Offset**.
5. Set **Character** to the door's personality and change **Plaque Text** to the door's number.
6. Interaction uses the input action `interact`. If your project doesn't have it, the door creates it with E and Space. If several doors overlap, only the nearest one responds.

Using the door's signals from your own code:

```gdscript
@onready var door: TalkingDoor = $TalkingDoor

func _ready():
    door.door_opened.connect(func(): print("Bill may enter"))
    door.door_selected.connect(func(d): print("Bill pressed ", d.name))

# Things you can call:
#   door.interact()                     door.open_door()   door.close_door()
#   door.set_expression("sad", 0.5)     door.say([some_dialogue_line])
#   door.face.glance_away(1.0)          door.face.blink("slow")
#   door.reset_conversation()           door.set_character(data)
```

**Signals:** `door_noticed_player`, `door_lost_player`, `player_entered_interaction_range`, `player_exited_interaction_range`, `door_selected`, `dialogue_started(line, subtitle)`, `dialogue_finished(line)`, `sequence_finished(name)`, `expression_changed(name)`, `door_opened`, `door_closed`.

**Notes:**

- If your lobby already has its own subtitle UI, untick **Show Subtitles** and use `dialogue_started` to drive yours.
- Distances are measured left/right only, which suits a side-on room. For a top-down room, untick **Horizontal Distance Only**.
- The face lives under `Panel` with the door art. Opening the door squashes the panel toward its hinge, and the face stays on the panel.

---

## 6. The most useful Inspector values

Select the **TalkingDoor** node. These are the values to change first:

| Setting | Where | What it changes |
|---|---|---|
| **Character** | top | Who the door is: personality, habits, all lines. |
| **Detection Distance** | Player Detection | How far away it notices Bill (FAR → NEAR). |
| **Interaction Distance** | Player Detection | How close Bill must be to talk / press E. |
| **Auto Greet** | Player Detection | Whether it starts talking by itself. |
| **Eye Tracking Strength** | Face Tuning | How far the eyes turn toward Bill. Try 1.3 for an intense stare. |
| **Eye Tracking Speed** | Face Tuning | Lazy (3) vs. predatory (14). |
| **Pupil Movement Amount** | Face Tuning | How far the pupils can travel inside the eye. |
| **Idle Look Frequency** | Face Tuning | How restless the eyes are when nobody is around. |
| **Blink Interval Min / Max** | Face Tuning | Random time between blinks. Double and slow blinks happen on their own. |
| **Expression Transition Time** | Face Tuning | How quickly expressions blend. |
| **Speech Mouth Sensitivity** | Face Tuning | Raise it if the mouth barely opens. Lower it if it gapes. |
| **Speech Mouth Smoothing** | Face Tuning | Higher = softer, lazier mouth. |
| **Speech Gesture Amount** | Face Tuning | Brows, eyes, and nods while talking. 0 = mouth only. |
| **Idle Animation Strength** | Face Tuning | Breathing, drift, and micro eye movements. 0 = statue. |
| **Open Duration / Open Amount** | Door | Door swing speed and how far it opens. |
| **Debug Draw Ranges** | Debug | Draws the two ranges on the floor. |

In the **character .tres**, the values that matter most are **Notice Delay**, **Shiftiness**, **Expressiveness**, **Fidget**, and **Open After Interactions**.

Expressions are in `face/default_expressions.tres`. Open it, expand an expression, and adjust its sliders: brow height and angle, lid openness and tilt, pupil size, mouth smile/press/pucker, face tilt, and so on. Changes show the next time you run.

---

## 7. How it works (and how to upgrade the lip sync)

- **Eyes.** Every frame the face picks a point of interest: Bill, a spot it wanders to while idle, or a quick glance away. It moves its "focus" there in one of two ways. For a jump to a new point it makes a fast **saccade**, sometimes with a blink, as people do. For a moving target it uses smooth **pursuit**, and if Bill outruns it, it catches up with a saccade. Each eye works out its own angle, so the eyes converge slightly when Bill is close. Small **micro-saccades** keep the eyes from looking dead. The upper lids follow the eyes up and down, and the nose shifts a little more than the eyes, which suggests a head turn.
- **Blinking.** Blinks come at random intervals between the min/max values, scaled by the current expression and the character. Some are double blinks or slow blinks. Blinks also happen on big eye jumps, on expression changes, and at the start of phrases, and they continue while talking.
- **Expressions** are just sets of numbers (`FaceExpression`). The face smoothly blends from wherever it is to the new set, so any expression can follow any other with no extra animations. Short "pulses" (brow raise, squint, nod…) are added on top and fade out by themselves.
- **Lip sync** goes through `LipSyncDriver`. `AmplitudeLipSync` maps loudness to how far the mouth opens. It maps tone, judged against that voice's own average, to a shape: dark sounds give *round*, hissy sounds give *narrow/teeth*, and each new syllable varies the open shape. Brief dips in loudness close the mouth. Expressions still show through, so an angry face talks with pressed lips and a happy one with smiling corners.
- **Upgrading to phoneme lip sync:** the face doesn't care where mouth shapes come from. The free tool [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) can create a cue file from a WAV (`rhubarb -f tsv -o line.tsv line.wav`). Put the `.tsv` next to the audio and set the line's **Lip Sync Cues** to it. `VisemeTrackLipSync` then plays exact mouth shapes in time with the audio. For any other phoneme source, build an array of `{time, shape, open}` keys and pass it to `VisemeTrackLipSync.new(keys, player, stream)`, or subclass `LipSyncDriver`.
