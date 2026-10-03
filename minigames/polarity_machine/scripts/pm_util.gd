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


## Fills the band between two polylines of equal length with quads (never fails to triangulate,
## even when the outline would self-intersect, e.g. a strongly curled leaf).
static func strip(ci: CanvasItem, a: PackedVector2Array, b: PackedVector2Array, col: Color) -> void:
	for i in mini(a.size(), b.size()) - 1:
		quad(ci, a[i], a[i + 1], b[i + 1], b[i], col)


## A simple teardrop (tip up), radius r at its round end. Never self-intersects.
static func drop(center: Vector2, r: float, n := 24) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var t := TAU * float(i) / float(n)
		pts.append(center + Vector2(sin(t) * sin(t * 0.5) * r * 1.05, -cos(t) * r * 1.25 + r * 0.25))
	return pts
