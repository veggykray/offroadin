extends RigidBody2D
## One mushroom. A real physics object while it flies, bounces and rolls.
##
## HYBRID SIMULATION (why mushrooms don't explode inside the trolley):
##   FLYING  -> normal RigidBody2D. Bounces off floor, shelves, Bill, the trolley,
##              other mushrooms.
##   CARGO   -> once it lands in the basket, TrolleyCargoController freezes it
##              (kinematic) and drives its position itself with a small, stable
##              spring simulation. Other flying mushrooms still collide with it,
##              so you can bounce mushrooms off your own pile.
##   FLYING  -> when the load spills (or gets bashed / dumped) it is unfrozen
##              and thrown back into the world with a sensible velocity.
##
## Anything can be scanned at the checkout if it has get_scan_id(); this does.

signal impacted(mushroom, other: Node, speed: float)

enum State { FLYING, CARGO, CONSUMED }

const DEFAULT_DATA := preload("types/normal.tres")

var data: Resource
var state := State.FLYING
var age := 0.0
## Seconds this mushroom has been inside the basket without being caught yet
## (used for bouncy shrooms, which must calm down first).
var inside_time := 0.0
## While > 0 the trolley cannot catch this (so spilled ones actually leave).
var no_catch_time := 0.0
var scanned := false
var ever_cargo := false
## True after it fell OUT of the trolley. Used for "spill" stats.
var spilled := false
## World Y of the floor, set by the activity. Used for shadows + clean-up.
var floor_y := 1.0e9
## How long a mushroom may lie still on the floor before it fades away.
var floor_lifetime := 9.0
var shroom_gravity := 1500.0
## Set by the cargo controller each frame while this is cargo (visual tilt).
var cargo_wobble := 0.0

var _rest_time := 0.0
var _prev_vel := Vector2.ZERO
var _squash := 0.0
var _squash_v := 0.0
var _t := 0.0
var _dying := false
var _shape_node: CollisionShape2D
var _seed := 0.0


func configure(d: Resource, layer: int, mask: int, gravity_px: float) -> void:
	data = d
	collision_layer = layer
	collision_mask = mask
	shroom_gravity = gravity_px
	if is_inside_tree():
		_apply_data()


func _ready() -> void:
	if data == null:
		data = DEFAULT_DATA
	_seed = randf() * 100.0
	contact_monitor = true
	max_contacts_reported = 4
	continuous_cd = RigidBody2D.CCD_MODE_CAST_SHAPE
	can_sleep = false
	freeze_mode = RigidBody2D.FREEZE_MODE_KINEMATIC
	linear_damp_mode = RigidBody2D.DAMP_MODE_REPLACE
	linear_damp = 0.0
	angular_damp_mode = RigidBody2D.DAMP_MODE_REPLACE
	angular_damp = 1.5
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)
	_apply_data()
	add_to_group(&"shroom_trolley_scannable")


func _apply_data() -> void:
	if _shape_node == null:
		_shape_node = get_node_or_null("Shape") as CollisionShape2D
	if _shape_node == null:
		_shape_node = CollisionShape2D.new()
		_shape_node.name = "Shape"
		add_child(_shape_node)
	var circle := CircleShape2D.new()
	circle.radius = data.radius
	_shape_node.shape = circle
	var mat := PhysicsMaterial.new()
	mat.bounce = data.bounce
	mat.friction = data.friction
	physics_material_override = mat
	mass = data.mass
	# Gravity is set relative to the project's default so the module behaves the
	# same in any project, whatever its gravity setting is.
	var project_g: float = ProjectSettings.get_setting("physics/2d/default_gravity", 980.0)
	gravity_scale = (shroom_gravity * data.gravity_multiplier) / maxf(project_g, 1.0)
	queue_redraw()


# --- Scanner interface ------------------------------------------------------

func get_scan_id() -> StringName:
	return data.scan_id if data else &"unknown"


func is_scannable() -> bool:
	# Still in the trolley = not on the conveyor yet (a tall pile can poke into
	# the scanner beam while docking).
	return not scanned and state == State.FLYING


func mark_scanned() -> void:
	scanned = true


# --- Mode switching (called by TrolleyCargoController) -----------------------

func enter_cargo() -> void:
	state = State.CARGO
	ever_cargo = true
	spilled = false
	inside_time = 0.0
	linear_velocity = Vector2.ZERO
	angular_velocity = 0.0
	freeze = true


