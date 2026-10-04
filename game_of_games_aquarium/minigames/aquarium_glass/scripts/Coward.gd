extends "AquariumCreatureBase.gd"

const AqDraw = preload("AqDraw.gd")
## THE COWARD (Panic Eel) - long, beautiful, translucent, extremely nervous.
##
## DOUBLE TAP near it: a visible startle (body kinks, eyes bulge) then it
## BOLTS in a straight line directly AWAY from the tap. Tap behind it to send
## it forward. It is a living projectile: slams into the shell, the Blimp, the
## Idiot, rocks... and is briefly dazed afterwards.
## SINGLE TAP very close: it flinches and drifts a little away (handy for
## lining it up without firing it).

## Double taps further away than this do not scare it.
@export var startle_radius := 330.0
## Bolt speed when the tap is right next to it (px/s).
@export var bolt_speed_max := 1150.0
## Bolt speed when the tap is at the edge of startle_radius (px/s).
@export var bolt_speed_min := 720.0
## Seconds of full-speed straight flight before it starts slowing.
@export var bolt_full_time := 0.32
## How quickly the bolt slows afterwards (per second).
@export var bolt_decay := 2.6
## The pause between noticing and bolting (the visible startle).
@export var startle_time := 0.14
## Single taps closer than this make it flinch away a little.
@export var flinch_radius := 170.0

const SEGMENTS := 16
const SEG_LEN := 12.0

var segs: Array = []   # activity-space points; segs[0] = head = position
var bolt_dir := Vector2.RIGHT
var bolt_speed := 0.0
var _bolt_natural := false
var _bolt_min_shell_dist := INF
var _bolt_hit_shell := false
var _pending_dir := Vector2.ZERO
var _pending_speed := 0.0
var _head_angle := 0.0
var _drift_target := Vector2.ZERO
var _drift_timer := 0.0
var _hint_point: Variant = null
var _hint_time := 0.0
var _crash_cooldown := 0.0
var _dizzy := 0.0
var _retreating := false
var _contract := 0.0


func _init() -> void:
	body_radius = 18.0
	body_mass = 2.5
	max_speed = 55.0
	acceleration = 60.0
	water_drag = 1.0
	arrive_radius = 90.0
	look_at_bill_interval = 22.0
	deep_sensitivity = 1.6


func setup(p_activity: Node) -> void:
	super.setup(p_activity)
	creature_id = "coward"


func reset_creature(start: Vector2) -> void:
	super.reset_creature(start)
	segs.clear()
	for i in SEGMENTS:
		segs.append(start + Vector2(-i * SEG_LEN, 0))
	_head_angle = 0.0
	_drift_target = start
	_drift_timer = 0.0
	_hint_point = null
	_retreating = false
	_dizzy = 0.0
	bolt_speed = 0.0


func get_debug_text() -> String:
	return "coward: %s%s" % [state, "  v=%d" % int(velocity.length()) if state == "bolt" else ""]


func is_bolting() -> bool:
	return state == "bolt" or state == "startle"


func on_stimulus(stim) -> bool:
	if _retreating:
		return false
	var d: float = position.distance_to(stim.position)
	match stim.kind:
		Stim.Kind.DOUBLE_TAP:
			if d <= startle_radius and state != "startle":
				startle_from(stim.position, stim.natural, d)
				return true
		Stim.Kind.HARD_KNOCK:
			if d <= stim.radius and state != "startle" and state != "bolt":
				startle_from(stim.position, stim.natural, d * 0.6)
				return true
		Stim.Kind.SINGLE_TAP:
			if d <= flinch_radius and not is_bolting():
				notice(stim.position, 0.8)
				velocity += (position - stim.position).normalized() * 110.0
				set_state("flinch")
				return true
		Stim.Kind.SCRATCH:
			if d < 140.0 and not is_bolting():
				look_at_point(stim.position, 0.5)
				velocity += (position - stim.position).normalized() * 12.0
	return false


