class_name ParallaxBodyLayer
extends Node2D
## Base for depth layers of the beast. `motion_scale` < 1 is further away,
## > 1 is between the camera and the hide.

@export var motion_scale := 0.5
@export var breath_scale := 0.5

var t := 0.0


func _process(delta: float) -> void:
	t += delta
	var cx := Game.camera_x()
	position.x = cx * (1.0 - motion_scale)
	var breath: float = Game.body.breath if Game.body else 0.0
	var heave: Vector2 = Game.body.heave_offset if Game.body else Vector2.ZERO
	position.y = breath * 6.0 * breath_scale + heave.y * breath_scale
	position.x += heave.x * breath_scale
	_layer_update(delta)
	queue_redraw()


func _layer_update(_delta: float) -> void:
	pass


## Local x range currently on screen (with margin).
func visible_range(margin: float = 200.0) -> Vector2:
	var cx := Game.camera_x()
	var c := cx * motion_scale
	return Vector2(c - Game.SCREEN.x * 0.5 - margin, c + Game.SCREEN.x * 0.5 + margin)
