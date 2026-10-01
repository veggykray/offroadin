extends Node2D
## Room-wide atmosphere, layered over the room, plant and fruit but under the machine:
##   Frost      (normal)   frost crystals growing in from the edges, icy fog near the floor
##   Particles  (normal)   ice motes, rising embers, drifting dust
##   Darkness   (multiply) overall room light + temperature tint + vignette
##   Glow       (add)      lamp beam, light pool, flare and bleaching glare, hot-metal glow,
##                         pilot lights, success flashes
##   HeatShimmer (shader)  screen-space heat haze
## The layers are created in code (see _ready) because they are pure presentation.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")
const DrawProxy := preload("res://minigames/polarity_machine/scripts/draw_proxy.gd")
const SHIMMER_SHADER := preload("res://minigames/polarity_machine/shaders/heat_shimmer.gdshader")

const W := 1920.0
const H := 1080.0
const ROOM_W := 1250.0  # visible room left of the machine

@export var lamp_path: NodePath

var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0

var _lamp: Node2D
var _time := 0.0
var _layers: Array[Node2D] = []
var _shimmer: Node2D
var _shimmer_mat: ShaderMaterial
var _flashes: Array[Dictionary] = []
var _frost_segs: Array[Dictionary] = []
var _motes: Array[Vector4] = []  # x, y, speed/size seed, phase


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a


## A soft burst of additive light at a Stage position.
func flash(pos: Vector2, col := Color(1.0, 0.85, 0.5), radius := 300.0, duration := 1.2) -> void:
	_flashes.append({"p": pos, "c": col, "r": radius, "d": duration, "t": 0.0})


func _ready() -> void:
	_lamp = get_node_or_null(lamp_path) as Node2D
	var mul := CanvasItemMaterial.new()
	mul.blend_mode = CanvasItemMaterial.BLEND_MODE_MUL
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_make_layer("Frost", _draw_frost, null)
	_make_layer("Particles", _draw_particles, null)
	_make_layer("Darkness", _draw_darkness, mul)
	_make_layer("Glow", _draw_glow, add)
	_shimmer_mat = ShaderMaterial.new()
	_shimmer_mat.shader = SHIMMER_SHADER
	_shimmer = _make_layer("HeatShimmer", _draw_shimmer_rect, _shimmer_mat)
	_generate()


func _make_layer(layer_name: String, cb: Callable, mat: Material) -> Node2D:
	var n: Node2D = DrawProxy.new()
	n.name = layer_name
	n.material = mat
	n.set("draw_callback", cb)
	add_child(n)
	_layers.append(n)
	return n


func _generate() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 909
	# Frost: branching crystals rooted on the room edges. "th" = how cold it must be to show.
	var roots: Array[Vector2] = []
	for i in 14:
		roots.append(Vector2(0, rng.randf_range(60, 1060)))
	for i in 16:
		roots.append(Vector2(rng.randf_range(0, ROOM_W), 1080))
	for i in 10:
		roots.append(Vector2(rng.randf_range(0, ROOM_W), 40))
	for r in roots:
		var inward := Vector2(1, 0)
		if r.y >= 1079.0:
			inward = Vector2(0, -1)
		elif r.y <= 41.0:
			inward = Vector2(0, 1)
		_grow_frost(rng, r, inward.rotated(rng.randf_range(-0.5, 0.5)), rng.randf_range(40, 90), 0, 0.0)
	for i in 160:
		_motes.append(Vector4(rng.randf_range(0, ROOM_W), rng.randf_range(0, H), rng.randf(), rng.randf_range(0, TAU)))


func _grow_frost(rng: RandomNumberGenerator, p: Vector2, d: Vector2, length: float, depth: int, th: float) -> void:
	if depth > 3 or length < 8.0:
		return
	var q := p + d * length
	_frost_segs.append({"a": p, "b": q, "w": maxf(1.0, 3.0 - float(depth)), "th": th})
	var next_th := th + 0.18
	_grow_frost(rng, q, d.rotated(rng.randf_range(-0.25, 0.25)), length * 0.7, depth + 1, next_th)
	_grow_frost(rng, p.lerp(q, 0.5), d.rotated(0.9 + rng.randf_range(-0.2, 0.2)), length * 0.45, depth + 1, next_th)
	_grow_frost(rng, p.lerp(q, 0.6), d.rotated(-0.9 + rng.randf_range(-0.2, 0.2)), length * 0.45, depth + 1, next_th)


func _process(delta: float) -> void:
	_time += delta
	for f in _flashes:
		f["t"] = float(f["t"]) + delta
	_flashes.assign(_flashes.filter(func(f: Dictionary) -> bool: return float(f["t"]) < float(f["d"])))
	var shimmer := U.key5(temperature_level, [0.0, 0.0, 0.0, 0.0007, 0.0024])
	_shimmer.visible = shimmer > 0.0001
	_shimmer_mat.set_shader_parameter("strength", shimmer)
	for l in _layers:
		l.queue_redraw()


# --- Layers ------------------------------------------------------------------------------------

