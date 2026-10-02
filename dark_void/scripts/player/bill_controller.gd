class_name BillController
extends CharacterBody3D
## Placeholder Bill: floats, never walks. Gentle thrust, inertia, damping and a slow drift so
## he feels suspended in nothing rather than piloting a ship. Movement is on the XY plane
## (side-scroller), depth is locked.

@export_group("Movement")
## Acceleration (m/s²) at full input once thrust has ramped up.
@export var acceleration := 4.5
@export var max_speed := 3.0
## How fast thrust ramps toward the stick/keys (lower = lazier, more floaty start).
@export var thrust_response := 3.0
## Exponential velocity decay per second (lower = more inertia / longer glide).
@export var damping := 0.9
@export var input_enabled := true

@export_group("Drift")
## Wandering force (m/s²) that keeps Bill from ever being perfectly still.
@export var drift_strength := 0.18
@export var drift_frequency := 0.12
## Visual-only bob and lean of the Visual node.
@export var bob_amplitude := 0.05
@export var bob_frequency := 0.28
@export var lean_amount := 0.08

@export_group("Space")
@export var lock_depth := true
@export var depth_plane := 0.0
## Beyond this distance from the start point a soft current eases Bill back (0 = off).
@export var soft_boundary_radius := 60.0
@export var soft_boundary_strength := 1.2

@export_group("Nodes")
@export var visual_path: NodePath = ^"Visual"
@export var listener_path: NodePath = ^"Listener"

var _thrust := Vector2.ZERO
var _t := 0.0
var _noise := FastNoiseLite.new()
var _visual: Node3D
var _home := Vector3.ZERO


func _ready() -> void:
	DVInput.ensure_actions()
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	_visual = get_node_or_null(visual_path) as Node3D
	_noise.seed = randi()
	_noise.frequency = 1.0
	_home = global_position
	var listener := get_node_or_null(listener_path) as AudioListener3D
	if listener:
		listener.make_current()


func _physics_process(delta: float) -> void:
	_t += delta
	var input := Vector2.ZERO
	if input_enabled:
		input = Input.get_vector(DVInput.MOVE_LEFT, DVInput.MOVE_RIGHT, DVInput.MOVE_DOWN, DVInput.MOVE_UP)
	_thrust = _thrust.lerp(input, 1.0 - exp(-thrust_response * delta))

	var accel := Vector3(_thrust.x, _thrust.y, 0.0) * acceleration
	var nt := _t * drift_frequency
	accel += Vector3(_noise.get_noise_2d(nt, 0.0), _noise.get_noise_2d(0.0, nt + 31.7), 0.0) * drift_strength * 2.0

	if soft_boundary_radius > 0.0:
		var away := global_position - _home
		away.z = 0.0
		var over := away.length() - soft_boundary_radius
		if over > 0.0:
			accel -= away.normalized() * minf(over, 10.0) * soft_boundary_strength

	velocity += accel * delta
	velocity *= exp(-damping * delta)
	velocity = velocity.limit_length(max_speed)
	if lock_depth:
		velocity.z = 0.0
	move_and_slide()
	if lock_depth:
		global_position.z = depth_plane

	if _visual:
		_visual.position.y = sin(_t * TAU * bob_frequency) * bob_amplitude
		_visual.rotation.z = lerpf(_visual.rotation.z, -velocity.x * lean_amount, 1.0 - exp(-3.0 * delta))
		_visual.rotation.x = lerpf(_visual.rotation.x, velocity.y * lean_amount * 0.5, 1.0 - exp(-3.0 * delta))
