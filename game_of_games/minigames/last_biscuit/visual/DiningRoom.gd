class_name LBDiningRoom
extends Node3D
## Builds the grand, decaying dining room: environment, lighting, the absurdly
## long table, chandeliers, windows with cold light shafts, portraits, a
## grandfather clock and drifting dust. Pure set dressing - no gameplay.

@export var window_light_energy := 0.55
@export var chandelier_energy := 2.6
@export var volumetric_fog := true

var portrait_mats: Array[ShaderMaterial] = []
var pendulum: Node3D
var chandelier: Node3D
var _t := 0.0


func build() -> void:
	_environment()
	_floor_and_walls()
	_table()
	_chandeliers()
	_windows()
	_portraits()
	_clock()
	_sideboard()
	_dust()


func _environment() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.012, 0.01, 0.01)
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	sm.shader = load(LBMat.SHADER_DIR + "room_sky.gdshader")
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.32, 0.24, 0.2)
	env.ambient_light_energy = 0.32
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.tonemap_white = 6.0
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_bloom = 0.06
	env.glow_hdr_threshold = 1.1
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.ssao_enabled = true
	env.ssao_radius = 0.6
	env.ssao_intensity = 1.6
	env.fog_enabled = true
	env.fog_light_color = Color(0.05, 0.045, 0.05)
	env.fog_density = 0.018
	env.fog_aerial_perspective = 0.2
	if volumetric_fog:
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = 0.012
		env.volumetric_fog_albedo = Color(0.9, 0.85, 0.8)
		env.volumetric_fog_length = 24.0
		env.volumetric_fog_anisotropy = 0.5
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 0.9
	we.environment = env
	add_child(we)


func _floor_and_walls() -> void:
	var floor_mi := LBMesh.add(self, LBMesh.box_mesh(Vector3(10.0, 0.1, 22.0)), LBMat.shader("floor", "floor.gdshader"), Vector3(0, -0.05, -1.0))
	floor_mi.name = "Floor"
	# a threadbare rug under the table
	LBMesh.add(self, LBMesh.box_mesh(Vector3(4.4, 0.01, 16.0)), LBMat.shader("rug", "linen.gdshader", {
			"cloth": Color(0.22, 0.05, 0.05), "thread": Color(0.45, 0.32, 0.12), "repeat": Vector2(3.0, 12.0), "lace_edge": 0.04, "stain": 0.8}), Vector3(0, 0.006, -1.0))
	var wp := LBMat.shader("wallpaper", "wallpaper.gdshader")
	var wood := LBMat.dark_wood()
	var H := 5.2
	for s in [-1.0, 1.0]:
		LBMesh.add(self, LBMesh.box_mesh(Vector3(0.2, H, 22.0)), wp, Vector3(4.3 * s, H * 0.5, -1.0))
		LBMesh.add(self, LBMesh.box_mesh(Vector3(0.08, 1.1, 22.0)), wood, Vector3(4.17 * s, 0.55, -1.0))
		LBMesh.add(self, LBMesh.box_mesh(Vector3(0.12, 0.08, 22.0)), LBMat.gold(), Vector3(4.15 * s, 1.12, -1.0))
		LBMesh.add(self, LBMesh.box_mesh(Vector3(0.16, 0.25, 22.0)), wood, Vector3(4.14 * s, H - 0.12, -1.0))
	# far wall and the wall behind Bill (mostly unseen)
	LBMesh.add(self, LBMesh.box_mesh(Vector3(8.8, H, 0.2)), wp, Vector3(0, H * 0.5, -10.0))
	LBMesh.add(self, LBMesh.box_mesh(Vector3(8.8, 1.1, 0.08)), wood, Vector3(0, 0.55, -9.87))
	LBMesh.add(self, LBMesh.box_mesh(Vector3(8.8, H, 0.2)), wp, Vector3(0, H * 0.5, 9.6))
	# coffered ceiling
	LBMesh.add(self, LBMesh.box_mesh(Vector3(8.8, 0.2, 22.0)), wood, Vector3(0, H, -1.0))
	for i in 10:
		LBMesh.add(self, LBMesh.box_mesh(Vector3(8.6, 0.25, 0.18)), wood, Vector3(0, H - 0.2, -9.5 + i * 2.0))


