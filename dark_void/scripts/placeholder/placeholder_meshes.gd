@tool
class_name PlaceholderMeshes
extends RefCounted
## Helpers for building clean placeholder geometry in code. Nothing here is meant to ship.


static func material(color: Color, roughness := 0.8, metallic := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	m.metallic = metallic
	return m


## Y axis along `dir` (CylinderMesh/CapsuleMesh are Y-up).
static func basis_along(dir: Vector3) -> Basis:
	var y := dir.normalized()
	if y.length_squared() < 0.5:
		return Basis.IDENTITY
	var ref := Vector3.BACK if absf(y.dot(Vector3.UP)) > 0.9 else Vector3.UP
	var x := ref.cross(y).normalized()
	var z := x.cross(y)
	return Basis(x, y, z)


## A sphere whose surface is pushed in/out by noise, then squashed by `scale`.
static func lumpy_mesh(radius: float, lumpiness: float, seed_value: int, scale := Vector3.ONE,
		rings := 18, segments := 28) -> ArrayMesh:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.rings = rings
	sphere.radial_segments = segments
	var arrays := sphere.get_mesh_arrays()
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var noise := FastNoiseLite.new()
	noise.seed = seed_value
	noise.frequency = 0.9
	noise.fractal_octaves = 3
	for i in verts.size():
		var v: Vector3 = verts[i]
		var k := noise.get_noise_3dv(v.normalized() * 1.7)
		verts[i] = (v * (1.0 + k * lumpiness)) * scale
	arrays[Mesh.ARRAY_VERTEX] = verts
	var raw := ArrayMesh.new()
	raw.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var st := SurfaceTool.new()
	st.create_from(raw, 0)
	st.generate_normals()
	st.generate_tangents()
	return st.commit()


static func add_mesh(parent: Node, mesh: Mesh, xform: Transform3D, mat: Material,
		casts_shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.transform = xform
	mi.material_override = mat
	if not casts_shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


## Capsule (or cone/cylinder) spanning a → b in the parent's space.
static func segment(parent: Node, a: Vector3, b: Vector3, radius: float, mat: Material,
		tip_radius := -1.0) -> MeshInstance3D:
	var length := maxf(a.distance_to(b), 0.001)
	var mesh: Mesh
	if tip_radius < 0.0:
		var c := CapsuleMesh.new()
		c.radius = radius
		c.height = maxf(length + radius, radius * 2.0)
		c.radial_segments = 16
		c.rings = 6
		mesh = c
	else:
		var cy := CylinderMesh.new()
		cy.bottom_radius = radius
		cy.top_radius = tip_radius
		cy.height = length
		cy.radial_segments = 10
		cy.rings = 1
		mesh = cy
	return add_mesh(parent, mesh, Transform3D(basis_along(b - a), (a + b) * 0.5), mat)


## Marker used by IlluminatedObject sample groups.
static func add_sample(parent: Node, local_pos: Vector3, radius: float, group: StringName) -> Marker3D:
	var m := Marker3D.new()
	m.name = "Sample"
	m.position = local_pos
	m.set_meta("sample_radius", radius)
	m.add_to_group(group)
	parent.add_child(m)
	return m


static func add_marker(parent: Node, marker_name: String, local_pos: Vector3) -> Marker3D:
	var m := Marker3D.new()
	m.name = marker_name
	m.position = local_pos
	parent.add_child(m)
	return m
