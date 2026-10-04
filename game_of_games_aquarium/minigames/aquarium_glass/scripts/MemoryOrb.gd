extends Node2D
## aquarium_memory: the glowing thing Bill wants.
##
## States: in_shell -> released (hovering above the open shell) -> carried
## (in the Idiot's mouth) -> falling -> rolling (on the sand, drifting gently
## towards the chute) -> in_chute -> delivered.
##
## Delivery is deliberately easy: the floor "slopes" towards the chute, the
## chute sucks when close, and if it sits still for a while the Blimp comes
## over and gives it a nudge (see assist_delivery).

@export var body_radius := 16.0
@export var body_mass := 0.8
## Sinking acceleration in water (px/s^2).
@export var sink_gravity := 95.0
## Gentle roll towards the chute along the floor (px/s^2).
@export var floor_roll_force := 70.0
## A slow current near the floor carries the sinking memory towards the chute (px/s).
@export var chute_current := 120.0
## Seconds resting on the floor before the Blimp comes to help.
@export var blimp_assist_delay := 2.5

var activity: Node
var velocity := Vector2.ZERO
var body_enabled := false
var collision_group := "memory"
var mem_state := "in_shell"
var carrier: Node2D = null
var _shell: Node2D = null
var _t := 0.0
var _rest_time := 0.0
var _chute_t := 0.0
var _chute: Node2D = null
var _assist_started := false
var _stuck_time := 0.0
var _last_dist_to_chute := INF
var _spin := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity


func place_in_shell(shell: Node2D) -> void:
	_shell = shell
	mem_state = "in_shell"
	carrier = null
	body_enabled = false
	visible = true
	scale = Vector2.ONE
	velocity = Vector2.ZERO
	_assist_started = false
	_rest_time = 0.0
	position = shell.memory_anchor()


func release_from_shell() -> void:
	mem_state = "released"
	activity.water_fx.burst(position, Color(1, 0.9, 0.5), 18)


func attach_to(p_carrier: Node2D) -> void:
	carrier = p_carrier
	mem_state = "carried"
	body_enabled = false


func drop(pos: Vector2, vel: Vector2) -> void:
	carrier = null
	position = pos
	velocity = vel
	mem_state = "falling"
	body_enabled = true
	_rest_time = 0.0
	_stuck_time = 0.0
	_assist_started = false


func enter_chute(chute: Node2D) -> void:
	if mem_state == "in_chute" or mem_state == "delivered":
		return
	_chute = chute
	mem_state = "in_chute"
	body_enabled = false
	_chute_t = 0.0


func is_loose() -> bool:
	return mem_state == "falling" or mem_state == "rolling"


func tick(delta: float) -> void:
	_t += delta
	match mem_state:
		"in_shell":
			if _shell:
				position = _shell.memory_anchor()
		"released":
			if _shell:
				position = position.lerp(_shell.memory_anchor() + Vector2(0, -26 + sin(_t * 2.0) * 5.0), clampf(delta * 2.0, 0, 1))
		"carried":
			if carrier and is_instance_valid(carrier):
				position = carrier.get_mouth_position()
		"falling", "rolling":
			_physics(delta)
		"in_chute":
			_chute_t += delta
			if _chute:
				position = position.lerp(_chute.get_intake_point(), clampf(delta * 5.0, 0, 1))
			scale = Vector2.ONE * maxf(0.0, 1.0 - _chute_t * 1.4)
			if _chute_t > 0.8:
				mem_state = "delivered"
				visible = false
		"delivered":
			pass
	queue_redraw()


