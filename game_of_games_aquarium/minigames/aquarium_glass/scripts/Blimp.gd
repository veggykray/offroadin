extends "AquariumCreatureBase.gd"

const AqDraw = preload("AqDraw.gd")
## THE BLIMP - large, fat, slow, heavy, calm. A living bulldozer.
##
## SINGLE TAP: it notices (turns, eyebrows up), then lumbers towards the tap.
## Because it is heavy it shoves the shell / pebbles / other creatures aside.
## Hitting something: THUD, squash, mildly surprised face.
## If it pushes against something that will not move it gets confused.

## How far away (px) a single tap can be and still interest it.
@export var tap_attention_radius := 1400.0
## Seconds between the tap and it setting off (it is not quick on the uptake).
@export var reaction_delay := 0.3
## How long it hangs around at the tap position before wandering again.
@export var linger_time := 3.0

var _pending_target: Variant = null
var _pending_timer := 0.0
var _thud_cooldown := 0.0
var _push_contact_time := 0.0
var _pushing_target: Node2D = null
var _last_push_event := -10.0
var _yawn := 0.0
var _confused := 0.0
var _hint_mode := ""
var _hint_point := Vector2.ZERO
var _nudge_memory: Node2D = null
var _nudge_chute: Node2D = null
var _nudge_phase := 0
var _target_natural := false
var _retreating := false
var _home := Vector2.ZERO


func _init() -> void:
	body_radius = 62.0
	body_mass = 10.0
	max_speed = 105.0
	acceleration = 70.0
	water_drag = 1.0
	arrive_radius = 110.0
	look_at_bill_interval = 16.0
	deep_sensitivity = 0.6


func setup(p_activity: Node) -> void:
	super.setup(p_activity)
	creature_id = "blimp"


func reset_creature(start: Vector2) -> void:
	super.reset_creature(start)
	_home = start
	_pending_target = null
	_hint_mode = ""
	_nudge_memory = null
	_retreating = false
	_confused = 0.0


func get_debug_text() -> String:
	return "blimp: %s%s" % [state, " (hint:%s)" % _hint_mode if _hint_mode != "" else ""]


func on_stimulus(stim) -> bool:
	if _retreating:
		return false
	var d: float = position.distance_to(stim.position)
	match stim.kind:
		Stim.Kind.SINGLE_TAP:
			if d > tap_attention_radius or state == "nudge":
				return false
			_pending_target = stim.position
			_target_natural = stim.natural
			_pending_timer = reaction_delay * (0.6 if state == "approach" else 1.0)
			notice(stim.position, 0.4)
			_hint_mode = ""
			return true
		Stim.Kind.DOUBLE_TAP:
			if d < stim.radius:
				look_at_point(stim.position, 0.8)
		Stim.Kind.HARD_KNOCK:
			if d < stim.radius:
				notice(stim.position, 1.0)
				impact((position - stim.position), 0.25)
				velocity += (position - stim.position).normalized() * 40.0
				return true
	return false


func _think(delta: float) -> void:
	_thud_cooldown -= delta
	_confused = move_toward(_confused, 0.0, delta * 0.4)
	_yawn = move_toward(_yawn, 0.0, delta * 0.7)
	if _pending_target != null:
		_pending_timer -= delta
		if _pending_timer <= 0.0:
			target_pos = clamp_to_swim(_pending_target)
			_pending_target = null
			set_state("approach")
			activity.notify_creature_event("blimp_approach", self, {"target": target_pos})

	match state:
		"idle":
			_wander(delta)
		"approach":
			var d := steer_to(target_pos, delta)
			gaze_point = gaze_point.lerp(target_pos, clampf(delta * 2.0, 0, 1))
			_check_pushing(delta)
			if d < 14.0 or (state_time > 1.0 and velocity.length() < 6.0 and d < arrive_radius):
				set_state("linger")
		"linger":
			brake(delta, 0.6)
			if state_time > linger_time:
				target_pos = null
				set_state("idle")
		"confused":
			brake(delta, 1.0)
			if state_time < 1.2:
				look_at_point(_pushing_target.position if _pushing_target else position + Vector2(facing * 80, 30), 0.3)
			elif state_time < 2.4:
				look_at_bill(0.3)
			else:
				target_pos = null
				set_state("idle")
		"spin":
			brake(delta, 0.4)
			if state_time > 2.2:
				set_state("idle")
		"hint":
			_hint_behaviour(delta)
		"nudge":
			_nudge_behaviour(delta)
		"retreat":
			steer_to(_retreat_point(), delta, 0.7)
			if gaze_override_time <= 0.0:
				look_at_point(activity.get_deep_position(), 0.5)


