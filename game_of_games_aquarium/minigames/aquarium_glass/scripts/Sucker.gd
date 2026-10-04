extends "AquariumCreatureBase.gd"

const AqDraw = preload("AqDraw.gd")
## THE SUCKER - flat, bizarre squid/ray thing.
##
## RUB the glass: it becomes interested, swims to the rubbing and SPLATS onto
## the inside of the glass, squashing its ridiculous underside against it.
## Keep rubbing nearby and it slides along the glass after your finger
## (squeak). Rub somewhere far away and it peels off and follows.
## Left alone it peels off after a while. Knocks and bites knock it off.
## While stuck to the glass it is very heavy, so it works as a wall/blocker.

## Rubs further away than this are ignored.
@export var rub_attention_radius := 1500.0
## Speed while approaching a rub (px/s).
@export var approach_speed := 210.0
## While attached, rubs within this distance make it slide after the finger.
@export var follow_radius := 260.0
## Slide speed along the glass (px/s).
@export var slide_speed := 190.0
## Seconds it stays stuck after the last nearby rub.
@export var attach_duration := 7.0
## Mass while stuck to the glass (acts as a blocker).
@export var attached_mass := 60.0

var _rub_point: Variant = null
var _last_rub_time := -100.0
var _attach_amount := 0.0
var _peel := 0.0
var _slide_squeak_cd := 0.0
var _retreating := false
var _drift_target := Vector2.ZERO
var _spontaneous := false
var _near_bill := false
var _base_mass := 3.0
var _base_radius := 40.0


func _init() -> void:
	body_radius = 40.0
	body_mass = 3.0
	max_speed = 80.0
	acceleration = 160.0
	water_drag = 1.5
	arrive_radius = 70.0
	look_at_bill_interval = 20.0
	deep_sensitivity = 1.0


func setup(p_activity: Node) -> void:
	super.setup(p_activity)
	creature_id = "sucker"
	_base_mass = body_mass
	_base_radius = body_radius


func reset_creature(start: Vector2) -> void:
	super.reset_creature(start)
	_rub_point = null
	_attach_amount = 0.0
	_retreating = false
	_drift_target = start
	body_mass = _base_mass
	body_radius = _base_radius
	z_index = 4


func get_debug_text() -> String:
	return "sucker: %s" % state


func is_attached() -> bool:
	return state == "attached"


func on_stimulus(stim) -> bool:
	if _retreating:
		return false
	var d: float = position.distance_to(stim.position)
	match stim.kind:
		Stim.Kind.RUB:
			if d > rub_attention_radius:
				return false
			_last_rub_time = activity.activity_time
			_spontaneous = false
			if state == "attached":
				if d <= follow_radius:
					_rub_point = stim.position
					return true
				_detach(false)
			_rub_point = stim.position
			if state != "approach":
				notice(stim.position, 0.5)
				set_state("approach")
			return true
		Stim.Kind.HARD_KNOCK:
			if d < stim.radius:
				if state == "attached":
					_detach(true)
				velocity += (position - stim.position).normalized() * 160.0
				return true
		Stim.Kind.DOUBLE_TAP, Stim.Kind.SINGLE_TAP:
			if d < 120.0:
				look_at_point(stim.position, 0.6)
				if state == "attached":
					impact(Vector2.UP, 0.15)
	return false


