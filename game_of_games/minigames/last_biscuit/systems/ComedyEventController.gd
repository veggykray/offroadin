class_name LBComedyEvents
extends Node
## A small pool of rare, silent comedic interruptions. Each one also changes
## the tactical situation for a few seconds (a window, or a moment to freeze).
## Nobody acknowledges anything.

@export var first_event_delay := Vector2(35.0, 50.0)
@export var interval := Vector2(26.0, 42.0)
@export var enabled := true

var manager: LBManager
var running := false
var _timer := 40.0
var _bag: Array[String] = []
var _rng := RandomNumberGenerator.new()

const EVENTS := ["sneeze", "fly", "legit_reach", "teeth", "cat_tail", "waiter"]


func _ready() -> void:
	_rng.randomize()
	manager = get_parent() as LBManager
	_timer = _rng.randf_range(first_event_delay.x, first_event_delay.y)


func _process(dt: float) -> void:
	if not enabled or manager == null or running:
		return
	if not manager.is_event_allowed():
		return
	_timer -= dt
	if _timer <= 0.0:
		trigger_next()


func trigger_next() -> void:
	if running:
		return
	if _bag.is_empty():
		_bag.assign(EVENTS.duplicate())
		_bag.shuffle()
	var ev: String = _bag.pop_back()
	trigger(ev)


func trigger(ev: String) -> void:
	if running:
		return
	running = true
	match ev:
		"sneeze": await _sneeze()
		"fly": await _fly()
		"legit_reach": await _legit_reach()
		"teeth": await _teeth()
		"cat_tail": await _cat_tail()
		"waiter": await _waiter()
	running = false
	_timer = _rng.randf_range(interval.x, interval.y)


func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


func _pick_diner(filter: Callable) -> LBDiner:
	var pool := manager.diners.filter(filter)
	if pool.is_empty():
		return null
	return pool[_rng.randi() % pool.size()]


func _rival_of(d: LBDiner) -> LBRivalHand:
	for r in manager.rivals:
		if r.owner_index == d.index:
			return r
	return null


func _freeze_rivals(on: bool) -> void:
	for r in manager.rivals:
		r.forced_freeze = on


# ----------------------------------------------------------------- sneeze
## "Ah... ah..." (a readable wind-up), then CHOO: everyone looks at them.
func _sneeze() -> void:
	var d := _pick_diner(func(x: LBDiner): return x.behaviour != LBDiner.Behaviour.BLIND_LISTENER and x.state != "asleep")
	if d == null:
		return
	manager.audio.play_at("sneeze", d.head_world(), 0.0)
	var tw := create_tween()
	tw.tween_property(d, "sneeze_wind", 1.0, 1.05).set_trans(Tween.TRANS_SINE)
	await tw.finished
	d.sneeze_wind = -0.8
	d.mouth_open = 1.0
	manager.camera.shake(0.15)
	var tw2 := create_tween()
	tw2.tween_property(d, "sneeze_wind", 0.0, 0.5)
	tw2.parallel().tween_property(d, "mouth_open", 0.0, 0.4)
	for o in manager.diners:
		if o != d:
			o.look_at_world(d.head_world(), _rng.randf_range(2.4, 3.0), 3.5)
	# the sneeze physically rattles the nearest crockery
	for obj in manager.world.objects:
		if obj.on_table and obj.plane_pos.distance_to(d.seat) < 1.1 and obj.mass < 0.5:
			obj.jump(_rng.randf_range(0.15, 0.4))
	await _wait(3.0)


