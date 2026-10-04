extends Node2D

const AqDraw = preload("AqDraw.gd")
## THE BASTARDS - a swarm of tiny, fast, irritable biters.
##
## SCRATCH the glass: they get visibly excited (flash red, twitch) and swarm
## to the scratched spot. Anything bitable near that spot gets chewed: the
## shell's restraint, a parasite, plants, other creatures (the Idiot!).
## Excitement fades when the scratching stops, so keep scratching to keep them
## working. When bored they bicker, nip each other and drift back home.
##
## The individuals are lightweight objects (not nodes) so a swarm costs one
## draw call. Each one is still a physics body in the activity's world.

const Stim = preload("GlassStimulus.gd")

## Number of Bastards.
@export_range(3, 16) var swarm_size := 8
## Cruising speed when excited (px/s).
@export var swarm_speed := 340.0
## Speed when idle (px/s).
@export var idle_speed := 90.0
## Scratches further away than this are ignored.
@export var scratch_attention_radius := 1500.0
## Excitement added per scratch report (~12 reports per second while scratching).
@export var excitement_per_scratch := 0.12
## Excitement lost per second.
@export var excitement_decay := 0.16
## Anything bitable within this distance of the scratch point is attacked.
@export var bite_search_radius := 200.0
## Damage each bite does to the shell restraint (it has 100 HP by default).
@export var bite_damage := 0.8
## Seconds between bites for each Bastard (randomised +-40%).
@export var bite_interval := 0.42

class Bastard:
	extends RefCounted
	var position := Vector2.ZERO
	var velocity := Vector2.ZERO
	var body_radius := 10.0
	var body_mass := 0.25
	var body_enabled := true
	var collision_group := "bastard"
	var swarm = null
	var idx := 0
	var offset_angle := 0.0
	var offset_dist := 40.0
	var bite_timer := 0.0
	var jaw := 0.0
	var facing := 1.0
	var twitch := 0.0
	var anger := 0.0
	var bicker_target = null
	var bicker_time := 0.0
	var phase := 0.0
	var squash := 0.0

	func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
		if swarm:
			swarm._member_collision(self, other, normal, rel_speed)

var activity: Node
var members: Array = []
var excitement := 0.0
var swarm_target: Variant = null
var bite_target = null
var home := Vector2.ZERO
var _home_wander := Vector2.ZERO
var _retarget_timer := 0.0
var _bicker_timer := 3.0
var _hint_target = null
var _hint_time := 0.0
var _retreating := false
var _bite_sound_cd := 0.0
var _chatter := 0.0
var _last_event_time := -10.0
var player_driven := false
var _t := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity


func reset_swarm(p_home: Vector2) -> void:
	home = p_home
	_home_wander = p_home
	excitement = 0.0
	swarm_target = null
	bite_target = null
	_hint_target = null
	_retreating = false
	if members.is_empty():
		for i in swarm_size:
			var b := Bastard.new()
			b.swarm = self
			b.idx = i
			members.append(b)
	for b in members:
		b.position = home + Vector2(randf_range(-80, 80), randf_range(-50, 50))
		b.velocity = Vector2.ZERO
		b.offset_angle = randf() * TAU
		b.offset_dist = randf_range(14.0, 46.0)
		b.bite_timer = randf() * bite_interval
		b.phase = randf() * TAU
		b.anger = 0.0


func get_bodies() -> Array:
	return members


func get_debug_text() -> String:
	return "bastards: exc %.2f %s%s" % [excitement, "biting " + _bite_name() if bite_target else ("swarming" if swarm_target != null else "loitering"), " (hint)" if _hint_target else ""]


func _bite_name() -> String:
	if bite_target == null:
		return ""
	if bite_target == activity.shell:
		return "RESTRAINT"
	if bite_target is Node:
		return (bite_target as Node).name
	return "thing"


func swarm_center() -> Vector2:
	var c := Vector2.ZERO
	for b in members:
		c += b.position
	return c / maxf(1.0, members.size())


func is_swarming() -> bool:
	return excitement > 0.2 and swarm_target != null


