@tool
class_name PlaceholderProp
extends Node3D
## A floating test object for judging the light. Pick a shape in the Inspector.
## Replace with real art by deleting this node and dropping in any mesh.

enum Shape { SPHERE, CUBE, CHAIR, PICTURE_FRAME, ROCK }

@export var shape: Shape = Shape.SPHERE:
	set(v):
		shape = v
		_rebuild()
@export var size := 1.0:
	set(v):
		size = v
		_rebuild()
@export var color := Color(0.55, 0.55, 0.55):
	set(v):
		color = v
		_rebuild()
@export_range(0.0, 1.0) var roughness := 0.8:
	set(v):
		roughness = v
		_rebuild()
@export var build_seed := 1:
	set(v):
		build_seed = v
		_rebuild()
## Slow tumble (radians/sec), runtime only.
@export var spin := Vector3(0.0, 0.05, 0.0)

var _gen: Node3D


func _ready() -> void:
	_rebuild()


func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	rotation += spin * delta


func _rebuild() -> void:
	if not is_inside_tree():
		return
	if _gen:
		remove_child(_gen)
		_gen.queue_free()
	_gen = Node3D.new()
	_gen.name = "Generated"
	add_child(_gen)
	var mat := PlaceholderMeshes.material(color, roughness)
	match shape:
		Shape.SPHERE:
			var m := SphereMesh.new()
			m.radius = 0.5 * size
			m.height = size
			PlaceholderMeshes.add_mesh(_gen, m, Transform3D.IDENTITY, mat)
		Shape.CUBE:
			var m := BoxMesh.new()
			m.size = Vector3.ONE * size * 0.8
			PlaceholderMeshes.add_mesh(_gen, m, Transform3D.IDENTITY, mat)
		Shape.CHAIR:
			_build_chair(mat)
		Shape.PICTURE_FRAME:
			_build_frame(mat)
		Shape.ROCK:
			var m := PlaceholderMeshes.lumpy_mesh(0.6 * size, 0.5, build_seed, Vector3(1.0, 0.75, 0.9))
			PlaceholderMeshes.add_mesh(_gen, m, Transform3D.IDENTITY, mat)


func _box(sz: Vector3, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> void:
	var m := BoxMesh.new()
	m.size = sz * size
	PlaceholderMeshes.add_mesh(_gen, m, Transform3D(Basis.from_euler(rot), pos * size), mat)


## An old wooden chair: worn seat, tall back, one leg snapped short.
func _build_chair(mat: Material) -> void:
	_box(Vector3(0.9, 0.08, 0.85), Vector3(0, 0, 0), mat, Vector3(0.0, 0.0, 0.03))
	_box(Vector3(0.08, 1.05, 0.08), Vector3(-0.41, 0.55, -0.38), mat)
	_box(Vector3(0.08, 1.05, 0.08), Vector3(0.41, 0.55, -0.38), mat)
	for i in 3:
		_box(Vector3(0.8, 0.07, 0.04), Vector3(0, 0.35 + i * 0.28, -0.39), mat, Vector3(0, 0, (i - 1) * 0.04))
	var legs := [Vector3(-0.4, -0.45, -0.37), Vector3(0.4, -0.45, -0.37), Vector3(-0.4, -0.45, 0.37)]
	for p in legs:
		_box(Vector3(0.07, 0.9, 0.07), p, mat)
	_box(Vector3(0.07, 0.45, 0.07), Vector3(0.4, -0.25, 0.37), mat, Vector3(0.1, 0, 0.08))


func _build_frame(mat: Material) -> void:
	var w := 1.2
	var h := 0.9
	var t := 0.09
	_box(Vector3(w, t, 0.07), Vector3(0, h * 0.5, 0), mat)
	_box(Vector3(w, t, 0.07), Vector3(0, -h * 0.5, 0), mat)
	_box(Vector3(t, h, 0.07), Vector3(-w * 0.5, 0, 0), mat)
	_box(Vector3(t, h, 0.07), Vector3(w * 0.5, 0, 0), mat)
	var canvas := PlaceholderMeshes.material(Color(0.16, 0.14, 0.13), 0.95)
	_box(Vector3(w - t, h - t, 0.02), Vector3(0, 0, -0.02), canvas)
	# A faint pale smudge where a face might have been.
	var smudge := PlaceholderMeshes.material(Color(0.42, 0.38, 0.33), 0.95)
	var m := SphereMesh.new()
	m.radius = 0.14 * size
	m.height = 0.03 * size
	PlaceholderMeshes.add_mesh(_gen, m, Transform3D(Basis.from_euler(Vector3(PI * 0.5, 0, 0)).scaled(Vector3(1.0, 1.0, 1.3)),
			Vector3(0.05, 0.05, 0.0) * size), smudge)
