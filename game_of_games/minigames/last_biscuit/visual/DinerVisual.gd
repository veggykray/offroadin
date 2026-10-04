class_name LBDinerVisual
extends Node3D
## Procedural puppet for a diner: chair, body, arms, head, moving eyes with
## lids, eyebrows, nose, hair and a per-character costume. It only *reads*
## LBDiner state, so it can be replaced with proper art later.

var d: LBDiner
var torso: Node3D
var head: Node3D
var eyes: Array[Node3D] = []
var lids_up: Array[Node3D] = []
var lids_low: Array[Node3D] = []
var brows: Array[Node3D] = []
var mouth: MeshInstance3D
var glasses: Node3D
var glasses_rest := Transform3D.IDENTITY
var point_arm: Node3D
var point_hand_open: Node3D
var point_finger: Node3D
var rest_arm_near: Node3D
var ear_hand: Node3D
var hands_rest: Node3D
var shoulder_l: Node3D
var sus_icon: MeshInstance3D
var sus_mat: ShaderMaterial
var reflection: MeshInstance3D
var reflection_mat: ShaderMaterial
var _t := 0.0
var _skin: Material
var _cam: Camera3D


func setup(diner: LBDiner) -> void:
	d = diner
	rotation.y = -PI * 0.5 if d.side < 0.0 else PI * 0.5
	_skin = LBMat.skin(d.palette_skin, float(d.index) * 13.7)
	_build_chair()
	_build_body()
	_build_head()
	_build_costume()
	sus_icon = MeshInstance3D.new()
	sus_icon.mesh = LBMesh.quad_mesh(Vector2(0.46, 0.27))
	sus_mat = LBMat.shader_unique("suspicion_eye.gdshader")
	sus_icon.material_override = sus_mat
	sus_icon.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sus_icon.top_level = true
	add_child(sus_icon)


# ------------------------------------------------------------ construction

func _build_chair() -> void:
	var wood := LBMat.dark_wood()
	var velvet := LBMat.velvet(Color(0.3, 0.05, 0.07) if d.index % 2 == 0 else Color(0.08, 0.16, 0.1))
	var c := LBMesh.pivot(self, Vector3(0, 0, 0.12), "Chair")
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.5, 0.06, 0.48)), wood, Vector3(0, 0.46, 0))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.46, 0.05, 0.44)), velvet, Vector3(0, 0.5, 0))
	for x in [-0.22, 0.22]:
		for z in [-0.2, 0.2]:
			LBMesh.add(c, LBMesh.cyl_mesh(0.02, 0.016, 0.46, 8), wood, Vector3(x, 0.23, z))
	# tall carved back
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.5, 1.15, 0.05)), wood, Vector3(0, 1.05, 0.23))
	LBMesh.add(c, LBMesh.box_mesh(Vector3(0.38, 0.85, 0.02)), velvet, Vector3(0, 1.02, 0.2))
	for x in [-0.25, 0.25]:
		LBMesh.add(c, LBMesh.sphere_mesh(0.04, 10), LBMat.gold(), Vector3(x, 1.66, 0.23))
	LBMesh.add(c, LBMesh.cyl_mesh(0.05, 0.05, 0.52, 12), wood, Vector3(0, 1.63, 0.23), Vector3(0, 0, 90))


