@tool
extends Node2D
## A rectangular gameplay zone (drawn in the editor only).
## Used for: the rock arch that covers the shell at the start ("ShellCover").
## The rectangle is centred on this node.

@export var size := Vector2(300, 200):
	set(v):
		size = v
		queue_redraw()
@export var editor_color := Color(0.2, 0.8, 1.0, 0.8):
	set(v):
		editor_color = v
		queue_redraw()


func get_rect_local_to_parent() -> Rect2:
	return Rect2(position - size * 0.5, size)


func _draw() -> void:
	if Engine.is_editor_hint():
		var r := Rect2(-size * 0.5, size)
		draw_rect(r, Color(editor_color, 0.12), true)
		draw_rect(r, editor_color, false, 2.0)
