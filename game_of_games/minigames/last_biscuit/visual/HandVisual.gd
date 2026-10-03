class_name LBHandVisual
extends Node3D
## Placeholder arm + hand art. The sleeve is a tube from the shoulder to the
## wrist that thins out the further it stretches (deliberately absurd).
## Replace this node with skinned artwork later; it only reads LBHand state.

var hand: LBHand
var arm_im := ImmediateMesh.new()
var arm_mi := MeshInstance3D.new()
var hand_root: Node3D
var palm: MeshInstance3D
var fingers: Array[Node3D] = []
var thumb: Node3D
var fork_node: Node3D
var shadow_blob: MeshInstance3D
var sleeve_mat: Material
var cuff_mat: Material
var _t := 0.0


## Re-read the owner's colours (rivals get theirs after _ready).
func refresh_colors() -> void:
	sleeve_mat = LBMat.cloth(hand.sleeve_color, 0.9)
	var skin := LBMat.skin(hand.skin_color, float(hand.get_instance_id() % 97))
	for mi in hand_root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.material_override is ShaderMaterial:
			m.material_override = skin


func setup(h: LBHand) -> void:
	hand = h
	sleeve_mat = LBMat.cloth(h.sleeve_color, 0.9)
	cuff_mat = LBMat.cloth(h.cuff_color, 0.7)
	var skin := LBMat.skin(h.skin_color, float(h.get_instance_id() % 97))
	arm_mi.mesh = arm_im
	arm_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	arm_mi.top_level = true
	add_child(arm_mi)
	hand_root = Node3D.new()
	hand_root.top_level = true
	add_child(hand_root)
	# palm: a slightly cupped flattened ellipsoid
	palm = LBMesh.add(hand_root, LBMesh.sphere_mesh(0.05, 18), skin, Vector3(0, 0, 0), Vector3.ZERO, Vector3(1.0, 0.42, 1.2))
	# knuckle ridge
	LBMesh.add(hand_root, LBMesh.capsule_mesh(0.016, 0.085, 10), skin, Vector3(0, 0.006, -0.05), Vector3(0, 0, 90))
	# fingers: each a 2-segment chain so they can curl
	for i in 4:
		var x := -0.033 + i * 0.022
		var len_: float = [0.042, 0.05, 0.048, 0.036][i]
		var f := LBMesh.pivot(hand_root, Vector3(x, 0.0, -0.058))
		var seg1 := LBMesh.add(f, LBMesh.capsule_mesh(0.0105, len_, 8), skin, Vector3(0, 0, -len_ * 0.5), Vector3(-90, 0, 0))
		seg1.name = "seg1"
		var f2 := LBMesh.pivot(f, Vector3(0, 0, -len_ * 0.9))
		f2.name = "joint"
		LBMesh.add(f2, LBMesh.capsule_mesh(0.0095, len_ * 0.8, 8), skin, Vector3(0, 0, -len_ * 0.35), Vector3(-90, 0, 0))
		# fingernail
		LBMesh.add(f2, LBMesh.sphere_mesh(0.007, 8), LBMat.std("nail", Color(0.93, 0.8, 0.74), 0.0, 0.3), Vector3(0, 0.006, -len_ * 0.62), Vector3.ZERO, Vector3(1, 0.4, 1.3))
		fingers.append(f)
	thumb = LBMesh.pivot(hand_root, Vector3(-0.048, -0.004, -0.012))
	LBMesh.add(thumb, LBMesh.capsule_mesh(0.012, 0.05, 8), skin, Vector3(-0.012, 0, -0.022), Vector3(-90, 0, -35))
	# wrist + cuff
	LBMesh.add(hand_root, LBMesh.capsule_mesh(0.03, 0.07, 10), skin, Vector3(0, 0.004, 0.055), Vector3(90, 0, 0), Vector3(1.0, 0.75, 1.0))
	LBMesh.add(hand_root, LBMesh.cyl_mesh(0.039, 0.041, 0.035, 16), cuff_mat, Vector3(0, 0.006, 0.095), Vector3(90, 0, 0), Vector3(1.0, 0.8, 1.0))
	# cufflink
	LBMesh.add(hand_root, LBMesh.sphere_mesh(0.008, 8), LBMat.gold(), Vector3(0.036, 0.012, 0.095))
	# fork prop for the fork-wielding rival
	fork_node = LBMesh.pivot(hand_root, Vector3(0.0, 0.01, -0.03))
	LBMesh.add(fork_node, LBMesh.box_mesh(Vector3(0.012, 0.006, 0.17)), LBMat.silver(), Vector3(0, 0, -0.1))
	for i in 4:
		LBMesh.add(fork_node, LBMesh.box_mesh(Vector3(0.0035, 0.004, 0.05)), LBMat.silver(), Vector3(-0.009 + i * 0.006, 0, -0.205))
	fork_node.visible = false
	# soft contact shadow so the hand reads against the table
	shadow_blob = MeshInstance3D.new()
	shadow_blob.mesh = LBMesh.quad_mesh(Vector2(0.34, 0.42))
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.albedo_texture = _blob_texture()
	sm.albedo_color = Color(0, 0, 0, 0.55)
	shadow_blob.material_override = sm
	shadow_blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	shadow_blob.rotation_degrees = Vector3(-90, 0, 0)
	shadow_blob.top_level = true
	add_child(shadow_blob)


