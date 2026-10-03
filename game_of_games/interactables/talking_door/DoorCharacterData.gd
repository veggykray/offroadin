@tool
class_name DoorCharacterData
extends Resource
## Everything that makes one door a *character*: its moods, habits and lines.
##
## The face technology (TalkingDoorFace) knows nothing about personality. Give
## two doors two different DoorCharacterData files and they behave like two
## different people. Duplicate a .tres in the FileSystem dock to start a new one.

@export var display_name := "Door"
@export_multiline var notes := ""

@export_group("Moods")
## Expression when nobody is around.
@export var idle_expression: StringName = &"idle"
## Expression when it first notices the player.
@export var noticed_expression: StringName = &"curious"
## Expression while the player stands within interaction range (between lines).
@export var engaged_expression: StringName = &"curious"
## Expression after the player has walked off.
@export var left_alone_expression: StringName = &"idle"
## If true the door dozes off when left alone for a while.
@export var falls_asleep := false
@export var fall_asleep_after := 25.0

@export_group("Habits")
## Seconds before it reacts to the player coming near.
@export var notice_delay := 0.45
## Seconds it keeps watching the player after they walk out of range.
@export var watch_leave_time := 2.5
## 0..1+ how often it breaks eye contact (nervous doors: high).
@export_range(0.0, 4.0) var shiftiness := 1.0
## Multiplier on blink frequency.
@export_range(0.0, 4.0) var blink_rate := 1.0
## Multiplier on how lively the face is while talking (brows, glances, nods).
@export_range(0.0, 3.0) var expressiveness := 1.0
## Multiplier on how quickly the eyes follow the player.
@export_range(0.2, 3.0) var eye_speed := 1.0
## Constant nervous tremble added on top of every expression (0..1).
@export_range(0.0, 1.0) var fidget := 0.0
## Optional replacement expression set (a different acting style).
@export var expression_set_override: FaceExpressionSet

@export_group("Voice")
@export var voice_volume_db := 0.0
@export_range(0.5, 2.0) var voice_pitch := 1.0
## Mouth-movement multiplier for this voice (quiet recordings: raise it).
@export_range(0.2, 3.0) var mouth_sensitivity := 1.0

@export_group("Dialogue")
## Played the first time the player comes into interaction range.
@export var greeting: Array[DialogueLine] = []
## Played when the player returns after leaving (empty = say nothing).
@export var return_greeting: Array[DialogueLine] = []
## One entry per press of Interact; the last one repeats once they run out.
@export var interact_responses: Array[DialogueLine] = []
## Said (if anything) when the player walks away after talking.
@export var farewell: Array[DialogueLine] = []
## Open the door on this press of Interact (0 = never open from interaction).
@export var open_after_interactions := 0
## Said just before the door opens.
@export var before_opening: Array[DialogueLine] = []
## Interact responses once the door is open.
@export var while_open: Array[DialogueLine] = []
