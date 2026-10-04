extends Node2D
## The shopping trolley: arcade momentum movement + the physical basket.
##
## The trolley does NOT read the keyboard. ShroomTrolleyActivity asks the
## TrolleyPlayerAdapter for an input axis and passes it to step() each physics
## frame. That keeps this script independent of any particular player.
##
## Local coordinates: origin = on the floor, centred between the wheels.
## Negative Y is up (Godot 2D). Bill stands on the LEFT holding the handle and
## pushes right / pulls left.

signal crashed(speed: float)
signal bashed(direction: int)
signal skid_started(speed: float)

# --- Basket geometry (local pixels). Cargo layout + catching use these. -----
## Overall size of the trolley. Every measurement below is multiplied by this,
## so if the trolley looks too small/big next to your Bill, change THIS number
## (and scale the mushroom radii in types/*.tres to match).
const S := 1.25
const FLOOR_Y := -42.0 * S          ## inner basket floor surface
const RIM_Y := -98.0 * S            ## top edge of the basket walls
const INNER_HALF_BOTTOM := 50.0 * S
const INNER_HALF_TOP := 62.0 * S
const WALL_THICK := 7.0 * S
const WHEEL_X := 48.0 * S
const WHEEL_R := 10.0 * S
const HANDLE_GRIP := Vector2(-90.0, -120.0) * S
## How far the trolley + Bill stick out from the trolley origin. Used to keep the
## whole thing inside the play area.
const EXTENT_LEFT := 128.0 * S
const EXTENT_RIGHT := 70.0 * S
## How far the basket tips forward when dumping (radians).
const TIP_ANGLE := 0.62

# --- Movement tuning (pixels, seconds) --------------------------------------
@export_group("Speed")
@export var max_speed := 660.0
## Push acceleration with an empty trolley at low speed.
@export var accel := 1650.0
## 0..1 how much push fades out near top speed (makes top speed "soft").
@export var accel_falloff := 0.7
## Rolling resistance when no key is held. Low = more momentum.
@export var coast_decel := 380.0
@export_group("Braking")
## Braking force when pushing the opposite way...
@export var brake_decel := 900.0
## ...plus this much extra per pixel/sec of speed. Big = violent high-speed stops.
@export var brake_speed_factor := 3.6
## Above this speed a reversal becomes a skid (fishtail, Bill's feet slide).
@export var skid_speed := 300.0
## Short weak-push window after stopping from a reversal (the "reversal delay").
@export var regrip_time := 0.16
@export_group("Load")
## Each unit of cargo weight adds this much to the trolley's effective mass.
@export var mass_per_load := 0.065
## Max-speed loss per unit of cargo weight (fraction), capped at 25%.
@export var top_speed_loss_per_load := 0.01
@export_group("Push feel")
## Time for Bill to "lean into" a push. Tapping = gentle control.
@export var push_ramp_time := 0.18
## Time for Bill to dig his heels in when braking. Tapping = gentle braking,
## holding = full emergency stop (which the load really feels).
@export var brake_ramp_time := 0.15
@export_group("Bash")
@export var bash_cooldown := 0.55
@export var bash_boost := 330.0
@export var bash_duration := 0.16
@export_group("Crash")
## Hitting the play-area edge faster than this counts as a crash.
@export var crash_speed := 170.0
@export var crash_restitution := 0.25

# --- Live state (read by other systems / debug) ------------------------------
var velocity := 0.0
## Change in velocity this frame (pixels/sec). Drives cargo sway + spilling.
var last_dv := 0.0
## The part of last_dv that came from a bash this frame.
var last_bash_dv := 0.0
## Smoothed acceleration, for debug + visuals.
var accel_now := 0.0
var input_axis := 0.0
var facing := 1
var skidding := false
var braking := false
var load_mass := 0.0
var min_x := -1.0e9
var max_x := 1.0e9
var bash_timer := 0.0
var bash_cd := 0.0
## 0..1, set by the activity while dumping at the checkout.
var tip := 0.0
var controls_locked := false

# --- Visual springs -----------------------------------------------------------
var lean := 0.0
var _lean_v := 0.0
var susp := 0.0
var _susp_v := 0.0
var shove := 0.0
var _shove_v := 0.0
var wobble := 0.0
var wheel_angle := 0.0
var rattle := 0.0
var _t := 0.0
var _push := 0.0
var _push_dir := 0.0
var _regrip := 0.0
var _was_skidding := false

@onready var body: AnimatableBody2D = $Body
@onready var _front_wall: CollisionShape2D = $Body/FrontWall
@onready var _back_wall: CollisionShape2D = $Body/BackWall


func _ready() -> void:
	body.sync_to_physics = false  # we move the parent node ourselves
	_build_collision()


