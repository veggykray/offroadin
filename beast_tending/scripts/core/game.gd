extends Node
## Autoload "Game": shared references, constants and small helpers.
## Systems register themselves here in _ready so they can find each other
## without hard-coded node paths.

## How the creature judged one piece of contact.
enum Level { WRONG, NEUTRAL, CLOSE, GOOD, VERY_GOOD, HERRING }
const LEVEL_NAMES := ["WRONG", "neutral", "close", "GOOD", "VERY GOOD", "!!!"]

const WORLD_WIDTH := 8000.0
const SCREEN := Vector2(1920, 1080)

## The near surface contour of the beast. Mirrored in shaders/skin.gdshader;
## keep the two in sync.
const SURFACE_BASE := 300.0
const SURFACE_WAVES := [
	Vector3(70.0, 0.0011, 0.6),
	Vector3(38.0, 0.0027, 2.1),
	Vector3(16.0, 0.0071, 0.3),
]

signal debug_toggled(on: bool)

var debug := false:
	set(v):
		debug = v
		debug_toggled.emit(v)

var mind: Node
var sequence: Node
var body: Node2D
var voice: Node
var camera: Camera2D
var gestures: GestureRecognizer
var hand: Node2D
var bill: Node2D
var screen_fx: Node
var decor: Node2D
var terrain: Node2D
var regions := {}  # StringName -> BodyRegion

var soft_texture: Texture2D
var ring_texture: Texture2D
var _shake_seed := 0.0


func _ready() -> void:
	soft_texture = make_soft_texture(128, [Color(1, 1, 1, 1), Color(1, 1, 1, 0.35), Color(1, 1, 1, 0)], [0.0, 0.35, 1.0])
	ring_texture = make_soft_texture(128, [Color(1, 1, 1, 0), Color(1, 1, 1, 0), Color(1, 1, 1, 1), Color(1, 1, 1, 0)], [0.0, 0.6, 0.8, 1.0])


func make_soft_texture(size: int, colors: Array, offsets: Array) -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(offsets)
	g.colors = PackedColorArray(colors)
	var t := GradientTexture2D.new()
	t.gradient = g
	t.width = size
	t.height = size
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	return t


static func surface_y(x: float) -> float:
	var y := SURFACE_BASE
	for w in SURFACE_WAVES:
		y += w.x * sin(x * w.y + w.z)
	return y


func register_region(r: Node) -> void:
	regions[r.region_id] = r


func region(id: StringName) -> Node:
	return regions.get(id)


func screen_to_world(p: Vector2) -> Vector2:
	var vp := get_viewport()
	if vp == null:
		return p
	return vp.get_canvas_transform().affine_inverse() * p


func world_to_screen(p: Vector2) -> Vector2:
	var vp := get_viewport()
	if vp == null:
		return p
	return vp.get_canvas_transform() * p


func camera_x() -> float:
	return camera.get_screen_center_position().x if camera else SCREEN.x * 0.5


## Escalation 0..1: how worked-up the beast is. Drives almost every effect.
func escalation() -> float:
	return mind.escalation if mind else 0.0


static func damp(current, target, rate: float, delta: float):
	return lerp(current, target, 1.0 - exp(-rate * delta))
