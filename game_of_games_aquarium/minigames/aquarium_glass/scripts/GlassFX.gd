extends Node2D

const AqDraw = preload("AqDraw.gd")
## Everything that lives ON the glass: vibration ripples (a real refraction
## shader that bends the water behind), ring highlights, rub smears /
## condensation, scratch marks, Sucker imprints, fixed reflections and a faint
## fingertip reflection where the pointer hovers.

const DistortShader = preload("../shaders/glass_distort.gdshader")
const MAX_RIPPLES := 8

## Turn off if a target platform struggles with screen-reading shaders.
@export var use_refraction := true

var activity: Node
var ripples: Array = []   # {p, age, s, r}
var smears: Array = []    # {p, life, r}
var scratches: Array = [] # {a, b, life}
var smudges: Array = []   # {p, r, life}
var _distort: ColorRect
var _mat: ShaderMaterial
var _t := 0.0
var _tremble := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = 60
	var g: Rect2 = activity.glass_rect
	_distort = ColorRect.new()
	_distort.position = g.position
	_distort.size = g.size
	_distort.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_distort.show_behind_parent = true
	_mat = ShaderMaterial.new()
	_mat.shader = DistortShader
	_mat.set_shader_parameter("rect_size", g.size)
	_distort.material = _mat
	_distort.visible = false
	add_child(_distort)


func add_ripple(pos: Vector2, strength: float, radius: float) -> void:
	ripples.append({"p": pos, "age": 0.0, "s": strength, "r": radius})
	while ripples.size() > MAX_RIPPLES:
		ripples.pop_front()


func add_smear(pos: Vector2) -> void:
	if smears.size() > 0 and (smears[-1].p as Vector2).distance_to(pos) < 10.0:
		smears[-1].life = 1.0
		return
	smears.append({"p": pos, "life": 1.0, "r": randf_range(14, 22)})
	if smears.size() > 140:
		smears.pop_front()


func add_scratch(pos: Vector2) -> void:
	for i in 2:
		var a := pos + Vector2(randf_range(-30, 30), randf_range(-30, 30))
		var d := Vector2.from_angle(randf() * TAU) * randf_range(8, 22)
		scratches.append({"a": a, "b": a + d, "life": 1.0})
	while scratches.size() > 80:
		scratches.pop_front()


func add_smudge(pos: Vector2, r: float) -> void:
	smudges.append({"p": pos, "r": r, "life": 1.0})
	if smudges.size() > 12:
		smudges.pop_front()


func set_tremble(v: float) -> void:
	_tremble = v


func tick(delta: float) -> void:
	_t += delta
	for i in range(ripples.size() - 1, -1, -1):
		ripples[i].age += delta
		if ripples[i].age > 1.6:
			ripples.remove_at(i)
	for i in range(smears.size() - 1, -1, -1):
		smears[i].life -= delta / 7.0
		if smears[i].life <= 0.0:
			smears.remove_at(i)
	for i in range(scratches.size() - 1, -1, -1):
		scratches[i].life -= delta / 1.6
		if scratches[i].life <= 0.0:
			scratches.remove_at(i)
	for i in range(smudges.size() - 1, -1, -1):
		smudges[i].life -= delta / 12.0
		if smudges[i].life <= 0.0:
			smudges.remove_at(i)
	_update_shader()
	queue_redraw()


func _update_shader() -> void:
	var active := use_refraction and (ripples.size() > 0 or _tremble > 0.01)
	_distort.visible = active
	if not active:
		return
	var g: Rect2 = activity.glass_rect
	var data: Array = []
	var radii: Array = []
	for i in MAX_RIPPLES:
		if i < ripples.size():
			var r = ripples[i]
			var uv: Vector2 = ((r.p as Vector2) - g.position) / g.size
			data.append(Vector4(uv.x, uv.y, r.age, r.s))
			radii.append(r.r)
		else:
			data.append(Vector4(0, 0, 0, 0))
			radii.append(0.0)
	_mat.set_shader_parameter("ripples", data)
	_mat.set_shader_parameter("ripple_radius", PackedFloat32Array(radii))
	# Rect UV delta -> screen UV delta (works under any camera zoom / viewport size).
	var xf := _distort.get_global_transform_with_canvas()
	var vp := get_viewport_rect().size
	var screen_size := Vector2(xf.get_scale().x * g.size.x, xf.get_scale().y * g.size.y)
	_mat.set_shader_parameter("rect_to_screen", screen_size / vp)
	_mat.set_shader_parameter("tremble", _tremble)


func _draw() -> void:
	var g: Rect2 = activity.glass_rect
	# Smudges where the Sucker was stuck.
	for s in smudges:
		draw_circle(s.p, s.r, Color(0.85, 0.95, 1.0, 0.05 * s.life))
		draw_arc(s.p, s.r * 0.8, 0, TAU, 24, Color(0.9, 1.0, 1.0, 0.07 * s.life), 3.0)
	# Rub smears (a slightly foggy trail, like a fingertip on cold glass).
	for s in smears:
		draw_circle(s.p, s.r, Color(0.8, 0.92, 0.95, 0.06 * s.life))
		draw_circle(s.p + Vector2(-3, -3), s.r * 0.5, Color(1, 1, 1, 0.05 * s.life))
	# Scratch marks.
	for s in scratches:
		draw_line(s.a, s.b, Color(1, 1, 1, 0.35 * s.life), 1.2)
	# Ripple ring highlights.
	for r in ripples:
		var rad: float = minf(r.age * 900.0, r.r)
		var a: float = clampf(1.0 - r.age / 0.9, 0.0, 1.0) * clampf(r.s, 0.0, 1.5) * 0.35
		if a > 0.01:
			draw_arc(r.p, rad, 0, TAU, 48, Color(0.85, 1.0, 1.0, a), 2.0)
			if rad > 20.0:
				draw_arc(r.p, rad * 0.7, 0, TAU, 40, Color(0.85, 1.0, 1.0, a * 0.5), 1.0)
	# Fixed reflections: a couple of soft diagonal streaks and a top highlight.
	var refl := Color(1, 1, 1, 0.035)
	for k in 3:
		var x0 := g.position.x + g.size.x * (0.12 + k * 0.31)
		var w := 60.0 + k * 40.0
		AqDraw.poly(self, PackedVector2Array([
			Vector2(x0, g.position.y), Vector2(x0 + w, g.position.y),
			Vector2(x0 + w - g.size.y * 0.45, g.end.y), Vector2(x0 - g.size.y * 0.45, g.end.y)]), refl)
	draw_rect(Rect2(g.position, Vector2(g.size.x, 6)), Color(1, 1, 1, 0.06))
	# The pointer's reflection: a faint fingertip approaching the glass.
	var surf = activity.surface
	if surf and surf.enabled and surf.pointer_inside:
		var pp: Vector2 = surf.pointer_pos
		draw_circle(pp, 16.0, Color(1, 0.95, 0.9, 0.035))
		draw_circle(pp, 8.0, Color(1, 0.95, 0.9, 0.04))
