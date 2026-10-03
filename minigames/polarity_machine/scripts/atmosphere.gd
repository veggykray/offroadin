extends Node2D
## Lighting and air over the room (the machine is drawn after this, so it
## always stays readable):
##   Darkness  multiply layer — how much the lamp lights the room, plus a cold
##             blue or hot amber cast
##   Glow      additive — lamp halo, light cone, light pool on the plant, dust
##             in the beam, heat glow and embers, one-shot flashes
##   Frost     rime creeping in from the edges when it is cold
##   Shimmer   screen-space heat haze when it is hot

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")
const Chamber := preload("res://minigames/polarity_machine/scripts/plant_chamber.gd")
const SHIMMER := preload("res://minigames/polarity_machine/shaders/heat_shimmer.gdshader")

const AMBIENT := [0.38, 0.56, 0.8, 1.0]
const BEAM := [0.0, 0.16, 0.38, 0.72]

var rules
var l := 0.0
var t := 0.0
var _time := 0.0
var _flashes: Array = []  # [pos, color, radius, life, max_life]
var _motes: Array = []
var _embers: Array = []
var _rng := RandomNumberGenerator.new()
var _darkness: Node2D
var _glow: Node2D
var _frost: Node2D
var _shimmer: ColorRect


func _ready() -> void:
	_rng.seed = 5
	_darkness = _layer(CanvasItemMaterial.BLEND_MODE_MUL, _draw_darkness)
	_frost = _layer(CanvasItemMaterial.BLEND_MODE_MIX, _draw_frost)
	_glow = _layer(CanvasItemMaterial.BLEND_MODE_ADD, _draw_glow)
	_shimmer = ColorRect.new()
	_shimmer.size = Vector2(1920, 1080)
	_shimmer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = SHIMMER
	_shimmer.material = sm
	_shimmer.visible = false
	add_child(_shimmer)
	for i in 40:
		_motes.append([Vector2(_rng.randf_range(560, 920), _rng.randf_range(180, 660)), _rng.randf_range(0.0, TAU)])
	for i in 24:
		_embers.append([Vector2(_rng.randf_range(0, 1200), _rng.randf_range(300, 1080)), _rng.randf_range(20, 60)])


func _layer(mode: int, cb: Callable) -> Node2D:
	var n := Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = mode
	n.material = m
	n.draw.connect(cb)
	add_child(n)
	return n


func snap() -> void:
	if rules:
		l = rules.light
		t = rules.temp


func flash(pos: Vector2, color: Color, radius: float, life: float) -> void:
	_flashes.append([pos, color, radius, life, life])


func _process(dt: float) -> void:
	_time += dt
	if rules:
		l = U.approach(l, rules.light, 3.0, dt)
		t = U.approach(t, rules.temp, 2.0, dt)
	for f in _flashes:
		f[3] -= dt
	_flashes = _flashes.filter(func(f): return f[3] > 0.0)
	for mo in _motes:
		mo[1] += dt * 0.4
		mo[0] += Vector2(sin(mo[1]) * 6.0, -4.0) * dt
		if mo[0].y < 190:
			mo[0].y = 650
	var heat := clampf(t - 2.0, 0.0, 1.0)
	for e in _embers:
		e[0].y -= e[1] * dt
		e[0].x += sin(_time + e[1]) * 10.0 * dt
		if e[0].y < 200:
			e[0] = Vector2(_rng.randf_range(0, 1200), 1080)
	var sm := _shimmer.material as ShaderMaterial
	_shimmer.visible = heat > 0.02
	sm.set_shader_parameter("strength", 0.0011 * heat)
	_darkness.queue_redraw()
	_glow.queue_redraw()
	_frost.queue_redraw()


func _key4(x: float, keys: Array) -> float:
	var xc := clampf(x, 0.0, 3.0)
	var i := mini(int(floor(xc)), 2)
	return lerpf(float(keys[i]), float(keys[i + 1]), smoothstep(0.0, 1.0, xc - float(i)))


func _tint() -> Color:
	var cold := clampf(1.0 - t, 0.0, 1.0)
	var cool := clampf(1.0 - absf(t - 1.0), 0.0, 1.0)
	var hot := clampf(t - 2.0, 0.0, 1.0)
	var c := Color(1, 1, 1)
	c = c.lerp(Color(0.78, 0.88, 1.0), cold)
	c = c.lerp(Color(0.92, 0.96, 1.0), cool * 0.6)
	c = c.lerp(Color(1.0, 0.9, 0.8), hot)
	return c


func _draw_darkness() -> void:
	var a := _key4(l, AMBIENT)
	var c := _tint()
	_darkness.draw_rect(Rect2(0, 0, 1920, 1080), Color(c.r * a, c.g * a, c.b * a))


