class_name PlaceholderHand
extends Node3D
## Placeholder for Bill's hand. Floats a short distance from his body toward the mouse (or the
## right stick), independently of where he's moving, and carries the HandLight.
##
## Everything visual here (marker sphere, thin arm) is disposable. When the final model
## arrives, move HandLight under the hand bone and remove this node; aiming would then drive IK.

@export var hand_distance := 0.85
## Shoulder position relative to the body origin.
@export var shoulder_offset := Vector3(0.0, 0.35, 0.0)
## Hand Z offset relative to the body (side view: + is toward the camera).
@export var depth_offset := 0.15
@export var follow_sharpness := 16.0
@export var stick_deadzone := 0.3
@export var camera_path: NodePath
@export var hand_light_path: NodePath = ^"HandLight"

@export_group("Placeholder visuals")
@export var show_marker := true
@export var marker_radius := 0.07
@export var marker_color := Color(1.0, 0.86, 0.68)
## Marker emission when the light is off (0 = hand fully dark).
@export var marker_glow_off := 0.04
@export var marker_glow_on := 2.5
@export var show_arm := true
@export var arm_radius := 0.035
@export var arm_color := Color(0.3, 0.31, 0.34)

var aim_direction := Vector3.RIGHT

var _body: Node3D
var _light: HandLight
var _camera: Camera3D
var _using_stick := false
var _marker_mat: StandardMaterial3D
var _arm: MeshInstance3D


func _ready() -> void:
	DVInput.ensure_actions()
	_body = get_parent() as Node3D
	_light = get_node_or_null(hand_light_path) as HandLight
	_camera = get_node_or_null(camera_path) as Camera3D
	top_level = true
	if show_marker:
		_marker_mat = StandardMaterial3D.new()
		_marker_mat.albedo_color = marker_color.darkened(0.5)
		_marker_mat.emission_enabled = true
		_marker_mat.emission = marker_color
		_marker_mat.emission_energy_multiplier = marker_glow_off
		var sm := SphereMesh.new()
		sm.radius = marker_radius
		sm.height = marker_radius * 2.0
		sm.radial_segments = 16
		sm.rings = 8
		var mi := MeshInstance3D.new()
		mi.name = "Marker"
		mi.mesh = sm
		mi.material_override = _marker_mat
		# The light sits inside the marker; it must not block its own shadow map.
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
	if show_arm and _body:
		var cm := CylinderMesh.new()
		cm.top_radius = arm_radius
		cm.bottom_radius = arm_radius * 1.3
		cm.height = 1.0
		cm.radial_segments = 8
		var mat := StandardMaterial3D.new()
		mat.albedo_color = arm_color
		mat.roughness = 0.85
		_arm = MeshInstance3D.new()
		_arm.name = "PlaceholderArm"
		_arm.mesh = cm
		_arm.material_override = mat
		_arm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_arm.top_level = true
		add_child(_arm)
	if _body:
		global_position = _target_position()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_using_stick = false


func _process(delta: float) -> void:
	if _body == null:
		return
	_update_aim()
	global_position = global_position.lerp(_target_position(), 1.0 - exp(-follow_sharpness * delta))
	if _marker_mat and _light:
		var lvl := clampf(_light.get_output(), 0.0, 1.0)
		_marker_mat.emission_energy_multiplier = lerpf(marker_glow_off, marker_glow_on, lvl)
	if _arm:
		var a := _shoulder()
		var b := global_position
		var arm_len := maxf(a.distance_to(b), 0.01)
		_arm.global_transform = Transform3D(
				PlaceholderMeshes.basis_along(b - a) * Basis.from_scale(Vector3(1.0, arm_len, 1.0)), (a + b) * 0.5)


func _shoulder() -> Vector3:
	return _body.global_position + shoulder_offset


func _target_position() -> Vector3:
	return _shoulder() + aim_direction * hand_distance + Vector3(0.0, 0.0, depth_offset)


func _update_aim() -> void:
	var stick := Input.get_vector(DVInput.AIM_LEFT, DVInput.AIM_RIGHT, DVInput.AIM_DOWN, DVInput.AIM_UP)
	if stick.length() > stick_deadzone:
		_using_stick = true
		aim_direction = Vector3(stick.x, stick.y, 0.0).normalized()
		return
	if _using_stick:
		return
	var cam := _camera if _camera else get_viewport().get_camera_3d()
	if cam == null:
		return
	var mouse := get_viewport().get_mouse_position()
	var origin := cam.project_ray_origin(mouse)
	var dir := cam.project_ray_normal(mouse)
	var shoulder := _shoulder()
	var hit = Plane(Vector3.BACK, shoulder.z).intersects_ray(origin, dir)
	if hit == null:
		return
	var d: Vector3 = hit - shoulder
	d.z = 0.0
	if d.length() > 0.05:
		aim_direction = d.normalized()