func _draw_frost(ci: CanvasItem) -> void:
	var frost := U.key5(temperature_level, [1.0, 0.45, 0.0, 0.0, 0.0])
	if frost <= 0.01:
		return
	# Cold breath of the room: pale bands along the edges.
	U.hgrad_rect(ci, Rect2(0, 40, 180, H - 40), Color(0.85, 0.94, 1.0, 0.35 * frost), Color(0.85, 0.94, 1.0, 0.0))
	U.vgrad_rect(ci, Rect2(0, H - 160, ROOM_W, 160), Color(0.85, 0.94, 1.0, 0.0), Color(0.85, 0.94, 1.0, 0.4 * frost))
	U.vgrad_rect(ci, Rect2(0, 40, ROOM_W, 120), Color(0.85, 0.94, 1.0, 0.25 * frost), Color(0.85, 0.94, 1.0, 0.0))
	for s in _frost_segs:
		var k := clampf((frost - float(s["th"])) * 3.0, 0.0, 1.0)
		if k <= 0.0:
			continue
		var a: Vector2 = s["a"]
		var b: Vector2 = s["b"]
		ci.draw_line(a, a.lerp(b, k), Color(0.93, 0.98, 1.0, 0.75 * k), float(s["w"]), true)
	# Icy fog rolling over the floor.
	for i in 7:
		var x := fmod(float(i) * 230.0 + _time * (18.0 + float(i) * 4.0), ROOM_W + 400.0) - 200.0
		var y := 860.0 + float(i % 3) * 60.0 + sin(_time * 0.5 + float(i)) * 10.0
		U.radial(ci, Vector2(x, y), 260.0, Color(0.85, 0.93, 1.0, 0.14 * frost), Color(0.85, 0.93, 1.0, 0.0), 24, 0.22)


func _draw_particles(ci: CanvasItem) -> void:
	var snow := U.key5(temperature_level, [120.0, 40.0, 0.0, 0.0, 0.0])
	var embers := U.key5(temperature_level, [0.0, 0.0, 0.0, 10.0, 80.0])
	var dust := U.key5(age_level, [0.0, 0.0, 8.0, 40.0, 100.0])
	var dust_vis := U.key5(light_level, [0.15, 0.35, 0.55, 0.8, 1.0])
	for i in _motes.size():
		var m := _motes[i]
		if float(i) < snow:
			var y := fmod(m.y + _time * (25.0 + m.z * 35.0), H)
			var x := fmod(m.x + sin(_time * 0.6 + m.w) * 30.0 + _time * 10.0, ROOM_W)
			var r := 1.5 + m.z * 2.5
			var c := Color(0.92, 0.97, 1.0, 0.75)
			ci.draw_line(Vector2(x - r, y), Vector2(x + r, y), c, 1.2)
			ci.draw_line(Vector2(x, y - r), Vector2(x, y + r), c, 1.2)
		if float(i) < embers:
			var life := fmod(m.z + _time * (0.12 + m.z * 0.1), 1.0)
			var y2 := H - life * (H - 60.0)
			var x2 := m.x + sin(_time * 1.3 + m.w) * 24.0
			ci.draw_circle(Vector2(x2, y2), 1.5 + m.z * 2.0, Color(1.0, 0.55 + m.z * 0.3, 0.2, 0.8 * (1.0 - life)))
		if float(i) < dust:
			var x3 := fmod(m.x + sin(_time * 0.21 + m.w) * 60.0 + _time * 4.0, ROOM_W)
			var y3 := fmod(m.y + sin(_time * 0.17 + m.w * 2.0) * 50.0, 760.0) + 40.0
			ci.draw_circle(Vector2(x3, y3), 1.0 + m.z * 1.6, Color(0.9, 0.86, 0.75, 0.5 * dust_vis))


func _draw_darkness(ci: CanvasItem) -> void:
	var m := U.key5(light_level, [0.11, 0.34, 0.68, 0.95, 1.0])
	var tint := U.key5c(temperature_level, [Color(0.7, 0.84, 1.0), Color(0.85, 0.92, 1.0), Color(1, 1, 1),
			Color(1.0, 0.95, 0.86), Color(1.0, 0.8, 0.62)])
	ci.draw_rect(Rect2(0, 0, W, H), Color(m * tint.r, m * tint.g, m * tint.b, 1.0))
	# Vignette (multiplies again): deep in dim light, gentle in bright light.
	var v := U.key5(light_level, [0.5, 0.42, 0.7, 0.86, 0.96])
	U.radial(ci, Vector2(720, 560), 1500.0, Color.WHITE, Color(v, v, v, 1.0), 40)


