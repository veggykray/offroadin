extends RefCounted
## Shared interpolation and drawing helpers for the Polarity Machine.
##
## Deliberately has no class_name so nothing leaks into the host game's global namespace.
## Usage:  const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const CLEAR := Color(0, 0, 0, 0)


# --- Interpolation ---------------------------------------------------------------------------

## Samples a 5-entry table at a fractional level 0..4, smoothstepping between neighbours.
## This is how every visual reads a continuum: one table per effect, not one asset per state.
static func key5(x: float, keys: Array) -> float:
	var xc := clampf(x, 0.0, 4.0)
	var i := mini(int(floor(xc)), 3)
	var f := smoothstep(0.0, 1.0, xc - float(i))
	return lerpf(float(keys[i]), float(keys[i + 1]), f)


static func key5c(x: float, keys: Array) -> Color:
	var xc := clampf(x, 0.0, 4.0)
	var i := mini(int(floor(xc)), 3)
	var f := smoothstep(0.0, 1.0, xc - float(i))
	var a: Color = keys[i]
	var b: Color = keys[i + 1]
	return a.lerp(b, f)


## Moves cur toward target at a constant speed (units per second).
static func approach(cur: float, target: float, speed: float, dt: float) -> float:
	var d := target - cur
	var s := speed * dt
	if absf(d) <= s:
		return target
	return cur + signf(d) * s


## Multiplies rgb by k, keeps alpha. Used for ambient light on the machine and for additive glows.
static func shade(c: Color, k: float) -> Color:
	return Color(c.r * k, c.g * k, c.b * k, c.a)


static func with_alpha(c: Color, a: float) -> Color:
	return Color(c.r, c.g, c.b, c.a * a)


# --- Primitive drawing (draw_primitive never needs triangulation, so it never fails) ----------

static func tri(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, col: Color) -> void:
	ci.draw_primitive(PackedVector2Array([a, b, c]), PackedColorArray([col, col, col]), PackedVector2Array())


static func quad(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, d: Vector2, col: Color) -> void:
	ci.draw_primitive(PackedVector2Array([a, b, c, d]), PackedColorArray([col, col, col, col]), PackedVector2Array())


static func quad4(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, d: Vector2,
		ca: Color, cb: Color, cc: Color, cd: Color) -> void:
	ci.draw_primitive(PackedVector2Array([a, b, c, d]), PackedColorArray([ca, cb, cc, cd]), PackedVector2Array())


static func vgrad_rect(ci: CanvasItem, r: Rect2, top: Color, bottom: Color) -> void:
	var p := r.position
	quad4(ci, p, p + Vector2(r.size.x, 0), r.end, p + Vector2(0, r.size.y), top, top, bottom, bottom)


static func hgrad_rect(ci: CanvasItem, r: Rect2, left: Color, right: Color) -> void:
	var p := r.position
	quad4(ci, p, p + Vector2(r.size.x, 0), r.end, p + Vector2(0, r.size.y), left, right, right, left)


