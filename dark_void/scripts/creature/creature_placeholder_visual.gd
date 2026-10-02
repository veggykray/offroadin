@tool
class_name CreaturePlaceholderVisual
extends Node3D
## Procedural placeholder for the creature: ~30 m of overlapping pieces (rough skin masses,
## hair, a long arm with a hand of fingers, a huge wet eye, teeth) so that a 3 m light only
## ever shows a fragment of it. Bill is ~1.8 m tall; a single finger is about his height.
##
## To replace with real art, swap this node for the model and keep the contract:
##   * Marker3D "EyeAnchor"     — front surface of the eye (used by the close-encounter scare)
##   * Marker3D "TouchAnchor"   — where Bill touches it in the final phase (beacon sound lives here)
##   * Marker3D "RevealPoint*"  — where gentle lights appear on completion
##   * Marker3D nodes in group "dv_creature_samples" with meta "sample_radius" covering the body
##     (read by the creature's IlluminatedObject)
## Optional method set_idle_motion(enabled: bool) — the creature calls it to go still when lit.
## Creature local +Z faces the camera; keep everything at local z <= ~1.2.

const SAMPLE_GROUP := &"dv_creature_samples"

@export var build_seed := 7:
	set(v):
		build_seed = v
		_build()
@export var idle_motion := true
@export var breathing_amount := 0.018
@export var breathing_rate := 0.11
@export var finger_twitch_degrees := 3.0

var _gen: Node3D
var _breathers: Array[Node3D] = []
var _fingers: Array[Node3D] = []
var _motion := true
var _t := 0.0

var _skin: StandardMaterial3D
var _skin_dark: StandardMaterial3D
var _hair: StandardMaterial3D
var _sclera: StandardMaterial3D
var _iris: StandardMaterial3D
var _pupil: StandardMaterial3D
var _tooth: StandardMaterial3D
var _gum: StandardMaterial3D
var _nail: StandardMaterial3D
var _void: StandardMaterial3D


func _ready() -> void:
	_build()


func set_idle_motion(enabled: bool) -> void:
	_motion = enabled


func _process(delta: float) -> void:
	if Engine.is_editor_hint() or not idle_motion or not _motion:
		return
	_t += delta
	for i in _breathers.size():
		var s := 1.0 + sin(_t * TAU * breathing_rate + i * 0.9) * breathing_amount
		_breathers[i].scale = Vector3.ONE * s
	for i in _fingers.size():
		var f := _fingers[i]
		var base: Basis = f.get_meta("base_basis")
		var a := deg_to_rad(finger_twitch_degrees) * (sin(_t * 0.7 + i * 1.7) * 0.6 + sin(_t * 2.3 + i) * 0.4)
		f.basis = base * Basis(Vector3.RIGHT, a)


func _build() -> void:
	if not is_inside_tree():
		return
	if _gen:
		remove_child(_gen)
		_gen.queue_free()
	_breathers.clear()
	_fingers.clear()
	_make_materials()
	_gen = Node3D.new()
	_gen.name = "Generated"
	add_child(_gen)
	var rng := RandomNumberGenerator.new()
	rng.seed = build_seed

	_build_body(rng)
	_build_eye(rng)
	_build_mouth(rng)
	_build_arm(rng)
	_build_upper_limb(rng)
	_build_hair(rng)
	_build_chunks(rng)

	PlaceholderMeshes.add_marker(_gen, "EyeAnchor", Vector3(2.0, 2.5, 1.15))
	PlaceholderMeshes.add_marker(_gen, "TouchAnchor", Vector3(15.8, -0.4, 0.5))
	PlaceholderMeshes.add_marker(_gen, "RevealPoint1", Vector3(2.0, 2.2, 4.0))
	PlaceholderMeshes.add_marker(_gen, "RevealPoint2", Vector3(14.5, 0.5, 3.5))
	PlaceholderMeshes.add_marker(_gen, "RevealPoint3", Vector3(-3.0, -2.0, 3.8))


