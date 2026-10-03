extends Light3D
## Candle flicker: layered noise on energy and a tiny positional jitter.

var _base := -1.0
var _t := 0.0
var _origin := Vector3.ZERO
var _seed := 0.0


func _ready() -> void:
	_base = light_energy
	_origin = position
	_seed = randf() * 100.0


func _process(dt: float) -> void:
	_t += dt
	var n := sin(_t * 7.3 + _seed) * 0.5 + sin(_t * 13.1 + _seed * 2.0) * 0.3 + sin(_t * 29.0 + _seed * 3.0) * 0.2
	light_energy = _base * (0.86 + 0.14 * n)
	position = _origin + Vector3(sin(_t * 5.0 + _seed), 0.0, cos(_t * 4.1 + _seed)) * 0.006