func _table() -> void:
	var t := LBMesh.pivot(self, Vector3.ZERO, "Table")
	var hw := LBConst.TABLE_HALF_W
	var hl := LBConst.TABLE_DRAW_HALF_L
	var top_y := LBConst.TABLE_Y
	var wood := LBMat.shader("table", "table_wood.gdshader")
	LBMesh.add(t, LBMesh.box_mesh(Vector3(hw * 2.0 + 0.1, 0.07, hl * 2.0)), wood, Vector3(0, top_y - 0.035, 0))
	var edge := LBMat.dark_wood()
	for s in [-1.0, 1.0]:
		LBMesh.add(t, LBMesh.cyl_mesh(0.045, 0.045, hl * 2.0, 12), edge, Vector3((hw + 0.05) * s, top_y - 0.05, 0), Vector3(90, 0, 0))
		LBMesh.add(t, LBMesh.box_mesh(Vector3(0.05, 0.12, hl * 2.0 - 0.2)), edge, Vector3((hw - 0.05) * s, top_y - 0.13, 0))
	# carved legs
	for z in range(-6, 7, 3):
		for s in [-1.0, 1.0]:
			var leg := LBMesh.pivot(t, Vector3((hw - 0.12) * s, 0, float(z)))
			LBMesh.add(leg, LBMesh.cyl_mesh(0.05, 0.09, 0.55, 14), edge, Vector3(0, 0.38, 0))
			LBMesh.add(leg, LBMesh.sphere_mesh(0.1, 14), edge, Vector3(0, 0.15, 0))
			LBMesh.add(leg, LBMesh.cyl_mesh(0.07, 0.05, 0.1, 12), edge, Vector3(0, 0.05, 0))
	# embroidered runner down the middle
	var runner := LBMesh.add(t, LBMesh.quad_mesh(Vector2(0.62, hl * 2.0 - 0.4)), LBMat.shader("runner", "linen.gdshader", {
			"repeat": Vector2(2.0, 28.0), "lace_edge": 0.09, "stain": 0.5}), Vector3(0, top_y + 0.002, 0), Vector3(-90, 0, 0), Vector3.ONE, false)
	runner.name = "Runner"


func _chandelier(pos: Vector3, scale_: float, energy: float, shadows: bool) -> Node3D:
	var c := LBMesh.pivot(self, pos, "Chandelier")
	var g := LBMat.gold()
	LBMesh.add(c, LBMesh.cyl_mesh(0.012, 0.012, 3.0, 6), LBMat.std("chain", Color(0.2, 0.17, 0.1), 0.8, 0.5), Vector3(0, 1.5, 0))
	LBMesh.add(c, LBMesh.sphere_mesh(0.12 * scale_, 16), g, Vector3(0, 0.0, 0), Vector3.ZERO, Vector3(1, 1.6, 1))
	var crystal := LBMat.glass(Color(0.95, 0.95, 1.0, 0.5))
	for ring in [[0.55, -0.05, 10], [0.35, 0.25, 6]]:
		var r: float = ring[0] * scale_
		var y: float = ring[1] * scale_
		var n: int = ring[2]
		LBMesh.add(c, LBMesh.torus_mesh(r - 0.015, r + 0.015, 32, 6), g, Vector3(0, y, 0))
		for i in n:
			var a := TAU * i / n
			var p := Vector3(cos(a) * r, y, sin(a) * r)
			LBMesh.add(c, LBMesh.cyl_mesh(0.025, 0.02, 0.04, 10), g, p + Vector3(0, 0.02, 0))
			LBMesh.add(c, LBMesh.cyl_mesh(0.013, 0.013, 0.12, 8), LBMat.wax(), p + Vector3(0, 0.1, 0))
			LBProps._flame(c, p + Vector3(0, 0.16, 0), float(i) + y * 10.0)
			for k in 3:
				LBMesh.add(c, LBMesh.prism_mesh(Vector3(0.02, 0.05, 0.02)), crystal, p + Vector3(0, -0.06 - k * 0.055, 0), Vector3(180, a * 30.0, 0), Vector3.ONE, false)
		# swags of crystal beads
		for i in n:
			var a := TAU * (i + 0.5) / n
			for k in 5:
				var u := float(k) / 4.0
				LBMesh.add(c, LBMesh.sphere_mesh(0.012, 6), crystal, Vector3(cos(a) * r * 0.97, y - sin(u * PI) * 0.09, sin(a) * r * 0.97), Vector3.ZERO, Vector3.ONE, false)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.72, 0.42)
	l.light_energy = energy
	l.omni_range = 8.0
	l.omni_attenuation = 1.3
	l.shadow_enabled = shadows
	l.shadow_blur = 2.0
	l.light_volumetric_fog_energy = 0.6
	l.position = Vector3(0, 0.15, 0)
	l.set_script(load("res://minigames/last_biscuit/visual/Flicker.gd"))
	c.add_child(l)
	return c