func _make_materials() -> void:
	var noise := FastNoiseLite.new()
	noise.seed = build_seed
	noise.frequency = 0.03
	noise.fractal_octaves = 4
	var normal_tex := NoiseTexture2D.new()
	normal_tex.width = 512
	normal_tex.height = 512
	normal_tex.seamless = true
	normal_tex.as_normal_map = true
	normal_tex.bump_strength = 14.0
	normal_tex.noise = noise
	var mottled := NoiseTexture2D.new()
	mottled.width = 256
	mottled.height = 256
	mottled.seamless = true
	mottled.noise = noise
	var ramp := Gradient.new()
	ramp.set_color(0, Color(0.13, 0.1, 0.09))
	ramp.set_color(1, Color(0.36, 0.29, 0.25))
	mottled.color_ramp = ramp

	_skin = StandardMaterial3D.new()
	_skin.albedo_texture = mottled
	_skin.roughness = 0.95
	_skin.normal_enabled = true
	_skin.normal_texture = normal_tex
	_skin.normal_scale = 1.2
	_skin.uv1_triplanar = true
	_skin.uv1_scale = Vector3.ONE * 0.45
	_skin_dark = _skin.duplicate()
	_skin_dark.albedo_color = Color(0.6, 0.55, 0.55)

	_hair = PlaceholderMeshes.material(Color(0.05, 0.045, 0.04), 0.55)
	_sclera = PlaceholderMeshes.material(Color(0.72, 0.67, 0.5), 0.08)
	_sclera.clearcoat_enabled = true
	_sclera.clearcoat = 1.0
	_sclera.clearcoat_roughness = 0.05
	_iris = PlaceholderMeshes.material(Color(0.36, 0.22, 0.05), 0.2)
	_pupil = PlaceholderMeshes.material(Color(0.0, 0.0, 0.0), 0.1)
	_tooth = PlaceholderMeshes.material(Color(0.68, 0.63, 0.5), 0.45)
	_gum = PlaceholderMeshes.material(Color(0.3, 0.08, 0.08), 0.4)
	_nail = PlaceholderMeshes.material(Color(0.5, 0.46, 0.38), 0.35)
	_void = PlaceholderMeshes.material(Color(0.02, 0.008, 0.008), 1.0)


func _sample(parent: Node, pos: Vector3, radius: float) -> void:
	PlaceholderMeshes.add_sample(parent, pos, radius, SAMPLE_GROUP)


## Rough-skin mass. Returns the mesh so callers can add extra samples on long shapes.
func _blob(pos: Vector3, radius: float, scl: Vector3, rng: RandomNumberGenerator, lump := 0.3,
		breathe := true, mat: Material = null, tilt := 0.25) -> MeshInstance3D:
	var mesh := PlaceholderMeshes.lumpy_mesh(radius, lump, rng.randi(), scl)
	var rot := Vector3(rng.randf_range(-tilt, tilt), rng.randf_range(-tilt, tilt), rng.randf_range(-0.4, 0.4))
	var mi := PlaceholderMeshes.add_mesh(_gen, mesh, Transform3D(Basis.from_euler(rot), pos),
			mat if mat else _skin)
	_sample(mi, Vector3.ZERO, radius * minf(scl.x, minf(scl.y, scl.z)) * 1.05)
	# Extra samples along the longest axis so long masses don't have dead zones at the ends.
	var major := scl.x if scl.x >= scl.y else scl.y
	var minor := minf(scl.x, scl.y)
	if major / maxf(minor, 0.01) > 1.25:
		var axis := Vector3.RIGHT if scl.x >= scl.y else Vector3.UP
		var off := radius * (major - minor) * 0.85
		_sample(mi, axis * off, radius * minor * 0.9)
		_sample(mi, -axis * off, radius * minor * 0.9)
	if breathe:
		_breathers.append(mi)
	return mi