func _wander(delta: float) -> void:
	if target_pos == null or position.distance_to(target_pos) < 40.0 or state_time > 14.0:
		# Lazy drifting, mostly in the lower half; sometimes a yawn.
		target_pos = random_swim_point(40.0, 0.35, 0.9)
		state_time = 0.0
		if randf() < 0.3:
			_yawn = 1.0
	steer_to(target_pos, delta, 0.35, 0.5)


func _check_pushing(delta: float) -> void:
	if _pushing_target and is_instance_valid(_pushing_target) and activity.stage_time >= 0.0:
		var touching: bool = position.distance_to(_pushing_target.position) < body_radius + _pushing_target.body_radius + 6.0
		if touching:
			_push_contact_time += delta
			# Pushing but nothing is moving (e.g. shell against its limit): confused.
			if _push_contact_time > 1.6 and _pushing_target.velocity.length() < 4.0 and velocity.length() < 12.0:
				_push_contact_time = 0.0
				_confused = 1.0
				set_state("confused")
				activity.audio.play("blimp_move", -6.0, 0.7)
		else:
			_push_contact_time = 0.0
			_pushing_target = null


func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
	if other is Dictionary:
		if rel_speed > 35.0 and _thud_cooldown <= 0.0:
			_thud(normal, rel_speed * 0.6)
		return
	if other == activity.shell or (other.get("is_pebble") == true):
		if state == "approach" or state == "nudge" or state == "hint":
			_pushing_target = other
		if rel_speed > 20.0 and _thud_cooldown <= 0.0:
			_thud(normal, rel_speed)
			if other == activity.shell:
				activity.notify_creature_event("blimp_push", self, {"target": other, "dir": -normal})
				_last_push_event = activity.activity_time
		elif other == activity.shell and activity.activity_time - _last_push_event > 2.5 and velocity.length() > 20.0:
			_last_push_event = activity.activity_time
			activity.notify_creature_event("blimp_push", self, {"target": other, "dir": -normal})
		return
	if other == activity.coward and rel_speed > 300.0:
		# Rammed by the Coward: slow, dignified, confused spin.
		spin_vel = 3.2 * (1.0 if randf() > 0.5 else -1.0)
		set_state("spin")
		_confused = 1.0
		_thud(normal, rel_speed * 0.5)
		return
	if rel_speed > 60.0 and _thud_cooldown <= 0.0:
		_thud(normal, rel_speed * 0.5)


func _thud(normal: Vector2, speed: float) -> void:
	_thud_cooldown = 0.7
	impact(normal, clampf(speed / 260.0, 0.12, 0.5))
	surprise = 1.0
	activity.audio.play("blimp_impact", clampf(-14.0 + speed * 0.05, -14.0, 0.0), randf_range(0.9, 1.05))
	activity.water_fx.spawn_bubbles(position + Vector2(facing * body_radius * 0.9, 0), 3, 0.5)


func take_bite(_from, _amount: float) -> bool:
	# The Bastards nibble it. It wobbles but is too big to care much.
	impact(Vector2(randf_range(-1, 1), randf_range(-1, 1)), 0.06)
	surprise = maxf(surprise, 0.4)
	if state == "idle" and randf() < 0.05:
		target_pos = position + Vector2(randf_range(-160, 160), randf_range(-80, 40))
	return true


func can_be_bitten() -> bool:
	return true


func bite_priority() -> float:
	return 0.6


func bite_point() -> Vector2:
	return position + Vector2(randf_range(-0.6, 0.6), randf_range(-0.5, 0.5)) * body_radius


## True while the Blimp is moving because of a hint/natural event rather than the player.
func is_natural_push() -> bool:
	return state == "hint" or (state == "approach" and _target_natural)


func is_pushing_purposefully() -> bool:
	return state in ["approach", "hint", "nudge"]


func get_mouth_position() -> Vector2:
	return position + Vector2(facing * body_radius * 0.95, body_radius * 0.15)


# ------------------------------------------------------------- hints & scripted bits

