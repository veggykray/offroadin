@tool
extends Node2D
## TEST-ONLY scenery: a quick, cheerful fake Shroom Mart so the prototype
## feels alive. Not part of the module; delete freely.

@export var size := Vector2(1280, 720)
@export var floor_y := 640.0


func _draw() -> void:
	var font := ThemeDB.fallback_font
	# back wall
	draw_rect(Rect2(0, 0, size.x, floor_y), Color(0.93, 0.88, 0.78))
	draw_rect(Rect2(0, 0, size.x, 70), Color(0.8, 0.22, 0.2))
	for i in 20:
		draw_rect(Rect2(i * 70 + 20, 70, 30, 14), Color(0.8, 0.22, 0.2))
	draw_string(font, Vector2(990, 46), "SHROOM MART", HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color(1, 0.95, 0.85))
	draw_circle(Vector2(972, 35), 10, Color(1, 0.95, 0.85))
	# hanging lights
	for x in [220, 640, 1060]:
		draw_line(Vector2(x, 84), Vector2(x, 120), Color(0.3, 0.3, 0.3), 2.0)
		draw_rect(Rect2(x - 40, 120, 80, 10), Color(0.95, 0.95, 0.9))
		var cone := PackedVector2Array([Vector2(x - 40, 130), Vector2(x + 40, 130), Vector2(x + 140, floor_y), Vector2(x - 140, floor_y)])
		draw_colored_polygon(cone, Color(1, 1, 0.85, 0.08))
	# background shelves
	for sx in [110, 410, 730]:
		_shelf(Vector2(sx, 250), font)
	# aisle signs
	_sign(Vector2(180, 150), "AISLE 3: FUNGI", Color(0.25, 0.55, 0.35))
	_sign(Vector2(800, 150), "FRESH TODAY!", Color(0.85, 0.5, 0.15))
	# floor
	# soften the background so gameplay objects stand out
	draw_rect(Rect2(0, 90, size.x, floor_y - 90), Color(0.93, 0.88, 0.78, 0.45))
	draw_rect(Rect2(0, floor_y, size.x, size.y - floor_y), Color(0.75, 0.75, 0.78))
	for i in 34:
		for j in 3:
			if (i + j) % 2 == 0:
				draw_rect(Rect2(i * 40, floor_y + j * 30, 40, 30), Color(0.68, 0.68, 0.72))
	draw_line(Vector2(0, floor_y), Vector2(size.x, floor_y), Color(0.45, 0.42, 0.4), 3.0)
	# launch chutes wherever the activity's spawn markers are
	var sp := get_node_or_null("../ShroomTrolleyActivity/SpawnPoints")
	if sp:
		for c in sp.get_children():
			if c is Node2D:
				_chute(to_local(c.global_position))


func _shelf(p: Vector2, font: Font) -> void:
	var w := 250.0
	draw_rect(Rect2(p, Vector2(w, floor_y - p.y)), Color(0.55, 0.42, 0.32))
	draw_rect(Rect2(p + Vector2(8, 8), Vector2(w - 16, floor_y - p.y - 16)), Color(0.42, 0.3, 0.22))
	var rows := 4
	for r in rows:
		var y := p.y + 30 + r * 85
		draw_rect(Rect2(p.x, y + 46, w, 8), Color(0.62, 0.5, 0.38))
		for k in 7:
			var c := Vector2(p.x + 22 + k * 34, y + 30)
			match (k + r) % 4:
				0:
					draw_rect(Rect2(c - Vector2(12, 14), Vector2(24, 30)), Color(0.9, 0.85, 0.7))
					draw_circle(c + Vector2(0, -2), 7, Color(0.85, 0.25, 0.2))
				1:
					draw_rect(Rect2(c - Vector2(13, 20), Vector2(26, 36)), Color(0.35, 0.6, 0.85))
				2:
					draw_circle(c + Vector2(0, 4), 13, Color(0.9, 0.75, 0.4))
				3:
					draw_rect(Rect2(c - Vector2(10, 22), Vector2(20, 38)), Color(0.55, 0.3, 0.55))
	draw_string(font, p + Vector2(10, -6), "SHROOMS & CO", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.4, 0.3, 0.25))


func _sign(p: Vector2, text: String, col: Color) -> void:
	var font := ThemeDB.fallback_font
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x + 24
	draw_line(p + Vector2(w * 0.25, -60), p + Vector2(w * 0.25, 0), Color(0.3, 0.3, 0.3), 2.0)
	draw_line(p + Vector2(w * 0.75, -60), p + Vector2(w * 0.75, 0), Color(0.3, 0.3, 0.3), 2.0)
	draw_rect(Rect2(p, Vector2(w, 30)), col)
	draw_string(font, p + Vector2(12, 22), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1, 1, 0.95))


func _chute(p: Vector2) -> void:
	var col := Color(0.35, 0.4, 0.48)
	var dir := Vector2(1, 0) if p.x < size.x * 0.3 else (Vector2(-1, 0) if p.x > size.x * 0.7 else Vector2(0, 1))
	var back := p - dir * 70.0
	draw_line(back, p, col, 34.0)
	draw_line(back, p, col.lightened(0.15), 24.0)
	draw_circle(p, 19, Color(0.15, 0.15, 0.2))
	draw_arc(p, 19, 0, TAU, 20, col.lightened(0.3), 4.0)
