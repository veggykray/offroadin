class_name FloatCamera
extends Camera3D
## Side-view follow camera with lazy smoothing, so the camera drifts like Bill does.

@export var target_path: NodePath
@export var offset := Vector3(0.0, 0.4, 9.0)
@export var follow_sharpness := 2.2
## Leads slightly in the direction of travel.
@export var velocity_lead := 0.35

var _target: Node3D


func _ready() -> void:
	_target = get_node_or_null(target_path) as Node3D
	if _target:
		global_position = _target.global_position + offset


func _process(delta: float) -> void:
	if _target == null:
		return
	var goal := _target.global_position + offset
	if _target is CharacterBody3D:
		var v: Vector3 = (_target as CharacterBody3D).velocity
		goal += Vector3(v.x, v.y, 0.0) * velocity_lead
	global_position = global_position.lerp(goal, 1.0 - exp(-follow_sharpness * delta))