func _build_body() -> void:
	var suit := LBMat.cloth(d.palette_suit)
	torso = LBMesh.pivot(self, Vector3(0, 0.5, 0.05), "Torso")
	LBMesh.add(torso, LBMesh.capsule_mesh(0.19, 0.66, 16), suit, Vector3(0, 0.27, 0), Vector3.ZERO, Vector3(1.12, 1.0, 0.78))
	# shirt front + collar
	LBMesh.add(torso, LBMesh.sphere_mesh(0.1, 12), LBMat.cloth(Color(0.9, 0.88, 0.82)), Vector3(0, 0.5, -0.1), Vector3(-8, 0, 0), Vector3(0.6, 1.2, 0.5))
	for s in [-1.0, 1.0]:
		LBMesh.add(torso, LBMesh.sphere_mesh(0.085, 12), suit, Vector3(0.17 * s, 0.56, 0.0), Vector3.ZERO, Vector3(1.1, 0.8, 0.9))
	# neck
	LBMesh.add(torso, LBMesh.cyl_mesh(0.045, 0.055, 0.12, 12), _skin, Vector3(0, 0.66, -0.01))
	# resting forearms on the table edge, hands clasped
	hands_rest = LBMesh.pivot(torso, Vector3.ZERO, "HandsRest")
	for s in [-1.0, 1.0]:
		var upper := LBMesh.add(hands_rest, LBMesh.capsule_mesh(0.055, 0.32, 10), suit, Vector3(0.2 * s, 0.38, -0.06), Vector3(25, 0, -8 * s))
		var fore := LBMesh.add(hands_rest, LBMesh.capsule_mesh(0.05, 0.3, 10), suit, Vector3(0.13 * s, 0.27, -0.25), Vector3(-80, 0, 0) , Vector3.ONE)
		fore.rotation_degrees = Vector3(-82, -28 * s, 0)
		LBMesh.add(hands_rest, LBMesh.sphere_mesh(0.042, 10), _skin, Vector3(0.04 * s, 0.27, -0.39), Vector3.ZERO, Vector3(1.0, 0.7, 1.2))
		upper.name = "upper_%d" % int(s)
	# pointing / reaching arm (hidden until needed)
	point_arm = LBMesh.pivot(torso, Vector3(0.18 * _near_sign(), 0.56, -0.02), "PointArm")
	LBMesh.add(point_arm, LBMesh.capsule_mesh(0.05, 0.62, 10), suit, Vector3(0, 0, -0.3), Vector3(-90, 0, 0))
	LBMesh.add(point_arm, LBMesh.cyl_mesh(0.045, 0.045, 0.04, 12), LBMat.cloth(Color(0.92, 0.9, 0.84)), Vector3(0, 0, -0.6), Vector3(90, 0, 0))
	point_finger = LBMesh.pivot(point_arm, Vector3(0, 0, -0.66))
	LBMesh.add(point_finger, LBMesh.sphere_mesh(0.04, 10), _skin, Vector3.ZERO, Vector3.ZERO, Vector3(0.9, 0.7, 1.1))
	LBMesh.add(point_finger, LBMesh.capsule_mesh(0.011, 0.075, 8), _skin, Vector3(0, 0.005, -0.06), Vector3(-90, 0, 0))
	point_hand_open = LBMesh.pivot(point_arm, Vector3(0, 0, -0.66))
	LBMesh.add(point_hand_open, LBMesh.sphere_mesh(0.045, 10), _skin, Vector3.ZERO, Vector3.ZERO, Vector3(1.0, 0.45, 1.3))
	for i in 4:
		LBMesh.add(point_hand_open, LBMesh.capsule_mesh(0.01, 0.06, 6), _skin, Vector3(-0.026 + i * 0.017, 0, -0.06), Vector3(-90, 0, 0))
	point_arm.visible = false
	# hand cupped behind the ear (Blind Listener) / fiddling hand
	ear_hand = LBMesh.pivot(torso, Vector3(0.14 * _near_sign(), 0.72, 0.0), "EarHand")
	LBMesh.add(ear_hand, LBMesh.capsule_mesh(0.045, 0.26, 8), suit, Vector3(0, -0.12, 0.02), Vector3(10, 0, 0))
	LBMesh.add(ear_hand, LBMesh.sphere_mesh(0.04, 10), _skin, Vector3(0.02 * _near_sign(), 0.03, 0.0), Vector3.ZERO, Vector3(0.6, 1.1, 1.0))
	ear_hand.visible = false


## +1 / -1 local x pointing towards Bill's end of the table.
func _near_sign() -> float:
	# local -z faces the table; local +x points to Bill (+z world) for left
	# diners and to the far end for right diners.
	return 1.0 if d.side < 0.0 else -1.0


