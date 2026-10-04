class_name HumanZooPipes
extends Node2D
## The six heavy pipes running under the gallery floor from each communication
## station to the central machine. Their glow is one of the progress readouts.

## Array of {"id": String, "from": Vector2, "to": Vector2, "lane": int}
var routes: Array = []
var glow: Dictionary = {}       # id -> 0..1 (target)
var _shown: Dictionary = {}     # id -> 0..1 (animated)
var _flash: Dictionary = {}     # id -> 0..1
var _t := 0.0
@export var lane_top: float = 34.0
@export var lane_gap: float = 13.0


func set_routes(r: Array) -> void:
	routes = r
	queue_redraw()


func set_glow(id: String, amount: float) -> void:
	glow[id] = maxf(float(glow.get(id, 0.0)), amount)


func flash(id: String) -> void:
	_flash[id] = 1.0


func _process(delta: float) -> void:
	_t += delta
	for r in routes:
		var id: String = r["id"]
		_shown[id] = move_toward(float(_shown.get(id, 0.0)), float(glow.get(id, 0.0)), delta * 0.6)
		_flash[id] = maxf(float(_flash.get(id, 0.0)) - delta * 0.5, 0.0)
	queue_redraw()


func _path(r: Dictionary) -> PackedVector2Array:
	var y := lane_top + int(r["lane"]) * lane_gap
	var a: Vector2 = r["from"]
	var b: Vector2 = r["to"]
	return PackedVector2Array([a, Vector2(a.x, y - 8), Vector2(a.x + signf(b.x - a.x) * 8, y), Vector2(b.x - signf(b.x - a.x) * 8, y), Vector2(b.x, y - 8), b])


func _draw() -> void:
	# Trench with a grate over it
	if routes.is_empty():
		return
	var minx := INF
	var maxx := -INF
	for r in routes:
		minx = minf(minx, minf(r["from"].x, r["to"].x))
		maxx = maxf(maxx, maxf(r["from"].x, r["to"].x))
	var lanes := 0
	for r in routes:
		lanes = maxi(lanes, int(r["lane"]) + 1)
	var top := lane_top - 14
	var bottom := lane_top + lanes * lane_gap + 4
	draw_rect(Rect2(minx - 40, top, maxx - minx + 80, bottom - top), Color(0.05, 0.04, 0.03, 0.9))
	for r in routes:
		var id: String = r["id"]
		var pts := _path(r)
		var g := clampf(float(_shown.get(id, 0.0)) + float(_flash.get(id, 0.0)), 0.0, 1.0)
		draw_polyline(pts, Color(0.32, 0.23, 0.11), 11.0)
		draw_polyline(pts, Color(0.55, 0.4, 0.2), 5.0)
		if g > 0.01:
			var warm := Color(1.0, 0.72, 0.3, g)
			draw_polyline(pts, Color(1.0, 0.6, 0.2, 0.25 * g), 16.0)
			draw_polyline(pts, warm, 4.0)
			# Light flowing toward the machine
			var total := 0.0
			for i in pts.size() - 1:
				total += pts[i].distance_to(pts[i + 1])
			var d := fmod(_t * 160.0, 60.0)
			while d < total:
				draw_circle(_point_at(pts, d), 3.0, Color(1.0, 0.95, 0.7, g))
				d += 60.0
	# Grate bars
	var x := minx - 40
	while x < maxx + 40:
		draw_line(Vector2(x, top), Vector2(x, bottom), Color(0.2, 0.17, 0.13, 0.85), 2.0)
		x += 22.0
	draw_line(Vector2(minx - 40, top), Vector2(maxx + 40, top), Color(0.55, 0.42, 0.22), 3.0)


func _point_at(pts: PackedVector2Array, d: float) -> Vector2:
	var acc := 0.0
	for i in pts.size() - 1:
		var seg := pts[i].distance_to(pts[i + 1])
		if acc + seg >= d:
			return pts[i].lerp(pts[i + 1], (d - acc) / maxf(seg, 0.001))
		acc += seg
	return pts[pts.size() - 1]
