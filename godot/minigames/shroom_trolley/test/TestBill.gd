extends CharacterBody2D
## TEST-ONLY placeholder Bill. Not needed in the real game.
##
## Shows exactly what the real Bill needs to do to work with the mini-game:
##   * walk around normally when not pushing (his own controls)
##   * implement the OPTIONAL hooks set_trolley_mode() / update_trolley_pose()
##   * that's it. The TrolleyPlayerAdapter does the rest.
## The origin of this node is at Bill's FEET.

signal grab_requested

@export var walk_speed := 260.0
@export var gravity := 2000.0

var pushing := false
var pose := {}
var _walk_phase := 0.0
var _t := 0.0
var _face := 1.0


# --- Hooks called by TrolleyPlayerAdapter ------------------------------------

func set_trolley_mode(active: bool, _trolley: Node2D) -> void:
	pushing = active
	velocity = Vector2.ZERO
	pose = {}


func update_trolley_pose(info: Dictionary) -> void:
	pose = info


func get_scan_id() -> StringName:
	return &"bill"


# --- Normal (non-trolley) behaviour --------------------------------------------

func _physics_process(delta: float) -> void:
	_t += delta
	if pushing:
		_walk_phase += absf(pose.get("velocity", 0.0)) * delta * 0.045
		queue_redraw()
		return
	var axis := 0.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		axis -= 1.0
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		axis += 1.0
	velocity.x = axis * walk_speed
	velocity.y += gravity * delta
	move_and_slide()
	if axis != 0.0:
		_face = signf(axis)
		_walk_phase += delta * 10.0
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if pushing:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_E:
		grab_requested.emit()


# --- Placeholder art ------------------------------------------------------------

const ART := 1.3  # drawing scale of the placeholder


func _draw() -> void:
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(ART, ART))
	_draw_bill()


func _draw_bill() -> void:
	var lean := 0.0
	var hand := Vector2(22, -62)  # where the hand goes (feet space)
	var leg_swing := sin(_walk_phase) * 10.0
	var skid := false
	var face := _face
	if pushing:
		face = 1.0
		var v: float = pose.get("velocity", 0.0)
		var sp: float = pose.get("speed01", 0.0)
		lean = 0.1 + sp * 0.3 if v > 10.0 else (-0.1 - sp * 0.15 if v < -10.0 else 0.05)
		hand = Vector2(14, -150) / ART  # on the trolley handle
		skid = pose.get("skidding", false)
		if skid:
			lean = -0.32 * signf(v)
			leg_swing = 16.0 * signf(v)
		if pose.get("bashing", false):
			lean = 0.5
		if pose.get("dumping", false):
			lean = 0.35
		if absf(v) < 10.0:
			leg_swing = 0.0
	elif absf(velocity.x) < 1.0:
		leg_swing = 0.0
	var skin := Color(1, 0.8, 0.65)
	var shirt := Color(0.25, 0.55, 0.9)
	var overall := Color(0.3, 0.35, 0.55)
	var hip := Vector2(0, -48)
	var sx := Vector2(face, 1)
	# legs
	draw_line(hip, Vector2(-8 + leg_swing, -4) * sx, overall, 9.0)
	draw_line(hip, Vector2(8 - leg_swing, -4) * sx, overall.darkened(0.2), 9.0)
	draw_circle(Vector2(-6 + leg_swing, -3) * sx, 7, Color(0.25, 0.15, 0.1))
	draw_circle(Vector2(10 - leg_swing, -3) * sx, 7, Color(0.25, 0.15, 0.1))
	# upper body rotates around the hip
	var body_xf := Transform2D(lean * face, hip) * Transform2D(0.0, sx, 0.0, Vector2.ZERO)
	draw_set_transform_matrix(Transform2D(0.0, Vector2(ART, ART), 0.0, Vector2.ZERO) * body_xf)
	draw_rect(Rect2(-16, -50, 32, 52), shirt)
	draw_rect(Rect2(-14, -30, 28, 32), overall)
	draw_circle(Vector2(0, -66), 19, skin)
	draw_circle(Vector2(15, -64), 6, skin.darkened(0.1))  # nose
	draw_circle(Vector2(6, -71), 2.6, Color(0.1, 0.1, 0.1))
	draw_rect(Rect2(-20, -90, 40, 12), Color(0.85, 0.2, 0.2))  # cap
	draw_rect(Rect2(8, -84, 18, 6), Color(0.85, 0.2, 0.2))
	if skid:
		draw_string(ThemeDB.fallback_font, Vector2(-10, -100), "!!", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1, 0.3, 0.2))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(ART, ART))
	# arm: shoulder follows the body, hand goes to the handle
	var shoulder := body_xf * Vector2(0, -40)
	var h := hand * sx
	draw_line(shoulder, h, skin, 7.0)
	draw_circle(h, 6, skin)
