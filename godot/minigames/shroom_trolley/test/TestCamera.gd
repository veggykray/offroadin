extends Camera2D
## TEST-ONLY camera. Shows how a real camera can receive the mini-game's
## camera impulses: implement request_camera_impulse(strength, direction) and
## point the activity's `camera_handler` at this node (or connect the
## activity's camera_impulse_requested signal to it).

@export var max_offset := 18.0
@export var decay := 6.0

var _trauma := 0.0
var _kick := Vector2.ZERO
var _t := 0.0


func request_camera_impulse(strength: float, direction := Vector2.ZERO) -> void:
	_trauma = minf(1.0, _trauma + strength / 14.0)
	_kick += direction.normalized() * strength * 0.8


func _process(delta: float) -> void:
	_t += delta
	_trauma = maxf(0.0, _trauma - delta * decay * 0.25)
	_kick = _kick.lerp(Vector2.ZERO, minf(1.0, delta * 12.0))
	var s := _trauma * _trauma
	offset = Vector2(sin(_t * 61.0), cos(_t * 53.0)) * max_offset * s + _kick
