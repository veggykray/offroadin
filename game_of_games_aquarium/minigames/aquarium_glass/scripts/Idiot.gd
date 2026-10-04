extends "AquariumCreatureBase.gd"

const AqDraw = preload("AqDraw.gd")
## THE IDIOT - round, cheerful, curious, expressive, slightly infuriating.
##
## PHASE ONE: it imitates. When it SEES another creature do something it
## telegraphs (stops, stares, little nod) and then copies it:
##   Coward bolts      -> it bolts the same way (and usually hits something)
##   Blimp pushes      -> it pushes a pebble (or the Blimp's bum)
##   Blimp follows tap -> it follows the Blimp like a duckling
##   Bastards swarm    -> it joins in and chases its own tail
##   Sucker sticks     -> it squashes its face on the glass too
##
## THE THEFT: when the shell opens it grabs the memory, looks Bill dead in
## the eye, and swims off.
##
## THE CHASE: it flees threats (Blimp, Sucker, bolting Coward, excited
## Bastards), hides behind scenery and the Blimp, fakes directions, stops to
## taunt, still imitates, and PANICS when boxed in. A hidden "pressure" value
## rises while it is boxed in / bitten / hit; at 1.0 it spits out the memory.
## It cannot be caught by clicking it - only by using the ecosystem.

signal theft_finished
signal memory_spat(pos: Vector2, vel: Vector2)

@export_group("Imitation")
## How far away it notices what other creatures do.
@export var observe_radius := 700.0
## Chance it copies something it saw.
@export_range(0.0, 1.0) var imitation_chance := 0.6
## Minimum seconds between imitations.
@export var imitation_cooldown := 5.0

@export_group("Chase")
## Normal fleeing speed (px/s).
@export var chase_cruise_speed := 230.0
## Dash speed when something is close (px/s).
@export var chase_dash_speed := 385.0
## Length of the "is this direction blocked?" probes (px).
@export var trap_probe_length := 150.0
## Out of 12 probe directions, this many blocked = boxed in (panic).
@export var trap_blocked_needed := 9
## Pressure per second while boxed in (1.0 = spits memory).
@export var trap_pressure_rate := 0.2
## Pressure per Bastard bite.
@export var bite_pressure := 0.014
## Pressure from a Coward hit (also stuns it).
@export var coward_hit_pressure := 0.45
## Pressure lost per second when it is free.
@export var pressure_decay := 0.14
## No pressure at all for the first seconds of the chase (it has just escaped).
@export var chase_grace_time := 4.0
## After this many seconds of chase it starts tiring (slower, panics easier).
@export var tire_after := 35.0

var pressure := 0.0
## Where the pressure came from (for tuning / debug).
var pressure_sources := {}
var blocked_count := 0
var creature_blocked_count := 0
## Probes that must be blocked by creatures (not just walls/rocks) for a trap.
@export var trap_creature_probes_needed := 2
var chase_goal := Vector2.ZERO
var _decision_timer := 0.0
var _carrying = null
var _imitate_cd := 2.0
var _watch_target: Node2D = null
var _watch_kind := ""
var _watch_data := {}
var _imit_dir := Vector2.ZERO
var _imit_target: Variant = null
var _theft_memory: Node2D = null
var _hide_until := 0.0
var _hiding_behind_blimp := false
var _stun := 0.0
var _freeze := 0.0
var _taunt_cd := 6.0
var _fake_dir := Vector2.ZERO
var _fake_time := 0.0
var _bite_pressure_window := 0.0
var _last_bitten := -10.0
var _sweat := 0.0
var _grin := 1.0
var _panic := 0.0
var _chase_time := 0.0
var _retreating := false
var _knock_point: Variant = null
var _knock_time := 0.0
var _noise_cd := 0.0
var _probe_hits: Array = []
var _tail_chase := 0.0


func _init() -> void:
	body_radius = 26.0
	body_mass = 1.5
	max_speed = 150.0
	acceleration = 520.0
	water_drag = 2.0
	arrive_radius = 50.0
	look_at_bill_interval = 9.0
	deep_sensitivity = 0.8


func setup(p_activity: Node) -> void:
	super.setup(p_activity)
	creature_id = "idiot"


func reset_creature(start: Vector2) -> void:
	super.reset_creature(start)
	pressure = 0.0
	_carrying = null
	_theft_memory = null
	_imitate_cd = 3.0
	_stun = 0.0
	_freeze = 0.0
	_retreating = false
	_hiding_behind_blimp = false
	_chase_time = 0.0
	_panic = 0.0
	_sweat = 0.0
	z_index = 3