## Frighten it from `from`. It bolts directly away.
func startle_from(from: Vector2, natural := false, dist := -1.0) -> void:
	if dist < 0.0:
		dist = position.distance_to(from)
	var away := position - from
	if away.length() < 8.0:
		away = Vector2.from_angle(_head_angle)
	_pending_dir = away.normalized()
	_pending_speed = lerpf(bolt_speed_max, bolt_speed_min, clampf(dist / startle_radius, 0.0, 1.0))
	_bolt_natural = natural
	surprise = 1.0
	_contract = 1.0
	look_at_point(from, 0.4)
	set_state("startle")
	activity.audio.play("coward_startle", -2.0, randf_range(0.95, 1.1))


func _think(delta: float) -> void:
	_crash_cooldown -= delta
	_dizzy = move_toward(_dizzy, 0.0, delta * 0.8)
	_contract = move_toward(_contract, 0.0, delta * 3.0)
	if _hint_point != null:
		_hint_time -= delta
		if _hint_time <= 0.0:
			_hint_point = null
	match state:
		"idle", "drift":
			_drift(delta)
		"flinch":
			brake(delta, 0.5)
			if state_time > 0.8:
				set_state("drift")
		"startle":
			velocity = velocity * 0.8 - _pending_dir * 30.0 * delta
			if state_time >= startle_time:
				_begin_bolt()
		"bolt":
			var t := state_time
			if t > bolt_full_time:
				bolt_speed *= exp(-bolt_decay * delta)
			velocity = bolt_dir * bolt_speed
			if activity.shell:
				_bolt_min_shell_dist = minf(_bolt_min_shell_dist, position.distance_to(activity.shell.position))
			if randf() < delta * 30.0:
				activity.water_fx.spawn_bubbles(segs[min(3, segs.size() - 1)], 1, 0.3)
			if bolt_speed < 130.0:
				_end_bolt()
				set_state("recover")
		"recover":
			brake(delta, 0.6)
			if randf() < delta * 2.0:
				look_at_point(position + Vector2(randf_range(-200, 200), randf_range(-100, 100)), 0.4)
			if state_time > 1.6:
				set_state("drift")
		"dazed":
			brake(delta, 1.2)
			if state_time > 1.3:
				set_state("drift")
		"retreat":
			steer_to(_retreat_point(), delta, 1.2)
	_update_segments(delta)


func _drift(delta: float) -> void:
	_drift_timer -= delta
	if _drift_timer <= 0.0 or position.distance_to(_drift_target) < 40.0:
		_drift_timer = randf_range(5.0, 9.0)
		if _hint_point != null:
			_drift_target = clamp_to_swim(_hint_point + Vector2(randf_range(-90, 90), randf_range(-60, 60)))
		else:
			_drift_target = random_swim_point(60.0, 0.1, 0.85)
	target_pos = _drift_target
	# Graceful S-curve drifting.
	var wobble := Vector2(0, sin(anim_t * 0.9) * 30.0)
	steer_to(_drift_target + wobble, delta, 0.85 if nervous < 0.4 else 1.4)


func _begin_bolt() -> void:
	bolt_dir = _pending_dir
	bolt_speed = _pending_speed
	velocity = bolt_dir * bolt_speed
	_bolt_min_shell_dist = INF
	_bolt_hit_shell = false
	target_pos = null
	set_state("bolt")
	activity.audio.play("coward_dash", -2.0, randf_range(0.95, 1.1))
	activity.water_fx.spawn_bubbles(position, 6, 0.7)
	activity.notify_creature_event("coward_bolt", self, {"dir": bolt_dir, "natural": _bolt_natural, "from": position - bolt_dir * 40.0})


func _end_bolt() -> void:
	if activity and not _bolt_natural:
		activity.hints.record_coward_bolt_result(_bolt_hit_shell, _bolt_min_shell_dist)


