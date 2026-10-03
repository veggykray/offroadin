class_name Paint
extends RefCounted
## Small procedural drawing helpers shared by all the hand-drawn layers.


static func soft(ci: CanvasItem, pos: Vector2, radius: float, color: Color) -> void:
	if radius <= 0.5 or color.a <= 0.003:
		return
	ci.draw_texture_rect(Game.soft_texture, Rect2(pos - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)


static func soft_ellipse(ci: CanvasItem, pos: Vector2, radii: Vector2, color: Color) -> void:
	if radii.x <= 0.5 or color.a <= 0.003:
		return
	ci.draw_texture_rect(Game.soft_texture, Rect2(pos - radii, radii * 2.0), false, color)


static func ellipse_points(center: Vector2, radii: Vector2, count: int = 32, rot: float = 0.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in range(count):
		var a := TAU * i / count
		pts.append(center + Vector2(cos(a) * radii.x, sin(a) * radii.y).rotated(rot))
	return pts


static func ellipse(ci: CanvasItem, center: Vector2, radii: Vector2, color: Color, count: int = 32, rot: float = 0.0) -> void:
	ci.draw_colored_polygon(ellipse_points(center, radii, count, rot), color)


## Filled shape with a vertical-ish gradient between two colours.
static func gradient_poly(ci: CanvasItem, pts: PackedVector2Array, top: Color, bottom: Color) -> void:
	if pts.size() < 3:
		return
	var mn := INF
	var mx := -INF
	for p in pts:
		mn = minf(mn, p.y)
		mx = maxf(mx, p.y)
	var cols := PackedColorArray()
	for p in pts:
		cols.append(top.lerp(bottom, inverse_lerp(mn, mx, p.y) if mx > mn else 0.0))
	ci.draw_polygon(pts, cols)


## Tapered strand along a polyline: width w0 at the root, w1 at the tip.
## Built directly as a triangle strip (no triangulation, never fails).
static func strand(ci: CanvasItem, pts: PackedVector2Array, w0: float, w1: float, c0: Color, c1: Color) -> void:
	var n := pts.size()
	if n < 2:
		return
	var verts := PackedVector2Array()
	var cols := PackedColorArray()
	verts.resize(n * 2)
	cols.resize(n * 2)
	for i in range(n):
		var k := float(i) / (n - 1)
		var d: Vector2
		if i == 0:
			d = pts[1] - pts[0]
		elif i == n - 1:
			d = pts[n - 1] - pts[n - 2]
		else:
			d = pts[i + 1] - pts[i - 1]
		var nrm := d.normalized().orthogonal() * lerpf(w0, w1, k) * 0.5
		verts[i * 2] = pts[i] + nrm
		verts[i * 2 + 1] = pts[i] - nrm
		var c := c0.lerp(c1, k)
		cols[i * 2] = c
		cols[i * 2 + 1] = c
	RenderingServer.canvas_item_add_triangle_array(ci.get_canvas_item(), _strip_indices(n), verts, cols)


## Filled band between two polylines of equal length (top and bottom edge).
static func band(ci: CanvasItem, top: PackedVector2Array, bottom: PackedVector2Array, top_col: Color, bottom_col: Color) -> void:
	var n := mini(top.size(), bottom.size())
	if n < 2:
		return
	var verts := PackedVector2Array()
	var cols := PackedColorArray()
	verts.resize(n * 2)
	cols.resize(n * 2)
	for i in range(n):
		verts[i * 2] = top[i]
		verts[i * 2 + 1] = bottom[i]
		cols[i * 2] = top_col
		cols[i * 2 + 1] = bottom_col
	RenderingServer.canvas_item_add_triangle_array(ci.get_canvas_item(), _strip_indices(n), verts, cols)


static var _strip_cache := {}


static func _strip_indices(n: int) -> PackedInt32Array:
	if _strip_cache.has(n):
		return _strip_cache[n]
	var idx := PackedInt32Array()
	for i in range(n - 1):
		var a := i * 2
		idx.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
	_strip_cache[n] = idx
	return idx


static func capsule(ci: CanvasItem, a: Vector2, b: Vector2, r: float, color: Color) -> void:
	ci.draw_line(a, b, color, r * 2.0)
	ci.draw_circle(a, r, color)
	ci.draw_circle(b, r, color)


static func iridescent(t: float, shift: float = 0.0) -> Color:
	var h := fposmod(t * 0.07 + shift, 1.0)
	return Color.from_hsv(lerpf(0.42, 0.85, 0.5 + 0.5 * sin(h * TAU)), 0.55, 0.95)
