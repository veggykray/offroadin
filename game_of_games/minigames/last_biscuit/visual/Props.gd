class_name LBProps
extends RefCounted
## Placeholder 3D art for every table object kind. Built from primitives and
## shared materials; each returns a Node3D added under the LBTableObject.

static func build(o: LBTableObject) -> Node3D:
	var root := Node3D.new()
	root.name = "Visual"
	o.add_child(root)
	match o.kind:
		LBTableObject.Kind.CUP: _cup(root)
		LBTableObject.Kind.DINNER_PLATE: _plate(root, 0.13)
		LBTableObject.Kind.BISCUIT_PLATE: _biscuit_plate(root)
		LBTableObject.Kind.CANDLESTICK: _candlestick(root, o)
		LBTableObject.Kind.CANDELABRA: _candelabra(root, o)
		LBTableObject.Kind.FORK: _fork(root)
		LBTableObject.Kind.KNIFE: _knife(root)
		LBTableObject.Kind.SPOON: _spoon(root)
		LBTableObject.Kind.TEAPOT_SILVER: _teapot(root, LBMat.silver(), true)
		LBTableObject.Kind.TEAPOT_CHINA: _teapot(root, LBMat.porcelain(), false)
		LBTableObject.Kind.FLOWERS: _flowers(root, o)
		LBTableObject.Kind.SUGAR_BOWL: _sugar_bowl(root)
		LBTableObject.Kind.SERVING_DISH: _serving_dish(root)
		LBTableObject.Kind.PLATE_STACK: _plate_stack(root)
		LBTableObject.Kind.NAPKIN: _napkin(root)
		LBTableObject.Kind.BOTTLE: _bottle(root, o)
		LBTableObject.Kind.CREAM_JUG: _cream_jug(root)
		LBTableObject.Kind.SALT: _salt(root)
		LBTableObject.Kind.WINE_GLASS: _wine_glass(root)
		LBTableObject.Kind.TEETH: _teeth(root)
		LBTableObject.Kind.SUGAR_CUBE: LBMesh.add(root, LBMesh.box_mesh(Vector3(0.022, 0.022, 0.022)), LBMat.std("sugar", Color(0.97, 0.96, 0.93), 0.0, 0.9), Vector3(0, 0.011, 0))
		LBTableObject.Kind.BISCUIT, LBTableObject.Kind.FAKE_BISCUIT: _biscuit(root, o as LBBiscuit)
	return root


static func _cup(r: Node3D) -> void:
	var p := LBMat.porcelain()
	# saucer
	LBMesh.add(r, LBMesh.cyl_mesh(0.07, 0.05, 0.012, 24), p, Vector3(0, 0.006, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.066, 0.072, 24, 4), LBMat.gold(), Vector3(0, 0.012, 0))
	# cup body
	LBMesh.add(r, LBMesh.cyl_mesh(0.042, 0.03, 0.06, 20), p, Vector3(0, 0.045, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.038, 0.038, 0.002, 20), LBMat.std("tea", Color(0.35, 0.16, 0.05), 0.0, 0.05), Vector3(0, 0.07, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.039, 0.044, 20, 4), LBMat.gold(), Vector3(0, 0.074, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.0425, 0.035, 0.014, 20), LBMat.porcelain_blue(), Vector3(0, 0.05, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.012, 0.018, 12, 6), p, Vector3(0.045, 0.048, 0), Vector3(90, 0, 0))


static func _plate(r: Node3D, rad: float) -> void:
	LBMesh.add(r, LBMesh.cyl_mesh(rad, rad * 0.7, 0.014, 32), LBMat.porcelain(), Vector3(0, 0.007, 0))
	LBMesh.add(r, LBMesh.torus_mesh(rad * 0.93, rad * 0.99, 32, 4), LBMat.gold(), Vector3(0, 0.014, 0))
	LBMesh.add(r, LBMesh.torus_mesh(rad * 0.68, rad * 0.72, 32, 4), LBMat.porcelain_blue(), Vector3(0, 0.0135, 0))


