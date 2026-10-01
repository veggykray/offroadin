class_name CausalClockOverlay
extends Node2D
## World-fixed layer above the rings:
##  * lighting (a lamp at upper left, shade at lower right) so the rotating
##    rings sit under a believable, static light,
##  * selection / hover outlines,
##  * the cause-and-effect readout: curved arrows on every ring that WOULD
##    move if the hovered ring were turned clockwise, slip and jam markers,
##  * hint highlight, junction sparks and the ember where the chain breaks.

var layout: CausalClockLayout
var geo: CausalClockGeometry
var selected: int = -1
var hovered: int = -1
var preview: CausalClockMechanism.MoveResult = null
var hint_element: int = -1
var hint_dir: int = 0
var break_angle: float = 0.0
var break_element: int = -1
var show_break: bool = true
var solved: float = 0.0

var _time: float = 0.0
var _sparks: Array = []  # [pos, age, color]
var _add: Node2D


func setup(p_layout: CausalClockLayout, p_geo: CausalClockGeometry) -> void:
	layout = p_layout
	geo = p_geo
	_add = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_add.material = m
	_add.draw.connect(_draw_additive)
	add_child(_add)


func spark(at: Vector2, color: Color = CausalClockPalette.GLOW, count: int = 1) -> void:
	for k in count:
		var jitter := Vector2(randf_range(-6, 6), randf_range(-6, 6)) if k > 0 else Vector2.ZERO
		_sparks.append([at + jitter, -k * 0.05, color])


func _process(dt: float) -> void:
	_time += dt
	for i in range(_sparks.size() - 1, -1, -1):
		_sparks[i][1] += dt
		if _sparks[i][1] > 1.2:
			_sparks.remove_at(i)
	queue_redraw()
	_add.queue_redraw()


func _band_r(e: int) -> Vector2:
	if e == layout.hub_index():
		return Vector2(0.0, geo.hub_radius)
	return Vector2(geo.r_in[e], geo.r_out[e])


func _draw() -> void:
	# Shade (normal blend) on the lower right of the ring area.
	CausalClockDraw.glow(self, Vector2(geo.outer_radius * 0.55, geo.outer_radius * 0.6), geo.outer_radius * 1.1, Color(0, 0, 0, 0.28))
	if hovered >= 0 and hovered != selected:
		var r := _band_r(hovered)
		draw_arc(Vector2.ZERO, r.y + 1.5, 0, TAU, 160, CausalClockPalette.HOVER * Color(1, 1, 1, 0.55), 1.5, true)
		if r.x > 0.0:
			draw_arc(Vector2.ZERO, r.x - 1.5, 0, TAU, 160, CausalClockPalette.HOVER * Color(1, 1, 1, 0.55), 1.5, true)
	if selected >= 0:
		var r2 := _band_r(selected)
		var w := 2.2 + 0.6 * sin(_time * 3.0)
		draw_arc(Vector2.ZERO, r2.y + 2.0, 0, TAU, 180, CausalClockPalette.SELECT, w, true)
		if r2.x > 0.0:
			draw_arc(Vector2.ZERO, r2.x - 2.0, 0, TAU, 180, CausalClockPalette.SELECT, w, true)
	if preview != null:
		_draw_preview()
	if hint_element >= 0:
		_draw_hint()


## Arrows sit just clockwise of each ring's rail plate so the readout is
## always in the same, predictable place.
func _arrow(e: int, dir: int, color: Color, size: float = 1.0) -> void:
	var el := layout.elements[e]
	var r := geo.mid(e)
	var base := el.pin_angle_deg + 34.0 if not el.is_hub else 210.0
	var span := 16.0 * size * (60.0 / maxf(r, 60.0)) * 2.4
	span = minf(span, 50.0)
	var a0 := base - span * 0.5
	var a1 := base + span * 0.5
	if dir < 0:
		var tmp := a0
		a0 = a1
		a1 = tmp
	var pts := CausalClockGeometry.arc(r, a0, a1, 2.0)
	draw_polyline(pts, Color(0, 0, 0, 0.6), 8.5 * size, true)
	draw_polyline(pts, color, 4.5 * size, true)
	var tip := pts[pts.size() - 1]
	var t := (pts[pts.size() - 1] - pts[pts.size() - 2]).normalized()
	var n := Vector2(-t.y, t.x)
	var head := PackedVector2Array([tip + t * 9 * size, tip + n * 6 * size, tip - n * 6 * size])
	draw_colored_polygon(head, color)