func _chandeliers() -> void:
	chandelier = _chandelier(Vector3(0, 2.75, 0.4), 1.0, chandelier_energy, true)
	_chandelier(Vector3(0, 2.85, -5.4), 0.85, chandelier_energy * 0.55, false)
	# a weak warm bounce from the table candles towards Bill's end
	var fill := OmniLight3D.new()
	fill.light_color = Color(1.0, 0.6, 0.35)
	fill.light_energy = 0.8
	fill.omni_range = 4.5
	fill.position = Vector3(0, 1.4, 3.8)
	fill.shadow_enabled = false
	add_child(fill)


func _windows() -> void:
	var frame := LBMat.dark_wood()
	var pane := StandardMaterial3D.new()
	pane.albedo_color = Color(0.08, 0.1, 0.14)
	pane.emission_enabled = true
	pane.emission = Color(0.45, 0.58, 0.85)
	pane.emission_energy_multiplier = 1.6
	var curtain := LBMat.velvet(Color(0.28, 0.04, 0.05))
	# tall windows on the left wall, cold daylight raking across the table
	for z in [-1.4, -6.0]:
		var w := LBMesh.pivot(self, Vector3(-4.19, 2.4, z), "Window")
		LBMesh.add(w, LBMesh.box_mesh(Vector3(0.04, 2.6, 1.2)), pane, Vector3.ZERO)
		for k in 3:
			LBMesh.add(w, LBMesh.box_mesh(Vector3(0.06, 0.05, 1.24)), frame, Vector3(0.02, -1.3 + k * 1.3, 0))
		LBMesh.add(w, LBMesh.box_mesh(Vector3(0.06, 2.64, 0.05)), frame, Vector3(0.02, 0, 0))
		for s in [-1.0, 1.0]:
			LBMesh.add(w, LBMesh.box_mesh(Vector3(0.06, 2.64, 0.06)), frame, Vector3(0.02, 0, 0.6 * s))
			LBMesh.add(w, LBMesh.box_mesh(Vector3(0.12, 3.2, 0.38)), curtain, Vector3(0.1, 0.1, 0.78 * s))
		# the light shaft: a long additive slab angled down onto the table
		var shaft := MeshInstance3D.new()
		shaft.mesh = LBMesh.box_mesh(Vector3(1.0, 0.01, 1.0))
		shaft.material_override = LBMat.shader("shaft", "light_shaft.gdshader")
		shaft.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(shaft)
		shaft.global_transform = Transform3D(Basis.IDENTITY, Vector3(-2.2, 1.7, z + 0.3))
		shaft.mesh = LBMesh.quad_mesh(Vector2(4.6, 1.1))
		shaft.rotation = Vector3(0, 0, deg_to_rad(-28.0))
		var shaft2 := shaft.duplicate() as MeshInstance3D
		add_child(shaft2)
		shaft2.global_transform = shaft.global_transform
		shaft2.rotate_object_local(Vector3(1, 0, 0), PI * 0.5)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(0.55, 0.68, 0.95)
	sun.light_energy = window_light_energy
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 22.0
	sun.light_volumetric_fog_energy = 2.0
	sun.rotation = Vector3(deg_to_rad(-34.0), deg_to_rad(-80.0), 0.0)
	add_child(sun)
	# tall arched window at the far end, glowing through the gloom
	var fw := LBMesh.pivot(self, Vector3(0, 2.6, -9.88), "FarWindow")
	LBMesh.add(fw, LBMesh.box_mesh(Vector3(1.8, 3.4, 0.04)), pane, Vector3.ZERO)
	LBMesh.add(fw, LBMesh.cyl_mesh(0.9, 0.9, 0.04, 24), pane, Vector3(0, 1.7, 0), Vector3(90, 0, 0), Vector3(1, 1, 1))
	for x in [-0.6, 0.0, 0.6]:
		LBMesh.add(fw, LBMesh.box_mesh(Vector3(0.05, 4.2, 0.06)), frame, Vector3(x, 0.4, 0.03))
	for y in [-1.0, 0.0, 1.0]:
		LBMesh.add(fw, LBMesh.box_mesh(Vector3(1.85, 0.05, 0.06)), frame, Vector3(0, y, 0.03))
	for s in [-1.0, 1.0]:
		LBMesh.add(fw, LBMesh.box_mesh(Vector3(0.7, 4.6, 0.15)), curtain, Vector3(1.15 * s, 0.4, 0.1))
	var spot := SpotLight3D.new()
	spot.light_color = Color(0.5, 0.62, 0.9)
	spot.light_energy = 3.0
	spot.spot_range = 14.0
	spot.spot_angle = 22.0
	spot.light_volumetric_fog_energy = 3.0
	spot.position = Vector3(0, 3.6, -9.6)
	spot.rotation = Vector3(deg_to_rad(-22.0), 0, 0)
	add_child(spot)