func get_debug_text() -> String:
	var s := "idiot: %s" % state
	if state in ["flee", "hide", "panic", "taunt", "fake", "stunned", "frozen"]:
		s += "  pressure %.2f  blocked %d/12" % [pressure, blocked_count]
	return s


func get_mouth_position() -> Vector2:
	return position + Vector2(facing * body_radius * 0.75, body_radius * 0.3) * front_scale


func is_chasing() -> bool:
	return _carrying != null and state != "theft_approach" and state != "theft_look"


# ================================================================ stimuli

func on_stimulus(stim) -> bool:
	var d: float = position.distance_to(stim.position)
	if is_chasing():
		if stim.kind == Stim.Kind.HARD_KNOCK and d < stim.radius:
			# A big THUNK freezes it for a moment: tempting...
			_freeze = 0.6
			_knock_point = stim.position
			_knock_time = 1.5
			_add_pressure(0.06, "knock")
			surprise = 1.0
			set_state("frozen")
			return true
		return false
	if state in ["theft_approach", "theft_look", "sulk", "retreat"]:
		return false
	if d < 220.0:
		look_at_point(stim.position, 0.8)
		if stim.kind == Stim.Kind.SINGLE_TAP and state == "idle":
			# A happy little hop - it likes the noise.
			squash_axis = Vector2.UP
			squash_vel -= 2.0
			velocity.y -= 60.0
			_noise(-14.0, 1.5)
		elif stim.kind == Stim.Kind.HARD_KNOCK or stim.kind == Stim.Kind.DOUBLE_TAP:
			surprise = 1.0
	return false


## Other creatures report their actions here (via the activity).
func observe(kind: String, creature: Node, data: Dictionary) -> void:
	if _retreating or state in ["theft_approach", "theft_look", "sulk", "stunned", "frozen", "watch"]:
		return
	if _imitate_cd > 0.0:
		return
	if creature is Node2D and position.distance_to((creature as Node2D).position) > observe_radius:
		return
	var chasing := is_chasing()
	if chasing and not (kind == "coward_bolt" or kind == "bastards_swarm"):
		return
	if state.begins_with("imitate"):
		return
	if randf() > imitation_chance * (0.6 if chasing else 1.0):
		return
	_watch_target = creature
	_watch_kind = kind
	_watch_data = data
	set_state("watch")


# ================================================================ think

func _think(delta: float) -> void:
	_imitate_cd -= delta
	_noise_cd -= delta
	_sweat = move_toward(_sweat, clampf(pressure * 1.3 - 0.2, 0.0, 1.0), delta)
	_panic = move_toward(_panic, 1.0 if state == "panic" else 0.0, delta * 3.0)
	_tail_chase = move_toward(_tail_chase, 0.0, delta)
	if _knock_time > 0.0:
		_knock_time -= delta
		if _knock_time <= 0.0:
			_knock_point = null
	if not _hiding_behind_blimp:
		body_enabled = true
		z_index = 3

	# The theft must always complete, whatever bumped into it on the way.
	if activity.stage == activity.Stage.IDIOT_THEFT and _carrying == null and _theft_memory != null \
			and state != "theft_approach" and state != "dazed":
		set_state("theft_approach")
	match state:
		"idle":
			_idle(delta)
		"watch":
			brake(delta, 1.5)
			if _watch_target and is_instance_valid(_watch_target):
				look_at_point(_watch_target.position if _watch_kind != "bastards_swarm" else activity.bastards.swarm_center(), 0.2)
			# The nod.
			squash_axis = Vector2.UP
			if int(state_time * 6.0) % 2 == 0:
				squash = lerpf(squash, 0.1, 0.2)
			if state_time > (0.3 if is_chasing() else 0.65):
				_start_imitation()
		"imitate_bolt":
			if state_time < 0.3:
				velocity = _imit_dir * 620.0
			else:
				velocity *= exp(-3.0 * delta)
				if velocity.length() < 60.0:
					_end_imitation()
		"imitate_push":
			_imitate_push(delta)
		"imitate_follow":
			if _watch_target and is_instance_valid(_watch_target):
				var behind: Vector2 = _watch_target.position - Vector2(_watch_target.facing * 110.0, -10.0)
				steer_to(clamp_to_swim(behind), delta, 1.0)
				look_at_point(_watch_target.position, 0.2)
			if state_time > 5.0:
				_end_imitation()
		"imitate_swarm":
			var c: Vector2 = activity.bastards.swarm_center()
			var ang := state_time * 9.0
			_tail_chase = 1.0
			steer_to(clamp_to_swim(c + Vector2(cos(ang), sin(ang)) * 50.0), delta, 2.0, 2.0)
			spin_vel = 9.0
			if state_time > 3.0:
				_end_imitation()
		"imitate_attach":
			var p: Vector2 = _imit_target if _imit_target != null else position
			var d := steer_to(clamp_to_swim(p), delta, 1.2)
			if d < 20.0:
				front_scale_goal = 1.45
				gaze_override_time = 0.2
				look_at_bill(0.2)
				velocity = Vector2.ZERO
			if state_time > 4.0:
				_end_imitation()
		"dazed":
			brake(delta, 1.0)
			if state_time > 1.4:
				set_state("idle")
		"theft_approach":
			_theft_approach(delta)
		"theft_look":
			_theft_look(delta)
		"flee", "hide", "panic", "taunt", "fake", "stunned", "frozen":
			_chase_think(delta)
		"sulk":
			steer_to(_sulk_point(), delta, 0.5)
			if randf() < delta * 0.3:
				look_at_bill(1.0)
		"retreat":
			_hiding_behind_blimp = false
			var behind: Vector2 = activity.blimp.position + Vector2(-50, 10)
			steer_to(clamp_to_swim(behind), delta, 1.0)
			look_at_point(activity.get_deep_position(), 0.3)