static func _biscuit_plate(r: Node3D) -> void:
	# ornate gilded plate on a little foot, with a lace doily
	LBMesh.add(r, LBMesh.cyl_mesh(0.06, 0.07, 0.025, 24), LBMat.gold(), Vector3(0, 0.012, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.17, 0.1, 0.02, 40), LBMat.porcelain(), Vector3(0, 0.032, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.158, 0.175, 40, 6), LBMat.gold(), Vector3(0, 0.042, 0))
	for i in 16:
		var a := TAU * i / 16.0
		LBMesh.add(r, LBMesh.sphere_mesh(0.009, 8), LBMat.gold(), Vector3(cos(a) * 0.168, 0.045, sin(a) * 0.168))
	LBMesh.add(r, LBMesh.torus_mesh(0.11, 0.118, 32, 4), LBMat.porcelain_blue(), Vector3(0, 0.0425, 0))
	var doily := LBMesh.add(r, LBMesh.quad_mesh(Vector2(0.22, 0.22)), LBMat.shader("doily", "doily.gdshader"), Vector3(0, 0.0435, 0), Vector3(-90, 0, 0), Vector3.ONE, false)
	doily.name = "Doily"


static func _flame(parent: Node3D, pos: Vector3, seed: float, light := false, energy := 0.9) -> void:
	var f := LBMesh.add(parent, LBMesh.quad_mesh(Vector2(0.03, 0.06)), LBMat.flame(seed), pos + Vector3(0, 0.022, 0), Vector3.ZERO, Vector3.ONE, false)
	f.name = "Flame"
	if light:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.68, 0.36)
		l.light_energy = energy
		l.omni_range = 2.6
		l.omni_attenuation = 1.6
		l.position = pos + Vector3(0, 0.06, 0)
		l.shadow_enabled = false
		l.set_script(load("res://minigames/last_biscuit/visual/Flicker.gd"))
		parent.add_child(l)


static func _candlestick(r: Node3D, o: LBTableObject) -> void:
	var s := LBMat.tarnished_silver()
	LBMesh.add(r, LBMesh.cyl_mesh(0.03, 0.05, 0.02, 20), s, Vector3(0, 0.01, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.012, 0.018, 0.16, 12), s, Vector3(0, 0.1, 0))
	LBMesh.add(r, LBMesh.sphere_mesh(0.022, 12), s, Vector3(0, 0.1, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.025, 0.015, 0.02, 14), s, Vector3(0, 0.19, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.011, 0.011, 0.1, 12), LBMat.wax(), Vector3(0, 0.25, 0))
	_flame(r, Vector3(0, 0.3, 0), float(o.get_instance_id() % 100), o.get_meta("lit", false), 0.6)


static func _candelabra(r: Node3D, o: LBTableObject) -> void:
	var s := LBMat.silver()
	LBMesh.add(r, LBMesh.cyl_mesh(0.04, 0.075, 0.025, 24), s, Vector3(0, 0.012, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.014, 0.02, 0.24, 12), s, Vector3(0, 0.13, 0))
	LBMesh.add(r, LBMesh.sphere_mesh(0.026, 12), s, Vector3(0, 0.15, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.1, 0.112, 24, 6), s, Vector3(0, 0.255, 0), Vector3(90, 0, 0), Vector3(1, 1, 1))
	for x in [-0.11, 0.0, 0.11]:
		var y := 0.27 if x != 0.0 else 0.31
		LBMesh.add(r, LBMesh.cyl_mesh(0.02, 0.012, 0.02, 12), s, Vector3(x, y, 0))
		LBMesh.add(r, LBMesh.cyl_mesh(0.011, 0.011, 0.12, 10), LBMat.wax(), Vector3(x, y + 0.07, 0))
		# wax drips
		LBMesh.add(r, LBMesh.sphere_mesh(0.007, 6), LBMat.wax(), Vector3(x + 0.009, y + 0.06, 0.004))
		_flame(r, Vector3(x, y + 0.13, 0), float(o.get_instance_id() % 100) + x * 10.0, x == 0.0, 1.1)


static func _fork(r: Node3D) -> void:
	var s := LBMat.silver()
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.012, 0.004, 0.11)), s, Vector3(0, 0.003, 0.03))
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.022, 0.004, 0.02)), s, Vector3(0, 0.003, -0.03))
	for i in 4:
		LBMesh.add(r, LBMesh.box_mesh(Vector3(0.003, 0.003, 0.04)), s, Vector3(-0.008 + i * 0.0053, 0.003, -0.058))


static func _knife(r: Node3D) -> void:
	var s := LBMat.silver()
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.012, 0.006, 0.09)), s, Vector3(0, 0.004, 0.045))
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.016, 0.002, 0.1)), s, Vector3(0.002, 0.003, -0.05))


static func _spoon(r: Node3D) -> void:
	var s := LBMat.silver()
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.009, 0.004, 0.09)), s, Vector3(0, 0.004, 0.035))
	LBMesh.add(r, LBMesh.sphere_mesh(0.018, 12), s, Vector3(0, 0.005, -0.03), Vector3.ZERO, Vector3(1, 0.3, 1.4))


