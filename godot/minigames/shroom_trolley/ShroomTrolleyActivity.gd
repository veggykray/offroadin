extends Node2D
## SHROOM MART TROLLEY CHAOS - the mini-game in one node.
##
## Instance ShroomTrolleyActivity.tscn into any 2D scene, move its markers to
## fit the room, then call start_activity(bill). See README.md.
##
## PUBLIC API
##   start_activity(player: Node2D)   Bill grabs the trolley, round begins.
##   stop_activity()                  End immediately, quietly (no result).
##   cancel_activity()                Player quit. Emits activity_cancelled.
##   reset_round()                    Put everything back to the start state.
##   is_running() -> bool
##   get_result() -> Dictionary       Last result (empty until completed).
##
## SIGNALS
##   activity_started
##   activity_completed(result: Dictionary)   result.reward_id etc.
##   activity_cancelled
##   activity_stopped
##   phase_changed(index: int, phase_name: String)
##   order_progress_changed(have: int, need: int, ready: bool)
##   camera_impulse_requested(strength: float, direction: Vector2)

signal activity_started
signal activity_completed(result: Dictionary)
signal activity_cancelled
signal activity_stopped
signal phase_changed(index: int, phase_name: String)
signal order_progress_changed(have: int, need: int, ready: bool)
signal camera_impulse_requested(strength: float, direction: Vector2)

const MushroomScene := preload("Mushroom.tscn")
const Scanner := preload("Scanner.gd")

enum State { IDLE, STARTING, PLAYING, DUMPING, FINISHED }

@export_group("Order")
@export var required_good := 10
@export var bonus_golden := 1
@export var reward_id: StringName = &"perfect_little_shroom"

@export_group("Mushrooms")
@export var mushroom_types: Array[Resource] = [
	preload("types/normal.tres"), preload("types/bouncy.tres"),
	preload("types/rotten.tres"), preload("types/golden.tres"),
]
@export var giant_type: Resource = preload("types/giant.tres")
## Gravity for mushrooms (px/s²). Independent of your project's gravity.
@export var shroom_gravity := 1500.0
## Max mushrooms flying at once (oldest floor ones fade first).
@export var max_loose_mushrooms := 40

@export_group("Play area")
## How tall the play space is above the floor. Launch arcs stay below this.
@export var play_height := 640.0
## Adds an invisible floor along the play area so mushrooms have something to
## bounce on even if your scene's floor is on a different collision layer.
@export var create_floor_collision := true
## Adds invisible walls just outside the outermost spawn points / checkout so
## mushrooms can't roll away forever.
@export var create_side_walls := true

@export_group("Collision")
## The physics layer ALL mini-game bodies live on (default: layer 10). Pick a
## layer your game doesn't use so mushrooms don't collide with unrelated stuff.
@export_flags_2d_physics var shroom_layer := 1 << 9
## Extra layers mushrooms should bounce off (e.g. your real shelves' layer).
@export_flags_2d_physics var extra_collision_mask := 0

@export_group("Integration")
## Optional: a node with request_camera_impulse(strength, direction) (or
## add_trauma(amount)). The camera_impulse_requested signal fires either way.
@export var camera_handler: NodePath
@export var show_hud := true
## Let the cancel action (Esc) quit the activity.
@export var allow_cancel := true
## Seconds the results stay up before activity_completed is emitted and Bill
## is released.
@export var results_delay := 2.5

@export_group("Debug")
## Enables debug hotkeys (F1 overlay, 1-9/0 cheats). Turn OFF for release.
@export var debug_keys_enabled := true
@export var debug_overlay_visible := false

# --- Nodes --------------------------------------------------------------------
@onready var trolley: Node2D = $Trolley
@onready var cargo: Node = $CargoController
@onready var adapter: Node = $PlayerAdapter
@onready var audio: Node = $Audio
@onready var spawner: Node = $Spawner
@onready var events: Node = $Events
@onready var order: Node = $Order
@onready var fx: Node2D = $FX
@onready var mushrooms_root: Node2D = $Mushrooms
@onready var checkout: Node2D = $Checkout
@onready var hud: Control = $HUDLayer/HUD
@onready var _left_bound: Node2D = $PlayArea/LeftBound
@onready var _right_bound: Node2D = $PlayArea/RightBound
@onready var _trolley_start: Node2D = $PlayArea/TrolleyStart
@onready var _spawn_root: Node2D = $SpawnPoints

# --- Runtime --------------------------------------------------------------------
var state := State.IDLE
var floor_y := 0.0
var ceiling_y := 0.0
var mushrooms: Array = []
var round_time := 0.0
var last_result := {}
var debug_force_checkout := false
var _types := {}
var _telegraphs: Array[Dictionary] = []
var _state_time := 0.0
var _dumped: Array = []
var _dump_queue: Array[Dictionary] = []
var _dump_timer := 0.0
var _overlay: Node2D
var _giant: Node = null
var _giant_hit_cd := 0.0
var _slowmo := false


