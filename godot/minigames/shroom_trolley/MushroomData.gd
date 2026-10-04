extends Resource
## Tuning data for ONE mushroom type.
##
## The four prototype types live in res://minigames/shroom_trolley/types/*.tres.
## Double-click one of those files in the Godot FileSystem dock to tweak a type
## in the Inspector (bounce, weight, colours, how fast it flies...).
##
## To add a new type later: duplicate one of the .tres files, change `type_id`,
## `scan_id` and the numbers, then add it to ShroomTrolleyActivity's
## `mushroom_types` list.

enum Role { GOOD, BAD, BONUS, HAZARD }

@export var type_id: StringName = &"normal"
## What the checkout scanner sees. Scanner.gd looks this up in its response table.
@export var scan_id: StringName = &"mushroom_normal"
@export var display_name := "Shroom"
@export var role: Role = Role.GOOD

@export_group("Physics")
@export var radius := 14.0
@export var mass := 1.0
## 0 = thud, 1 = superball.
@export_range(0.0, 1.0) var bounce := 0.3
@export_range(0.0, 1.0) var friction := 0.6
## Multiplies the activity's shroom gravity. <1 floats, >1 drops like a rock.
@export var gravity_multiplier := 1.0
## Hard safety clamp so nothing gets launched into orbit.
@export var max_speed := 1500.0

@export_group("Launching")
## Seconds a launched mushroom spends in the air before it reaches catch height.
## Short = fast, flat, hard to read. Long = floaty, easy.
@export var flight_time := Vector2(1.55, 1.95)
## Random spread added to the launch velocity (pixels/sec). Keeps arcs varied.
@export var launch_jitter := 25.0
## Small spin applied when launched (radians/sec).
@export var launch_spin := 4.0

@export_group("Trolley")
## How much this mushroom weighs once it is cargo. Heavier = trolley sluggish.
@export var cargo_weight := 1.0
## Bouncy mushrooms only count as caught once they calm down inside the basket.
@export var must_settle_to_catch := false
## How hard the trolley visibly bounces when this lands.
@export var catch_thump := 1.0

@export_group("Look")
@export var cap_color := Color(0.85, 0.22, 0.18)
@export var cap_shade := Color(0.6, 0.12, 0.1)
@export var spot_color := Color(1, 0.96, 0.88)
@export var stem_color := Color(0.97, 0.92, 0.8)
@export var sparkle := false
@export var stinky := false
@export var glossy := false

@export_group("Scoring")
@export var points := 100


func is_good() -> bool:
	return role == Role.GOOD or role == Role.BONUS


func is_bad() -> bool:
	return role == Role.BAD


func is_bonus() -> bool:
	return role == Role.BONUS
