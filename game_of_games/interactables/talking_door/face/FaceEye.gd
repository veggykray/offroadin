class_name FaceEye
extends Node2D
## One eye of a TalkingDoorFace: eyeball, iris/pupil, upper and lower lid.
##
## TalkingDoorFace only sends normalised values to apply(). Everything that
## depends on the artwork's pixel size lives in the exported values below, so
## when you swap in new eye drawings you only need to adjust these numbers.
##
## Expected children (rename-safe via the exported paths):
##   Sclera (Sprite2D, Clip Children = "Clip + Draw")  - the eyeball / eye opening
##     Iris (Sprite2D)
##       Pupil (Sprite2D)
##     UpperLid (Sprite2D)  - its bottom edge is the lash line
##     LowerLid (Sprite2D)
##   Outline (Sprite2D, optional) - drawn on top of everything

## This is the eye on the right of the screen (flips tilt directions).
@export var is_right_eye := false

@export_group("Iris / pupil")
## Furthest the iris can travel from the centre of the eye (pixels).
@export var pupil_range := Vector2(17, 8)
## Where the iris sits when looking straight ahead.
@export var iris_center := Vector2(0, 1)

@export_group("Upper lid")
## Y position (eye pixels) of the lid's lash line when the eye is fully closed.
@export var upper_lid_closed_y := 20.0
## Y position of the lash line when the eye is open = 1.0.
@export var upper_lid_open_y := -21.0
## Distance from the UpperLid sprite's centre to its lash line (art dependent).
@export var upper_lid_margin_offset := 36.0
## Lids flatten as they close. 0 = no flattening.
@export_range(0, 1) var upper_lid_flatten := 0.45

@export_group("Lower lid")
@export var lower_lid_rest_y := 19.0
@export var lower_lid_raised_y := 3.0
@export var lower_lid_margin_offset := -16.0

@export_group("Node paths")
@export var iris_path := NodePath("Sclera/Iris")
@export var pupil_path := NodePath("Sclera/Iris/Pupil")
@export var upper_lid_path := NodePath("Sclera/UpperLid")
@export var lower_lid_path := NodePath("Sclera/LowerLid")

var _iris: Node2D
var _pupil: Node2D
var _upper: Node2D
var _lower: Node2D
var _pupil_base_scale := Vector2.ONE
var _upper_base_scale := Vector2.ONE


func _ready() -> void:
	_iris = get_node_or_null(iris_path)
	_pupil = get_node_or_null(pupil_path)
	_upper = get_node_or_null(upper_lid_path)
	_lower = get_node_or_null(lower_lid_path)
	if _pupil:
		_pupil_base_scale = _pupil.scale
	if _upper:
		_upper_base_scale = _upper.scale
		if _upper is Sprite2D:
			(_upper as Sprite2D).offset.y = -upper_lid_margin_offset
	if _lower is Sprite2D:
		(_lower as Sprite2D).offset.y = -lower_lid_margin_offset


## open:        0 closed .. 1 normally wide open (up to ~1.3 for shock)
## lower:       0 relaxed .. 1 lower lid pushed right up (squint / smile)
## tilt_deg:    + = inner corner of the upper lid lowered (anger), - = outer lowered (sadness)
## gaze:        where the eye is looking; length 1 = iris at the edge of pupil_range
## pupil_scale: 1 = normal, >1 dilated
func apply(open: float, lower: float, tilt_deg: float, gaze: Vector2, pupil_scale: float) -> void:
	if _iris:
		_iris.position = iris_center + gaze * pupil_range
	if _pupil:
		_pupil.scale = _pupil_base_scale * clampf(pupil_scale, 0.4, 1.8)
	var side := 1.0 if is_right_eye else -1.0
	if _lower:
		_lower.position = Vector2(0, lerpf(lower_lid_rest_y, lower_lid_raised_y, clampf(lower, 0.0, 1.2)))
		_lower.rotation = deg_to_rad(tilt_deg * 0.25 * side)
	if _upper:
		var margin_y := lerpf(upper_lid_closed_y, upper_lid_open_y, clampf(open, 0.0, 1.4))
		# Never let the upper lid sit below the lower lid.
		if _lower:
			margin_y = minf(margin_y, _lower.position.y + 3.0)
		_upper.position = Vector2(0, margin_y)
		_upper.rotation = deg_to_rad(-tilt_deg * side)
		var flat := lerpf(1.0 - upper_lid_flatten, 1.0, clampf(open, 0.0, 1.0))
		_upper.scale = Vector2(_upper_base_scale.x, _upper_base_scale.y * flat)
