class_name LBBillVisual
extends Node3D
## Bill, seen from behind: a frail old man in a worn floral hospital gown
## (open at the back, ties dangling), a wild cloud of grey hair and a white
## beard. His right arm is drawn by the player hand.
## Also owns the DOG: the one under the table and the guest of honour.

var head: Node3D
var jaw: Node3D
var torso: Node3D
var dog: Node3D
var dog_jaw: Node3D
var dog_head: Node3D
var guest_dog: Node3D
var guest_head: Node3D
var guest_jaw: Node3D
var look_target := Vector3(0, 0.8, 0)
var chew_t := 0.0
var _t := 0.0


static func gown_material() -> Material:
	return LBMat.shader("gown", "gown.gdshader")


func build() -> void:
	position = Vector3(0, 0, 5.72)
	var gown := gown_material()
	var skin := LBMat.skin(Color(0.9, 0.8, 0.77), 77.0)
	var hair := LBMat.shader("bill_hair", "fur.gdshader", {"fur": Color(0.62, 0.62, 0.6), "tip": Color(0.95, 0.95, 0.93)})
	torso = LBMesh.pivot(self, Vector3(0, 0.55, 0.12), "Torso")
	# thin, hunched body inside a gown that is far too big for him
	LBMesh.add(torso, LBMesh.capsule_mesh(0.2, 0.72, 18), gown, Vector3(0, 0.3, 0), Vector3(-14, 0, 0), Vector3(1.3, 1.0, 0.85))
	LBMesh.add(torso, LBMesh.capsule_mesh(0.08, 0.56, 12), gown, Vector3(0, 0.6, -0.02), Vector3(0, 0, 90), Vector3(1.0, 1.0, 0.9))
	# the infamous open back: a strip of bony spine and two bows
	LBMesh.add(torso, LBMesh.capsule_mesh(0.035, 0.5, 8), skin, Vector3(0, 0.36, 0.158), Vector3(-14, 0, 0), Vector3(1.0, 1.0, 0.4))
	for y in [0.55, 0.3]:
		var tie := LBMesh.pivot(torso, Vector3(0, y, 0.18 - (0.55 - y) * 0.2))
		var tie_mat := LBMat.cloth(Color(0.82, 0.8, 0.72))
		for s in [-1.0, 1.0]:
			LBMesh.add(tie, LBMesh.sphere_mesh(0.022, 8), tie_mat, Vector3(0.022 * s, 0, 0), Vector3.ZERO, Vector3(1.2, 0.7, 0.4))
			LBMesh.add(tie, LBMesh.box_mesh(Vector3(0.012, 0.09, 0.004)), tie_mat, Vector3(0.012 * s, -0.05, 0.004), Vector3(0, 0, 10 * s))
	# gown collar and a scrawny neck
	LBMesh.add(torso, LBMesh.torus_mesh(0.06, 0.085, 18, 6), gown, Vector3(0, 0.69, -0.01))
	LBMesh.add(torso, LBMesh.cyl_mesh(0.045, 0.055, 0.12, 12), skin, Vector3(0, 0.74, -0.03))
	# left arm resting on the table edge: bare, thin, with a short gown sleeve
	LBMesh.add(torso, LBMesh.capsule_mesh(0.075, 0.2, 10), gown, Vector3(-0.27, 0.52, -0.06), Vector3(20, 0, 12))
	LBMesh.add(torso, LBMesh.capsule_mesh(0.035, 0.32, 10), skin, Vector3(-0.27, 0.38, -0.16), Vector3(35, 0, 10))
	LBMesh.add(torso, LBMesh.capsule_mesh(0.032, 0.34, 10), skin, Vector3(-0.2, 0.28, -0.38), Vector3(-80, -15, 0))
	LBMesh.add(torso, LBMesh.sphere_mesh(0.045, 10), skin, Vector3(-0.15, 0.27, -0.56), Vector3.ZERO, Vector3(1, 0.6, 1.3))
	# a hospital wristband
	LBMesh.add(torso, LBMesh.torus_mesh(0.03, 0.04, 14, 4), LBMat.std("wristband", Color(0.92, 0.94, 0.98), 0.0, 0.4), Vector3(-0.17, 0.27, -0.5), Vector3(80, -15, 0))
	head = LBMesh.pivot(torso, Vector3(0, 0.84, -0.05), "Head")
	LBMesh.add(head, LBMesh.sphere_mesh(0.12, 24), skin, Vector3(0, 0.07, 0), Vector3.ZERO, Vector3(0.95, 1.05, 1.02))
	for s in [-1.0, 1.0]:
		LBMesh.add(head, LBMesh.sphere_mesh(0.034, 10), skin, Vector3(0.116 * s, 0.05, 0.0), Vector3.ZERO, Vector3(0.45, 1.25, 0.8))
	# a wild, fluffy cloud of grey hair: soft clumps, mostly round the sides and
	# back, plus stray wisps curling off in every direction
	var rng := RandomNumberGenerator.new()
	rng.seed = 1931
	var hair2 := LBMat.shader("bill_hair2", "fur.gdshader", {"fur": Color(0.45, 0.45, 0.44), "tip": Color(0.8, 0.8, 0.78)})
	for i in 60:
		var a := rng.randf_range(0.0, TAU)
		var up := rng.randf_range(-0.35, 0.95)
		var dir := Vector3(cos(a) * sqrt(1.0 - up * up), up, sin(a) * sqrt(1.0 - up * up)).normalized()
		if dir.z < -0.25 and up < 0.6:
			continue  # leave the face clear
		var out := (dir + Vector3(rng.randf_range(-0.4, 0.4), rng.randf_range(-0.1, 0.4), rng.randf_range(-0.2, 0.4))).normalized()
		var clump := Node3D.new()
		head.add_child(clump)
		var base := Vector3(0, 0.08, 0.02) + dir * Vector3(0.12, 0.12, 0.125)
		clump.transform = Transform3D(Basis.looking_at(out, Vector3.UP if absf(out.y) < 0.95 else Vector3.FORWARD), base)
		var r := rng.randf_range(0.022, 0.04)
		LBMesh.add(clump, LBMesh.sphere_mesh(r, 8), hair if i % 4 else hair2, Vector3(0, 0, -r * 0.8), Vector3.ZERO, Vector3(0.8, 0.8, rng.randf_range(1.3, 2.4)))
	for i in 26:
		var a := rng.randf_range(0.0, TAU)
		var up := rng.randf_range(0.0, 1.0)
		var dir := Vector3(cos(a), up * 1.5, sin(a)).normalized()
		if dir.z < -0.3 and up < 0.5:
			continue
		var w := Node3D.new()
		head.add_child(w)
		var base := Vector3(0, 0.09, 0.02) + dir * 0.13
		w.transform = Transform3D(Basis.looking_at(dir, Vector3.UP if absf(dir.y) < 0.95 else Vector3.FORWARD), base)
		# two-segment curling wisp
		var l1 := rng.randf_range(0.04, 0.08)
		LBMesh.add(w, LBMesh.capsule_mesh(0.005, l1, 4), hair, Vector3(0, 0, -l1 * 0.45), Vector3(-90, 0, 0))
		var w2 := LBMesh.pivot(w, Vector3(0, 0, -l1 * 0.9))
		w2.rotation = Vector3(rng.randf_range(-0.9, 0.9), rng.randf_range(-0.9, 0.9), 0)
		var l2 := rng.randf_range(0.03, 0.07)
		LBMesh.add(w2, LBMesh.capsule_mesh(0.004, l2, 4), hair, Vector3(0, 0, -l2 * 0.45), Vector3(-90, 0, 0))
	# thinning scalp showing through on top
	LBMesh.add(head, LBMesh.sphere_mesh(0.112, 14), hair2, Vector3(0, 0.11, 0.04), Vector3.ZERO, Vector3(1.0, 0.7, 1.0))
	# a worried old face for when he turns: big nose, watery eyes, bushy brows
	LBMesh.add(head, LBMesh.sphere_mesh(0.03, 12), LBMat.skin(Color(0.9, 0.7, 0.66), 12.0), Vector3(0, 0.04, -0.125), Vector3(-15, 0, 0), Vector3(0.8, 1.0, 1.3))
	for s2 in [-1.0, 1.0]:
		LBMesh.add(head, LBMesh.sphere_mesh(0.02, 10), LBMat.eye_white(), Vector3(0.042 * s2, 0.085, -0.1))
		LBMesh.add(head, LBMesh.sphere_mesh(0.009, 8), LBMat.std("bill_iris", Color(0.3, 0.4, 0.5), 0.0, 0.2), Vector3(0.042 * s2, 0.085, -0.118))
		LBMesh.add(head, LBMesh.capsule_mesh(0.012, 0.06, 6), LBMat.hair(Color(0.88, 0.88, 0.85)), Vector3(0.045 * s2, 0.118, -0.102), Vector3(0, 0, 90 - 20 * s2))
	# scraggly white beard and moustache (seen when he turns his head)
	jaw = LBMesh.pivot(head, Vector3(0, -0.01, -0.03), "Jaw")
	var beard := LBMat.shader("bill_beard", "fur.gdshader", {"fur": Color(0.8, 0.8, 0.78), "tip": Color(0.98, 0.98, 0.96)})
	for i in 22:
		var a := rng.randf_range(-1.35, 1.35)
		var dn := rng.randf_range(0.0, 1.0)
		var p := Vector3(sin(a) * 0.085 * (1.0 - dn * 0.4), -0.03 - dn * 0.07, -0.05 - cos(a) * 0.04)
		var r := rng.randf_range(0.016, 0.026)
		LBMesh.add(jaw, LBMesh.sphere_mesh(r, 8), beard, p, Vector3(rng.randf() * 40.0, 0, 0), Vector3(1.0, 1.4, 0.9))
	_build_dog()
	_build_guest_dog()


