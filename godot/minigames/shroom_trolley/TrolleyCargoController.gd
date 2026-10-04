extends Node
## Owns everything INSIDE the trolley basket: catching, the visible pile,
## jiggle, and spilling.
##
## How spilling works (deterministic, never random):
##   1. Every frame the trolley's change in speed (dv) shoves a single "sway"
##      spring the opposite way, like a real load sliding when you brake.
##      Sudden reversals hit the spring twice (stop + go) and overshoot it.
##   2. Each mushroom displays that sway scaled by how high it sits in the pile,
##      so a tall pile visibly leans before it goes. That lean IS the warning.
##   3. spill_force = |sway| x height of the TOP mushroom.
##      spill_threshold = how well that layer is held (inside the basket walls =
##      very well, piled above the rim = badly, higher = worse).
##   4. If force > threshold the top mushroom flies out in the direction the
##      load was sliding. Then the next one is checked, so a big mistake
##      cascades into a proper disaster.
## Drive smoothly and nothing ever falls out, however full the trolley is.

signal caught(mushroom: Node, impact: Dictionary)
signal spilled(mushroom: Node)
signal load_changed(count: int, weight: float)

const T := preload("Trolley.gd")

@export_group("Pile layout")
## Mushrooms per layer, bottom first. The first two layers are inside the
## basket. Everything above the rim is a wobbly tower.
@export var layer_capacity: PackedInt32Array = PackedInt32Array([4, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1])
@export var layer_height := 29.0
@export var column_spacing := 30.0
## Number of layers that sit inside the basket walls (held firmly).
@export var layers_inside_basket := 2

@export_group("Sway")
@export var sway_stiffness := 110.0
@export var sway_damping := 5.2
## How strongly the trolley's change of speed shoves the pile.
@export var sway_inertia := 1.4
@export var height_factor_base := 0.6
@export var height_factor_per_layer := 0.36

@export_group("Spilling")
## Hold strength for layers inside the basket (only crashes beat this).
@export var hold_inside := 62.0
## Hold strength of the first layer above the rim.
@export var hold_above_rim := 30.0
## Each higher layer is this much easier to lose.
@export var hold_drop_per_layer := 5.0
@export var hold_min := 12.0
## Seconds between consecutive spills in a cascade.
@export var spill_interval := 0.075
## At speed the pile rattles LOOSE (you can see it jitter). A loose pile holds
## this much less (0.4 = 40% weaker at full looseness). This is why braking
## hard from top speed is a disaster but the same stop from walking pace is not.
@export var looseness_effect := 0.4
## How much a TROLLEY BASH shoves your own load (0..1 of a normal speed change).
@export var bash_sway_factor := 0.5

@export_group("Catching")
## Bouncy shrooms count as caught once their speed relative to the trolley is
## below this (or they've been in the basket long enough).
@export var settle_speed := 270.0
@export var settle_time := 0.28

var trolley: Node2D
var items: Array[Dictionary] = []
var sway := 0.0
var sway_v := 0.0
var spill_force := 0.0
var spill_threshold := INF
var catching_enabled := true
var spilling_enabled := true
var total_weight := 0.0
## 0..1, rises quickly with speed, settles slowly when you slow down.
var looseness := 0.0
var _spill_cd := 0.0
var _t := 0.0


func setup(t: Node2D) -> void:
	trolley = t


func count() -> int:
	return items.size()


func height_factor(layer: int) -> float:
	return height_factor_base + height_factor_per_layer * layer


func hold_for_layer(layer: int) -> float:
	if layer < layers_inside_basket:
		return hold_inside
	return maxf(hold_min, hold_above_rim - hold_drop_per_layer * (layer - layers_inside_basket))


func layer_of_index(i: int) -> Vector3i:
	## Returns (layer, column, items_in_that_layer) for the i-th cargo item.
	var start := 0
	var layer := 0
	while true:
		var cap := layer_capacity[mini(layer, layer_capacity.size() - 1)]
		if i < start + cap:
			var in_layer := mini(cap, items.size() - start)
			return Vector3i(layer, i - start, in_layer)
		start += cap
		layer += 1
	return Vector3i.ZERO


func slot_position(i: int) -> Vector2:
	var l := layer_of_index(i)
	var x := (float(l.y) - (l.z - 1) * 0.5) * column_spacing
	var y := T.FLOOR_Y - 17.0 - l.x * layer_height
	return Vector2(x, y)


func top_layer() -> int:
	if items.is_empty():
		return -1
	return items.back().layer


