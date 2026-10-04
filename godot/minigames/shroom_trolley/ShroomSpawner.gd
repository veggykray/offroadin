extends Node
## Decides WHAT flies, WHEN, and from WHICH spawn marker, and launches it on a
## fair, readable arc.
##
## Spawn points: every Marker2D under the activity's "SpawnPoints" node. Move
## them onto shelves / chutes in your real scene. Name doesn't matter.
##
## Fairness rules for every launch:
##   * the landing spot (at trolley rim height) is chosen first, then the arc is
##     solved backwards, so the speed you SEE is exactly what you get.
##   * the landing spot is always one the trolley can physically reach in time
##     (based on its real top speed, minus a reaction allowance).
##   * every launch is telegraphed by a puff at its spawn point first.

signal phase_changed(index: int, phase: Dictionary)

## The round structure. Edit numbers here to change pacing.
##   interval      seconds between launches (random between x and y)
##   weights       relative chance of each mushroom type_id
##   advance_good  move to the next phase when this many good shrooms are held
##   advance_time  ...or after this many seconds, whichever comes first
##   speed         multiplier on flight speed (lower = floatier, easier)
##   volley        chance that a launch is a double/triple
var phases: Array[Dictionary] = [
	{"name": "Warm-up", "hint": "Catch the shrooms in the trolley!", "interval": Vector2(2.3, 2.8), "weights": {&"normal": 1.0}, "advance_good": 3, "advance_time": 30.0, "speed": 0.85, "volley": 0.0, "reach": 0.6},
	{"name": "Bouncy", "hint": "BOUNCY shrooms! Stay underneath them!", "interval": Vector2(1.8, 2.3), "weights": {&"normal": 3.0, &"bouncy": 2.5}, "advance_good": 5, "advance_time": 30.0, "speed": 0.95, "volley": 0.0, "reach": 0.7},
	{"name": "Rotten", "hint": "ROTTEN shrooms! Dodge them - or SPACE to bash them out!", "interval": Vector2(1.6, 2.1), "weights": {&"normal": 4.0, &"bouncy": 2.0, &"rotten": 2.5}, "advance_good": 7, "advance_time": 30.0, "speed": 1.0, "volley": 0.1, "reach": 0.75, "first": &"rotten"},
	{"name": "Golden", "hint": "A GOLDEN SHROOM! GET IT!", "interval": Vector2(1.6, 2.0), "weights": {&"normal": 4.0, &"bouncy": 2.0, &"rotten": 2.0}, "advance_good": 9, "advance_time": 22.0, "speed": 1.0, "volley": 0.15, "reach": 0.8, "first": &"golden"},
	{"name": "Chaos", "hint": "SHROOM CHAOS!", "interval": Vector2(1.05, 1.5), "weights": {&"normal": 4.0, &"bouncy": 3.0, &"rotten": 3.0, &"golden": 0.35}, "advance_good": 999, "advance_time": 9999.0, "speed": 1.05, "volley": 0.3, "reach": 0.85},
	{"name": "Checkout", "hint": "ORDER READY! Get it to the CHECKOUT - carefully!", "interval": Vector2(2.4, 3.2), "weights": {&"normal": 3.0, &"rotten": 2.0, &"bouncy": 1.0}, "advance_good": 999, "advance_time": 9999.0, "speed": 1.0, "volley": 0.0, "reach": 0.8},
	{"name": "Dump", "hint": "Tip it in!", "interval": Vector2(99, 99), "weights": {}, "advance_good": 999, "advance_time": 9999.0, "speed": 1.0, "volley": 0.0, "reach": 0.0},
]
const PHASE_CHAOS := 4
const PHASE_CHECKOUT := 5
const PHASE_DUMP := 6

## Seconds of warning puff before each launch.
@export var telegraph_time := 0.5
## Fastest sideways speed a launched mushroom may have (readability).
@export var max_launch_vx := 560.0
## Reaction time we assume the player needs before moving.
@export var reaction_allowance := 0.35

var activity: Node
var phase := 0
var phase_time := 0.0
var running := false
var _timer := 1.0
var _pending: Array[Dictionary] = []  # telegraphed launches waiting to fire
var _rng := RandomNumberGenerator.new()


func setup(a: Node) -> void:
	activity = a
	_rng.seed = randi()  # follows the global seed() so test runs can be repeated


func start() -> void:
	running = true
	set_phase(0)
	_timer = 1.2


func stop() -> void:
	running = false
	_pending.clear()


func set_phase(i: int) -> void:
	phase = clampi(i, 0, phases.size() - 1)
	phase_time = 0.0
	var p := phases[phase]
	if p.has("first"):
		_timer = 0.6
	phase_changed.emit(phase, p)


func current() -> Dictionary:
	return phases[phase]


func update(delta: float, good_held: int) -> void:
	_update_pending(delta)
	if not running:
		return
	phase_time += delta
	var p := phases[phase]
	if phase < PHASE_CHAOS and (good_held >= p.advance_good or phase_time >= p.advance_time):
		set_phase(phase + 1)
		p = phases[phase]
	if phase == PHASE_DUMP:
		return
	_timer -= delta
	if _timer <= 0.0:
		var iv: Vector2 = p.interval
		_timer = _rng.randf_range(iv.x, iv.y)
		var type_id: StringName
		if p.has("first") and phase_time < 1.0:
			type_id = p.first
		else:
			type_id = _pick_type(p.weights)
		if type_id == &"":
			return
		queue_launch(type_id)
		if _rng.randf() < float(p.volley):
			var extra := 1 if _rng.randf() < 0.7 else 2
			for k in extra:
				queue_launch(_pick_type(p.weights), 0.25 * (k + 1))


