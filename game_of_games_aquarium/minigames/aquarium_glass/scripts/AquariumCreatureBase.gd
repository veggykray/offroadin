extends Node2D

const AqDrawBase = preload("AqDraw.gd")
## Shared behaviour for every aquarium creature.
##
## Creatures are simple steering agents living in the aquarium "physics world"
## run by AquariumActivity (circles with mass and velocity). Each creature:
##  * thinks (decides a target / state) in _think()
##  * steers smoothly with acceleration & deceleration (never snaps)
##  * reacts to glass stimuli in on_stimulus()
##  * reacts to bumps in on_body_collision()
##  * draws itself procedurally in _draw() (replace with sprites later - see README)
##
## Personality comes from: gaze (eyes look at things, incl. Bill), squash &
## stretch on impacts, blinking, "noticing" hops, and nervousness when the
## thing in the dark is paying attention.

const Stim = preload("GlassStimulus.gd")

@export_group("Body")
## Collision radius (px).
@export var body_radius := 40.0
## Heavier creatures push lighter things around.
@export var body_mass := 1.0

@export_group("Movement")
## Normal top speed (px/s).
@export var max_speed := 120.0
## How quickly it speeds up / slows down (px/s^2). Low = heavy and floaty.
@export var acceleration := 160.0
## Passive slowing when not steering (per second).
@export var water_drag := 1.2
## Distance at which it starts slowing down when arriving at a target.
@export var arrive_radius := 80.0

@export_group("Personality")
## Average seconds between moments where it turns and looks at Bill.
@export var look_at_bill_interval := 18.0
## Narrowest the body gets while turning around (0..1).
@export var min_turn_width := 0.3
## How much it is spooked by the deep creature (0 = not at all).
@export var deep_sensitivity := 1.0

var creature_id := "creature"
var activity: Node = null

var velocity := Vector2.ZERO
var body_enabled := true
var collision_group := ""

var state := "idle"
var state_time := 0.0
var target_pos: Variant = null

## -1 facing left .. +1 facing right (smoothly interpolated: flips look like turns).
var facing := 1.0
var facing_goal := 1.0
## World-ish (activity local) point the eyes look at.
var gaze_point := Vector2.ZERO
var gaze_override_time := 0.0
var blink := 0.0
var blink_timer := 2.0
var anim_t := 0.0
## Squash spring: amount along squash_axis (positive = flattened along axis).
var squash := 0.0
var squash_vel := 0.0
var squash_axis := Vector2.RIGHT
var surprise := 0.0     # 0..1 widened eyes / raised brows
var nervous := 0.0      # 0..1 from the deep creature
var front_scale := 1.0  # >1 when the creature comes right up to the glass
var front_scale_goal := 1.0
var spin := 0.0         # extra rotation for comedic spins
var spin_vel := 0.0

var _bill_look_timer := 0.0
var _stuck_timer := 0.0
var _last_target_dist := INF


func setup(p_activity: Node) -> void:
	activity = p_activity
	gaze_point = position + Vector2(100, 0)
	_bill_look_timer = randf_range(look_at_bill_interval * 0.4, look_at_bill_interval * 1.2)
	blink_timer = randf_range(1.0, 4.0)
	anim_t = randf() * 100.0


## Called by the activity every physics frame.
func tick(delta: float) -> void:
	state_time += delta
	anim_t += delta
	_think(delta)
	_personality(delta)
	_integrate(delta)
	_animate(delta)
	queue_redraw()


# ---------------------------------------------------------------- overridables

func _think(_delta: float) -> void:
	pass


## Return true if the creature meaningfully responded (used by the hint system).
func on_stimulus(_stim) -> bool:
	return false


func on_body_collision(_other, _normal: Vector2, _rel_speed: float) -> void:
	pass


## Called by bastards. Return true if the bite "landed".
func take_bite(_from, _amount: float) -> bool:
	return false


func can_be_bitten() -> bool:
	return false


func bite_priority() -> float:
	return 0.5


func bite_point() -> Vector2:
	return position


## End-of-game: everyone hides while the giant comes.
func retreat() -> void:
	pass


func return_from_retreat() -> void:
	pass


func reset_creature(start: Vector2) -> void:
	position = start
	velocity = Vector2.ZERO
	set_state("idle")
	target_pos = null
	squash = 0.0
	squash_vel = 0.0
	surprise = 0.0
	spin = 0.0
	spin_vel = 0.0
	rotation = 0.0
	front_scale = 1.0
	front_scale_goal = 1.0
	visible = true
	body_enabled = true


func get_debug_text() -> String:
	return "%s: %s" % [creature_id, state]


# ---------------------------------------------------------------- helpers

func set_state(s: String) -> void:
	if s != state:
		state = s
		state_time = 0.0


func swim_rect() -> Rect2:
	return activity.get_swim_rect(body_radius)


