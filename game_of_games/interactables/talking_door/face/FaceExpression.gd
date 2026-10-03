@tool
class_name FaceExpression
extends Resource
## One facial expression, described as a set of feature targets.
##
## The face tweens smoothly between expressions, so you never author
## transitions - just the end states. Expressions can also be applied at partial
## intensity (set_expression("annoyed", 0.4)), which blends from "idle".

@export var name: StringName = &"idle"

@export_group("Eyebrows")
## Pixels up (+) or down (-).
@export var brow_height := 0.0
## Degrees. + raises the inner ends (worried, sad), - lowers them (angry).
@export var brow_angle := 0.0
## Pixels the brows pull together (frown).
@export var brow_squeeze := 0.0
## Pixels the LEFT brow is raised more than the right (quizzical).
@export var brow_asymmetry := 0.0

@export_group("Eyelids")
## 0 closed, ~0.75 relaxed, 1 wide, 1.2 shocked.
@export_range(0.0, 1.4) var upper_lid := 0.78
## 0 relaxed, 1 lower lid pushed up (squint, smiling eyes).
@export_range(0.0, 1.2) var lower_lid := 0.05
## Degrees. + inner corners down (anger/suspicion), - outer corners down (sadness).
@export var lid_tilt := 0.0
## How much narrower the RIGHT eye is than the left (0..0.5). Nice for suspicion.
@export_range(0.0, 0.6) var lid_asymmetry := 0.0

@export_group("Eyes")
@export_range(0.4, 1.8) var pupil_size := 1.0
## 0 = ignores whoever it is watching, 1 = locks on.
@export_range(0.0, 1.0) var tracking := 1.0
## Constant gaze offset (-1..1). e.g. (0, 0.4) looks downward.
@export var gaze_bias := Vector2.ZERO
## Multiplier for how often the eyes dart elsewhere.
@export_range(0.0, 4.0) var glance_rate := 1.0
## Multiplier for blink frequency. 0 = never blinks.
@export_range(0.0, 4.0) var blink_rate := 1.0

@export_group("Mouth (resting shape)")
@export_range(-1.0, 1.0) var mouth_smile := 0.0
@export_range(0.5, 1.5) var mouth_width := 1.0
@export_range(0.0, 1.0) var mouth_open := 0.0
@export_range(0.0, 1.0) var mouth_pucker := 0.0
@export_range(0.0, 1.0) var mouth_press := 0.0
@export_range(0.0, 1.0) var mouth_teeth := 0.0
@export_range(-1.0, 1.0) var mouth_asymmetry := 0.0

@export_group("Whole face")
## Pixels the features shift (they are under a skin, so keep this small).
@export var face_offset := Vector2.ZERO
@export var face_tilt := 0.0
@export var face_scale := 1.0
@export var breath_amount := 1.0
@export var breath_rate := 1.0
## Small nervous tremble (0..1).
@export_range(0.0, 1.0) var tremble := 0.0

## Every animatable parameter. TalkingDoorFace blends these generically.
const PARAMS: Array[StringName] = [
	&"brow_height", &"brow_angle", &"brow_squeeze", &"brow_asymmetry",
	&"upper_lid", &"lower_lid", &"lid_tilt", &"lid_asymmetry",
	&"pupil_size", &"tracking", &"gaze_bias", &"glance_rate", &"blink_rate",
	&"mouth_smile", &"mouth_width", &"mouth_open", &"mouth_pucker", &"mouth_press",
	&"mouth_teeth", &"mouth_asymmetry",
	&"face_offset", &"face_tilt", &"face_scale", &"breath_amount", &"breath_rate", &"tremble",
]


func to_params() -> Dictionary:
	var d := {}
	for p in PARAMS:
		d[p] = get(p)
	return d


static func default_params() -> Dictionary:
	return FaceExpression.new().to_params()


static func lerp_params(a: Dictionary, b: Dictionary, t: float) -> Dictionary:
	var out := {}
	for k in a:
		out[k] = lerp(a[k], b.get(k, a[k]), t)
	return out
