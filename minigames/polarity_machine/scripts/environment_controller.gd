extends Node2D
## Owns the *smoothed* visual state of the room.
##
## The root sets integer targets (0..4) with set_state(). This node glides fractional levels
## toward them at a constant speed, so moving from FREEZING to SCORCHING visibly passes through
## every state in between. Each frame the levels change it pushes them to its own children
## (room, water vessel, lamp) and broadcasts levels_changed for everything else
## (plant, machine, atmosphere) — those are wired up by the root.

signal levels_changed(temperature_level: float, light_level: float, age_level: float)

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

## Detents per second the room travels toward a new setting.
const TEMPERATURE_SPEED := 1.8
const LIGHT_SPEED := 2.4
const AGE_SPEED := 1.25

var target_temperature := 2
var target_light := 2
var target_age := 2
var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0

@onready var room: Node2D = $Room
@onready var vessel: Node2D = $WaterVessel
@onready var lamp: Node2D = $Lamp

var _dirty := true


func set_state(temperature: int, light: int, age: int, instant := false) -> void:
	target_temperature = temperature
	target_light = light
	target_age = age
	if instant:
		temperature_level = float(temperature)
		light_level = float(light)
		age_level = float(age)
	_dirty = true


## True while the room is still gliding toward the machine's setting.
func is_transitioning() -> bool:
	return not (is_equal_approx(temperature_level, float(target_temperature))
			and is_equal_approx(light_level, float(target_light))
			and is_equal_approx(age_level, float(target_age)))


func _process(delta: float) -> void:
	if not (_dirty or is_transitioning()):
		return
	_dirty = false
	temperature_level = U.approach(temperature_level, float(target_temperature), TEMPERATURE_SPEED, delta)
	light_level = U.approach(light_level, float(target_light), LIGHT_SPEED, delta)
	age_level = U.approach(age_level, float(target_age), AGE_SPEED, delta)
	for child in [room, vessel, lamp]:
		child.call("set_levels", temperature_level, light_level, age_level)
	levels_changed.emit(temperature_level, light_level, age_level)