func clamp_to_swim(p: Vector2) -> Vector2:
	var r := swim_rect()
	return Vector2(clampf(p.x, r.position.x, r.end.x), clampf(p.y, r.position.y, r.end.y))


func random_swim_point(margin := 0.0, y_min_frac := 0.0, y_max_frac := 1.0) -> Vector2:
	var r := swim_rect().grow(-margin)
	if r.size.x <= 0 or r.size.y <= 0:
		r = swim_rect()
	return Vector2(randf_range(r.position.x, r.end.x),
		lerpf(r.position.y, r.end.y, randf_range(y_min_frac, y_max_frac)))


## Smooth seek with arrival. Returns remaining distance.
func steer_to(point: Vector2, delta: float, speed_scale := 1.0, accel_scale := 1.0) -> float:
	var to := point - position
	var dist := to.length()
	var speed := max_speed * speed_scale
	if dist < arrive_radius:
		speed *= dist / arrive_radius
	var desired := Vector2.ZERO if dist < 1.0 else to / dist * speed
	velocity = velocity.move_toward(desired, acceleration * accel_scale * delta)
	return dist


func brake(delta: float, amount := 1.0) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, acceleration * amount * delta)


func look_at_point(p: Vector2, duration := 1.0) -> void:
	gaze_point = p
	gaze_override_time = duration


func look_at_bill(duration := 1.6) -> void:
	if activity:
		look_at_point(activity.get_bill_point(), duration)


func impact(normal: Vector2, amount: float) -> void:
	squash_axis = normal.normalized() if normal != Vector2.ZERO else Vector2.RIGHT
	squash_vel += amount * 9.0


func notice(p: Vector2, amount := 0.6) -> void:
	look_at_point(p, 1.2)
	surprise = maxf(surprise, amount)
	squash_axis = Vector2.UP
	squash_vel -= amount * 3.0


func bill_is_near(p: Vector2, dist := 260.0) -> bool:
	return activity != null and p.distance_to(activity.get_bill_point()) < dist


# ---------------------------------------------------------------- internals

func _personality(delta: float) -> void:
	# Blink.
	blink_timer -= delta
	if blink_timer <= 0.0:
		blink = 1.0
		blink_timer = randf_range(1.8, 5.0) * (0.5 if nervous > 0.5 else 1.0)
	blink = move_toward(blink, 0.0, delta * 7.0)
	surprise = move_toward(surprise, 0.0, delta * 0.8)

	# Gaze: override (looking at something specific) or along the swim direction.
	if gaze_override_time > 0.0:
		gaze_override_time -= delta
	else:
		var ahead := position + Vector2(facing * 140.0, 0) + velocity * 0.6
		gaze_point = gaze_point.lerp(ahead, clampf(delta * 3.0, 0, 1))

	# Occasionally look at Bill (the creatures know he is there).
	_bill_look_timer -= delta
	if _bill_look_timer <= 0.0:
		_bill_look_timer = randf_range(look_at_bill_interval * 0.6, look_at_bill_interval * 1.4)
		if state_allows_bill_look():
			look_at_bill(randf_range(1.2, 2.2))
			front_scale_goal = 1.06

	# The deep creature makes everyone uneasy.
	if activity:
		var target_nerv: float = activity.get_deep_nervousness() * deep_sensitivity
		nervous = move_toward(nervous, target_nerv, delta * 0.5)
		if nervous > 0.35 and randf() < delta * 0.25 * nervous and gaze_override_time <= 0.0:
			look_at_point(activity.get_deep_position(), 0.9)


func state_allows_bill_look() -> bool:
	return state == "idle"


func _integrate(delta: float) -> void:
	velocity *= exp(-water_drag * delta * 0.25)
	position += velocity * delta
	# Soft bounds: keep creatures inside the water.
	var r := swim_rect()
	if position.x < r.position.x:
		position.x = r.position.x
		if velocity.x < 0: _on_bounds_hit(Vector2.RIGHT, -velocity.x); velocity.x *= -0.3
	elif position.x > r.end.x:
		position.x = r.end.x
		if velocity.x > 0: _on_bounds_hit(Vector2.LEFT, velocity.x); velocity.x *= -0.3
	if position.y < r.position.y:
		position.y = r.position.y
		if velocity.y < 0: _on_bounds_hit(Vector2.DOWN, -velocity.y); velocity.y *= -0.3
	elif position.y > r.end.y:
		position.y = r.end.y
		if velocity.y > 0: _on_bounds_hit(Vector2.UP, velocity.y); velocity.y *= -0.3


func _on_bounds_hit(_normal: Vector2, _speed: float) -> void:
	pass