func on_stimulus(stim) -> bool:
	if _retreating:
		return false
	var c := swarm_center()
	match stim.kind:
		Stim.Kind.SCRATCH:
			if c.distance_to(stim.position) > scratch_attention_radius:
				return false
			var was_calm := excitement < 0.2
			excitement = minf(1.0, excitement + excitement_per_scratch * stim.strength)
			swarm_target = stim.position
			player_driven = not stim.natural
			_hint_target = null
			_retarget_timer = 0.0
			for b in members:
				b.twitch = 1.0
			if was_calm:
				activity.audio.play("bastard_swarm", -6.0, 1.1)
			if activity.activity_time - _last_event_time > 1.2:
				_last_event_time = activity.activity_time
				activity.notify_creature_event("bastards_swarm", activity.bastards, {"target": stim.position})
			return true
		Stim.Kind.HARD_KNOCK, Stim.Kind.DOUBLE_TAP:
			# Scatter briefly, then come back angrier.
			if c.distance_to(stim.position) < stim.radius:
				for b in members:
					var away: Vector2 = (b.position - stim.position).normalized()
					b.velocity += away * 260.0 * (1.5 if stim.kind == Stim.Kind.HARD_KNOCK else 0.6)
					b.anger = 1.0
				return stim.kind == Stim.Kind.HARD_KNOCK
		Stim.Kind.SINGLE_TAP:
			if c.distance_to(stim.position) < 200.0:
				for b in members:
					b.twitch = 0.5
	return false


func tick(delta: float) -> void:
	_t += delta
	_bite_sound_cd -= delta
	excitement = maxf(0.0, excitement - excitement_decay * delta)
	if excitement < 0.12 and _hint_target == null:
		swarm_target = null
		bite_target = null
	_hint_time -= delta
	if _hint_target != null and _hint_time <= 0.0:
		_hint_target = null
	_retarget_timer -= delta
	if _retarget_timer <= 0.0:
		_retarget_timer = 0.3
		_choose_bite_target()
	_bicker_timer -= delta
	if _bicker_timer <= 0.0:
		_bicker_timer = randf_range(2.5, 6.0) * (0.6 if excitement > 0.3 else 1.0)
		_start_bicker()
	if randf() < delta * 0.15:
		_home_wander = home + Vector2(randf_range(-160, 160), randf_range(-90, 90))

	var chatter_target := 0.0
	var center := swarm_center()
	for b in members:
		_tick_member(b, delta, center)
		chatter_target += 1.0 if b.velocity.length() > 150.0 else 0.0
	_chatter = lerpf(_chatter, chatter_target / members.size(), delta * 3.0)
	activity.audio.loop("bastard_swarm_loop", excitement > 0.25 and not _retreating, -14.0 + excitement * 8.0)
	queue_redraw()


func _choose_bite_target() -> void:
	var focus: Variant = swarm_target
	if _hint_target != null:
		bite_target = _hint_target
		return
	if focus == null:
		bite_target = null
		return
	var best = null
	var best_score := -INF
	for t in activity.get_bitables():
		if not t.can_be_bitten():
			continue
		var p: Vector2 = t.bite_point()
		var d := p.distance_to(focus)
		var reach := bite_search_radius
		if t == activity.idiot and activity.is_chase():
			reach *= 1.4
		if d > reach:
			continue
		var score: float = t.bite_priority() * 100.0 - d
		if score > best_score:
			best_score = score
			best = t
	bite_target = best


