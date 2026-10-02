class_name LightEnergy
extends Node
## Optional finite energy for a HandLight. Drains while the light emits (scaled by output),
## recharges while it is off. Disable `enabled` for unlimited light.

signal energy_changed(current: float, maximum: float)
signal depleted
signal recovered

@export var enabled := true
@export var max_energy := 100.0
## Energy per second at full output.
@export var drain_rate := 11.0
## Energy per second while the light is off.
@export var recharge_rate := 16.0
## Seconds after releasing the light before recharge starts.
@export var recharge_delay := 0.5
## Minimum energy fraction needed to switch the light ON (and to relight after running dry).
## Below it the hand stays dark until it has recovered.
@export_range(0.0, 1.0) var min_light_threshold := 0.15
## Below this fraction the light starts to dim/gutter.
@export_range(0.0, 1.0) var dim_below := 0.3
## Output multiplier reached at zero energy (the dimmest the light gets before it dies).
@export_range(0.0, 1.0) var dim_floor := 0.35

var energy := 0.0
var exhausted := false
var _since_emit := 999.0


func _ready() -> void:
	energy = max_energy


func get_ratio() -> float:
	return energy / max_energy if max_energy > 0.0 else 0.0


## currently_on: the light is already emitting (it may keep going below the threshold).
func can_emit(currently_on: bool) -> bool:
	if not enabled:
		return true
	if exhausted or energy <= 0.0:
		return false
	return currently_on or get_ratio() >= min_light_threshold


func get_output_factor() -> float:
	if not enabled:
		return 1.0
	var r := get_ratio()
	if r >= dim_below or dim_below <= 0.0:
		return 1.0
	return lerpf(dim_floor, 1.0, r / dim_below)


func tick(delta: float, output: float) -> void:
	if not enabled:
		return
	var before := energy
	if output > 0.001:
		_since_emit = 0.0
		energy = maxf(0.0, energy - drain_rate * output * delta)
		if energy <= 0.0 and not exhausted:
			exhausted = true
			depleted.emit()
	else:
		_since_emit += delta
		if _since_emit >= recharge_delay:
			energy = minf(max_energy, energy + recharge_rate * delta)
		if exhausted and get_ratio() >= min_light_threshold:
			exhausted = false
			recovered.emit()
	if not is_equal_approx(before, energy):
		energy_changed.emit(energy, max_energy)


func refill() -> void:
	energy = max_energy
	exhausted = false
	energy_changed.emit(energy, max_energy)