func _crash(normal: Vector2, speed: float, sound := true) -> void:
	if _crash_cooldown > 0.0:
		return
	_crash_cooldown = 0.3
	impact(normal, clampf(speed / 900.0, 0.2, 0.45))
	_dizzy = 1.0
	if sound:
		activity.audio.play("coward_impact", clampf(-12.0 + speed * 0.012, -12.0, 2.0), randf_range(0.95, 1.1))
	if speed > 500.0:
		activity.camera_impulse(0.12, 0.15)
	activity.water_fx.spawn_bubbles(position, 5, 0.6)
	if state == "bolt":
		_end_bolt()
	velocity = normal * minf(speed * 0.25, 200.0)
	set_state("dazed")


func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
	if state != "bolt":
		return
	if other is Dictionary:
		if rel_speed > 150.0:
			_crash(normal, rel_speed)
		return
	if other.get("collision_group") == "bastard":
		return  # tiny things get bowled over, no crash
	if other == activity.memory:
		return
	if other == activity.shell:
		_bolt_hit_shell = true
		_crash(normal, rel_speed, false)
		return
	if rel_speed > 150.0:
		_crash(normal, rel_speed)


func _on_bounds_hit(normal: Vector2, speed: float) -> void:
	if state == "bolt" and speed > 150.0:
		_crash(normal, speed)


func take_bite(_from, _amount: float) -> bool:
	# Bitten! Obviously, flee.
	if not is_bolting() and state != "dazed" and randf() < 0.25:
		var c: Vector2 = activity.bastards.swarm_center()
		startle_from(c, true)
	return true


func can_be_bitten() -> bool:
	return not is_bolting()


func bite_priority() -> float:
	return 0.8


func bite_point() -> Vector2:
	return segs[int(segs.size() * 0.4)] if segs.size() > 0 else position


func hint_drift_near(p: Vector2, duration := 12.0) -> void:
	_hint_point = p
	_hint_time = duration
	_drift_timer = 0.0


func retreat() -> void:
	_retreating = true
	set_state("retreat")


func return_from_retreat() -> void:
	_retreating = false
	set_state("drift")


func _retreat_point() -> Vector2:
	var r := swim_rect()
	return Vector2(r.end.x - 30.0, r.position.y + 40.0)


func state_allows_bill_look() -> bool:
	return state == "drift" or state == "idle"


# ------------------------------------------------------------- body chain

func _update_segments(delta: float) -> void:
	if segs.is_empty():
		return
	segs[0] = position
	var spacing := SEG_LEN * (1.0 - _contract * 0.35)
	for i in range(1, segs.size()):
		var d: Vector2 = segs[i] - segs[i - 1]
		var l := d.length()
		if l > 0.001:
			segs[i] = segs[i - 1] + d / l * spacing
	if velocity.length() > 6.0:
		_head_angle = lerp_angle(_head_angle, velocity.angle(), clampf(delta * (14.0 if state == "bolt" else 4.0), 0, 1))
	elif segs.size() > 1:
		_head_angle = lerp_angle(_head_angle, (segs[0] - segs[1]).angle(), clampf(delta * 3.0, 0, 1))


