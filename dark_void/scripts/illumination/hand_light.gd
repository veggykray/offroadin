class_name HandLight
extends IlluminationSource
## Bill's weak hand light: a short-range omni light (NOT a beam) plus the gameplay
## illumination it delivers.
##
## Modular: it only needs a parent transform. For the prototype it sits under PlaceholderHand;
## on the final character, put this node (with its Energy child) under a BoneAttachment3D on
## the hand bone and delete the placeholder.

signal emitting_changed(emitting: bool)

@export_group("Light")
## Radius in metres. Also the gameplay detection radius.
@export var light_range := 3.2
@export var light_intensity := 1.4
## OmniLight3D attenuation: higher = brightness collapses faster away from the hand.
@export_range(0.0, 4.0) var light_attenuation := 1.5
@export var light_color := Color(1.0, 0.84, 0.66)
@export var cast_shadows := true
## Soft-shadow size of the emitter (a hand, not a point).
@export var light_size := 0.12
@export var fade_in_time := 0.12
@export var fade_out_time := 0.3
## Subtle organic wobble in rendered brightness (not in gameplay output).
@export_range(0.0, 0.3) var flicker_amount := 0.04

@export_group("Control")
## Read `input_action` (hold to illuminate). Turn off to drive it from code via forced_on.
@export var read_input := true
@export var input_action := &"dv_illuminate"
## Ignore input and stay lit (handy when the energy mechanic is disabled).
@export var always_on := false

@export_group("Energy")
## Optional LightEnergy node. Empty / missing = unlimited.
@export var energy_path: NodePath = ^"Energy"

var energy: LightEnergy
## Lit regardless of input/energy (used by sequences like the completion).
var forced_on := false
## Blocks player input without touching forced_on.
var input_blocked := false

var _light: OmniLight3D
var _level := 0.0
var _output := 0.0
var _intensity_mult := 1.0
var _range_mult := 1.0
var _emitting := false
var _t := 0.0


func _ready() -> void:
	DVInput.ensure_actions()
	for c in get_children():
		if c is OmniLight3D:
			_light = c
			break
	if _light == null:
		_light = OmniLight3D.new()
		_light.name = "Omni"
		add_child(_light)
	energy = get_node_or_null(energy_path) as LightEnergy
	_apply(1.0)


func _process(delta: float) -> void:
	_t += delta
	var requested := always_on or forced_on \
			or (read_input and not input_blocked and Input.is_action_pressed(input_action))
	var allowed := forced_on or energy == null or energy.can_emit(_level > 0.01)
	var target := 1.0 if (requested and allowed) else 0.0
	var fade := fade_in_time if target > _level else fade_out_time
	_level = move_toward(_level, target, delta / maxf(fade, 0.001))

	var factor := 1.0
	if energy != null and not forced_on:
		factor = energy.get_output_factor()
	_output = _level * factor
	if energy != null and not forced_on:
		energy.tick(delta, _output)

	var flicker := 1.0 + (sin(_t * 23.0) * 0.5 + sin(_t * 37.0 + 1.3) * 0.5) * flicker_amount
	if factor < 0.999:
		# Gutter a little harder when low on energy.
		flicker *= 1.0 + sin(_t * 61.0) * (1.0 - factor) * 0.25
	_apply(flicker)

	var now := _output > 0.01
	if now != _emitting:
		_emitting = now
		emitting_changed.emit(now)


func _apply(flicker: float) -> void:
	if _light == null:
		return
	_light.omni_range = light_range * _range_mult
	_light.omni_attenuation = light_attenuation
	_light.light_color = light_color
	_light.light_energy = light_intensity * _output * _intensity_mult * flicker
	_light.shadow_enabled = cast_shadows
	_light.light_size = light_size
	_light.visible = _output * _intensity_mult > 0.001


func get_output() -> float:
	return _output * _intensity_mult


func get_range() -> float:
	return light_range * _range_mult


func get_potential_range() -> float:
	return light_range * maxf(_range_mult, 1.0)


func is_emitting() -> bool:
	return _emitting


## 0..1 fade level of the light itself (ignoring energy dimming).
func get_level() -> float:
	return _level


## Smoothly scales brightness and radius; forces the light on. Returns the tween.
func boost(intensity_mult: float, range_mult: float, duration: float) -> Tween:
	forced_on = true
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(self, "_intensity_mult", intensity_mult, duration)
	tw.tween_property(self, "_range_mult", range_mult, duration)
	return tw