static func _teapot(r: Node3D, mat: Material, silver: bool) -> void:
	LBMesh.add(r, LBMesh.cyl_mesh(0.05, 0.06, 0.02, 24), mat, Vector3(0, 0.01, 0))
	LBMesh.add(r, LBMesh.sphere_mesh(0.095, 28), mat, Vector3(0, 0.1, 0), Vector3.ZERO, Vector3(1.0, 0.85, 1.0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.045, 0.06, 0.04, 20), mat, Vector3(0, 0.18, 0))
	LBMesh.add(r, LBMesh.sphere_mesh(0.018, 10), mat, Vector3(0, 0.215, 0))
	# spout and handle point across the table
	LBMesh.add(r, LBMesh.cyl_mesh(0.012, 0.024, 0.13, 12), mat, Vector3(-0.115, 0.13, 0), Vector3(0, 0, 50))
	LBMesh.add(r, LBMesh.torus_mesh(0.035, 0.05, 20, 8), mat, Vector3(0.1, 0.12, 0), Vector3(90, 0, 0))
	if not silver:
		LBMesh.add(r, LBMesh.torus_mesh(0.08, 0.096, 28, 4), LBMat.porcelain_blue(), Vector3(0, 0.1, 0), Vector3.ZERO, Vector3(1, 1.5, 1))
		LBMesh.add(r, LBMesh.torus_mesh(0.045, 0.05, 20, 4), LBMat.gold(), Vector3(0, 0.2, 0))
	else:
		for i in 12:
			var a := TAU * i / 12.0
			LBMesh.add(r, LBMesh.sphere_mesh(0.007, 6), LBMat.gold(), Vector3(cos(a) * 0.057, 0.02, sin(a) * 0.057))


static func _flowers(r: Node3D, o: LBTableObject) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = o.get_instance_id()
	LBMesh.add(r, LBMesh.cyl_mesh(0.07, 0.05, 0.18, 20), LBMat.porcelain(), Vector3(0, 0.09, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.065, 0.075, 20, 4), LBMat.gold(), Vector3(0, 0.18, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.045, 0.06, 0.06, 16), LBMat.porcelain_blue(), Vector3(0, 0.08, 0))
	var leaf := LBMat.std("leaf", Color(0.12, 0.2, 0.08), 0.0, 0.6)
	var cols := [Color(0.5, 0.04, 0.08), Color(0.62, 0.08, 0.12), Color(0.9, 0.86, 0.78), Color(0.42, 0.06, 0.24)]
	for i in 30:
		var a := rng.randf() * TAU
		var rr := rng.randf_range(0.02, 0.15)
		var h := 0.24 + rng.randf() * 0.3 - rr * 0.6
		var p := Vector3(cos(a) * rr, h, sin(a) * rr)
		if i < 14:
			LBMesh.add(r, LBMesh.sphere_mesh(0.03, 8), leaf, p * Vector3(1.2, 0.9, 1.2), Vector3(rng.randf() * 90, rng.randf() * 180, 0), Vector3(1.6, 0.25, 0.8))
		var c: Color = cols[rng.randi() % cols.size()]
		var fm := LBMat.std("flower_%s" % c.to_html(), c, 0.0, 0.7, {"rim_enabled": true, "rim": 0.3})
		LBMesh.add(r, LBMesh.sphere_mesh(0.032, 10), fm, p, Vector3.ZERO, Vector3(1, 0.75, 1))
		# drooping dead petals: the arrangement is past its prime
		if i % 7 == 0:
			LBMesh.add(r, LBMesh.sphere_mesh(0.012, 6), fm, Vector3(p.x * 1.6, 0.003, p.z * 1.6), Vector3.ZERO, Vector3(1.5, 0.2, 1.0))


static func _sugar_bowl(r: Node3D) -> void:
	var p := LBMat.porcelain()
	LBMesh.add(r, LBMesh.cyl_mesh(0.06, 0.04, 0.06, 20), p, Vector3(0, 0.03, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.056, 0.064, 20, 4), LBMat.gold(), Vector3(0, 0.06, 0))
	var sm := LBMat.std("sugar", Color(0.97, 0.96, 0.93), 0.0, 0.9)
	for i in 6:
		var a := TAU * i / 6.0
		LBMesh.add(r, LBMesh.box_mesh(Vector3(0.02, 0.02, 0.02)), sm, Vector3(cos(a) * 0.025, 0.065, sin(a) * 0.025), Vector3(10 * i, 30 * i, 5))
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.006, 0.004, 0.12)), LBMat.silver(), Vector3(0.02, 0.08, 0.0), Vector3(25, 20, 0))