func _draw() -> void:
	if segs.size() < 2:
		return
	var n := segs.size()
	var spd := velocity.length()
	var wave_amp := 7.0 if state != "bolt" else 2.0
	var wave_speed := 4.0 + spd * 0.01
	if state == "startle":
		wave_amp = 12.0
	var center := PackedVector2Array()
	var left := PackedVector2Array()
	var right := PackedVector2Array()
	var widths: Array = []
	for i in n:
		var p: Vector2 = segs[i] - position
		var nxt: Vector2 = (segs[max(i - 1, 0)] - segs[min(i + 1, n - 1)])
		var dir := nxt.normalized() if nxt.length() > 0.01 else Vector2.RIGHT
		var perp := Vector2(-dir.y, dir.x)
		var tt := float(i) / (n - 1)
		var und := sin(anim_t * wave_speed - i * 0.55) * wave_amp * tt
		if state == "startle":
			und += sin(i * 1.3) * 10.0 * tt
		p += perp * und
		var w := 15.0 * pow(1.0 - tt, 0.55) + 1.5
		if i == 0:
			w = 13.0
		center.append(p)
		widths.append(w)
		left.append(p + perp * w)
		right.append(p - perp * w)
	# Glow halo.
	for i in range(0, n, 2):
		draw_circle(center[i], widths[i] * 2.2, Color(0.5, 0.9, 1.0, 0.035 + nervous * 0.02))
	# Speed streaks.
	if state == "bolt" and spd > 300.0:
		for k in 4:
			var o := Vector2(-bolt_dir.y, bolt_dir.x) * (k - 1.5) * 10.0
			draw_line(center[n - 1] + o, center[n - 1] + o - bolt_dir * spd * 0.12, Color(0.7, 0.95, 1.0, 0.25), 2.0)
	# Translucent ribbon body.
	var body_col := Color(0.62, 0.86, 0.98, 0.42).lerp(Color(0.95, 0.75, 1.0, 0.5), 0.5 + 0.5 * sin(anim_t * 0.6))
	AqDraw.strip(self, left, right, body_col)
	# Dorsal frill.
	var frill_out := PackedVector2Array()
	for i in n:
		var dirn := (left[i] - center[i]).normalized()
		frill_out.append(left[i] + dirn * (6.0 + 5.0 * sin(anim_t * 5.0 - i * 0.8)) * (1.0 - float(i) / n))
	AqDraw.strip(self, left, frill_out, Color(0.8, 0.7, 1.0, 0.25))
	draw_polyline(left, Color(0.85, 0.97, 1.0, 0.75), 1.6)
	draw_polyline(right, Color(0.85, 0.97, 1.0, 0.55), 1.6)
	# Bioluminescent spine dots.
	for i in range(2, n, 2):
		var pulse := 0.5 + 0.5 * sin(anim_t * 3.0 - i * 0.7)
		draw_circle(center[i], 2.5 + pulse * 1.5, Color(0.7, 1.0, 0.95, 0.5 + pulse * 0.4))
	# Head.
	var flip := -1.0 if cos(_head_angle) < 0.0 else 1.0
	var hxf := Transform2D(_head_angle, Vector2.ZERO) * Transform2D.IDENTITY.scaled(Vector2(1.0, flip))
	hxf = hxf.scaled(Vector2.ONE * front_scale)
	draw_colored_polygon(xform_points(hxf, ellipse_points(Vector2(2, 0), 18.0, 13.0, 20)), Color(0.75, 0.92, 1.0, 0.65))
	# Worried eyes (big, on top of the head).
	draw_eye(Vector2(6, -8), 7.5, hxf, 0.0, 0.42, Color(1, 1, 1, 0.95), Color(0.05, 0.1, 0.2))
	draw_eye(Vector2(-4, -9), 6.5, hxf, 0.0, 0.42, Color(1, 1, 1, 0.9), Color(0.05, 0.1, 0.2))
	# Worried brows (up in the middle).
	draw_line(hxf * Vector2(10, -17 - surprise * 3.0), hxf * Vector2(2, -19 - surprise * 5.0), Color(0.3, 0.5, 0.7, 0.9), 2.0)
	draw_line(hxf * Vector2(-1, -19 - surprise * 5.0), hxf * Vector2(-8, -16 - surprise * 3.0), Color(0.3, 0.5, 0.7, 0.9), 2.0)
	# Tiny wobbly mouth.
	var mo := 2.0 + surprise * 3.0
	draw_arc(hxf * Vector2(16, 3), mo, 0.3, PI - 0.3, 8, Color(0.2, 0.35, 0.5, 0.9), 1.5)
	if _dizzy > 0.2:
		for k in 3:
			var a := anim_t * 5.0 + k * TAU / 3.0
			var sp := hxf * Vector2(0, -26) + Vector2(cos(a) * 14.0, sin(a) * 5.0)
			draw_circle(sp, 2.5, Color(1, 1, 0.6, _dizzy))
	if state == "startle":
		for k in 5:
			var a2 := TAU * k / 5.0 + anim_t
			draw_line(Vector2.from_angle(a2) * 26.0, Vector2.from_angle(a2) * 36.0, Color(1, 1, 1, 0.7), 2.0)


func lid_color() -> Color:
	return Color(0.6, 0.85, 1.0, 0.9)