func _animate(delta: float) -> void:
	if absf(velocity.x) > 22.0:
		facing_goal = signf(velocity.x)
	if gaze_override_time > 0.0 and velocity.length() < 40.0:
		var gx := gaze_point.x - position.x
		if absf(gx) > 30.0:
			facing_goal = signf(gx)
	# Turning = squashing through a narrow profile (a classic 2D fish turn),
	# but never paper-thin.
	if facing != facing_goal:
		var f := move_toward(absf(facing) * signf(facing), facing_goal, delta * 5.0)
		if signf(f) != signf(facing) or absf(f) < min_turn_width:
			f = min_turn_width * facing_goal
		facing = f
	# Squash spring.
	var k := 140.0
	var damping := 9.0
	squash_vel += (-k * squash - damping * squash_vel) * delta
	squash += squash_vel * delta
	squash = clampf(squash, -0.45, 0.45)
	# Spin.
	spin += spin_vel * delta
	spin_vel = move_toward(spin_vel, 0.0, delta * 2.0)
	if absf(spin_vel) < 0.01:
		spin = lerp_angle(spin, 0.0, clampf(delta * 3.0, 0, 1))
	front_scale = lerpf(front_scale, front_scale_goal, clampf(delta * 3.0, 0, 1))
	if gaze_override_time <= 0.0:
		front_scale_goal = 1.0
	# Stuck detection on targets (gentle recovery, never a teleport).
	if target_pos != null:
		var d := position.distance_to(target_pos)
		if d > _last_target_dist - 0.5 and velocity.length() < 25.0 and d > arrive_radius:
			_stuck_timer += delta
		else:
			_stuck_timer = maxf(0.0, _stuck_timer - delta)
		_last_target_dist = d
		if _stuck_timer > 2.5:
			_stuck_timer = 0.0
			_on_stuck()
	else:
		_stuck_timer = 0.0
		_last_target_dist = INF


## Default stuck response: wiggle free upward / sideways.
func _on_stuck() -> void:
	var side := Vector2(randf_range(-1, 1), -1.0).normalized()
	velocity += side * max_speed * 1.2


## Transform for drawing the body: squash + facing flip + spin + front scale.
func body_transform(tilt := 0.0, flip := true) -> Transform2D:
	var t := Transform2D.IDENTITY
	# Squash along axis (in local, unrotated space).
	var a := squash_axis.angle()
	var s := Transform2D(a, Vector2.ZERO)
	var sc := Transform2D.IDENTITY.scaled(Vector2(1.0 - squash, 1.0 + squash * 0.8))
	t = s * sc * s.affine_inverse()
	var fs := front_scale * (1.0 + nervous * 0.03 * sin(anim_t * 40.0))
	var f := Transform2D(spin + tilt, Vector2.ZERO).scaled(Vector2(fs, fs))
	if flip:
		f = f * Transform2D.IDENTITY.scaled(Vector2(facing, 1.0))
	return t * f


## Draw an eye at body-space position `p` (already in drawing space).
func draw_eye(p: Vector2, r: float, xf: Transform2D, lid := 0.0, pupil_frac := 0.5,
		sclera := Color(0.97, 0.96, 0.9), pupil := Color(0.05, 0.05, 0.08)) -> void:
	var world := xf * p
	var look := (gaze_point - position)
	var look_dir := look.normalized() if look.length() > 1.0 else Vector2.ZERO
	var big := r * (1.0 + surprise * 0.25)
	draw_circle(world, big, sclera)
	var pr := big * pupil_frac * (1.0 - surprise * 0.35)
	draw_circle(world + look_dir * (big - pr) * 0.75, pr, pupil)
	draw_circle(world + look_dir * (big - pr) * 0.75 + Vector2(-pr * 0.35, -pr * 0.35), pr * 0.3, Color(1, 1, 1, 0.8))
	var l := clampf(maxf(lid, blink), 0.0, 1.0)
	if l > 0.02:
		# Eyelid: a filled top segment.
		var pts := PackedVector2Array()
		var steps := 12
		var cover := lerpf(-big, big, l)
		for i in steps + 1:
			var ang := PI + PI * float(i) / steps
			pts.append(world + Vector2(cos(ang), sin(ang)) * big * 1.05)
		pts.append(world + Vector2(big * 1.05, cover))
		pts.append(world + Vector2(-big * 1.05, cover))
		AqDrawBase.poly(self, pts, lid_color())


func lid_color() -> Color:
	return Color(0.3, 0.2, 0.2)


static func ellipse_points(center: Vector2, rx: float, ry: float, n := 32, wobble := 0.0, phase := 0.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := TAU * float(i) / n
		var w := 1.0 + wobble * sin(a * 3.0 + phase) * 0.5 + wobble * sin(a * 5.0 - phase * 1.3) * 0.3
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry) * w)
	return pts


static func xform_points(xf: Transform2D, pts: PackedVector2Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	out.resize(pts.size())
	for i in pts.size():
		out[i] = xf * pts[i]
	return out
