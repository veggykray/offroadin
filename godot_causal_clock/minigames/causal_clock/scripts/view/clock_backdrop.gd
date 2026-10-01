class_name CausalClockBackdrop
extends Node2D
## Static body of the artifact: the engraved back plate seen through the
## seams between rings, the heavy outer bezel with its hour track, and the
## crown where the chain enters the mechanism. Drawn once.

var layout: CausalClockLayout
var geo: CausalClockGeometry
var entry_lit: bool = false


func setup(p_layout: CausalClockLayout, p_geo: CausalClockGeometry) -> void:
	layout = p_layout
	geo = p_geo
	queue_redraw()


func set_entry_lit(v: bool) -> void:
	if v != entry_lit:
		entry_lit = v
		queue_redraw()


func _draw() -> void:
	var bo := geo.bezel_outer
	var bi := geo.bezel_inner
	# Deep drop shadow beneath the whole artifact.
	for k in 8:
		draw_circle(Vector2(10, 18), bo + 34 - k * 4, Color(0, 0, 0, 0.07))
	# Back plate (visible through the ring seams).
	var plate := CausalClockPalette.material("iron")
	draw_circle(Vector2.ZERO, bi + 2, CausalClockPalette.PLATE)
	for k in 36:
		var r := geo.hub_radius + (bi - geo.hub_radius) * float(k) / 36.0
		draw_arc(Vector2.ZERO, r, 0, TAU, 128, plate["base"] * Color(1, 1, 1, 0.18), 1.0, true)
	for k in 96:
		var a := k * 3.75
		draw_line(CausalClockGeometry.point(a, geo.hub_radius), CausalClockGeometry.point(a, bi), plate["dark"] * Color(1, 1, 1, 0.5), 1.0, true)
	# Faint glow in the seams so ring edges read clearly.
	for i in layout.ring_count:
		var seam_r := geo.r_in[i] - CausalClockGeometry.GAP * 0.5
		draw_arc(Vector2.ZERO, seam_r, 0, TAU, 160, Color(0.55, 0.38, 0.16, 0.22), 2.0, true)
	_draw_bezel(bi, bo)
	_draw_crown()


func _draw_bezel(bi: float, bo: float) -> void:
	var brass := CausalClockPalette.material("brass")
	var dark := CausalClockPalette.material("walnut")
	# Wooden outer case, brass inner bezel.
	CausalClockDraw.band(self, bo - 18, bo + 14, dark, 8)
	CausalClockDraw.band(self, bi, bo - 16, brass, 14)
	# Rope/bead edge.
	for k in 180:
		var a := k * 2.0
		var p := CausalClockGeometry.point(a, bo - 17)
		draw_circle(p, 2.3, brass["dark"])
		draw_circle(p - Vector2(0.6, 0.6), 1.3, brass["light"])
	# Minute track.
	var track_r := bi + 12
	draw_arc(Vector2.ZERO, track_r - 6, 0, TAU, 180, brass["engrave"], 1.0, true)
	draw_arc(Vector2.ZERO, track_r + 6, 0, TAU, 180, brass["engrave"], 1.0, true)
	for k in 60:
		var a := k * 6.0
		var long := k % 5 == 0
		draw_line(CausalClockGeometry.point(a, track_r - 6), CausalClockGeometry.point(a, track_r + (6.0 if long else 1.0)), brass["engrave"], 2.0 if long else 1.0, true)
	# Hour numerals (the crown replaces XII).
	var num_r := (bi + bo - 16) * 0.5 + 9
	for h in range(1, 12):
		var a := h * 30.0
		CausalClockDraw.text(self, CausalClockGeometry.point(a, num_r), CausalClockDraw.roman(h), 24, brass["engrave"], deg_to_rad(a))
		CausalClockDraw.text(self, CausalClockGeometry.point(a, num_r) + Vector2(-0.8, -0.8), CausalClockDraw.roman(h), 24, brass["light"] * Color(1, 1, 1, 0.35), deg_to_rad(a))
	# Scrolls between numerals.
	for h in 12:
		var a := h * 30.0 + 15.0
		var c := CausalClockGeometry.point(a, num_r)
		var t := CausalClockGeometry.dir(a)
		var n := Vector2(-t.y, t.x)
		var lozenge := PackedVector2Array([c - t * 7, c + n * 4, c + t * 7, c - n * 4, c - t * 7])
		draw_colored_polygon(lozenge, brass["dark"])
		draw_polyline(lozenge, brass["light"] * Color(1, 1, 1, 0.6), 1.0, true)
		for s in [-1.0, 1.0]:
			draw_circle(c + n * s * 10.0, 1.8, brass["engrave"])
			draw_circle(c + n * s * 15.0, 1.2, brass["engrave"])
	# Four bosses.
	for k in 4:
		var a := 45.0 + k * 90.0
		CausalClockDraw.rivet(self, CausalClockGeometry.point(a, bo - 2), 6.0, brass)


## The entry anchor: a fixed iron crown at the top of the bezel and a length
## of chain hanging from it down to Ring A's outer edge.
func _draw_crown() -> void:
	var a := layout.entry_angle_deg
	var iron := CausalClockPalette.material("iron")
	var brass := CausalClockPalette.material("brass")
	var t := CausalClockGeometry.dir(a)
	var n := Vector2(-t.y, t.x)
	var base := CausalClockGeometry.point(a, geo.bezel_outer - 6)
	var shape := PackedVector2Array([
		base - n * 34 + t * 2, base - n * 22 + t * 26, base - n * 9 + t * 12, base + t * 34,
		base + n * 9 + t * 12, base + n * 22 + t * 26, base + n * 34 + t * 2,
		base + n * 20 - t * 46, base - n * 20 - t * 46])
	var sh := shape.duplicate()
	for i in sh.size():
		sh[i] += Vector2(4, 6)
	draw_colored_polygon(sh, Color(0, 0, 0, 0.5))
	draw_colored_polygon(shape, iron["base"])
	shape.append(shape[0])
	draw_polyline(shape, iron["edge"], 1.6, true)
	for k in 3:
		CausalClockDraw.rivet(self, base + n * (k - 1) * 16 + t * 8 - t * (absf(k - 1) * 6.0), 3.2, brass)
	var gem := base - t * 18
	draw_circle(gem, 8, Color(0, 0, 0, 0.6))
	draw_circle(gem, 6, CausalClockPalette.INLAY_LIT if entry_lit else Color(0.35, 0.16, 0.08))
	# Chain from the crown into the mechanism.
	var pts := PackedVector2Array([base - t * 30, CausalClockGeometry.point(a, geo.outer_radius - 1)])
	draw_line(pts[0], pts[1], Color(0, 0, 0, 0.6), 12.0, true)
	CausalClockDraw.chain(self, pts, 10.0, CausalClockPalette.CHAIN_LIT if entry_lit else CausalClockPalette.CHAIN_METAL, 1.0 if entry_lit else 0.0)