func _ready() -> void:
	for d in mushroom_types:
		if d:
			_types[d.type_id] = d
	if giant_type:
		_types[giant_type.type_id] = giant_type
	order.required_good = required_good
	order.bonus_golden = bonus_golden
	_read_play_area()
	cargo.setup(trolley)
	spawner.setup(self)
	events.setup(self)
	trolley.set_collision(shroom_layer, _mask())
	checkout.configure_collision(shroom_layer, _mask())
	if create_floor_collision or create_side_walls:
		_build_bounds_collision()

	cargo.caught.connect(_on_caught)
	cargo.spilled.connect(_on_spilled)
	trolley.crashed.connect(_on_crashed)
	trolley.bashed.connect(_on_bashed)
	trolley.skid_started.connect(_on_skid)
	checkout.item_scanned.connect(_on_scanned)
	spawner.phase_changed.connect(_on_phase_changed)
	order.order_ready_changed.connect(_on_order_ready_changed)

	_overlay = Node2D.new()
	_overlay.name = "WorldOverlay"
	_overlay.z_index = 40
	add_child(_overlay)
	_overlay.draw.connect(_draw_overlay)

	hud.visible = show_hud
	hud.activity = self
	reset_round()


func _mask() -> int:
	return shroom_layer | extra_collision_mask


func _read_play_area() -> void:
	floor_y = _trolley_start.global_position.y
	ceiling_y = floor_y - play_height
	var lo: float = to_local(_left_bound.global_position).x + trolley.EXTENT_LEFT
	var hi: float = to_local(_right_bound.global_position).x - trolley.EXTENT_RIGHT
	if hi < lo:
		push_warning("ShroomTrolley: RightBound is left of LeftBound (or too close). Check PlayArea markers.")
		hi = lo
	trolley.set_bounds(lo, hi)


func _build_bounds_collision() -> void:
	var sb := StaticBody2D.new()
	sb.name = "BoundsCollision"
	sb.collision_layer = shroom_layer
	sb.collision_mask = _mask()
	var mat := PhysicsMaterial.new()
	mat.friction = 0.8
	mat.bounce = 0.0
	sb.physics_material_override = mat
	var xs: Array[float] = [_left_bound.global_position.x, _right_bound.global_position.x, checkout.global_position.x + 260.0]
	for mk in get_spawn_markers():
		xs.append(mk.global_position.x)
	var left: float = xs.min() - 60.0
	var right: float = xs.max() + 60.0
	if create_floor_collision:
		_add_box(sb, Rect2(left - 200.0, floor_y, right - left + 400.0, 60.0))
	if create_side_walls:
		_add_box(sb, Rect2(left - 40.0, ceiling_y - 600.0, 40.0, floor_y - ceiling_y + 620.0))
		_add_box(sb, Rect2(right, ceiling_y - 600.0, 40.0, floor_y - ceiling_y + 620.0))
	add_child(sb)


func _add_box(sb: StaticBody2D, global_rect: Rect2) -> void:
	var cs := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = global_rect.size
	cs.shape = r
	cs.position = to_local(global_rect.get_center())
	sb.add_child(cs)


# =============================================================================
# PUBLIC API
# =============================================================================

func start_activity(player: Node2D) -> void:
	if adapter.is_attached():
		adapter.detach(trolley)
	state = State.IDLE
	reset_round()
	if player:
		adapter.attach(player, trolley)
	state = State.STARTING
	_state_time = 0.0
	round_time = 0.0
	hud.big_message("GRAB!", Color(1, 0.9, 0.4))
	trolley.add_thump(1.5)
	audio.play(&"bash", -6.0, 0.7)
	request_camera_impulse(4.0, Vector2.DOWN)
	activity_started.emit()


func stop_activity() -> void:
	if state == State.IDLE:
		return
	_end_and_release()
	activity_stopped.emit()


func cancel_activity() -> void:
	if state == State.IDLE:
		return
	_end_and_release()
	activity_cancelled.emit()


func is_running() -> bool:
	return state != State.IDLE and state != State.FINISHED


func get_result() -> Dictionary:
	return last_result


