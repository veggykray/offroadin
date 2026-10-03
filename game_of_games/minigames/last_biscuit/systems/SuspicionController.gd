class_name LBSuspicion
extends Node
## Per-diner, per-hand suspicion. Stillness inside a gaze is (mostly) safe;
## movement inside a gaze raises suspicion fast. Suspicion is never shown as a
## bar: the diner's face and posture express it (see LBDiner.expression_level).

signal caught(hand: LBHand)
signal level_crossed(hand: LBHand, level: int)

## Hand speed (m/s) below which a hand counts as frozen.
@export var still_speed := 0.14
## Suspicion per second per (m/s above still_speed) at full visibility.
@export var sensitivity := 0.8
## While watched AND frozen, suspicion still creeps up this much per second
## at full visibility (so you can't sit in plain sight forever).
@export var still_gain := 0.03
@export var decay_per_sec := 0.3
@export var decay_delay := 0.7
## Extra multiplier while the diner is already focused on that hand.
@export var focus_bonus := 1.2
## Global multiplier (raised during the run back).
@export var alertness := 1.0

const LEVELS := [0.18, 0.4, 0.62, 0.82, 1.0]   # glance, eyebrow, lean, narrow, CAUGHT

var values := {}                 # LBHand -> float
var _since_gain := {}            # LBHand -> seconds since last increase
var _level := {}                 # LBHand -> int


func get_value(h: LBHand) -> float:
	return values.get(h, 0.0)


func reset() -> void:
	values.clear()
	_since_gain.clear()
	_level.clear()


func add(h: LBHand, amount: float) -> void:
	if amount <= 0.0:
		return
	values[h] = minf(values.get(h, 0.0) + amount * alertness, 1.0)
	_since_gain[h] = 0.0
	_check(h)


## vis: 0..1 visibility, focused: whether the diner is already staring at it.
func observe(h: LBHand, vis: float, dt: float, focused: bool) -> void:
	var v: float = values.get(h, 0.0)
	var gain := 0.0
	if vis > 0.0:
		var spd := h.speed()
		var motion := maxf(0.0, spd - still_speed)
		gain = vis * motion * sensitivity
		if focused:
			gain *= focus_bonus
		gain += vis * still_gain * (1.0 if v > 0.15 else 0.0)
	if gain > 0.0005:
		v = minf(v + gain * alertness * dt, 1.0)
		_since_gain[h] = 0.0
	else:
		var s: float = _since_gain.get(h, 99.0) + dt
		_since_gain[h] = s
		if s > decay_delay:
			v = maxf(v - decay_per_sec * dt, 0.0)
	values[h] = v
	_check(h)


func _check(h: LBHand) -> void:
	var v: float = values.get(h, 0.0)
	var lvl := 0
	for i in LEVELS.size():
		if v >= LEVELS[i] - 0.0001:
			lvl = i + 1
	var old: int = _level.get(h, 0)
	if lvl != old:
		_level[h] = lvl
		if lvl > old:
			level_crossed.emit(h, lvl)
		if lvl >= LEVELS.size():
			caught.emit(h)


func strongest() -> Array:
	var best: LBHand = null
	var bv := 0.0
	for h in values:
		if values[h] > bv and is_instance_valid(h):
			bv = values[h]
			best = h
	return [best, bv]
