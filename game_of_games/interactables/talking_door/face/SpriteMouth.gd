class_name SpriteMouth
extends MouthRig
## Artwork-driven mouth: one texture per mouth shape.
##
## Fill the texture slots with your drawings (any you leave empty fall back to
## `rest_texture`). The rig picks the closest shape every frame and gently
## stretches it vertically with the amount of jaw opening, so even a few
## drawings look alive.

@export var rest_texture: Texture2D
@export var small_open_texture: Texture2D
@export var wide_open_texture: Texture2D
@export var round_texture: Texture2D
@export var narrow_texture: Texture2D
@export var smile_open_texture: Texture2D
@export var frown_open_texture: Texture2D
@export var pressed_texture: Texture2D
## Scale applied to every mouth texture (use 0.5 for art drawn at double size).
@export var texture_scale := Vector2.ONE
## How much the drawing is stretched by the amount of opening (0 = none).
@export var open_stretch := 0.25
## Minimum time a shape stays on screen; stops flickering between drawings.
@export var min_shape_time := 0.06

var _sprite: Sprite2D
var _current_shape := -1
var _shape_age := 0.0


func _ready() -> void:
	_sprite = Sprite2D.new()
	add_child(_sprite)
	_set_shape(MouthPose.Shape.REST)


func _process(delta: float) -> void:
	_shape_age += delta


func apply_pose(pose: MouthPose) -> void:
	if _sprite == null:
		return
	var shape := pose.nearest_shape()
	if shape != _current_shape and _shape_age >= min_shape_time:
		_set_shape(shape)
	var target := MouthPose.from_shape(_current_shape)
	var stretch := 1.0 + (pose.open - target.open) * open_stretch
	_sprite.scale = texture_scale * Vector2(clampf(pose.width / maxf(target.width, 0.1), 0.85, 1.15), clampf(stretch, 0.7, 1.4))
	_sprite.rotation = deg_to_rad(pose.asym * -4.0)


func _set_shape(shape: int) -> void:
	_current_shape = shape
	_shape_age = 0.0
	var tex: Texture2D = [rest_texture, small_open_texture, wide_open_texture, round_texture,
		narrow_texture, smile_open_texture, frown_open_texture, pressed_texture][shape]
	_sprite.texture = tex if tex else rest_texture
