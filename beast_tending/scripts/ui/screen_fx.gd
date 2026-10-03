class_name ScreenFX
extends CanvasLayer
## Screen-space atmosphere: falling dust, steam drifting in from somewhere off
## frame on each exhale, a breathing vignette and flashes. Also spawns dust
## puffs on the hide where it is touched badly.

const VIGNETTE := preload("res://shaders/vignette.gdshader")

var dust_rain: CPUParticles2D
var dust_bursts: Array[CPUParticles2D] = []
var steam: CPUParticles2D
var steam_big: CPUParticles2D
var vignette: ColorRect
var flash_rect: ColorRect
var _burst_i := 0
var _puffs: Array[CPUParticles2D] = []
var _puff_i := 0
var _flash := 0.0


func _ready() -> void:
	Game.screen_fx = self
	layer = 5
	vignette = ColorRect.new()
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m := ShaderMaterial.new()
	m.shader = VIGNETTE
	vignette.material = m
	add_child(vignette)

	dust_rain = _dust_emitter(70, 4.0, false)
	dust_rain.emitting = false
	for i in range(3):
		var b := _dust_emitter(110, 3.2, true)
		dust_bursts.append(b)

	steam = _steam_emitter(18, 4.0)
	steam_big = _steam_emitter(60, 5.0)

	flash_rect = ColorRect.new()
	flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash_rect.color = Color(1.0, 0.92, 0.85, 0.0)
	add_child(flash_rect)


func _dust_emitter(amount: int, life: float, one_shot: bool) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.position = Vector2(Game.SCREEN.x * 0.5, -30)
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(Game.SCREEN.x * 0.55, 10)
	p.amount = amount
	p.lifetime = life
	p.one_shot = one_shot
	p.explosiveness = 0.55 if one_shot else 0.0
	p.emitting = false
	p.texture = Game.soft_texture
	p.direction = Vector2(0, 1)
	p.spread = 12.0
	p.gravity = Vector2(6, 140)
	p.initial_velocity_min = 20.0
	p.initial_velocity_max = 120.0
	p.scale_amount_min = 0.04
	p.scale_amount_max = 0.16
	p.angular_velocity_min = -90.0
	p.angular_velocity_max = 90.0
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.15, 0.8, 1.0])
	grad.colors = PackedColorArray([Color(0.85, 0.72, 0.6, 0.0), Color(0.85, 0.72, 0.6, 0.85), Color(0.7, 0.6, 0.5, 0.6), Color(0.7, 0.6, 0.5, 0.0)])
	p.color_ramp = grad
	add_child(p)
	return p


func _steam_emitter(amount: int, life: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.position = Vector2(Game.SCREEN.x + 120, 220)
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(40, 200)
	p.amount = amount
	p.lifetime = life
	p.one_shot = true
	p.explosiveness = 0.2
	p.emitting = false
	p.texture = Game.soft_texture
	p.direction = Vector2(-1, -0.15)
	p.spread = 14.0
	p.gravity = Vector2(-10, -12)
	p.initial_velocity_min = 220.0
	p.initial_velocity_max = 420.0
	p.damping_min = 30.0
	p.damping_max = 60.0
	p.scale_amount_min = 2.0
	p.scale_amount_max = 4.5
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.4))
	curve.add_point(Vector2(1, 1.5))
	p.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.2, 1.0])
	grad.colors = PackedColorArray([Color(1, 0.9, 0.85, 0.0), Color(1, 0.88, 0.82, 0.13), Color(1, 0.85, 0.8, 0.0)])
	p.color_ramp = grad
	add_child(p)
	return p


func _process(delta: float) -> void:
	var e := Game.escalation()
	dust_rain.emitting = e > 0.62
	dust_rain.speed_scale = 0.6 + e
	_flash = Game.damp(_flash, 0.0, 3.5, delta)
	flash_rect.color.a = _flash
	var m := vignette.material as ShaderMaterial
	var breath: float = Game.body.breath if Game.body else 0.0
	var mood: int = Game.mind.mood if Game.mind else 0
	m.set_shader_parameter("breath", breath)
	m.set_shader_parameter("excite", e)
	m.set_shader_parameter("irritated", 1.0 if mood == BeastMind.Mood.IRRITATED else 0.0)


func dust_burst(strength: float) -> void:
	var b := dust_bursts[_burst_i]
	_burst_i = (_burst_i + 1) % dust_bursts.size()
	b.amount = int(clampf(40.0 + 120.0 * strength, 20.0, 220.0))
	b.restart()
	b.emitting = true


func exhale(strength: float) -> void:
	var p := steam_big if strength > 1.2 else steam
	p.initial_velocity_max = 300.0 + 200.0 * strength
	p.restart()
	p.emitting = true


func flash(amount: float) -> void:
	_flash = maxf(_flash, amount)


## Dust knocked off the hide where it was touched.
func dust_puff(world_pos: Vector2, strength: float) -> void:
	if Game.body == null:
		return
	if _puffs.is_empty():
		for i in range(5):
			var p := CPUParticles2D.new()
			p.amount = 22
			p.lifetime = 1.4
			p.one_shot = true
			p.explosiveness = 0.9
			p.emitting = false
			p.texture = Game.soft_texture
			p.direction = Vector2(0, -1)
			p.spread = 70.0
			p.gravity = Vector2(0, 60)
			p.initial_velocity_min = 60.0
			p.initial_velocity_max = 180.0
			p.damping_min = 60.0
			p.damping_max = 120.0
			p.scale_amount_min = 0.15
			p.scale_amount_max = 0.45
			p.z_index = 30
			var grad := Gradient.new()
			grad.offsets = PackedFloat32Array([0.0, 0.1, 1.0])
			grad.colors = PackedColorArray([Color(0.8, 0.7, 0.6, 0.0), Color(0.8, 0.7, 0.6, 0.45), Color(0.7, 0.6, 0.5, 0.0)])
			p.color_ramp = grad
			Game.body.add_child(p)
			_puffs.append(p)
	var p := _puffs[_puff_i]
	_puff_i = (_puff_i + 1) % _puffs.size()
	p.global_position = world_pos
	p.amount = int(12 + 20 * strength)
	p.restart()
	p.emitting = true