## Builds a shaggy dog head under parent. Returns [head, jaw].
func _dog_head(parent: Node3D, bib := false) -> Array:
	var h := LBMesh.pivot(parent, Vector3.ZERO, "DogHead")
	var fur := LBMat.shader("dogfur", "fur.gdshader", {"fur": Color(0.36, 0.22, 0.12), "tip": Color(0.7, 0.55, 0.38)})
	var dark := LBMat.std("dognose", Color(0.03, 0.02, 0.02), 0.0, 0.2)
	LBMesh.add(h, LBMesh.sphere_mesh(0.22, 20), fur, Vector3.ZERO, Vector3.ZERO, Vector3(1.0, 0.95, 1.05))
	LBMesh.add(h, LBMesh.capsule_mesh(0.1, 0.3, 14), fur, Vector3(0, -0.02, -0.22), Vector3(-90, 0, 0), Vector3(1.15, 1.0, 0.85))
	LBMesh.add(h, LBMesh.sphere_mesh(0.045, 12), dark, Vector3(0, 0.02, -0.37))
	for s in [-1.0, 1.0]:
		LBMesh.add(h, LBMesh.sphere_mesh(0.1, 12), fur, Vector3(0.2 * s, -0.04, 0.04), Vector3(0, 0, 20 * s), Vector3(0.4, 1.4, 0.8))
		LBMesh.add(h, LBMesh.sphere_mesh(0.035, 10), LBMat.eye_white(), Vector3(0.09 * s, 0.08, -0.16))
		LBMesh.add(h, LBMesh.sphere_mesh(0.018, 8), LBMat.pupil(), Vector3(0.09 * s, 0.085, -0.19))
	var tooth := LBMat.std("dogtooth", Color(0.95, 0.92, 0.8), 0.0, 0.3)
	for i in 6:
		LBMesh.add(h, LBMesh.prism_mesh(Vector3(0.02, 0.035, 0.02)), tooth, Vector3(-0.06 + i * 0.024, -0.09, -0.3 + absf(i - 2.5) * 0.015), Vector3(180, 0, 0))
	var j := LBMesh.pivot(h, Vector3(0, -0.08, -0.06), "Jaw")
	LBMesh.add(j, LBMesh.capsule_mesh(0.08, 0.26, 12), fur, Vector3(0, -0.02, -0.14), Vector3(-90, 0, 0), Vector3(1.05, 1.0, 0.6))
	LBMesh.add(j, LBMesh.capsule_mesh(0.05, 0.18, 10), LBMat.std("tongue", Color(0.8, 0.3, 0.35), 0.0, 0.3), Vector3(0, 0.02, -0.15), Vector3(-90, 0, 0), Vector3(1.0, 1.0, 0.4))
	for i in 5:
		LBMesh.add(j, LBMesh.prism_mesh(Vector3(0.018, 0.03, 0.018)), tooth, Vector3(-0.05 + i * 0.025, 0.03, -0.24 + absf(i - 2.0) * 0.015))
	return [h, j]


