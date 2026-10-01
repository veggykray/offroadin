class_name CausalClockDraw
extends RefCounted
## Stateless drawing helpers used by the clock's CanvasItems. Everything in
## the artifact is drawn procedurally, so the look scales to any layout and
## needs no external art (art/ is free for your own textures later).

static var _glow_tex: Texture2D
static var _font: Font


## Soft radial white blob, used additively for glows and light pools.
static func glow_texture() -> Texture2D:
	if _glow_tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.35, Color(1, 1, 1, 0.42))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.width = 128
		t.height = 128
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		_glow_tex = t
	return _glow_tex


## A serif face if the system has one, else Godot's default font.
static func font() -> Font:
	if _font == null:
		var f := SystemFont.new()
		f.font_names = PackedStringArray(["Cormorant Garamond", "EB Garamond", "Garamond", "Baskerville", "Georgia", "Palatino Linotype", "Book Antiqua", "Times New Roman", "DejaVu Serif", "Liberation Serif", "serif"])
		f.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
		_font = f
	return _font


static func glow(ci: CanvasItem, at: Vector2, radius: float, color: Color) -> void:
	ci.draw_texture_rect(glow_texture(), Rect2(at - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)


## A metal band with a bevelled profile: dark rims, bright crown.
static func band(ci: CanvasItem, r_in: float, r_out: float, mat: Dictionary, strips: int = 10) -> void:
	var w := (r_out - r_in) / strips
	for i in strips:
		var t := (float(i) + 0.5) / strips  # 0 outer -> 1 inner
		var crown := 1.0 - absf(t - 0.42) * 2.1
		var c: Color = mat["dark"].lerp(mat["base"], clampf(crown * 1.4, 0, 1))
		if crown > 0.55:
			c = c.lerp(mat["light"], (crown - 0.55) * 1.1)
		ci.draw_arc(Vector2.ZERO, r_out - w * (i + 0.5), 0, TAU, 160, c, w + 0.8, true)
	ci.draw_arc(Vector2.ZERO, r_out - 1.0, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.55), 1.6, true)
	ci.draw_arc(Vector2.ZERO, r_in + 1.0, 0, TAU, 160, mat["dark"].darkened(0.4), 2.0, true)
	ci.draw_arc(Vector2.ZERO, r_in + 3.0, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.18), 1.0, true)