func _idle(delta: float) -> void:
	# Bouncy, curious wandering. Often goes to see what the others are doing.
	if target_pos == null or position.distance_to(target_pos) < 30.0 or state_time > 6.0:
		state_time = 0.0
		var r := randf()
		if r < 0.45:
			var others := [activity.blimp, activity.coward, activity.sucker]
			var o: Node2D = others[randi() % others.size()]
			target_pos = clamp_to_swim(o.position + Vector2(randf_range(-140, 140), randf_range(-100, 60)))
		elif r < 0.6 and activity.shell:
			# Foreshadowing: it is very interested in that glow.
			target_pos = clamp_to_swim(activity.shell.position + Vector2(randf_range(-160, 160), -140))
			look_at_point(activity.shell.position, 2.0)
		else:
			target_pos = random_swim_point(60.0, 0.0, 0.8)
	var bounce := Vector2(0, sin(anim_t * 5.0) * 25.0)
	steer_to(target_pos + bounce, delta, 0.6)


# ================================================================ imitation

func _start_imitation() -> void:
	_imitate_cd = imitation_cooldown * (0.6 if is_chasing() else 1.0)
	_noise(-6.0, 1.3)
	match _watch_kind:
		"coward_bolt":
			_imit_dir = _watch_data.get("dir", Vector2.RIGHT)
			surprise = 0.6
			set_state("imitate_bolt")
		"blimp_push":
			_imit_target = _find_pebble()
			set_state("imitate_push")
		"blimp_approach":
			set_state("imitate_follow")
		"bastards_swarm":
			set_state("imitate_swarm")
		"sucker_attach":
			_imit_target = _watch_data.get("pos", position) + Vector2(randf_range(-160, 160), randf_range(-60, 60))
			set_state("imitate_attach")
		_:
			_end_imitation()


func _end_imitation() -> void:
	front_scale_goal = 1.0
	spin_vel = 0.0
	if is_chasing():
		set_state("flee")
		_decision_timer = 0.0
	else:
		set_state("idle")


func _find_pebble():
	var best = null
	var bd := 600.0
	for p in activity.environment.get_pebbles():
		var d := position.distance_to(p.position)
		if d < bd:
			bd = d
			best = p
	return best


func _imitate_push(delta: float) -> void:
	var tgt = _imit_target
	var push_dir: Vector2 = _watch_data.get("dir", Vector2.RIGHT)
	push_dir = Vector2(signf(push_dir.x) if push_dir.x != 0.0 else 1.0, 0)
	if tgt == null:
		# No pebble: push the Blimp's bum instead. It does not notice.
		tgt = activity.blimp
	var tp: Vector2 = tgt.position
	var behind = tp - push_dir * (tgt.body_radius + body_radius + 6.0)
	if state_time < 2.5 and position.distance_to(behind) > 18.0:
		steer_to(clamp_to_swim(behind), delta, 1.1)
	else:
		steer_to(clamp_to_swim(tp + push_dir * 80.0), delta, 0.7)
		squash_axis = push_dir
		squash = lerpf(squash, 0.18, 0.1)
	look_at_point(tp, 0.2)
	if state_time > 6.0:
		_end_imitation()


# ================================================================ theft

func begin_theft(mem: Node2D) -> void:
	_theft_memory = mem
	_retreating = false
	set_state("theft_approach")
	look_at_point(mem.position, 2.0)


func debug_grab(mem: Node2D) -> void:
	_theft_memory = mem
	_carrying = mem
	mem.attach_to(self)
	position = clamp_to_swim(mem.position + Vector2(0, -30))