## Hint: look (and drift a little) towards a point, e.g. the space behind the shell.
func hint_look_towards(p: Vector2) -> void:
	_hint_mode = "look"
	_hint_point = p
	target_pos = position.lerp(p, 0.25)
	set_state("hint")


## Hint: wander over and bump into a rock near p (THUD).
func hint_bump_near(p: Vector2) -> void:
	_hint_mode = "bump"
	_hint_point = p
	target_pos = clamp_to_swim(p)
	set_state("hint")


func _hint_behaviour(delta: float) -> void:
	match _hint_mode:
		"look":
			steer_to(target_pos, delta, 0.3)
			look_at_point(_hint_point, 0.4)
			if state_time > 4.0:
				_hint_mode = ""
				set_state("idle")
		"bump":
			var d := steer_to(target_pos, delta, 0.6)
			if d < 30.0 or state_time > 9.0:
				_hint_mode = ""
				set_state("linger")
		_:
			set_state("idle")


## End sequence: come over and nudge the memory towards the chute.
func final_nudge(mem: Node2D, chute: Node2D) -> void:
	_nudge_memory = mem
	_nudge_chute = chute
	_nudge_phase = 0
	_retreating = false
	set_state("nudge")


func _nudge_behaviour(delta: float) -> void:
	if _nudge_memory == null or not _nudge_memory.is_loose():
		_nudge_memory = null
		set_state("idle")
		return
	var dir := signf(_nudge_chute.position.x - _nudge_memory.position.x)
	if dir == 0.0:
		dir = 1.0
	look_at_point(_nudge_memory.position, 0.3)
	if _nudge_phase == 0:
		# Get round behind it (the side away from the chute)...
		var behind := clamp_to_swim(_nudge_memory.position + Vector2(-dir * (body_radius + 30.0), -20.0))
		steer_to(behind, delta, 0.9)
		if position.distance_to(behind) < 30.0 or state_time > 8.0:
			_nudge_phase = 1
			state_time = 0.0
	else:
		# ...then a gentle shove with the lips.
		steer_to(clamp_to_swim(_nudge_memory.position + Vector2(dir * 70.0, 0)), delta, 0.45)
		if state_time > 5.0:
			_nudge_phase = 0
			state_time = 0.0


func retreat() -> void:
	_retreating = true
	set_state("retreat")


func return_from_retreat() -> void:
	_retreating = false
	set_state("idle")


func _retreat_point() -> Vector2:
	var r := swim_rect()
	return Vector2(r.position.x + 40.0, r.end.y - 20.0)


func state_allows_bill_look() -> bool:
	return state == "idle" or state == "linger"


# ------------------------------------------------------------- drawing

