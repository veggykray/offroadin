@tool
extends Node2D
## Editor-only helper: draws the aquarium bounds (cyan) and the glass
## interaction rectangle (white dashed) of the parent AquariumActivity so you
## can see them while positioning things. Does nothing in the running game.


func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()


func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var p := get_parent()
	if p == null:
		return
	var b = p.get("aquarium_bounds")
	var g = p.get("glass_rect")
	if b is Rect2:
		draw_rect(b, Color(0.2, 0.9, 1.0, 0.9), false, 3.0)
		draw_string(ThemeDB.fallback_font, b.position + Vector2(8, 22), "aquarium_bounds", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.2, 0.9, 1.0))
	if g is Rect2 and g.size != Vector2.ZERO:
		draw_dashed_line(g.position, Vector2(g.end.x, g.position.y), Color.WHITE, 2.0, 12.0)
		draw_dashed_line(Vector2(g.end.x, g.position.y), g.end, Color.WHITE, 2.0, 12.0)
		draw_dashed_line(g.end, Vector2(g.position.x, g.end.y), Color.WHITE, 2.0, 12.0)
		draw_dashed_line(Vector2(g.position.x, g.end.y), g.position, Color.WHITE, 2.0, 12.0)
		draw_string(ThemeDB.fallback_font, g.position + Vector2(8, 44), "glass_rect", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color.WHITE)
	var floor_y = p.get("floor_height")
	if b is Rect2 and floor_y is float:
		var y: float = b.end.y - floor_y
		draw_line(Vector2(b.position.x, y), Vector2(b.end.x, y), Color(1, 0.85, 0.3, 0.8), 2.0)
		draw_string(ThemeDB.fallback_font, Vector2(b.position.x + 8, y - 6), "floor", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 0.85, 0.3))
