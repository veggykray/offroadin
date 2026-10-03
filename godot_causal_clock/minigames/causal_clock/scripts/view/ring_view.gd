class_name CausalClockRingView
extends CausalClockElementView
## One concentric ring: material band, engraved ornament, toothed edges and
## the chain fragments inlaid in it. Drawn once in local space and rotated as
## a whole; redrawn only when its link/marker state changes.

const LINK := 9.0

var mat: Dictionary
## Per segment: smoothed local path.
var paths: Array[PackedVector2Array] = []
## Segment indices that are currently part of the chain.
var linked: Dictionary = {}
## Distance from the chain entry to the start of each linked segment, so the
## glow pulse runs continuously from the crown to the heart.
var chain_offset: Dictionary = {}
## memory_id -> Texture2D (or null) for marker medallions, and lit state.
var marker_icons: Dictionary = {}
var marker_lit: Dictionary = {}
var solved_glow: float = 0.0
var _glow: Node2D
var _time: float = 0.0


func setup(p_layout: CausalClockLayout, p_index: int, p_geo: CausalClockGeometry) -> void:
	super.setup(p_layout, p_index, p_geo)
	mat = CausalClockPalette.material(element.material)
	paths.clear()
	for s in element.segments:
		paths.append(_build_path(s))
	_glow = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow.material = m
	_glow.draw.connect(_draw_glow)
	add_child(_glow)
	queue_redraw()


func set_linked(segments: Array, offsets: Dictionary) -> void:
	var d := {}
	for s in segments:
		d[s] = true
	if d.hash() != linked.hash():
		linked = d
		queue_redraw()
	chain_offset = offsets


func _animate(dt: float) -> void:
	_time += dt
	if not linked.is_empty() or solved_glow > 0.0:
		_glow.queue_redraw()


# ---------------------------------------------------------------------------

func _build_path(s: CausalClockLayout.SegmentDef) -> PackedVector2Array:
	var step := element.step_degrees()
	var ro := geo.r_out[index]
	var ri := geo.r_in[index]
	var rm := lerpf(ro, ri, s.lane)
	var pts := PackedVector2Array()
	if s.is_through():
		var ao := s.out_slot * step
		var ai := s.in_slot * step
		var span := wrapf(ai - ao, -180.0, 180.0)
		if s.arc_dir > 0 and span < 0.0:
			span += 360.0
		elif s.arc_dir < 0 and span > 0.0:
			span -= 360.0
		pts.append(CausalClockGeometry.point(ao, ro))
		if absf(span) < 0.01:
			pts.append(CausalClockGeometry.point(ao, ri))
			return pts
		pts.append(CausalClockGeometry.point(ao, rm))
		pts.append_array(CausalClockGeometry.arc(rm, ao, ao + span, 2.0).slice(1))
		pts.append(CausalClockGeometry.point(ai, ri))
	elif s.out_slot != CausalClockLayout.NONE:
		var ao2 := s.out_slot * step
		var dirn := float(s.arc_dir if s.arc_dir != 0 else 1)
		pts.append(CausalClockGeometry.point(ao2, ro))
		pts.append(CausalClockGeometry.point(ao2, rm))
		pts.append_array(CausalClockGeometry.arc(rm, ao2, ao2 + step * 0.55 * dirn, 2.0).slice(1))
	else:
		var ai2 := s.in_slot * step
		var dirn2 := float(s.arc_dir if s.arc_dir != 0 else -1)
		pts.append(CausalClockGeometry.point(ai2, ri))
		pts.append(CausalClockGeometry.point(ai2, rm))
		pts.append_array(CausalClockGeometry.arc(rm, ai2, ai2 + step * 0.55 * dirn2, 2.0).slice(1))
	return CausalClockDraw.smooth(pts, 3)


func _draw() -> void:
	var ro := geo.r_out[index]
	var ri := geo.r_in[index]
	var rng := RandomNumberGenerator.new()
	rng.seed = 7919 * (index + 3)
	# Cast shadow onto the plate below (drawn in local space; it is round so
	# rotation does not matter).
	draw_arc(Vector2(3, 5), (ro + ri) * 0.5, 0, TAU, 160, Color(0, 0, 0, 0.35), ro - ri, true)
	CausalClockDraw.band(self, ri, ro, mat)
	_draw_surface(rng, ri, ro)
	_draw_slot_marks(ri, ro)
	_draw_ornaments(ri, ro)
	_draw_edge_teeth(ri, ro)
	for si in element.segments.size():
		_draw_segment(si)