func _theft_approach(delta: float) -> void:
	if _theft_memory == null:
		return
	var mp := _theft_memory.position
	# Swim in fast, around the shell if needed.
	var d := steer_to(mp + Vector2(-facing * 8.0, 0), delta, 3.0, 2.0)
	look_at_point(mp, 0.2)
	if d < 28.0 or (state_time > 10.0 and d < 120.0):
		_carrying = _theft_memory
		_theft_memory.attach_to(self)
		_noise(0.0, 1.0)
		activity.water_fx.spawn_bubbles(position, 8, 0.6)
		set_state("theft_look")


func _theft_look(delta: float) -> void:
	var bill: Vector2 = activity.get_bill_point()
	var r := swim_rect()
	var spot := Vector2(clampf(bill.x, r.position.x + 100.0, r.end.x - 100.0), r.end.y - 230.0)
	var d := steer_to(spot, delta, 1.4, 1.5)
	look_at_bill(0.3)
	if d < 40.0:
		front_scale_goal = 1.6
		velocity = velocity.move_toward(Vector2.ZERO, 400.0 * delta)
		facing_goal = 1.0 if bill.x > position.x else -1.0
		if state_time > 3.2:
			blink = 1.0
			_noise(-2.0, 1.2)
			theft_finished.emit()
	elif state_time > 6.0:
		theft_finished.emit()


func begin_chase() -> void:
	set_state("flee")
	_decision_timer = 0.0
	_chase_time = 0.0
	pressure = 0.0
	pressure_sources = {}
	front_scale_goal = 1.0
	_taunt_cd = 7.0
	velocity = Vector2(randf_range(-1, 1), -0.6).normalized() * chase_dash_speed


func force_capture() -> void:
	if _carrying == null and activity.memory:
		debug_grab(activity.memory)
		set_state("flee")
	pressure = 1.0
	_spit()


# ================================================================ chase

func _chase_think(delta: float) -> void:
	_chase_time += delta
	_taunt_cd -= delta
	var tire := clampf((_chase_time - tire_after) / 40.0, 0.0, 1.0)
	var speed_mul := lerpf(1.0, 0.68, tire)
	var press_mul := 1.0 + tire * 1.2
	var threats := _gather_threats()
	blocked_count = _count_blocked()
	var nearest := _nearest_threat(threats)

	# --- pressure ---
	var gain := 0.0
	var boxed_by_creatures := creature_blocked_count >= trap_creature_probes_needed
	if not boxed_by_creatures:
		pass
	elif blocked_count >= trap_blocked_needed:
		gain += trap_pressure_rate * (1.0 + 0.25 * (blocked_count - trap_blocked_needed))
	elif blocked_count >= trap_blocked_needed - 2:
		gain += trap_pressure_rate * 0.25
	if nearest.d < 70.0:
		gain += 0.12
	_bite_pressure_window = move_toward(_bite_pressure_window, 0.0, delta * 0.35)
	if _chase_time < chase_grace_time:
		gain = 0.0
	if gain > 0.0:
		_add_pressure(gain * press_mul * delta, "trapped" if blocked_count >= trap_blocked_needed - 2 else "crowded")
	elif activity.activity_time - _last_bitten > 1.0:
		pressure = maxf(0.0, pressure - pressure_decay * delta)
	if pressure >= 1.0:
		_spit()
		return

	match state:
		"stunned":
			_stun -= delta
			spin_vel = 7.0
			brake(delta, 2.0)
			if _stun <= 0.0:
				set_state("flee")
				_decision_timer = 0.0
			return
		"frozen":
			_freeze -= delta
			brake(delta, 3.0)
			if _freeze <= 0.0:
				set_state("flee")
				_decision_timer = 0.0
			return
		"panic":
			# Frantic darting, mostly towards whatever gap is left.
			if randf() < delta * 5.0:
				var d := _escape_dir() if randf() < 0.75 else Vector2.from_angle(randf() * TAU)
				velocity = d * chase_dash_speed * 0.9
			if randf() < delta * 2.0:
				_noise(-4.0, 1.6)
			if (blocked_count < trap_blocked_needed - 1 or creature_blocked_count < trap_creature_probes_needed) and state_time > 0.6:
				set_state("flee")
				_decision_timer = 0.0
			return
		"taunt":
			brake(delta, 2.0)
			look_at_bill(0.2)
			facing_goal = signf(activity.get_bill_point().x - position.x)
			spin = sin(state_time * 14.0) * 0.15
			if state_time > 1.0 or nearest.d < 220.0:
				set_state("flee")
				_decision_timer = 0.0
			return
		"fake":
			_fake_time -= delta
			velocity = velocity.move_toward(_fake_dir * chase_dash_speed * speed_mul, 1800.0 * delta)
			if _fake_time <= 0.0:
				set_state("flee")
			return
		"hide":
			if _hiding_behind_blimp:
				var blimp: Node2D = activity.blimp
				var away = (blimp.position - nearest.pos).normalized() if nearest.d < 9999.0 else Vector2(-blimp.facing, 0)
				# Half tucked behind the Blimp, half sticking out. It thinks it is invisible.
				var spot: Vector2 = blimp.position + away * blimp.body_radius * 0.75 + Vector2(0, 8)
				position = position.lerp(spot, clampf(delta * 6.0, 0, 1))
				velocity = blimp.velocity
				body_enabled = false
				z_index = 1
				look_at_bill(0.2)
			else:
				brake(delta, 2.0)
			if activity.activity_time > _hide_until or nearest.d < 150.0:
				_hiding_behind_blimp = false
				body_enabled = true
				z_index = 3
				set_state("flee")
				_decision_timer = 0.0
			return

	if blocked_count >= trap_blocked_needed and creature_blocked_count >= trap_creature_probes_needed:
		set_state("panic")
		_noise(-2.0, 1.7)
		return

	# --- flee ---
	_decision_timer -= delta
	if _decision_timer <= 0.0 or (nearest.d < 170.0 and position.distance_to(chase_goal) < 120.0):
		_decide(threats, nearest)
	var speed := chase_dash_speed if nearest.d < 260.0 else chase_cruise_speed
	speed *= speed_mul
	var desired := (chase_goal - position)
	var dist := desired.length()
	desired = desired / maxf(dist, 1.0) * speed * clampf(dist / 60.0, 0.2, 1.0)
	desired += _avoidance(threats) * speed
	velocity = velocity.move_toward(desired, acceleration * 1.6 * delta)
	if dist < 40.0 and _hide_until > activity.activity_time:
		set_state("hide")
	elif dist < 40.0 and _taunt_cd <= 0.0 and nearest.d > 380.0:
		_taunt_cd = randf_range(6.0, 10.0)
		set_state("taunt")
		_noise(-6.0, 1.1)


