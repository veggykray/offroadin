class_name MemoryObject
extends Node3D
## Collectible discovered purely by illumination — no collision. Lit, it starts to glow;
## lit continuously for `activation_duration` it activates: a permanent faint light, a sound,
## stays visible, and emits `activated`.
##
## Custom art: add a child named "Visual" (any Node3D). If it has set_glow(amount: float) it is
## called with 0..1 hint glow and then 1+ when active. Without a Visual, a placeholder is built.

signal activated(memory: MemoryObject)
signal progress_changed(progress: float)

const GROUP := &"dv_memory_objects"

enum Shape { RING, DIAMOND, PRISM }

@export var memory_id := "memory"
@export var shape: Shape = Shape.RING
@export var color := Color(0.65, 0.8, 1.0)
@export var size := 0.45
## Seconds of continuous light needed to activate.
@export var activation_duration := 1.5
## When false, progress drains instead of resetting while unlit.
@export var require_continuous := true
@export var progress_drain_rate := 1.0
@export var spin_speed := 0.35

@export_group("Glow")
## Emission while being lit, at full progress (pre-activation "slightly visible").
@export var hint_glow := 0.9
@export var activated_glow := 1.6
@export var activated_light_energy := 0.45
@export var activated_light_range := 3.0
@export var activated_light_attenuation := 1.6

@export_group("Audio")
## Empty = generated placeholder chime.
@export var activation_sound: AudioStream
@export var sound_volume_db := -3.0

@export_group("Nodes")
@export var detector_path: NodePath = ^"Detector"
@export var visual_path: NodePath = ^"Visual"

var progress := 0.0
var is_activated := false

var _detector: IlluminatedObject
var _visual: Node3D
var _mat: StandardMaterial3D
var _glow := 0.0
var _light: OmniLight3D


func _enter_tree() -> void:
	add_to_group(GROUP)


func _ready() -> void:
	_detector = get_node_or_null(detector_path) as IlluminatedObject
	if _detector == null:
		_detector = IlluminatedObject.new()
		_detector.name = "Detector"
		_detector.sample_radius = size
		add_child(_detector)
	_visual = get_node_or_null(visual_path) as Node3D
	if _visual == null:
		_visual = _build_placeholder()
	if activation_sound == null:
		activation_sound = PlaceholderAudio.get_sound(&"chime")
	_set_glow(0.0)


func _process(delta: float) -> void:
	_visual.rotate_y(spin_speed * delta)
	if is_activated:
		_set_glow(activated_glow * (1.0 + sin(Time.get_ticks_msec() * 0.0015) * 0.08))
		return
	var before := progress
	if _detector.is_lit:
		progress += delta / maxf(activation_duration, 0.01)
	elif require_continuous:
		progress = 0.0
	else:
		progress = maxf(0.0, progress - progress_drain_rate * delta)
	if progress != before:
		progress_changed.emit(progress)
	# Slightly visible as soon as any light touches it, brighter as it charges.
	var target := hint_glow * (0.25 * clampf(_detector.amount * 2.0, 0.0, 1.0) + 0.75 * progress)
	_glow = lerpf(_glow, target, 1.0 - exp(-8.0 * delta))
	_set_glow(_glow)
	if progress >= 1.0:
		activate()


func activate() -> void:
	if is_activated:
		return
	is_activated = true
	progress = 1.0
	_detector.enabled = false
	_light = OmniLight3D.new()
	_light.name = "MemoryLight"
	_light.omni_range = activated_light_range
	_light.omni_attenuation = activated_light_attenuation
	_light.light_color = color
	_light.light_energy = 0.0
	add_child(_light)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(_light, "light_energy", activated_light_energy, 1.5).set_trans(Tween.TRANS_SINE)
	_visual.scale = Vector3.ONE * 1.35
	tw.tween_property(_visual, "scale", Vector3.ONE, 1.2).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	var p := AudioStreamPlayer3D.new()
	p.stream = activation_sound
	p.volume_db = sound_volume_db
	p.unit_size = 10.0
	add_child(p)
	p.play()
	activated.emit(self)


func _set_glow(v: float) -> void:
	if _mat:
		_mat.emission_energy_multiplier = v
	elif _visual and _visual.has_method("set_glow"):
		_visual.call("set_glow", v)


func _build_placeholder() -> Node3D:
	var root := Node3D.new()
	root.name = "Visual"
	add_child(root)
	_mat = PlaceholderMeshes.material(color.darkened(0.35), 0.35)
	_mat.emission_enabled = true
	_mat.emission = color
	var mesh: Mesh
	var xf := Transform3D.IDENTITY
	match shape:
		Shape.RING:
			var t := TorusMesh.new()
			t.inner_radius = size * 0.6
			t.outer_radius = size
			mesh = t
			xf = Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3.ZERO)
		Shape.DIAMOND:
			var s := SphereMesh.new()
			s.radius = size * 0.75
			s.height = size * 2.0
			s.radial_segments = 4
			s.rings = 1
			mesh = s
		Shape.PRISM:
			var pr := PrismMesh.new()
			pr.size = Vector3(size * 1.5, size * 1.5, size * 0.5)
			mesh = pr
	PlaceholderMeshes.add_mesh(root, mesh, xf, _mat)
	return root