func _pick_type(weights: Dictionary) -> StringName:
	var total := 0.0
	for w in weights.values():
		total += w
	if total <= 0.0:
		return &""
	var r := _rng.randf() * total
	for k in weights.keys():
		r -= weights[k]
		if r <= 0.0:
			return k
	return weights.keys().back()


# --- Launching ---------------------------------------------------------------

## Telegraph and then launch a mushroom of `type_id` at a fair landing spot.
func queue_launch(type_id: StringName, extra_delay := 0.0, marker: Node2D = null, target_x := NAN) -> void:
	var data: Resource = activity.get_type(type_id)
	if data == null:
		return
	var spd: float = phases[phase].get("speed", 1.0)
	var ft: Vector2 = data.flight_time
	var t := _rng.randf_range(ft.x, ft.y) / maxf(spd, 0.1)
	if is_nan(target_x):
		target_x = _choose_target_x(t, float(phases[phase].get("reach", 0.8)))
	if marker == null:
		marker = _choose_marker(target_x, t)
	if marker == null:
		return
	var warn := telegraph_time * (1.6 if data.is_bonus() else 1.0)
	_pending.append({"type": type_id, "marker": marker, "target_x": target_x, "t": t, "wait": warn + extra_delay, "warned": false})


func _update_pending(delta: float) -> void:
	var i := 0
	while i < _pending.size():
		var p: Dictionary = _pending[i]
		p.wait -= delta
		var data: Resource = activity.get_type(p.type)
		if not p.warned and p.wait <= telegraph_time * (1.6 if data.is_bonus() else 1.0):
			p.warned = true
			activity.telegraph(p.marker.global_position, data)
		if p.wait <= 0.0:
			_pending.remove_at(i)
			launch_now(p.type, p.marker.global_position, p.target_x, p.t)
		else:
			i += 1


## Launch immediately from `from` so it reaches catch height at `target_x`
## after `t` seconds.
func launch_now(type_id: StringName, from: Vector2, target_x: float, t: float) -> Node:
	var data: Resource = activity.get_type(type_id)
	var target := Vector2(target_x, activity.floor_y - 110.0)
	var v := solve_launch(from, target, t, activity.shroom_gravity * data.gravity_multiplier)
	# keep arcs inside the visible play space
	var guard := 0
	while guard < 6 and from.y - (v.y * v.y) / (2.0 * activity.shroom_gravity * data.gravity_multiplier) < activity.ceiling_y and v.y < 0.0:
		t *= 0.85
		v = solve_launch(from, target, t, activity.shroom_gravity * data.gravity_multiplier)
		guard += 1
	if absf(v.x) > max_launch_vx * 1.25:
		v.x = signf(v.x) * max_launch_vx * 1.25
	v += Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * data.launch_jitter
	var m: Node = activity.spawn_mushroom(data, from, v)
	m.angular_velocity = _rng.randf_range(-1.0, 1.0) * data.launch_spin
	return m


static func solve_launch(from: Vector2, to: Vector2, t: float, g: float) -> Vector2:
	return Vector2((to.x - from.x) / t, (to.y - from.y - 0.5 * g * t * t) / t)


func _choose_target_x(t: float, reach_frac: float) -> float:
	var tr: Node2D = activity.trolley
	# trolley bounds are stored in the activity's local space; work in global
	var lo: float = activity.to_global(Vector2(tr.min_x, 0)).x
	var hi: float = activity.to_global(Vector2(tr.max_x, 0)).x
	var tx: float = tr.global_position.x
	# how far could the trolley get in time? (a bit less than flat-out)
	var reach: float = tr.effective_max_speed() * maxf(0.2, t - reaction_allowance) * reach_frac
	var a := maxf(lo, tx - reach)
	var b := minf(hi, tx + reach)
	var x := _rng.randf_range(a, b)
	# usually make the player move a bit - not always straight above them
	if absf(x - tx) < 70.0 and _rng.randf() < 0.65:
		var dir := 1.0 if _rng.randf() < 0.5 else -1.0
		if tx + dir * 150.0 > b or tx + dir * 150.0 < a:
			dir = -dir
		x = clampf(tx + dir * _rng.randf_range(110.0, 200.0), a, b)
	return x


func _choose_marker(target_x: float, t: float) -> Node2D:
	var markers: Array = activity.get_spawn_markers()
	if markers.is_empty():
		return null
	var ok: Array = []
	for mk in markers:
		if absf(mk.global_position.x - target_x) / t <= max_launch_vx:
			ok.append(mk)
	if ok.is_empty():
		# nothing comfortable: use the closest one horizontally
		var best: Node2D = markers[0]
		for mk in markers:
			if absf(mk.global_position.x - target_x) < absf(best.global_position.x - target_x):
				best = mk
		return best
	return ok[_rng.randi() % ok.size()]
