class_name LBPlayerHand
extends LBHand
## Bill's hand. Follows the mouse (or WASD) with acceleration, a top speed,
## a little inertia and sharp, responsive stopping so freezing feels instant.
## Hold grab to carry, quick click near a rival to SLAP, keep holding on a
## stunned rival to PIN it, right mouse to retract towards Bill.

signal slap_requested(target: LBHand)
signal grab_requested(obj: LBTableObject)
signal released_object(obj: LBTableObject)

@export_group("Movement")
@export var max_speed := 2.6
@export var accel := 15.0
## Braking is stronger than accelerating: stopping must feel immediate.
@export var decel := 30.0
## How eagerly the hand chases the cursor (1/s).
@export var follow_gain := 8.5
@export var keyboard_speed := 1.6
## Speed cap while holding the creep key (Shift).
@export var creep_speed := 0.3
@export var retract_speed := 3.4
@export var napkin_speed_mult := 0.62
## Moving faster than this throws off a draped napkin.
@export var shake_off_speed := 2.35

@export_group("Hands")
@export var grab_range := 0.15
@export var slap_range := 0.36
@export var slap_cooldown := 0.28
@export var pin_range := 0.2

var camera: Camera3D
var target := Vector2.ZERO
var use_mouse := false            # becomes true on the first mouse motion
var input_enabled := true
var retracting := false
var home := LBConst.BILL_HAND_HOME
var rivals: Array = []            # LBRivalHand list (set by the manager)
var _slap_cd := 0.0
var _grab_down := false
var mouse_on_table := Vector2.ZERO
## Test / bot hook: when set, used instead of the mouse cursor.
var scripted_target: Variant = null


func _init() -> void:
	is_player = true
	owner_index = -1
	sleeve_color = Color(0.86, 0.83, 0.74)
	skin_color = Color(0.9, 0.8, 0.77)
	bare_arm = true
	sleeve_material = LBBillVisual.gown_material()
	radius = 0.1
	push_mass = 1.7


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		use_mouse = true


func control(dt: float) -> void:
	_slap_cd = maxf(_slap_cd - dt, 0.0)
	if not input_enabled or not can_act():
		if pinned_by == null:
			drive(dt, Vector2.ZERO, accel, decel, max_speed)
		_grab_down = false
		return
	var kb := Input.get_vector("lb_left", "lb_right", "lb_up", "lb_down")
	if kb.length() > 0.1:
		use_mouse = false
	var cap := max_speed
	if Input.is_action_pressed("lb_creep"):
		cap = creep_speed
	if cover != null:
		cap *= napkin_speed_mult
	if held != null and not held.is_biscuit():
		# dragging crockery about is slow work
		cap /= 1.0 + held.mass * 0.45
	retracting = Input.is_action_pressed("lb_retract")
	var desired := Vector2.ZERO
	mouse_on_table = _mouse_on_table() if scripted_target == null else scripted_target
	if scripted_target != null:
		use_mouse = true
	if retracting:
		var to_home := home - plane_pos
		desired = to_home.normalized() * minf(retract_speed, to_home.length() * 8.0)
		cap = maxf(cap, retract_speed)
		target = plane_pos
	elif use_mouse:
		target = mouse_on_table
		var to_t := target - plane_pos
		desired = to_t * follow_gain
		if to_t.length() < 0.004:
			desired = Vector2.ZERO
	else:
		desired = kb * (creep_speed if Input.is_action_pressed("lb_creep") else keyboard_speed)
		target = plane_pos
	drive(dt, desired, accel, decel, cap)
	# grab / slap
	if Input.is_action_just_pressed("lb_grab"):
		_grab_down = true
		_on_grab_pressed()
	elif Input.is_action_just_released("lb_grab"):
		_grab_down = false
		_on_grab_released()
	if _grab_down and held == null and pinning == null:
		_try_pin()
	if pinning != null and (not _grab_down or pinning.plane_pos.distance_to(plane_pos) > pin_range * 2.0):
		_unpin()
	if cover != null and speed() > shake_off_speed:
		var n := undrape()
		if n and world:
			n.vel = vel * 0.8
			world.impact.emit(n.plane_pos, 0.25, self, n, "rustle")


func _mouse_on_table() -> Vector2:
	if camera == null:
		return plane_pos
	var mp := get_viewport().get_mouse_position()
	var o := camera.project_ray_origin(mp)
	var d := camera.project_ray_normal(mp)
	var plane_y := LBConst.TABLE_Y + hover_height
	if absf(d.y) < 0.0001:
		return plane_pos
	var t := (plane_y - o.y) / d.y
	if t < 0.0:
		return plane_pos
	var hit := o + d * t
	var p := Vector2(hit.x, hit.z)
	p.x = clampf(p.x, -LBConst.TABLE_HALF_W, LBConst.TABLE_HALF_W)
	p.y = clampf(p.y, -LBConst.TABLE_HALF_L, LBConst.TABLE_HALF_L + 0.12)
	return p


## Move the OS cursor onto the hand so nothing lurches (intro, debug jumps).
func snap_cursor_to_hand() -> void:
	target = plane_pos
	vel = Vector2.ZERO
	if camera and DisplayServer.get_name() != "headless":
		get_viewport().warp_mouse(camera.unproject_position(palm_world()))


func nearest_rival(r: float) -> LBHand:
	var best: LBHand = null
	var bd := r
	for rv in rivals:
		var h := rv as LBHand
		if not h.active or h.reach_scale < 0.9:
			continue
		var d := h.plane_pos.distance_to(plane_pos)
		if d < bd:
			bd = d
			best = h
	return best


func _on_grab_pressed() -> void:
	var rv := nearest_rival(slap_range)
	# a free biscuit under your fingers always wins over slapping someone
	var free_b: LBTableObject = world.nearest_grabbable(plane_pos, grab_range, cover) if world else null
	if free_b != null and free_b.is_biscuit() and free_b.held_by == null:
		grab_requested.emit(free_b)
		return
	if rv != null and _slap_cd <= 0.0 and (rv.stunned_t <= 0.0 or rv.held != null):
		_slap_cd = slap_cooldown
		slap_requested.emit(rv)
		return
	var exclude: Object = cover
	var obj: LBTableObject = world.nearest_grabbable(plane_pos, grab_range, exclude) if world else null
	if obj != null:
		grab_requested.emit(obj)
	elif cover != null:
		var n := undrape()
		if n and world:
			world.impact.emit(n.plane_pos, 0.12, self, n, "rustle")


func _on_grab_released() -> void:
	if held != null:
		# light things can be flicked across the table as a distraction
		var throw := vel * (1.25 if held.mass < 0.3 else 0.5)
		var o := release(throw)
		released_object.emit(o)


func _try_pin() -> void:
	for rv in rivals:
		var h := rv as LBHand
		if h.active and h.stunned_t > 0.0 and h.pinned_by == null and h.plane_pos.distance_to(plane_pos) < pin_range:
			pinning = h
			h.pinned_by = self
			return


func _unpin() -> void:
	if pinning:
		pinning.pinned_by = null
		pinning.stunned_t = maxf(pinning.stunned_t, 0.25)
	pinning = null


func force_release_all() -> void:
	_unpin()
	if held:
		release()
	if cover:
		undrape()
	_grab_down = false