static func circle_pts(center: Vector2, r: float, n := 24, rot := 0.0, sy := 1.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := rot + TAU * float(i) / float(n)
		pts.append(center + Vector2(cos(a) * r, sin(a) * r * sy))
	return pts


static func ellipse(ci: CanvasItem, center: Vector2, rx: float, ry: float, col: Color, n := 28) -> void:
	if rx < 0.75 or ry < 0.75:
		return  # tiny polygons fail triangulation
	ci.draw_colored_polygon(circle_pts(center, rx, n, 0.0, ry / rx), col)


## Radial gradient disc (triangle fan). sy squashes it into an ellipse.
static func radial(ci: CanvasItem, center: Vector2, radius: float, inner: Color, outer: Color,
		n := 28, sy := 1.0) -> void:
	if radius <= 0.5:
		return
	var prev := center + Vector2(radius, 0)
	for i in range(1, n + 1):
		var a := TAU * float(i) / float(n)
		var p := center + Vector2(cos(a) * radius, sin(a) * radius * sy)
		ci.draw_primitive(PackedVector2Array([center, prev, p]), PackedColorArray([inner, outer, outer]),
				PackedVector2Array())
		prev = p


## Annular sector from angle a0 to a1 (Godot angles), radii r0..r1.
static func ring(ci: CanvasItem, center: Vector2, r0: float, r1: float, a0: float, a1: float,
		col: Color, n := 32) -> void:
	for i in n:
		var t0 := lerpf(a0, a1, float(i) / float(n))
		var t1 := lerpf(a0, a1, float(i + 1) / float(n))
		var d0 := Vector2(cos(t0), sin(t0))
		var d1 := Vector2(cos(t1), sin(t1))
		quad(ci, center + d0 * r0, center + d0 * r1, center + d1 * r1, center + d1 * r0, col)


## Variable-width ribbon along a polyline, with round joints. Used for stems, branches, arms.
static func ribbon(ci: CanvasItem, pts: PackedVector2Array, widths: PackedFloat32Array, col: Color) -> void:
	var n := pts.size()
	if n < 2:
		return
	for i in n - 1:
		var a := pts[i]
		var b := pts[i + 1]
		var nrm := (b - a).orthogonal().normalized()
		var wa := widths[i] * 0.5
		var wb := widths[i + 1] * 0.5
		quad(ci, a + nrm * wa, b + nrm * wb, b - nrm * wb, a - nrm * wa, col)
		if wb > 1.0:
			ci.draw_circle(b, wb, col)
	if widths[0] > 1.0:
		ci.draw_circle(pts[0], widths[0] * 0.5, col)


## A cylindrical pipe between two points: dark body, mid band, specular line.
static func pipe(ci: CanvasItem, a: Vector2, b: Vector2, w: float, base: Color) -> void:
	var dirv := (b - a).normalized()
	var nrm := dirv.orthogonal()
	var h := w * 0.5
	quad(ci, a + nrm * h, b + nrm * h, b - nrm * h, a - nrm * h, base.darkened(0.45))
	quad(ci, a + nrm * h * 0.75, b + nrm * h * 0.75, b - nrm * h * 0.2, a - nrm * h * 0.2, base)
	ci.draw_line(a - nrm * h * 0.45, b - nrm * h * 0.45, base.lightened(0.45), maxf(1.5, w * 0.12))


static func flange(ci: CanvasItem, p: Vector2, along: Vector2, w: float, base: Color) -> void:
	var nrm := along.normalized().orthogonal()
	var t := along.normalized() * 5.0
	var h := w * 0.5 + 5.0
	quad(ci, p - t + nrm * h, p + t + nrm * h, p + t - nrm * h, p - t - nrm * h, base.darkened(0.2))
	ci.draw_line(p - t + nrm * h, p - t - nrm * h, base.lightened(0.3), 1.5)


static func rivet(ci: CanvasItem, p: Vector2, r: float, base: Color) -> void:
	ci.draw_circle(p, r, base.darkened(0.5))
	ci.draw_circle(p - Vector2(r, r) * 0.18, r * 0.72, base)
	ci.draw_circle(p - Vector2(r, r) * 0.35, r * 0.28, base.lightened(0.5))


# --- Fruit and key (shared by the hanging fruit on the plant and the fallen fruit) -----------

static func fruit_outline(c: Vector2, r: float, decay: float, rot := 0.0, n := 30) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var t := TAU * float(i) / float(n)
		# A ribbed pod: narrow shoulders at the stalk end, round belly, faint point at the bottom.
		var y := -cos(t)
		var x := sin(t)
		var pinch := lerpf(0.55, 1.0, smoothstep(-1.0, 0.25, y))
		var lobes := 1.0 + 0.045 * cos(t * 6.0)
		var wrinkle := 1.0 - decay * 0.12 * pow(sin(t * 7.0), 2.0)
		var p := Vector2(x * r * 0.86 * pinch, y * r * 1.08) * lobes * wrinkle
		pts.append(c + p.rotated(rot))
	return pts


static func fruit_color(ripeness: float, decay: float, frost: float, scorch: float) -> Color:
	var unripe := Color(0.40, 0.68, 0.28)
	var turning := Color(0.92, 0.63, 0.20)
	var ripe := Color(0.80, 0.16, 0.36)
	var c := unripe.lerp(turning, smoothstep(0.0, 0.5, ripeness))
	c = c.lerp(ripe, smoothstep(0.45, 1.0, ripeness))
	c = c.lerp(Color(0.30, 0.21, 0.12), clampf(decay, 0.0, 1.0))
	c = c.lerp(Color(0.85, 0.93, 1.0), frost * 0.55)
	c = c.lerp(Color(0.12, 0.07, 0.05), scorch * 0.5)
	return c


static func draw_fruit(ci: CanvasItem, c: Vector2, r: float, ripeness: float, decay: float,
		frost := 0.0, scorch := 0.0, rot := 0.0, glow_amt := 0.0) -> void:
	if r < 2.0:
		return
	var body := fruit_color(ripeness, decay, frost, scorch)
	if glow_amt > 0.01:
		radial(ci, c, r * 2.6, Color(1.0, 0.55, 0.45, 0.32 * glow_amt), CLEAR, 24)
	var dr := r * (1.0 - decay * 0.32)
	ci.draw_colored_polygon(fruit_outline(c, dr * 1.08, decay, rot), body.darkened(0.55))
	ci.draw_colored_polygon(fruit_outline(c, dr, decay, rot), body)
	# Shadowed belly.
	ci.draw_colored_polygon(fruit_outline(c + Vector2(dr * 0.12, dr * 0.18).rotated(rot), dr * 0.78, decay, rot),
			body.darkened(0.18))
	ci.draw_colored_polygon(fruit_outline(c + Vector2(-dr * 0.08, -dr * 0.02).rotated(rot), dr * 0.62, decay, rot),
			body.lightened(0.06))
	# Ribs: dark green when unripe, gold when ripe.
	var rib := Color(0.18, 0.36, 0.14).lerp(Color(1.0, 0.82, 0.36), smoothstep(0.4, 1.0, ripeness))
	rib = rib.lerp(Color(0.16, 0.11, 0.07), decay)
	for k in [-0.5, 0.0, 0.5]:
		var pts := PackedVector2Array()
		for j in 9:
			var t := float(j) / 8.0
			var y := lerpf(-0.95, 0.98, t)
			var wdt := sqrt(maxf(0.0, 1.0 - y * y)) * lerpf(0.55, 1.0, smoothstep(-1.0, 0.25, y))
			pts.append(c + Vector2(k * wdt * dr * 0.86, y * dr * 1.06).rotated(rot))
		ci.draw_polyline(pts, rib, maxf(1.0, dr * 0.07), true)
	# Calyx crown at the stalk end.
	var top := c + Vector2(0, -dr * 1.04).rotated(rot)
	for k in 3:
		var a := rot - PI * 0.5 + (float(k) - 1.0) * 0.7
		var tip := top + Vector2(cos(a), sin(a)) * dr * 0.45
		tri(ci, top + Vector2(-dr * 0.12, 0).rotated(rot), top + Vector2(dr * 0.12, 0).rotated(rot), tip,
				Color(0.22, 0.32, 0.12).lerp(Color(0.2, 0.14, 0.08), decay))
	# Specular.
	ellipse(ci, c + Vector2(-dr * 0.32, -dr * 0.38).rotated(rot), dr * 0.18, dr * 0.3,
			Color(1, 1, 1, 0.38 * (1.0 - decay)), 14)
	if frost > 0.05:
		for k in 7:
			var a := float(k) * 2.4
			ci.draw_circle(c + Vector2(cos(a), sin(a)) * dr * 0.7, dr * 0.13, Color(0.95, 0.98, 1.0, 0.55 * frost))


static func draw_key(ci: CanvasItem, p: Vector2, s: float, rot: float, tarnish: float, glint: float) -> void:
	ci.draw_set_transform(p, rot, Vector2(s, s))
	var brass := Color(0.95, 0.74, 0.30).lerp(Color(0.48, 0.44, 0.26), tarnish)
	var dark := brass.darkened(0.5)
	var lite := brass.lightened(0.4)
	# Seed-shaped bow with a sprouting curl.
	ci.draw_colored_polygon(fruit_outline(Vector2(-24, 0), 15.5, 0.0, -PI * 0.5, 22), dark)
	ci.draw_colored_polygon(fruit_outline(Vector2(-24, 0), 13.5, 0.0, -PI * 0.5, 22), brass)
	ci.draw_circle(Vector2(-27, 0), 5.0, Color(0.08, 0.05, 0.04))
	ci.draw_arc(Vector2(-30, -9), 6.0, PI * 0.2, PI * 1.6, 10, lite, 2.0, true)
	# Collar and shaft.
	quad(ci, Vector2(-11, -4), Vector2(34, -3), Vector2(34, 3), Vector2(-11, 4), dark)
	quad(ci, Vector2(-11, -2.6), Vector2(34, -1.8), Vector2(34, 1.2), Vector2(-11, 1.4), brass)
	ci.draw_line(Vector2(-10, -1.8), Vector2(33, -1.2), lite, 1.0)
	quad(ci, Vector2(-12, -7), Vector2(-6, -7), Vector2(-6, 7), Vector2(-12, 7), dark)
	quad(ci, Vector2(-11, -6), Vector2(-7, -6), Vector2(-7, 6), Vector2(-11, 6), brass)
	# Bit with teeth.
	quad(ci, Vector2(22, 2), Vector2(35, 2), Vector2(35, 15), Vector2(22, 15), dark)
	quad(ci, Vector2(23, 3), Vector2(34, 3), Vector2(34, 9), Vector2(23, 9), brass)
	quad(ci, Vector2(23, 9), Vector2(27, 9), Vector2(27, 14), Vector2(23, 14), brass)
	quad(ci, Vector2(30, 9), Vector2(34, 9), Vector2(34, 14), Vector2(30, 14), brass)
	if tarnish > 0.2:
		ci.draw_circle(Vector2(-20, 6), 3.0, Color(0.3, 0.55, 0.45, tarnish * 0.7))
		ci.draw_circle(Vector2(12, 1), 2.0, Color(0.3, 0.55, 0.45, tarnish * 0.6))
	if glint > 0.01:
		var gp := Vector2(-18, -10)
		var gl := Color(1.0, 0.97, 0.85, glint)
		var len_a := 14.0 * glint
		ci.draw_line(gp - Vector2(len_a, 0), gp + Vector2(len_a, 0), gl, 2.0)
		ci.draw_line(gp - Vector2(0, len_a), gp + Vector2(0, len_a), gl, 2.0)
		ci.draw_circle(gp, 3.0 * glint, gl)
	ci.draw_set_transform(Vector2.ZERO)