func _think(delta: float) -> void:
	_slide_squeak_cd -= delta
	_peel = move_toward(_peel, 0.0, delta * 2.5)
	var want_attach := 1.0 if state == "attached" else 0.0
	_attach_amount = move_toward(_attach_amount, want_attach, delta * (5.0 if want_attach > 0.5 else 3.0))
	match state:
		"idle", "drift":
			if state_time > 6.0 or position.distance_to(_drift_target) < 30.0:
				_drift_target = random_swim_point(80.0, 0.0, 0.6)
				state_time = 0.0
			steer_to(_drift_target, delta, 0.6)
		"approach":
			if _rub_point == null:
				set_state("drift")
			else:
				var d := steer_to(clamp_to_swim(_rub_point), delta, approach_speed / max_speed, 2.0)
				look_at_point(_rub_point, 0.2)
				if d < 34.0:
					_attach()
				elif activity.activity_time - _last_rub_time > 6.0 and not _spontaneous:
					set_state("drift")
		"attached":
			if _rub_point != null and activity.activity_time - _last_rub_time < 0.4:
				var to: Vector2 = clamp_to_swim(_rub_point) - position
				if to.length() > 6.0:
					velocity = to.normalized() * minf(slide_speed, to.length() * 4.0)
					if _slide_squeak_cd <= 0.0:
						_slide_squeak_cd = 0.35
						activity.audio.play("sucker_attach", -16.0, 1.6 + randf() * 0.3)
				else:
					velocity = Vector2.ZERO
			else:
				velocity = velocity.move_toward(Vector2.ZERO, 600.0 * delta)
			_near_bill = bill_is_near(position, 300.0)
			if _near_bill:
				look_at_bill(0.3)
			var hold := attach_duration * (0.5 if _spontaneous else 1.0)
			if activity.activity_time - _last_rub_time > hold and state_time > 1.5:
				_detach(false)
		"peel":
			velocity = velocity.move_toward(Vector2(0, -30), 200.0 * delta)
			if state_time > 0.5:
				set_state("drift")
		"retreat":
			steer_to(_retreat_point(), delta, 1.0)
	body_mass = attached_mass if state == "attached" else _base_mass
	body_radius = _base_radius * (1.0 + 0.3 * _attach_amount)
	z_index = 8 if _attach_amount > 0.5 else 4


func _attach() -> void:
	set_state("attached")
	velocity = Vector2.ZERO
	impact(Vector2.UP, 0.45)
	surprise = 0.6
	activity.audio.play("sucker_attach", -2.0, randf_range(0.9, 1.05))
	activity.glass_fx.add_ripple(position, 0.3, 120.0)
	activity.glass_fx.add_smudge(position, 60.0)
	activity.notify_creature_event("sucker_attach", self, {"pos": position})


func _detach(knocked: bool) -> void:
	set_state("peel")
	_peel = 1.0
	_spontaneous = false
	activity.audio.play("sucker_attach", -8.0, 0.7)
	if knocked:
		spin_vel = 6.0 * (1.0 if randf() > 0.5 else -1.0)
		surprise = 1.0


func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
	if other is Dictionary:
		return
	if state == "attached" and rel_speed > 260.0 and other == activity.coward:
		_detach(true)
		velocity = normal * 180.0
	elif rel_speed > 120.0:
		impact(normal, 0.2)


func take_bite(_from, _amount: float) -> bool:
	if state == "attached" and randf() < 0.08:
		_detach(true)
	surprise = 0.7
	return true


func can_be_bitten() -> bool:
	return true


func bite_priority() -> float:
	return 0.7


## Hint: spontaneously stick to the glass for a moment somewhere visible.
func hint_attach_somewhere(p: Vector2) -> void:
	_rub_point = p
	_last_rub_time = activity.activity_time
	_spontaneous = true
	set_state("approach")


func retreat() -> void:
	_retreating = true
	if state == "attached":
		_detach(false)
	set_state("retreat")


func return_from_retreat() -> void:
	_retreating = false
	set_state("drift")


func _retreat_point() -> Vector2:
	var r := swim_rect()
	return Vector2(r.end.x - 40.0, r.position.y + 10.0)


# ------------------------------------------------------------- drawing

