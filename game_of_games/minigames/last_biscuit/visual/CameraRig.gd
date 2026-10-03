class_name LBCameraRig
extends Camera3D
## The single cinematic view from behind Bill, down the length of the table.
## Adds a slow breathing drift, impact bumps (slaps, chomps) and tiny shakes.

@export var base_position := Vector3(0.0, 3.25, 8.1)
@export var look_target := Vector3(0.0, 0.62, 1.55)
@export var drift_amount := 0.025
@export var follow_amount := 0.06

var _bump := Vector3.ZERO
var _bump_vel := Vector3.ZERO
var _shake := 0.0
var _t := 0.0
var focus := Vector3.ZERO        # gameplay focus (Bill's hand) for subtle parallax


func _ready() -> void:
	fov = 46.0
	near = 0.05
	far = 60.0
	_apply(0.0)


func bump(dir: Vector3, strength := 1.0) -> void:
	_bump_vel += dir.normalized() * strength * 0.9


func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)


func _process(dt: float) -> void:
	_t += dt
	# sub-stepped spring so a slow frame can never make it explode
	var steps := int(ceil(dt / 0.004))
	var h := dt / maxf(steps, 1)
	for i in steps:
		_bump_vel += (-_bump * 220.0 - _bump_vel * 18.0) * h
		_bump += _bump_vel * h
	_bump = _bump.limit_length(0.25)
	_shake = maxf(_shake - dt * 1.5, 0.0)
	_apply(dt)


func _apply(_dt: float) -> void:
	var drift := Vector3(sin(_t * 0.21) * 1.0, sin(_t * 0.17 + 1.0) * 0.6, 0.0) * drift_amount
	var follow := Vector3(focus.x, 0.0, 0.0) * follow_amount
	var sh := Vector3(randf_range(-1, 1), randf_range(-1, 1), 0.0) * _shake * 0.02
	global_position = base_position + drift + follow + _bump + sh
	look_at(look_target + follow * 0.5 + _bump * 0.3, Vector3.UP)