func _build_collision() -> void:
	var mat := PhysicsMaterial.new()
	mat.bounce = 0.05
	mat.friction = 0.9
	body.physics_material_override = mat
	_set_rect($Body/BasketFloor, Vector2(0, FLOOR_Y + 4.0), Vector2(INNER_HALF_BOTTOM * 2.0 + WALL_THICK * 2.0, 8.0), 0.0)
	var wall_len := Vector2(INNER_HALF_TOP - INNER_HALF_BOTTOM, RIM_Y - FLOOR_Y).length() + 8.0
	var wall_ang := atan2(INNER_HALF_TOP - INNER_HALF_BOTTOM, -(RIM_Y - FLOOR_Y))
	var mid_y := (FLOOR_Y + RIM_Y) * 0.5
	var mid_x := (INNER_HALF_TOP + INNER_HALF_BOTTOM) * 0.5 + WALL_THICK * 0.5
	_set_rect(_front_wall, Vector2(mid_x, mid_y - 2.0), Vector2(WALL_THICK, wall_len), wall_ang)
	_set_rect(_back_wall, Vector2(-mid_x, mid_y - 2.0), Vector2(WALL_THICK, wall_len), -wall_ang)
	_set_rect($Body/Chassis, Vector2(0, -22.0 * S), Vector2(WHEEL_X * 2.0 + 16.0 * S, 22.0 * S), 0.0)
	# An invisible "Bill" bumper so mushrooms bounce off Bill's head/body whatever
	# the real Bill's collision is like.
	var cap := CapsuleShape2D.new()
	cap.radius = 17.0 * S
	cap.height = 112.0 * S
	var bill: CollisionShape2D = $Body/BillBumper
	bill.shape = cap
	bill.position = Vector2(-112.0, -64.0) * S


func _set_rect(cs: CollisionShape2D, pos: Vector2, size: Vector2, rot: float) -> void:
	var r := RectangleShape2D.new()
	r.size = size
	cs.shape = r
	cs.position = pos
	cs.rotation = rot


func set_collision(layer: int, mask: int) -> void:
	body.collision_layer = layer
	body.collision_mask = mask


func set_bounds(new_min_x: float, new_max_x: float) -> void:
	min_x = new_min_x
	max_x = new_max_x


func set_front_wall_enabled(on: bool) -> void:
	_front_wall.set_deferred("disabled", not on)


# --- Movement --------------------------------------------------------------

func mass_factor() -> float:
	return 1.0 + load_mass * mass_per_load


func effective_max_speed() -> float:
	return max_speed * (1.0 - minf(0.25, load_mass * top_speed_loss_per_load))


func can_bash() -> bool:
	return bash_cd <= 0.0 and not controls_locked


## Advance the trolley one physics frame. `axis` is -1..1 (left/right push).
func step(delta: float, axis: float, bash_pressed: bool) -> void:
	_t += delta
	if controls_locked:
		axis = 0.0
		bash_pressed = false
	input_axis = axis
	bash_cd = maxf(0.0, bash_cd - delta)
	bash_timer = maxf(0.0, bash_timer - delta)
	_regrip = maxf(0.0, _regrip - delta)

	var want := signf(axis) if absf(axis) > 0.2 else 0.0
	if want != 0.0:
		if want != _push_dir:
			_push = 0.0
			_push_dir = want
		var ramp := push_ramp_time
		if velocity != 0.0 and signf(velocity) != want:
			ramp = brake_ramp_time
		_push = minf(1.0, _push + delta / ramp)
		facing = int(want)
	else:
		_push = 0.0
		_push_dir = 0.0

	var m := mass_factor()
	var v := velocity
	var speed := absf(v)
	var vmax := effective_max_speed()
	var a := 0.0
	braking = false
	var stop_at_zero := false

	if want != 0.0 and (speed < 8.0 or signf(v) == want):
		var frac := clampf(speed / vmax, 0.0, 1.0)
		var push := accel * (1.0 - accel_falloff * frac * frac) / m
		if _regrip > 0.0:
			push *= 0.3
		a = want * push * lerpf(0.4, 1.0, _push) * absf(axis)
		if speed > vmax:  # over top speed (after a bash): bleed it off
			a = -signf(v) * coast_decel * 1.5
		skidding = false
	elif want != 0.0:
		braking = true
		var brake := (brake_decel + speed * brake_speed_factor) / pow(m, 0.4)
		a = want * brake * lerpf(0.22, 1.0, _push * _push)
		skidding = speed > skid_speed
		stop_at_zero = true
	else:
		a = -signf(v) * coast_decel / sqrt(m)
		skidding = false
		stop_at_zero = true

	if skidding and not _was_skidding:
		skid_started.emit(speed)
		wobble = 1.0
	_was_skidding = skidding

	var new_v := v + a * delta
	if stop_at_zero and v != 0.0 and signf(new_v) != signf(v):
		new_v = 0.0
		if braking:
			_regrip = regrip_time * (1.0 if speed > skid_speed * 0.5 else 0.4)

	var bash_dv := 0.0
	if bash_pressed and can_bash():
		bash_cd = bash_cooldown
		bash_timer = bash_duration
		var dir := facing
		var before := new_v
		new_v = clampf(new_v + dir * bash_boost, -vmax * 1.35, vmax * 1.35)
		bash_dv = new_v - before
		_shove_v += dir * 420.0
		_susp_v -= 60.0
		bashed.emit(dir)

	# integrate position + play-area bounds
	var x := position.x + new_v * delta
	if x < min_x or x > max_x:
		x = clampf(x, min_x, max_x)
		if absf(new_v) > crash_speed:
			crashed.emit(absf(new_v))
			_susp_v -= absf(new_v) * 0.25
			_lean_v += signf(new_v) * 6.0
			new_v = -new_v * crash_restitution
		else:
			new_v = 0.0
	position.x = x

	last_dv = new_v - v
	last_bash_dv = bash_dv
	velocity = new_v
	accel_now = lerpf(accel_now, last_dv / maxf(delta, 0.0001), 0.25)
	_update_visual_springs(delta)