func _portraits() -> void:
	var specs := [
		[Vector3(4.18, 2.5, -1.0), Color(0.12, 0.06, 0.05), Color(0.62, 0.48, 0.36), 0.17, 0.24],
		[Vector3(4.18, 2.6, 2.6), Color(0.05, 0.08, 0.06), Color(0.7, 0.55, 0.45), 0.2, 0.2],
		[Vector3(4.18, 2.4, -4.8), Color(0.1, 0.04, 0.08), Color(0.55, 0.45, 0.38), 0.14, 0.26],
		[Vector3(-1.9, 2.7, -9.85), Color(0.06, 0.05, 0.1), Color(0.6, 0.5, 0.42), 0.18, 0.22],
		[Vector3(1.9, 2.7, -9.85), Color(0.1, 0.07, 0.03), Color(0.66, 0.5, 0.4), 0.16, 0.2],
	]
	var i := 0
	for s in specs:
		var pos: Vector3 = s[0]
		var p := LBMesh.pivot(self, pos, "Portrait%d" % i)
		var facing_x := absf(pos.x) > 4.0
		p.rotation.y = -PI * 0.5 if facing_x else 0.0
		var mat := LBMat.shader_unique("portrait.gdshader", {"bg": s[1], "face": s[2], "head_w": s[3], "head_h": s[4], "seed": float(i) * 3.3, "coat": Color(0.08, 0.06, 0.05)})
		portrait_mats.append(mat)
		LBMesh.add(p, LBMesh.quad_mesh(Vector2(1.0, 1.3)), mat, Vector3(0, 0, 0.03))
		var g := LBMat.gold()
		for e in [[Vector3(0, 0.7, 0.04), Vector3(1.2, 0.1, 0.08)], [Vector3(0, -0.7, 0.04), Vector3(1.2, 0.1, 0.08)],
				[Vector3(0.55, 0, 0.04), Vector3(0.1, 1.5, 0.08)], [Vector3(-0.55, 0, 0.04), Vector3(0.1, 1.5, 0.08)]]:
			LBMesh.add(p, LBMesh.box_mesh(e[1]), g, e[0])
		# picture lamp
		var lamp := SpotLight3D.new()
		lamp.light_color = Color(1.0, 0.75, 0.45)
		lamp.light_energy = 0.7
		lamp.spot_range = 2.0
		lamp.spot_angle = 40.0
		lamp.position = Vector3(0, 1.0, 0.5)
		lamp.rotation = Vector3(deg_to_rad(-60.0), 0, 0)
		p.add_child(lamp)
		i += 1