## Local Y of the top surface of the pile (or the basket floor when empty).
func pile_surface_y() -> float:
	if items.is_empty():
		return T.FLOOR_Y
	return T.FLOOR_Y - 17.0 - top_layer() * layer_height - layer_height * 0.6


func _relayout() -> void:
	for i in items.size():
		var it: Dictionary = items[i]
		var new_slot := slot_position(i)
		if it.has("slot"):
			# keep it visually where it is; the spring glides it to its new slot
			it.off += it.slot - new_slot
		it.slot = new_slot
		it.layer = layer_of_index(i).x
	_update_weight()


func _update_weight() -> void:
	total_weight = 0.0
	for it in items:
		if is_instance_valid(it.m):
			total_weight += it.m.data.cargo_weight
	if trolley:
		trolley.load_mass = total_weight
	load_changed.emit(items.size(), total_weight)


# --- Main update ------------------------------------------------------------

func physics_update(delta: float, flying: Array) -> void:
	if trolley == null:
		return
	_spill_cd = maxf(0.0, _spill_cd - delta)

	_t += delta
	# 1. Load sway spring, driven by the trolley's change in speed. (A bash is
	#    a jolt Bill controls, so it shoves the load a bit less.)
	var dv: float = trolley.last_dv - trolley.last_bash_dv * (1.0 - bash_sway_factor)
	sway_v += -dv * sway_inertia
	sway_v += (-sway_stiffness * sway - sway_damping * sway_v) * delta
	sway += sway_v * delta
	sway = clampf(sway, -80.0, 80.0)
	var speed01: float = absf(trolley.velocity) / trolley.max_speed
	var loose_target := clampf((speed01 - 0.3) / 0.6, 0.0, 1.0)
	looseness = move_toward(looseness, loose_target, delta * (3.0 if loose_target > looseness else 1.1))

	# 2. Catch flying mushrooms that dropped into the basket / onto the pile.
	if catching_enabled:
		for m in flying:
			if is_instance_valid(m) and m.is_flying():
				_check_catch(m, delta)

	# 3. Move cargo (landing bounce + sway jiggle).
	_update_items(delta)

	# 4. Spill check.
	if items.is_empty():
		spill_force = 0.0
		spill_threshold = INF
	else:
		var tl := top_layer()
		spill_force = absf(sway) * height_factor(tl)
		spill_threshold = hold_for_layer(tl) * (1.0 - looseness_effect * looseness)
		if spilling_enabled and spill_force > spill_threshold and _spill_cd <= 0.0:
			_spill_top(signf(sway))


func _check_catch(m: Node, delta: float) -> void:
	if m.no_catch_time > 0.0 or m.data.role == 3:  # HAZARD (giant) can't be caught
		return
	var local: Vector2 = trolley.global_to_trolley(m.global_position)
	var r: float = m.data.radius
	var surface := pile_surface_y()
	var zone_top := minf(T.RIM_Y + r * 0.4, surface - r * 0.9)
	var half: float
	if local.y < T.RIM_Y:
		# above the rim: the pile is narrower than the basket
		var next_layer := layer_of_index(items.size()).x
		var cap := layer_capacity[mini(next_layer, layer_capacity.size() - 1)]
		half = maxf((cap - 1) * 0.5 * column_spacing + r * 0.6, r)
	else:
		half = trolley.inner_half_width_at(local.y) - r * 0.35
	var inside := absf(local.x) <= half and local.y >= zone_top and local.y <= T.FLOOR_Y + 2.0
	if not inside:
		m.inside_time = maxf(0.0, m.inside_time - delta * 0.5)
		return
	var rel: Vector2 = m.linear_velocity - trolley.get_trolley_velocity()
	if m.data.must_settle_to_catch:
		m.inside_time += delta
		if rel.length() > settle_speed and m.inside_time < settle_time:
			return
	elif rel.y < -140.0:
		return  # it's on its way back out
	_catch(m, local, rel)


func _catch(m: Node, local: Vector2, rel: Vector2) -> void:
	var first_time: bool = not m.ever_cargo
	m.enter_cargo()
	var it := {
		"m": m,
		"off": Vector2.ZERO,
		"vel": Vector2.ZERO,
		"jit": Vector2(randf_range(-3.0, 3.0), randf_range(-2.0, 1.5)),
		"tilt": randf_range(-0.35, 0.35),
		"layer": 0,
	}
	items.append(it)
	_relayout()
	var basket_local: Vector2 = trolley.basket_transform().affine_inverse() * local
	it.off = (basket_local - it.slot).limit_length(70.0)
	it.vel = Vector2(rel.x * 0.15, rel.y * 0.3)
	var w: float = m.data.cargo_weight
	sway_v += rel.x * 0.03 * w
	var impact := clampf(absf(rel.y) / 600.0, 0.4, 1.7)
	trolley.add_thump(m.data.catch_thump * impact)
	m.kick_squash(6.0 * impact)
	caught.emit(m, {"impact": impact, "rel_velocity": rel, "count": items.size(), "first_time": first_time})