func reset_round() -> void:
	spawner.stop()
	events.reset()
	for m in mushrooms.duplicate():
		if is_instance_valid(m):
			m.queue_free()
	mushrooms.clear()
	cargo.empty_all(true)
	cargo.catching_enabled = true
	cargo.spilling_enabled = true
	order.reset()
	trolley.position = Vector2(to_local(_trolley_start.global_position).x, to_local(_trolley_start.global_position).y)
	trolley.velocity = 0.0
	trolley.tip = 0.0
	trolley.controls_locked = false
	trolley.set_front_wall_enabled(true)
	checkout.set_mode(checkout.Mode.CLOSED)
	checkout.scanner.reset_memory()
	_telegraphs.clear()
	_dump_queue.clear()
	_dumped.clear()
	debug_force_checkout = false
	_giant = null
	round_time = 0.0
	last_result = {}
	if adapter.is_attached():
		state = State.STARTING  # restart straight away with the same player
	else:
		state = State.IDLE
	_state_time = 0.0
	hud.reset()


func _end_and_release() -> void:
	spawner.stop()
	audio.stop_all()
	adapter.detach(trolley)
	state = State.IDLE
	trolley.controls_locked = false


# =============================================================================
# MAIN LOOP
# =============================================================================

func _physics_process(delta: float) -> void:
	_state_time += delta
	var axis := 0.0
	var bash := false
	var dump := false
	if state == State.PLAYING:
		axis = adapter.get_move_axis()
		bash = adapter.is_bash_just_pressed()
		dump = adapter.is_dump_just_pressed()
		round_time += delta
		if allow_cancel and adapter.is_cancel_just_pressed():
			cancel_activity()
			return

	if state == State.STARTING and _state_time > 0.9:
		state = State.PLAYING
		_state_time = 0.0
		spawner.start()

	trolley.step(delta, axis, bash)
	cargo.physics_update(delta, mushrooms)
	order.update_held(cargo.get_counts())
	order_progress_changed.emit(int(order.delivered.good) + order.held_good + dump_in_flight_good(), required_good, order.order_ready or debug_force_checkout)

	if state == State.PLAYING:
		spawner.update(delta, order.held_good + int(order.delivered.good))
		events.update(delta, spawner.phase)
		_update_checkout_state(dump)
	elif state == State.DUMPING:
		_update_dump(delta)

	_update_giant(delta)
	_update_telegraphs(delta)
	_cull_mushrooms()

	if adapter.is_attached():
		adapter.update_player(trolley, _pose_info())
	var spd: float = absf(trolley.velocity) / trolley.max_speed
	if state == State.IDLE or state == State.FINISHED:
		audio.set_rolling(0.0, 0.0)
	else:
		audio.set_rolling(spd, trolley.rattle)
	if trolley.skidding and Engine.get_physics_frames() % 4 == 0:
		fx.dust(trolley.global_position + Vector2(signf(trolley.velocity) * trolley.WHEEL_X, -3), signf(trolley.velocity))
	queue_redraw()
	_overlay.queue_redraw()


func _pose_info() -> Dictionary:
	return {
		"velocity": trolley.velocity,
		"speed01": clampf(absf(trolley.velocity) / trolley.max_speed, 0.0, 1.0),
		"facing": trolley.facing,
		"pushing": absf(trolley.input_axis) > 0.2,
		"braking": trolley.braking,
		"skidding": trolley.skidding,
		"bashing": trolley.bash_timer > 0.0,
		"dumping": state == State.DUMPING,
		"lean": trolley.lean,
		"load": cargo.count(),
	}


func _update_checkout_state(dump_pressed: bool) -> void:
	var can_checkout: bool = order.order_ready or debug_force_checkout
	var docked: bool = checkout.is_docked(trolley.global_position.x, trolley.velocity)
	hud.set_prompt(can_checkout, docked)
	if can_checkout and checkout.mode == checkout.Mode.CLOSED:
		checkout.set_mode(checkout.Mode.OPEN)
	elif not can_checkout and checkout.mode == checkout.Mode.OPEN:
		checkout.set_mode(checkout.Mode.CLOSED)
	if dump_pressed and can_checkout and docked and cargo.count() > 0:
		_begin_dump()


# =============================================================================
# MUSHROOMS
# =============================================================================

func get_type(type_id: StringName) -> Resource:
	return _types.get(type_id)


func get_spawn_markers() -> Array:
	var out := []
	for c in _spawn_root.get_children():
		if c is Node2D:
			out.append(c)
	return out


func global_min_x() -> float:
	return to_global(Vector2(trolley.min_x, 0)).x


func global_max_x() -> float:
	return to_global(Vector2(trolley.max_x, 0)).x


func spawn_mushroom(data: Resource, global_pos: Vector2, velocity: Vector2) -> Node:
	var m: RigidBody2D = MushroomScene.instantiate()
	m.configure(data, shroom_layer, _mask(), shroom_gravity)
	m.floor_y = floor_y
	m.position = mushrooms_root.to_local(global_pos)
	m.linear_velocity = velocity
	mushrooms_root.add_child(m)
	m.impacted.connect(_on_mushroom_impacted)
	mushrooms.append(m)
	m.tree_exiting.connect(_on_mushroom_gone.bind(m))
	audio.play(&"launch", -8.0, randf_range(0.9, 1.15))
	return m