func _clock() -> void:
	var c := LBMesh.pivot(self, Vector3(-3.7, 0, -8.8), "GrandfatherClock")
	var wood := LBMat.dark_wood()
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.6, 2.3, 0.4)), wood, Vector3(0, 1.15, 0))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.7, 0.5, 0.45)), wood, Vector3(0, 2.45, 0))
	LBMesh.add(c, LBMesh.cyl_mesh(0.2, 0.2, 0.02, 24), LBMat.porcelain(), Vector3(0, 2.45, 0.23), Vector3(90, 0, 0))
	LBMesh.add(c, LBMesh.torus_mesh(0.19, 0.22, 24, 4), LBMat.gold(), Vector3(0, 2.45, 0.24), Vector3(90, 0, 0))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.01, 0.15, 0.01)), LBMat.pupil(), Vector3(0, 2.5, 0.25))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.12, 0.01, 0.01)), LBMat.pupil(), Vector3(0.05, 2.45, 0.25))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.36, 1.2, 0.02)), LBMat.glass(Color(0.2, 0.15, 0.1, 0.4)), Vector3(0, 1.4, 0.21))
	pendulum = LBMesh.pivot(c, Vector3(0, 2.0, 0.12))
	LBMesh.add(pendulum, LBMesh.box_mesh(Vector3(0.015, 0.8, 0.01)), LBMat.gold(), Vector3(0, -0.4, 0))
	LBMesh.add(pendulum, LBMesh.cyl_mesh(0.08, 0.08, 0.02, 20), LBMat.gold(), Vector3(0, -0.82, 0), Vector3(90, 0, 0))
	c.rotation.y = deg_to_rad(30.0)


func _sideboard() -> void:
	var s := LBMesh.pivot(self, Vector3(3.85, 0, -2.0), "Sideboard")
	var wood := LBMat.dark_wood()
	LBMesh.add(s, LBMesh.box_mesh(Vector3(0.5, 0.9, 2.6)), wood, Vector3(0, 0.45, 0))
	LBMesh.add(s, LBMesh.box_mesh(Vector3(0.55, 0.04, 2.7)), wood, Vector3(0, 0.92, 0))
	var dish := LBMesh.pivot(s, Vector3(0, 0.94, 0.6))
	LBMesh.add(dish, LBMesh.hemi_mesh(0.2, 20), LBMat.tarnished_silver(), Vector3.ZERO, Vector3.ZERO, Vector3(1, 1.2, 1))
	var cand := LBMesh.pivot(s, Vector3(0, 0.94, -0.5))
	LBMesh.add(cand, LBMesh.cyl_mesh(0.02, 0.06, 0.4, 12), LBMat.tarnished_silver(), Vector3(0, 0.2, 0))
	LBMesh.add(cand, LBMesh.cyl_mesh(0.014, 0.014, 0.18, 8), LBMat.wax(), Vector3(0, 0.49, 0))
	LBProps._flame(cand, Vector3(0, 0.58, 0), 7.0, true, 0.5)
	for i in 4:
		LBMesh.add(s, LBMesh.cyl_mesh(0.035, 0.03, 0.22 + i * 0.03, 12), LBMat.glass(Color(0.3, 0.2, 0.1, 0.7)), Vector3(0, 1.05 + i * 0.015, -1.0 + i * 0.12))


func _dust() -> void:
	var p := CPUParticles3D.new()
	p.amount = 260
	p.lifetime = 14.0
	p.preprocess = 14.0
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(3.0, 1.4, 8.0)
	p.position = Vector3(0, 1.8, -0.5)
	p.direction = Vector3(0.3, -0.2, 0)
	p.spread = 180.0
	p.gravity = Vector3(0, -0.004, 0)
	p.initial_velocity_min = 0.005
	p.initial_velocity_max = 0.03
	p.scale_amount_min = 0.4
	p.scale_amount_max = 1.0
	var q := QuadMesh.new()
	q.size = Vector2(0.008, 0.008)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.92, 0.8, 0.35)
	m.albedo_texture = LBHandVisual._blob_texture()
	q.material = m
	p.mesh = q
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)


func _process(dt: float) -> void:
	_t += dt
	if pendulum:
		pendulum.rotation.z = sin(_t * PI) * 0.12
	if chandelier:
		chandelier.rotation.y = sin(_t * 0.15) * 0.03


## Let one ancestor's painted eyes follow a world point (unsettling).
func portraits_look_at(p: Vector3) -> void:
	for i in portrait_mats.size():
		if i != 0 and i != 3:
			continue
		var m := portrait_mats[i]
		var v := Vector2(clampf(-(p.z + 1.0) * 0.12, -0.5, 0.5), clampf((1.0 - p.y) * 0.3, -0.4, 0.4))
		if i == 3:
			v = Vector2(clampf(p.x * 0.3, -0.5, 0.5), clampf(-(p.z) * 0.05, -0.4, 0.4))
		m.set_shader_parameter("look", v)
