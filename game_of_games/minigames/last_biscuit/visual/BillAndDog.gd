class_name LBBillVisual
extends Node3D
## Bill, seen from behind: hunched tweed shoulders and a bald head with a
## white horseshoe of hair. His right arm is drawn by the player hand.
## Also owns the DOG that lives under the table (ending).

var head: Node3D
var dog: Node3D
var dog_jaw: Node3D
var dog_head: Node3D
var look_target := Vector3(0, 0.8, 0)
var _t := 0.0


func build() -> void:
	position = Vector3(0, 0, 5.72)
	var tweed := LBMat.cloth(Color(0.3, 0.24, 0.16))
	var skin := LBMat.skin(Color(0.86, 0.74, 0.7), 77.0)
	var hair := LBMat.hair(Color(0.92, 0.92, 0.9))
	var torso := LBMesh.pivot(self, Vector3(0, 0.55, 0.12), "Torso")
	LBMesh.add(torso, LBMesh.capsule_mesh(0.23, 0.75, 16), tweed, Vector3(0, 0.3, 0), Vector3(-12, 0, 0), Vector3(1.35, 1.0, 0.85))
	LBMesh.add(torso, LBMesh.capsule_mesh(0.09, 0.62, 12), tweed, Vector3(0, 0.6, -0.02), Vector3(0, 0, 90), Vector3(1.0, 1.0, 0.9))
	# left arm resting on the table edge
	LBMesh.add(torso, LBMesh.capsule_mesh(0.06, 0.4, 10), tweed, Vector3(-0.26, 0.42, -0.12), Vector3(30, 0, 10))
	LBMesh.add(torso, LBMesh.capsule_mesh(0.055, 0.36, 10), tweed, Vector3(-0.2, 0.3, -0.38), Vector3(-80, -15, 0))
	LBMesh.add(torso, LBMesh.sphere_mesh(0.045, 10), skin, Vector3(-0.15, 0.27, -0.56), Vector3.ZERO, Vector3(1, 0.6, 1.3))
	LBMesh.add(torso, LBMesh.cyl_mesh(0.06, 0.07, 0.1, 12), LBMat.cloth(Color(0.9, 0.88, 0.82)), Vector3(0, 0.7, -0.02))
	head = LBMesh.pivot(torso, Vector3(0, 0.8, -0.04), "Head")
	LBMesh.add(head, LBMesh.sphere_mesh(0.125, 24), skin, Vector3(0, 0.07, 0), Vector3.ZERO, Vector3(0.95, 1.05, 1.02))
	for s in [-1.0, 1.0]:
		LBMesh.add(head, LBMesh.sphere_mesh(0.032, 10), skin, Vector3(0.118 * s, 0.06, 0.0), Vector3.ZERO, Vector3(0.45, 1.2, 0.8))
	# horseshoe of white hair around the back
	for i in 9:
		var a := PI * 0.15 + i * PI * 0.0875
		LBMesh.add(head, LBMesh.sphere_mesh(0.04, 8), hair, Vector3(cos(a) * 0.11, 0.06, sin(a) * 0.1), Vector3.ZERO, Vector3(0.8, 0.7, 0.8))
	# three defiant strands on top
	for i in 3:
		LBMesh.add(head, LBMesh.capsule_mesh(0.004, 0.08, 4), hair, Vector3(-0.02 + i * 0.02, 0.2, 0.0), Vector3(0, 0, -25 + i * 25))
	_build_dog()


func _build_dog() -> void:
	dog = LBMesh.pivot(get_parent(), Vector3(0.62, -0.5, 5.25), "Dog")
	dog_head = LBMesh.pivot(dog, Vector3.ZERO, "DogHead")
	var fur := LBMat.shader("dogfur", "fur.gdshader", {"fur": Color(0.36, 0.22, 0.12), "tip": Color(0.7, 0.55, 0.38)})
	var dark := LBMat.std("dognose", Color(0.03, 0.02, 0.02), 0.0, 0.2)
	LBMesh.add(dog_head, LBMesh.sphere_mesh(0.22, 20), fur, Vector3(0, 0, 0), Vector3.ZERO, Vector3(1.0, 0.95, 1.05))
	# snout / upper jaw
	LBMesh.add(dog_head, LBMesh.capsule_mesh(0.1, 0.3, 14), fur, Vector3(0, -0.02, -0.22), Vector3(-90, 0, 0), Vector3(1.15, 1.0, 0.85))
	LBMesh.add(dog_head, LBMesh.sphere_mesh(0.045, 12), dark, Vector3(0, 0.02, -0.37))
	for s in [-1.0, 1.0]:
		# droopy ears
		LBMesh.add(dog_head, LBMesh.sphere_mesh(0.1, 12), fur, Vector3(0.2 * s, -0.04, 0.04), Vector3(0, 0, 20 * s), Vector3(0.4, 1.4, 0.8))
		# mad eyes
		LBMesh.add(dog_head, LBMesh.sphere_mesh(0.035, 10), LBMat.eye_white(), Vector3(0.09 * s, 0.08, -0.16))
		LBMesh.add(dog_head, LBMesh.sphere_mesh(0.018, 8), LBMat.pupil(), Vector3(0.09 * s, 0.085, -0.19))
	var tooth := LBMat.std("dogtooth", Color(0.95, 0.92, 0.8), 0.0, 0.3)
	for i in 6:
		LBMesh.add(dog_head, LBMesh.prism_mesh(Vector3(0.02, 0.035, 0.02)), tooth, Vector3(-0.06 + i * 0.024, -0.09, -0.3 + absf(i - 2.5) * 0.015), Vector3(180, 0, 0))
	dog_jaw = LBMesh.pivot(dog_head, Vector3(0, -0.08, -0.06), "Jaw")
	LBMesh.add(dog_jaw, LBMesh.capsule_mesh(0.08, 0.26, 12), fur, Vector3(0, -0.02, -0.14), Vector3(-90, 0, 0), Vector3(1.05, 1.0, 0.6))
	LBMesh.add(dog_jaw, LBMesh.capsule_mesh(0.05, 0.18, 10), LBMat.std("tongue", Color(0.8, 0.3, 0.35), 0.0, 0.3), Vector3(0, 0.02, -0.15), Vector3(-90, 0, 0), Vector3(1.0, 1.0, 0.4))
	for i in 5:
		LBMesh.add(dog_jaw, LBMesh.prism_mesh(Vector3(0.018, 0.03, 0.018)), tooth, Vector3(-0.05 + i * 0.025, 0.03, -0.24 + absf(i - 2.0) * 0.015))
	dog.visible = false


func _process(dt: float) -> void:
	_t += dt
	if head:
		var to := look_target - head.global_position
		var yaw := atan2(-to.x, -to.z)
		var pitch := atan2(to.y, Vector2(to.x, to.z).length())
		head.rotation.y = lerp_angle(head.rotation.y, clampf(yaw, -1.0, 1.0), LBConst.damp(5.0, dt))
		head.rotation.x = lerpf(head.rotation.x, clampf(pitch, -0.8, 0.4), LBConst.damp(5.0, dt))
