class_name HumanZooSymbols
extends RefCounted
## Procedural drawings for the six machine symbols and the per-character
## emblems on the selector plaques. Symbols are always drawn, never just named.

const ALL := ["MOON", "EYE", "BIRD", "KEY", "TREE", "HAND"]


static func draw_symbol(ci: CanvasItem, id: String, c: Vector2, s: float, col: Color) -> void:
	var w := maxf(1.5, s * 0.09)
	match id:
		"MOON":
			var r := s * 0.44
			var c2 := c + Vector2(r * 0.55, 0.0)
			var outer: Array = []
			for i in 21:
				var a := deg_to_rad(lerpf(55.0, 305.0, i / 20.0))
				outer.append(c + Vector2(cos(a), sin(a)) * r)
			var pa: Vector2 = outer[0]
			var pb: Vector2 = outer[20]
			var aa := (pa - c2).angle()
			var ab := (pb - c2).angle()
			var r2 := (pa - c2).length()
			var pts := PackedVector2Array(outer)
			# Skip the inner arc's end points: they coincide with the outer arc's.
			for i in range(1, 20):
				var a := lerpf(ab + TAU, aa, i / 20.0)
				pts.append(c2 + Vector2(cos(a), sin(a)) * r2)
			ci.draw_colored_polygon(pts, col)
		"EYE":
			var hw := s * 0.48
			var hh := s * 0.26
			var pts := PackedVector2Array()
			for i in 17:
				var t := lerpf(-1.0, 1.0, i / 16.0)
				pts.append(c + Vector2(t * hw, -hh * (1.0 - t * t)))
			for i in range(1, 16):
				var t := lerpf(1.0, -1.0, i / 16.0)
				pts.append(c + Vector2(t * hw, hh * (1.0 - t * t)))
			pts.append(pts[0])
			ci.draw_polyline(pts, col, w, true)
			ci.draw_circle(c, s * 0.17, col)
			ci.draw_circle(c, s * 0.07, col.darkened(0.75))
		"BIRD":
			# Two swept wings, a body and a little tail: reads as a bird at any size.
			var bw := maxf(2.0, s * 0.11)
			ci.draw_arc(c + Vector2(-s * 0.23, s * 0.16), s * 0.26, PI * 1.12, PI * 1.82, 12, col, bw, true)
			ci.draw_arc(c + Vector2(s * 0.23, s * 0.16), s * 0.26, PI * 1.18, PI * 1.88, 12, col, bw, true)
			ci.draw_circle(c + Vector2(0, s * 0.02), s * 0.09, col)
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.05, s * 0.08), c + Vector2(s * 0.05, s * 0.08),
				c + Vector2(s * 0.1, s * 0.26), c + Vector2(-s * 0.1, s * 0.26)]), col)
		"KEY":
			ci.draw_arc(c + Vector2(-s * 0.26, 0), s * 0.17, 0, TAU, 20, col, w * 1.3, true)
			ci.draw_line(c + Vector2(-s * 0.09, 0), c + Vector2(s * 0.46, 0), col, w * 1.3, true)
			ci.draw_line(c + Vector2(s * 0.30, 0), c + Vector2(s * 0.30, s * 0.16), col, w * 1.3, true)
			ci.draw_line(c + Vector2(s * 0.42, 0), c + Vector2(s * 0.42, s * 0.2), col, w * 1.3, true)
		"TREE":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.05, s * 0.05), Vector2(s * 0.1, s * 0.42)), col)
			ci.draw_line(c + Vector2(0, s * 0.2), c + Vector2(-s * 0.16, s * 0.04), col, w, true)
			ci.draw_circle(c + Vector2(0, -s * 0.14), s * 0.24, col)
			ci.draw_circle(c + Vector2(-s * 0.21, s * 0.0), s * 0.17, col)
			ci.draw_circle(c + Vector2(s * 0.21, s * 0.0), s * 0.17, col)
		"HAND":
			ci.draw_rect(Rect2(c + Vector2(-s * 0.2, -s * 0.06), Vector2(s * 0.38, s * 0.4)), col)
			var fx := [-0.17, -0.06, 0.05, 0.155]
			var fh := [0.30, 0.38, 0.36, 0.27]
			for i in 4:
				var x: float = fx[i] * s
				var top: float = -s * (0.06 + fh[i])
				ci.draw_rect(Rect2(c + Vector2(x - s * 0.045, top), Vector2(s * 0.09, -top - s * 0.06 + 2)), col)
				ci.draw_circle(c + Vector2(x, top), s * 0.045, col)
			var th := PackedVector2Array([c + Vector2(-s * 0.2, s * 0.06), c + Vector2(-s * 0.38, -s * 0.12),
				c + Vector2(-s * 0.31, -s * 0.18), c + Vector2(-s * 0.18, -s * 0.06)])
			ci.draw_colored_polygon(th, col)
		_:
			ci.draw_arc(c, s * 0.3, 0, TAU, 16, col, w)


static func draw_emblem(ci: CanvasItem, character_id: String, c: Vector2, s: float, col: Color) -> void:
	var w := maxf(1.2, s * 0.08)
	match character_id:
		"king":
			var pts := PackedVector2Array([c + Vector2(-0.4, 0.25) * s, c + Vector2(-0.4, -0.15) * s,
				c + Vector2(-0.2, 0.05) * s, c + Vector2(0, -0.3) * s, c + Vector2(0.2, 0.05) * s,
				c + Vector2(0.4, -0.15) * s, c + Vector2(0.4, 0.25) * s])
			ci.draw_colored_polygon(pts, col)
		"child":
			ci.draw_rect(Rect2(c - Vector2(0.28, 0.28) * s, Vector2(0.56, 0.56) * s), col, false, w)
			ci.draw_rect(Rect2(c - Vector2(0.1, 0.1) * s, Vector2(0.2, 0.2) * s), col)
		"accountant":
			for i in 4:
				var x := (-0.27 + i * 0.15) * s
				ci.draw_line(c + Vector2(x, -0.28 * s), c + Vector2(x, 0.28 * s), col, w)
			ci.draw_line(c + Vector2(-0.4, 0.22) * s, c + Vector2(0.4, -0.22) * s, col, w)
		"liar":
			# A speech bubble with crossed fingers' worth of squiggle.
			ci.draw_arc(c + Vector2(0, -0.05) * s, s * 0.3, 0, TAU, 20, col, w)
			ci.draw_line(c + Vector2(-0.12, 0.2) * s, c + Vector2(-0.26, 0.38) * s, col, w)
			ci.draw_line(c + Vector2(-0.15, -0.05) * s, c + Vector2(0.15, -0.05) * s, col, w)
		"old_woman":
			ci.draw_rect(Rect2(c + Vector2(-0.25, -0.15) * s, Vector2(0.4, 0.3) * s), col)
			ci.draw_arc(c + Vector2(0.18, 0.0) * s, s * 0.1, -PI / 2, PI / 2, 10, col, w)
			ci.draw_line(c + Vector2(-0.38, 0.22) * s, c + Vector2(0.3, 0.22) * s, col, w)
		_:
			# The empty cage: a dashed outline of nobody.
			for i in 10:
				var a0 := TAU * i / 10.0
				ci.draw_arc(c, s * 0.3, a0, a0 + TAU / 20.0, 4, col, w)