func _update_items(delta: float) -> void:
	var bx: Transform2D = trolley.basket_transform()
	var gx: Transform2D = trolley.global_transform
	var rot := bx.get_rotation() + trolley.global_rotation
	var i := 0
	while i < items.size():
		var it: Dictionary = items[i]
		if not is_instance_valid(it.m):
			items.remove_at(i)
			_relayout()
			continue
		var m: Node = it.m
		var acc: Vector2 = -340.0 * it.off - 15.0 * it.vel
		it.vel += acc * delta
		it.off += it.vel * delta
		var h := height_factor(it.layer)
		var sx: float = sway * h
		var rattle := sin(_t * 41.0 + i * 1.7) * looseness * 2.2 * h
		var p: Vector2 = it.slot + it.jit + it.off + Vector2(sx, -absf(sx) * 0.12 + rattle) * T.S
		m.global_position = gx * (bx * p)
		m.rotation = rot + it.tilt + sx * 0.018
		i += 1


# --- Releasing cargo --------------------------------------------------------

func release(it: Dictionary, velocity: Vector2, spin: float = 0.0) -> void:
	var idx := items.find(it)
	if idx < 0:
		return
	items.remove_at(idx)
	var m: Node = it.m
	if is_instance_valid(m):
		m.exit_cargo(velocity, spin)
	_relayout()


func _spill_top(dir: float) -> void:
	var it: Dictionary = items.back()
	var h := height_factor(it.layer)
	var tv: float = trolley.velocity
	var vx := tv + sway_v * h * 1.1 + dir * 130.0
	var vy := -170.0 - absf(sway_v) * 0.35 * h - randf() * 60.0
	var m: Node = it.m
	release(it, Vector2(vx, clampf(vy, -650.0, -120.0)), dir * randf_range(4.0, 9.0))
	# NOTE: sway is NOT reduced - the load keeps sliding, so a big mistake
	# keeps throwing mushrooms out until the force drops or a firmer layer holds.
	_spill_cd = spill_interval
	spilled.emit(m)


## Debug / events: throw out the top `n` mushrooms.
func force_spill(n: int, dir: float = 0.0) -> void:
	if dir == 0.0:
		dir = 1.0 if randf() < 0.5 else -1.0
	for k in n:
		if items.is_empty():
			return
		_spill_top(dir)


## TROLLEY BASH: the whole pile hops, loose rotten mushrooms (slimy, they never
## wedge in) get flung out backwards over Bill's head.
func bash_pop(dir: int) -> Array:
	var thrown: Array = []
	for it in items.duplicate():
		if not is_instance_valid(it.m):
			continue
		it.vel += Vector2(-dir * 30.0, -110.0 * height_factor(it.layer))
		if it.m.data.is_bad():
			thrown.append(it.m)
			release(it, Vector2(trolley.velocity * 0.4 - dir * randf_range(160.0, 240.0), -randf_range(620.0, 720.0)), -dir * 8.0)
	return thrown


## Release everything (used for the checkout dump). Returns items top-first.
func take_all_top_first() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for k in range(items.size() - 1, -1, -1):
		out.append(items[k])
	return out


func empty_all(free_them := true) -> void:
	for it in items:
		if free_them and is_instance_valid(it.m):
			it.m.queue_free()
	items.clear()
	sway = 0.0
	sway_v = 0.0
	_update_weight()


# --- Queries ------------------------------------------------------------------

func get_counts() -> Dictionary:
	var c := {"normal": 0, "bouncy": 0, "golden": 0, "rotten": 0, "good": 0, "bad": 0, "total": items.size()}
	for it in items:
		if not is_instance_valid(it.m):
			continue
		var d: Resource = it.m.data
		var key := String(d.type_id)
		c[key] = c.get(key, 0) + 1
		if d.is_good():
			c.good += 1
		elif d.is_bad():
			c.bad += 1
	return c


func get_mushrooms() -> Array:
	var out := []
	for it in items:
		if is_instance_valid(it.m):
			out.append(it.m)
	return out
