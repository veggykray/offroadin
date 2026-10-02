class_name VoidEnvironment
extends WorldEnvironment
## True black void: black background, zero ambient, no reflections, no fog.
## Progressive reveal raises ambient (and an optional faint fill light) per memory level.

## Ambient energy per reveal level (index = memories activated). Keep these tiny.
@export var ambient_levels: Array[float] = [0.0, 0.01, 0.03, 0.07]
## Optional DirectionalLight3D energy per level: gives the faintest sense of form at level 3.
@export var fill_levels: Array[float] = [0.0, 0.0, 0.003, 0.012]
@export var ambient_color := Color(0.5, 0.55, 0.7)
@export var fill_light_path: NodePath
@export var fill_direction := Vector3(0.35, -0.55, -0.75)
@export var transition_time := 5.0
## Ambient energy used by the F2 debug reveal (to inspect the layout).
@export var debug_reveal_energy := 1.5

var level := 0
var debug_reveal := false

var _fill: DirectionalLight3D
var _extra := 0.0
var _tween: Tween


func _ready() -> void:
	if environment == null:
		environment = Environment.new()
	var e := environment
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color.BLACK
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = ambient_color
	e.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.tonemap_exposure = 1.0
	e.glow_enabled = false
	e.fog_enabled = false
	e.volumetric_fog_enabled = false
	e.ssao_enabled = false
	e.ssil_enabled = false
	e.sdfgi_enabled = false
	_fill = get_node_or_null(fill_light_path) as DirectionalLight3D
	if _fill:
		_fill.global_transform.basis = Basis.looking_at(fill_direction.normalized(), Vector3.UP)
		_fill.shadow_enabled = false
		_fill.light_color = ambient_color
	_apply_now()


func set_reveal_level(new_level: int, instant := false) -> void:
	level = maxi(new_level, 0)
	if instant:
		_apply_now()
		return
	_tween_to(_ambient_target(), _fill_target(), transition_time)


## Extra ambient on top of the level (used by the completion reveal).
func add_extra_ambient(amount: float, duration: float) -> void:
	_extra += amount
	_tween_to(_ambient_target(), _fill_target(), duration)


func toggle_debug_reveal() -> void:
	debug_reveal = not debug_reveal
	_tween_to(_ambient_target(), _fill_target(), 0.25)


func _ambient_target() -> float:
	if debug_reveal:
		return debug_reveal_energy
	return _level_value(ambient_levels) + _extra


func _fill_target() -> float:
	return _level_value(fill_levels)


func _level_value(arr: Array[float]) -> float:
	if arr.is_empty():
		return 0.0
	return arr[clampi(level, 0, arr.size() - 1)]


func _apply_now() -> void:
	environment.ambient_light_energy = _ambient_target()
	if _fill:
		_fill.light_energy = _fill_target()
		_fill.visible = _fill.light_energy > 0.0


func _tween_to(ambient: float, fill: float, duration: float) -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_property(environment, "ambient_light_energy", ambient, duration)
	if _fill:
		_fill.visible = true
		_tween.tween_property(_fill, "light_energy", fill, duration)
