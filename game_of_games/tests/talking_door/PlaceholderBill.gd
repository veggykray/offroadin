extends Node2D
## Stand-in for Bill. Left/right movement only. Doors find him through the
## "player" group and ask get_look_target_position() where his eyes are.

@export var speed := 300.0
@export var min_x := 80.0
@export var max_x := 1840.0
@export var height := 290.0

## Set by the auto-test to walk Bill somewhere without the keyboard.
var auto_target_x = null

var _vel := 0.0
var _facing := 1.0
var _walk := 0.0


func _ready() -> void:
	add_to_group(&"player")


func get_look_target_position() -> Vector2:
	return global_position + Vector2(10.0 * _facing, -height + 32.0)


func _process(delta: float) -> void:
	var dir := Input.get_axis(&"move_left", &"move_right")
	if auto_target_x != null:
		var dx: float = auto_target_x - position.x
		dir = clampf(dx / 40.0, -1.0, 1.0)
		if absf(dx) < 3.0:
			dir = 0.0
	_vel = move_toward(_vel, dir * speed, speed * 6.0 * delta)
	position.x = clampf(position.x + _vel * delta, min_x, max_x)
	if absf(_vel) > 5.0:
		_facing = signf(_vel)
		_walk += delta * absf(_vel) / 38.0
	else:
		_walk = lerpf(_walk, roundf(_walk / PI) * PI, delta * 10.0)
	queue_redraw()


func _draw() -> void:
	var bob := absf(sin(_walk)) * 5.0
	var body := Color(0.2, 0.22, 0.27)
	var rim := Color(0.55, 0.5, 0.4, 0.5)
	# shadow
	draw_set_transform(Vector2(0, 2), 0.0, Vector2(1.0, 0.18))
	draw_circle(Vector2.ZERO, 46.0, Color(0, 0, 0, 0.45))
	draw_set_transform(Vector2.ZERO)
	# legs
	var stride := sin(_walk) * 14.0
	draw_line(Vector2(-10, -88 - bob), Vector2(-10 + stride, -4), body.darkened(0.25), 16.0, true)
	draw_line(Vector2(10, -88 - bob), Vector2(10 - stride, -4), body.darkened(0.15), 16.0, true)
	# capsule torso
	var top := Vector2(0, -height + 70 - bob)
	var bottom := Vector2(0, -95 - bob)
	draw_line(top, bottom, body, 64.0, true)
	draw_circle(top, 32.0, body)
	draw_circle(bottom, 32.0, body)
	draw_arc(top, 32.0, PI * 1.1, PI * 1.9, 16, rim, 2.0, true)
	# head
	var head := Vector2(4.0 * _facing, -height + 20 - bob)
	draw_circle(head, 25.0, body.lightened(0.08))
	draw_arc(head, 25.0, PI * 1.05, PI * 1.95, 16, rim, 2.0, true)
	# eyes so you can see which way he faces
	draw_circle(head + Vector2(9 * _facing, -3), 3.0, Color(0.9, 0.88, 0.8))
	draw_circle(head + Vector2(18 * _facing, -3), 3.0, Color(0.9, 0.88, 0.8))
	# name badge
	draw_rect(Rect2(Vector2(-16 + 8 * _facing, -height + 92 - bob), Vector2(32, 14)), Color(0.85, 0.82, 0.7))
	draw_string(ThemeDB.fallback_font, Vector2(-13 + 8 * _facing, -height + 104 - bob), "BILL", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.15, 0.1, 0.1))