static var _blob_tex: Texture2D
static func _blob_texture() -> Texture2D:
	if _blob_tex:
		return _blob_tex
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 64
	t.height = 64
	_blob_tex = t
	return t


func _process(dt: float) -> void:
	if hand == null:
		return
	_t += dt
	var vis := hand.active or hand.reach_scale > 0.01
	arm_mi.visible = vis
	hand_root.visible = vis
	shadow_blob.visible = vis and hand.lift < 0.3
	if not vis:
		return
	var palm_pos := hand.palm_world()
	var dir2 := hand.vel
	# hand faces away from its shoulder along the table
	var sh := hand.shoulder
	var away := Vector3(palm_pos.x - sh.x, 0.0, palm_pos.z - sh.z)
	if away.length() < 0.01:
		away = Vector3(0, 0, -1)
	away = away.normalized()
	var yaw := atan2(-away.x, -away.z)
	# slap: quick lunge + flick
	var lunge := Vector3.ZERO
	var flick := 0.0
	if hand.slap_t > 0.0:
		var k := sin((1.0 - hand.slap_t / 0.16) * PI)
		lunge = Vector3(hand.slap_dir.x, 0.03, hand.slap_dir.y) * 0.09 * k
		flick = k
	# lean into movement for weight
	var lean := Vector3(dir2.x, 0, dir2.y) * 0.012
	var wrist_bob := sin(_t * 1.7 + float(hand.get_instance_id() % 13)) * 0.002
	hand_root.global_position = palm_pos + lunge + lean + Vector3(0, wrist_bob, 0)
	var b := Basis(Vector3.UP, yaw)
	# tilt slightly with sideways speed
	var side_speed := Vector2(away.z, -away.x).dot(dir2)
	b = b * Basis(Vector3(0, 0, 1), clampf(side_speed * 0.12, -0.35, 0.35) + flick * 0.5)
	b = b * Basis(Vector3(1, 0, 0), -0.12 + flick * -0.35 + hand.palm_up * 0.25)
	if hand.palm_up > 0.0:
		b = b * Basis(Vector3(0, 0, 1), hand.palm_up * PI)
	if hand.stunned_t > 0.0:
		b = b * Basis(Vector3(0, 1, 0), sin(_t * 40.0) * 0.18 * minf(hand.stunned_t, 1.0))
	hand_root.global_transform.basis = b.scaled(Vector3.ONE * hand.visual_scale)
	# fingers curl when gripping, splay when pinned/slapping
	var curl := hand.grip_closed * 1.1 - flick * 0.3
	if hand.palm_up > 0.0:
		curl = lerpf(curl, -0.25, hand.palm_up)
	for i in fingers.size():
		var f := fingers[i]
		var c := curl + sin(_t * 2.3 + i) * 0.04
		f.rotation = Vector3(-c * 0.8, 0.0, 0.0)
		(f.get_node("joint") as Node3D).rotation = Vector3(-c * 1.1, 0.0, 0.0)
	thumb.rotation = Vector3(0, -hand.grip_closed * 0.9, 0)
	fork_node.visible = hand.held_fork
	# shadow
	shadow_blob.global_position = Vector3(palm_pos.x, LBConst.TABLE_Y + 0.003, palm_pos.z) + lunge * Vector3(1, 0, 1)
	var sh_scale := 1.0 + hand.height_above_table() * 4.0
	shadow_blob.scale = Vector3.ONE * sh_scale
	(shadow_blob.material_override as StandardMaterial3D).albedo_color.a = 0.55 / sh_scale
	_draw_arm(palm_pos + lunge, away)


func _draw_arm(wrist_target: Vector3, away: Vector3) -> void:
	arm_im.clear_surfaces()
	var sh := hand.shoulder
	var wrist := wrist_target - away * 0.095 * hand.visual_scale + Vector3(0, 0.01 * hand.visual_scale, 0)
	if hand.reach_scale < 1.0:
		wrist = sh.lerp(wrist, hand.reach_scale)
	var length := sh.distance_to(wrist)
	# arc the arm up over the clutter: higher in the middle the longer it gets
	var mid := (sh + wrist) * 0.5 + Vector3(0, 0.12 + length * 0.07, 0)
	var n := 18
	var pts := PackedVector3Array()
	var radii := PackedFloat32Array()
	# stretching thins the sleeve (volume-ish conservation) for comedy
	var thin := clampf(1.6 / maxf(length, 0.6), 0.38, 1.0)
	for i in n:
		var t := float(i) / (n - 1)
		var p := LBMesh.bezier(sh, mid, wrist, t)
		# slight sag wobble
		p.y += sin(t * PI) * sin(_t * 1.3 + t * 4.0) * 0.006
		pts.append(p)
		var r := hand.sleeve_radius * lerpf(1.25, 0.82, t) * lerpf(1.0, thin, sin(t * PI))
		# a few fabric wrinkles
		r *= 1.0 + 0.06 * sin(t * length * 22.0)
		radii.append(r)
	LBMesh.tube(arm_im, pts, radii, sleeve_mat, 10)
	arm_mi.global_transform = Transform3D.IDENTITY