func _draw_preview() -> void:
	var p := preview
	if p.ok:
		for e in p.deltas.size():
			var d := p.deltas[e]
			if d == 0:
				continue
			var col := CausalClockPalette.CW if d > 0 else CausalClockPalette.CCW
			_arrow(e, signi(d), col * Color(1, 1, 1, 0.9 if e == p.element else 0.75), 1.15 if e == p.element else 0.9)
			if absi(d) > 1:
				var lbl_at := CausalClockGeometry.point(layout.elements[e].pin_angle_deg + 34.0, geo.mid(e) + 14)
				CausalClockDraw.text(self, lbl_at, "×%d" % absi(d), 13, col)
	elif p.reason == "jam" and p.jam_element >= 0:
		_arrow(p.element, p.dir, CausalClockPalette.WARN * Color(1, 1, 1, 0.8), 1.1)
		var at := CausalClockGeometry.point(210.0, geo.mid(p.jam_element)) if p.jam_element == layout.hub_index() else CausalClockGeometry.point(layout.elements[p.jam_element].pin_angle_deg + 34.0, geo.mid(p.jam_element))
		draw_line(at - Vector2(9, 9), at + Vector2(9, 9), CausalClockPalette.WARN, 4.0, true)
		draw_line(at - Vector2(9, -9), at + Vector2(9, -9), CausalClockPalette.WARN, 4.0, true)


func _draw_hint() -> void:
	var b := 0.5 + 0.5 * sin(_time * 4.0)
	var col := Color(0.6, 0.88, 1.0, 0.55 + 0.4 * b)
	if hint_dir != 0:
		_arrow(hint_element, hint_dir, col, 1.5)
	var r := _band_r(hint_element)
	draw_arc(Vector2.ZERO, r.y + 3.0, 0, TAU, 180, col * Color(1, 1, 1, 0.5), 2.0, true)


func _draw_additive() -> void:
	# Lamp light from the upper left.
	CausalClockDraw.glow(_add, Vector2(-geo.outer_radius * 0.5, -geo.outer_radius * 0.55), geo.outer_radius * 1.15, Color(1.0, 0.85, 0.6, 0.10))
	CausalClockDraw.glow(_add, Vector2(-geo.outer_radius * 0.3, -geo.outer_radius * 0.35), geo.outer_radius * 0.5, Color(1.0, 0.9, 0.75, 0.05))
	for s in _sparks:
		var age: float = s[1]
		if age < 0.0:
			continue
		var k := 1.0 - age / 1.2
		CausalClockDraw.glow(_add, s[0], 10.0 + age * 60.0, Color(s[2], 0.9 * k * k))
	if show_break and break_element >= 0 and solved <= 0.0:
		var r := geo.r_out[break_element] if break_element < layout.ring_count else geo.hub_radius
		var at := CausalClockGeometry.point(break_angle, r + CausalClockGeometry.GAP * 0.5)
		var f := 0.6 + 0.4 * sin(_time * 7.0) * sin(_time * 3.1)
		CausalClockDraw.glow(_add, at, 16.0, Color(1.0, 0.4, 0.15, 0.35 * f))
	if selected >= 0 and solved <= 0.0:
		var r2 := _band_r(selected)
		var a := 0.22 + 0.08 * sin(_time * 3.0)
		_add.draw_arc(Vector2.ZERO, r2.y + 2.0, 0, TAU, 180, CausalClockPalette.SELECT * Color(1, 1, 1, a), 9.0, true)
		if r2.x > 0.0:
			_add.draw_arc(Vector2.ZERO, r2.x - 2.0, 0, TAU, 180, CausalClockPalette.SELECT * Color(1, 1, 1, a), 9.0, true)
	if solved > 0.0:
		CausalClockDraw.glow(_add, Vector2.ZERO, geo.bezel_outer * (0.6 + solved * 0.6), Color(1.0, 0.75, 0.4, 0.22 * solved))
