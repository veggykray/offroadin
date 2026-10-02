class_name IlluminatedObject
extends Node3D
## Reusable "is this being lit?" component. Add it as a child of anything (creature, memory,
## door, painting...) and read `is_lit`, `amount` and `continuous_lit_time`, or connect to the
## signals. It knows nothing about who owns it.
##
## Sample points (any combination):
##  * explicit `sample_points` NodePaths
##  * Marker3D children (use_child_markers)
##  * nodes in `sample_group` that live under `sample_search_root` (handy for procedurally
##    generated or imported art: tag markers on the model and the detector finds them)
##  * otherwise this node's own position.
## A sample may carry metadata "sample_radius" (float) to treat it as a sphere of that size.

signal illumination_started
signal illumination_ended
signal illumination_changed(amount: float)

@export var enabled := true
## Amount (0..1) at which the object becomes lit.
@export_range(0.0, 1.0) var lit_threshold := 0.25
## Amount below which a lit object becomes unlit again (hysteresis).
@export_range(0.0, 1.0) var unlit_threshold := 0.15
## Seconds the amount must stay below unlit_threshold before "lit" ends (absorbs flicker).
@export var lose_grace_time := 0.12
## Default radius for samples without their own "sample_radius" metadata.
@export var sample_radius := 0.4

@export_group("Samples")
@export var sample_points: Array[NodePath] = []
@export var use_child_markers := true
@export var sample_group: StringName = &""
@export var sample_search_root: NodePath = ^".."

@export_group("Sources")
## Ignore sources whose counts_for_detection is false (memory glows, decorative lights).
@export var detection_sources_only := true
## Raycast from source to sample against physics. Off by default: placeholder art has no colliders.
@export var check_occlusion := false
@export_flags_3d_physics var occlusion_mask := 1

var amount := 0.0
var is_lit := false
var continuous_lit_time := 0.0
var total_lit_time := 0.0
## World position of the brightest sample this frame, and the source lighting it.
var brightest_point := Vector3.ZERO
var brightest_source: IlluminationSource

var _samples: Array[Node3D] = []
var _below_timer := 0.0


func _ready() -> void:
	refresh_samples()


## Re-collect sample points. Call after replacing/regenerating the owner's art.
func refresh_samples() -> void:
	_samples.clear()
	for p in sample_points:
		var n := get_node_or_null(p) as Node3D
		if n:
			_samples.append(n)
	if use_child_markers:
		for c in get_children():
			if c is Marker3D:
				_samples.append(c)
	if sample_group != &"" and is_inside_tree():
		var root := get_node_or_null(sample_search_root)
		if root:
			for n in get_tree().get_nodes_in_group(sample_group):
				if n is Node3D and root.is_ancestor_of(n):
					_samples.append(n)


func get_samples() -> Array[Node3D]:
	return _samples


static func sample_radius_of(n: Node, fallback: float) -> float:
	return float(n.get_meta("sample_radius", fallback))


func reset_lit_time() -> void:
	continuous_lit_time = 0.0


func _physics_process(delta: float) -> void:
	if not enabled:
		if is_lit:
			_set_lit(false)
		amount = 0.0
		return
	var prev := amount
	amount = _measure()
	if not is_equal_approx(prev, amount):
		illumination_changed.emit(amount)

	if is_lit:
		if amount < unlit_threshold:
			_below_timer += delta
			if _below_timer >= lose_grace_time:
				_set_lit(false)
		else:
			_below_timer = 0.0
	elif amount >= lit_threshold:
		_set_lit(true)

	if is_lit:
		continuous_lit_time += delta
		total_lit_time += delta


func _set_lit(v: bool) -> void:
	is_lit = v
	_below_timer = 0.0
	if v:
		illumination_started.emit()
	else:
		continuous_lit_time = 0.0
		illumination_ended.emit()


func _measure() -> float:
	var best := 0.0
	brightest_source = null
	var sources := get_tree().get_nodes_in_group(IlluminationSource.GROUP)
	if sources.is_empty():
		return 0.0
	var points: Array[Node3D] = _samples
	var use_self := points.is_empty()
	for n in sources:
		var src := n as IlluminationSource
		if src == null or (detection_sources_only and not src.counts_for_detection):
			continue
		if src.get_output() <= 0.0:
			continue
		if use_self:
			var v := src.get_illumination_at(global_position, sample_radius)
			if v > best and not _occluded(src, global_position, sample_radius):
				best = v
				brightest_point = global_position
				brightest_source = src
			continue
		for s in points:
			if not is_instance_valid(s):
				continue
			var r := sample_radius_of(s, sample_radius)
			var p := s.global_position
			var v := src.get_illumination_at(p, r)
			if v > best and not _occluded(src, p, r):
				best = v
				brightest_point = p
				brightest_source = src
	return best


func _occluded(src: IlluminationSource, p: Vector3, r: float) -> bool:
	if not check_occlusion:
		return false
	var from := src.global_position
	var to := p
	var dist := from.distance_to(to)
	if dist <= r:
		return false
	to = from + (to - from) / dist * (dist - r)
	var q := PhysicsRayQueryParameters3D.create(from, to, occlusion_mask)
	return not get_world_3d().direct_space_state.intersect_ray(q).is_empty()