func _build_body(rng: RandomNumberGenerator) -> void:
	_blob(Vector3(0.0, 0.0, -5.0), 5.0, Vector3(1.35, 1.05, 0.75), rng, 0.22)
	_blob(Vector3(-6.0, 2.2, -3.8), 3.5, Vector3(1.0, 1.15, 0.85), rng)
	_blob(Vector3(5.8, -0.8, -4.0), 3.8, Vector3(1.2, 0.95, 0.8), rng)
	_blob(Vector3(-0.5, -5.4, -3.6), 3.2, Vector3(1.5, 0.8, 0.8), rng)
	_blob(Vector3(-2.5, 5.4, -3.4), 3.0, Vector3(1.1, 1.0, 0.85), rng)
	_blob(Vector3(4.6, -5.6, -4.6), 2.6, Vector3(1.0, 1.0, 0.8), rng, 0.4)
	_blob(Vector3(-8.2, -3.2, -4.8), 2.8, Vector3(1.2, 1.0, 0.8), rng, 0.4)
	# Folds of skin over the joins.
	for i in 6:
		var p := Vector3(rng.randf_range(-7, 7), rng.randf_range(-5, 5), rng.randf_range(-2.6, -1.6))
		_blob(p, rng.randf_range(0.9, 1.6), Vector3(rng.randf_range(1.2, 2.0), 0.6, 0.6), rng, 0.45,
				false, _skin_dark, PI)


func _build_eye(rng: RandomNumberGenerator) -> void:
	var c := Vector3(2.0, 2.5, -0.1)
	_blob(Vector3(2.0, 2.75, -1.75), 2.1, Vector3(1.2, 1.05, 0.8), rng, 0.25, true, null, 0.1)
	var sclera := SphereMesh.new()
	sclera.radius = 1.2
	sclera.height = 2.4
	sclera.radial_segments = 40
	sclera.rings = 20
	var eye := PlaceholderMeshes.add_mesh(_gen, sclera, Transform3D(Basis.IDENTITY, c), _sclera)
	var iris := SphereMesh.new()
	iris.radius = 0.56
	iris.height = 0.24
	PlaceholderMeshes.add_mesh(eye, iris, Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0.1, -0.05, 1.08)), _iris)
	var pupil := SphereMesh.new()
	pupil.radius = 0.3
	pupil.height = 0.1
	# Horizontal slit pupil.
	var pb := Basis(Vector3.RIGHT, PI * 0.5).scaled(Vector3(1.0, 0.32, 1.0))
	PlaceholderMeshes.add_mesh(eye, pupil, Transform3D(pb, Vector3(0.1, -0.05, 1.17)), _pupil)
	var lid := TorusMesh.new()
	lid.inner_radius = 0.98
	lid.outer_radius = 1.5
	lid.rings = 32
	lid.ring_segments = 12
	PlaceholderMeshes.add_mesh(_gen, lid, Transform3D(Basis(Vector3.RIGHT, PI * 0.5).scaled(Vector3(1.05, 0.75, 1.0)),
			c + Vector3(0, 0.05, 0.55)), _skin)
	_sample(eye, Vector3.ZERO, 1.25)


func _build_mouth(rng: RandomNumberGenerator) -> void:
	_blob(Vector3(-2.5, -2.0, -1.7), 1.0, Vector3(2.4, 0.6, 0.5), rng, 0.2, false, _void, 0.05)
	_blob(Vector3(-2.5, -1.35, -1.05), 1.0, Vector3(2.6, 0.42, 0.6), rng, 0.25, true, _gum, 0.05)
	_blob(Vector3(-2.5, -2.65, -1.1), 1.0, Vector3(2.4, 0.42, 0.6), rng, 0.25, true, _gum, 0.05)
	for row in 2:
		var upper := row == 0
		var y := -1.5 if upper else -2.5
		var x := -5.0
		while x < 0.1:
			x += rng.randf_range(0.3, 0.5)
			if rng.randf() < 0.12:
				continue
			var length := rng.randf_range(0.4, 1.25) * (1.0 if upper else 0.8)
			var r := rng.randf_range(0.1, 0.22)
			var base := Vector3(x, y, rng.randf_range(-0.5, -0.15))
			var dir := Vector3(rng.randf_range(-0.25, 0.25), -1.0 if upper else 1.0, rng.randf_range(0.0, 0.25))
			PlaceholderMeshes.segment(_gen, base, base + dir.normalized() * length, r, _tooth, 0.0)
	for sx in [-4.5, -2.5, -0.5]:
		_sample(_gen, Vector3(sx, -2.0, -0.6), 1.0)