func _build_head() -> void:
	head = LBMesh.pivot(torso, Vector3(0, 0.76, -0.02), "Head")
	# caricature-sized heads: faces must read from across the room
	head.scale = Vector3.ONE * 1.45
	var skull := LBMesh.add(head, LBMesh.sphere_mesh(0.12, 24), _skin, Vector3(0, 0.07, 0), Vector3.ZERO, Vector3(0.93, 1.08, 1.0))
	skull.name = "Skull"
	# jowls / chin
	LBMesh.add(head, LBMesh.sphere_mesh(0.085, 16), _skin, Vector3(0, -0.005, -0.03), Vector3.ZERO, Vector3(1.05, 0.8, 0.95))
	# ears
	for s in [-1.0, 1.0]:
		LBMesh.add(head, LBMesh.sphere_mesh(0.03, 10), _skin, Vector3(0.112 * s, 0.06, 0.01), Vector3.ZERO, Vector3(0.45, 1.2, 0.8))
	# eyes
	var eye_scale := 1.0
	if d.behaviour == LBDiner.Behaviour.DEAF_WATCHER:
		eye_scale = 1.45
	for s in [-1.0, 1.0]:
		var ep := LBMesh.pivot(head, Vector3(0.042 * s, 0.085, -0.092))
		var holder := LBMesh.pivot(ep, Vector3.ZERO)
		LBMesh.add(holder, LBMesh.sphere_mesh(0.024 * eye_scale, 14), LBMat.eye_white(), Vector3.ZERO)
		LBMesh.add(holder, LBMesh.sphere_mesh(0.0145 * eye_scale, 10), LBMat.std("iris_%d" % d.index, _iris_color(), 0.0, 0.2), Vector3(0, 0, -0.016 * eye_scale), Vector3.ZERO, Vector3(1, 1, 0.5))
		LBMesh.add(holder, LBMesh.sphere_mesh(0.0082 * eye_scale, 8), LBMat.pupil(), Vector3(0, 0, -0.0222 * eye_scale), Vector3.ZERO, Vector3(1, 1, 0.4))
		eyes.append(holder)
		var lu := LBMesh.pivot(ep, Vector3.ZERO)
		LBMesh.add(lu, LBMesh.hemi_mesh(0.0275 * eye_scale, 14), _skin, Vector3.ZERO)
		lids_up.append(lu)
		var ll := LBMesh.pivot(ep, Vector3.ZERO)
		LBMesh.add(ll, LBMesh.hemi_mesh(0.0272 * eye_scale, 14), _skin, Vector3.ZERO)
		lids_low.append(ll)
		# bags under the eyes
		LBMesh.add(head, LBMesh.sphere_mesh(0.02, 8), _skin, Vector3(0.044 * s, 0.058, -0.094), Vector3.ZERO, Vector3(1.3, 0.5, 0.6))
		var b := LBMesh.pivot(head, Vector3(0.044 * s, 0.123 + (eye_scale - 1.0) * 0.02, -0.098))
		LBMesh.add(b, LBMesh.box_mesh(Vector3(0.058, 0.014, 0.02)), LBMat.hair(d.palette_hair.darkened(0.15)), Vector3(0.004 * s, 0, 0), Vector3(0, 0, -8.0 * s))
		brows.append(b)
	# nose
	var nose_scale := Vector3(0.75, 1.0, 1.25)
	match d.behaviour:
		LBDiner.Behaviour.SLEEPER: nose_scale = Vector3(1.0, 1.0, 1.1)
		LBDiner.Behaviour.CHEAT: nose_scale = Vector3(0.55, 0.85, 1.7)
		LBDiner.Behaviour.TWITCH: nose_scale = Vector3(0.6, 1.2, 1.9)
	LBMesh.add(head, LBMesh.sphere_mesh(0.026, 12), LBMat.skin(d.palette_skin.lerp(Color(0.85, 0.45, 0.4), 0.3), 3.0), Vector3(0, 0.045, -0.12), Vector3(-15, 0, 0), nose_scale)
	# mouth: a long-suffering line
	mouth = LBMesh.add(head, LBMesh.box_mesh(Vector3(0.05, 0.006, 0.01)), LBMat.std("mouth", Color(0.35, 0.1, 0.1), 0.0, 0.6), Vector3(0, -0.012, -0.104))
	for s in [-1.0, 1.0]:
		LBMesh.add(head, LBMesh.box_mesh(Vector3(0.014, 0.005, 0.01)), LBMat.std("mouth", Color(0.35, 0.1, 0.1), 0.0, 0.6), Vector3(0.029 * s, -0.017, -0.1), Vector3(0, 0, 30 * s))


