extends Node
## Small, UNCOMMON random events that spice up a round without drowning the
## skill game. At most one event every `min_gap` seconds, and only in the
## phases listed for each event.
##
## Extension point: add a new entry to `events` and a matching _event_<id>()
## function. Future big events (tidal wave, gravity flip, rival shoppers) would
## plug in here the same way.

signal event_started(id: StringName)

@export var enabled := true
## Seconds between event rolls.
@export var min_gap := 16.0
@export var max_gap := 26.0
## Chance an event actually fires on a roll.
@export_range(0.0, 1.0) var chance := 0.65

## id -> phases it may happen in, weight, max times per round
var events := {
	&"shelf_burst": {"phases": [1, 2, 3, 4], "weight": 3.0, "max": 3},
	&"midair_collision": {"phases": [2, 3, 4], "weight": 2.0, "max": 2},
	&"giant_shroom": {"phases": [3, 4, 5], "weight": 1.5, "max": 1},
	&"checkout_spit": {"phases": [5], "weight": 2.0, "max": 1},
}

var activity: Node
var _timer := 0.0
var _counts := {}
var _rng := RandomNumberGenerator.new()


func setup(a: Node) -> void:
	activity = a
	_rng.seed = randi()  # follows the global seed() so test runs can be repeated
	reset()


func reset() -> void:
	_counts.clear()
	_timer = _rng.randf_range(min_gap, max_gap)


func update(delta: float, phase: int) -> void:
	if not enabled:
		return
	_timer -= delta
	if _timer > 0.0:
		return
	_timer = _rng.randf_range(min_gap, max_gap)
	if _rng.randf() > chance:
		return
	var pool := []
	var total := 0.0
	for id in events.keys():
		var e: Dictionary = events[id]
		if phase in e.phases and int(_counts.get(id, 0)) < int(e.max):
			pool.append(id)
			total += e.weight
	if pool.is_empty():
		return
	var r := _rng.randf() * total
	for id in pool:
		r -= events[id].weight
		if r <= 0.0:
			trigger(id)
			return


func trigger(id: StringName) -> void:
	_counts[id] = int(_counts.get(id, 0)) + 1
	event_started.emit(id)
	if has_method("_event_" + String(id)):
		call("_event_" + String(id))


func _event_shelf_burst() -> void:
	## One spawn point coughs out three mushrooms in a fan.
	var markers: Array = activity.get_spawn_markers()
	if markers.is_empty():
		return
	var mk: Node2D = markers[_rng.randi() % markers.size()]
	var sp: Node = activity.spawner
	activity.telegraph(mk.global_position, activity.get_type(&"normal"), 2.0)
	var base_x: float = activity.trolley.global_position.x
	for k in 3:
		var id := &"normal" if k != 1 or _rng.randf() < 0.5 else &"bouncy"
		sp.queue_launch(id, 0.35 + k * 0.16, mk, clampf(base_x + (k - 1) * 120.0 + _rng.randf_range(-40, 40), activity.global_min_x(), activity.global_max_x()))


func _event_midair_collision() -> void:
	## Two mushrooms from opposite sides timed to smack into each other.
	var markers: Array = activity.get_spawn_markers()
	if markers.size() < 2:
		return
	var left: Node2D = markers[0]
	var right: Node2D = markers[0]
	for mk in markers:
		if mk.global_position.x < left.global_position.x:
			left = mk
		if mk.global_position.x > right.global_position.x:
			right = mk
	if left == right:
		return
	var meet := Vector2(lerpf(left.global_position.x, right.global_position.x, _rng.randf_range(0.35, 0.65)), activity.floor_y - 330.0)
	activity.telegraph(left.global_position, activity.get_type(&"normal"), 1.2)
	activity.telegraph(right.global_position, activity.get_type(&"bouncy"), 1.2)
	var t := 0.95
	var g: float = activity.shroom_gravity
	var a_id := &"normal"
	var b_id := &"bouncy" if _rng.randf() < 0.6 else &"rotten"
	var timer := get_tree().create_timer(0.55)
	timer.timeout.connect(func():
		if not activity.is_running():
			return
		var da: Resource = activity.get_type(a_id)
		var db: Resource = activity.get_type(b_id)
		activity.spawn_mushroom(da, left.global_position, activity.spawner.solve_launch(left.global_position, meet, t, g * da.gravity_multiplier))
		activity.spawn_mushroom(db, right.global_position, activity.spawner.solve_launch(right.global_position, meet, t, g * db.gravity_multiplier))
	)


func _event_giant_shroom() -> void:
	## A giant mushroom bounds across the shop floor. Duck under it between
	## hops, or it lands on your pile.
	activity.spawn_giant()


func _event_checkout_spit() -> void:
	## The checkout hiccups and fires a mushroom back out. Free catch!
	activity.checkout_spit()