# -------------------------------------------------------------------- fly
## A fly lands on the biscuit. Every hand stops. It cleans itself. Leaves.
func _fly() -> void:
	var b := manager.real_biscuit()
	if b == null or b.held_by != null:
		return
	var fly := _make_fly()
	var start := Vector3(_rng.randf_range(-3.0, 3.0), 2.2, _rng.randf_range(-4.0, 2.0))
	fly.global_position = start
	manager.audio.buzz(true, start)
	var land := LBConst.p2w(b.plane_pos, LBConst.TABLE_Y + 0.07)
	var t := 0.0
	while t < 2.2:
		var dt := get_process_delta_time()
		t += dt
		var k := t / 2.2
		var p := start.lerp(land, k) + Vector3(sin(t * 9.0), sin(t * 7.0) * 0.5, cos(t * 11.0)) * 0.25 * (1.0 - k)
		fly.global_position = p
		manager.audio.buzz(true, p)
		await get_tree().process_frame
		if not is_instance_valid(b) or b.held_by != null:
			break
	manager.audio.buzz(false)
	if is_instance_valid(b) and b.held_by == null:
		_freeze_rivals(true)
		for d in manager.diners:
			d.look_at_world(land, 3.6, 3.0)
		# it rubs its little hands together
		var legs := fly.get_node("Legs") as Node3D
		t = 0.0
		while t < 3.2:
			t += get_process_delta_time()
			legs.rotation.x = sin(t * 30.0) * 0.6
			fly.rotation.y = sin(t * 0.8) * 0.5
			if is_instance_valid(b) and b.held_by != null:
				break
			await get_tree().process_frame
	manager.audio.buzz(true, fly.global_position)
	var leave := fly.global_position + Vector3(_rng.randf_range(-3.0, 3.0), 2.5, -3.0)
	var tw := create_tween()
	tw.tween_property(fly, "global_position", leave, 1.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await _wait(0.3)
	_freeze_rivals(false)
	await tw.finished
	manager.audio.buzz(false)
	fly.queue_free()


func _make_fly() -> Node3D:
	var f := Node3D.new()
	manager.add_child(f)
	var black := LBMat.std("fly", Color(0.03, 0.03, 0.04), 0.3, 0.3)
	LBMesh.add(f, LBMesh.sphere_mesh(0.007, 8), black, Vector3.ZERO, Vector3.ZERO, Vector3(1, 0.8, 1.6))
	LBMesh.add(f, LBMesh.sphere_mesh(0.005, 8), LBMat.std("flyeye", Color(0.4, 0.05, 0.05), 0.0, 0.2), Vector3(0, 0.002, -0.01))
	var wing := LBMat.glass(Color(0.8, 0.85, 0.9, 0.35))
	for s in [-1.0, 1.0]:
		LBMesh.add(f, LBMesh.box_mesh(Vector3(0.012, 0.001, 0.006)), wing, Vector3(0.008 * s, 0.005, 0.003), Vector3(0, 20 * s, 15 * s), Vector3.ONE, false)
	var legs := LBMesh.pivot(f, Vector3(0, -0.003, -0.006), "Legs")
	for s in [-1.0, 1.0]:
		LBMesh.add(legs, LBMesh.box_mesh(Vector3(0.001, 0.001, 0.008)), black, Vector3(0.003 * s, 0, -0.004))
	f.scale = Vector3.ONE * 2.0
	return f


# ------------------------------------------------------------ legit reach
## One diner openly reaches for the biscuit. Everyone glares. They withdraw.
func _legit_reach() -> void:
	var b := manager.real_biscuit()
	if b == null or b.held_by != null:
		return
	var d := _pick_diner(func(x: LBDiner):
		var r := _rival_of(x)
		return (r == null or r.is_out()) and x.state != "asleep" and x.behaviour != LBDiner.Behaviour.CHEAT)
	if d == null:
		return
	d.point_at = LBConst.p2w(b.plane_pos, LBConst.TABLE_Y + 0.06)
	d.look_at_world(d.point_at, 6.0, 2.0)
	var tw := create_tween()
	tw.tween_property(d, "reaching", 1.0, 2.6).set_trans(Tween.TRANS_SINE)
	await _wait(0.9)
	for o in manager.diners:
		if o != d:
			o.glare = 1.0
			o.look_at_world(d.head_world(), 5.0, 2.5)
	await tw.finished
	await _wait(1.0)
	var tw2 := create_tween()
	tw2.tween_property(d, "reaching", 0.0, 2.2).set_trans(Tween.TRANS_SINE)
	await tw2.finished
	for o in manager.diners:
		o.glare = 0.0
	d.clear_override()


# ------------------------------------------------------------------ teeth
## False teeth fall out and chatter across the table: a new obstacle.
func _teeth() -> void:
	var d := _pick_diner(func(x: LBDiner): return not x.teeth_out and x.behaviour != LBDiner.Behaviour.CHEAT)
	if d == null:
		return
	d.teeth_out = true
	d.mouth_open = 1.0
	var teeth := LBTableObject.new()
	var start := d.seat + Vector2(-d.side * 0.5, 0.0)
	teeth.configure(LBTableObject.Kind.TEETH, start, randf() * TAU)
	manager.world.add_object(teeth)
	manager._teeth.append(teeth)
	teeth.vel = Vector2(-d.side * 1.3, _rng.randf_range(-0.3, 0.3))
	teeth.jump(0.6)
	manager.noise_sys.emit_noise(start, 0.45, null, "clack")
	d.look_at_world(LBConst.p2w(start + Vector2(-d.side * 0.5, 0)), 3.0, 3.0)
	var tw := create_tween()
	tw.tween_property(d, "mouth_open", 0.25, 0.8)
	var t := 0.0
	while t < 2.5 and is_instance_valid(teeth):
		t += get_process_delta_time()
		var j := teeth.visual.get_node_or_null("jaw1") as Node3D
		if j:
			j.rotation.x = -absf(sin(t * 25.0)) * 0.5 * (1.0 - t / 2.5)
		if fmod(t, 0.3) < get_process_delta_time():
			manager.audio.play_at("clack", teeth.global_position, -12.0, _rng.randf_range(0.9, 1.2))
		await get_tree().process_frame


# --------------------------------------------------------------- cat tail
## A cat's tail rises from under the table and flicks something over.
func _cat_tail() -> void:
	var side := -1.0 if _rng.randf() < 0.5 else 1.0
	var z := _rng.randf_range(-1.5, 3.8)
	var base := Vector3(side * (LBConst.TABLE_HALF_W + 0.02), LBConst.TABLE_Y - 0.25, z)
	var im := ImmediateMesh.new()
	var mi := MeshInstance3D.new()
	mi.mesh = im
	manager.add_child(mi)
	var fur := LBMat.shader("catfur", "fur.gdshader", {"fur": Color(0.25, 0.14, 0.06), "tip": Color(0.85, 0.5, 0.2)})
	var target := manager.nearest_of_kind(LBTableObject.Kind.CUP, Vector2(side * 0.8, z))
	var t := 0.0
	var flicked := false
	while t < 5.0:
		t += get_process_delta_time()
		var rise := clampf(t / 0.8, 0.0, 1.0) * clampf((5.0 - t) / 0.8, 0.0, 1.0)
		var pts := PackedVector3Array()
		var radii := PackedFloat32Array()
		for i in 14:
			var u := float(i) / 13.0
			var sway := sin(t * 2.2 - u * 3.0) * 0.12 * u
			var p := base + Vector3(-side * (0.08 + u * 0.22) + sway * 0.5, (u * 0.55) * rise, sway)
			p.y += sin(u * PI) * 0.1 * rise
			pts.append(p)
			radii.append(lerpf(0.03, 0.012, u))
		im.clear_surfaces()
		LBMesh.tube(im, pts, radii, fur, 8)
		if not flicked and t > 2.2 and target and target.on_table:
			flicked = true
			target.vel = Vector2(-side * 0.8, _rng.randf_range(-0.2, 0.2))
			target.bump(Vector2(-side, 0), 0.6)
			manager.noise_sys.emit_noise(target.plane_pos, 0.5, null, "clink")
		await get_tree().process_frame
	mi.queue_free()


# ----------------------------------------------------------------- waiter
## A waiter glides across the back of the room. Every thief freezes.
func _waiter() -> void:
	var w := _make_waiter()
	var from := Vector3(-3.6, 0, -7.4)
	var to := Vector3(3.6, 0, -7.4)
	w.global_position = from
	w.rotation.y = -PI * 0.5
	_freeze_rivals(true)
	var dur := 7.5
	var t := 0.0
	var step_t := 0.0
	while t < dur:
		var dt := get_process_delta_time()
		t += dt
		step_t += dt
		w.global_position = from.lerp(to, t / dur) + Vector3(0, absf(sin(t * 5.0)) * 0.02, 0)
		if step_t > 0.62:
			step_t = 0.0
			manager.audio.play_at("step", w.global_position, -14.0)
		await get_tree().process_frame
	_freeze_rivals(false)
	w.queue_free()


func _make_waiter() -> Node3D:
	var w := Node3D.new()
	manager.add_child(w)
	var black := LBMat.cloth(Color(0.03, 0.03, 0.035), 0.6)
	var white := LBMat.cloth(Color(0.92, 0.9, 0.86))
	for s in [-1.0, 1.0]:
		LBMesh.add(w, LBMesh.capsule_mesh(0.06, 0.95, 8), black, Vector3(0.08 * s, 0.48, 0))
	LBMesh.add(w, LBMesh.capsule_mesh(0.17, 0.8, 12), black, Vector3(0, 1.3, 0), Vector3.ZERO, Vector3(1, 1, 0.7))
	LBMesh.add(w, LBMesh.box_mesh(Vector3(0.12, 0.3, 0.02)), white, Vector3(0, 1.45, -0.12))
	LBMesh.add(w, LBMesh.prism_mesh(Vector3(0.3, 0.5, 0.05)), black, Vector3(0, 0.95, 0.1), Vector3(0, 0, 180))
	LBMesh.add(w, LBMesh.sphere_mesh(0.11, 16), LBMat.skin(Color(0.85, 0.72, 0.62), 9.0), Vector3(0, 1.88, 0))
	LBMesh.add(w, LBMesh.sphere_mesh(0.112, 16), LBMat.std("slick", Color(0.05, 0.04, 0.035), 0.0, 0.15), Vector3(0, 1.92, 0.01), Vector3.ZERO, Vector3(1, 0.7, 1))
	# arm raised with a silver tray and a cloche
	LBMesh.add(w, LBMesh.capsule_mesh(0.045, 0.6, 8), black, Vector3(0.22, 1.7, 0), Vector3(0, 0, -10))
	LBMesh.add(w, LBMesh.cyl_mesh(0.22, 0.22, 0.015, 24), LBMat.silver(), Vector3(0.25, 2.0, 0))
	LBMesh.add(w, LBMesh.hemi_mesh(0.15, 20), LBMat.silver(), Vector3(0.25, 2.01, 0))
	return w