func exit_cargo(velocity: Vector2, spin: float = 0.0) -> void:
	state = State.FLYING
	freeze = false
	linear_velocity = velocity
	angular_velocity = spin
	no_catch_time = 0.4
	_rest_time = 0.0
	spilled = true


func consume() -> void:
	## Remove from play (scanned into the bag, etc.) with a little shrink.
	if state == State.CONSUMED:
		return
	state = State.CONSUMED
	_dying = true
	set_deferred("freeze", true)
	collision_layer = 0
	collision_mask = 0
	var tw := create_tween()
	tw.tween_property(self, "scale", Vector2(0.05, 0.05), 0.35).set_delay(0.5)
	tw.tween_callback(queue_free)


## Pass through everything for a moment (used when tipping the load out so
## mushrooms don't snag on the rest of the pile).
func ghost(seconds: float) -> void:
	var layer := collision_layer
	var mask := collision_mask
	collision_layer = 0
	collision_mask = 0
	get_tree().create_timer(seconds, false, true).timeout.connect(func():
		if is_instance_valid(self) and state != State.CONSUMED:
			collision_layer = layer
			collision_mask = mask
	)


## Tipped out at the checkout: stop being bouncy so it settles in the hopper.
func make_dead_bounce() -> void:
	var mat := PhysicsMaterial.new()
	mat.bounce = 0.0
	mat.friction = 0.9
	physics_material_override = mat


func kick_squash(amount: float) -> void:
	_squash_v += amount


func is_flying() -> bool:
	return state == State.FLYING


# --- Physics ---------------------------------------------------------------

func _integrate_forces(s: PhysicsDirectBodyState2D) -> void:
	# Arcade safety: clamp silly speeds so nothing tunnels or orbits.
	var v := s.linear_velocity
	var max_v: float = data.max_speed if data else 1500.0
	if v.length() > max_v:
		s.linear_velocity = v.normalized() * max_v
	s.angular_velocity = clampf(s.angular_velocity, -22.0, 22.0)


func _physics_process(delta: float) -> void:
	age += delta
	_t += delta
	no_catch_time = maxf(0.0, no_catch_time - delta)
	if state == State.FLYING:
		_prev_vel = linear_velocity
		var on_floor: bool = global_position.y > floor_y - data.radius - 6.0
		if on_floor and linear_velocity.length() < 40.0 and age > 0.8:
			_rest_time += delta
		else:
			_rest_time = maxf(0.0, _rest_time - delta * 0.5)
		if not _dying and (_rest_time > floor_lifetime or global_position.y > floor_y + 900.0):
			fade_out()
	# squash spring (visual only)
	var a := -260.0 * _squash - 14.0 * _squash_v
	_squash_v += a * delta
	_squash = clampf(_squash + _squash_v * delta, -0.45, 0.45)
	queue_redraw()


func fade_out() -> void:
	if _dying:
		return
	_dying = true
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.6)
	tw.tween_callback(queue_free)


func _on_body_entered(other: Node) -> void:
	var speed := _prev_vel.length()
	if state == State.FLYING:
		_prev_vel = linear_velocity
	if speed > 110.0:
		_squash_v += clampf(speed / 700.0, 0.0, 1.0) * 9.0
		impacted.emit(self, other, speed)


# --- Drawing ---------------------------------------------------------------