func _physics(delta: float) -> void:
	var floor_y: float = activity.get_floor_y() - body_radius
	velocity.y += sink_gravity * delta
	velocity *= exp(-1.6 * delta)
	if activity.chute:
		# The current gets stronger closer to the floor.
		var depth_k := clampf((position.y - activity.aquarium_bounds.position.y) / activity.aquarium_bounds.size.y, 0.0, 1.0)
		var want := signf(activity.chute.position.x - position.x) * chute_current * depth_k
		velocity.x = move_toward(velocity.x, want, 60.0 * delta)
		if randf() < delta * 3.0:
			activity.water_fx.spawn_bubbles(position + Vector2(randf_range(-10, 10), 6), 1, 0.4)
	if activity.chute:
		velocity += activity.chute.suction_force(position) * delta
	position += velocity * delta
	var b: Rect2 = activity.aquarium_bounds
	position.x = clampf(position.x, b.position.x + body_radius, b.end.x - body_radius)
	if position.y >= floor_y:
		position.y = floor_y
		if velocity.y > 30.0:
			activity.water_fx.spawn_sand(position + Vector2(0, body_radius), 6)
			activity.audio.play("bubbles", -14.0, 1.6)
		velocity.y = minf(0.0, velocity.y) * 0.2
		mem_state = "rolling"
		var dir := signf(activity.chute.position.x - position.x)
		velocity.x = move_toward(velocity.x, dir * floor_roll_force * 2.0, floor_roll_force * delta)
		_spin += velocity.x * delta / body_radius
		_rest_time += delta
	else:
		mem_state = "falling"


## Called by the activity during MEMORY_FALLING. Brings the Blimp over if the
## memory is sitting still, and as an absolute last resort slips it into the
## chute if something weird happened (never needed in normal play).
func assist_delivery(delta: float, blimp: Node2D, chute: Node2D) -> void:
	if not is_loose():
		return
	var d := position.distance_to(chute.position)
	if d > _last_dist_to_chute - 0.3:
		_stuck_time += delta
	else:
		_stuck_time = maxf(0.0, _stuck_time - delta * 2.0)
	_last_dist_to_chute = d
	if mem_state == "rolling" and _rest_time > blimp_assist_delay and not _assist_started:
		_assist_started = true
		blimp.final_nudge(self, chute)
	if _stuck_time > 7.0 and _assist_started:
		blimp.final_nudge(self, chute)
		_stuck_time = 3.0
	if _stuck_time > 20.0:
		chute.force_receive(self)


func on_body_collision(other, _normal: Vector2, rel_speed: float) -> void:
	if rel_speed > 40.0 and not (other is Dictionary):
		activity.audio.play("bubbles", -16.0, 2.0)


func _draw() -> void:
	if not visible:
		return
	var pulse := 0.5 + 0.5 * sin(_t * 3.1)
	for i in 6:
		draw_circle(Vector2.ZERO, body_radius * (1.4 + i * 0.7), Color(1.0, 0.85, 0.4, 0.07 + 0.03 * pulse))
	draw_circle(Vector2.ZERO, body_radius, Color(1.0, 0.86, 0.45))
	draw_circle(Vector2.ZERO, body_radius * 0.72, Color(1.0, 0.96, 0.75))
	# A swirling "memory" inside.
	for i in 3:
		var a := _t * (1.2 + i * 0.4) + i * 2.1 + _spin
		draw_arc(Vector2.ZERO, body_radius * (0.25 + i * 0.15), a, a + 2.2, 10, Color(1.0, 0.6, 0.3, 0.8), 2.0)
	draw_circle(Vector2(-5, -6), 4, Color(1, 1, 1, 0.9))
	# Sparkles.
	for i in 4:
		var sa := _t * 0.8 + i * TAU / 4.0
		var sp := Vector2(cos(sa), sin(sa)) * body_radius * (2.0 + 0.4 * sin(_t * 2.0 + i))
		var s := 2.0 + 2.0 * absf(sin(_t * 4.0 + i))
		draw_line(sp - Vector2(s, 0), sp + Vector2(s, 0), Color(1, 1, 0.8, 0.8), 1.5)
		draw_line(sp - Vector2(0, s), sp + Vector2(0, s), Color(1, 1, 0.8, 0.8), 1.5)