func _draw_glow(ci: CanvasItem) -> void:
	var black := Color(0, 0, 0, 1)
	if _lamp:
		var open: float = _lamp.call("aperture_open")
		var ap: Vector2 = _lamp.call("aperture_point")
		var dir: Vector2 = _lamp.call("beam_direction")
		var lc: Color = _lamp.call("light_color")
		var inten := U.key5(light_level, [0.0, 0.08, 0.13, 0.19, 0.28])
		var blaze_k := U.key5(light_level, [0.0, 0.0, 0.0, 0.0, 1.0])
		if open > 0.01:
			var side := dir.orthogonal()
			for layer in 3:
				var half := lerpf(0.1, 0.5, open) * (0.55 + 0.3 * float(layer))
				var w0 := (8.0 + open * 60.0) * (0.6 + 0.3 * float(layer))
				var length := 900.0
				var fa := ap + dir.rotated(half) * length
				var fb := ap + dir.rotated(-half) * length
				if fa.dot(side) < fb.dot(side):
					var tmp := fa
					fa = fb
					fb = tmp
				var c0 := U.shade(lc, inten * (0.7 - 0.25 * blaze_k))
				c0.a = 1.0
				U.quad4(ci, ap + side * w0, fa, fb, ap - side * w0, c0, black, black, c0)
			# Pool of light on the plant and floor.
			U.radial(ci, Vector2(780, 600), 260.0 + 200.0 * open, _opaque(U.shade(lc, inten * (1.2 - 0.5 * blaze_k))), black, 32, 0.9)
			U.radial(ci, Vector2(860, 940), 300.0 * open, _opaque(U.shade(lc, inten * 0.8)), black, 28, 0.25)
			# Halo at the aperture.
			U.radial(ci, ap, 40.0 + 130.0 * open, _opaque(U.shade(lc, inten * 1.5)), black, 28)
		# Glare and lens flare at BLAZING, plus a bleaching wash over everything.
		var blaze := U.key5(light_level, [0.0, 0.0, 0.0, 0.0, 1.0])
		if blaze > 0.01:
			ci.draw_rect(Rect2(0, 0, W, H), Color(0.26 * blaze, 0.25 * blaze, 0.21 * blaze, 1.0))
			for k in 10:
				var a := float(k) * TAU / 10.0 + _time * 0.05
				var dvec := Vector2(cos(a), sin(a))
				var ln := (360.0 + 160.0 * float(k % 2)) * blaze
				var s2 := dvec.orthogonal() * 5.0
				U.quad4(ci, ap + s2, ap + dvec * ln, ap + dvec * ln, ap - s2, Color(0.3 * blaze, 0.3 * blaze, 0.27 * blaze, 1), black, black, Color(0.3 * blaze, 0.3 * blaze, 0.27 * blaze, 1))
			var flare_axis := (Vector2(960, 540) - ap)
			for k in 4:
				var fp := ap + flare_axis * (0.5 + float(k) * 0.45)
				U.radial(ci, fp, 30.0 + float(k) * 22.0, Color(0.18 * blaze, 0.14 * blaze, 0.08 * blaze, 1), black, 20)
			U.radial(ci, ap, 240.0, Color(0.3 * blaze, 0.3 * blaze, 0.27 * blaze, 1), black, 32)
		# Pilot light on the lamp: always visible, a landmark in the dark.
		var pp: Vector2 = _lamp.call("pilot_point")
		U.radial(ci, pp, 22.0, Color(0.55, 0.08, 0.04, 1), black, 14)

	# Hot metal and air at WARM / SCORCHING.
	var hot := U.key5(temperature_level, [0.0, 0.0, 0.0, 0.1, 1.0])
	if hot > 0.01:
		var hc := Color(0.35 * hot, 0.12 * hot, 0.03 * hot, 1)
		U.vgrad_rect(ci, Rect2(0, H - 260, ROOM_W, 260), black, hc)
		for wdt in [44.0, 24.0, 10.0]:
			var k2: float = 0.25 * hot * (50.0 / float(wdt))
			var pc := Color(0.35 * k2, 0.11 * k2, 0.02 * k2, 1)
			ci.draw_line(Vector2(570, 62), Vector2(1480, 62), pc, wdt)
			ci.draw_line(Vector2(745, 880), Vector2(1250, 880), pc, wdt)
	# Warm cast near the floor at WARM; cold blue gleam at FREEZING.
	var warm := U.key5(temperature_level, [0.0, 0.0, 0.0, 1.0, 0.0])
	if warm > 0.01:
		U.vgrad_rect(ci, Rect2(0, 600, ROOM_W, 480), black, Color(0.08 * warm, 0.04 * warm, 0.0, 1))

	# Flashes (growth, success).
	for f in _flashes:
		var k := float(f["t"]) / float(f["d"])
		var env := sin(k * PI)
		var c: Color = f["c"]
		var r := float(f["r"]) * (0.6 + 0.6 * k)
		U.radial(ci, f["p"], r, Color(c.r * env * 0.6, c.g * env * 0.6, c.b * env * 0.6, 1), black, 32)
		ci.draw_arc(f["p"], r * 1.2, 0.0, TAU, 64, Color(c.r * env * 0.5, c.g * env * 0.5, c.b * env * 0.5, 1), 4.0, true)


func _draw_shimmer_rect(ci: CanvasItem) -> void:
	ci.draw_rect(Rect2(0, 0, ROOM_W + 20.0, H), Color.WHITE)


func _opaque(c: Color) -> Color:
	return Color(c.r, c.g, c.b, 1.0)