func _draw() -> void:
	if data == null:
		return
	var r: float = data.radius
	var sq := _squash
	draw_set_transform(Vector2(0, r * sq * 0.6), 0.0, Vector2(1.0 + sq * 0.5, 1.0 - sq * 0.55))

	if data.sparkle:
		var glow := Color(1, 0.9, 0.3, 0.22 + 0.1 * sin(_t * 9.0))
		draw_circle(Vector2.ZERO, r * 1.9, glow)
	# dark outline so mushrooms read clearly against any background
	var ink := Color(0.12, 0.07, 0.06, 0.9)
	draw_circle(Vector2(0, r * 0.82), r * 0.45 + 2.5, ink)
	draw_rect(Rect2(-r * 0.45 - 2.5, -r * 0.15, r * 0.9 + 5.0, r * 1.0), ink)
	var outline := PackedVector2Array()
	for i in 17:
		var ang := PI + PI * float(i) / 16.0
		outline.append(Vector2(cos(ang) * (r * 1.2 + 2.5), r * 0.05 + sin(ang) * (r * 1.0 + 2.5)))
	outline.append(Vector2(r * 1.05, r * 0.2))
	outline.append(Vector2(-r * 1.05, r * 0.2))
	draw_colored_polygon(outline, ink)

	# stem
	var stem_w := r * 0.9
	var stem_col: Color = data.stem_color
	draw_rect(Rect2(-stem_w * 0.5, -r * 0.15, stem_w, r * 1.0), stem_col)
	draw_circle(Vector2(0, r * 0.82), stem_w * 0.5, stem_col)
	# face on the stem
	var eye_y := r * 0.32
	var eye_col := Color(0.15, 0.1, 0.08)
	if data.stinky:
		draw_line(Vector2(-r * 0.3, eye_y - 2), Vector2(-r * 0.1, eye_y + 1), eye_col, 1.6)
		draw_line(Vector2(r * 0.3, eye_y - 2), Vector2(r * 0.1, eye_y + 1), eye_col, 1.6)
		draw_arc(Vector2(0, eye_y + r * 0.42), r * 0.16, PI * 1.1, PI * 1.9, 6, eye_col, 1.4)
	else:
		draw_circle(Vector2(-r * 0.2, eye_y), maxf(1.5, r * 0.09), eye_col)
		draw_circle(Vector2(r * 0.2, eye_y), maxf(1.5, r * 0.09), eye_col)
		if state == State.FLYING and age > 0.05:
			draw_circle(Vector2(0, eye_y + r * 0.32), r * 0.1, eye_col)  # "ooh!"
		else:
			draw_arc(Vector2(0, eye_y + r * 0.15), r * 0.18, PI * 0.15, PI * 0.85, 6, eye_col, 1.4)

	# cap
	var pts := PackedVector2Array()
	var rx := r * 1.2
	var ry := r * 1.0
	var cy := r * 0.05
	for i in 17:
		var ang := PI + PI * float(i) / 16.0
		pts.append(Vector2(cos(ang) * rx, cy + sin(ang) * ry))
	pts.append(Vector2(rx * 0.85, cy + r * 0.12))
	pts.append(Vector2(-rx * 0.85, cy + r * 0.12))
	draw_colored_polygon(pts, data.cap_color)
	# underside shade
	draw_line(Vector2(-rx * 0.88, cy + r * 0.08), Vector2(rx * 0.88, cy + r * 0.08), data.cap_shade, maxf(2.0, r * 0.18))
	# spots
	var spot: Color = data.spot_color
	draw_circle(Vector2(-r * 0.5, cy - r * 0.42), r * 0.2, spot)
	draw_circle(Vector2(r * 0.25, cy - r * 0.7), r * 0.16, spot)
	draw_circle(Vector2(r * 0.68, cy - r * 0.25), r * 0.13, spot)
	if data.glossy:
		draw_arc(Vector2(-r * 0.15, cy - r * 0.15), r * 0.75, PI * 1.15, PI * 1.45, 6, Color(1, 1, 1, 0.75), maxf(2.0, r * 0.14))

	if data.stinky:
		# drip + stink lines + a fly
		draw_circle(Vector2(rx * 0.6, cy + r * 0.3 + fmod(_t * 10.0 + _seed, 6.0)), 2.2, Color(0.45, 0.55, 0.15, 0.9))
		for k in 3:
			var x0 := (k - 1) * r * 0.55
			var line := PackedVector2Array()
			for j in 6:
				var yy := -r * 1.25 - j * 4.0
				line.append(Vector2(x0 + sin(_t * 6.0 + j * 1.3 + k + _seed) * 3.0, yy))
			draw_polyline(line, Color(0.55, 0.75, 0.25, 0.65), 1.5)
		var fly_p := Vector2(cos(_t * 7.0 + _seed) * r * 1.4, -r * 0.9 + sin(_t * 11.0 + _seed) * r * 0.5)
		draw_circle(fly_p, 2.0, Color(0.05, 0.05, 0.05))

	if data.sparkle:
		for k in 3:
			var ang2 := _t * 2.5 + k * TAU / 3.0 + _seed
			var p := Vector2(cos(ang2), sin(ang2)) * r * 1.5
			var s := 3.0 + 2.0 * sin(_t * 12.0 + k)
			draw_line(p - Vector2(s, 0), p + Vector2(s, 0), Color(1, 1, 0.8), 1.5)
			draw_line(p - Vector2(0, s), p + Vector2(0, s), Color(1, 1, 0.8), 1.5)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
