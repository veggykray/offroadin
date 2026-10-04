class_name HumanZooPlaceholderBill
extends Node2D
## A stand-in for Bill. Walks left/right; that's all it knows.
## The Human Zoo module never depends on this script: any node in the
## "human_zoo_player" group (or assigned to HumanZooGame.player) works.

@export var speed: float = 380.0
@export var min_x: float = 0.0
@export var max_x: float = 4000.0

var locked := false
var facing := 1.0
var _vel := 0.0
var _walk := 0.0
var _t := 0.0
var _hat_off := 0.0


func _ready() -> void:
	add_to_group("human_zoo_player")


func set_locked(on: bool) -> void:
	locked = on


## Used by the "steam blasts Bill's hat" wrong-attempt event.
func blast_hat() -> void:
	_hat_off = 3.0


func _process(delta: float) -> void:
	_t += delta
	var dir := 0.0
	if not locked:
		dir = Input.get_axis("hz_left", "hz_right")
	_vel = move_toward(_vel, dir * speed, delta * speed * 6.0)
	position.x = clampf(position.x + _vel * delta, min_x, max_x)
	if absf(_vel) > 5.0:
		facing = signf(_vel)
		_walk += delta * absf(_vel) / 38.0
	else:
		_walk = lerpf(_walk, roundf(_walk / PI) * PI, delta * 10.0)
	_hat_off = maxf(_hat_off - delta, 0.0)
	queue_redraw()


func _draw() -> void:
	var swing := sin(_walk) * 14.0
	var bob := absf(sin(_walk)) * -3.0
	var coat := Color(0.2, 0.24, 0.3)
	var skin := Color(0.9, 0.78, 0.68)
	# Shadow
	draw_colored_polygon(_ellipse(Vector2(0, 2), 34, 6), Color(0, 0, 0, 0.35))
	# Legs
	draw_line(Vector2(-6, -62 + bob), Vector2(-6 + swing, 0), Color(0.12, 0.12, 0.14), 9.0)
	draw_line(Vector2(6, -62 + bob), Vector2(6 - swing, 0), Color(0.12, 0.12, 0.14), 9.0)
	draw_rect(Rect2(Vector2(-6 + swing - 6 + facing * 3, -4), Vector2(14, 5)), Color(0.08, 0.06, 0.05))
	draw_rect(Rect2(Vector2(6 - swing - 6 + facing * 3, -4), Vector2(14, 5)), Color(0.08, 0.06, 0.05))
	# Long coat
	draw_colored_polygon(PackedVector2Array([Vector2(-20, -128 + bob), Vector2(20, -128 + bob), Vector2(26, -50 + bob), Vector2(-26, -50 + bob)]), coat)
	draw_line(Vector2(0, -126 + bob), Vector2(0, -52 + bob), coat.darkened(0.3), 1.5)
	# Scarf
	draw_rect(Rect2(-17, -132 + bob, 34, 9), Color(0.7, 0.18, 0.16))
	draw_line(Vector2(-facing * 8, -124 + bob), Vector2(-facing * 18, -98 + bob + sin(_t * 3.0) * 2.0), Color(0.7, 0.18, 0.16), 7.0)
	# Arms
	draw_line(Vector2(-18, -120 + bob), Vector2(-22 - swing * 0.6, -70 + bob), coat.darkened(0.15), 8.0)
	draw_line(Vector2(18, -120 + bob), Vector2(22 + swing * 0.6, -70 + bob), coat.darkened(0.15), 8.0)
	# Head
	var head := Vector2(facing * 2, -150 + bob)
	draw_circle(head, 17, skin)
	draw_circle(head + Vector2(facing * 7, -2), 2.2, Color(0.1, 0.08, 0.06))
	draw_line(head + Vector2(facing * 3, 8), head + Vector2(facing * 11, 7), Color(0.4, 0.2, 0.15), 1.6)
	draw_circle(head + Vector2(facing * 16, 2), 3.5, skin.darkened(0.08))
	# Bowler hat (or not)
	var hat := head + Vector2(0, -12)
	if _hat_off > 0.0:
		var t := 3.0 - _hat_off
		var fly := Vector2(-facing * t * 60.0, -sin(minf(t, 1.5) / 1.5 * PI) * 160.0 - t * 30.0)
		if t > 1.5:
			fly = Vector2(-facing * 90.0, maxf(-200.0 + (t - 1.5) * 260.0, -40.0))
		hat += fly
		draw_set_transform(hat, t * 6.0, Vector2.ONE)
		hat = Vector2.ZERO
	draw_rect(Rect2(hat + Vector2(-24, -2), Vector2(48, 5)), Color(0.08, 0.08, 0.09))
	draw_colored_polygon(_half_ellipse(hat + Vector2(0, -2), 16, 18), Color(0.1, 0.1, 0.11))
	draw_rect(Rect2(hat + Vector2(-16, -6), Vector2(32, 4)), Color(0.35, 0.15, 0.12))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if _hat_off > 0.0:
		# Steam-blasted hair
		for i in 5:
			draw_line(head + Vector2(-10 + i * 5, -14), head + Vector2(-14 + i * 7, -26 - (i % 2) * 6), Color(0.35, 0.25, 0.18), 2.0)


func _ellipse(c: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 16:
		var a := TAU * i / 16.0
		pts.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	return pts


func _half_ellipse(c: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 13:
		var a := PI + PI * i / 12.0
		pts.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	return pts