func _build_arm(rng: RandomNumberGenerator) -> void:
	var s := Vector3(7.5, 0.0, -2.6)
	var e := Vector3(11.2, 4.2, -1.6)
	var w := Vector3(14.6, 0.8, -0.8)
	var palm := Vector3(15.8, -0.4, -0.35)
	_limb(s, e, 1.15, rng)
	_blob(e, 1.25, Vector3.ONE, rng, 0.3, false)
	_limb(e, w, 0.9, rng)
	_blob(palm, 1.25, Vector3(1.25, 1.0, 0.5), rng, 0.2, true, null, 0.05)

	# Fingers fan around the forearm direction; each is about Bill's height.
	var fwd := (w - e)
	fwd.z = 0.0
	var fwd_ang := atan2(fwd.y, fwd.x)
	var spec := [
		[55.0, [0.9, 0.7, 0.5], 0.27],   # thumb
		[18.0, [1.2, 0.9, 0.65], 0.24],
		[0.0, [1.3, 1.0, 0.7], 0.25],
		[-18.0, [1.2, 0.9, 0.65], 0.23],
		[-36.0, [0.95, 0.7, 0.5], 0.2],
	]
	for f in spec:
		var ang := fwd_ang + deg_to_rad(float(f[0]))
		var dir := Vector3(cos(ang), sin(ang), 0.12)
		_finger(palm, dir, f[1], float(f[2]), rng)


func _limb(a: Vector3, b: Vector3, radius: float, rng: RandomNumberGenerator) -> void:
	var mi := PlaceholderMeshes.segment(_gen, a, b, radius, _skin)
	mi.rotate_object_local(Vector3.UP, rng.randf() * TAU)
	var n := maxi(2, int(a.distance_to(b) / 1.5))
	for i in n + 1:
		_sample(_gen, a.lerp(b, float(i) / n), radius + 0.15)


func _finger(palm: Vector3, dir: Vector3, lengths: Array, radius: float, rng: RandomNumberGenerator) -> void:
	var y := dir.normalized()
	var z := Vector3.BACK
	z = (z - y * y.dot(z)).normalized()
	var x := y.cross(z)
	var root := Node3D.new()
	root.name = "Finger"
	root.transform = Transform3D(Basis(x, y, z), palm + Vector3(dir.x, dir.y, 0.0).normalized() * 1.25)
	_gen.add_child(root)
	var cur := Transform3D.IDENTITY
	var r := radius
	var tip := Vector3.ZERO
	for i in lengths.size():
		var length := float(lengths[i])
		if i > 0:
			cur.basis = cur.basis * Basis(Vector3.RIGHT, 0.32 + rng.randf_range(-0.12, 0.12))
		var a := cur.origin
		var b := a + cur.basis.y * length
		PlaceholderMeshes.segment(root, a, b, r, _skin)
		var knuckle := SphereMesh.new()
		knuckle.radius = r * 1.18
		knuckle.height = r * 2.2
		PlaceholderMeshes.add_mesh(root, knuckle, Transform3D(Basis.IDENTITY, a), _skin)
		_sample(root, (a + b) * 0.5, r + length * 0.35)
		cur.origin = b
		tip = b
		r *= 0.85
	var nail := SphereMesh.new()
	nail.radius = r * 1.05
	nail.height = r * 0.8
	PlaceholderMeshes.add_mesh(root, nail, Transform3D(cur.basis * Basis(Vector3.RIGHT, PI * 0.5), tip + cur.basis.z * r * 0.55), _nail)
	root.set_meta("base_basis", root.basis)
	_fingers.append(root)