func _gather_threats() -> Array:
	var out: Array = []
	var b: Node2D = activity.blimp
	out.append({"pos": b.position, "r": b.body_radius + 30.0, "w": 1.0})
	var s: Node2D = activity.sucker
	out.append({"pos": s.position, "r": s.body_radius + 20.0, "w": 0.8 if s.is_attached() else 0.5})
	var c: Node2D = activity.coward
	if c.is_bolting():
		out.append({"pos": c.position + c.velocity * 0.25, "r": 80.0, "w": 2.0})
	else:
		out.append({"pos": c.position, "r": 40.0, "w": 0.3})
	var sw: Node2D = activity.bastards
	if sw.excitement > 0.15:
		out.append({"pos": sw.swarm_center(), "r": 90.0, "w": 0.8 + sw.excitement * 1.4})
	if _knock_point != null:
		out.append({"pos": _knock_point, "r": 120.0, "w": 1.0})
	return out


func _nearest_threat(threats: Array) -> Dictionary:
	var best := {"d": 99999.0, "pos": position}
	for t in threats:
		var d: float = position.distance_to(t.pos) - t.r * 0.5
		if t.w >= 0.5 and d < best.d:
			best = {"d": d, "pos": t.pos}
	return best


## Casts 12 probes. Returns how many are blocked; also fills creature_blocked_count
## (probes blocked by a CREATURE rather than walls/rocks). Scenery alone never
## counts as a trap - the player has to bring the creatures in.
func _count_blocked() -> int:
	var count := 0
	creature_blocked_count = 0
	_probe_hits.clear()
	var r := swim_rect()
	var probe := trap_probe_length
	var scenery: Array = []
	for o in activity.obstacles:
		scenery.append([o.pos, o.r])
	if activity.shell:
		scenery.append([activity.shell.position, activity.shell.body_radius])
	var living: Array = []
	for cr in [activity.blimp, activity.sucker, activity.coward]:
		living.append([cr.position, cr.body_radius + 6.0])
	# The swarm blocks one side (as one blob), not every direction at once.
	var sw: Node2D = activity.bastards
	if sw.excitement > 0.15:
		living.append([sw.swarm_center(), 55.0])
	for i in 12:
		var dir := Vector2.from_angle(TAU * i / 12.0)
		var end := position + dir * probe
		var hit := false
		for bl in living:
			if _seg_circle(position, end, bl[0], bl[1] + body_radius * 0.4):
				hit = true
				creature_blocked_count += 1
				break
		if not hit:
			hit = not r.grow(6.0).has_point(end)
		if not hit:
			for bl in scenery:
				if _seg_circle(position, end, bl[0], bl[1] + body_radius * 0.4):
					hit = true
					break
		_probe_hits.append(hit)
		if hit:
			count += 1
	return count