func _tick_member(b, delta: float, center: Vector2) -> void:
	b.twitch = move_toward(b.twitch, 0.0, delta * 2.0)
	b.anger = move_toward(b.anger, 0.0, delta * 0.3)
	b.jaw = move_toward(b.jaw, 0.0, delta * 6.0)
	b.squash = move_toward(b.squash, 0.0, delta * 4.0)
	b.bicker_time -= delta
	b.offset_angle += delta * (1.5 + excitement * 3.0) * (1.0 if b.idx % 2 == 0 else -1.0)
	var goal: Vector2
	var speed := idle_speed
	if _retreating:
		goal = _retreat_point() + Vector2(cos(b.offset_angle), sin(b.offset_angle)) * 20.0
		speed = idle_speed * 1.6
	elif b.bicker_target != null and b.bicker_time > 0.0:
		goal = b.bicker_target.position
		speed = swarm_speed * 0.8
		if b.position.distance_to(goal) < 16.0:
			_nip(b, b.bicker_target)
			b.bicker_target = null
	elif bite_target != null:
		var bp: Vector2 = _bite_anchor(b)
		goal = bp
		speed = swarm_speed * (0.8 + excitement * 0.4)
		b.bite_timer -= delta
		if b.position.distance_to(bp) < 40.0 and b.bite_timer <= 0.0:
			b.bite_timer = bite_interval * randf_range(0.6, 1.4)
			_bite(b, bite_target)
	elif swarm_target != null:
		goal = swarm_target + Vector2(cos(b.offset_angle), sin(b.offset_angle)) * b.offset_dist
		speed = swarm_speed * (0.7 + excitement * 0.5)
	else:
		goal = _home_wander + Vector2(cos(b.offset_angle + b.idx), sin(b.offset_angle * 0.7 + b.idx)) * (40.0 + b.idx * 6.0)
	# Jitter: they never swim in straight lines.
	var jitter = Vector2(sin(_t * 9.0 + b.phase), cos(_t * 7.3 + b.phase * 1.7)) * (40.0 + excitement * 90.0 + b.twitch * 120.0)
	if bite_target != null and b.bicker_time <= 0.0:
		jitter *= 0.35   # focused on chewing
	var desired = (goal - b.position)
	var dist = desired.length()
	if dist > 1.0:
		desired = desired / dist * speed * clampf(dist / 40.0, 0.3, 1.0)
	desired += jitter
	# Separation.
	for o in members:
		if o == b:
			continue
		var dd: Vector2 = b.position - o.position
		var l := dd.length()
		if l < 22.0 and l > 0.01:
			desired += dd / l * (22.0 - l) * 12.0
	var accel := 900.0 + excitement * 900.0
	b.velocity = b.velocity.move_toward(desired, accel * delta)
	b.position += b.velocity * delta
	var r: Rect2 = activity.get_swim_rect(b.body_radius)
	b.position.x = clampf(b.position.x, r.position.x, r.end.x)
	b.position.y = clampf(b.position.y, r.position.y, r.end.y)
	if absf(b.velocity.x) > 20.0:
		b.facing = move_toward(b.facing, signf(b.velocity.x), delta * 10.0)


func _bite_anchor(b) -> Vector2:
	var t = bite_target
	var base: Vector2
	if t == activity.shell:
		base = t.position + Vector2(lerpf(-0.6, 0.6, float(b.idx) / maxf(1.0, members.size() - 1)) * t.body_radius, -t.body_radius * 0.6)
	elif t is Node2D:
		var rr: float = t.get("body_radius") if t.get("body_radius") != null else 20.0
		base = (t as Node2D).position + Vector2(cos(b.offset_angle), sin(b.offset_angle)) * rr * 0.9
	else:
		base = t.bite_point() + Vector2(cos(b.offset_angle), sin(b.offset_angle)) * 10.0
	return base


func _bite(b, t) -> void:
	b.jaw = 1.0
	b.squash = 0.5
	var landed: bool = t.take_bite(self, bite_damage * (0.8 + excitement * 0.4))
	if landed and _bite_sound_cd <= 0.0:
		_bite_sound_cd = 0.09
		activity.audio.play("bastard_bite", -8.0, randf_range(0.9, 1.3))
	# Sometimes they get distracted and bite each other instead.
	if randf() < 0.06:
		_start_bicker()


func _start_bicker() -> void:
	if members.size() < 2:
		return
	var a = members[randi() % members.size()]
	var c = members[randi() % members.size()]
	if a == c:
		return
	a.bicker_target = c
	a.bicker_time = 0.9
	a.anger = 1.0


func _nip(a, c) -> void:
	a.jaw = 1.0
	c.velocity += (c.position - a.position).normalized() * 220.0
	c.anger = 1.0
	c.twitch = 1.0
	c.bicker_target = a   # ...and it bites back
	c.bicker_time = 0.6 if randf() < 0.5 else 0.0
	if _bite_sound_cd <= 0.0:
		_bite_sound_cd = 0.1
		activity.audio.play("bastard_bite", -14.0, 1.5)


