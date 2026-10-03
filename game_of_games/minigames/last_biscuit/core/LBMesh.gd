class_name LBMesh
extends RefCounted
## Tiny procedural-modelling helpers. Every placeholder prop and character in
## the mini-game is assembled from these so that artwork can later replace a
## whole node without touching gameplay code.

static var _cache := {}


static func _cached(key: String, maker: Callable) -> Mesh:
	if not _cache.has(key):
		_cache[key] = maker.call()
	return _cache[key]


static func sphere_mesh(r: float, segs: int = 24) -> Mesh:
	return _cached("s%f_%d" % [r, segs], func():
		var m := SphereMesh.new()
		m.radius = r
		m.height = r * 2.0
		m.radial_segments = segs
		m.rings = maxi(segs / 2, 6)
		return m)


static func hemi_mesh(r: float, segs: int = 20) -> Mesh:
	return _cached("h%f_%d" % [r, segs], func():
		var m := SphereMesh.new()
		m.radius = r
		m.height = r
		m.is_hemisphere = true
		m.radial_segments = segs
		m.rings = maxi(segs / 3, 5)
		return m)


static func cyl_mesh(top: float, bottom: float, h: float, segs: int = 24) -> Mesh:
	return _cached("c%f_%f_%f_%d" % [top, bottom, h, segs], func():
		var m := CylinderMesh.new()
		m.top_radius = top
		m.bottom_radius = bottom
		m.height = h
		m.radial_segments = segs
		m.rings = 1
		return m)


static func box_mesh(size: Vector3) -> Mesh:
	return _cached("b%s" % [size], func():
		var m := BoxMesh.new()
		m.size = size
		return m)


static func capsule_mesh(r: float, h: float, segs: int = 16) -> Mesh:
	return _cached("k%f_%f_%d" % [r, h, segs], func():
		var m := CapsuleMesh.new()
		m.radius = r
		m.height = maxf(h, r * 2.0)
		m.radial_segments = segs
		m.rings = 6
		return m)


static func torus_mesh(inner: float, outer: float, rings: int = 32, segs: int = 10) -> Mesh:
	return _cached("t%f_%f_%d_%d" % [inner, outer, rings, segs], func():
		var m := TorusMesh.new()
		m.inner_radius = inner
		m.outer_radius = outer
		m.rings = rings
		m.ring_segments = segs
		return m)


static func quad_mesh(size: Vector2) -> Mesh:
	return _cached("q%s" % [size], func():
		var m := QuadMesh.new()
		m.size = size
		return m)


static func prism_mesh(size: Vector3) -> Mesh:
	return _cached("p%s" % [size], func():
		var m := PrismMesh.new()
		m.size = size
		return m)


## Adds a MeshInstance3D child and returns it.
static func add(parent: Node, mesh: Mesh, mat: Material, pos := Vector3.ZERO,
		rot_deg := Vector3.ZERO, scl := Vector3.ONE, shadows := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if mat:
		mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	mi.scale = scl
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows \
			else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


static func pivot(parent: Node, pos := Vector3.ZERO, name := "") -> Node3D:
	var n := Node3D.new()
	if name != "":
		n.name = name
	n.position = pos
	parent.add_child(n)
	return n


## A tube following a list of points (used for arms, tails and sleeves).
## radii: one radius per point. Writes into an ImmediateMesh.
static func tube(im: ImmediateMesh, pts: PackedVector3Array, radii: PackedFloat32Array,
		mat: Material, sides: int = 10) -> void:
	var n := pts.size()
	if n < 2:
		return
	var frames: Array = []
	var prev_side := Vector3.UP
	for i in n:
		var t: Vector3
		if i == 0:
			t = (pts[1] - pts[0])
		elif i == n - 1:
			t = (pts[n - 1] - pts[n - 2])
		else:
			t = (pts[i + 1] - pts[i - 1])
		t = t.normalized() if t.length() > 0.00001 else Vector3.FORWARD
		var side := prev_side.cross(t)
		if side.length() < 0.001:
			side = Vector3.RIGHT.cross(t)
		side = side.normalized()
		var up := t.cross(side).normalized()
		prev_side = up
		frames.append([side, up])
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES, mat)
	for i in n - 1:
		var a: Array = frames[i]
		var b: Array = frames[i + 1]
		for s in sides:
			var a0 := TAU * float(s) / sides
			var a1 := TAU * float(s + 1) / sides
			var na0: Vector3 = a[0] * cos(a0) + a[1] * sin(a0)
			var na1: Vector3 = a[0] * cos(a1) + a[1] * sin(a1)
			var nb0: Vector3 = b[0] * cos(a0) + b[1] * sin(a0)
			var nb1: Vector3 = b[0] * cos(a1) + b[1] * sin(a1)
			var v0 := pts[i] + na0 * radii[i]
			var v1 := pts[i] + na1 * radii[i]
			var v2 := pts[i + 1] + nb0 * radii[i + 1]
			var v3 := pts[i + 1] + nb1 * radii[i + 1]
			var u0 := float(s) / sides
			var u1 := float(s + 1) / sides
			var w0 := float(i) / (n - 1)
			var w1 := float(i + 1) / (n - 1)
			im.surface_set_normal(na0); im.surface_set_uv(Vector2(u0, w0)); im.surface_add_vertex(v0)
			im.surface_set_normal(nb0); im.surface_set_uv(Vector2(u0, w1)); im.surface_add_vertex(v2)
			im.surface_set_normal(na1); im.surface_set_uv(Vector2(u1, w0)); im.surface_add_vertex(v1)
			im.surface_set_normal(na1); im.surface_set_uv(Vector2(u1, w0)); im.surface_add_vertex(v1)
			im.surface_set_normal(nb0); im.surface_set_uv(Vector2(u0, w1)); im.surface_add_vertex(v2)
			im.surface_set_normal(nb1); im.surface_set_uv(Vector2(u1, w1)); im.surface_add_vertex(v3)
	im.surface_end()


## Quadratic bezier sample.
static func bezier(a: Vector3, c: Vector3, b: Vector3, t: float) -> Vector3:
	var u := 1.0 - t
	return a * u * u + c * 2.0 * u * t + b * t * t