static func _serving_dish(r: Node3D) -> void:
	var s := LBMat.silver()
	LBMesh.add(r, LBMesh.cyl_mesh(0.16, 0.14, 0.02, 32), s, Vector3(0, 0.01, 0), Vector3.ZERO, Vector3(1.0, 1, 0.8))
	LBMesh.add(r, LBMesh.hemi_mesh(0.135, 28), s, Vector3(0, 0.02, 0), Vector3.ZERO, Vector3(1.0, 1.55, 0.8))
	LBMesh.add(r, LBMesh.sphere_mesh(0.02, 10), LBMat.gold(), Vector3(0, 0.235, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.13, 0.142, 28, 4), LBMat.gold(), Vector3(0, 0.022, 0), Vector3.ZERO, Vector3(1, 1, 0.8))


static func _plate_stack(r: Node3D) -> void:
	for i in 9:
		var y := 0.008 + i * 0.022
		LBMesh.add(r, LBMesh.cyl_mesh(0.125, 0.09, 0.014, 28), LBMat.porcelain(), Vector3(sin(i * 1.7) * 0.006, y, cos(i * 2.3) * 0.006))
		LBMesh.add(r, LBMesh.torus_mesh(0.116, 0.124, 28, 4), LBMat.gold(), Vector3(sin(i * 1.7) * 0.006, y + 0.007, cos(i * 2.3) * 0.006))


static func _napkin(r: Node3D) -> void:
	# a stiff folded linen napkin (bishop's mitre fold)
	var lm := LBMat.shader("napkin", "linen.gdshader", {"repeat": Vector2(2.0, 2.0), "lace_edge": 0.05, "stain": 0.2})
	LBMesh.add(r, LBMesh.box_mesh(Vector3(0.16, 0.012, 0.16)), lm, Vector3(0, 0.006, 0), Vector3(0, 45, 0))
	LBMesh.add(r, LBMesh.prism_mesh(Vector3(0.12, 0.1, 0.04)), lm, Vector3(0, 0.06, 0))
	r.set_meta("folded", true)


static func _bottle(r: Node3D, o: LBTableObject) -> void:
	var col := Color(0.08, 0.18, 0.08, 0.85) if o.get_instance_id() % 2 == 0 else Color(0.25, 0.04, 0.06, 0.85)
	var g := LBMat.glass(col)
	LBMesh.add(r, LBMesh.cyl_mesh(0.038, 0.04, 0.2, 20), g, Vector3(0, 0.1, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.014, 0.036, 0.06, 16), g, Vector3(0, 0.23, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.014, 0.014, 0.06, 12), g, Vector3(0, 0.29, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.016, 0.016, 0.03, 12), LBMat.std("foil", Color(0.5, 0.08, 0.06), 0.7, 0.4), Vector3(0, 0.315, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.0405, 0.0405, 0.07, 20), LBMat.std("label", Color(0.85, 0.8, 0.65), 0.0, 0.8), Vector3(0, 0.1, 0))


static func _cream_jug(r: Node3D) -> void:
	var p := LBMat.porcelain()
	LBMesh.add(r, LBMesh.cyl_mesh(0.03, 0.042, 0.08, 18), p, Vector3(0, 0.04, 0))
	LBMesh.add(r, LBMesh.torus_mesh(0.018, 0.026, 12, 6), p, Vector3(0.042, 0.045, 0), Vector3(90, 0, 0))
	LBMesh.add(r, LBMesh.prism_mesh(Vector3(0.02, 0.02, 0.02)), p, Vector3(-0.032, 0.078, 0), Vector3(0, 0, 90))


static func _salt(r: Node3D) -> void:
	LBMesh.add(r, LBMesh.cyl_mesh(0.018, 0.024, 0.06, 14), LBMat.silver(), Vector3(0, 0.03, 0))
	LBMesh.add(r, LBMesh.sphere_mesh(0.018, 12), LBMat.silver(), Vector3(0, 0.062, 0))


static func _wine_glass(r: Node3D) -> void:
	var g := LBMat.glass(Color(0.9, 0.92, 1.0, 0.22))
	LBMesh.add(r, LBMesh.cyl_mesh(0.03, 0.035, 0.006, 18), g, Vector3(0, 0.003, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.005, 0.005, 0.1, 8), g, Vector3(0, 0.055, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.04, 0.02, 0.08, 18), g, Vector3(0, 0.14, 0))
	LBMesh.add(r, LBMesh.cyl_mesh(0.03, 0.02, 0.03, 18), LBMat.std("wine", Color(0.35, 0.02, 0.05, 0.9), 0.0, 0.1, {"transparency": BaseMaterial3D.TRANSPARENCY_ALPHA}), Vector3(0, 0.12, 0))