func _draw_surface(rng: RandomNumberGenerator, ri: float, ro: float) -> void:
	if element.ornaments.has("hammered"):
		for i in 260:
			var a := rng.randf() * 360.0
			var r := rng.randf_range(ri + 4, ro - 4)
			var p := CausalClockGeometry.point(a, r)
			var rr := rng.randf_range(1.5, 4.0)
			draw_circle(p, rr, mat["dark"] * Color(1, 1, 1, 0.22))
			draw_arc(p, rr, -2.4, -0.6, 6, mat["light"] * Color(1, 1, 1, 0.18), 1.0, true)
	if element.ornaments.has("grain"):
		for i in 26:
			var r := rng.randf_range(ri + 3, ro - 3)
			var a0 := rng.randf() * 360.0
			var span := rng.randf_range(40.0, 160.0)
			var pts := PackedVector2Array()
			var wob := rng.randf_range(0.6, 2.0)
			var freq := rng.randf_range(2.0, 5.0)
			for k in 40:
				var t := float(k) / 39.0
				pts.append(CausalClockGeometry.point(a0 + span * t, r + sin(t * freq * TAU) * wob))
			var col: Color = mat["dark"] if i % 3 else mat["light"]
			draw_polyline(pts, col * Color(1, 1, 1, 0.35), rng.randf_range(0.6, 1.6), true)
	if element.material in ["navy", "ivory"]:
		# Enamel bands framed by gold cloisonné rims, as on the reference art.
		for r in [ro - 3.0, ri + 4.0]:
			draw_arc(Vector2.ZERO, r, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.85), 2.2, true)
		draw_arc(Vector2.ZERO, ro - 7.0, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.35), 1.0, true)
		draw_arc(Vector2.ZERO, ri + 8.0, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.35), 1.0, true)
	if element.material == "enamel":
		# Glossy enamel with gold cloisonné rims.
		draw_arc(Vector2.ZERO, ro - 4, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.65), 1.4, true)
		draw_arc(Vector2.ZERO, ri + 5, 0, TAU, 160, mat["edge"] * Color(1, 1, 1, 0.65), 1.4, true)


func _draw_slot_marks(ri: float, ro: float) -> void:
	var step := element.step_degrees()
	for s in element.positions:
		var a := s * step
		draw_line(CausalClockGeometry.point(a, ro - 1), CausalClockGeometry.point(a, ro - 7), mat["engrave"], 2.0, true)
		draw_line(CausalClockGeometry.point(a, ri + 1), CausalClockGeometry.point(a, ri + 6), mat["engrave"], 2.0, true)