func _iris_color() -> Color:
	match d.behaviour:
		LBDiner.Behaviour.DEAF_WATCHER: return Color(0.2, 0.45, 0.6)
		LBDiner.Behaviour.CHEAT: return Color(0.25, 0.3, 0.12)
	return Color(0.3, 0.22, 0.14)


func _build_costume() -> void:
	var hair := LBMat.hair(d.palette_hair)
	match d.behaviour:
		LBDiner.Behaviour.SLEEPER:
			# bald dome, white side tufts, droopy walrus moustache, tweed
			for s in [-1.0, 1.0]:
				LBMesh.add(head, LBMesh.sphere_mesh(0.045, 10), hair, Vector3(0.095 * s, 0.09, 0.04), Vector3.ZERO, Vector3(0.6, 0.8, 1.2))
			LBMesh.add(head, LBMesh.capsule_mesh(0.018, 0.11, 8), hair, Vector3(0, 0.015, -0.115), Vector3(0, 0, 90), Vector3(1, 1, 1))
			for s in [-1.0, 1.0]:
				LBMesh.add(head, LBMesh.capsule_mesh(0.012, 0.05, 6), hair, Vector3(0.05 * s, -0.01, -0.11), Vector3(0, 0, 20 * s))
			LBMesh.add(torso, LBMesh.box_mesh(Vector3(0.05, 0.03, 0.02)), LBMat.cloth(Color(0.5, 0.1, 0.1)), Vector3(0, 0.6, -0.15))
		LBDiner.Behaviour.GLASSES:
			# grey bun, pearls, lace collar, and THE glasses
			LBMesh.add(head, LBMesh.sphere_mesh(0.125, 16), hair, Vector3(0, 0.1, 0.012), Vector3.ZERO, Vector3(0.98, 1.0, 1.02))
			LBMesh.add(head, LBMesh.sphere_mesh(0.06, 12), hair, Vector3(0, 0.2, 0.06))
			for i in 9:
				var a := -0.9 + i * 0.225
				LBMesh.add(torso, LBMesh.sphere_mesh(0.013, 8), LBMat.std("pearl", Color(0.95, 0.93, 0.88), 0.2, 0.15), Vector3(sin(a) * 0.08, 0.6 - cos(a) * 0.04 + 0.04, -0.13 + absf(sin(a)) * 0.04))
			glasses = _make_glasses(Color(0.85, 0.7, 0.35), false)
		LBDiner.Behaviour.TWITCH:
			# wild hair spikes, bow tie
			for i in 11:
				var a := -1.3 + i * 0.26
				LBMesh.add(head, LBMesh.capsule_mesh(0.016, 0.1, 6), hair, Vector3(sin(a) * 0.1, 0.16 + cos(a) * 0.02, 0.03 + cos(a * 2.0) * 0.03), Vector3(_rnd(i) * 40.0, 0, -a * 50.0))
			for s in [-1.0, 1.0]:
				LBMesh.add(torso, LBMesh.prism_mesh(Vector3(0.05, 0.04, 0.02)), LBMat.cloth(Color(0.55, 0.45, 0.1)), Vector3(0.027 * s, 0.61, -0.155), Vector3(0, 0, 90 * s))
		LBDiner.Behaviour.DEAF_WATCHER:
			# towering white hair, choker, brass ear trumpet
			LBMesh.add(head, LBMesh.sphere_mesh(0.13, 16), hair, Vector3(0, 0.12, 0.02))
			LBMesh.add(head, LBMesh.capsule_mesh(0.09, 0.32, 12), hair, Vector3(0, 0.3, 0.03))
			LBMesh.add(head, LBMesh.torus_mesh(0.035, 0.05, 16, 6), LBMat.gold(), Vector3(0, 0.4, 0.03), Vector3(90, 0, 0))
			var trumpet := LBMesh.pivot(head, Vector3(0.12 * _near_sign() * -1.0, 0.06, 0.02))
			LBMesh.add(trumpet, LBMesh.cyl_mesh(0.07, 0.012, 0.2, 14), LBMat.gold(), Vector3(-0.08 * _near_sign() * -1.0, -0.02, 0.04), Vector3(0, 0, 90 * _near_sign()))
			LBMesh.add(torso, LBMesh.torus_mesh(0.05, 0.062, 16, 6), LBMat.cloth(Color(0.05, 0.05, 0.05)), Vector3(0, 0.66, -0.01))
		LBDiner.Behaviour.BLIND_LISTENER:
			# mutton chops, dark round spectacles, medals
			for s in [-1.0, 1.0]:
				LBMesh.add(head, LBMesh.sphere_mesh(0.04, 10), hair, Vector3(0.09 * s, 0.01, -0.03), Vector3.ZERO, Vector3(0.6, 1.4, 1.0))
			LBMesh.add(head, LBMesh.sphere_mesh(0.118, 14), hair, Vector3(0, 0.12, 0.03), Vector3.ZERO, Vector3(1.0, 0.6, 1.0))
			glasses = _make_glasses(Color(0.1, 0.1, 0.1), true)
			for i in 3:
				LBMesh.add(torso, LBMesh.cyl_mesh(0.016, 0.016, 0.006, 12), LBMat.gold(), Vector3(-0.08 + i * 0.035, 0.5, -0.148), Vector3(90, 0, 0))
				LBMesh.add(torso, LBMesh.box_mesh(Vector3(0.022, 0.03, 0.006)), LBMat.cloth(Color(0.6, 0.1, 0.1 + i * 0.2)), Vector3(-0.08 + i * 0.035, 0.53, -0.148))
			# white cane against the chair
			LBMesh.add(self, LBMesh.cyl_mesh(0.01, 0.01, 0.95, 8), LBMat.std("cane", Color(0.92, 0.9, 0.86), 0.0, 0.4), Vector3(0.28, 0.48, 0.0), Vector3(0, 0, 12))
		LBDiner.Behaviour.CHEAT:
			# slick dyed hair, pencil moustache, smoking jacket lapels
			LBMesh.add(head, LBMesh.sphere_mesh(0.123, 16), LBMat.std("slick", Color(0.05, 0.04, 0.035), 0.0, 0.15), Vector3(0, 0.105, 0.02), Vector3(0, 0, 0), Vector3(0.98, 0.88, 1.03))
			LBMesh.add(head, LBMesh.box_mesh(Vector3(0.05, 0.005, 0.008)), LBMat.std("slick", Color(0.05, 0.04, 0.035), 0.0, 0.15), Vector3(0, 0.013, -0.113))
			for s in [-1.0, 1.0]:
				LBMesh.add(torso, LBMesh.box_mesh(Vector3(0.05, 0.22, 0.02)), LBMat.velvet(Color(0.08, 0.04, 0.04)), Vector3(0.06 * s, 0.48, -0.15), Vector3(-8, 0, -14 * s))


