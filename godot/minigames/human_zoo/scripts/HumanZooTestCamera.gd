class_name HumanZooTestCamera
extends Camera2D
## Follows the player along the gallery and honours HumanZooGame focus requests
## (machine reveals, wrong-attempt gags, the finale).

@export var y_offset := -330.0
@export var follow_speed := 4.0
var target: Node2D
var min_x := -INF
var max_x := INF
var _focus_pos: Variant = null
var _focus_zoom := 1.0


func _ready() -> void:
	if target:
		position = Vector2(clampf(target.global_position.x, min_x, max_x), y_offset)


func focus_on(world_position: Vector2, zoom_level: float) -> void:
	_focus_pos = world_position
	_focus_zoom = zoom_level


func release() -> void:
	_focus_pos = null
	_focus_zoom = 1.0


func _process(delta: float) -> void:
	var goal: Vector2
	if _focus_pos != null:
		goal = _focus_pos
	elif target:
		goal = Vector2(clampf(target.global_position.x, min_x, max_x), y_offset)
	else:
		return
	var k := 1.0 - exp(-follow_speed * delta * (0.6 if _focus_pos != null else 1.0))
	position = position.lerp(goal, k)
	zoom = zoom.lerp(Vector2.ONE * _focus_zoom, 1.0 - exp(-2.5 * delta))