static func gear_points(r_root: float, r_tip: float, teeth: int, phase: float = 0.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var step := TAU / teeth
	for i in teeth:
		var a := phase + i * step
		pts.append(Vector2.from_angle(a - step * 0.30) * r_root)
		pts.append(Vector2.from_angle(a - step * 0.16) * r_tip)
		pts.append(Vector2.from_angle(a + step * 0.16) * r_tip)
		pts.append(Vector2.from_angle(a + step * 0.30) * r_root)
	return pts


## A complete little gear: body, rim, spokes and hub cap.
static func gear(ci: CanvasItem, at: Vector2, radius: float, teeth: int, angle: float, mat: Dictionary, spokes: int = 4) -> void:
	var body := gear_points(radius * 0.8, radius, teeth, angle)
	for i in body.size():
		body[i] += at
	var shadow := body.duplicate()
	for i in shadow.size():
		shadow[i] += Vector2(2.5, 3.5)
	ci.draw_colored_polygon(shadow, Color(0, 0, 0, 0.45))
	ci.draw_colored_polygon(body, mat["base"])
	body.append(body[0])
	ci.draw_polyline(body, mat["dark"], 1.2, true)
	ci.draw_circle(at, radius * 0.62, mat["dark"])
	ci.draw_circle(at, radius * 0.55, mat["base"].darkened(0.15))
	for s in spokes:
		var d := Vector2.from_angle(angle + TAU * s / spokes)
		ci.draw_line(at + d * radius * 0.18, at + d * radius * 0.6, mat["base"], radius * 0.16, true)
	ci.draw_circle(at, radius * 0.22, mat["light"])
	ci.draw_circle(at, radius * 0.1, mat["dark"])
	ci.draw_arc(at, radius * 0.86, -2.6, -0.9, 10, mat["edge"] * Color(1, 1, 1, 0.5), 1.2, true)


static func rivet(ci: CanvasItem, at: Vector2, r: float, mat: Dictionary) -> void:
	ci.draw_circle(at + Vector2(0.6, 0.9), r, Color(0, 0, 0, 0.5))
	ci.draw_circle(at, r, mat["base"])
	ci.draw_circle(at - Vector2(r, r) * 0.3, r * 0.45, mat["edge"] * Color(1, 1, 1, 0.8))


## Chaikin smoothing for an open polyline (keeps endpoints).
static func smooth(pts: PackedVector2Array, passes: int = 2) -> PackedVector2Array:
	var p := pts
	for _k in passes:
		if p.size() < 3:
			return p
		var q := PackedVector2Array([p[0]])
		for i in p.size() - 1:
			q.append(p[i].lerp(p[i + 1], 0.25))
			q.append(p[i].lerp(p[i + 1], 0.75))
		q.append(p[p.size() - 1])
		p = q
	return p


static func resample(pts: PackedVector2Array, spacing: float) -> Array:
	## Returns [positions, tangents] evenly spaced along the polyline.
	var out_p := PackedVector2Array()
	var out_t := PackedVector2Array()
	if pts.size() < 2:
		return [out_p, out_t]
	var carry := 0.0
	for i in pts.size() - 1:
		var a := pts[i]
		var b := pts[i + 1]
		var seg := a.distance_to(b)
		if seg < 0.0001:
			continue
		var d := carry
		while d <= seg:
			out_p.append(a.lerp(b, d / seg))
			out_t.append((b - a) / seg)
			d += spacing
		carry = d - seg
	return [out_p, out_t]


static func polyline_length(pts: PackedVector2Array) -> float:
	var l := 0.0
	for i in pts.size() - 1:
		l += pts[i].distance_to(pts[i + 1])
	return l


## Draws chain links along a path. Alternate links are seen face-on (open
## ovals) and edge-on (bars), which reads as a real chain at small sizes.
static func chain(ci: CanvasItem, pts: PackedVector2Array, link: float, color: Color, lit: float = 0.0) -> void:
	var s := resample(pts, link)
	var ps: PackedVector2Array = s[0]
	var ts: PackedVector2Array = s[1]
	var hi := color.lerp(Color(1, 0.97, 0.85), 0.45 + lit * 0.3)
	var lo := color.darkened(0.55)
	for i in ps.size():
		var p := ps[i]
		var t := ts[i]
		var n := Vector2(-t.y, t.x)
		if i % 2 == 0:
			var oval := PackedVector2Array()
			for k in 13:
				var a := TAU * k / 12.0
				oval.append(p + t * cos(a) * link * 0.62 + n * sin(a) * link * 0.36)
			ci.draw_polyline(oval, lo, 3.6, true)
			ci.draw_polyline(oval, color, 2.2, true)
			ci.draw_line(p - t * link * 0.3 - n * link * 0.3, p + t * link * 0.15 - n * link * 0.3, hi, 1.0, true)
		else:
			ci.draw_line(p - t * link * 0.62, p + t * link * 0.62, lo, 4.2, true)
			ci.draw_line(p - t * link * 0.58, p + t * link * 0.58, color.lightened(0.08), 2.4, true)
			ci.draw_line(p - t * link * 0.4 - n * 0.6, p + t * link * 0.2 - n * 0.6, hi, 0.9, true)


static func text(ci: CanvasItem, at: Vector2, s: String, size: int, color: Color, rotation: float = 0.0) -> void:
	var f := font()
	var w := f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size)
	ci.draw_set_transform(at, rotation, Vector2.ONE)
	ci.draw_string(f, Vector2(-w.x * 0.5, size * 0.35), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


const ROMAN := ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"]


static func roman(n: int) -> String:
	if n >= 1 and n <= ROMAN.size():
		return ROMAN[n - 1]
	return str(n)


## Small engraved geometric glyph (generic placeholder marks, not story symbols).
static func glyph(ci: CanvasItem, at: Vector2, kind: int, r: float, color: Color, rot: float) -> void:
	var pts := PackedVector2Array()
	match kind % 6:
		0:
			ci.draw_arc(at, r, 0, TAU, 16, color, 1.2, true)
			ci.draw_circle(at, r * 0.3, color)
			return
		1:
			for k in 4:
				pts.append(at + Vector2.from_angle(rot + TAU * k / 3.0 - PI / 2) * r)
		2:
			for k in 5:
				pts.append(at + Vector2.from_angle(rot + TAU * k / 4.0) * r)
		3:
			for k in 5:
				pts.append(at + Vector2.from_angle(rot + TAU * k / 4.0 + PI / 4) * r * 0.9)
			ci.draw_polyline(pts, color, 1.2, true)
			ci.draw_circle(at, r * 0.25, color)
			return
		4:
			ci.draw_line(at - Vector2.from_angle(rot) * r, at + Vector2.from_angle(rot) * r, color, 1.2, true)
			ci.draw_line(at - Vector2.from_angle(rot + PI / 2) * r, at + Vector2.from_angle(rot + PI / 2) * r, color, 1.2, true)
			return
		5:
			for k in 11:
				var rr := r if k % 2 == 0 else r * 0.45
				pts.append(at + Vector2.from_angle(rot + TAU * k / 10.0 - PI / 2) * rr)
	ci.draw_polyline(pts, color, 1.2, true)