func _rnd(i: int) -> float:
	return fmod(sin(float(i) * 12.9898 + d.index) * 43758.5453, 1.0)


func _make_glasses(frame_col: Color, dark: bool) -> Node3D:
	var g := LBMesh.pivot(head, Vector3(0, 0.085, -0.118), "Glasses")
	var fm := LBMat.std("frame_%s" % frame_col.to_html(), frame_col, 0.8, 0.3)
	for s in [-1.0, 1.0]:
		LBMesh.add(g, LBMesh.torus_mesh(0.024, 0.029, 20, 6), fm, Vector3(0.044 * s, 0, 0), Vector3(90, 0, 0))
		var lens := LBMat.std("lens_dark", Color(0.02, 0.02, 0.03), 0.3, 0.1) if dark else LBMat.glass(Color(0.85, 0.9, 1.0, 0.18))
		LBMesh.add(g, LBMesh.cyl_mesh(0.025, 0.025, 0.003, 18), lens, Vector3(0.044 * s, 0, 0), Vector3(90, 0, 0))
		LBMesh.add(g, LBMesh.box_mesh(Vector3(0.004, 0.004, 0.11)), fm, Vector3(0.072 * s, 0.004, 0.055))
	LBMesh.add(g, LBMesh.box_mesh(Vector3(0.03, 0.004, 0.004)), fm, Vector3(0, 0.008, 0))
	glasses_rest = g.transform
	return g


