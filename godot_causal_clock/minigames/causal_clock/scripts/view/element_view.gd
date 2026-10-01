class_name CausalClockElementView
extends Node2D
## Base for anything that turns: rings and the hub.
##
## Motion is a damped spring towards a continuous target angle, so a ring
## that is retargeted mid-animation (fast clicking, dragging) never snaps.
## Heavier elements (layout "mass") use a softer spring: they feel weighty,
## lag a little and overshoot gently.

var layout: CausalClockLayout
var element: CausalClockLayout.ElementDef
var geo: CausalClockGeometry
var index: int = 0
var step_rad: float = 0.0

var target: float = 0.0
var display: float = 0.0
var velocity: float = 0.0
## Extra visual offset while the player drags ("give" before a step commits).
var give: float = 0.0
var _shake_t: float = 0.0
var _shake_amp: float = 0.0
var _pending: Array = []  # [seconds_left, delta_steps]

var pinned: bool = false
var hovered: bool = false
var selected: bool = false


func setup(p_layout: CausalClockLayout, p_index: int, p_geo: CausalClockGeometry) -> void:
	layout = p_layout
	index = p_index
	element = layout.elements[p_index]
	geo = p_geo
	step_rad = TAU / float(element.positions)


func snap_to(position_steps: int) -> void:
	target = position_steps * step_rad
	display = target
	velocity = 0.0
	_pending.clear()
	rotation = display


## Re-target to an absolute logical position (used by undo / reset): picks the
## shortest way round so the ring winds back instead of spinning wildly.
func settle_to(position_steps: int, delay: float = 0.0) -> void:
	_pending.clear()
	var goal := position_steps * step_rad
	var diff := wrapf(goal - target, -PI, PI)
	var steps := int(round(diff / step_rad))
	_pending.append([delay, steps])


func queue_turn(delta_steps: int, delay: float) -> void:
	_pending.append([delay, delta_steps])


func shake(amount: float = 0.05) -> void:
	_shake_t = 0.45
	_shake_amp = amount


func is_moving() -> bool:
	return absf(display - target) > 0.002 or absf(velocity) > 0.01 or not _pending.is_empty()


func _process(dt: float) -> void:
	for i in range(_pending.size() - 1, -1, -1):
		_pending[i][0] -= dt
		if _pending[i][0] <= 0.0:
			target += _pending[i][1] * step_rad
			_pending.remove_at(i)
	var mass := maxf(0.3, element.mass)
	var k := 150.0 / mass
	var c := 2.0 * sqrt(k) * 0.66
	var sub := 4
	var h := dt / sub
	for _i in sub:
		var acc := -k * (display - target) - c * velocity
		velocity += acc * h
		display += velocity * h
	var shake_off := 0.0
	if _shake_t > 0.0:
		_shake_t -= dt
		shake_off = sin(_shake_t * 70.0) * _shake_amp * (_shake_t / 0.45)
	rotation = display + give + shake_off
	_animate(dt)


## Hook for subclasses (glows, idle motion).
func _animate(_dt: float) -> void:
	pass