func _on_mushroom_gone(m: Node) -> void:
	mushrooms.erase(m)


func _cull_mushrooms() -> void:
	var loose := 0
	for m in mushrooms:
		if is_instance_valid(m) and m.state == m.State.FLYING:
			loose += 1
	if loose <= max_loose_mushrooms:
		return
	for m in mushrooms:
		if is_instance_valid(m) and m.state == m.State.FLYING and m.age > 2.0:
			m.fade_out()
			return


## Puff at a spawn point just before something is launched from it.
func telegraph(global_pos: Vector2, data: Resource, strength := 1.0) -> void:
	_telegraphs.append({"pos": global_pos, "t": 0.0, "color": data.cap_color if data else Color.WHITE, "gold": data != null and data.is_bonus(), "s": strength})
	if data and data.is_bonus():
		audio.play(&"golden_catch", -12.0, 1.5)


func _update_telegraphs(delta: float) -> void:
	var i := 0
	while i < _telegraphs.size():
		_telegraphs[i].t += delta
		if _telegraphs[i].t > 0.9:
			_telegraphs.remove_at(i)
		else:
			i += 1


func spawn_giant() -> void:
	if giant_type == null or (_giant != null and is_instance_valid(_giant)):
		return
	var from_left := trolley.global_position.x > (global_min_x() + global_max_x()) * 0.5
	var x := global_min_x() - 200.0 if from_left else global_max_x() + 120.0
	x = clampf(x, _left_bound.global_position.x - 40.0, _right_bound.global_position.x + 40.0)
	var pos := Vector2(x, floor_y - 300.0)
	hud.big_message("GIANT SHROOM!", Color(0.9, 0.6, 1.0))
	_giant = spawn_mushroom(giant_type, pos, Vector2((1.0 if from_left else -1.0) * 230.0, -200.0))
	_giant.floor_lifetime = 2.0
	_giant.angular_velocity = 2.0 if from_left else -2.0
	_giant.set_meta("dir", 1.0 if from_left else -1.0)


func _update_giant(delta: float) -> void:
	_giant_hit_cd = maxf(0.0, _giant_hit_cd - delta)
	if _giant == null or not is_instance_valid(_giant):
		_giant = null
		return
	var g: RigidBody2D = _giant
	var dir: float = g.get_meta("dir", 1.0)
	# keep it bounding along in ONE direction: re-kick when it lands
	if g.global_position.y > floor_y - g.data.radius - 4.0 and g.linear_velocity.y > -50.0 and absf(g.linear_velocity.y) < 120.0:
		g.linear_velocity = Vector2(dir * 230.0, -760.0)
	# it crosses the shop once, then leaps off-stage in a big cartoon arc
	var far_edge: float = global_max_x() - 20.0 if dir > 0.0 else global_min_x() + 20.0
	if (dir > 0.0 and g.global_position.x > far_edge) or (dir < 0.0 and g.global_position.x < far_edge) or g.age > 9.0:
		g.collision_mask = 0
		g.collision_layer = 0
		g.linear_velocity = Vector2(dir * 420.0, -1100.0)
		g.angular_velocity = dir * 6.0
		g.fade_out()
		_giant = null
		return
	if _giant_hit_cd <= 0.0:
		for b in g.get_colliding_bodies():
			if b == trolley.body or (b in cargo.get_mushrooms()):
				_giant_hit_cd = 0.8
				var hit_dir := signf(trolley.global_position.x - g.global_position.x)
				trolley.velocity += hit_dir * 260.0
				cargo.sway_v += hit_dir * 160.0
				trolley.add_shake(2.0)
				audio.play(&"crash", -2.0, 0.6)
				request_camera_impulse(10.0, Vector2(hit_dir, 0))
				fx.crash(g.global_position)
				break


func checkout_spit() -> void:
	var from: Vector2 = checkout.get_spit_point()
	var data := get_type(&"normal")
	telegraph(from, data, 1.5)
	var tx := clampf(trolley.global_position.x + randf_range(-140.0, 60.0), global_min_x(), global_max_x())
	checkout.popup("OOPS!", Color(1, 0.6, 0.3))
	# override the marker: fire straight out of the checkout
	var t := 1.2
	get_tree().create_timer(0.6).timeout.connect(func():
		if is_running():
			spawn_mushroom(data, from, spawner.solve_launch(from, Vector2(tx, floor_y - 110.0), t, shroom_gravity))
	)


# =============================================================================
# REACTIONS (juice lives here)
# =============================================================================