func _draw() -> void:
	var a := _attach_amount
	var swim := anim_t * 2.4
	var xf := body_transform(clampf(velocity.x / 600.0, -0.3, 0.3), false)
	var r := 40.0
	var spread := 1.0 + 0.45 * a
	# Tentacles (trailing; when attached they splay out flat).
	for k in 5:
		var base_ang := lerpf(PI * 0.3, PI * 0.7, float(k) / 4.0)
		var pts := PackedVector2Array()
		for i in 8:
			var tt := float(i) / 7.0
			var trail := Vector2(cos(base_ang), sin(base_ang)) * (r * 0.6 + tt * r * 1.2)
			var trail_flat := Vector2(cos(base_ang * 2.0 - PI * 0.5 + PI * 0.5), sin(base_ang)) * (r * 0.7 + tt * r * 1.0)
			var p := trail.lerp(trail_flat, a)
			p += Vector2(sin(swim + tt * 4.0 + k) * 7.0 * tt, 0) - velocity * 0.05 * tt
			pts.append(xf * p)
		draw_polyline(pts, Color(0.7, 0.35, 0.6, 0.9), 4.0 - a)
		if a > 0.3:
			for i in range(2, 8, 2):
				draw_circle(pts[i], 3.0 * a, Color(1.0, 0.75, 0.85, a))
	# Mantle (disc with a frilly, rippling edge). Pressed flat when attached.
	var mantle := PackedVector2Array()
	var nseg := 40
	for i in nseg:
		var ang := TAU * float(i) / nseg
		var frill := sin(ang * 7.0 + swim * 2.0) * (5.0 * (1.0 - a) + 1.5)
		var rx := r * 1.3 * spread + frill
		var ry := r * 0.55 * (1.0 + a * 0.8) + frill * 0.5
		if _peel > 0.0:
			ry *= 1.0 + _peel * 0.3 * sin(ang)
		mantle.append(Vector2(cos(ang) * rx, sin(ang) * ry))
	var top_col := Color(0.62, 0.3, 0.62)
	var under_col := Color(0.98, 0.78, 0.85)
	AqDraw.poly(self, xform_points(xf, mantle), top_col.lerp(under_col, a * 0.85))
	# Pattern: rings on top / suckers underneath.
	if a < 0.5:
		for s in [Vector2(-0.6, -0.1), Vector2(0.0, -0.25), Vector2(0.6, -0.1), Vector2(-0.3, 0.2), Vector2(0.35, 0.2)]:
			draw_arc(xf * Vector2(s.x * r * spread, s.y * r), 6.0, 0, TAU, 10, Color(0.9, 0.6, 0.9, 0.7 * (1.0 - a * 2.0)), 2.0)
	else:
		for ring in 2:
			var rr := (0.55 + ring * 0.35) * r
			var cnt := 8 + ring * 6
			for i in cnt:
				var ang2 := TAU * float(i) / cnt + ring * 0.2
				var sp := Vector2(cos(ang2) * rr * spread, sin(ang2) * rr * 0.6 * (1.0 + a * 0.8))
				draw_circle(xf * sp, 5.5, Color(1.0, 0.9, 0.93))
				draw_circle(xf * sp, 3.0, Color(0.85, 0.55, 0.7))
	draw_polyline(xform_points(xf, mantle + PackedVector2Array([mantle[0]])), Color(0.35, 0.12, 0.35, 0.9), 2.5)
	# Face. Attached: squashed against the glass (big flat lips, wide eyes).
	var lips_w := 10.0 + 14.0 * a
	var lips_h := 6.0 - 3.0 * a
	var mouth_c := xf * Vector2(0, r * 0.18 * (1.0 - a) + r * 0.25 * a)
	AqDraw.poly(self, xform_points(Transform2D(0, mouth_c), ellipse_points(Vector2.ZERO, lips_w, lips_h + 4.0, 18)), Color(0.85, 0.35, 0.5))
	draw_line(mouth_c + Vector2(-lips_w * 0.8, 0), mouth_c + Vector2(lips_w * 0.8, 0), Color(0.4, 0.05, 0.15), 2.0)
	if a > 0.5:
		# Squished cheeks.
		draw_circle(mouth_c + Vector2(-lips_w - 6, -3), 7.0 * a, Color(1.0, 0.7, 0.78))
		draw_circle(mouth_c + Vector2(lips_w + 6, -3), 7.0 * a, Color(1.0, 0.7, 0.78))
	var eye_sep := 18.0 + 10.0 * a
	var eye_y := -r * 0.18 - 4.0 * a
	var eye_r := 8.0 + 3.0 * a + (3.0 if _near_bill and a > 0.5 else 0.0)
	draw_eye(Vector2(-eye_sep, eye_y), eye_r, xf, 0.1 - a * 0.1, 0.5)
	draw_eye(Vector2(eye_sep, eye_y), eye_r * 0.92, xf, 0.1 - a * 0.1, 0.5)
	# Glassy highlight: pressed on the glass, it catches the light.
	if a > 0.2:
		draw_arc(xf * Vector2(-r * 0.6, -r * 0.35), r * 0.5, PI * 1.1, PI * 1.5, 10, Color(1, 1, 1, 0.35 * a), 3.0)


func lid_color() -> Color:
	return Color(0.55, 0.25, 0.55)