func _draw_ornaments(ri: float, ro: float) -> void:
	var step := element.step_degrees()
	var n := element.positions
	var w := ro - ri
	for o in element.ornaments:
		match o:
			"rivets":
				for k in n * 2:
					var a := (k + 0.5) * step * 0.5
					CausalClockDraw.rivet(self, CausalClockGeometry.point(a, ro - 6), 2.4, mat)
					CausalClockDraw.rivet(self, CausalClockGeometry.point(a, ri + 6), 2.0, mat)
			"ticks":
				for k in n * 10:
					var a := k * step / 10.0
					var long := k % 5 == 0
					draw_line(CausalClockGeometry.point(a, ro - 2), CausalClockGeometry.point(a, ro - (8.0 if long else 4.5)), mat["engrave"] * Color(1, 1, 1, 0.8), 1.0, true)
			"numerals":
				for k in n:
					var a := (k + 0.5) * step
					var p := CausalClockGeometry.point(a, ro - w * 0.2)
					CausalClockDraw.text(self, p, CausalClockDraw.roman(k + 1), int(clampf(w * 0.2, 9, 15)), mat["engrave"] * Color(1, 1, 1, 0.85), deg_to_rad(a))
			"inlay_dots":
				for k in n * 2:
					var a := (k + 0.5) * step * 0.5
					var p := CausalClockGeometry.point(a, ro - 7)
					draw_circle(p, 2.4, Color(0.86, 0.84, 0.78, 0.85))
					draw_circle(p, 1.0, Color(1, 1, 1, 0.9))
					draw_circle(CausalClockGeometry.point(a, ri + 7), 1.8, Color(0.86, 0.84, 0.78, 0.7))
			"filigree":
				for k in n * 4:
					var a := k * step / 4.0 + step / 8.0
					var g := deg_to_rad(a - 90.0)
					draw_arc(CausalClockGeometry.point(a, ro - 3), 4.5, g - PI * 0.5, g + PI * 0.5, 8, mat["edge"] * Color(1, 1, 1, 0.55), 1.2, true)
					draw_arc(CausalClockGeometry.point(a, ri + 3), 3.5, g + PI * 0.5, g + PI * 1.5, 8, mat["edge"] * Color(1, 1, 1, 0.45), 1.0, true)
			"constellations":
				var crng := RandomNumberGenerator.new()
				crng.seed = 4099 * (index + 1)
				_constellations(crng, ri, ro)
			"moon":
				for k in n:
					var a := (k + 0.5) * step
					var p := CausalClockGeometry.point(a, ri + w * (0.25 if k % 2 == 0 else 0.75))
					if k % 2 == 0:
						var d := CausalClockGeometry.dir(a)
						draw_circle(p, 6.0, mat["edge"])
						draw_circle(p + d.rotated(-0.9) * 2.6, 5.4, mat["base"])
					else:
						draw_circle(p, 3.0, mat["edge"])
						for j in 8:
							var dd := Vector2.from_angle(TAU * j / 8.0)
							draw_line(p + dd * 4.5, p + dd * 7.0, mat["edge"] * Color(1, 1, 1, 0.8), 1.2, true)
			"scrollwork":
				_scrollwork(ri, ro)
			"leaves":
				_leaf_vine(ri, ro)
			"glyphs":
				for k in n:
					var a := (k + 0.5) * step
					CausalClockDraw.glyph(self, CausalClockGeometry.point(a, ri + w * 0.24), k, 4.2, mat["edge"] * Color(1, 1, 1, 0.6), deg_to_rad(a))


func _star(p: Vector2, r: float, c: Color) -> void:
	var pts := PackedVector2Array()
	for k in 8:
		var a := TAU * k / 8.0 - PI / 2
		pts.append(p + Vector2.from_angle(a) * (r if k % 2 == 0 else r * 0.3))
	draw_colored_polygon(pts, c)


## Gold star field with a few constellation figures, on enamel rings.
func _constellations(rng: RandomNumberGenerator, ri: float, ro: float) -> void:
	var gold: Color = mat["edge"]
	var count := int((ro + ri) * 0.5 * 0.22)
	for i in count:
		var p := CausalClockGeometry.point(rng.randf() * 360.0, rng.randf_range(ri + 9, ro - 9))
		draw_circle(p, rng.randf_range(0.6, 1.4), gold * Color(1, 1, 1, rng.randf_range(0.35, 0.8)))
	var figures := maxi(3, int((ro + ri) * 0.5 / 45.0))
	for f in figures:
		var a0 := (f + rng.randf_range(0.1, 0.6)) * 360.0 / figures
		var pts := PackedVector2Array()
		for k in rng.randi_range(3, 5):
			pts.append(CausalClockGeometry.point(a0 + k * rng.randf_range(4.0, 9.0) * 60.0 / maxf(30.0, (ro + ri) * 0.25), lerpf(ri + 12, ro - 12, rng.randf())))
		draw_polyline(pts, gold * Color(1, 1, 1, 0.45), 1.0, true)
		for p2 in pts:
			draw_circle(p2, 2.0, gold)
		_star(pts[0], 6.5, gold)