func _on_caught(m: Node, info: Dictionary) -> void:
	var d: Resource = m.data
	if info.get("first_time", true):
		order.register_catch(d)
	var pos: Vector2 = m.global_position
	if d.is_bad():
		audio.play(&"rotten_splat", 0.0, randf_range(0.9, 1.05))
		fx.splat(pos)
		trolley.add_shake(3.0)
		cargo.sway_v += randf_range(-60.0, 60.0)
		request_camera_impulse(5.0, Vector2.DOWN)
		hud.flash(Color(0.4, 0.6, 0.1, 0.25))
	elif d.is_bonus():
		audio.play(&"golden_catch", 2.0)
		audio.play(&"catch", 0.0, 0.8)
		fx.sparkle(pos)
		request_camera_impulse(6.0, Vector2.DOWN)
		hud.big_message("GOLDEN!", Color(1, 0.85, 0.2))
		hud.flash(Color(1, 0.9, 0.4, 0.25))
	else:
		var pitch: float = 1.0 + 0.04 * cargo.count() + randf_range(-0.05, 0.05)
		audio.play(&"catch", 0.0, pitch)
		fx.catch_puff(pos, d.cap_color)
		request_camera_impulse(1.5 * float(info.get("impact", 1.0)), Vector2.DOWN)


func _on_spilled(m: Node) -> void:
	order.register_spill(round_time)
	audio.play(&"spill", -2.0, randf_range(0.9, 1.2))
	if state == State.PLAYING and order.stats.mushrooms_spilled % 3 == 1:
		hud.wobble_sign()


func _on_crashed(speed: float) -> void:
	order.stats.crashes += 1
	var dir := signf(trolley.velocity) * -1.0
	cargo.sway_v += -dir * speed * 0.35
	audio.play(&"crash", 0.0, randf_range(0.9, 1.1))
	fx.crash(trolley.global_position + Vector2(-dir * trolley.EXTENT_RIGHT, -60))
	request_camera_impulse(clampf(speed / 50.0, 4.0, 14.0), Vector2(-dir, 0))


func _on_skid(_speed: float) -> void:
	audio.play(&"skid", -6.0)


func _on_bashed(dir: int) -> void:
	order.stats.bashes += 1
	audio.play(&"bash", 0.0, randf_range(0.95, 1.08))
	request_camera_impulse(6.0, Vector2(dir, 0))
	fx.bash_wave(trolley.global_position + Vector2(dir * 80.0, -70.0), dir)
	var thrown: Array = cargo.bash_pop(dir)
	for t in thrown:
		fx.splat(t.global_position)
	# Bash zone: in front of the trolley from the floor up, plus just above the
	# basket (to save mushrooms that are bouncing out).
	for m in mushrooms:
		if not is_instance_valid(m) or not m.is_flying():
			continue
		var local: Vector2 = trolley.global_to_trolley(m.global_position)
		var fwd := local.x * dir
		var hit := false
		var v: Vector2 = m.linear_velocity
		if fwd > 40.0 and fwd < 230.0 and local.y > -280.0 and local.y < 8.0:
			# whack it forward and UP - floor shrooms become catchable again
			var low := clampf((local.y + 150.0) / 150.0, 0.0, 1.0)
			v = Vector2(dir * (300.0 + absf(trolley.velocity) * 0.4), -480.0 - low * 300.0)
			hit = true
		elif absf(local.x) < 100.0 and local.y < trolley.RIM_Y + 10.0 and local.y > trolley.RIM_Y - 200.0:
			# juggle: pop it straight back up over the basket
			v = Vector2(trolley.velocity + dir * 40.0, -560.0)
			hit = true
		if hit:
			m.linear_velocity = v
			m.angular_velocity = dir * 12.0
			m.no_catch_time = 0.12
			m.kick_squash(8.0)
			fx.burst(m.global_position, Color(1, 1, 0.8), 6, 200.0, 0.0, 0.2, 3.0)


func _on_mushroom_impacted(m: Node, other: Node, speed: float) -> void:
	if m.state != m.State.FLYING:
		return
	var vol := clampf(-18.0 + speed / 40.0, -18.0, 0.0)
	var pitch := 1.0
	match String(m.data.type_id):
		"bouncy":
			pitch = 1.3
		"golden":
			pitch = 1.6
		"rotten":
			pitch = 0.6
		"giant":
			pitch = 0.4
			request_camera_impulse(clampf(speed / 120.0, 2.0, 8.0), Vector2.DOWN)
	audio.play(&"bounce", vol, pitch * randf_range(0.92, 1.08))
	if m.data.is_bad() and speed > 300.0:
		fx.burst(m.global_position, Color(0.45, 0.55, 0.15), 5, 150.0, 800.0, 0.4, 3.5)
	if other == trolley.body and speed > 250.0:
		trolley.add_thump(0.3)


func _on_phase_changed(index: int, phase: Dictionary) -> void:
	hud.set_hint(phase.get("hint", ""))
	phase_changed.emit(index, phase.get("name", ""))


