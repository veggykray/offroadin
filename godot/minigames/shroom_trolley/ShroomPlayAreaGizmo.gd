@tool
extends Node2D
## EDITOR-ONLY helper drawing on the "PlayArea" node. It shows you, inside the
## Godot editor, where the mini-game thinks the floor, the edges, the trolley
## start and the spawn points are, so you can line them up with the real
## Shroom Mart art. It draws nothing while the game runs.
##
##   yellow line    = floor (taken from TrolleyStart's height)
##   yellow posts   = LeftBound / RightBound (the trolley + Bill stay between)
##   orange ghost   = trolley at TrolleyStart
##   pink dots      = mushroom spawn points

@export var show_in_editor := true


func _process(_d: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()


func _draw() -> void:
	if not Engine.is_editor_hint() or not show_in_editor:
		return
	var lb := get_node_or_null("LeftBound") as Node2D
	var rb := get_node_or_null("RightBound") as Node2D
	var ts := get_node_or_null("TrolleyStart") as Node2D
	if lb == null or rb == null or ts == null:
		return
	var font := ThemeDB.fallback_font
	var fy := ts.position.y
	draw_line(Vector2(lb.position.x, fy), Vector2(rb.position.x, fy), Color.YELLOW, 3.0)
	draw_string(font, Vector2(lb.position.x + 6, fy + 18), "FLOOR (TrolleyStart height)", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color.YELLOW)
	for b in [lb, rb]:
		draw_line(Vector2(b.position.x, fy), Vector2(b.position.x, fy - 260), Color.YELLOW, 3.0)
		draw_string(font, Vector2(b.position.x + 4, fy - 264), b.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color.YELLOW)
	# trolley ghost (origin on the floor, Bill on the left)
	var p := Vector2(ts.position.x, fy)
	draw_rect(Rect2(p + Vector2(-62, -98), Vector2(124, 56)), Color(1, 0.6, 0.2, 0.5), false, 2.0)
	draw_circle(p + Vector2(-48, -10), 10, Color(1, 0.6, 0.2, 0.5))
	draw_circle(p + Vector2(48, -10), 10, Color(1, 0.6, 0.2, 0.5))
	draw_rect(Rect2(p + Vector2(-128, -150), Vector2(30, 150)), Color(1, 0.6, 0.2, 0.3), false, 2.0)
	draw_string(font, p + Vector2(-60, -104), "TrolleyStart", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 0.6, 0.2))
	var sp := get_node_or_null("../SpawnPoints")
	if sp:
		for c in sp.get_children():
			if c is Node2D:
				var q := to_local(c.global_position)
				draw_circle(q, 8, Color(1, 0.3, 1, 0.8))
				draw_line(q, q + (Vector2(p.x, fy - 200) - q).normalized() * 40.0, Color(1, 0.3, 1, 0.8), 2.0)
				draw_string(font, q + Vector2(10, -8), c.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1, 0.5, 1))
