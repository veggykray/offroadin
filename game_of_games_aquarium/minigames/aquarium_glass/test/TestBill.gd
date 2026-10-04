extends Node2D
## TEMPORARY placeholder Bill for the test scene. The module does NOT depend
## on this script. It shows the optional duck-typed hooks the activity calls
## on whatever "player" node you pass to start_activity():
##
##   get_aquarium_gaze_position() -> Vector2 (global)  where creatures look
##   on_aquarium_knockdown()                           the giant tapped back
##   on_aquarium_reward(reward_id: String)             memory delivered
##
## All three are optional.

var _t := 0.0
var _fall := 0.0          # 0 standing .. 1 flat on his back
var _fall_vel := 0.0
var _down_time := 0.0
var _arm_target := Vector2.ZERO
var _arm_t := 10.0
var _arm_kind := "tap"
var _look_x := 0.0
var _holding := false
var _orb_flight := -1.0
var _orb_from := Vector2.ZERO
var _stars := 0.0


func get_aquarium_gaze_position() -> Vector2:
	return to_global(_head_pos())


func on_aquarium_knockdown() -> void:
	_fall_vel = 4.5
	_down_time = 3.2
	_stars = 1.0


func on_aquarium_reward(_reward_id: String) -> void:
	pass   # The test scene animates the hand-over via receive_memory_from().


## Test-scene animation: the memory pops out of the hatch into Bill's hand.
func receive_memory_from(global_pos: Vector2) -> void:
	_orb_from = to_local(global_pos)
	_orb_flight = 0.0


## Reach towards a glass position (global) as if tapping it.
func point_at(global_pos: Vector2, kind: String) -> void:
	_arm_target = to_local(global_pos)
	_arm_t = 0.0
	_arm_kind = kind


func _head_pos() -> Vector2:
	return Vector2(0, -170)


func _process(delta: float) -> void:
	_t += delta
	_arm_t += delta
	_stars = move_toward(_stars, 0.0, delta * 0.25)
	if _down_time > 0.0:
		_down_time -= delta
		_fall_vel += (1.0 - _fall) * 60.0 * delta
	else:
		_fall_vel += (0.0 - _fall) * 18.0 * delta
	_fall_vel *= exp(-6.0 * delta)
	_fall += _fall_vel * delta
	var mouse := get_local_mouse_position()
	_look_x = lerpf(_look_x, clampf(mouse.x * 0.03, -10, 10), delta * 4.0)
	if _orb_flight >= 0.0:
		_orb_flight += delta
		if _orb_flight > 1.1:
			_orb_flight = -1.0
			_holding = true
	queue_redraw()


func _draw() -> void:
	var rot := -_fall * 1.4
	draw_set_transform(Vector2.ZERO, rot, Vector2.ONE)
	var coat := Color(0.32, 0.24, 0.2)
	var coat_dark := Color(0.22, 0.16, 0.13)
	var skin := Color(0.85, 0.66, 0.55)
	var breathe := sin(_t * 1.8) * 2.0
	# Legs.
	draw_rect(Rect2(-46, -40, 34, 60), Color(0.18, 0.18, 0.22))
	draw_rect(Rect2(12, -40, 34, 60), Color(0.18, 0.18, 0.22))
	# Coat (seen from behind).
	var body := PackedVector2Array([Vector2(-78, -150 + breathe), Vector2(78, -150 + breathe), Vector2(70, -30), Vector2(-70, -30)])
	draw_colored_polygon(body, coat)
	draw_line(Vector2(0, -140), Vector2(0, -30), coat_dark, 3.0)
	draw_colored_polygon(PackedVector2Array([Vector2(-40, -152 + breathe), Vector2(40, -152 + breathe), Vector2(26, -128), Vector2(-26, -128)]), coat_dark)
	# Left arm at his side.
	draw_line(Vector2(-74, -140 + breathe), Vector2(-86, -60), coat, 24.0)
	draw_circle(Vector2(-86, -56), 11, skin)
	# Right arm: reaches for the glass when the player touches it.
	var shoulder := Vector2(72, -140 + breathe)
	var reach := clampf(1.0 - absf(_arm_t - 0.18) / 0.5, 0.0, 1.0)
	var hand_rest := Vector2(86, -56)
	var to := (_arm_target - shoulder)
	var hand_reach := shoulder + to.limit_length(150.0)
	var hand := hand_rest.lerp(hand_reach, reach)
	if _holding or _orb_flight >= 0.0:
		hand = shoulder + Vector2(30, -110)
	draw_line(shoulder, hand, coat, 24.0)
	draw_circle(hand, 12, skin)
	if _arm_kind == "knock" and reach > 0.5:
		draw_circle(hand, 15, skin.darkened(0.1))
	# Head (back of it) with ears and a stubborn tuft of hair.
	var head := _head_pos() + Vector2(_look_x, breathe)
	draw_circle(head + Vector2(-34, 4), 9, skin.darkened(0.1))
	draw_circle(head + Vector2(34, 4), 9, skin.darkened(0.1))
	draw_circle(head, 36, Color(0.3, 0.22, 0.16))
	draw_circle(head + Vector2(0, 22), 26, skin)
	draw_circle(head + Vector2(0, -6), 34, Color(0.33, 0.24, 0.17))
	draw_line(head + Vector2(4, -38), head + Vector2(12, -52 + sin(_t * 3.0) * 2.0), Color(0.33, 0.24, 0.17), 4.0)
	# The memory in his hand.
	if _holding:
		var g := 0.6 + 0.4 * sin(_t * 3.0)
		draw_circle(hand + Vector2(0, -18), 30, Color(1, 0.85, 0.4, 0.15 * g))
		draw_circle(hand + Vector2(0, -18), 13, Color(1, 0.9, 0.55))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if _orb_flight >= 0.0:
		var k := _orb_flight / 1.1
		var target := Vector2(102, -268)
		var p := _orb_from.lerp(target, k) + Vector2(0, -sin(k * PI) * 160.0)
		draw_circle(p, 26, Color(1, 0.85, 0.4, 0.2))
		draw_circle(p, 13, Color(1, 0.9, 0.55))
	if _stars > 0.0:
		var hp := Vector2(-_fall * 170.0, -170.0 + _fall * 150.0)
		for i in 4:
			var a := _t * 4.0 + i * TAU / 4.0
			draw_circle(hp + Vector2(cos(a) * 40.0, sin(a) * 12.0 - 40.0), 5.0, Color(1, 1, 0.5, _stars))