static func _teeth(r: Node3D) -> void:
	var gum := LBMat.std("gum", Color(0.85, 0.42, 0.45), 0.0, 0.3)
	var tooth := LBMat.std("tooth", Color(0.96, 0.94, 0.85), 0.0, 0.2)
	for jaw in [0, 1]:
		var j := LBMesh.pivot(r, Vector3(0, 0.012 + jaw * 0.02, 0), "jaw%d" % jaw)
		LBMesh.add(j, LBMesh.torus_mesh(0.025, 0.04, 20, 6), gum, Vector3.ZERO, Vector3.ZERO, Vector3(1, 1.4, 1))
		for i in 9:
			var a := PI + 0.25 + i * 0.33
			LBMesh.add(j, LBMesh.box_mesh(Vector3(0.011, 0.012, 0.008)), tooth, Vector3(cos(a) * 0.035, -0.006 if jaw == 1 else 0.006, sin(a) * 0.035), Vector3(0, -rad_to_deg(a) + 90, 0))


static func _biscuit(r: Node3D, b: LBBiscuit) -> void:
	var mat := LBMat.shader_unique("biscuit.gdshader", {"fake": 1.0 if b.is_fake else 0.0})
	var mi := MeshInstance3D.new()
	mi.mesh = biscuit_mesh(b.size_fraction, b.crumbs_seed, b.is_fake)
	mi.material_override = mat
	mi.position = Vector3(0, 0.046, 0)   # resting on the plate
	mi.scale = Vector3.ONE * 1.6         # the star of the show must read from the far camera
	mi.name = "BiscuitMesh"
	r.add_child(mi)


## Fluted round biscuit, or a jagged broken piece of one.
static func biscuit_mesh(fraction: float, seed: float, fake := false) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(seed * 1000.0)
	var R := 0.055
	var H := 0.013
	var outline := PackedVector2Array()
	if fraction >= 0.99:
		var n := 48
		for i in n:
			var a := TAU * i / n
			var rr := R * (1.0 if fake else (0.94 + 0.06 * absf(cos(a * 12.0))))
			outline.append(Vector2(cos(a), sin(a)) * rr)
	else:
		# arc span chosen so the piece has roughly `fraction` of the area
		var span := TAU * fraction
		var n := int(40 * fraction) + 6
		var a0 := -span * 0.5
		for i in n + 1:
			var a := a0 + span * i / n
			outline.append(Vector2(cos(a), sin(a)) * R * (0.94 + 0.06 * absf(cos(a * 12.0))))
		# jagged break line back through (near) the centre
		var p_end := outline[outline.size() - 1]
		var p_start := outline[0]
		var c := Vector2(-R * 0.15 * (1.0 - fraction), 0.0)
		var steps := 7
		for i in range(1, steps):
			var t := float(i) / steps
			var p := p_end.lerp(c, t * 2.0) if t < 0.5 else c.lerp(p_start, (t - 0.5) * 2.0)
			p += Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * 0.004
			outline.append(p)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var center := Vector2.ZERO
	for p in outline:
		center += p
	center /= outline.size()
	var m := outline.size()
	# Godot treats clockwise triangles (seen from outside) as front faces
	for i in m:
		var a := outline[i]
		var b := outline[(i + 1) % m]
		# top
		st.set_normal(Vector3.UP)
		st.add_vertex(Vector3(center.x, H * 0.5 + 0.002, center.y))
		st.add_vertex(Vector3(a.x, H * 0.5, a.y))
		st.add_vertex(Vector3(b.x, H * 0.5, b.y))
		# bottom
		st.set_normal(Vector3.DOWN)
		st.add_vertex(Vector3(center.x, -H * 0.5, center.y))
		st.add_vertex(Vector3(b.x, -H * 0.5, b.y))
		st.add_vertex(Vector3(a.x, -H * 0.5, a.y))
		# side
		var e := (b - a)
		var nrm := Vector3(e.y, 0, -e.x).normalized()
		st.set_normal(nrm)
		st.add_vertex(Vector3(a.x, H * 0.5, a.y))
		st.add_vertex(Vector3(a.x, -H * 0.5, a.y))
		st.add_vertex(Vector3(b.x, H * 0.5, b.y))
		st.add_vertex(Vector3(b.x, H * 0.5, b.y))
		st.add_vertex(Vector3(a.x, -H * 0.5, a.y))
		st.add_vertex(Vector3(b.x, -H * 0.5, b.y))
	return st.commit()