## Direction of the widest gap (for panicked escapes).
func _escape_dir() -> Vector2:
	var best := -1
	var best_run := 0
	for i in 12:
		if _probe_hits.size() < 12 or _probe_hits[i]:
			continue
		var run := 1
		if not _probe_hits[(i + 1) % 12]: run += 1
		if not _probe_hits[(i + 11) % 12]: run += 1
		if run > best_run:
			best_run = run
			best = i
	if best < 0:
		return Vector2.from_angle(randf() * TAU)
	return Vector2.from_angle(TAU * best / 12.0)


static func _seg_circle(a: Vector2, b: Vector2, c: Vector2, r: float) -> bool:
	var ab := b - a
	var t := clampf((c - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
	return (a + ab * t).distance_to(c) < r


func _danger_at(p: Vector2, threats: Array) -> float:
	var dsum := 0.0
	for t in threats:
		var d: float = p.distance_to(t.pos)
		dsum += t.w * maxf(0.0, 1.0 - d / (t.r + 280.0))
	return dsum


func _decide(threats: Array, nearest: Dictionary) -> void:
	_decision_timer = randf_range(1.0, 1.8)
	var r := swim_rect()
	var candidates: Array = []
	for i in 12:
		candidates.append({"p": Vector2(randf_range(r.position.x, r.end.x), randf_range(r.position.y, r.end.y)), "hide": false})
	for hs in activity.get_hide_spots():
		candidates.append({"p": clamp_to_swim(hs), "hide": true})
	var b: Node2D = activity.blimp
	if nearest.d < 9999.0:
		var behind_blimp: Vector2 = b.position + (b.position - nearest.pos).normalized() * b.body_radius
		candidates.append({"p": clamp_to_swim(behind_blimp), "hide": true, "blimp": true})
	var best = null
	var best_score := -INF
	for c in candidates:
		var p: Vector2 = c.p
		var score := -_danger_at(p, threats) * 3.0
		var edge := minf(minf(p.x - r.position.x, r.end.x - p.x), minf(p.y - r.position.y, r.end.y - p.y))
		score += clampf(edge / 220.0, 0.0, 1.0) * 0.8
		score -= position.distance_to(p) / 1800.0 * 0.4
		# Do not swim through the danger.
		for t in threats:
			if t.w >= 0.8 and _seg_circle(position, p, t.pos, t.r):
				score -= 1.5
		if c.hide:
			score += 0.35 + randf() * 0.4
		# Restless: it doesn't like staying where it already is.
		if p.distance_to(position) < 160.0:
			score -= 0.7
		score += randf() * 0.35
		if score > best_score:
			best_score = score
			best = c
	chase_goal = best.p
	_hiding_behind_blimp = false
	if best.hide:
		_hide_until = activity.activity_time + randf_range(1.5, 3.0)
		if best.get("blimp", false) and b.state in ["idle", "linger"]:
			_hiding_behind_blimp = true
			set_state("hide")
	else:
		_hide_until = 0.0
	# Sometimes: fake one way first.
	if nearest.d < 300.0 and randf() < 0.25 and state == "flee":
		var to := (chase_goal - position).normalized()
		_fake_dir = -to.rotated(randf_range(-0.6, 0.6))
		_fake_time = 0.28
		set_state("fake")


func _avoidance(threats: Array) -> Vector2:
	var push := Vector2.ZERO
	for o in activity.obstacles:
		var d: Vector2 = position - o.pos
		var l = d.length() - o.r
		if l < 70.0:
			push += d.normalized() * (1.0 - maxf(l, 0.0) / 70.0) * 0.8
	for t in threats:
		var d2: Vector2 = position - t.pos
		var l2 = d2.length() - t.r
		if l2 < 140.0:
			push += d2.normalized() * (1.0 - maxf(l2, 0.0) / 140.0) * t.w * 0.9
	var r := swim_rect()
	if position.x - r.position.x < 60.0: push.x += 0.6
	if r.end.x - position.x < 60.0: push.x -= 0.6
	if position.y - r.position.y < 50.0: push.y += 0.6
	if r.end.y - position.y < 50.0: push.y -= 0.6
	return push


func _add_pressure(amount: float, source: String) -> void:
	pressure += amount
	pressure_sources[source] = snappedf(float(pressure_sources.get(source, 0.0)) + amount, 0.01)


func _spit() -> void:
	if _carrying == null:
		return
	var mouth := get_mouth_position()
	var mem = _carrying
	_carrying = null
	_hiding_behind_blimp = false
	body_enabled = true
	z_index = 3
	impact(Vector2(facing, 0), 0.45)
	surprise = 1.0
	spin_vel = 0.0
	_noise(0.0, 0.8)
	activity.water_fx.spawn_bubbles(mouth, 12, 0.8)
	set_state("sulk")
	pressure = 0.0
	memory_spat.emit(mouth, Vector2(facing * 90.0, -60.0))
	if mem:
		pass


# ================================================================ collisions & bites

func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
	if other is Dictionary:
		if state == "imitate_bolt" and rel_speed > 200.0:
			_daze(normal, rel_speed)
		return
	if other == activity.coward and activity.coward.is_bolting() and rel_speed > 250.0:
		if is_chasing():
			_add_pressure(coward_hit_pressure, "coward")
			_stun = 1.3
			set_state("stunned")
			activity.audio.play("coward_impact", 0.0, 1.2)
			activity.camera_impulse(0.15, 0.2)
			_noise(0.0, 1.8)
		else:
			_daze(normal, rel_speed)
		return
	if state == "imitate_bolt" and rel_speed > 180.0:
		_daze(normal, rel_speed)
		return
	if is_chasing() and other == activity.blimp and rel_speed > 40.0:
		_add_pressure(0.08, "blimp")
		impact(normal, 0.25)
		activity.audio.play("blimp_impact", -10.0, 1.5)


func _daze(normal: Vector2, speed: float) -> void:
	impact(normal, 0.4)
	velocity = normal * minf(speed * 0.3, 160.0)
	activity.audio.play("coward_impact", -8.0, 1.5)
	_noise(-4.0, 1.7)
	set_state("dazed")


func take_bite(_from, _amount: float) -> bool:
	_last_bitten = activity.activity_time
	impact(Vector2(randf_range(-1, 1), randf_range(-1, 1)), 0.15)
	surprise = 1.0
	if is_chasing():
		if _bite_pressure_window < 0.25:
			_add_pressure(bite_pressure, "bites")
			_bite_pressure_window += bite_pressure
		if state == "flee" and randf() < 0.15:
			velocity += Vector2.from_angle(randf() * TAU) * 200.0
	elif state == "imitate_swarm" or randf() < 0.1:
		_noise(-8.0, 1.9)
	return true


func can_be_bitten() -> bool:
	return state != "theft_look" and state != "theft_approach"


func bite_priority() -> float:
	return 4.0 if is_chasing() else 1.2


func retreat() -> void:
	_retreating = true
	_hiding_behind_blimp = false
	set_state("retreat")


func return_from_retreat() -> void:
	_retreating = false
	set_state("idle")


func _sulk_point() -> Vector2:
	var r := swim_rect()
	return Vector2(r.position.x + r.size.x * 0.75, r.position.y + 80.0)


func state_allows_bill_look() -> bool:
	return state == "idle" or state == "sulk"


func _noise(vol: float, pitch: float) -> void:
	if _noise_cd > 0.0:
		return
	_noise_cd = 0.35
	activity.audio.play("idiot_noise", vol, pitch, 0.12)


# ================================================================ drawing

func _draw() -> void:
	var r := body_radius
	var swim := anim_t * (6.0 + velocity.length() * 0.03)
	var xf := body_transform(clampf(velocity.y / 500.0, -0.3, 0.3) * facing)
	if _tail_chase > 0.0:
		xf = Transform2D(anim_t * 12.0, Vector2.ZERO) * xf
	# Tiny tail.
	var tw := sin(swim * 2.0) * 6.0
	AqDraw.poly(self, xform_points(xf, PackedVector2Array([Vector2(-r * 0.9, 0), Vector2(-r * 1.45, -10 + tw), Vector2(-r * 1.35, 0), Vector2(-r * 1.45, 10 + tw)])), Color(1.0, 0.6, 0.15))
	# Fins flapping fast.
	var fa := sin(swim * 3.0) * 0.6
	AqDraw.poly(self, xform_points(xf, PackedVector2Array([Vector2(-2, r * 0.4), Vector2(-14, r * 0.7).rotated(fa), Vector2(4, r * 0.75).rotated(fa)])), Color(1.0, 0.65, 0.2))
	# Antenna with a little bobble (it's very proud of it).
	var ant := PackedVector2Array()
	for i in 6:
		var tt := float(i) / 5.0
		ant.append(xf * Vector2(r * 0.1 + tt * 10.0 + sin(swim + tt * 2.0) * 4.0 * tt, -r * 0.9 - tt * 22.0))
	draw_polyline(ant, Color(0.6, 0.4, 0.1), 2.0)
	draw_circle(ant[5], 5.0, Color(1.0, 0.95, 0.4))
	draw_circle(ant[5], 9.0, Color(1.0, 0.95, 0.4, 0.2))
	# Body.
	var body := ellipse_points(Vector2.ZERO, r * 1.0, r * 0.95, 30)
	var bx := xform_points(xf, body)
	var body_col := Color(1.0, 0.82, 0.25).lerp(Color(1.0, 0.7, 0.55), _panic * 0.5)
	AqDraw.poly(self, bx, body_col)
	AqDraw.poly(self, xform_points(xf, ellipse_points(Vector2(2, r * 0.35), r * 0.75, r * 0.45, 20)), Color(1.0, 0.94, 0.7))
	for s in [Vector2(-0.5, -0.4), Vector2(-0.2, -0.65), Vector2(-0.7, 0.05)]:
		draw_circle(xf * (s * r), 3.5, Color(0.95, 0.55, 0.15))
	draw_polyline(bx + PackedVector2Array([bx[0]]), Color(0.6, 0.35, 0.05), 2.0)
	# Mouth: huge grin, or full of memory, or wobbly panic.
	var mouth_c := Vector2(r * 0.5, r * 0.3)
	if _carrying != null:
		# Cheeks puffed around the memory (memory itself draws on top).
		draw_circle(xf * (mouth_c + Vector2(-6, -2)), 10.0, Color(1.0, 0.75, 0.3))
	elif state == "dazed" or state == "sulk" or _panic > 0.5:
		var wob := PackedVector2Array()
		for i in 7:
			wob.append(xf * (mouth_c + Vector2(-10 + i * 3.5, sin(i * 2.0 + anim_t * 20.0 * _panic) * 2.5 + (3.0 if state == "sulk" else 0.0))))
		draw_polyline(wob, Color(0.4, 0.15, 0.05), 2.0)
	else:
		var grin := PackedVector2Array()
		for i in 11:
			var a := lerpf(0.15, PI - 0.15, float(i) / 10.0)
			grin.append(xf * (mouth_c + Vector2(-cos(a) * 12.0, sin(a) * 7.0 - 2.0)))
		AqDraw.poly(self, grin, Color(0.5, 0.1, 0.12))
		draw_line(grin[0], grin[10], Color(1, 1, 1), 2.5)
	# Eyes: mismatched, googly.
	var spiral := state == "stunned" or state == "dazed"
	if spiral:
		for e in [[Vector2(r * 0.15, -r * 0.3), 11.0], [Vector2(r * 0.6, -r * 0.25), 8.0]]:
			var ep: Vector2 = xf * e[0]
			draw_circle(ep, e[1], Color(1, 1, 1))
			for k in 3:
				draw_arc(ep, e[1] * (0.3 + k * 0.25), anim_t * 8.0 + k, anim_t * 8.0 + k + 4.0, 8, Color(0, 0, 0), 1.5)
	else:
		var wob2 := Vector2(sin(anim_t * 30.0), 0) * 2.0 * _panic
		draw_eye(Vector2(r * 0.15, -r * 0.3) + wob2, 11.0, xf, 0.0, 0.45)
		draw_eye(Vector2(r * 0.62, -r * 0.24) - wob2, 8.0, xf, 0.0, 0.5)
	if state == "watch":
		# Concentrating: brows down.
		draw_line(xf * Vector2(r * 0.0, -r * 0.75), xf * Vector2(r * 0.3, -r * 0.62), Color(0.5, 0.3, 0.05), 2.5)
		draw_line(xf * Vector2(r * 0.5, -r * 0.6), xf * Vector2(r * 0.75, -r * 0.66), Color(0.5, 0.3, 0.05), 2.5)
	# Sweat drops when under pressure.
	if _sweat > 0.05:
		for k in 2:
			var sp := xf * Vector2(-r * 0.6 + k * r * 1.3, -r * 0.7) + Vector2(0, fmod(anim_t * 30.0 + k * 10.0, 14.0))
			draw_circle(sp, 3.5 * _sweat, Color(0.7, 0.9, 1.0, _sweat))
	if state == "stunned" or state == "dazed":
		for k in 3:
			var a2 := anim_t * 6.0 + k * TAU / 3.0
			draw_circle(Vector2(cos(a2) * 22.0, -r - 12.0 + sin(a2) * 6.0), 3.0, Color(1, 1, 0.5))


func lid_color() -> Color:
	return Color(0.95, 0.65, 0.15)