func _on_order_ready_changed(is_ready: bool) -> void:
	if state != State.PLAYING:
		return
	if is_ready:
		audio.play(&"checkout_open")
		hud.big_message("ORDER READY!", Color(0.5, 1, 0.5))
		spawner.set_phase(spawner.PHASE_CHECKOUT)
	elif spawner.phase == spawner.PHASE_CHECKOUT:
		hud.big_message("NOT ENOUGH SHROOMS!", Color(1, 0.5, 0.4))
		spawner.set_phase(spawner.PHASE_CHAOS)


func request_camera_impulse(strength: float, direction := Vector2.ZERO) -> void:
	camera_impulse_requested.emit(strength, direction)
	if camera_handler.is_empty():
		return
	var cam := get_node_or_null(camera_handler)
	if cam == null:
		return
	if cam.has_method("request_camera_impulse"):
		cam.request_camera_impulse(strength, direction)
	elif cam.has_method("add_trauma"):
		cam.add_trauma(strength / 15.0)


# =============================================================================
# CHECKOUT DUMP
# =============================================================================

## Good mushrooms tipped out but not scanned yet (so the HUD doesn't drop).
func dump_in_flight_good() -> int:
	var n := 0
	for m in _dumped:
		if is_instance_valid(m) and not m.scanned and m.data.is_good():
			n += 1
	for it in _dump_queue:
		if is_instance_valid(it.m) and it.m.data.is_good():
			n += 1
	return n


