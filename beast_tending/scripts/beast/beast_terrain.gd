extends Node2D
## The near surface of the beast: one continuous hide polygon spanning the
## whole world, rendered with shaders/skin.gdshader. Owns the glow ripples.

const SKIN_SHADER := preload("res://shaders/skin.gdshader")
const MAX_RIPPLES := 6

var poly: Polygon2D
var mat: ShaderMaterial
var ripples: Array = []  # Vector4(x, y, start_time, strength)
var glow_amount := 0.0
var glow_target := 0.0
var flush := 0.0
var flush_target := 0.0
var tension := 0.0
var time := 0.0


func _ready() -> void:
	Game.terrain = self
	z_index = -5
	poly = Polygon2D.new()
	var pts := PackedVector2Array()
	var x := -700.0
	while x <= Game.WORLD_WIDTH + 700.0:
		pts.append(Vector2(x, Game.surface_y(x)))
		x += 30.0
	pts.append(Vector2(Game.WORLD_WIDTH + 700.0, 1900.0))
	pts.append(Vector2(-700.0, 1900.0))
	poly.polygon = pts
	mat = ShaderMaterial.new()
	mat.shader = SKIN_SHADER
	mat.set_shader_parameter("surface_base", Game.SURFACE_BASE)
	for i in range(3):
		mat.set_shader_parameter("wave%d" % i, Game.SURFACE_WAVES[i])
	poly.material = mat
	add_child(poly)
	for i in range(MAX_RIPPLES):
		ripples.append(Vector4(0, 0, -100, 0))


func add_ripple(world_pos: Vector2, strength: float) -> void:
	var lp := to_local(world_pos)
	# Replace the oldest ripple.
	var oldest := 0
	for i in range(MAX_RIPPLES):
		if ripples[i].z < ripples[oldest].z:
			oldest = i
	ripples[oldest] = Vector4(lp.x, lp.y, time, strength)


func _process(delta: float) -> void:
	time += delta
	glow_amount = Game.damp(glow_amount, glow_target, 1.2, delta)
	var pleasure: float = Game.mind.pleasure if Game.mind else 0.0
	flush = Game.damp(flush, maxf(flush_target, pleasure * 0.6), 0.8, delta)
	tension = Game.damp(tension, 0.0, 1.5, delta)
	mat.set_shader_parameter("u_time", time)
	mat.set_shader_parameter("glow_amount", glow_amount)
	mat.set_shader_parameter("flush", flush)
	mat.set_shader_parameter("tension", tension)
	for i in range(MAX_RIPPLES):
		mat.set_shader_parameter("ripple%d" % i, ripples[i])