func _member_collision(b, other, _normal: Vector2, rel_speed: float) -> void:
	if other is Dictionary:
		return
	if rel_speed > 160.0:
		b.twitch = 1.0
		b.squash = 0.6


# ------------------------------------------------------------- hints

## Hint level 1/2: go and chew something near point p for a while (no player input needed).
func hint_chew(target, duration := 5.0) -> void:
	_hint_target = target
	_hint_time = duration
	swarm_target = target.bite_point()
	excitement = maxf(excitement, 0.45)


func retreat() -> void:
	_retreating = true
	excitement = 0.0
	swarm_target = null
	bite_target = null


func return_from_retreat() -> void:
	_retreating = false


func _retreat_point() -> Vector2:
	var r: Rect2 = activity.get_swim_rect(10.0)
	return Vector2(r.end.x - 60.0, r.end.y - 10.0)


# ------------------------------------------------------------- drawing

func _draw() -> void:
	var excited := clampf(excitement * 1.3, 0.0, 1.0)
	for b in members:
		var p: Vector2 = b.position
		var f: float = b.facing
		if absf(f) < 0.2:
			f = 0.2 * signf(f + 0.001)
		var sz = 1.0 + b.squash * 0.2
		var ang := clampf(b.velocity.y / 500.0, -0.6, 0.6) * signf(f)
		var xf := Transform2D(ang, p) * Transform2D.IDENTITY.scaled(Vector2(f * sz, 1.0 / sz))
		var anger: float = maxf(b.anger, excited)
		var body_col := Color(0.42, 0.08, 0.1).lerp(Color(0.95, 0.15, 0.12), anger)
		var tail_w := sin(_t * 30.0 + b.phase) * 4.0
		# Tail.
		AqDraw.poly(self, PackedVector2Array([xf * Vector2(-8, 0), xf * Vector2(-17, -6 + tail_w), xf * Vector2(-17, 6 + tail_w)]), body_col.darkened(0.25))
		# Body: angular wedge with a big jaw.
		var jaw: float = b.jaw * 6.0
		var body := PackedVector2Array([
			Vector2(-10, -1), Vector2(-4, -8), Vector2(6, -8), Vector2(12, -3),
			Vector2(13, 1 + jaw * 0.2), Vector2(8, 3 + jaw), Vector2(-2, 7), Vector2(-9, 4),
		])
		AqDraw.poly(self, xform_bastard(xf, body), body_col)
		# Spiky dorsal.
		AqDraw.poly(self, PackedVector2Array([xf * Vector2(-5, -7), xf * Vector2(-1, -14 - anger * 3.0), xf * Vector2(2, -8)]), body_col.darkened(0.3))
		AqDraw.poly(self, PackedVector2Array([xf * Vector2(1, -8), xf * Vector2(5, -13 - anger * 2.0), xf * Vector2(7, -8)]), body_col.darkened(0.3))
		# Teeth (always visible underbite, gnashing when biting).
		for k in 3:
			var tx := 6.0 + k * 2.5
			AqDraw.poly(self, PackedVector2Array([xf * Vector2(tx, 2 + jaw), xf * Vector2(tx + 1.2, -1 + jaw * 0.3), xf * Vector2(tx + 2.4, 2 + jaw)]), Color(1, 0.98, 0.9))
		# Eye with angry brow.
		var ep := xf * Vector2(5, -3)
		draw_circle(ep, 3.2, Color(1, 0.95, 0.6))
		draw_circle(ep + Vector2(f * 0.8, 0), 1.6, Color(0, 0, 0))
		draw_line(xf * Vector2(1, -7.5), xf * Vector2(9, -4.5), Color(0.1, 0, 0), 2.0)
		if b.twitch > 0.5 or b.bicker_time > 0.0:
			# Little anger marks.
			var mp := p + Vector2(0, -16)
			draw_line(mp + Vector2(-3, -3), mp + Vector2(3, 3), Color(1, 0.4, 0.3, 0.8), 1.5)
			draw_line(mp + Vector2(3, -3), mp + Vector2(-3, 3), Color(1, 0.4, 0.3, 0.8), 1.5)


func xform_bastard(xf: Transform2D, pts: PackedVector2Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in pts:
		out.append(xf * p)
	return out
