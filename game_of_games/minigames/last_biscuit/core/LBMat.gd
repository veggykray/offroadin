class_name LBMat
extends RefCounted
## Shared placeholder materials. Cached so dozens of props share a handful of
## materials (cheap to render, easy to restyle in one place).

const SHADER_DIR := "res://minigames/last_biscuit/shaders/"

static var _c := {}


static func std(key: String, col: Color, metallic := 0.0, rough := 0.6, extra := {}) -> StandardMaterial3D:
	var k := "std_" + key
	if _c.has(k):
		return _c[k]
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.metallic = metallic
	m.roughness = rough
	for p in extra:
		m.set(p, extra[p])
	_c[k] = m
	return m


static func shader(key: String, file: String, params := {}) -> ShaderMaterial:
	var k := "sh_" + key
	if _c.has(k):
		return _c[k]
	var m := ShaderMaterial.new()
	m.shader = load(SHADER_DIR + file)
	for p in params:
		m.set_shader_parameter(p, params[p])
	_c[k] = m
	return m


## Unique (uncached) shader material for per-instance animated parameters.
static func shader_unique(file: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(SHADER_DIR + file)
	for p in params:
		m.set_shader_parameter(p, params[p])
	return m


static func silver() -> StandardMaterial3D:
	return std("silver", Color(0.86, 0.85, 0.82), 1.0, 0.16)


static func tarnished_silver() -> StandardMaterial3D:
	return std("tsilver", Color(0.62, 0.6, 0.55), 1.0, 0.32)


static func gold() -> StandardMaterial3D:
	return std("gold", Color(0.88, 0.66, 0.3), 1.0, 0.28)


static func porcelain() -> StandardMaterial3D:
	return std("porcelain", Color(0.93, 0.91, 0.86), 0.0, 0.12, {"clearcoat_enabled": true, "clearcoat": 0.6})


static func porcelain_blue() -> StandardMaterial3D:
	return std("porcelain_b", Color(0.26, 0.36, 0.62), 0.0, 0.15)


static func dark_wood() -> StandardMaterial3D:
	return std("dwood", Color(0.12, 0.05, 0.025), 0.0, 0.35)


static func velvet(col := Color(0.32, 0.04, 0.06)) -> StandardMaterial3D:
	return std("velvet_%s" % col.to_html(), col, 0.0, 0.85, {"rim_enabled": true, "rim": 0.6, "rim_tint": 0.7})


static func cloth(col: Color, rough := 0.85) -> StandardMaterial3D:
	return std("cloth_%s" % col.to_html(), col, 0.0, rough, {"rim_enabled": true, "rim": 0.25, "rim_tint": 0.5})


static func wax() -> StandardMaterial3D:
	return std("wax", Color(0.93, 0.89, 0.78), 0.0, 0.5, {"subsurf_scatter_enabled": true, "subsurf_scatter_strength": 0.6})


static func glass(col: Color) -> StandardMaterial3D:
	return std("glass_%s" % col.to_html(), col, 0.0, 0.05, {
		"transparency": BaseMaterial3D.TRANSPARENCY_ALPHA,
		"specular_mode": BaseMaterial3D.SPECULAR_SCHLICK_GGX,
		"rim_enabled": true, "rim": 0.5})


static func flame(seed := 0.0) -> ShaderMaterial:
	return shader_unique("flame.gdshader", {"seed": seed})


static func skin(col: Color, seed := 0.0) -> ShaderMaterial:
	return shader("skin_%s_%f" % [col.to_html(), seed], "skin.gdshader", {"skin": col, "seed": seed})


static func eye_white() -> StandardMaterial3D:
	return std("eyewhite", Color(0.95, 0.93, 0.86), 0.0, 0.15)


static func pupil() -> StandardMaterial3D:
	return std("pupil", Color(0.03, 0.025, 0.02), 0.0, 0.1)


static func hair(col: Color) -> StandardMaterial3D:
	return std("hair_%s" % col.to_html(), col, 0.0, 0.75, {"rim_enabled": true, "rim": 0.8, "rim_tint": 0.3})


static func unshaded(col: Color, key: String) -> StandardMaterial3D:
	return std("unsh_" + key, col, 0.0, 1.0, {
		"shading_mode": BaseMaterial3D.SHADING_MODE_UNSHADED,
		"transparency": BaseMaterial3D.TRANSPARENCY_ALPHA,
		"no_depth_test": false,
		"vertex_color_use_as_albedo": true})