## Engraved acanthus scrolls running round a brass band.
func _scrollwork(ri: float, ro: float) -> void:
	var rm := (ri + ro) * 0.5
	var w := (ro - ri) * 0.32
	var eng: Color = mat["engrave"] * Color(1, 1, 1, 0.75)
	var hi: Color = mat["light"] * Color(1, 1, 1, 0.5)
	var count := int(rm * TAU / 70.0)
	for k in count:
		var a0 := 360.0 * k / count
		var span := 360.0 / count
		var pts := PackedVector2Array()
		for i in 21:
			var t := float(i) / 20.0
			pts.append(CausalClockGeometry.point(a0 + span * t, rm + sin(t * PI * 2.0) * w * 0.6))
		draw_polyline(pts, eng, 1.6, true)
		# A curl at each crest.
		var crest := CausalClockGeometry.point(a0 + span * 0.25, rm + w * 0.6)
		var curl := PackedVector2Array()
		for i in 14:
			var t2 := float(i) / 13.0
			curl.append(crest + Vector2.from_angle(t2 * TAU * 0.9 + deg_to_rad(a0)) * (w * 0.55 * (1.0 - t2 * 0.7)))
		draw_polyline(curl, eng, 1.3, true)
		draw_polyline(curl, hi, 0.6, true)


## A copper vine with alternating engraved leaves.
func _leaf_vine(ri: float, ro: float) -> void:
	var rm := (ri + ro) * 0.5
	var amp := (ro - ri) * 0.18
	var eng: Color = mat["engrave"] * Color(1, 1, 1, 0.7)
	var hi: Color = mat["light"] * Color(1, 1, 1, 0.55)
	var pts := PackedVector2Array()
	for i in 241:
		var a := 360.0 * i / 240.0
		pts.append(CausalClockGeometry.point(a, rm + sin(deg_to_rad(a) * 18.0) * amp))
	draw_polyline(pts, eng, 1.6, true)
	for i in range(0, 240, 5):
		var a2 := 360.0 * i / 240.0
		var base := CausalClockGeometry.point(a2, rm + sin(deg_to_rad(a2) * 18.0) * amp)
		var out := CausalClockGeometry.dir(a2) * (1.0 if (i / 5) % 2 == 0 else -1.0)
		var tan := out.orthogonal()
		var tip := base + out * (ro - ri) * 0.28 + tan * 5.0
		var leaf := PackedVector2Array([base, base.lerp(tip, 0.5) + tan * 3.5, tip, base.lerp(tip, 0.5) - tan * 3.5])
		draw_colored_polygon(leaf, mat["dark"] * Color(1, 1, 1, 0.55))
		draw_line(base, tip, hi, 0.8, true)


## Fine teeth on any edge that meshes with a coupling gear; bold teeth only on
## the sectors listed by a cam (the "toothed arc" the player learns to read).
func _draw_edge_teeth(ri: float, ro: float) -> void:
	var step := element.step_degrees()
	var brass := CausalClockPalette.material("brass")
	for c in layout.couplings:
		if c.a != index and c.b != index:
			continue
		var other := c.b if c.a == index else c.a
		var inner_edge := other > index
		var r_edge := ri if inner_edge else ro
		var out_dir := -1.0 if inner_edge else 1.0
		if c.has_cam() and c.cam_element == index:
			for k in c.cam_teeth:
				var a0 := k * step
				var t := 0.0
				while t < step - 0.1:
					var a := a0 + t + 2.0
					var p0 := CausalClockGeometry.point(a - 1.3, r_edge)
					var p1 := CausalClockGeometry.point(a - 0.7, r_edge + out_dir * 5.0)
					var p2 := CausalClockGeometry.point(a + 0.7, r_edge + out_dir * 5.0)
					var p3 := CausalClockGeometry.point(a + 1.3, r_edge)
					draw_colored_polygon(PackedVector2Array([p0, p1, p2, p3]), brass["light"])
					t += 4.0
				draw_arc(Vector2.ZERO, r_edge - out_dir * 1.5, deg_to_rad(a0 - 90.0), deg_to_rad(a0 + step - 90.0), 24, brass["base"], 3.0, true)
		elif not c.has_cam() or c.cam_element != index:
			var tt := 0.0
			while tt < 360.0:
				draw_line(CausalClockGeometry.point(tt, r_edge), CausalClockGeometry.point(tt, r_edge + out_dir * 2.5), mat["light"] * Color(1, 1, 1, 0.45), 1.4, true)
				tt += 3.0