## A second, thinner limb reaching up and away, ending in three hooked claws.
func _build_upper_limb(rng: RandomNumberGenerator) -> void:
	var s := Vector3(-8.5, 4.0, -3.4)
	var e := Vector3(-12.5, 9.0, -2.5)
	var t := Vector3(-16.0, 7.0, -1.8)
	_limb(s, e, 0.9, rng)
	_blob(e, 1.0, Vector3.ONE, rng, 0.35, false)
	_limb(e, t, 0.7, rng)
	_blob(t, 0.95, Vector3(1.2, 0.9, 0.8), rng, 0.35, false)
	for i in 3:
		var ang := deg_to_rad(200.0 + i * 28.0)
		var a := t + Vector3(cos(ang), sin(ang), 0.1) * 0.8
		var b := a + Vector3(cos(ang - 0.5), sin(ang - 0.5), 0.15) * rng.randf_range(1.0, 1.5)
		PlaceholderMeshes.segment(_gen, a, b, 0.18, _nail, 0.0)
		_sample(_gen, (a + b) * 0.5, 0.5)


func _build_hair(rng: RandomNumberGenerator) -> void:
	_hair_patch(Vector3(-2.5, 5.4, -3.4), 3.0, 240, rng)
	_hair_patch(Vector3(-6.0, 2.2, -3.8), 3.4, 130, rng)
	for p in [Vector3(-2.5, 8.2, -2.0), Vector3(-4.6, 7.0, -1.4), Vector3(-0.4, 7.4, -1.6), Vector3(-6.8, 5.0, -1.5)]:
		_sample(_gen, p, 1.5)


func _hair_patch(center: Vector3, radius: float, count: int, rng: RandomNumberGenerator) -> void:
	var strand := CylinderMesh.new()
	strand.top_radius = 0.006
	strand.bottom_radius = 0.035
	strand.height = 1.0
	strand.radial_segments = 4
	strand.rings = 1
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = strand
	mm.instance_count = count
	var i := 0
	var guard := 0
	while i < count and guard < count * 20:
		guard += 1
		var n := Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-1, 1))
		if n.length_squared() > 1.0 or n.length_squared() < 0.01:
			continue
		n = n.normalized()
		if n.y < 0.05 or n.z < -0.25:
			continue
		var length := rng.randf_range(1.2, 3.0)
		var dir := (n + Vector3(rng.randf_range(-0.6, 0.6), -0.35, rng.randf_range(-0.6, 0.3))).normalized()
		dir.z = minf(dir.z, 0.3)
		dir = dir.normalized()
		var root := center + n * radius * 0.92
		var b := PlaceholderMeshes.basis_along(dir) * Basis.from_scale(Vector3(1.0, length, 1.0))
		mm.set_instance_transform(i, Transform3D(b, root + dir * length * 0.5))
		i += 1
	mm.visible_instance_count = i
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _hair
	_gen.add_child(mmi)


func _build_chunks(rng: RandomNumberGenerator) -> void:
	var spots := [Vector3(-10.5, -6.5, -1.5), Vector3(9.5, 6.5, -1.8), Vector3(0.5, -9.0, -2.2),
			Vector3(-12.0, 1.5, -2.0), Vector3(10.5, -5.0, -1.2), Vector3(5.0, 8.0, -2.4)]
	for p in spots:
		_blob(p, rng.randf_range(0.6, 1.2), Vector3(1.0, rng.randf_range(0.6, 1.0), 0.8), rng, 0.5, false, _skin_dark, PI)