func _begin_dump() -> void:
	state = State.DUMPING
	_state_time = 0.0
	spawner.set_phase(spawner.PHASE_DUMP)
	spawner.stop()
	trolley.controls_locked = true
	cargo.catching_enabled = false
	cargo.spilling_enabled = false
	checkout.set_mode(checkout.Mode.DUMPING)
	hud.set_prompt(false, false)
	hud.set_hint("")
	_dumped.clear()
	_dump_queue = cargo.take_all_top_first()
	_dump_timer = 0.42
	trolley.set_front_wall_enabled(false)
	var tw := create_tween()
	tw.tween_property(trolley, "tip", 1.0, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	audio.play(&"bash", -4.0, 0.6)
	request_camera_impulse(5.0, Vector2.RIGHT)


func _update_dump(delta: float) -> void:
	_dump_timer -= delta
	if not _dump_queue.is_empty():
		if _dump_timer <= 0.0:
			_dump_timer = 0.075
			var it: Dictionary = _dump_queue.pop_front()
			if is_instance_valid(it.m):
				var m: Node = it.m
				var target: Vector2 = checkout.get_hopper_target() + Vector2(randf_range(-10.0, 10.0), randf_range(-4.0, 4.0))
				var t := randf_range(0.6, 0.7)
				var v: Vector2 = spawner.solve_launch(m.global_position, target, t, shroom_gravity * m.data.gravity_multiplier)
				cargo.release(it, v, randf_range(-10.0, 10.0))
				m.no_catch_time = 99.0
				m.ghost(0.22)
				m.make_dead_bounce()
				_dumped.append(m)
				audio.play(&"bounce", -10.0, randf_range(0.8, 1.2))
				trolley.add_shake(0.5)
		return
	# everything is out: wait for the scanner, then tip back
	if trolley.tip > 0.99 and _state_time > 0.5:
		var tw := create_tween()
		tw.tween_property(trolley, "tip", 0.0, 0.5).set_trans(Tween.TRANS_SINE).set_delay(0.3)
	var pending := 0
	for m in _dumped:
		if is_instance_valid(m) and not m.scanned and m.state == m.State.FLYING and m.age < 30.0 and m.global_position.y < floor_y - 5.0 - m.data.radius * 0.5:
			pending += 1
	if (pending == 0 and _state_time > 1.4) or _state_time > 5.0:
		_finish_dump()


func _finish_dump() -> void:
	trolley.tip = 0.0
	trolley.set_front_wall_enabled(true)
	trolley.controls_locked = false
	cargo.catching_enabled = true
	cargo.spilling_enabled = true
	for m in _dumped:
		if is_instance_valid(m) and not m.scanned:
			m.no_catch_time = 0.0
	_dumped.clear()
	debug_force_checkout = false
	if order.is_complete():
		_complete()
	else:
		state = State.PLAYING
		_state_time = 0.0
		checkout.set_mode(checkout.Mode.CLOSED)
		hud.big_message("NEED %d MORE!" % order.remaining(), Color(1, 0.6, 0.3))
		spawner.running = true
		spawner.set_phase(spawner.PHASE_CHAOS)


func _complete() -> void:
	state = State.FINISHED
	_state_time = 0.0
	spawner.stop()
	checkout.show_message("THANK YOU!", Color(0.5, 1, 0.5))
	audio.play(&"checkout_success")
	audio.play(&"completion", -2.0)
	fx.confetti(checkout.get_hopper_target() + Vector2(0, -40))
	fx.confetti(trolley.global_position + Vector2(0, -150))
	last_result = order.build_result(round_time, reward_id)
	hud.show_results(last_result)
	request_camera_impulse(6.0, Vector2.UP)
	for m in mushrooms:
		if is_instance_valid(m) and m.is_flying():
			m.fade_out()
	get_tree().create_timer(results_delay).timeout.connect(_emit_completed)


func _emit_completed() -> void:
	if state != State.FINISHED:
		return
	audio.set_rolling(0.0, 0.0)
	adapter.detach(trolley)
	state = State.IDLE
	activity_completed.emit(last_result)


func _on_scanned(item: Node, scan_id: StringName, response: Dictionary) -> void:
	var type_id: StringName = item.data.type_id if "data" in item and item.data else scan_id
	order.register_scan(type_id, response)
	audio.play(response.get("sound", &"scanner_beep"))
	var cat: StringName = response.get("category", &"none")
	if cat == &"bonus":
		fx.sparkle(item.global_position)
	elif cat == &"bad":
		fx.splat(item.global_position)
		request_camera_impulse(2.0, Vector2.RIGHT)
	else:
		fx.burst(item.global_position, Color(0.6, 1, 0.6), 6, 140.0, 300.0, 0.3, 3.0)
	if response.get("consume", false) and item.has_method("consume"):
		item.consume()


# =============================================================================
# DRAWING: floor shadows, launch telegraphs, debug
# =============================================================================

func _draw() -> void:
	# floor shadows make landing spots readable from a side view
	for m in mushrooms:
		if not is_instance_valid(m) or not m.is_flying():
			continue
		var p: Vector2 = to_local(m.global_position)
		var h: float = floor_y - m.global_position.y
		if h < 0.0 or h > play_height:
			continue
		var k := clampf(1.0 - h / 600.0, 0.15, 1.0)
		var r: float = m.data.radius * (0.6 + 0.6 * k)
		_draw_ellipse(Vector2(p.x, to_local(Vector2(0, floor_y)).y - 1.0), r, r * 0.28, Color(0, 0, 0, 0.32 * k))
	for tg in _telegraphs:
		var t: float = tg.t
		var p2: Vector2 = to_local(tg.pos)
		var a := 1.0 - t / 0.9
		var col: Color = tg.color
		draw_circle(p2, (14.0 + t * 50.0) * tg.s, Color(col, 0.25 * a))
		draw_arc(p2, (10.0 + t * 70.0) * tg.s, 0, TAU, 24, Color(col.lightened(0.4), 0.8 * a), 3.0)
		if tg.gold:
			for k2 in 6:
				var ang := k2 * TAU / 6.0 + t * 4.0
				draw_line(p2, p2 + Vector2(cos(ang), sin(ang)) * (30.0 + t * 60.0), Color(1, 0.9, 0.3, a), 2.0)


func _draw_ellipse(c: Vector2, rx: float, ry: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 16:
		var a := TAU * i / 16.0
		pts.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	draw_colored_polygon(pts, col)


func _draw_overlay() -> void:
	if not debug_overlay_visible:
		return
	var o := _overlay
	# play area
	var fy := to_local(Vector2(0, floor_y)).y
	o.draw_line(Vector2(to_local(_left_bound.global_position).x, fy), Vector2(to_local(_right_bound.global_position).x, fy), Color.YELLOW, 2.0)
	for b in [_left_bound, _right_bound]:
		var bx := to_local(b.global_position).x
		o.draw_line(Vector2(bx, fy), Vector2(bx, fy - 300), Color.YELLOW, 2.0)
	# trolley centre limits + dock zone
	o.draw_line(Vector2(trolley.min_x, fy + 6), Vector2(trolley.max_x, fy + 6), Color(1, 0.6, 0.2), 3.0)
	var dock := to_local(Vector2(checkout.get_dock_x(), 0)).x
	o.draw_rect(Rect2(dock - checkout.dock_tolerance, fy - 8, checkout.dock_tolerance * 2.0, 8), Color(0.3, 1, 0.3, 0.5))
	# catch zone (approximate outline in trolley space)
	var xf: Transform2D = get_global_transform().affine_inverse() * trolley.global_transform
	var top: float = minf(trolley.RIM_Y + 6.0, cargo.pile_surface_y() - 12.0)
	var poly := PackedVector2Array([
		xf * Vector2(-trolley.INNER_HALF_BOTTOM, trolley.FLOOR_Y), xf * Vector2(trolley.INNER_HALF_BOTTOM, trolley.FLOOR_Y),
		xf * Vector2(trolley.INNER_HALF_TOP, trolley.RIM_Y), xf * Vector2(trolley.INNER_HALF_TOP * 0.8, top),
		xf * Vector2(-trolley.INNER_HALF_TOP * 0.8, top), xf * Vector2(-trolley.INNER_HALF_TOP, trolley.RIM_Y),
		xf * Vector2(-trolley.INNER_HALF_BOTTOM, trolley.FLOOR_Y)])
	o.draw_polyline(poly, Color(0.2, 1, 0.4), 2.0)
	# bash zone
	var d: int = trolley.facing
	var r0: Vector2 = xf * Vector2(d * 40.0, -280.0)
	var r1: Vector2 = xf * Vector2(d * 230.0, 8.0)
	o.draw_rect(Rect2(Vector2(minf(r0.x, r1.x), r0.y), Vector2(absf(r1.x - r0.x), r1.y - r0.y)), Color(1, 0.4, 0.2, 0.6 if trolley.can_bash() else 0.2), false, 2.0)
	# mushroom velocities
	for m in mushrooms:
		if is_instance_valid(m) and m.is_flying():
			var p := to_local(m.global_position)
			o.draw_line(p, p + m.linear_velocity * 0.1, Color(0.4, 0.8, 1), 1.5)
			o.draw_string(ThemeDB.fallback_font, p + Vector2(10, -10), "%d" % int(m.linear_velocity.length()), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.6, 0.9, 1))
	# spawn markers
	for mk in get_spawn_markers():
		var p3 := to_local(mk.global_position)
		o.draw_circle(p3, 6.0, Color(1, 0.3, 1))
		o.draw_string(ThemeDB.fallback_font, p3 + Vector2(8, -6), mk.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1, 0.6, 1))