func _build_dog() -> void:
	dog = LBMesh.pivot(get_parent(), Vector3(0.62, -0.5, 5.25), "Dog")
	var parts := _dog_head(dog)
	dog_head = parts[0]
	dog_jaw = parts[1]
	dog.visible = false


## The guest of honour: a large dog, sitting upright in the head chair,
## wearing a napkin bib. Faces down the table towards Bill.
func _build_guest_dog() -> void:
	guest_dog = LBMesh.pivot(get_parent(), Vector3(0, -2.0, -5.42), "GuestDog")
	guest_dog.rotation.y = PI     # look down the table (+z)
	guest_dog.scale = Vector3.ONE * 1.9
	var fur := LBMat.shader("dogfur", "fur.gdshader", {"fur": Color(0.36, 0.22, 0.12), "tip": Color(0.7, 0.55, 0.38)})
	LBMesh.add(guest_dog, LBMesh.capsule_mesh(0.2, 0.55, 16), fur, Vector3(0, 0.3, 0.05), Vector3(-10, 0, 0), Vector3(1.1, 1.0, 1.0))
	# paws on the table edge, very proper
	for s in [-1.0, 1.0]:
		LBMesh.add(guest_dog, LBMesh.capsule_mesh(0.05, 0.3, 10), fur, Vector3(0.12 * s, 0.25, -0.2), Vector3(-60, 0, 0))
		LBMesh.add(guest_dog, LBMesh.sphere_mesh(0.06, 10), fur, Vector3(0.12 * s, 0.18, -0.34), Vector3.ZERO, Vector3(1, 0.7, 1.3))
	# napkin bib
	LBMesh.add(guest_dog, LBMesh.prism_mesh(Vector3(0.3, 0.26, 0.02)), LBMat.cloth(Color(0.96, 0.95, 0.9)), Vector3(0, 0.42, -0.17), Vector3(170, 0, 0))
	var neck := LBMesh.pivot(guest_dog, Vector3(0, 0.66, -0.06))
	var parts := _dog_head(neck)
	guest_head = parts[0]
	guest_jaw = parts[1]
	guest_dog.visible = false


func _process(dt: float) -> void:
	_t += dt
	if head:
		var to := look_target - head.global_position
		var yaw := atan2(-to.x, -to.z)
		var pitch := atan2(to.y, Vector2(to.x, to.z).length())
		head.rotation.y = lerp_angle(head.rotation.y, clampf(yaw, -1.0, 1.0), LBConst.damp(5.0, dt))
		head.rotation.x = lerpf(head.rotation.x, clampf(pitch, -0.8, 0.4), LBConst.damp(5.0, dt))
	# guilty chewing: jaw and head bob
	if chew_t > 0.0:
		chew_t -= dt
		jaw.rotation.x = absf(sin(chew_t * 18.0)) * 0.25
		head.position.y = 0.84 + absf(sin(chew_t * 18.0)) * 0.01
	elif jaw:
		jaw.rotation.x = lerpf(jaw.rotation.x, 0.0, LBConst.damp(8.0, dt))
	if torso:
		torso.rotation.z = sin(_t * 0.9) * 0.01   # a frail little sway
