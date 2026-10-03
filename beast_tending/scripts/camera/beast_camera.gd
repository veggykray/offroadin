class_name BeastCamera
extends Camera2D
## Pans smoothly along the beast. A/D or arrow keys, mouse wheel, right/middle
## drag, or resting the hand near the screen edge. Also carries the beast's
## physical motion: shakes, bumps and sways.

@export var pan_speed := 1500.0
@export var edge_margin := 70.0
@export var edge_speed := 1100.0
@export var wheel_step := 220.0
@export var follow_rate := 7.0
@export var start_x := 4850.0

var input_enabled := false
var target_x := 0.0
var trauma := 0.0
var bump_off := Vector2.ZERO
var bump_v := Vector2.ZERO
var sway_amt := 0.0
var t := 0.0
var _dragging := false
var _mouse_inside := true
var _drag_last := Vector2.ZERO


func _ready() -> void:
	Game.camera = self
	target_x = start_x
	position = Vector2(start_x, Game.SCREEN.y * 0.5)
	make_current()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_MOUSE_EXIT or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_mouse_inside = false
	elif what == NOTIFICATION_WM_MOUSE_ENTER or what == NOTIFICATION_APPLICATION_FOCUS_IN:
		_mouse_inside = true


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled:
		return
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP or event.button_index == MOUSE_BUTTON_WHEEL_LEFT:
			if event.pressed:
				target_x -= wheel_step
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN or event.button_index == MOUSE_BUTTON_WHEEL_RIGHT:
			if event.pressed:
				target_x += wheel_step
		elif event.button_index == MOUSE_BUTTON_RIGHT or event.button_index == MOUSE_BUTTON_MIDDLE:
			_dragging = event.pressed
			_drag_last = event.position
	elif event is InputEventMouseMotion and _dragging:
		target_x -= (event.position.x - _drag_last.x) * 1.4
		_drag_last = event.position


func _process(delta: float) -> void:
	t += delta
	if input_enabled:
		var dir := 0.0
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
			dir -= 1.0
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
			dir += 1.0
		target_x += dir * pan_speed * delta
		# Edge pan while not touching the beast.
		if _mouse_inside and not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and not _dragging:
			var vp := get_viewport()
			var mp := vp.get_mouse_position()
			var w := vp.get_visible_rect().size.x
			if mp.x >= 0.0 and mp.x < edge_margin:
				target_x -= edge_speed * (1.0 - mp.x / edge_margin) * delta
			elif mp.x > w - edge_margin and mp.x <= w:
				target_x += edge_speed * (1.0 - (w - mp.x) / edge_margin) * delta
	var half := get_viewport_rect().size.x * 0.5 / zoom.x
	target_x = clampf(target_x, half, Game.WORLD_WIDTH - half)
	position.x = Game.damp(position.x, target_x, follow_rate, delta)
	position.y = Game.SCREEN.y * 0.5

	# Physical motion.
	trauma = maxf(trauma - delta * 0.9, 0.0)
	bump_v += (-bump_off * 120.0 - bump_v * 10.0) * delta
	bump_off += bump_v * delta
	sway_amt = Game.damp(sway_amt, 0.0, 0.6, delta)
	var e := Game.escalation()
	var shake := trauma * trauma
	var off := Vector2(sin(t * 47.0) + sin(t * 23.0) * 0.5, cos(t * 41.0) + sin(t * 29.0) * 0.5) * shake * 26.0
	var sway := Vector2(sin(t * 1.3), sin(t * 2.1) * 0.6) * (sway_amt * 10.0 + maxf(e - 0.45, 0.0) * 14.0)
	offset = off + bump_off + sway
	rotation = (sin(t * 37.0) * shake * 0.012) + sin(t * 0.9) * maxf(e - 0.6, 0.0) * 0.008


func shake(amount: float) -> void:
	trauma = clampf(maxf(trauma, amount), 0.0, 1.0)


func bump(v: Vector2) -> void:
	bump_v += v * 12.0


func sway(amount: float) -> void:
	sway_amt = clampf(sway_amt + amount, 0.0, 1.5)


func nudge(dx: float) -> void:
	target_x += dx