func attach_reflection(teapot: LBTableObject) -> void:
	reflection = MeshInstance3D.new()
	reflection.mesh = LBMesh.quad_mesh(Vector2(0.15, 0.085))
	reflection_mat = LBMat.shader_unique("reflection_eyes.gdshader")
	reflection.material_override = reflection_mat
	reflection.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	teapot.add_child(reflection)
	reflection.position = Vector3(0, 0.135, 0.0)


# --------------------------------------------------------------- animation

func _process(dt: float) -> void:
	if d == null:
		return
	_t += dt
	if _cam == null:
		_cam = get_viewport().get_camera_3d()
	var fwd := Vector2(-d.side, 0.0)
	# torso: lean towards the table, breathing, tics, sneeze wind-up
	var breathe := sin(_t * 1.1 + d.index) * 0.012
	torso.rotation = Vector3(-d.lean * 0.32 - d.reaching * 0.25 + d.sneeze_wind * 0.25 + breathe, 0.0, d.tic * 0.08 * sin(_t * 60.0))
	torso.position.y = 0.5 + d.jolt * 0.03 + d.tic * 0.01
	# head yaw relative to the body
	var rel := -fwd.angle_to(d.head_dir)
	rel = clampf(rel, -1.45, 1.45)
	# head pitch follows how far away they're looking: down at the plate = chin down
	var pitch := -atan2(0.5, d.look_dist) * 0.9
	pitch -= d.head_drop * 0.95
	pitch += d.sneeze_wind * 0.5
	head.rotation = Vector3(pitch + d.lean * 0.18, rel, d.head_tilt * -d.side + d.head_drop * 0.15 * d.side)
	# eyes relative to head
	var eye_rel := -d.head_dir.angle_to(d.eye_dir)
	for e in eyes:
		e.rotation = Vector3(-0.15 + d.head_drop * 0.2, clampf(eye_rel, -0.7, 0.7), 0.0)
	var lid_angle := lerpf(deg_to_rad(52.0), deg_to_rad(-95.0), clampf(d.lids + d.narrow * 0.3, -0.2, 1.0))
	if d.glare > 0.0:
		lid_angle = minf(lid_angle, deg_to_rad(-30.0))
	# occasional blink
	var blink := fmod(_t + d.index * 1.7, 4.3)
	if blink < 0.12 and d.lids < 0.9:
		lid_angle = deg_to_rad(-95.0)
	for l in lids_up:
		l.rotation = Vector3(lid_angle, 0, 0)
	for l in lids_low:
		l.rotation = Vector3(PI - deg_to_rad(28.0) + deg_to_rad(70.0) * d.narrow, 0, 0)
	for i in brows.size():
		var s := -1.0 if i == 0 else 1.0
		var raise := d.brow * (0.018 + (0.012 * d.brow_asym if i == 1 else 0.0))
		var furrow := d.narrow * 0.01
		brows[i].position.y = 0.123 + raise - furrow + d.jolt * 0.015
		brows[i].rotation.z = deg_to_rad(-8.0 * s) + s * d.narrow * 0.35 - s * d.brow * 0.15
	mouth.scale = Vector3(1.0 - d.mouth_open * 0.4, 1.0 + d.mouth_open * 4.0, 1.0)
	# glasses: on the face or polished at chest height
	if glasses:
		var off := d.glasses_off
		var chest := Transform3D(Basis(Vector3.RIGHT, -0.9), Vector3(0, -0.3, -0.2))
		glasses.transform = glasses_rest.interpolate_with(chest, clampf(off, 0.0, 1.0))
		if off > 0.6:
			glasses.position.x += sin(_t * 18.0) * 0.015
			glasses.rotation.z = sin(_t * 9.0) * 0.3
	_update_arms(dt)
	_update_reflection()
	# floating suspicion eye above the head (Bill's suspicion only)
	var sv: float = d.suspicion.get_value(d.manager.player) if d.manager else 0.0
	sus_icon.global_position = head.global_position + Vector3(0, 0.62, 0)
	sus_mat.set_shader_parameter("amount", sv)
	sus_mat.set_shader_parameter("pulse", (0.5 + 0.5 * sin(_t * 14.0)) * smoothstep(0.6, 0.9, sv))
	sus_icon.scale = Vector3.ONE * (1.0 + sv * 0.6)


