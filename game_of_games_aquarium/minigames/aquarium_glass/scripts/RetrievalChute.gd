extends Node2D
## The retrieval chute on the aquarium floor. Its position comes from the
## Layout/Chute marker. When the memory gets close it is gently sucked in and
## memory_received is emitted (the activity turns that into reward_delivered).

signal memory_received

## The memory is captured inside this radius.
@export var capture_radius := 50.0
## Gentle suction starts inside this radius.
@export var suction_radius := 230.0
## Suction strength (px/s^2 at the mouth).
@export var suction_strength := 160.0

var activity: Node
var _t := 0.0
var _glow := 0.0
var _received := false


func setup(p_activity: Node) -> void:
	activity = p_activity


func get_intake_point() -> Vector2:
	return position + Vector2(0, 6)


func suction_force(p: Vector2) -> Vector2:
	var d := get_intake_point() - p
	var dist := d.length()
	if dist > suction_radius or dist < 1.0:
		return Vector2.ZERO
	return d / dist * suction_strength * (1.0 - dist / suction_radius)


func tick(delta: float) -> void:
	_t += delta
	_glow = move_toward(_glow, 0.0, delta * 0.5)
	var m: Node2D = activity.memory
	if not _received and m.is_loose() and m.position.distance_to(get_intake_point()) < capture_radius:
		force_receive(m)
	if randf() < delta * 1.5:
		activity.water_fx.spawn_bubbles(position + Vector2(randf_range(-20, 20), -10), 1, 0.4)
	queue_redraw()


func force_receive(m: Node2D) -> void:
	if _received:
		return
	_received = true
	_glow = 1.0
	m.enter_chute(self)
	memory_received.emit()


func reset_chute() -> void:
	_received = false


func _draw() -> void:
	# Funnel mouth sunk into the sand, with a grate and a pipe going down.
	var w := 64.0
	draw_rect(Rect2(-22, 0, 44, 90), Color(0.18, 0.22, 0.24))
	var funnel := PackedVector2Array([Vector2(-w, -18), Vector2(w, -18), Vector2(26, 14), Vector2(-26, 14)])
	draw_colored_polygon(funnel, Color(0.36, 0.42, 0.44))
	draw_colored_polygon(PackedVector2Array([Vector2(-w + 8, -14), Vector2(w - 8, -14), Vector2(20, 8), Vector2(-20, 8)]), Color(0.04, 0.05, 0.06))
	for i in 5:
		var x := lerpf(-w + 16, w - 16, float(i) / 4.0)
		draw_line(Vector2(x, -14), Vector2(x * 0.4, 8), Color(0.45, 0.5, 0.5), 2.0)
	draw_line(Vector2(-w, -18), Vector2(w, -18), Color(0.6, 0.66, 0.66), 4.0)
	for i in 6:
		draw_circle(Vector2(lerpf(-w + 6, w - 6, float(i) / 5.0), -18), 2.5, Color(0.25, 0.28, 0.3))
	# A little round "RETRIEVAL" porthole light that pulses gently.
	var lc := Color(0.4, 1.0, 0.7, 0.35 + 0.25 * sin(_t * 2.0) + _glow * 0.6)
	draw_circle(Vector2(w + 16, -8), 8, Color(0.15, 0.18, 0.2))
	draw_circle(Vector2(w + 16, -8), 5, lc)
	if _glow > 0.0:
		draw_circle(Vector2(0, -10), 40 + 60 * (1.0 - _glow), Color(1, 0.9, 0.5, _glow * 0.3))