func _draw_segment(si: int) -> void:
	var s := element.segments[si]
	var pts := paths[si]
	var is_linked := linked.has(si)
	# Recessed channel.
	draw_polyline(pts, Color(0, 0, 0, 0.55), 15.0, true)
	draw_polyline(pts, mat["dark"].darkened(0.35), 11.0, true)
	draw_polyline(pts, CausalClockPalette.INLAY_LIT if is_linked else CausalClockPalette.INLAY_DIM, 3.0 if is_linked else 2.0, true)
	var col := CausalClockPalette.CHAIN_LIT if is_linked else CausalClockPalette.CHAIN_METAL
	CausalClockDraw.chain(self, pts, LINK, col, 1.0 if is_linked else 0.0)
	# Ports where the chain meets the ring edge.
	var step := element.step_degrees()
	if s.out_slot != CausalClockLayout.NONE:
		_draw_port(CausalClockGeometry.point(s.out_slot * step, geo.r_out[index] - 2.5), is_linked)
	if s.in_slot != CausalClockLayout.NONE:
		_draw_port(CausalClockGeometry.point(s.in_slot * step, geo.r_in[index] + 2.5), is_linked)
	if not s.is_through():
		_draw_broken_end(pts)
	if s.marker != "":
		_draw_marker(s, pts)


func _draw_port(p: Vector2, lit: bool) -> void:
	draw_circle(p, 5.5, Color(0, 0, 0, 0.6))
	draw_arc(p, 5.0, 0, TAU, 14, Color(0.85, 0.7, 0.42), 1.6, true)
	draw_circle(p, 2.6, CausalClockPalette.INLAY_LIT if lit else Color(0.25, 0.18, 0.1))


func _draw_broken_end(pts: PackedVector2Array) -> void:
	var n := pts.size()
	if n < 2:
		return
	var end := pts[n - 1]
	var t := (pts[n - 1] - pts[n - 2]).normalized()
	var nrm := Vector2(-t.y, t.x)
	# A snapped, half-open link and a couple of loose fragments.
	draw_arc(end + t * 4.0, 4.0, t.angle() - 0.4, t.angle() + PI * 0.9, 8, CausalClockPalette.CHAIN_DIM, 2.0, true)
	draw_line(end + t * 9.0 + nrm * 2.0, end + t * 12.0 + nrm * 4.0, CausalClockPalette.CHAIN_DIM, 1.6, true)
	draw_circle(end + t * 14.0 - nrm * 3.0, 1.2, CausalClockPalette.CHAIN_DIM)


func _draw_marker(s: CausalClockLayout.SegmentDef, pts: PackedVector2Array) -> void:
	var p := pts[pts.size() / 2]
	var lit: bool = marker_lit.get(s.marker, false)
	var gold := CausalClockPalette.material("gold")
	var enamel := CausalClockPalette.material("enamel")
	draw_circle(p + Vector2(1.5, 2.5), 12.5, Color(0, 0, 0, 0.5))
	draw_circle(p, 12.0, gold["dark"])
	draw_circle(p, 10.5, gold["base"] if lit else gold["dark"].lightened(0.15))
	draw_circle(p, 8.5, enamel["base"] if not lit else enamel["light"])
	var icon: Texture2D = marker_icons.get(s.marker)
	if icon != null:
		draw_set_transform(p, 0.0, Vector2.ONE)
		draw_texture_rect(icon, Rect2(Vector2(-7, -7), Vector2(14, 14)), false, Color(1, 1, 1, 1 if lit else 0.55))
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	else:
		draw_circle(p, 2.5, gold["light"] if lit else gold["base"])
	draw_arc(p, 11.2, -2.5, -0.8, 8, gold["edge"], 1.2, true)


func _draw_glow() -> void:
	var pulse_speed := 260.0
	for si in linked.keys():
		var pts: PackedVector2Array = paths[si]
		var off: float = chain_offset.get(si, 0.0)
		var res := CausalClockDraw.resample(pts, 9.0)
		var ps: PackedVector2Array = res[0]
		for i in ps.size():
			var dist := off + i * 9.0
			var wave := 0.5 + 0.5 * sin((dist - _time * pulse_speed) * 0.018)
			var a := 0.10 + 0.16 * wave + solved_glow * 0.25
			CausalClockDraw.glow(_glow, ps[i], 13.0 + 6.0 * solved_glow, CausalClockPalette.GLOW * Color(1, 1, 1, a))
