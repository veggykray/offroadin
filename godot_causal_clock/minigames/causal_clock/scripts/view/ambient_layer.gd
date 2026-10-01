class_name CausalClockAmbient
extends Node
## Screen-space atmosphere: the shader-painted room behind the artifact,
## shafts of light and drifting dust in front of it. Added as two
## CanvasLayers (behind and in front of the world) by the game/title scenes.

const BACKDROP_SHADER := preload("res://minigames/causal_clock/art/shaders/backdrop.gdshader")
const RAYS_SHADER := preload("res://minigames/causal_clock/art/shaders/light_rays.gdshader")

var _back_rect: ColorRect
var _rays_rect: ColorRect
var _dust: CPUParticles2D
var _motes: CPUParticles2D


func _ready() -> void:
	var back := CanvasLayer.new()
	back.layer = -10
	add_child(back)
	_back_rect = ColorRect.new()
	_back_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_back_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = BACKDROP_SHADER
	_back_rect.material = m
	back.add_child(_back_rect)

	var front := CanvasLayer.new()
	front.layer = 5
	add_child(front)
	_rays_rect = ColorRect.new()
	_rays_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rays_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m2 := ShaderMaterial.new()
	m2.shader = RAYS_SHADER
	_rays_rect.material = m2
	front.add_child(_rays_rect)
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_dust = _make_particles(90, 2.2, 0.35, add)
	front.add_child(_dust)
	_motes = _make_particles(18, 7.0, 0.12, add)
	front.add_child(_motes)
	get_viewport().size_changed.connect(_resize)
	_resize()


func _make_particles(amount: int, size: float, alpha: float, mat: Material) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.amount = amount
	p.lifetime = 14.0
	p.preprocess = 14.0
	p.texture = CausalClockDraw.glow_texture()
	p.material = mat
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.direction = Vector2(0.3, -1.0)
	p.spread = 60.0
	p.gravity = Vector2(4, -3)
	p.initial_velocity_min = 3.0
	p.initial_velocity_max = 12.0
	p.angular_velocity_min = -20
	p.angular_velocity_max = 20
	p.scale_amount_min = size / 128.0 * 0.6
	p.scale_amount_max = size / 128.0 * 1.6
	var g := Gradient.new()
	g.set_color(0, Color(1, 0.9, 0.7, 0))
	g.set_color(1, Color(1, 0.9, 0.7, 0))
	g.add_point(0.25, Color(1, 0.88, 0.65, alpha))
	g.add_point(0.75, Color(1, 0.88, 0.65, alpha * 0.8))
	p.color_ramp = g
	return p


func _resize() -> void:
	var s := get_viewport().get_visible_rect().size
	(_back_rect.material as ShaderMaterial).set_shader_parameter("aspect", s.x / maxf(1.0, s.y))
	for p in [_dust, _motes]:
		p.position = s * 0.5
		p.emission_rect_extents = s * 0.55


## 0..1 brightening used for the completion moment.
func set_flare(v: float) -> void:
	(_back_rect.material as ShaderMaterial).set_shader_parameter("flare", v)
	(_rays_rect.material as ShaderMaterial).set_shader_parameter("flare", v)


func flare_up() -> void:
	var tw := create_tween()
	tw.tween_method(set_flare, 0.0, 1.0, 1.6).set_trans(Tween.TRANS_SINE)
	tw.tween_method(set_flare, 1.0, 0.35, 4.0)
