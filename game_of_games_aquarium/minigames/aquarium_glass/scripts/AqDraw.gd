extends RefCounted
## Drawing helpers that never fail on self-intersecting shapes
## (swaying plants and wriggling eels twist their outlines all the time).


## A ribbon between two edge lines, drawn with explicit triangles.
static func strip(ci: CanvasItem, left: PackedVector2Array, right: PackedVector2Array, color: Color) -> void:
	var n := mini(left.size(), right.size())
	if n < 2:
		return
	var pts := PackedVector2Array()
	pts.resize(n * 2)
	var idx := PackedInt32Array()
	for i in n:
		pts[i * 2] = left[i]
		pts[i * 2 + 1] = right[i]
	for i in n - 1:
		var a := i * 2
		idx.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
	var cols := PackedColorArray()
	cols.resize(pts.size())
	cols.fill(color)
	RenderingServer.canvas_item_add_triangle_array(ci.get_canvas_item(), idx, pts, cols)


## Filled polygon; falls back to a triangle fan if triangulation fails.
static func poly(ci: CanvasItem, pts: PackedVector2Array, color: Color) -> void:
	if pts.size() < 3:
		return
	if Geometry2D.triangulate_polygon(pts).size() > 0:
		ci.draw_colored_polygon(pts, color)
		return
	var c := Vector2.ZERO
	for p in pts:
		c += p
	c /= pts.size()
	var all := PackedVector2Array([c])
	all.append_array(pts)
	var idx := PackedInt32Array()
	for i in pts.size():
		idx.append_array([0, 1 + i, 1 + (i + 1) % pts.size()])
	var cols := PackedColorArray()
	cols.resize(all.size())
	cols.fill(color)
	RenderingServer.canvas_item_add_triangle_array(ci.get_canvas_item(), idx, all, cols)