func _draw_glow() -> void:
	var beam := _key4(l, BEAM)
	var bulb := Chamber.BULB
	var flicker := 1.0 + 0.03 * sin(_time * 17.0) * sin(_time * 5.3)
	if beam > 0.0:
		var warm := Color(1.0, 0.82, 0.55)
		# Halo around the bulb.
		U.radial(_glow, bulb, 150, Color(warm.r, warm.g, warm.b, 0.55 * beam * flicker), Color(warm.r, warm.g, warm.b, 0.0))
		# Cone of light down through the cage.
		var top_y := bulb.y + 6
		var bot_y := 668.0
		var steps := 10
		for i in steps:
			var s0 := float(i) / steps
			var s1 := float(i + 1) / steps
			var y0 := lerpf(top_y, bot_y, s0)
			var y1 := lerpf(top_y, bot_y, s1)
			var w0 := lerpf(92, 240, s0)
			var w1 := lerpf(92, 240, s1)
			var a0 := beam * 0.32 * (1.0 - s0 * 0.6)
			var a1 := beam * 0.32 * (1.0 - s1 * 0.6)
			var ce := Color(warm.r, warm.g, warm.b, a0)
			var ee := Color(warm.r, warm.g, warm.b, 0.0)
			var ce1 := Color(warm.r, warm.g, warm.b, a1)
			U.quad4(_glow, Vector2(bulb.x - w0, y0), Vector2(bulb.x, y0), Vector2(bulb.x, y1), Vector2(bulb.x - w1, y1), ee, ce, ce1, ee)
			U.quad4(_glow, Vector2(bulb.x, y0), Vector2(bulb.x + w0, y0), Vector2(bulb.x + w1, y1), Vector2(bulb.x, y1), ce, ee, ee, ce1)
		# Pool of light on the plant and soil, and a reflection on the floor.
		U.radial(_glow, Vector2(bulb.x, 560), 230, Color(warm.r, warm.g, warm.b, 0.22 * beam), Color(warm.r, warm.g, warm.b, 0.0), 32, 0.9)
		U.radial(_glow, Vector2(bulb.x, 880), 300, Color(warm.r, warm.g, warm.b, 0.12 * beam), Color(warm.r, warm.g, warm.b, 0.0), 32, 0.25)
		# Dust motes in the beam.
		for mo in _motes:
			var p: Vector2 = mo[0]
			var k := 1.0 - absf(p.x - bulb.x) / lerpf(92, 240, (p.y - top_y) / (bot_y - top_y))
			if k > 0.0:
				_glow.draw_circle(p, 1.4, Color(1.0, 0.92, 0.75, 0.6 * k * beam))
	# Heat: an orange wash rising from below, and embers.
	var hot := clampf(t - 2.0, 0.0, 1.0)
	if hot > 0.01:
		U.vgrad_rect(_glow, Rect2(0, 560, 1920, 520), Color(1.0, 0.4, 0.1, 0.0), Color(1.0, 0.4, 0.1, 0.13 * hot))
		for e in _embers:
			_glow.draw_circle(e[0], 1.8, Color(1.0, 0.55, 0.2, 0.7 * hot))
	for f in _flashes:
		var k2: float = f[3] / f[4]
		var col: Color = f[1]
		var r: float = f[2] * (1.4 - 0.4 * k2)
		U.radial(_glow, f[0], r, Color(col.r, col.g, col.b, 0.8 * k2), Color(col.r, col.g, col.b, 0.0))


func _draw_frost() -> void:
	var cold := clampf(1.0 - t, 0.0, 1.0) + clampf(1.0 - absf(t - 1.0), 0.0, 1.0) * 0.25
	if cold <= 0.02:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var col := Color(0.88, 0.95, 1.0, 0.32 * cold)
	# Feathery rime growing inward from the top, left and bottom edges.
	for i in 30:
		var edge := i % 3
		var start: Vector2
		var dir: Vector2
		match edge:
			0:
				start = Vector2(rng.randf_range(0, 1200), 0)
				dir = Vector2(rng.randf_range(-0.4, 0.4), 1).normalized()
			1:
				start = Vector2(0, rng.randf_range(0, 1080))
				dir = Vector2(1, rng.randf_range(-0.4, 0.4)).normalized()
			_:
				start = Vector2(rng.randf_range(0, 1200), 1080)
				dir = Vector2(rng.randf_range(-0.4, 0.4), -1).normalized()
		var length := rng.randf_range(22, 64) * cold
		_crystal(start, dir, length, col, 2)
	_frost.draw_rect(Rect2(0, 0, 1920, 1080), Color(0.85, 0.92, 1.0, 0.04 * cold))



func _crystal(p: Vector2, dir: Vector2, length: float, col: Color, depth: int) -> void:
	var end := p + dir * length
	_frost.draw_line(p, end, col, 1.2)
	if depth <= 0 or length < 12:
		return
	for s in [0.35, 0.65]:
		var q := p.lerp(end, s)
		_crystal(q, dir.rotated(0.7), length * 0.4, col, depth - 1)
		_crystal(q, dir.rotated(-0.7), length * 0.4, col, depth - 1)