func _update_arms(_dt: float) -> void:
	var p := maxf(d.pointing, d.reaching)
	point_arm.visible = p > 0.02
	if point_arm.visible:
		var target := d.point_at
		var from := point_arm.global_position
		var dir := target - from
		if dir.length() > 0.01:
			var aim := point_arm.global_transform.looking_at(target, Vector3.UP)
			var rest := Transform3D(torso.global_transform.basis * Basis(Vector3.RIGHT, -1.2), from)
			point_arm.global_transform = rest.interpolate_with(Transform3D(aim.basis, from), p)
		var reach_len := clampf(dir.length() / 0.66, 0.6, 2.6)
		point_arm.scale = Vector3(1, 1, lerpf(0.4, reach_len, p) if d.reaching > 0.0 else lerpf(0.4, 1.0, p))
		point_finger.visible = d.pointing >= d.reaching
		point_hand_open.visible = not point_finger.visible
	ear_hand.visible = d.cup_ear > 0.05 or d.glasses_off > 0.3
	if ear_hand.visible:
		if d.behaviour == LBDiner.Behaviour.GLASSES:
			ear_hand.position = Vector3(0.0, 0.5, -0.2)
			ear_hand.rotation = Vector3(-1.2, 0, 0)
		else:
			ear_hand.position = Vector3(0.14 * _near_sign() * -1.0, lerpf(0.5, 0.82, d.cup_ear), 0.0)
			ear_hand.rotation = Vector3(0, 0, -0.3 * _near_sign())


func _update_reflection() -> void:
	if reflection == null:
		return
	if _cam:
		var p := reflection.global_position
		var to_cam := _cam.global_position - p
		to_cam.y = 0.0
		if to_cam.length() > 0.01:
			# sit on the side of the pot facing the camera, slightly towards the Cheat
			var tp := reflection.get_parent() as Node3D
			var off := to_cam.normalized() * 0.1
			reflection.global_position = tp.global_position + Vector3(off.x, 0.13, off.z)
			reflection.look_at(_cam.global_position, Vector3.UP)
			reflection.rotate_object_local(Vector3.UP, PI)
	reflection_mat.set_shader_parameter("look", d.mirror_dir)
	reflection_mat.set_shader_parameter("open_amount", clampf(d.mirror_open, 0.05, 1.0))
	reflection_mat.set_shader_parameter("narrow", d.narrow)
	var vis := 1.0
	if d.teapot == null or not d.teapot.on_table:
		vis = 0.0
	reflection_mat.set_shader_parameter("visible", vis * (0.35 + 0.65 * d.mirror_open))
