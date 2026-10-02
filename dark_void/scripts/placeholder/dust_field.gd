class_name DustField
extends MultiMeshInstance3D
## Tiny motes that wrap around a moving target. They are ordinary lit geometry, so they only
## appear inside Bill's light: the best cue for how far the light reaches and that he's moving.

@export var follow_path: NodePath
@export var count := 450
## Half-size of the wrap box around the target.
@export var extents := Vector3(13.0, 8.0, 5.0)
@export var mote_size := 0.022
@export var color := Color(0.65, 0.63, 0.6)
@export var drift_speed := 0.06

var _target: Node3D
var _base := PackedVector3Array()
var _vel := PackedVector3Array()
var _t := 0.0


func _ready() -> void:
	_target = get_node_or_null(follow_path) as Node3D
	top_level = true
	global_transform = Transform3D.IDENTITY
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var box := BoxMesh.new()
	box.size = Vector3.ONE * mote_size
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = box
	mm.instance_count = count
	mm.custom_aabb = AABB(Vector3(-5000, -5000, -5000), Vector3(10000, 10000, 10000))
	multimesh = mm
	material_override = PlaceholderMeshes.material(color, 0.9)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	_base.resize(count)
	_vel.resize(count)
	for i in count:
		_base[i] = Vector3(rng.randf_range(-1, 1) * extents.x, rng.randf_range(-1, 1) * extents.y,
				rng.randf_range(-1, 1) * extents.z)
		_vel[i] = Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-0.3, 0.3)) * drift_speed


func _process(delta: float) -> void:
	_t += delta
	var c := _target.global_position if _target else Vector3.ZERO
	var size := extents * 2.0
	for i in count:
		var p := _base[i] + _vel[i] * _t
		var local := Vector3(
				fposmod(p.x - c.x + extents.x, size.x) - extents.x,
				fposmod(p.y - c.y + extents.y, size.y) - extents.y,
				fposmod(p.z - c.z + extents.z, size.z) - extents.z)
		var rot := Basis.from_euler(Vector3(_t * 0.3 + i, i * 0.7, 0.0))
		multimesh.set_instance_transform(i, Transform3D(rot, c + local))