func _update_visual_springs(delta: float) -> void:
	# Lean back when accelerating, dip forward when braking.
	var target := clampf(-accel_now * 0.00006, -0.13, 0.13)
	_lean_v += (220.0 * (target - lean) - 13.0 * _lean_v) * delta
	lean += _lean_v * delta
	lean = clampf(lean, -0.3, 0.3)
	# Suspension: sags with load, bounces on catches.
	var sag := minf(load_mass * 0.85, 13.0)
	_susp_v += (300.0 * (sag - susp) - 11.0 * _susp_v) * delta
	susp += _susp_v * delta
	susp = clampf(susp, -25.0, 30.0)
	_shove_v += (-500.0 * shove - 20.0 * _shove_v) * delta
	shove += _shove_v * delta
	wobble = maxf(0.0, wobble - delta * (0.9 if skidding else 2.2))
	if skidding:
		wobble = maxf(wobble, 0.6)
	wheel_angle += velocity * delta / WHEEL_R
	var sp := absf(velocity) / max_speed
	rattle = clampf((sp - 0.45) / 0.55, 0.0, 1.0)


## Catch / impact bounce. strength ~1 for a normal mushroom landing.
func add_thump(strength: float) -> void:
	_susp_v += 70.0 * strength
	_lean_v += randf_range(-0.4, 0.4) * strength


func add_shake(strength: float) -> void:
	_lean_v += randf_range(-1.0, 1.0) * strength
	_susp_v += 30.0 * strength


# --- Coordinate helpers -----------------------------------------------------

## Transform of the (leaning, bouncing, tipping) basket in trolley-local space.
func basket_transform() -> Transform2D:
	var rattle_y := sin(_t * 47.0) * rattle * 1.4
	var pivot := Vector2(0, -WHEEL_R)
	var xf := Transform2D(0.0, Vector2(shove, susp + rattle_y))
	xf = xf * Transform2D(0.0, pivot) * Transform2D(lean + sin(_t * 31.0) * wobble * 0.03, Vector2.ZERO) * Transform2D(0.0, -pivot)
	if tip > 0.0:
		var front := Vector2(WHEEL_X + 6.0 * S, -WHEEL_R)
		xf = xf * Transform2D(0.0, front) * Transform2D(tip * TIP_ANGLE, Vector2.ZERO) * Transform2D(0.0, -front)
	return xf


func basket_to_global(local_point: Vector2) -> Vector2:
	return global_transform * (basket_transform() * local_point)


func global_to_trolley(p: Vector2) -> Vector2:
	## World point -> trolley local (ignores lean; used for catching).
	return global_transform.affine_inverse() * p


func get_handle_global_position() -> Vector2:
	return basket_to_global(HANDLE_GRIP)


func get_trolley_velocity() -> Vector2:
	return Vector2(velocity, 0.0)


func inner_half_width_at(local_y: float) -> float:
	var t := clampf((local_y - FLOOR_Y) / (RIM_Y - FLOOR_Y), 0.0, 1.0)
	return lerpf(INNER_HALF_BOTTOM, INNER_HALF_TOP, t)


func _process(_delta: float) -> void:
	for c in get_children():
		if c is CanvasItem and c.has_method("refresh"):
			c.refresh()
