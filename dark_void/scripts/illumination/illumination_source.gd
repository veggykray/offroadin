class_name IlluminationSource
extends Node3D
## Anything that can illuminate an IlluminatedObject.
##
## The gameplay light model is deliberately separate from the renderer: it is a cheap,
## deterministic radius/falloff test, so detection behaves the same on every renderer and
## doesn't depend on reading pixels back. Subclasses (e.g. HandLight) override get_output()
## and get_range() to stay in sync with whatever actual Light3D they drive.

const GROUP := &"dv_illumination_sources"

## Only sources with this flag are considered by IlluminatedObjects that set
## detection_sources_only (the default). Ambient/decorative lights should leave it off.
@export var counts_for_detection := true
## Gameplay radius when not overridden by a subclass.
@export var gameplay_range := 3.0
## Exponent of the (1 - d/range) falloff. 1 = linear, 2 = concentrated near the source.
@export_range(0.1, 6.0) var detection_falloff := 1.3


func _enter_tree() -> void:
	add_to_group(GROUP)


## 0..1 current strength. 0 = off.
func get_output() -> float:
	return 1.0


func get_range() -> float:
	return gameplay_range


## Range used to answer "would this be lit if the light were on?".
func get_potential_range() -> float:
	return get_range()


## Illumination (0..1) delivered to a sphere of `radius` centred at `world_pos`.
## With assume_on, treats the source as fully on (used to avoid hiding things in range).
func get_illumination_at(world_pos: Vector3, radius := 0.0, assume_on := false) -> float:
	var out := 1.0 if assume_on else get_output()
	if out <= 0.0:
		return 0.0
	var r := get_potential_range() if assume_on else get_range()
	if r <= 0.0:
		return 0.0
	var d := maxf(0.0, global_position.distance_to(world_pos) - radius)
	if d >= r:
		return 0.0
	return pow(1.0 - d / r, detection_falloff) * out


## Brightest illumination at a point from every registered source.
static func query(tree: SceneTree, world_pos: Vector3, radius := 0.0, detection_only := true) -> float:
	var best := 0.0
	for n in tree.get_nodes_in_group(GROUP):
		var s := n as IlluminationSource
		if s == null or (detection_only and not s.counts_for_detection):
			continue
		best = maxf(best, s.get_illumination_at(world_pos, radius))
	return best
