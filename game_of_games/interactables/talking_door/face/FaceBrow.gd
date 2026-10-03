class_name FaceBrow
extends Node2D
## An eyebrow. Put the brow artwork (Sprite2D) as a child; the Node2D itself is
## moved and rotated. The artwork should be drawn as the LEFT brow (inner end
## pointing right); the right brow is simply mirrored with is_right_brow.

@export var is_right_brow := false
## Pixels the brow moves up per 1.0 of "height" coming from expressions.
@export var height_scale := 1.0
## Degrees per 1.0 of "angle" coming from expressions.
@export var angle_scale := 1.0

var _rest_position := Vector2.ZERO


func _ready() -> void:
	_rest_position = position
	scale.x = -absf(scale.x) if is_right_brow else absf(scale.x)


## height: pixels up. angle_deg: + = inner end raised (worry/sadness), - = inner end lowered (anger).
## squeeze: pixels toward the nose.
func apply(height: float, angle_deg: float, squeeze: float) -> void:
	var inward := -1.0 if is_right_brow else 1.0
	position = _rest_position + Vector2(squeeze * inward, -height * height_scale)
	rotation = deg_to_rad(angle_deg * angle_scale) * (1.0 if is_right_brow else -1.0)