func _draw() -> void:
	var bob := sin(anim_t * 1.3) * 4.0
	var tilt := clampf(velocity.y / 400.0, -0.2, 0.2)
	var xf := body_transform(tilt * facing).translated_local(Vector2(0, bob))
	var r := body_radius
	var swim := anim_t * (2.0 + velocity.length() * 0.02)

	# Tail fin (behind body).
	var tail_wag := sin(swim * 1.6) * 0.35
	var tail_base := Vector2(-r * 1.05, 0)
	var tail := PackedVector2Array([
		tail_base + Vector2(10, -10),
		tail_base + Vector2(-r * 0.55, -r * 0.55).rotated(tail_wag),
		tail_base + Vector2(-r * 0.4, 0).rotated(tail_wag),
		tail_base + Vector2(-r * 0.55, r * 0.5).rotated(tail_wag),
		tail_base + Vector2(10, 10),
	])
	AqDraw.poly(self, xform_points(xf, tail), Color(0.82, 0.5, 0.42))
	draw_polyline(xform_points(xf, tail + PackedVector2Array([tail[0]])), Color(0.45, 0.25, 0.22), 2.5)

	# Dorsal fin.
	var dorsal := PackedVector2Array([Vector2(-r * 0.45, -r * 0.7), Vector2(-r * 0.05, -r * 1.12 + sin(swim) * 4.0), Vector2(r * 0.25, -r * 0.78)])
	AqDraw.poly(self, xform_points(xf, dorsal), Color(0.78, 0.46, 0.4))

	# Body: big egg, fat at the front.
	var body := PackedVector2Array()
	for i in 40:
		var a := TAU * float(i) / 40.0
		var rx := r * (1.18 if cos(a) > 0 else 1.08)
		var ry := r * (0.86 + 0.06 * cos(a))
		body.append(Vector2(cos(a) * rx, sin(a) * ry + (r * 0.08 if sin(a) > 0 else 0.0)))
	var body_x := xform_points(xf, body)
	AqDraw.poly(self, body_x, Color(0.93, 0.62, 0.52))
	# Belly.
	var belly := PackedVector2Array()
	for i in 24:
		var a2 := PI * 0.05 + PI * 0.9 * float(i) / 23.0
		belly.append(Vector2(cos(a2) * r * 1.0, sin(a2) * r * 0.82 + r * 0.06))
	belly.append(Vector2(-r * 0.9, r * 0.25))
	belly.append(Vector2(r * 0.95, r * 0.25))
	AqDraw.poly(self, xform_points(xf, belly), Color(1.0, 0.85, 0.74))
	# Spots.
	for s in [Vector2(-0.5, -0.45), Vector2(-0.15, -0.6), Vector2(-0.75, -0.1), Vector2(0.1, -0.4), Vector2(-0.4, -0.15)]:
		draw_circle(xf * (s * r), r * 0.075, Color(0.78, 0.45, 0.4, 0.8))
	draw_polyline(body_x + PackedVector2Array([body_x[0]]), Color(0.5, 0.27, 0.24), 3.0)

	# Pectoral fin (slow paddle).
	var fin_ang := sin(swim * 1.1) * 0.5 + 0.4
	var fin := PackedVector2Array([Vector2(0, 0), Vector2(-r * 0.4, r * 0.15).rotated(fin_ang), Vector2(-r * 0.32, r * 0.32).rotated(fin_ang)])
	AqDraw.poly(self, xform_points(xf, fin), Color(0.85, 0.52, 0.45))

	# Lips: big, droopy, comically kissable.
	var lip_c := xf * Vector2(r * 1.12, r * 0.22)
	var mouth_open := _yawn * 12.0 + surprise * 4.0
	draw_circle(lip_c + xf.basis_xform(Vector2(0, -4 - mouth_open * 0.3)), 9.0, Color(0.85, 0.38, 0.42))
	draw_circle(lip_c + xf.basis_xform(Vector2(0, 5 + mouth_open)), 10.0, Color(0.8, 0.34, 0.4))
	if mouth_open > 2.0:
		draw_circle(lip_c + xf.basis_xform(Vector2(-3, mouth_open * 0.4)), mouth_open * 0.5, Color(0.2, 0.05, 0.08))

	# Barbels (whiskers) drifting.
	for k in 2:
		var base := Vector2(r * 1.0, r * (0.35 + k * 0.1))
		var pts := PackedVector2Array()
		for i in 6:
			var tt := float(i) / 5.0
			pts.append(xf * (base + Vector2(-tt * r * 0.2 + tt * 8.0, tt * r * 0.5 + sin(swim + tt * 3.0 + k) * 6.0 * tt)))
		draw_polyline(pts, Color(0.6, 0.3, 0.3), 2.0)

	# Eyes: small, wide-set, heavy lidded (calm). Surprise lifts the lids.
	var lid := clampf(0.45 - surprise * 0.5 + _yawn * 0.4 - _confused * 0.1, 0.0, 0.9)
	draw_eye(Vector2(r * 0.62, -r * 0.3), r * 0.15, xf, lid, 0.55)
	draw_eye(Vector2(r * 0.9, -r * 0.24), r * 0.13, xf, lid, 0.55)
	# Eyebrows (surprise raises them, confusion tilts them).
	var brow_y := -r * 0.52 - surprise * 8.0
	for e in [[r * 0.62, r * 0.17], [r * 0.9, r * 0.15]]:
		var c: float = e[0]
		var w: float = e[1]
		var tilt_b := _confused * 6.0
		draw_line(xf * Vector2(c - w, brow_y + tilt_b), xf * Vector2(c + w, brow_y - tilt_b), Color(0.45, 0.22, 0.2), 3.0)
	# Confusion: little question bubbles.
	if _confused > 0.3:
		var qp := xf * Vector2(r * 0.3, -r * 1.25)
		draw_circle(qp + Vector2(0, -sin(anim_t * 3.0) * 4.0), 5.0 * _confused, Color(0.8, 0.95, 1.0, 0.5))
		draw_circle(qp + Vector2(12, -14 - sin(anim_t * 3.0 + 1.0) * 4.0), 3.5 * _confused, Color(0.8, 0.95, 1.0, 0.4))