func debug_text() -> String:
	var phase_name: String = spawner.current().get("name", "?")
	return "\n".join([
		"[F1] DEBUG   state=%s  phase=%d %s  t=%.1f" % [State.keys()[state], spawner.phase, phase_name, round_time],
		"velocity  %7.1f px/s   (max %.0f)" % [trolley.velocity, trolley.effective_max_speed()],
		"accel     %7.1f px/s²  dv=%.1f" % [trolley.accel_now, trolley.last_dv],
		"cargo     %d  weight %.1f  mass x%.2f" % [cargo.count(), cargo.total_weight, trolley.mass_factor()],
		"sway      %6.1f   spill force %5.1f / threshold %s" % [cargo.sway, cargo.spill_force, ("%.1f" % cargo.spill_threshold) if cargo.spill_threshold < 1e6 else "-"],
		"skid=%s brake=%s bash_cd=%.2f" % [trolley.skidding, trolley.braking, trolley.bash_cd],
		"held good %d  delivered %d/%d  ready=%s" % [order.held_good, order.delivered.good, required_good, order.order_ready],
		"loose shrooms %d" % mushrooms.size(),
		"1-4 spawn N/B/R/G  5 fill  6 spill  7 empty  8 satisfy  9 checkout  0 giant",
		"F2 slow-mo  F3 random event  F5 reset round",
	])


# =============================================================================
# DEBUG KEYS
# =============================================================================

func _unhandled_input(event: InputEvent) -> void:
	if not debug_keys_enabled or not (event is InputEventKey) or not event.pressed or event.echo:
		return
	match event.physical_keycode:
		KEY_F1:
			debug_overlay_visible = not debug_overlay_visible
		KEY_F2:
			_slowmo = not _slowmo
			Engine.time_scale = 0.3 if _slowmo else 1.0
		KEY_F3:
			if is_running():
				events.trigger(events.events.keys()[randi() % events.events.size()])
		KEY_F5:
			reset_round()
		KEY_1:
			_debug_launch(&"normal")
		KEY_2:
			_debug_launch(&"bouncy")
		KEY_3:
			_debug_launch(&"rotten")
		KEY_4:
			_debug_launch(&"golden")
		KEY_5:
			debug_fill(6)
		KEY_6:
			cargo.force_spill(3)
		KEY_7:
			cargo.empty_all(true)
		KEY_8:
			debug_fill(maxi(0, order.remaining() - order.held_good))
		KEY_9:
			debug_force_checkout = true
		KEY_0:
			spawn_giant()
		_:
			return
	get_viewport().set_input_as_handled()


func _debug_launch(type_id: StringName) -> void:
	spawner.queue_launch(type_id)


func debug_fill(n: int) -> void:
	var ids := [&"normal", &"normal", &"bouncy", &"normal"]
	for k in n:
		var d := get_type(ids[k % ids.size()])
		var m := spawn_mushroom(d, trolley.basket_to_global(Vector2(randf_range(-30, 30), trolley.RIM_Y - 20.0)), Vector2.ZERO)
		cargo._catch(m, trolley.global_to_trolley(m.global_position), Vector2(0, 200))
